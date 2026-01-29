/**
 * useClaudeCodeCLI Hook
 *
 * Claude Code CLI 프록시를 통한 실시간 스트리밍 AI 코딩 지원.
 * Monaco Editor와 통합하여 VSCode Claude 익스텐션과 유사한 경험 제공.
 */

import { useState, useCallback, useRef } from 'react'

// ============================================
// Types
// ============================================

export interface ToolUse {
  id: string
  name: 'Read' | 'Write' | 'Edit' | 'Bash' | 'Glob' | 'Grep' | 'LS' | string
  input: Record<string, any>
}

export interface ToolResult {
  toolUseId: string
  content: string
  isError?: boolean
}

export interface StreamMessage {
  type: 'system' | 'thinking' | 'tool' | 'tool_result' | 'text' | 'progress' | 'status' | 'error' | 'result' | 'done'
  content?: string
  // System
  sessionId?: string
  tools?: string[]
  model?: string
  // Tool
  name?: string
  input?: Record<string, any>
  id?: string
  // Tool result
  toolUseId?: string
  isError?: boolean
  // Result
  cost?: number
  duration?: number
  // Done
  code?: number
}

export interface CodeContext {
  fileName?: string
  selectedCode?: string
  language?: string
  lineRange?: { start: number; end: number }
}

export interface CLIOptions {
  model?: string
  allowedTools?: string[]
  maxTurns?: number
  sessionId?: string
  cwd?: string
}

export interface UseClaudeCodeCLIReturn {
  // State
  isStreaming: boolean
  messages: StreamMessage[]
  sessionId: string | null
  error: string | null

  // Computed
  thinkingContent: string
  textContent: string
  toolCalls: ToolUse[]
  toolResults: ToolResult[]

  // Actions
  sendMessage: (prompt: string, context?: CodeContext, options?: CLIOptions) => Promise<void>
  continueSession: (prompt: string, context?: CodeContext) => Promise<void>
  abort: () => void
  reset: () => void
}

// ============================================
// Hook Implementation
// ============================================

export function useClaudeCodeCLI(): UseClaudeCodeCLIReturn {
  const [isStreaming, setIsStreaming] = useState(false)
  const [messages, setMessages] = useState<StreamMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  // ============================================
  // Computed Values
  // ============================================

  const thinkingContent = messages
    .filter(m => m.type === 'thinking')
    .map(m => m.content)
    .join('\n')

  const textContent = messages
    .filter(m => m.type === 'text')
    .map(m => m.content)
    .join('')

  const toolCalls: ToolUse[] = messages
    .filter(m => m.type === 'tool')
    .map(m => ({
      id: m.id || '',
      name: m.name || '',
      input: m.input || {}
    }))

  const toolResults: ToolResult[] = messages
    .filter(m => m.type === 'tool_result')
    .map(m => ({
      toolUseId: m.toolUseId || '',
      content: m.content || '',
      isError: m.isError
    }))

  // ============================================
  // Core Functions
  // ============================================

  const sendMessage = useCallback(async (
    prompt: string,
    context?: CodeContext,
    options?: CLIOptions
  ) => {
    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()

    setIsStreaming(true)
    setError(null)
    setMessages([])

    try {
      const response = await fetch('/api/glow-code/cli-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          context: context ? {
            fileName: context.fileName,
            selectedCode: context.selectedCode,
            language: context.language,
          } : undefined,
          options: {
            model: options?.model || 'claude-sonnet-4-20250514',
            allowedTools: options?.allowedTools || ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
            maxTurns: options?.maxTurns || 10,
            sessionId: options?.sessionId || sessionId || undefined,
            cwd: options?.cwd,
          }
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      readerRef.current = reader
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: StreamMessage = JSON.parse(line.slice(6))

              // Update session ID from system message
              if (data.type === 'system' && data.sessionId) {
                setSessionId(data.sessionId)
              }

              // Update session ID from result
              if (data.type === 'result' && data.sessionId) {
                setSessionId(data.sessionId)
              }

              // Handle error
              if (data.type === 'error') {
                setError(data.content || 'Unknown error')
              }

              setMessages(prev => [...prev, data])

            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => [...prev, { type: 'status', content: '요청이 취소되었습니다.' }])
      } else {
        setError(err.message || 'Unknown error')
        setMessages(prev => [...prev, { type: 'error', content: err.message }])
      }
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
      readerRef.current = null
    }
  }, [sessionId])

  const continueSession = useCallback(async (
    prompt: string,
    context?: CodeContext
  ) => {
    if (!sessionId) {
      return sendMessage(prompt, context)
    }
    return sendMessage(prompt, context, { sessionId })
  }, [sessionId, sendMessage])

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (readerRef.current) {
      readerRef.current.cancel()
    }
  }, [])

  const reset = useCallback(() => {
    abort()
    setIsStreaming(false)
    setMessages([])
    setSessionId(null)
    setError(null)
  }, [abort])

  return {
    // State
    isStreaming,
    messages,
    sessionId,
    error,

    // Computed
    thinkingContent,
    textContent,
    toolCalls,
    toolResults,

    // Actions
    sendMessage,
    continueSession,
    abort,
    reset,
  }
}

// ============================================
// Helper Components for Rendering
// ============================================

export function formatToolName(name: string): string {
  const icons: Record<string, string> = {
    Read: '📖',
    Write: '📝',
    Edit: '✏️',
    Bash: '💻',
    Glob: '🔍',
    Grep: '🔎',
    LS: '📁',
  }
  return `${icons[name] || '🔧'} ${name}`
}

export function getToolDescription(tool: ToolUse): string {
  switch (tool.name) {
    case 'Read':
      return `Reading: ${tool.input.file_path}`
    case 'Write':
      return `Writing: ${tool.input.file_path}`
    case 'Edit':
      return `Editing: ${tool.input.file_path}`
    case 'Bash':
      return `$ ${tool.input.command}`
    case 'Glob':
      return `Searching: ${tool.input.pattern}`
    case 'Grep':
      return `Grep: ${tool.input.pattern}`
    case 'LS':
      return `Listing: ${tool.input.path || '.'}`
    default:
      return JSON.stringify(tool.input)
  }
}

export default useClaudeCodeCLI
