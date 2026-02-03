'use client'

/**
 * DynamicAgentPanel - Claude Code CLI 리더 + 동적 서브 에이전트 시스템
 *
 * 새로운 아키텍처:
 * - Claude Code CLI가 유일한 리더/PM
 * - 사용자 요청 시 모드 선택: Quick Mode (직렬) vs Agent Mode (팀 오케스트레이션)
 * - Agent Mode에서 리더가 프로젝트 분석 후 필요한 서브 에이전트를 동적으로 생성
 * - 서브 에이전트는 리더의 Task 도구를 통해 스폰됨
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Terminal,
  Loader2,
  Bot,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ArrowUp,
  Send,
  Zap,
  Users,
  Play,
  X,
  Plus,
  Clock,
  FileCode,
  Layers,
} from 'lucide-react'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { ClaudeCodeUI } from '@/components/glow-code/GlowCodeChat'
import { useGlowCodeStore } from '@/stores/glowCodeStore'

// 동적으로 생성되는 서브 에이전트 타입
export interface DynamicSubAgent {
  id: string
  name: string
  role: string // e.g., "PaymentExpert", "UIDesigner", "SecurityAuditor"
  status: 'idle' | 'working' | 'complete' | 'error'
  progress?: number
  currentTask?: string
  createdAt: number
  completedAt?: number
}

// 실행 모드
type ExecutionMode = 'quick' | 'agent'

interface DynamicAgentPanelProps {
  isDark: boolean
}

export function DynamicAgentPanel({ isDark }: DynamicAgentPanelProps) {
  const projectPath = useNeuralMapStore((s) => s.projectPath)
  const currentTheme = useNeuralMapStore((s) => s.currentTheme)
  const accentColor = currentTheme?.ui?.accentColor || '#3b82f6'

  // 실행 모드 상태
  const [mode, setMode] = useState<ExecutionMode>('quick')
  const [showModeSelector, setShowModeSelector] = useState(false)

  // 동적 서브 에이전트 목록
  const [subAgents, setSubAgents] = useState<DynamicSubAgent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  // GlowCode 스토어에서 연결 상태 감시
  const isConnected = useGlowCodeStore((s) => s.settings.isConnected)

  // 서브 에이전트 추가 (리더가 Task 도구로 스폰할 때 호출)
  const addSubAgent = useCallback((agent: Omit<DynamicSubAgent, 'id' | 'createdAt'>) => {
    const newAgent: DynamicSubAgent = {
      ...agent,
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
    }
    setSubAgents(prev => [...prev, newAgent])
    return newAgent.id
  }, [])

  // 서브 에이전트 상태 업데이트
  const updateSubAgent = useCallback((id: string, updates: Partial<DynamicSubAgent>) => {
    setSubAgents(prev => prev.map(agent =>
      agent.id === id ? { ...agent, ...updates } : agent
    ))
  }, [])

  // 서브 에이전트 제거
  const removeSubAgent = useCallback((id: string) => {
    setSubAgents(prev => prev.filter(agent => agent.id !== id))
    if (selectedAgentId === id) {
      setSelectedAgentId(null)
    }
  }, [selectedAgentId])

  // 전역 이벤트 리스너 (Claude Code CLI에서 서브 에이전트 생성 이벤트 수신)
  useEffect(() => {
    const handleAgentSpawn = (event: CustomEvent<{ name: string; role: string; task: string }>) => {
      const { name, role, task } = event.detail
      addSubAgent({
        name,
        role,
        status: 'working',
        currentTask: task,
      })
    }

    const handleAgentUpdate = (event: CustomEvent<{ id: string; status: DynamicSubAgent['status']; progress?: number }>) => {
      const { id, status, progress } = event.detail
      updateSubAgent(id, {
        status,
        progress,
        ...(status === 'complete' ? { completedAt: Date.now() } : {})
      })
    }

    window.addEventListener('agent:spawn', handleAgentSpawn as EventListener)
    window.addEventListener('agent:update', handleAgentUpdate as EventListener)

    return () => {
      window.removeEventListener('agent:spawn', handleAgentSpawn as EventListener)
      window.removeEventListener('agent:update', handleAgentUpdate as EventListener)
    }
  }, [addSubAgent, updateSubAgent])

  // 프로젝트 없으면 안내
  if (!projectPath) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        <div className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center mb-5',
          isDark ? 'bg-zinc-800/50' : 'bg-zinc-100'
        )}>
          <Layers className={cn('w-8 h-8', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
        </div>
        <h3 className={cn('text-lg font-medium mb-2', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
          프로젝트를 먼저 열어주세요
        </h3>
        <p className={cn('text-sm max-w-[260px] mb-4', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
          코딩 에이전트는 프로젝트 폴더 내에서 작동합니다.
        </p>
        <div className={cn('text-xs', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
          좌측 파일 트리에서 폴더를 선택하세요
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* 🔥 모드 선택 헤더 */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 border-b',
        isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50'
      )}>
        {/* 모드 토글 */}
        <div className={cn(
          'flex items-center rounded-lg p-0.5',
          isDark ? 'bg-zinc-800' : 'bg-zinc-200'
        )}>
          <button
            onClick={() => setMode('quick')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              mode === 'quick'
                ? 'text-white shadow-sm'
                : isDark
                  ? 'text-zinc-400 hover:text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-700'
            )}
            style={{
              backgroundColor: mode === 'quick' ? '#3b82f6' : undefined,
            }}
          >
            <Zap className="w-3.5 h-3.5" />
            Quick
          </button>
          <button
            onClick={() => setMode('agent')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              mode === 'agent'
                ? 'text-white shadow-sm'
                : isDark
                  ? 'text-zinc-400 hover:text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-700'
            )}
            style={{
              backgroundColor: mode === 'agent' ? '#8b5cf6' : undefined,
            }}
          >
            <Users className="w-3.5 h-3.5" />
            Agent
          </button>
        </div>

        {/* 모드 설명 */}
        <div className={cn('flex-1 text-[10px]', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
          {mode === 'quick' ? (
            'Claude Code가 직접 처리'
          ) : (
            'PM 모드: 서브 에이전트 자동 생성'
          )}
        </div>

        {/* 연결 상태 */}
        <div className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-full text-[10px]',
          isConnected
            ? isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'
            : isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-200 text-zinc-400'
        )}>
          <div className={cn(
            'w-1.5 h-1.5 rounded-full',
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-zinc-500'
          )} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Agent Mode: 서브 에이전트 탭 바 (Agent 모드일 때 항상 표시) */}
      {mode === 'agent' && (
        <div className={cn(
          'flex items-center gap-1 px-2 py-1.5 border-b overflow-x-auto',
          isDark ? 'border-zinc-800 bg-zinc-900/30' : 'border-zinc-200 bg-zinc-50/50'
        )}>
          {/* 리더 탭 (항상 고정) */}
          <button
            onClick={() => setSelectedAgentId(null)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all shrink-0',
              selectedAgentId === null
                ? 'text-white'
                : isDark
                  ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100'
            )}
            style={{
              backgroundColor: selectedAgentId === null ? accentColor : undefined,
            }}
          >
            <Terminal className="w-3.5 h-3.5" />
            Leader
          </button>

          <div className={cn('w-px h-4', isDark ? 'bg-zinc-700' : 'bg-zinc-300')} />

          {/* 동적 서브 에이전트 탭들 */}
          <AnimatePresence>
            {subAgents.map((agent) => (
              <motion.button
                key={agent.id}
                initial={{ opacity: 0, scale: 0.8, width: 0 }}
                animate={{ opacity: 1, scale: 1, width: 'auto' }}
                exit={{ opacity: 0, scale: 0.8, width: 0 }}
                onClick={() => setSelectedAgentId(agent.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all shrink-0 group',
                  selectedAgentId === agent.id
                    ? isDark ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-200 text-zinc-800'
                    : isDark
                      ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100'
                )}
              >
                {agent.status === 'working' ? (
                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                ) : agent.status === 'complete' ? (
                  <CheckCircle className="w-3 h-3 text-green-500" />
                ) : agent.status === 'error' ? (
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                ) : (
                  <Bot className="w-3 h-3" />
                )}
                <span className="max-w-[80px] truncate">{agent.name}</span>

                {/* 닫기 버튼 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeSubAgent(agent.id)
                  }}
                  className={cn(
                    'opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-zinc-600',
                  )}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* 메인 컨텐츠 영역 */}
      <div className="flex-1 overflow-hidden">
        {selectedAgentId === null ? (
          // 🔥 리더 (Claude Code CLI) 채팅 UI
          <ClaudeCodeUI executionMode={mode} />
        ) : (
          // 서브 에이전트 상태 표시
          <SubAgentView
            agent={subAgents.find(a => a.id === selectedAgentId)!}
            isDark={isDark}
            accentColor={accentColor}
          />
        )}
      </div>
    </div>
  )
}

// 서브 에이전트 상세 뷰
function SubAgentView({
  agent,
  isDark,
  accentColor
}: {
  agent: DynamicSubAgent
  isDark: boolean
  accentColor: string
}) {
  if (!agent) return null

  return (
    <div className="h-full flex flex-col p-4">
      {/* 에이전트 헤더 */}
      <div className={cn(
        'rounded-lg p-4 mb-4',
        isDark ? 'bg-zinc-800/50' : 'bg-zinc-100'
      )}>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <Bot className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          <div className="flex-1">
            <h3 className={cn('font-medium', isDark ? 'text-zinc-100' : 'text-zinc-800')}>
              {agent.name}
            </h3>
            <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
              {agent.role}
            </p>
          </div>
          <div className={cn(
            'px-2 py-1 rounded-full text-xs font-medium',
            agent.status === 'working'
              ? 'bg-blue-500/20 text-blue-400'
              : agent.status === 'complete'
                ? 'bg-green-500/20 text-green-400'
                : agent.status === 'error'
                  ? 'bg-red-500/20 text-red-400'
                  : isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-500'
          )}>
            {agent.status === 'working' ? 'Working...' :
             agent.status === 'complete' ? 'Complete' :
             agent.status === 'error' ? 'Error' : 'Idle'}
          </div>
        </div>

        {/* 진행률 */}
        {agent.status === 'working' && agent.progress !== undefined && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>Progress</span>
              <span className={isDark ? 'text-zinc-300' : 'text-zinc-600'}>{agent.progress}%</span>
            </div>
            <div className={cn('h-1.5 rounded-full overflow-hidden', isDark ? 'bg-zinc-700' : 'bg-zinc-200')}>
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: accentColor }}
                initial={{ width: 0 }}
                animate={{ width: `${agent.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* 현재 작업 */}
        {agent.currentTask && (
          <div className={cn(
            'mt-3 p-2 rounded-md text-xs',
            isDark ? 'bg-zinc-900/50 text-zinc-300' : 'bg-white text-zinc-600'
          )}>
            <span className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>Current Task: </span>
            {agent.currentTask}
          </div>
        )}
      </div>

      {/* 타임라인 */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <Clock className={cn('w-3.5 h-3.5', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
            <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>
              Created: {new Date(agent.createdAt).toLocaleTimeString()}
            </span>
          </div>
          {agent.completedAt && (
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>
                Completed: {new Date(agent.completedAt).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 에이전트 로그 (향후 확장) */}
      <div className={cn(
        'mt-4 p-3 rounded-lg text-xs',
        isDark ? 'bg-zinc-900/50 border border-zinc-800' : 'bg-white border border-zinc-200'
      )}>
        <p className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>
          서브 에이전트의 작업 로그가 여기에 표시됩니다.
          리더(Claude Code CLI)가 Task 도구로 이 에이전트를 관리합니다.
        </p>
      </div>
    </div>
  )
}

// 기존 export 유지 (하위 호환성)
export const AGENT_TEAM: any[] = []
export function AgentTeamTabs({ isDark }: { isDark: boolean }) {
  return <DynamicAgentPanel isDark={isDark} />
}

export default DynamicAgentPanel
