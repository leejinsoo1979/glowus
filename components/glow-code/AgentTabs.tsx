'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Bot,
  Brain,
  Palette,
  Database,
  TestTube,
  FileCode,
  Shield,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Zap,
  Users,
  Terminal,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { create } from 'zustand'
import ReactMarkdown from 'react-markdown'

// ============================================
// Types
// ============================================

export interface AgentMessage {
  id: string
  type: 'text' | 'tool' | 'tool_result' | 'status' | 'thinking'
  content: string
  toolName?: string
  toolInput?: any
  timestamp: number
}

export interface AgentTab {
  id: string
  name: string
  role: string
  task: string
  status: 'idle' | 'working' | 'complete' | 'error'
  progress: number
  messages: AgentMessage[]
  startTime: number
  endTime?: number
  isMain?: boolean  // PM 탭
}

// ============================================
// Store
// ============================================

export interface AgentTabsState {
  tabs: AgentTab[]
  activeTabId: string | null
  isExpanded: boolean  // 🔥 패널 접기/펼치기
  panelWidth: number   // 🔥 패널 너비 (px)

  // Actions
  addTab: (tab: Omit<AgentTab, 'messages' | 'startTime' | 'progress'>) => void
  removeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTab: (id: string, updates: Partial<AgentTab>) => void
  addMessage: (tabId: string, message: Omit<AgentMessage, 'id' | 'timestamp'>) => void
  clearTabs: () => void
  setExpanded: (expanded: boolean) => void
  toggleExpanded: () => void
  setPanelWidth: (width: number) => void
}

// 🔥 외부에서 사용할 수 있는 Store 타입
export type AgentTabsStore = AgentTabsState

export const useAgentTabsStore = create<AgentTabsState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  isExpanded: true,
  panelWidth: 400,  // 🔥 기본 너비

  addTab: (tab) => set((state) => ({
    tabs: [...state.tabs, {
      ...tab,
      messages: [],
      startTime: Date.now(),
      progress: 0,
    }],
    activeTabId: state.activeTabId || tab.id,
  })),

  removeTab: (id) => set((state) => {
    const newTabs = state.tabs.filter(t => t.id !== id)
    return {
      tabs: newTabs,
      activeTabId: state.activeTabId === id
        ? newTabs[0]?.id || null
        : state.activeTabId
    }
  }),

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (id, updates) => set((state) => ({
    tabs: state.tabs.map(t => t.id === id ? { ...t, ...updates } : t)
  })),

  addMessage: (tabId, message) => set((state) => ({
    tabs: state.tabs.map(t => t.id === tabId ? {
      ...t,
      messages: [...t.messages, {
        ...message,
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      }]
    } : t)
  })),

  clearTabs: () => set({ tabs: [], activeTabId: null }),

  setExpanded: (isExpanded) => set({ isExpanded }),
  toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),
  setPanelWidth: (panelWidth) => set({ panelWidth: Math.max(280, Math.min(800, panelWidth)) }),  // 🔥 280-800px 범위
}))

// ============================================
// Role Icons & Colors
// ============================================

const ROLE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  pm: { icon: <Users className="w-3.5 h-3.5" />, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  planner: { icon: <Brain className="w-3.5 h-3.5" />, color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
  frontend: { icon: <Palette className="w-3.5 h-3.5" />, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  backend: { icon: <Database className="w-3.5 h-3.5" />, color: 'text-green-400', bg: 'bg-green-500/20' },
  tester: { icon: <TestTube className="w-3.5 h-3.5" />, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  reviewer: { icon: <FileCode className="w-3.5 h-3.5" />, color: 'text-orange-400', bg: 'bg-orange-500/20' },
  security: { icon: <Shield className="w-3.5 h-3.5" />, color: 'text-red-400', bg: 'bg-red-500/20' },
  devops: { icon: <Settings className="w-3.5 h-3.5" />, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  default: { icon: <Bot className="w-3.5 h-3.5" />, color: 'text-zinc-400', bg: 'bg-zinc-500/20' },
}

const STATUS_INDICATOR = {
  idle: 'bg-zinc-500',
  working: 'bg-blue-500 animate-pulse',
  complete: 'bg-green-500',
  error: 'bg-red-500',
}

// ============================================
// Tab Button Component
// ============================================

function AgentTabButton({
  tab,
  isActive,
  onClick,
  onClose
}: {
  tab: AgentTab
  isActive: boolean
  onClick: () => void
  onClose?: () => void
}) {
  const config = ROLE_CONFIG[tab.role] || ROLE_CONFIG.default

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm border-b-2 transition-all whitespace-nowrap",
        isActive
          ? "border-blue-500 bg-zinc-800/50 text-white"
          : "border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800/30"
      )}
    >
      {/* Status Indicator */}
      <span className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_INDICATOR[tab.status])} />

      {/* Icon */}
      <span className={cn("flex-shrink-0", config.color)}>{config.icon}</span>

      {/* Name */}
      <span className="max-w-[80px] truncate">{tab.name}</span>

      {/* Progress (if working) */}
      {tab.status === 'working' && (
        <span className="text-xs text-blue-400">{tab.progress}%</span>
      )}

      {/* Close button */}
      {onClose && (
        <span
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="ml-1 p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white"
        >
          <X className="w-3 h-3" />
        </span>
      )}
    </button>
  )
}

// ============================================
// Message Component
// ============================================

function AgentMessageItem({ message }: { message: AgentMessage }) {
  if (message.type === 'tool') {
    return (
      <div className="flex items-start gap-2 text-sm py-2 px-3 bg-zinc-800/30 rounded-lg my-1">
        <Terminal className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-purple-400">{message.toolName}</span>
            <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
          </div>
          {message.toolInput && (
            <code className="text-xs text-zinc-500 block mt-1 truncate">
              {JSON.stringify(message.toolInput).substring(0, 100)}
            </code>
          )}
        </div>
      </div>
    )
  }

  if (message.type === 'tool_result') {
    return (
      <div className="flex items-start gap-2 text-sm py-2 px-3 bg-green-500/5 border-l-2 border-green-500 rounded-r-lg my-1">
        <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-green-400 text-xs">완료</span>
          <p className="text-zinc-400 text-xs mt-1 line-clamp-3">{message.content}</p>
        </div>
      </div>
    )
  }

  if (message.type === 'thinking') {
    return (
      <div className="flex items-center gap-2 text-sm py-2 px-3 text-zinc-500 italic my-1">
        <Brain className="w-4 h-4 animate-pulse" />
        <span>생각 중...</span>
      </div>
    )
  }

  if (message.type === 'status') {
    return (
      <div className="text-xs text-zinc-500 py-1 px-3 my-1">
        {message.content}
      </div>
    )
  }

  // text
  return (
    <div className="py-2 px-3 my-1">
      <div className="prose prose-sm prose-invert max-w-none text-sm">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
    </div>
  )
}

// ============================================
// Tab Content Component
// ============================================

function AgentTabContent({ tab }: { tab: AgentTab }) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const config = ROLE_CONFIG[tab.role] || ROLE_CONFIG.default

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [tab.messages])

  // 경과 시간
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (tab.status === 'working') {
      const interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - tab.startTime) / 1000))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [tab.status, tab.startTime])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn("px-3 py-2 border-b border-zinc-800", config.bg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={config.color}>{config.icon}</span>
            <span className="font-medium text-white text-sm">{tab.name}</span>
            {tab.status === 'working' && (
              <span className="text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {elapsed}s
              </span>
            )}
            {tab.status === 'complete' && (
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            )}
            {tab.status === 'error' && (
              <XCircle className="w-4 h-4 text-red-400" />
            )}
          </div>
          {tab.status === 'working' && (
            <span className="text-xs text-zinc-500">{tab.progress}%</span>
          )}
        </div>
        <p className="text-xs text-zinc-400 mt-1 truncate">{tab.task}</p>

        {/* Progress bar */}
        {tab.status === 'working' && (
          <div className="h-1 bg-zinc-700 rounded-full mt-2 overflow-hidden">
            <motion.div
              className="h-full bg-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${tab.progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {tab.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-sm">
            <Bot className="w-8 h-8 mb-2 opacity-50" />
            {tab.status === 'idle' && <p>대기 중...</p>}
            {tab.status === 'working' && <p>작업 시작 중...</p>}
          </div>
        ) : (
          <div className="py-2">
            {tab.messages.map((msg) => (
              <AgentMessageItem key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Main Agent Tabs Component (접기/펼치기 지원)
// ============================================

export function AgentTabs() {
  const { tabs, activeTabId, isExpanded, panelWidth, setActiveTab, removeTab, toggleExpanded, clearTabs, setPanelWidth } = useAgentTabsStore()

  const activeTab = tabs.find(t => t.id === activeTabId)
  const workingCount = tabs.filter(t => t.status === 'working').length
  const completeCount = tabs.filter(t => t.status === 'complete').length

  // 🔥 리사이즈 핸들러
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true
    startX.current = e.clientX
    startWidth.current = panelWidth
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return
    const delta = startX.current - e.clientX  // 🔥 왼쪽으로 드래그하면 늘어남
    const newWidth = startWidth.current + delta
    setPanelWidth(newWidth)
  }

  const handleMouseUp = () => {
    isResizing.current = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  // 에이전트가 없으면 표시하지 않음
  if (tabs.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        "flex flex-col border-l border-zinc-800 bg-zinc-900 transition-all relative",
        !isExpanded && "w-12"
      )}
      style={{ width: isExpanded ? panelWidth : undefined }}
    >
      {/* 🔥 리사이즈 핸들 (왼쪽 가장자리) */}
      {isExpanded && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-10"
        />
      )}
      {/* 접힌 상태 - 세로 바 */}
      {!isExpanded && (
        <div className="flex flex-col h-full">
          <button
            onClick={toggleExpanded}
            className="p-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800"
            title="에이전트 패널 펼치기"
          >
            <PanelRightOpen className="w-5 h-5 text-zinc-400" />
          </button>

          {/* 세로 에이전트 아이콘 목록 */}
          <div className="flex-1 overflow-y-auto py-2">
            {tabs.map((tab) => {
              const config = ROLE_CONFIG[tab.role] || ROLE_CONFIG.default
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    toggleExpanded()
                  }}
                  className={cn(
                    "w-full p-3 flex flex-col items-center gap-1 hover:bg-zinc-800 transition-colors",
                    tab.id === activeTabId && "bg-zinc-800"
                  )}
                  title={`${tab.name}: ${tab.task}`}
                >
                  <span className={cn("w-2 h-2 rounded-full", STATUS_INDICATOR[tab.status])} />
                  <span className={config.color}>{config.icon}</span>
                </button>
              )
            })}
          </div>

          {/* 작업 중 카운트 */}
          {workingCount > 0 && (
            <div className="p-2 border-t border-zinc-800 text-center">
              <span className="text-xs text-blue-400">{workingCount}</span>
            </div>
          )}
        </div>
      )}

      {/* 펼친 상태 */}
      {isExpanded && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-white">Agent Team</span>
              {workingCount > 0 && (
                <span className="text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {workingCount}
                </span>
              )}
              {completeCount > 0 && workingCount === 0 && (
                <span className="text-xs text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
                  완료
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => clearTabs()}
                className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                title="모두 닫기"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={toggleExpanded}
                className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                title="패널 접기"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex items-center border-b border-zinc-800 overflow-x-auto">
            {tabs.map((tab) => (
              <AgentTabButton
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onClick={() => setActiveTab(tab.id)}
                onClose={() => removeTab(tab.id)}
              />
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab && <AgentTabContent tab={activeTab} />}
          </div>
        </>
      )}
    </div>
  )
}

// ============================================
// 데모/테스트 함수
// ============================================

export function simulateAgentWork() {
  const store = useAgentTabsStore.getState()

  // 기존 에이전트 초기화
  store.clearTabs()

  // 에이전트 추가
  store.addTab({
    id: 'frontend-1',
    name: 'Frontend',
    role: 'frontend',
    task: 'LoginForm 컴포넌트 개발',
    status: 'working',
  })

  store.addTab({
    id: 'backend-1',
    name: 'Backend',
    role: 'backend',
    task: 'Auth API 엔드포인트 개발',
    status: 'working',
  })

  store.addTab({
    id: 'tester-1',
    name: 'Tester',
    role: 'tester',
    task: '테스트 케이스 작성 대기',
    status: 'idle',
  })

  // 진행률 시뮬레이션
  let progress1 = 0
  let progress2 = 0

  const interval1 = setInterval(() => {
    progress1 += Math.random() * 10
    if (progress1 >= 100) {
      store.updateTab('frontend-1', { status: 'complete', progress: 100, endTime: Date.now() })
      store.addMessage('frontend-1', { type: 'text', content: '✅ LoginForm.tsx 생성 완료' })
      store.addMessage('frontend-1', { type: 'text', content: '✅ Tailwind 스타일링 적용' })
      clearInterval(interval1)

      // Tester 시작
      store.updateTab('tester-1', { status: 'working' })
      store.addMessage('tester-1', { type: 'status', content: '테스트 시작...' })
    } else {
      store.updateTab('frontend-1', { progress: Math.min(Math.floor(progress1), 95) })
      if (progress1 > 20 && progress1 < 25) {
        store.addMessage('frontend-1', { type: 'text', content: '📁 components/auth/LoginForm.tsx 생성' })
      }
      if (progress1 > 50 && progress1 < 55) {
        store.addMessage('frontend-1', { type: 'text', content: '🎨 Tailwind CSS 적용 중...' })
      }
    }
  }, 400)

  const interval2 = setInterval(() => {
    progress2 += Math.random() * 8
    if (progress2 >= 100) {
      store.updateTab('backend-1', { status: 'complete', progress: 100, endTime: Date.now() })
      store.addMessage('backend-1', { type: 'text', content: '✅ /api/auth/login 완료' })
      store.addMessage('backend-1', { type: 'text', content: '✅ Supabase 연동 완료' })
      clearInterval(interval2)
    } else {
      store.updateTab('backend-1', { progress: Math.min(Math.floor(progress2), 95) })
      if (progress2 > 15 && progress2 < 20) {
        store.addMessage('backend-1', { type: 'text', content: '📁 app/api/auth/login/route.ts 생성' })
      }
      if (progress2 > 40 && progress2 < 45) {
        store.addMessage('backend-1', { type: 'text', content: '🔐 Supabase Auth 연동 중...' })
      }
    }
  }, 500)
}
