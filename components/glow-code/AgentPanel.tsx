'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Bot,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Zap,
  Code2,
  Database,
  Shield,
  TestTube,
  Palette,
  Settings,
  Brain,
  FileCode,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { create } from 'zustand'

// ============================================
// Agent Store (에이전트 상태 관리)
// ============================================

export interface ActiveAgent {
  id: string
  name: string
  role: string
  status: 'idle' | 'working' | 'complete' | 'error'
  task: string
  progress: number
  logs: string[]
  startTime: number
  endTime?: number
}

interface AgentPanelState {
  agents: ActiveAgent[]
  isExpanded: boolean
  addAgent: (agent: Omit<ActiveAgent, 'logs' | 'startTime' | 'progress'>) => void
  updateAgent: (id: string, updates: Partial<ActiveAgent>) => void
  removeAgent: (id: string) => void
  addLog: (id: string, log: string) => void
  clearAgents: () => void
  setExpanded: (expanded: boolean) => void
}

export const useAgentPanelStore = create<AgentPanelState>((set) => ({
  agents: [],
  isExpanded: true,

  addAgent: (agent) => set((state) => ({
    agents: [...state.agents, {
      ...agent,
      logs: [],
      startTime: Date.now(),
      progress: 0,
    }]
  })),

  updateAgent: (id, updates) => set((state) => ({
    agents: state.agents.map((a) =>
      a.id === id ? { ...a, ...updates } : a
    )
  })),

  removeAgent: (id) => set((state) => ({
    agents: state.agents.filter((a) => a.id !== id)
  })),

  addLog: (id, log) => set((state) => ({
    agents: state.agents.map((a) =>
      a.id === id ? { ...a, logs: [...a.logs, log] } : a
    )
  })),

  clearAgents: () => set({ agents: [] }),

  setExpanded: (isExpanded) => set({ isExpanded }),
}))

// ============================================
// Role Icons
// ============================================

const ROLE_ICONS: Record<string, React.ReactNode> = {
  planner: <Brain className="w-4 h-4" />,
  frontend: <Palette className="w-4 h-4" />,
  backend: <Database className="w-4 h-4" />,
  tester: <TestTube className="w-4 h-4" />,
  reviewer: <FileCode className="w-4 h-4" />,
  security: <Shield className="w-4 h-4" />,
  devops: <Settings className="w-4 h-4" />,
  default: <Bot className="w-4 h-4" />,
}

const ROLE_COLORS: Record<string, string> = {
  planner: 'text-purple-400 bg-purple-500/20',
  frontend: 'text-blue-400 bg-blue-500/20',
  backend: 'text-green-400 bg-green-500/20',
  tester: 'text-yellow-400 bg-yellow-500/20',
  reviewer: 'text-orange-400 bg-orange-500/20',
  security: 'text-red-400 bg-red-500/20',
  devops: 'text-cyan-400 bg-cyan-500/20',
  default: 'text-zinc-400 bg-zinc-500/20',
}

const STATUS_CONFIG = {
  idle: { color: 'text-zinc-400', bg: 'bg-zinc-500/20', label: '대기 중' },
  working: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: '작업 중' },
  complete: { color: 'text-green-400', bg: 'bg-green-500/20', label: '완료' },
  error: { color: 'text-red-400', bg: 'bg-red-500/20', label: '오류' },
}

// ============================================
// Agent Card Component
// ============================================

function AgentCard({ agent }: { agent: ActiveAgent }) {
  const [isLogsOpen, setIsLogsOpen] = useState(false)
  const roleColor = ROLE_COLORS[agent.role] || ROLE_COLORS.default
  const roleIcon = ROLE_ICONS[agent.role] || ROLE_ICONS.default
  const statusConfig = STATUS_CONFIG[agent.status]

  const elapsedTime = agent.endTime
    ? Math.floor((agent.endTime - agent.startTime) / 1000)
    : Math.floor((Date.now() - agent.startTime) / 1000)

  // 실시간 경과 시간 업데이트
  const [, setTick] = useState(0)
  useEffect(() => {
    if (agent.status === 'working') {
      const interval = setInterval(() => setTick(t => t + 1), 1000)
      return () => clearInterval(interval)
    }
  }, [agent.status])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "rounded-lg border overflow-hidden transition-all",
        agent.status === 'working'
          ? "border-blue-500/50 bg-blue-500/5"
          : agent.status === 'complete'
            ? "border-green-500/30 bg-green-500/5"
            : agent.status === 'error'
              ? "border-red-500/30 bg-red-500/5"
              : "border-zinc-700 bg-zinc-800/50"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        {/* Role Icon */}
        <div className={cn("p-2 rounded-lg", roleColor)}>
          {roleIcon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-white truncate">
              {agent.name}
            </span>
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded",
              statusConfig.bg, statusConfig.color
            )}>
              {agent.status === 'working' && (
                <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />
              )}
              {agent.status === 'complete' && (
                <CheckCircle2 className="w-3 h-3 inline mr-1" />
              )}
              {agent.status === 'error' && (
                <XCircle className="w-3 h-3 inline mr-1" />
              )}
              {statusConfig.label}
            </span>
          </div>
          <p className="text-xs text-zinc-400 truncate mt-0.5">
            {agent.task}
          </p>
        </div>

        {/* Time */}
        <div className="text-xs text-zinc-500 tabular-nums">
          {elapsedTime}s
        </div>
      </div>

      {/* Progress Bar */}
      {agent.status === 'working' && (
        <div className="h-1 bg-zinc-700">
          <motion.div
            className="h-full bg-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${agent.progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      {/* Logs (Collapsible) */}
      {agent.logs.length > 0 && (
        <>
          <button
            onClick={() => setIsLogsOpen(!isLogsOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-700/30 transition-colors border-t border-zinc-700/50"
          >
            {isLogsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            로그 ({agent.logs.length})
          </button>
          <AnimatePresence>
            {isLogsOpen && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 max-h-32 overflow-y-auto space-y-1">
                  {agent.logs.map((log, i) => (
                    <div key={i} className="text-xs text-zinc-500 font-mono">
                      {log}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  )
}

// ============================================
// Main Agent Panel
// ============================================

export function AgentPanel() {
  const { agents, isExpanded, setExpanded, clearAgents } = useAgentPanelStore()

  const workingCount = agents.filter(a => a.status === 'working').length
  const completeCount = agents.filter(a => a.status === 'complete').length

  // 에이전트가 없으면 표시하지 않음
  if (agents.length === 0) {
    return null
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-900">
      {/* Panel Header */}
      <button
        onClick={() => setExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-white">
            Agent Team
          </span>
          <span className="text-xs text-zinc-500">
            ({agents.length}명)
          </span>
          {workingCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" />
              {workingCount} 작업 중
            </span>
          )}
          {completeCount > 0 && workingCount === 0 && (
            <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              모두 완료
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {agents.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                clearAgents()
              }}
              className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1"
            >
              초기화
            </button>
          )}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </button>

      {/* Agent Cards */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 grid gap-2 max-h-64 overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {agents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================
// Demo/Test 함수 (개발용)
// ============================================

export function simulateAgentWork() {
  const store = useAgentPanelStore.getState()

  // 에이전트 추가
  store.addAgent({
    id: 'frontend-1',
    name: 'Frontend Developer',
    role: 'frontend',
    status: 'working',
    task: 'LoginForm 컴포넌트 개발',
  })

  store.addAgent({
    id: 'backend-1',
    name: 'Backend Developer',
    role: 'backend',
    status: 'working',
    task: 'Auth API 엔드포인트 개발',
  })

  store.addAgent({
    id: 'tester-1',
    name: 'QA Tester',
    role: 'tester',
    status: 'idle',
    task: '테스트 케이스 대기 중',
  })

  // 진행률 시뮬레이션
  let progress1 = 0
  let progress2 = 0

  const interval1 = setInterval(() => {
    progress1 += Math.random() * 15
    if (progress1 >= 100) {
      store.updateAgent('frontend-1', { status: 'complete', progress: 100, endTime: Date.now() })
      store.addLog('frontend-1', '✅ LoginForm.tsx 생성 완료')
      store.addLog('frontend-1', '✅ Tailwind 스타일링 적용')
      clearInterval(interval1)

      // Tester 시작
      store.updateAgent('tester-1', { status: 'working' })
    } else {
      store.updateAgent('frontend-1', { progress: Math.min(progress1, 95) })
      if (progress1 > 30 && progress1 < 35) {
        store.addLog('frontend-1', '📁 components/auth/LoginForm.tsx 생성')
      }
      if (progress1 > 60 && progress1 < 65) {
        store.addLog('frontend-1', '🎨 Tailwind CSS 스타일 적용 중')
      }
    }
  }, 500)

  const interval2 = setInterval(() => {
    progress2 += Math.random() * 12
    if (progress2 >= 100) {
      store.updateAgent('backend-1', { status: 'complete', progress: 100, endTime: Date.now() })
      store.addLog('backend-1', '✅ /api/auth/login 엔드포인트 완료')
      store.addLog('backend-1', '✅ Supabase 연동 완료')
      clearInterval(interval2)
    } else {
      store.updateAgent('backend-1', { progress: Math.min(progress2, 95) })
      if (progress2 > 25 && progress2 < 30) {
        store.addLog('backend-1', '📁 app/api/auth/login/route.ts 생성')
      }
      if (progress2 > 50 && progress2 < 55) {
        store.addLog('backend-1', '🔐 Supabase Auth 연동 중')
      }
    }
  }, 600)
}
