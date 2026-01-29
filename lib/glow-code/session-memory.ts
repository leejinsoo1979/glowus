'use client'

// ============================================
// 세션 메모리 시스템 (Session Memory System)
// ============================================

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 세션 인터페이스
export interface ClaudeSession {
  id: string                    // Claude CLI 세션 ID
  threadId: string              // GlowCode 스레드 ID
  createdAt: number
  lastActiveAt: number
  model?: string
  summary?: string              // 대화 요약
  context?: {
    projectPath?: string
    mainFiles?: string[]        // 주로 작업한 파일들
    topics?: string[]           // 주요 토픽
  }
  stats?: {
    messageCount: number
    totalCost?: number          // 총 비용 (USD)
    totalDuration?: number      // 총 소요 시간 (ms)
    toolsUsed?: Record<string, number>  // 사용된 도구 카운트
  }
}

// 메모리 아이템 (대화에서 기억할 내용)
export interface MemoryItem {
  id: string
  sessionId: string
  type: 'fact' | 'preference' | 'context' | 'code' | 'decision'
  content: string
  importance: 'low' | 'medium' | 'high'
  createdAt: number
  expiresAt?: number            // 만료 시간 (undefined면 영구)
  tags?: string[]
}

// 메모리 시스템 상태
interface SessionMemoryState {
  // 현재 활성 세션 ID
  activeSessionId: string | null
  // 세션 목록 (최대 100개)
  sessions: ClaudeSession[]
  // 메모리 아이템 (최대 500개)
  memories: MemoryItem[]
  // 설정
  settings: {
    autoResume: boolean          // 자동으로 마지막 세션 이어가기
    maxSessions: number          // 최대 세션 수
    maxMemories: number          // 최대 메모리 아이템 수
    sessionTimeout: number       // 세션 타임아웃 (ms) - 기본 1시간
  }

  // Session Actions
  createSession: (data: Omit<ClaudeSession, 'createdAt' | 'lastActiveAt'>) => ClaudeSession
  updateSession: (id: string, updates: Partial<ClaudeSession>) => void
  deleteSession: (id: string) => void
  getSession: (id: string) => ClaudeSession | undefined
  getSessionByThreadId: (threadId: string) => ClaudeSession | undefined
  setActiveSession: (id: string | null) => void
  getActiveSession: () => ClaudeSession | null
  getRecentSessions: (limit?: number) => ClaudeSession[]

  // Memory Actions
  addMemory: (data: Omit<MemoryItem, 'id' | 'createdAt'>) => MemoryItem
  updateMemory: (id: string, updates: Partial<MemoryItem>) => void
  deleteMemory: (id: string) => void
  getMemoriesForSession: (sessionId: string) => MemoryItem[]
  searchMemories: (query: string) => MemoryItem[]
  pruneExpiredMemories: () => void

  // Settings Actions
  updateSettings: (settings: Partial<SessionMemoryState['settings']>) => void

  // Utilities
  canResumeSession: (session: ClaudeSession) => boolean
  generateSessionSummary: (sessionId: string) => string
}

// ID 생성
const generateId = () => `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

// 🔥 세션 메모리 스토어
export const useSessionMemory = create<SessionMemoryState>()(
  persist(
    (set, get) => ({
      activeSessionId: null,
      sessions: [],
      memories: [],
      settings: {
        autoResume: true,
        maxSessions: 100,
        maxMemories: 500,
        sessionTimeout: 60 * 60 * 1000, // 1시간
      },

      // Session Actions
      createSession: (data) => {
        const now = Date.now()
        const session: ClaudeSession = {
          ...data,
          createdAt: now,
          lastActiveAt: now,
          stats: {
            messageCount: 0,
            toolsUsed: {},
            ...data.stats
          }
        }

        set(state => {
          const sessions = [session, ...state.sessions]
          // 최대 개수 제한
          if (sessions.length > state.settings.maxSessions) {
            sessions.pop()
          }
          return {
            sessions,
            activeSessionId: session.id
          }
        })

        return session
      },

      updateSession: (id, updates) => {
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === id
              ? { ...s, ...updates, lastActiveAt: Date.now() }
              : s
          )
        }))
      },

      deleteSession: (id) => {
        set(state => ({
          sessions: state.sessions.filter(s => s.id !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
          memories: state.memories.filter(m => m.sessionId !== id)
        }))
      },

      getSession: (id) => {
        return get().sessions.find(s => s.id === id)
      },

      getSessionByThreadId: (threadId) => {
        return get().sessions.find(s => s.threadId === threadId)
      },

      setActiveSession: (id) => {
        set({ activeSessionId: id })
      },

      getActiveSession: () => {
        const { activeSessionId, sessions } = get()
        if (!activeSessionId) return null
        return sessions.find(s => s.id === activeSessionId) || null
      },

      getRecentSessions: (limit = 10) => {
        return get().sessions
          .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
          .slice(0, limit)
      },

      // Memory Actions
      addMemory: (data) => {
        const memory: MemoryItem = {
          ...data,
          id: generateId(),
          createdAt: Date.now()
        }

        set(state => {
          const memories = [memory, ...state.memories]
          // 최대 개수 제한
          if (memories.length > state.settings.maxMemories) {
            memories.pop()
          }
          return { memories }
        })

        return memory
      },

      updateMemory: (id, updates) => {
        set(state => ({
          memories: state.memories.map(m =>
            m.id === id ? { ...m, ...updates } : m
          )
        }))
      },

      deleteMemory: (id) => {
        set(state => ({
          memories: state.memories.filter(m => m.id !== id)
        }))
      },

      getMemoriesForSession: (sessionId) => {
        return get().memories.filter(m => m.sessionId === sessionId)
      },

      searchMemories: (query) => {
        const lowerQuery = query.toLowerCase()
        return get().memories.filter(m =>
          m.content.toLowerCase().includes(lowerQuery) ||
          m.tags?.some(t => t.toLowerCase().includes(lowerQuery))
        )
      },

      pruneExpiredMemories: () => {
        const now = Date.now()
        set(state => ({
          memories: state.memories.filter(m =>
            !m.expiresAt || m.expiresAt > now
          )
        }))
      },

      // Settings Actions
      updateSettings: (settings) => {
        set(state => ({
          settings: { ...state.settings, ...settings }
        }))
      },

      // Utilities
      canResumeSession: (session) => {
        const { settings } = get()
        const now = Date.now()
        const isRecent = (now - session.lastActiveAt) < settings.sessionTimeout
        return isRecent && !!session.id
      },

      generateSessionSummary: (sessionId) => {
        const session = get().getSession(sessionId)
        if (!session) return ''

        const memories = get().getMemoriesForSession(sessionId)
        const highPriorityMemories = memories
          .filter(m => m.importance === 'high')
          .slice(0, 5)

        let summary = `세션 ID: ${session.id}\n`
        summary += `생성: ${new Date(session.createdAt).toLocaleString()}\n`

        if (session.context?.projectPath) {
          summary += `프로젝트: ${session.context.projectPath}\n`
        }

        if (session.context?.topics?.length) {
          summary += `토픽: ${session.context.topics.join(', ')}\n`
        }

        if (session.stats?.messageCount) {
          summary += `메시지: ${session.stats.messageCount}개\n`
        }

        if (highPriorityMemories.length > 0) {
          summary += `\n중요 메모리:\n`
          highPriorityMemories.forEach(m => {
            summary += `- ${m.content}\n`
          })
        }

        return summary
      }
    }),
    {
      name: 'glow-code-session-memory',
      partialize: (state) => ({
        sessions: state.sessions.slice(0, 50), // 최근 50개만 저장
        memories: state.memories.slice(0, 200), // 최근 200개만 저장
        settings: state.settings,
        activeSessionId: state.activeSessionId
      })
    }
  )
)

// 🔥 세션 이어가기를 위한 유틸리티 훅
export function useSessionResume() {
  const {
    activeSessionId,
    getActiveSession,
    getSessionByThreadId,
    createSession,
    updateSession,
    canResumeSession,
    settings
  } = useSessionMemory()

  /**
   * 스레드에 대한 세션을 가져오거나 생성
   */
  const getOrCreateSession = (threadId: string, model?: string) => {
    let session = getSessionByThreadId(threadId)

    if (session && canResumeSession(session)) {
      return { session, isNew: false }
    }

    // 새 세션 생성 (Claude CLI에서 실제 세션 ID를 받을 때까지 임시 ID 사용)
    session = createSession({
      id: `pending_${threadId}`, // 나중에 실제 ID로 업데이트
      threadId,
      model
    })

    return { session, isNew: true }
  }

  /**
   * CLI에서 받은 실제 세션 ID로 업데이트
   */
  const confirmSession = (threadId: string, actualSessionId: string, model?: string) => {
    const session = getSessionByThreadId(threadId)
    if (session) {
      updateSession(session.id, {
        id: actualSessionId,
        model
      })
    }
  }

  /**
   * 세션 통계 업데이트
   */
  const updateSessionStats = (
    sessionId: string,
    stats: {
      cost?: number
      duration?: number
      toolUsed?: string
    }
  ) => {
    const session = useSessionMemory.getState().getSession(sessionId)
    if (!session) return

    const existingStats = session.stats || { messageCount: 0, toolsUsed: {} }
    const newStats: ClaudeSession['stats'] = {
      messageCount: existingStats.messageCount || 0,
      totalCost: existingStats.totalCost,
      totalDuration: existingStats.totalDuration,
      toolsUsed: { ...(existingStats.toolsUsed || {}) }
    }

    if (stats.cost) {
      newStats.totalCost = (newStats.totalCost || 0) + stats.cost
    }
    if (stats.duration) {
      newStats.totalDuration = (newStats.totalDuration || 0) + stats.duration
    }
    if (stats.toolUsed && newStats.toolsUsed) {
      newStats.toolsUsed[stats.toolUsed] = (newStats.toolsUsed[stats.toolUsed] || 0) + 1
    }
    newStats.messageCount = newStats.messageCount + 1

    updateSession(sessionId, { stats: newStats })
  }

  return {
    activeSessionId,
    getActiveSession,
    getOrCreateSession,
    confirmSession,
    updateSessionStats,
    canResumeSession,
    autoResume: settings.autoResume
  }
}

// 🔥 메모리 추출 유틸리티
export function extractMemoryFromMessage(
  sessionId: string,
  content: string,
  role: 'user' | 'assistant'
): MemoryItem[] {
  const memories: MemoryItem[] = []

  // 코드 블록 추출
  const codeMatches = content.matchAll(/```(\w+)?\n([\s\S]*?)```/g)
  for (const match of codeMatches) {
    const language = match[1] || 'code'
    const code = match[2].trim()

    if (code.length > 50 && code.length < 2000) {
      memories.push({
        id: generateId(),
        sessionId,
        type: 'code',
        content: `${language}: ${code.substring(0, 200)}...`,
        importance: 'medium',
        createdAt: Date.now(),
        tags: [language, 'code']
      })
    }
  }

  // 중요한 결정/사실 추출 (간단한 패턴 매칭)
  const decisionPatterns = [
    /(?:결정|선택|사용|적용)[:\s]+(.+)/gi,
    /(?:should|must|need to|will)\s+(.+)/gi,
    /(?:선택했|결정했|적용했)[:\s]*(.+)/gi
  ]

  for (const pattern of decisionPatterns) {
    const matches = content.matchAll(pattern)
    for (const match of matches) {
      if (match[1] && match[1].length > 20 && match[1].length < 200) {
        memories.push({
          id: generateId(),
          sessionId,
          type: 'decision',
          content: match[1].trim(),
          importance: 'high',
          createdAt: Date.now(),
          tags: ['decision']
        })
      }
    }
  }

  // 파일 경로 추출
  const filePatterns = /(?:파일|file)[:\s]+([\/\w\-\.]+\.[a-z]+)/gi
  const fileMatches = content.matchAll(filePatterns)
  for (const match of fileMatches) {
    memories.push({
      id: generateId(),
      sessionId,
      type: 'context',
      content: `파일 작업: ${match[1]}`,
      importance: 'low',
      createdAt: Date.now(),
      tags: ['file', match[1].split('.').pop() || '']
    })
  }

  return memories
}

export default useSessionMemory
