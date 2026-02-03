'use client'

import { useCallback } from 'react'
import { useGlowCodeStore } from '@/stores/glowCodeStore'

/**
 * AI Thread DB 동기화 훅
 * - glowCodeStore의 dbThreadId를 사용하여 영구적인 매핑 유지
 * - 메시지 추가 시 DB 동기화
 */
export function useAIThreadSync() {
  const { threads } = useGlowCodeStore()
  const updateThread = useGlowCodeStore.getState

  // DB에 스레드 생성
  const createDbThread = useCallback(async (title: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/ai-threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || 'New Chat',
          threadType: 'glow_code'
        })
      })

      if (!res.ok) {
        console.error('Failed to create thread in DB')
        return null
      }

      const { thread } = await res.json()
      return thread?.id || null
    } catch (err) {
      console.error('Thread sync error:', err)
      return null
    }
  }, [])

  // 로컬 스레드에 dbThreadId 저장
  const setDbThreadIdForLocal = useCallback((localThreadId: string, dbThreadId: string) => {
    const store = useGlowCodeStore.getState()
    const thread = store.threads.find(t => t.id === localThreadId)
    if (thread && !thread.dbThreadId) {
      // threads 배열 업데이트
      useGlowCodeStore.setState({
        threads: store.threads.map(t =>
          t.id === localThreadId
            ? { ...t, dbThreadId }
            : t
        )
      })
    }
  }, [])

  // 로컬 스레드에서 dbThreadId 가져오기
  const getDbThreadId = useCallback((localThreadId: string): string | undefined => {
    const store = useGlowCodeStore.getState()
    const thread = store.threads.find(t => t.id === localThreadId)
    return thread?.dbThreadId
  }, [])

  // 메시지 추가 및 DB 동기화
  const addMessageWithSync = useCallback(async (
    localThreadId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    toolCalls?: any[]
  ) => {
    // 1. 로컬 스레드에서 dbThreadId 확인
    let dbThreadId = getDbThreadId(localThreadId)

    // 2. dbThreadId가 없으면 DB에 스레드 생성
    if (!dbThreadId) {
      const store = useGlowCodeStore.getState()
      const thread = store.threads.find(t => t.id === localThreadId)
      const title = thread?.title || 'New Chat'

      dbThreadId = await createDbThread(title) || undefined

      if (dbThreadId) {
        // 로컬 스레드에 dbThreadId 저장 (persist됨)
        setDbThreadIdForLocal(localThreadId, dbThreadId)
        console.log('[AIThreadSync] Created DB thread:', dbThreadId, 'for local:', localThreadId)
      }
    }

    if (!dbThreadId) {
      console.log('[AIThreadSync] No DB thread ID, skipping sync')
      return
    }

    // 3. DB에 메시지 추가
    try {
      await fetch(`/api/ai-threads/${dbThreadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          content,
          toolCalls,
        })
      })
      console.log('[AIThreadSync] Message synced to DB thread:', dbThreadId)
    } catch (err) {
      console.error('Message sync error:', err)
    }
  }, [createDbThread, getDbThreadId, setDbThreadIdForLocal])

  // 스레드 삭제 및 DB 동기화
  const deleteThreadWithSync = useCallback(async (localThreadId: string) => {
    const dbThreadId = getDbThreadId(localThreadId)

    if (dbThreadId) {
      try {
        await fetch(`/api/ai-threads/${dbThreadId}`, { method: 'DELETE' })
        console.log('[AIThreadSync] Deleted DB thread:', dbThreadId)
      } catch (err) {
        console.error('Thread delete sync error:', err)
      }
    }
  }, [getDbThreadId])

  // 스레드 제목 업데이트
  const updateThreadTitleWithSync = useCallback(async (localThreadId: string, title: string) => {
    const dbThreadId = getDbThreadId(localThreadId)

    if (dbThreadId) {
      try {
        await fetch(`/api/ai-threads/${dbThreadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title })
        })
      } catch (err) {
        console.error('Thread title update error:', err)
      }
    }
  }, [getDbThreadId])

  // 스레드 생성과 DB 동기화를 동시에
  const createThreadWithSync = useCallback(async (title?: string): Promise<string | null> => {
    return createDbThread(title || 'New Chat')
  }, [createDbThread])

  return {
    createThreadWithSync,
    addMessageWithSync,
    deleteThreadWithSync,
    updateThreadTitleWithSync,
    getDbThreadId,
    setDbThreadIdForLocal,
  }
}
