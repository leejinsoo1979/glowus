'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type {
  AgentState,
  AgentMessage,
  AgentExecutionStage,
  AgentPlan,
  createInitialAgentState,
} from '../types'

// SSE Event types
interface SSEEvent {
  type: 'stage_change' | 'message' | 'plan' | 'tool_call' | 'tool_result' | 'error' | 'complete'
  data: unknown
  timestamp: number
}

interface StageChangeData {
  stage: AgentExecutionStage
  previousStage?: AgentExecutionStage
}

interface ToolCallData {
  name: string
  args: Record<string, unknown>
  id: string
}

interface ToolResultData {
  id: string
  name: string
  success: boolean
  result: unknown
  error?: string
  executionTime: number
}

interface UseAgentExecutionOptions {
  userId?: string
  projectPath?: string
  onStageChange?: (stage: AgentExecutionStage) => void
  onMessage?: (message: AgentMessage) => void
  onPlanGenerated?: (plan: AgentPlan) => void
  onError?: (error: string) => void
  onComplete?: () => void
}

interface UseAgentExecutionReturn {
  state: AgentState
  isExecuting: boolean
  currentStage: AgentExecutionStage
  execute: (input: string, imageDataUrl?: string) => Promise<void>
  approvePlan: () => Promise<void>
  rejectPlan: () => Promise<void>
  cancel: () => void
  reset: () => void
  addMessage: (message: AgentMessage) => void
}

function createInitialState(userId: string, projectPath?: string): AgentState {
  return {
    messages: [],
    context: {
      files: [],
      symbols: [],
      diagnostics: [],
    },
    plan: null,
    execution: {
      stage: 'idle',
      toolCallsCount: 0,
      lastToolResult: null,
      error: null,
    },
    metadata: {
      model: 'claude-3.5-sonnet',
      startTime: Date.now(),
      threadId: crypto.randomUUID(),
      userId,
      projectPath,
    },
    memory: {
      checkpoints: [],
      currentBranch: 'main',
      workingDirectory: projectPath || '/',
    },
  }
}

function updateState(prev: AgentState, event: SSEEvent): AgentState {
  switch (event.type) {
    case 'stage_change': {
      const data = event.data as StageChangeData
      return {
        ...prev,
        execution: {
          ...prev.execution,
          stage: data.stage,
        },
      }
    }

    case 'message': {
      const message = event.data as AgentMessage
      return {
        ...prev,
        messages: [...prev.messages, message],
      }
    }

    case 'plan': {
      const plan = event.data as AgentPlan
      return {
        ...prev,
        plan,
      }
    }

    case 'tool_call': {
      const data = event.data as ToolCallData
      const toolMessage: AgentMessage = {
        id: data.id,
        role: 'tool',
        content: `Calling ${data.name}...`,
        timestamp: event.timestamp,
        toolCall: {
          name: data.name,
          args: data.args,
        },
      }
      return {
        ...prev,
        messages: [...prev.messages, toolMessage],
        execution: {
          ...prev.execution,
          toolCallsCount: prev.execution.toolCallsCount + 1,
        },
      }
    }

    case 'tool_result': {
      const data = event.data as ToolResultData
      // Update the last tool message with result
      const messages = [...prev.messages]
      const toolMsgIndex = messages.findIndex(m => m.id === data.id)
      if (toolMsgIndex !== -1) {
        messages[toolMsgIndex] = {
          ...messages[toolMsgIndex],
          content: data.success
            ? `${data.name} completed successfully`
            : `${data.name} failed: ${data.error}`,
          toolCall: {
            ...messages[toolMsgIndex].toolCall!,
            result: data.result,
          },
        }
      }
      return {
        ...prev,
        messages,
        execution: {
          ...prev.execution,
          lastToolResult: JSON.stringify(data.result),
        },
      }
    }

    case 'error': {
      const error = event.data as string
      return {
        ...prev,
        execution: {
          ...prev.execution,
          error,
        },
      }
    }

    case 'complete': {
      return {
        ...prev,
        execution: {
          ...prev.execution,
          stage: 'idle',
        },
      }
    }

    default:
      return prev
  }
}

export function useAgentExecution(
  options: UseAgentExecutionOptions = {}
): UseAgentExecutionReturn {
  const {
    userId = 'default-user',
    projectPath,
    onStageChange,
    onMessage,
    onPlanGenerated,
    onError,
    onComplete,
  } = options

  const [state, setState] = useState<AgentState>(() =>
    createInitialState(userId, projectPath)
  )
  const [isExecuting, setIsExecuting] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      readerRef.current?.cancel()
    }
  }, [])

  const execute = useCallback(
    async (input: string, imageDataUrl?: string) => {
      if (isExecuting) {
        console.warn('Already executing')
        return
      }

      setIsExecuting(true)
      abortControllerRef.current = new AbortController()

      // Add user message to state
      const userMessage: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: input,
        timestamp: Date.now(),
        imageDataUrl,
        metadata: imageDataUrl
          ? { source: 'viewfinder', hasImage: true }
          : undefined,
      }

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        execution: {
          ...prev.execution,
          stage: 'plan',
          error: null,
        },
      }))

      try {
        const response = await fetch('/api/neural-map/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input,
            imageDataUrl,
            state: {
              ...state,
              messages: [...state.messages, userMessage],
            },
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        if (!response.body) {
          throw new Error('No response body')
        }

        // SSE streaming
        const reader = response.body.getReader()
        readerRef.current = reader
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event: SSEEvent = JSON.parse(line.slice(6))

                setState(prev => {
                  const newState = updateState(prev, event)

                  // Callbacks
                  if (event.type === 'stage_change') {
                    onStageChange?.(event.data as AgentExecutionStage)
                  } else if (event.type === 'message') {
                    onMessage?.(event.data as AgentMessage)
                  } else if (event.type === 'plan') {
                    onPlanGenerated?.(event.data as AgentPlan)
                  } else if (event.type === 'error') {
                    onError?.(event.data as string)
                  } else if (event.type === 'complete') {
                    onComplete?.()
                  }

                  return newState
                })
              } catch (parseError) {
                console.error('Failed to parse SSE event:', parseError)
              }
            }
          }
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          console.log('Execution cancelled')
        } else {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          setState(prev => ({
            ...prev,
            execution: {
              ...prev.execution,
              stage: 'idle',
              error: errorMessage,
            },
          }))
          onError?.(errorMessage)
        }
      } finally {
        setIsExecuting(false)
        abortControllerRef.current = null
        readerRef.current = null
      }
    },
    [isExecuting, state, onStageChange, onMessage, onPlanGenerated, onError, onComplete]
  )

  const approvePlan = useCallback(async () => {
    if (!state.plan || state.plan.approvalStatus !== 'pending') {
      console.warn('No pending plan to approve')
      return
    }

    setState(prev => ({
      ...prev,
      plan: prev.plan ? { ...prev.plan, approvalStatus: 'approved' } : null,
    }))

    // Continue execution with approval
    await execute('__APPROVAL__:approved')
  }, [state.plan, execute])

  const rejectPlan = useCallback(async () => {
    if (!state.plan || state.plan.approvalStatus !== 'pending') {
      console.warn('No pending plan to reject')
      return
    }

    setState(prev => ({
      ...prev,
      plan: prev.plan ? { ...prev.plan, approvalStatus: 'rejected' } : null,
      execution: {
        ...prev.execution,
        stage: 'idle',
      },
    }))

    // Notify rejection
    await execute('__APPROVAL__:rejected')
  }, [state.plan, execute])

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    readerRef.current?.cancel()
    setIsExecuting(false)
    setState(prev => ({
      ...prev,
      execution: {
        ...prev.execution,
        stage: 'idle',
        error: 'Cancelled by user',
      },
    }))
  }, [])

  const reset = useCallback(() => {
    abortControllerRef.current?.abort()
    readerRef.current?.cancel()
    setIsExecuting(false)
    setState(createInitialState(userId, projectPath))
  }, [userId, projectPath])

  const addMessage = useCallback((message: AgentMessage) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
    }))
  }, [])

  return {
    state,
    isExecuting,
    currentStage: state.execution.stage,
    execute,
    approvePlan,
    rejectPlan,
    cancel,
    reset,
    addMessage,
  }
}

export default useAgentExecution
