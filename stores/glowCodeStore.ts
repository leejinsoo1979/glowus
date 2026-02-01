'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'

// ============================================
// Types
// ============================================

export interface GlowCodeMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isStreaming?: boolean
  toolCalls?: Array<{
    name: string
    input: Record<string, unknown>
    output?: string
  }>
}

export interface GlowCodeThread {
  id: string
  title: string
  messages: GlowCodeMessage[]
  createdAt: number
  updatedAt: number
  /** DB에 저장된 스레드 ID (동기화용) */
  dbThreadId?: string
}

interface GlowCodeState {
  // UI State
  isOpen: boolean
  isPanelExpanded: boolean
  activeTab: 'chat' | 'files' | 'terminal' | 'diff'
  sidebarTab: 'threads' | 'files' | 'settings'

  // Chat State
  threads: GlowCodeThread[]
  activeThreadId: string | null
  streamContent: string
  // 🔥 스트리밍 중 이벤트 (thinking, tool, status 등)
  streamEvents: Array<{
    type: 'thinking' | 'tool' | 'tool_result' | 'status' | 'text'
    content?: string
    name?: string
    input?: any
    id?: string           // tool_use id
    toolUseId?: string    // tool_result가 참조하는 tool_use id
    isError?: boolean     // tool_result 에러 여부
  }>

  // Context
  context: {
    currentFile?: string
    selectedCode?: string
    projectPath?: string
    activeFile?: {
      name: string
      path: string
      content: string
    }
    mentionedFiles: string[]
  }

  // Settings
  settings: {
    /** Claude Code model selection */
    model: 'opus' | 'sonnet' | 'haiku' | 'custom'
    /** Custom model ID (when model === 'custom') */
    customModelId: string
    temperature: number
    maxTokens: number
    autoContext: boolean
    showToolCalls: boolean
    /** Max Plan 연결 완료 여부 (CLI 인증 사용) */
    isConnected: boolean
    /** Permission mode: default (ask), plan (review before), acceptEdits (auto) */
    permissionMode: 'default' | 'plan' | 'acceptEdits'
    /** Extended thinking mode */
    extendedThinking: boolean
    /** 🔥 프로젝트 컨텍스트 자동 포함 여부 */
    includeProjectContext: boolean
    /** 🔥 실행 모드: quick (직접 실행) | agent (PM 모드, 서브 에이전트 위임) */
    executionMode: 'quick' | 'agent'
  }

  // Actions
  setOpen: (open: boolean) => void
  togglePanel: () => void
  setActiveTab: (tab: 'chat' | 'files' | 'terminal' | 'diff') => void
  setSidebarTab: (tab: 'threads' | 'files' | 'settings') => void

  // Thread Actions
  createThread: (title?: string) => string
  deleteThread: (id: string) => void
  setActiveThread: (id: string | null) => void
  getActiveThread: () => GlowCodeThread | null
  getMessages: () => GlowCodeMessage[]

  // Message Actions
  addMessage: (message: Omit<GlowCodeMessage, 'id' | 'timestamp'>) => void
  updateMessage: (id: string, updates: Partial<GlowCodeMessage>) => void
  clearMessages: () => void

  // Stream Actions
  setStreamContent: (content: string) => void
  appendStreamContent: (content: string) => void
  clearStreamContent: () => void
  // 🔥 Stream Events Actions
  addStreamEvent: (event: GlowCodeState['streamEvents'][0]) => void
  clearStreamEvents: () => void

  // Context Actions
  setContext: (context: Partial<GlowCodeState['context']>) => void

  // Settings Actions
  updateSettings: (settings: Partial<GlowCodeState['settings']>) => void

  // Reset Actions
  resetThreads: () => void
}

// ============================================
// Store
// ============================================

export const useGlowCodeStore = create<GlowCodeState>()(
  persist(
    (set, get) => ({
      // Initial State
      isOpen: false,
      isPanelExpanded: true,
      activeTab: 'chat',
      sidebarTab: 'threads',

      threads: [],
      activeThreadId: null,
      streamContent: '',
      streamEvents: [],

      context: {
        mentionedFiles: [],
      },

      settings: {
        model: 'opus',
        customModelId: '',
        temperature: 0.7,
        maxTokens: 8192,
        autoContext: true,
        showToolCalls: true,
        isConnected: false,
        permissionMode: 'default',
        extendedThinking: false,
        includeProjectContext: true,  // 🔥 기본값: 프로젝트 컨텍스트 자동 포함
        executionMode: 'quick',  // 🔥 기본값: Quick Mode (직접 실행)
      },

      // UI Actions
      setOpen: (isOpen) => set({ isOpen }),
      togglePanel: () => set((state) => ({ isPanelExpanded: !state.isPanelExpanded })),
      setActiveTab: (activeTab) => set({ activeTab }),
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),

      // Thread Actions
      createThread: (title) => {
        const id = nanoid()
        const thread: GlowCodeThread = {
          id,
          title: title || `New Chat`,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((state) => ({
          threads: [thread, ...state.threads],
          activeThreadId: id,
        }))
        return id
      },

      deleteThread: (id) => {
        set((state) => {
          const threads = state.threads.filter((t) => t.id !== id)
          const activeThreadId = state.activeThreadId === id
            ? threads[0]?.id || null
            : state.activeThreadId
          return { threads, activeThreadId }
        })
      },

      setActiveThread: (id) => set({ activeThreadId: id }),

      getActiveThread: () => {
        const state = get()
        return state.threads.find((t) => t.id === state.activeThreadId) || null
      },

      getMessages: () => {
        const thread = get().getActiveThread()
        return thread?.messages || []
      },

      // Message Actions
      addMessage: (message) => {
        const state = get()
        let threadId = state.activeThreadId

        if (!threadId) {
          threadId = state.createThread()
        }

        const newMessage: GlowCodeMessage = {
          ...message,
          id: nanoid(),
          timestamp: Date.now(),
        }

        set((state) => ({
          threads: state.threads.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  messages: [...t.messages, newMessage],
                  updatedAt: Date.now(),
                  title: t.messages.length === 0 && message.role === 'user'
                    ? message.content.slice(0, 50)
                    : t.title,
                }
              : t
          ),
        }))
      },

      updateMessage: (id, updates) => {
        set((state) => ({
          threads: state.threads.map((t) => ({
            ...t,
            messages: t.messages.map((m) =>
              m.id === id ? { ...m, ...updates } : m
            ),
          })),
        }))
      },

      clearMessages: () => {
        const state = get()
        if (!state.activeThreadId) return

        set((state) => ({
          threads: state.threads.map((t) =>
            t.id === state.activeThreadId
              ? { ...t, messages: [], updatedAt: Date.now() }
              : t
          ),
        }))
      },

      // Stream Actions
      setStreamContent: (content) => set({ streamContent: content }),
      appendStreamContent: (content) => set((state) => ({
        streamContent: state.streamContent + content,
      })),
      clearStreamContent: () => set({ streamContent: '' }),
      // 🔥 Stream Events Actions
      addStreamEvent: (event) => set((state) => ({
        streamEvents: [...state.streamEvents, event],
      })),
      clearStreamEvents: () => set({ streamEvents: [] }),

      // Context Actions
      setContext: (context) => set((state) => ({
        context: { ...state.context, ...context },
      })),

      // Settings Actions
      updateSettings: (settings) => set((state) => ({
        settings: { ...state.settings, ...settings },
      })),

      // Reset threads (for cleanup)
      resetThreads: () => set({ threads: [], activeThreadId: null }),
    }),
    {
      name: 'glow-code-storage',
      partialize: (state) => ({
        threads: state.threads.slice(0, 50), // Keep last 50 threads
        activeThreadId: state.activeThreadId, // 🔥 마지막 활성 스레드 저장
        settings: state.settings,
        // 🔥 작업 디렉토리 경로도 저장
        context: {
          projectPath: state.context.projectPath,
        },
      }),
    }
  )
)
