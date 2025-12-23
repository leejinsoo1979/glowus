/**
 * Terminal Tools - Command Execution via Terminal Server
 * Real shell command execution with streaming output
 */

import { exec, spawn } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)

// ============================================
// Types
// ============================================

export interface RunResult {
  success: boolean
  exitCode: number
  stdout: string
  stderr: string
  executionTime: number
  timedOut: boolean
  command: string
}

export interface DiagnosticItem {
  severity: 'error' | 'warning' | 'info'
  message: string
  file?: string
  line?: number
  column?: number
  source: 'build' | 'lint' | 'test' | 'typescript'
  code?: string
}

export interface DiagnosticsResult {
  success: boolean
  summary: {
    errors: number
    warnings: number
    infos: number
  }
  items: DiagnosticItem[]
  rawOutput?: string
}

// ============================================
// Command Execution Tool
// ============================================

export async function repoRun(params: {
  command: string
  cwd?: string
  timeout?: number
  env?: Record<string, string>
}): Promise<RunResult> {
  const { command, cwd = process.cwd(), timeout = 60000, env = {} } = params
  const startTime = Date.now()

  try {
    const { stdout, stderr } = await execPromise(command, {
      cwd,
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      env: { ...process.env, ...env },
    })

    return {
      success: true,
      exitCode: 0,
      stdout: stdout.toString(),
      stderr: stderr.toString(),
      executionTime: Date.now() - startTime,
      timedOut: false,
      command,
    }
  } catch (error: any) {
    const timedOut = error.killed && error.signal === 'SIGTERM'

    return {
      success: false,
      exitCode: error.code ?? 1,
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || error.message || '',
      executionTime: Date.now() - startTime,
      timedOut,
      command,
    }
  }
}

// ============================================
// Streaming Command Execution
// ============================================

export function repoRunStream(params: {
  command: string
  args?: string[]
  cwd?: string
  onStdout?: (data: string) => void
  onStderr?: (data: string) => void
  onExit?: (code: number) => void
}): { kill: () => void; promise: Promise<RunResult> } {
  const { command, args = [], cwd = process.cwd(), onStdout, onStderr, onExit } = params
  const startTime = Date.now()

  let stdout = ''
  let stderr = ''

  const child = spawn(command, args, {
    cwd,
    shell: true,
    env: process.env,
  })

  child.stdout?.on('data', (data) => {
    const str = data.toString()
    stdout += str
    onStdout?.(str)
  })

  child.stderr?.on('data', (data) => {
    const str = data.toString()
    stderr += str
    onStderr?.(str)
  })

  const promise = new Promise<RunResult>((resolve) => {
    child.on('exit', (code) => {
      const exitCode = code ?? 0
      onExit?.(exitCode)
      resolve({
        success: exitCode === 0,
        exitCode,
        stdout,
        stderr,
        executionTime: Date.now() - startTime,
        timedOut: false,
        command: `${command} ${args.join(' ')}`.trim(),
      })
    })

    child.on('error', (error) => {
      resolve({
        success: false,
        exitCode: 1,
        stdout,
        stderr: error.message,
        executionTime: Date.now() - startTime,
        timedOut: false,
        command: `${command} ${args.join(' ')}`.trim(),
      })
    })
  })

  return {
    kill: () => child.kill(),
    promise,
  }
}

// ============================================
// Diagnostics Tool (Build/Lint/Test)
// ============================================

export async function repoDiagnostics(params: {
  source?: 'build' | 'lint' | 'test' | 'typescript' | 'all'
  cwd?: string
}): Promise<DiagnosticsResult> {
  const { source = 'all', cwd = process.cwd() } = params
  const items: DiagnosticItem[] = []

  // TypeScript check
  if (source === 'typescript' || source === 'all') {
    const tscResult = await repoRun({
      command: 'npx tsc --noEmit --pretty false 2>&1',
      cwd,
      timeout: 120000,
    })

    if (!tscResult.success || tscResult.stderr || tscResult.stdout) {
      const output = tscResult.stdout || tscResult.stderr
      const tsErrors = parseTscOutput(output)
      items.push(...tsErrors)
    }
  }

  // ESLint check
  if (source === 'lint' || source === 'all') {
    const lintResult = await repoRun({
      command: 'npx eslint . --format json --max-warnings 0 2>/dev/null || true',
      cwd,
      timeout: 120000,
    })

    if (lintResult.stdout) {
      try {
        const eslintOutput = JSON.parse(lintResult.stdout)
        const lintErrors = parseEslintOutput(eslintOutput)
        items.push(...lintErrors)
      } catch {
        // ESLint output wasn't JSON
      }
    }
  }

  // Build check
  if (source === 'build' || source === 'all') {
    const buildResult = await repoRun({
      command: 'npm run build 2>&1',
      cwd,
      timeout: 300000, // 5 minutes
    })

    if (!buildResult.success) {
      const buildErrors = parseBuildOutput(buildResult.stderr || buildResult.stdout)
      items.push(...buildErrors)
    }
  }

  // Test check
  if (source === 'test' || source === 'all') {
    const testResult = await repoRun({
      command: 'npm test -- --passWithNoTests 2>&1 || true',
      cwd,
      timeout: 300000,
    })

    if (!testResult.success) {
      const testErrors = parseTestOutput(testResult.stdout || testResult.stderr)
      items.push(...testErrors)
    }
  }

  const summary = {
    errors: items.filter((i) => i.severity === 'error').length,
    warnings: items.filter((i) => i.severity === 'warning').length,
    infos: items.filter((i) => i.severity === 'info').length,
  }

  return {
    success: summary.errors === 0,
    summary,
    items,
  }
}

// ============================================
// Output Parsers
// ============================================

function parseTscOutput(output: string): DiagnosticItem[] {
  const items: DiagnosticItem[] = []
  const lines = output.split('\n')

  // TypeScript error format: file(line,col): error TSxxxx: message
  const errorRegex = /^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)$/

  for (const line of lines) {
    const match = line.match(errorRegex)
    if (match) {
      items.push({
        severity: match[4] as 'error' | 'warning',
        message: match[6],
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        source: 'typescript',
        code: match[5],
      })
    }
  }

  return items
}

function parseEslintOutput(output: any[]): DiagnosticItem[] {
  const items: DiagnosticItem[] = []

  for (const file of output) {
    for (const message of file.messages || []) {
      items.push({
        severity: message.severity === 2 ? 'error' : 'warning',
        message: message.message,
        file: file.filePath,
        line: message.line,
        column: message.column,
        source: 'lint',
        code: message.ruleId,
      })
    }
  }

  return items
}

function parseBuildOutput(output: string): DiagnosticItem[] {
  const items: DiagnosticItem[] = []
  const lines = output.split('\n')

  for (const line of lines) {
    if (line.includes('error') || line.includes('Error')) {
      items.push({
        severity: 'error',
        message: line.trim(),
        source: 'build',
      })
    } else if (line.includes('warning') || line.includes('Warning')) {
      items.push({
        severity: 'warning',
        message: line.trim(),
        source: 'build',
      })
    }
  }

  return items
}

function parseTestOutput(output: string): DiagnosticItem[] {
  const items: DiagnosticItem[] = []
  const lines = output.split('\n')

  for (const line of lines) {
    if (line.includes('FAIL') || line.includes('✕') || line.includes('✗')) {
      items.push({
        severity: 'error',
        message: line.trim(),
        source: 'test',
      })
    }
  }

  return items
}

export default {
  run: repoRun,
  runStream: repoRunStream,
  diagnostics: repoDiagnostics,
}
