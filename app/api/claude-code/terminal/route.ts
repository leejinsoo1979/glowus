/**
 * Claude Code Terminal API
 *
 * Provides secure terminal execution for apps.
 * Uses the agent terminal tools with role-based permissions.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { repoRun, repoDiagnostics } from '@/lib/neural-map/tools/terminal-tools'

// ============================================
// Types
// ============================================

type AgentRole = 'jeremy' | 'rachel' | 'amy' | 'antigravity'

interface TerminalRequest {
  command: string
  agentRole?: AgentRole
  cwd?: string
  timeout?: number
}

interface DiagnosticsRequest {
  source: 'build' | 'lint' | 'test' | 'typescript' | 'all'
  cwd?: string
}

// ============================================
// Security Configuration
// ============================================

const ALLOWED_COMMANDS_BY_ROLE: Record<AgentRole, string[]> = {
  jeremy: ['npm', 'npx', 'node', 'git', 'tsc', 'eslint', 'prettier', 'pnpm', 'yarn', 'bun', 'cat', 'ls', 'pwd', 'echo', 'mkdir', 'touch', 'cp', 'mv'],
  rachel: ['curl', 'wget', 'jq', 'python', 'python3', 'pip', 'cat', 'ls', 'head', 'tail', 'grep', 'wc'],
  amy: [], // No direct terminal access
  antigravity: ['npm', 'git', 'docker', 'docker-compose'],
}

const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+[\/~]/,           // rm -rf / or ~
  /sudo/,                        // sudo commands
  /chmod\s+777/,                 // chmod 777
  />\s*\/dev\//,                 // Writing to /dev
  /mkfs/,                        // Format commands
  /dd\s+if=/,                    // dd commands
  /:(){ :|:& };:/,              // Fork bomb
  /\|\s*sh/,                     // Piping to shell
  /curl.*\|\s*(ba)?sh/,         // curl | sh pattern
  /wget.*\|\s*(ba)?sh/,         // wget | sh pattern
  /eval\s*\(/,                   // eval in command
  /\.env/i,                      // Accessing .env files
  /password|secret|token|key/i, // Sensitive patterns
]

function isCommandAllowed(command: string, agentRole: AgentRole): { allowed: boolean; reason?: string } {
  const allowedCommands = ALLOWED_COMMANDS_BY_ROLE[agentRole] || []

  if (allowedCommands.length === 0) {
    return { allowed: false, reason: `Agent role '${agentRole}' does not have terminal access.` }
  }

  // Check blocked patterns first
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return { allowed: false, reason: `Command contains blocked pattern` }
    }
  }

  // Extract the base command (first word)
  const baseCommand = command.trim().split(/\s+/)[0]

  // Check if base command is allowed
  if (!allowedCommands.includes(baseCommand)) {
    return {
      allowed: false,
      reason: `Command '${baseCommand}' is not in the allowed list for ${agentRole}. Allowed: ${allowedCommands.join(', ')}`
    }
  }

  return { allowed: true }
}

function sanitizeOutput(output: string): string {
  return output
    .replace(/api[_-]?key[=:]\s*["']?[\w-]+["']?/gi, 'API_KEY=[REDACTED]')
    .replace(/token[=:]\s*["']?[\w-]+["']?/gi, 'TOKEN=[REDACTED]')
    .replace(/password[=:]\s*["']?[\w-]+["']?/gi, 'PASSWORD=[REDACTED]')
    .replace(/secret[=:]\s*["']?[\w-]+["']?/gi, 'SECRET=[REDACTED]')
}

// ============================================
// API Handlers
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Check if this is a diagnostics request
    if (body.source) {
      return handleDiagnostics(body as DiagnosticsRequest)
    }

    // Regular terminal command
    return handleTerminal(body as TerminalRequest)
  } catch (error: any) {
    console.error('[Terminal API] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Execution failed' },
      { status: 500 }
    )
  }
}

async function handleTerminal(body: TerminalRequest) {
  const {
    command,
    agentRole = 'jeremy',
    cwd,
    timeout = 60000,
  } = body

  if (!command) {
    return NextResponse.json(
      { success: false, error: 'Command is required' },
      { status: 400 }
    )
  }

  // Security check
  const check = isCommandAllowed(command, agentRole)
  if (!check.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Command blocked: ${check.reason}`,
        suggestion: 'Please use an allowed command or request permission from admin.'
      },
      { status: 403 }
    )
  }

  // Cap timeout at 5 minutes
  const actualTimeout = Math.min(timeout, 300000)

  console.log(`[Terminal API] Executing as ${agentRole}: ${command}`)

  const result = await repoRun({
    command,
    cwd: cwd || process.cwd(),
    timeout: actualTimeout,
  })

  return NextResponse.json({
    success: result.success,
    exitCode: result.exitCode,
    stdout: sanitizeOutput(result.stdout),
    stderr: sanitizeOutput(result.stderr),
    executionTime: `${result.executionTime}ms`,
    timedOut: result.timedOut,
  })
}

async function handleDiagnostics(body: DiagnosticsRequest) {
  const { source = 'all', cwd } = body

  console.log(`[Terminal API] Running ${source} diagnostics`)

  const result = await repoDiagnostics({
    source,
    cwd: cwd || process.cwd(),
  })

  return NextResponse.json({
    success: result.success,
    summary: result.summary,
    issues: result.items.slice(0, 20).map(item => ({
      severity: item.severity,
      message: item.message,
      file: item.file,
      line: item.line,
      source: item.source,
      code: item.code,
    })),
    totalIssues: result.items.length,
    truncated: result.items.length > 20,
  })
}

// ============================================
// GET - Available Commands Info
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const role = (searchParams.get('role') || 'jeremy') as AgentRole

  return NextResponse.json({
    status: 'ok',
    role,
    allowedCommands: ALLOWED_COMMANDS_BY_ROLE[role] || [],
    allRoles: Object.keys(ALLOWED_COMMANDS_BY_ROLE),
    diagnostics: {
      available: ['build', 'lint', 'test', 'typescript', 'all'],
    },
  })
}
