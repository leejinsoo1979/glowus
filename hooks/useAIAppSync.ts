'use client'

import { useCallback, useRef, useState } from 'react'

// ============================================
// Types
// ============================================

export type AIAppType = 'glow_code' | 'docs' | 'slides' | 'sheet' | 'image' | 'blog' | 'summary'

export interface AIAppMessage {
  id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: Record<string, any>
  toolCalls?: any[]
}

export interface AIAppThread {
  id: string
  title: string
  threadType: AIAppType
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

interface UseAIAppSyncOptions {
  /** 앱 타입 (docs, slides, sheet 등) */
  appType: AIAppType
  /** 자동으로 스레드 생성 여부 (기본: true) */
  autoCreateThread?: boolean
  /** 디버그 모드 (기본: false) */
  debug?: boolean
}

interface UseAIAppSyncReturn {
  /** 현재 스레드 ID */
  threadId: string | null
  /** 로딩 상태 */
  isLoading: boolean
  /** 에러 상태 */
  error: string | null
  /** 새 스레드 생성 */
  createThread: (title?: string, metadata?: Record<string, any>) => Promise<string | null>
  /** 메시지 저장 */
  saveMessage: (message: AIAppMessage) => Promise<boolean>
  /** 여러 메시지 일괄 저장 */
  saveMessages: (messages: AIAppMessage[]) => Promise<boolean>
  /** 스레드 제목 업데이트 */
  updateThreadTitle: (title: string) => Promise<boolean>
  /** 스레드 메타데이터 업데이트 */
  updateThreadMetadata: (metadata: Record<string, any>) => Promise<boolean>
  /** 현재 스레드 ID 설정 (기존 스레드 로드 시) */
  setThreadId: (id: string | null) => void
  /** 스레드 초기화 (새로 시작) */
  resetThread: () => void
}

// ============================================
// Hook
// ============================================

/**
 * 범용 AI 앱 DB 동기화 훅
 *
 * 모든 AI 앱에서 사용할 수 있는 공통 동기화 로직을 제공합니다.
 * - 스레드 생성 및 관리
 * - 메시지 저장
 * - 메타데이터 관리
 *
 * @example
 * ```tsx
 * const { threadId, saveMessage, createThread } = useAIAppSync({
 *   appType: 'docs',
 *   autoCreateThread: true,
 * })
 *
 * // 메시지 저장
 * await saveMessage({ role: 'user', content: '문서 작성해줘' })
 * await saveMessage({ role: 'assistant', content: '문서를 작성했습니다.' })
 * ```
 */
export function useAIAppSync(options: UseAIAppSyncOptions): UseAIAppSyncReturn {
  const { appType, autoCreateThread = true, debug = false } = options

  const [threadId, setThreadId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 스레드 생성 중 중복 방지
  const isCreatingThread = useRef(false)
  // 메시지 큐 (스레드 생성 대기 중인 메시지들)
  const messageQueue = useRef<AIAppMessage[]>([])

  const log = useCallback((...args: any[]) => {
    if (debug) {
      console.log(`[AIAppSync:${appType}]`, ...args)
    }
  }, [debug, appType])

  // ============================================
  // Thread Operations
  // ============================================

  /**
   * 새 스레드 생성
   */
  const createThread = useCallback(async (
    title?: string,
    metadata?: Record<string, any>
  ): Promise<string | null> => {
    // 이미 생성 중이면 스킵
    if (isCreatingThread.current) {
      log('Thread creation already in progress, skipping...')
      return null
    }

    isCreatingThread.current = true
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai-threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || 'New Chat',
          threadType: appType,
          metadata: metadata || {},
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create thread')
      }

      const { thread } = await response.json()
      const newThreadId = thread?.id

      if (newThreadId) {
        setThreadId(newThreadId)
        log('Thread created:', newThreadId)

        // 대기 중인 메시지들 저장
        if (messageQueue.current.length > 0) {
          log('Processing queued messages:', messageQueue.current.length)
          for (const msg of messageQueue.current) {
            await saveMessageToDb(newThreadId, msg)
          }
          messageQueue.current = []
        }

        return newThreadId
      }

      return null
    } catch (err: any) {
      console.error('Thread creation error:', err)
      setError(err.message)
      return null
    } finally {
      isCreatingThread.current = false
      setIsLoading(false)
    }
  }, [appType, log])

  /**
   * DB에 메시지 저장 (내부 함수)
   */
  const saveMessageToDb = useCallback(async (
    targetThreadId: string,
    message: AIAppMessage
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/ai-threads/${targetThreadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: message.role,
          content: message.content,
          metadata: message.metadata,
          toolCalls: message.toolCalls,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save message')
      }

      log('Message saved:', message.role, message.content.slice(0, 50))
      return true
    } catch (err: any) {
      console.error('Message save error:', err)
      return false
    }
  }, [log])

  /**
   * 메시지 저장 (자동으로 스레드 생성)
   */
  const saveMessage = useCallback(async (message: AIAppMessage): Promise<boolean> => {
    setError(null)

    // 스레드가 없고 자동 생성이 활성화된 경우
    if (!threadId && autoCreateThread) {
      // 스레드 생성 중이면 큐에 추가
      if (isCreatingThread.current) {
        log('Queueing message while thread is being created')
        messageQueue.current.push(message)
        return true
      }

      // 첫 사용자 메시지로 제목 설정
      const title = message.role === 'user'
        ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
        : 'New Chat'

      const newThreadId = await createThread(title)
      if (!newThreadId) {
        setError('Failed to create thread')
        return false
      }

      return await saveMessageToDb(newThreadId, message)
    }

    // 스레드가 있으면 바로 저장
    if (threadId) {
      return await saveMessageToDb(threadId, message)
    }

    // 자동 생성이 비활성화되고 스레드도 없으면 실패
    log('No thread and autoCreateThread is disabled')
    return false
  }, [threadId, autoCreateThread, createThread, saveMessageToDb, log])

  /**
   * 여러 메시지 일괄 저장
   */
  const saveMessages = useCallback(async (messages: AIAppMessage[]): Promise<boolean> => {
    let success = true
    for (const message of messages) {
      const result = await saveMessage(message)
      if (!result) success = false
    }
    return success
  }, [saveMessage])

  /**
   * 스레드 제목 업데이트
   */
  const updateThreadTitle = useCallback(async (title: string): Promise<boolean> => {
    if (!threadId) {
      log('No thread to update title')
      return false
    }

    try {
      const response = await fetch(`/api/ai-threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })

      if (!response.ok) {
        throw new Error('Failed to update thread title')
      }

      log('Thread title updated:', title)
      return true
    } catch (err: any) {
      console.error('Title update error:', err)
      setError(err.message)
      return false
    }
  }, [threadId, log])

  /**
   * 스레드 메타데이터 업데이트
   */
  const updateThreadMetadata = useCallback(async (
    metadata: Record<string, any>
  ): Promise<boolean> => {
    if (!threadId) {
      log('No thread to update metadata')
      return false
    }

    try {
      const response = await fetch(`/api/ai-threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata }),
      })

      if (!response.ok) {
        throw new Error('Failed to update thread metadata')
      }

      log('Thread metadata updated')
      return true
    } catch (err: any) {
      console.error('Metadata update error:', err)
      setError(err.message)
      return false
    }
  }, [threadId, log])

  /**
   * 스레드 초기화
   */
  const resetThread = useCallback(() => {
    setThreadId(null)
    setError(null)
    messageQueue.current = []
    log('Thread reset')
  }, [log])

  return {
    threadId,
    isLoading,
    error,
    createThread,
    saveMessage,
    saveMessages,
    updateThreadTitle,
    updateThreadMetadata,
    setThreadId,
    resetThread,
  }
}
