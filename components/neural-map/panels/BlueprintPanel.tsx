'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  X,
  ChevronRight,
  Zap,
  Clock,
} from 'lucide-react'

interface ExecutionLog {
  timestamp: number
  message: string
  type: 'info' | 'success' | 'error'
}

interface ExecutionState {
  id?: string
  status: 'idle' | 'pending' | 'running' | 'paused' | 'completed' | 'error'
  currentNodeId: string | null
  startedAt: number
  logs: ExecutionLog[]
  totalNodes: number
  completedNodes: number
  errorMessage?: string
}

interface BlueprintPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function BlueprintPanel({ isOpen, onClose }: BlueprintPanelProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { accentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]

  const mapId = useNeuralMapStore((s) => s.mapId)
  const graph = useNeuralMapStore((s) => s.graph)

  const [executionState, setExecutionState] = useState<ExecutionState>({
    status: 'idle',
    currentNodeId: null,
    startedAt: 0,
    logs: [],
    totalNodes: 0,
    completedNodes: 0,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)

  // Blueprint 노드 (pipeline 태그가 있는 노드들)
  const blueprintNodes = graph?.nodes?.filter(n => n.tags?.includes('pipeline')) || []

  // 실행 상태 폴링
  const fetchExecutionState = useCallback(async () => {
    if (!mapId) return

    try {
      const res = await fetch(`/api/neural-map/${mapId}/execute`)
      if (res.ok) {
        const data = await res.json()
        setExecutionState(prev => ({
          ...prev,
          ...data,
        }))

        // 완료되거나 에러면 폴링 중지
        if (data.status === 'completed' || data.status === 'error' || data.status === 'idle') {
          if (pollingInterval) {
            clearInterval(pollingInterval)
            setPollingInterval(null)
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch execution state:', err)
    }
  }, [mapId, pollingInterval])

  // 패널 열릴 때 상태 조회
  useEffect(() => {
    if (isOpen && mapId) {
      fetchExecutionState()
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [isOpen, mapId])

  // 실행 시작/재개
  const handleStart = async () => {
    if (!mapId) return
    setIsLoading(true)

    try {
      const res = await fetch(`/api/neural-map/${mapId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: executionState.status === 'paused' ? 'resume' : 'start' }),
      })

      if (res.ok) {
        const data = await res.json()
        setExecutionState(prev => ({
          ...prev,
          status: data.status,
          currentNodeId: data.currentNode?.id || null,
        }))

        // 폴링 시작
        const interval = setInterval(fetchExecutionState, 2000)
        setPollingInterval(interval)
      }
    } catch (err) {
      console.error('Failed to start execution:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // 실행 일시정지
  const handlePause = async () => {
    if (!mapId) return
    setIsLoading(true)

    try {
      const res = await fetch(`/api/neural-map/${mapId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' }),
      })

      if (res.ok) {
        setExecutionState(prev => ({
          ...prev,
          status: 'paused',
        }))

        // 폴링 중지
        if (pollingInterval) {
          clearInterval(pollingInterval)
          setPollingInterval(null)
        }
      }
    } catch (err) {
      console.error('Failed to pause execution:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // 실행 초기화
  const handleReset = async () => {
    if (!mapId) return
    setIsLoading(true)

    try {
      const res = await fetch(`/api/neural-map/${mapId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      })

      if (res.ok) {
        setExecutionState({
          status: 'idle',
          currentNodeId: null,
          startedAt: 0,
          logs: [],
          totalNodes: blueprintNodes.length,
          completedNodes: 0,
        })

        // 폴링 중지
        if (pollingInterval) {
          clearInterval(pollingInterval)
          setPollingInterval(null)
        }
      }
    } catch (err) {
      console.error('Failed to reset execution:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // 상태별 아이콘 & 색상
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'running':
        return { icon: Loader2, color: currentAccent.color, text: '실행 중', animate: true }
      case 'paused':
        return { icon: Pause, color: '#f59e0b', text: '일시정지' }
      case 'completed':
        return { icon: CheckCircle2, color: '#22c55e', text: '완료' }
      case 'error':
        return { icon: AlertCircle, color: '#ef4444', text: '오류' }
      default:
        return { icon: Circle, color: isDark ? '#71717a' : '#a1a1aa', text: '대기 중' }
    }
  }

  const statusInfo = getStatusInfo(executionState.status)
  const StatusIcon = statusInfo.icon
  const progress = executionState.totalNodes > 0
    ? Math.round((executionState.completedNodes / executionState.totalNodes) * 100)
    : 0

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={cn(
          'fixed top-0 right-0 h-full w-96 z-50 shadow-2xl',
          isDark ? 'bg-zinc-900 border-l border-zinc-800' : 'bg-white border-l border-zinc-200'
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center justify-between px-4 py-3 border-b',
          isDark ? 'border-zinc-800' : 'border-zinc-200'
        )}>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5" style={{ color: currentAccent.color }} />
            <h2 className={cn('font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
              Blueprint 실행
            </h2>
          </div>
          <button
            onClick={onClose}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* No Blueprint Nodes */}
        {blueprintNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
            <Circle className={cn('w-12 h-12 mb-4', isDark ? 'text-zinc-700' : 'text-zinc-300')} />
            <p className={cn('font-medium mb-2', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
              Blueprint 노드가 없습니다
            </p>
            <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
              노드에 <code className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">pipeline</code> 태그를 추가하면
              <br />Blueprint로 실행할 수 있습니다.
            </p>
          </div>
        ) : (
          <>
            {/* Status & Controls */}
            <div className="p-4 space-y-4">
              {/* Status Card */}
              <div className={cn(
                'p-4 rounded-xl',
                isDark ? 'bg-zinc-800/50' : 'bg-zinc-100'
              )}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <StatusIcon
                      className={cn('w-5 h-5', statusInfo.animate && 'animate-spin')}
                      style={{ color: statusInfo.color }}
                    />
                    <span className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                      {statusInfo.text}
                    </span>
                  </div>
                  <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    {executionState.completedNodes} / {executionState.totalNodes || blueprintNodes.length}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className={cn('h-2 rounded-full overflow-hidden', isDark ? 'bg-zinc-700' : 'bg-zinc-300')}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: currentAccent.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className={cn('text-xs mt-2 text-right', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                  {progress}% 완료
                </p>
              </div>

              {/* Control Buttons */}
              <div className="flex gap-2">
                {(executionState.status === 'idle' || executionState.status === 'paused' || executionState.status === 'error') && (
                  <button
                    onClick={handleStart}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium transition-colors"
                    style={{ backgroundColor: currentAccent.color }}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {executionState.status === 'paused' ? '재개' : '실행'}
                  </button>
                )}

                {executionState.status === 'running' && (
                  <button
                    onClick={handlePause}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-white font-medium transition-colors hover:bg-amber-600"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Pause className="w-4 h-4" />
                    )}
                    일시정지
                  </button>
                )}

                <button
                  onClick={handleReset}
                  disabled={isLoading || executionState.status === 'running'}
                  className={cn(
                    'px-4 py-2.5 rounded-lg font-medium transition-colors border',
                    isDark
                      ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-400 disabled:opacity-50'
                      : 'border-zinc-300 hover:bg-zinc-100 text-zinc-600 disabled:opacity-50'
                  )}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Task List */}
            <div className={cn('px-4 pb-2', isDark ? 'border-t border-zinc-800' : 'border-t border-zinc-200')}>
              <h3 className={cn('text-sm font-medium pt-3 pb-2', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                태스크 목록 ({blueprintNodes.length})
              </h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {blueprintNodes.map((node, idx) => {
                  const isCompleted = node.tags?.includes('done')
                  const isRunning = node.id === executionState.currentNodeId
                  const isTodo = !isCompleted && !isRunning

                  return (
                    <div
                      key={node.id}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                        isRunning && 'ring-2 ring-offset-1',
                        isDark ? 'bg-zinc-800/50' : 'bg-zinc-100'
                      )}
                      style={isRunning ? {
                        '--tw-ring-color': currentAccent.color,
                        backgroundColor: isDark ? `${currentAccent.color}15` : `${currentAccent.color}10`
                      } as React.CSSProperties : undefined}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      ) : isRunning ? (
                        <Loader2 className="w-4 h-4 shrink-0 animate-spin" style={{ color: currentAccent.color }} />
                      ) : (
                        <Circle className={cn('w-4 h-4 shrink-0', isDark ? 'text-zinc-600' : 'text-zinc-400')} />
                      )}
                      <span className={cn(
                        'text-sm truncate flex-1',
                        isCompleted && 'line-through opacity-60',
                        isDark ? 'text-zinc-300' : 'text-zinc-700'
                      )}>
                        {idx + 1}. {node.title}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Execution Logs */}
            <div className={cn(
              'flex-1 px-4 overflow-hidden',
              isDark ? 'border-t border-zinc-800' : 'border-t border-zinc-200'
            )}>
              <h3 className={cn('text-sm font-medium pt-3 pb-2', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                실행 로그
              </h3>
              <div className={cn(
                'h-64 overflow-y-auto rounded-lg p-3 font-mono text-xs space-y-1',
                isDark ? 'bg-zinc-950' : 'bg-zinc-900'
              )}>
                {executionState.logs.length === 0 ? (
                  <p className="text-zinc-500">실행 로그가 없습니다.</p>
                ) : (
                  executionState.logs.map((log, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="text-zinc-600 shrink-0">
                        [{new Date(log.timestamp).toLocaleTimeString()}]
                      </span>
                      <span className={cn(
                        log.type === 'success' && 'text-green-400',
                        log.type === 'error' && 'text-red-400',
                        log.type === 'info' && 'text-zinc-400'
                      )}>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
