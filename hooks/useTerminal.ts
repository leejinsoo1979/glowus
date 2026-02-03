/**
 * useTerminal Hook
 *
 * Provides secure terminal execution for apps.
 * Integrates with the Claude Code terminal API.
 */

import { useState, useCallback, useRef } from 'react'

// ============================================
// Types
// ============================================

export type AgentRole = 'jeremy' | 'rachel' | 'amy' | 'antigravity'
export type DiagnosticSource = 'build' | 'lint' | 'test' | 'typescript' | 'all'

export interface TerminalResult {
  success: boolean
  exitCode?: number
  stdout?: string
  stderr?: string
  executionTime?: string
  timedOut?: boolean
  error?: string
}

export interface DiagnosticIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
  file?: string
  line?: number
  source?: string
  code?: string
}

export interface DiagnosticResult {
  success: boolean
  summary?: string
  issues?: DiagnosticIssue[]
  totalIssues?: number
  truncated?: boolean
  error?: string
}

export interface UseTerminalOptions {
  agentRole?: AgentRole
  defaultTimeout?: number
  cwd?: string
}

export interface UseTerminalReturn {
  // State
  isRunning: boolean
  result: TerminalResult | null
  error: string | null
  history: { command: string; result: TerminalResult }[]

  // Actions
  run: (command: string, timeout?: number) => Promise<TerminalResult>
  runDiagnostics: (source?: DiagnosticSource) => Promise<DiagnosticResult>
  npm: (args: string) => Promise<TerminalResult>
  git: (args: string) => Promise<TerminalResult>
  node: (script: string) => Promise<TerminalResult>
  clear: () => void
  abort: () => void
}

// ============================================
// Default Options
// ============================================

const DEFAULT_OPTIONS: Required<UseTerminalOptions> = {
  agentRole: 'jeremy',
  defaultTimeout: 60000,
  cwd: '',
}

// ============================================
// Hook Implementation
// ============================================

export function useTerminal(options: UseTerminalOptions = {}): UseTerminalReturn {
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<TerminalResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<{ command: string; result: TerminalResult }[]>([])

  const abortControllerRef = useRef<AbortController | null>(null)
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }

  /**
   * Run a terminal command
   */
  const run = useCallback(async (
    command: string,
    timeout?: number
  ): Promise<TerminalResult> => {
    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()

    setIsRunning(true)
    setError(null)

    try {
      const response = await fetch('/api/claude-code/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          agentRole: mergedOptions.agentRole,
          cwd: mergedOptions.cwd || undefined,
          timeout: timeout || mergedOptions.defaultTimeout,
        }),
        signal: abortControllerRef.current.signal,
      })

      const data: TerminalResult = await response.json()

      setResult(data)
      setHistory(prev => [...prev, { command, result: data }])

      if (!data.success) {
        setError(data.error || 'Command failed')
      }

      return data

    } catch (err: any) {
      if (err.name === 'AbortError') {
        const abortResult: TerminalResult = {
          success: false,
          error: 'Command aborted',
        }
        setResult(abortResult)
        return abortResult
      }

      const errorMessage = err.message || 'Unknown error'
      setError(errorMessage)

      const errorResult: TerminalResult = {
        success: false,
        error: errorMessage,
      }
      setResult(errorResult)
      return errorResult

    } finally {
      setIsRunning(false)
      abortControllerRef.current = null
    }
  }, [mergedOptions])

  /**
   * Run diagnostics
   */
  const runDiagnostics = useCallback(async (
    source: DiagnosticSource = 'all'
  ): Promise<DiagnosticResult> => {
    setIsRunning(true)
    setError(null)

    try {
      const response = await fetch('/api/claude-code/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          cwd: mergedOptions.cwd || undefined,
        }),
      })

      const data: DiagnosticResult = await response.json()

      if (!data.success) {
        setError(data.error || 'Diagnostics failed')
      }

      return data

    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error'
      setError(errorMessage)

      return {
        success: false,
        error: errorMessage,
      }

    } finally {
      setIsRunning(false)
    }
  }, [mergedOptions])

  /**
   * NPM shortcut
   */
  const npm = useCallback((args: string): Promise<TerminalResult> => {
    return run(`npm ${args}`)
  }, [run])

  /**
   * Git shortcut
   */
  const git = useCallback((args: string): Promise<TerminalResult> => {
    return run(`git ${args}`)
  }, [run])

  /**
   * Node shortcut
   */
  const node = useCallback((script: string): Promise<TerminalResult> => {
    return run(`node -e "${script.replace(/"/g, '\\"')}"`)
  }, [run])

  /**
   * Clear history
   */
  const clear = useCallback(() => {
    setResult(null)
    setError(null)
    setHistory([])
  }, [])

  /**
   * Abort current command
   */
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  return {
    isRunning,
    result,
    error,
    history,
    run,
    runDiagnostics,
    npm,
    git,
    node,
    clear,
    abort,
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get available commands for a role
 */
export async function getAvailableCommands(role: AgentRole = 'jeremy'): Promise<{
  role: string
  commands: string[]
}> {
  try {
    const response = await fetch(`/api/claude-code/terminal?role=${role}`)
    const data = await response.json()

    return {
      role: data.role,
      commands: data.allowedCommands || [],
    }
  } catch {
    return {
      role,
      commands: [],
    }
  }
}

/**
 * Pre-configured hook for Jeremy (developer) role
 */
export function useDeveloperTerminal(options?: Omit<UseTerminalOptions, 'agentRole'>) {
  return useTerminal({ ...options, agentRole: 'jeremy' })
}

/**
 * Pre-configured hook for Rachel (research) role
 */
export function useResearchTerminal(options?: Omit<UseTerminalOptions, 'agentRole'>) {
  return useTerminal({ ...options, agentRole: 'rachel' })
}

/**
 * Pre-configured hook for Antigravity (admin) role
 */
export function useAdminTerminal(options?: Omit<UseTerminalOptions, 'agentRole'>) {
  return useTerminal({ ...options, agentRole: 'antigravity' })
}

export default useTerminal
