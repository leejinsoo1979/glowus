/**
 * Terminal Tool for GlowUS Agents
 *
 * Allows agents (Jeremy, Rachel, etc.) to execute shell commands
 * via the terminal server with proper security restrictions.
 */

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { repoRun, repoRunStream, repoDiagnostics } from '../neural-map/tools/terminal-tools'
import type { RunResult, DiagnosticsResult } from '../neural-map/tools/terminal-tools'

// ============================================
// Security Configuration
// ============================================

// Allowed commands by agent role
const ALLOWED_COMMANDS_BY_ROLE: Record<string, string[]> = {
  jeremy: ['npm', 'npx', 'node', 'git', 'tsc', 'eslint', 'prettier', 'pnpm', 'yarn', 'bun', 'cat', 'ls', 'pwd', 'echo', 'mkdir', 'touch', 'cp', 'mv'],
  rachel: ['curl', 'wget', 'jq', 'python', 'python3', 'pip', 'cat', 'ls', 'head', 'tail', 'grep', 'wc'],
  amy: [], // No direct terminal access
  antigravity: ['npm', 'git', 'docker', 'docker-compose'], // System admin
}

// Blocked command patterns (applied to all agents)
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

// ============================================
// Security Helpers
// ============================================

function isCommandAllowed(command: string, agentRole: string): { allowed: boolean; reason?: string } {
  const role = agentRole.toLowerCase()
  const allowedCommands = ALLOWED_COMMANDS_BY_ROLE[role] || []

  // Check if role has any permissions
  if (allowedCommands.length === 0) {
    return { allowed: false, reason: `Agent role '${role}' does not have terminal access.` }
  }

  // Check blocked patterns first
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return { allowed: false, reason: `Command contains blocked pattern: ${pattern.toString()}` }
    }
  }

  // Extract the base command (first word)
  const baseCommand = command.trim().split(/\s+/)[0]

  // Check if base command is allowed
  if (!allowedCommands.includes(baseCommand)) {
    return {
      allowed: false,
      reason: `Command '${baseCommand}' is not in the allowed list for ${role}. Allowed: ${allowedCommands.join(', ')}`
    }
  }

  return { allowed: true }
}

function sanitizeOutput(output: string): string {
  // Remove potential sensitive information from output
  return output
    .replace(/api[_-]?key[=:]\s*["']?[\w-]+["']?/gi, 'API_KEY=[REDACTED]')
    .replace(/token[=:]\s*["']?[\w-]+["']?/gi, 'TOKEN=[REDACTED]')
    .replace(/password[=:]\s*["']?[\w-]+["']?/gi, 'PASSWORD=[REDACTED]')
    .replace(/secret[=:]\s*["']?[\w-]+["']?/gi, 'SECRET=[REDACTED]')
}

// ============================================
// Terminal Tools
// ============================================

/**
 * Run Terminal Command Tool
 */
export function createRunTerminalTool(agentRole: string = 'jeremy'): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'run_terminal',
    description: `
Execute a shell command in the project directory.

ALLOWED COMMANDS for ${agentRole}:
${(ALLOWED_COMMANDS_BY_ROLE[agentRole.toLowerCase()] || []).join(', ') || 'None - contact admin'}

Examples:
- npm install lodash
- git status
- npm run build
- tsc --noEmit

DO NOT use for:
- System commands (rm -rf, sudo, etc.)
- Accessing sensitive files (.env, credentials)
- Long-running servers (use streaming tool instead)
`.trim(),
    schema: z.object({
      command: z.string().describe('The shell command to execute'),
      cwd: z.string().optional().describe('Working directory (default: project root)'),
      timeout: z.number().optional().default(60000).describe('Timeout in milliseconds (default: 60s, max: 5min)'),
    }),
    func: async ({ command, cwd, timeout = 60000 }) => {
      // Security check
      const check = isCommandAllowed(command, agentRole)
      if (!check.allowed) {
        return JSON.stringify({
          success: false,
          error: `🚫 Command blocked: ${check.reason}`,
          suggestion: 'Please use an allowed command or request permission from admin.'
        })
      }

      // Cap timeout at 5 minutes
      const actualTimeout = Math.min(timeout, 300000)

      console.log(`[${agentRole}] Executing: ${command}`)

      try {
        const result = await repoRun({
          command,
          cwd: cwd || process.cwd(),
          timeout: actualTimeout,
        })

        return JSON.stringify({
          success: result.success,
          exitCode: result.exitCode,
          stdout: sanitizeOutput(result.stdout),
          stderr: sanitizeOutput(result.stderr),
          executionTime: `${result.executionTime}ms`,
          timedOut: result.timedOut,
        })
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
  })
}

/**
 * Run Diagnostics Tool (Build/Lint/Test/TypeScript)
 */
export function createDiagnosticsTool(): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'run_diagnostics',
    description: `
Run project diagnostics to check for errors.

Sources:
- typescript: Run tsc --noEmit to check types
- lint: Run ESLint
- build: Run npm run build
- test: Run npm test
- all: Run all checks

Returns summary with error/warning counts and details.
`.trim(),
    schema: z.object({
      source: z.enum(['build', 'lint', 'test', 'typescript', 'all']).default('all').describe('Which diagnostic to run'),
      cwd: z.string().optional().describe('Project directory'),
    }),
    func: async ({ source = 'all', cwd }) => {
      console.log(`[Diagnostics] Running ${source} checks...`)

      try {
        const result = await repoDiagnostics({
          source,
          cwd: cwd || process.cwd(),
        })

        return JSON.stringify({
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
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
  })
}

/**
 * Git Operations Tool (convenience wrapper)
 */
export function createGitTool(agentRole: string = 'jeremy'): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'git_operation',
    description: `
Execute common Git operations safely.

Operations:
- status: Show working tree status
- diff: Show changes
- log: Show recent commits
- branch: List or create branches
- add: Stage files
- commit: Commit staged changes
- pull: Pull from remote
- push: Push to remote

Note: Destructive operations (reset --hard, force push) are blocked.
`.trim(),
    schema: z.object({
      operation: z.enum(['status', 'diff', 'log', 'branch', 'add', 'commit', 'pull', 'push']).describe('Git operation'),
      args: z.string().optional().describe('Additional arguments (e.g., file path, commit message)'),
      cwd: z.string().optional().describe('Repository directory'),
    }),
    func: async ({ operation, args = '', cwd }) => {
      // Build command
      let command: string

      switch (operation) {
        case 'status':
          command = 'git status --short'
          break
        case 'diff':
          command = `git diff ${args}`.trim()
          break
        case 'log':
          command = `git log --oneline -10 ${args}`.trim()
          break
        case 'branch':
          command = `git branch ${args}`.trim()
          break
        case 'add':
          command = `git add ${args || '.'}`.trim()
          break
        case 'commit':
          if (!args) {
            return JSON.stringify({ success: false, error: 'Commit message required in args' })
          }
          command = `git commit -m "${args.replace(/"/g, '\\"')}"`
          break
        case 'pull':
          command = 'git pull'
          break
        case 'push':
          command = 'git push'
          break
        default:
          return JSON.stringify({ success: false, error: `Unknown operation: ${operation}` })
      }

      // Security check (git is allowed for Jeremy)
      const check = isCommandAllowed(command, agentRole)
      if (!check.allowed) {
        return JSON.stringify({ success: false, error: check.reason })
      }

      console.log(`[${agentRole}] Git: ${command}`)

      try {
        const result = await repoRun({
          command,
          cwd: cwd || process.cwd(),
          timeout: 60000,
        })

        return JSON.stringify({
          success: result.success,
          output: sanitizeOutput(result.stdout || result.stderr),
          exitCode: result.exitCode,
        })
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
  })
}

/**
 * NPM Operations Tool (convenience wrapper)
 */
export function createNpmTool(agentRole: string = 'jeremy'): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'npm_operation',
    description: `
Execute common NPM operations safely.

Operations:
- install: Install packages (npm install [packages])
- uninstall: Remove packages
- run: Run npm scripts (npm run [script])
- list: List installed packages
- outdated: Check for outdated packages
- audit: Run security audit

Examples:
- { operation: "install", packages: "lodash axios" }
- { operation: "run", script: "build" }
- { operation: "audit" }
`.trim(),
    schema: z.object({
      operation: z.enum(['install', 'uninstall', 'run', 'list', 'outdated', 'audit']).describe('NPM operation'),
      packages: z.string().optional().describe('Package names (for install/uninstall)'),
      script: z.string().optional().describe('Script name (for run)'),
      cwd: z.string().optional().describe('Project directory'),
    }),
    func: async ({ operation, packages = '', script = '', cwd }) => {
      let command: string

      switch (operation) {
        case 'install':
          command = packages ? `npm install ${packages}` : 'npm install'
          break
        case 'uninstall':
          if (!packages) {
            return JSON.stringify({ success: false, error: 'Package names required' })
          }
          command = `npm uninstall ${packages}`
          break
        case 'run':
          if (!script) {
            return JSON.stringify({ success: false, error: 'Script name required' })
          }
          command = `npm run ${script}`
          break
        case 'list':
          command = 'npm list --depth=0'
          break
        case 'outdated':
          command = 'npm outdated'
          break
        case 'audit':
          command = 'npm audit'
          break
        default:
          return JSON.stringify({ success: false, error: `Unknown operation: ${operation}` })
      }

      const check = isCommandAllowed(command, agentRole)
      if (!check.allowed) {
        return JSON.stringify({ success: false, error: check.reason })
      }

      console.log(`[${agentRole}] NPM: ${command}`)

      try {
        const result = await repoRun({
          command,
          cwd: cwd || process.cwd(),
          timeout: 180000, // 3 minutes for npm operations
        })

        return JSON.stringify({
          success: result.success,
          output: sanitizeOutput(result.stdout || result.stderr).slice(0, 5000), // Limit output
          exitCode: result.exitCode,
          executionTime: `${result.executionTime}ms`,
        })
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
  })
}

// ============================================
// Export All Terminal Tools
// ============================================

export function getAllTerminalTools(agentRole: string = 'jeremy'): DynamicStructuredTool[] {
  return [
    createRunTerminalTool(agentRole),
    createDiagnosticsTool(),
    createGitTool(agentRole),
    createNpmTool(agentRole),
  ]
}

export default {
  createRunTerminalTool,
  createDiagnosticsTool,
  createGitTool,
  createNpmTool,
  getAllTerminalTools,
}
