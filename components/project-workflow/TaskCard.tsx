'use client'

import { useState, useEffect } from 'react'
import { Draggable } from '@hello-pangea/dnd'
import {
  Clock,
  User,
  Bot,
  Calendar,
  MoreVertical,
  Edit2,
  Trash2,
  UserPlus,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  Activity,
  Sparkles,
  Brain,
  Search,
  FileText,
  Send
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectTaskWithAssignee, ProjectTaskPriority } from '@/types/database'

interface TaskCardProps {
  task: ProjectTaskWithAssignee
  index: number
  onEdit?: (task: ProjectTaskWithAssignee) => void
  onDelete?: (taskId: string) => void
  onAssign?: (task: ProjectTaskWithAssignee) => void
  onExecute?: (task: ProjectTaskWithAssignee) => void
}

const priorityConfig: Record<ProjectTaskPriority, { color: string; bg: string; label: string; glow?: string }> = {
  URGENT: { color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', label: '긴급', glow: 'shadow-red-500/20' },
  HIGH: { color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30', label: '높음', glow: 'shadow-orange-500/20' },
  MEDIUM: { color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: '중간', glow: 'shadow-yellow-500/20' },
  LOW: { color: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-800', label: '낮음' },
}

// 에이전트 실행 단계
const EXECUTION_PHASES = [
  { icon: Brain, label: '분석 중', color: 'text-purple-500' },
  { icon: Search, label: '정보 수집', color: 'text-blue-500' },
  { icon: FileText, label: '결과 작성', color: 'text-green-500' },
  { icon: Send, label: '완료 중', color: 'text-accent' },
]

export function TaskCard({ task, index, onEdit, onDelete, onAssign, onExecute }: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [executionPhase, setExecutionPhase] = useState(0)
  const [progress, setProgress] = useState(0)
  const priority = priorityConfig[task.priority] || priorityConfig.MEDIUM

  const assignee = task.assignee_type === 'human' ? task.assignee_user : task.assignee_agent
  const isAgentAssigned = task.assignee_type === 'agent'
  const isAgentExecuting = task.agent_executed_at && !task.agent_result && !task.agent_error
  const hasAgentResult = !!task.agent_result
  const hasAgentError = !!task.agent_error
  const isInProgress = task.status === 'IN_PROGRESS'

  // 에이전트 실행 중 애니메이션
  useEffect(() => {
    if (!isAgentExecuting) {
      setExecutionPhase(0)
      setProgress(0)
      return
    }

    const phaseInterval = setInterval(() => {
      setExecutionPhase(prev => (prev + 1) % EXECUTION_PHASES.length)
    }, 3000)

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev
        return prev + Math.random() * 5
      })
    }, 500)

    return () => {
      clearInterval(phaseInterval)
      clearInterval(progressInterval)
    }
  }, [isAgentExecuting])

  const CurrentPhaseIcon = EXECUTION_PHASES[executionPhase].icon

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            'relative rounded-lg border p-3 mb-2 transition-all cursor-pointer group overflow-hidden',
            // 기본 스타일
            'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700',
            // 드래그 중
            snapshot.isDragging && 'shadow-xl ring-2 ring-accent/50 scale-[1.02]',
            // 진행 중 - 특별 스타일
            isInProgress && !isAgentExecuting && [
              'border-blue-400 dark:border-blue-500',
              'bg-gradient-to-br from-white to-blue-50 dark:from-zinc-800 dark:to-blue-950/30',
              'shadow-lg shadow-blue-500/10',
            ],
            // 에이전트 실행 중 - 글로우 효과
            isAgentExecuting && [
              'border-transparent',
              'bg-gradient-to-br from-violet-50 via-white to-purple-50',
              'dark:from-violet-950/40 dark:via-zinc-800 dark:to-purple-950/40',
              'shadow-xl shadow-violet-500/30',
              'animate-pulse-slow',
            ],
            // 완료된 에이전트 결과
            hasAgentResult && [
              'border-green-300 dark:border-green-700',
              'bg-gradient-to-br from-white to-green-50 dark:from-zinc-800 dark:to-green-950/20',
            ],
            // 에러 상태
            hasAgentError && [
              'border-red-300 dark:border-red-700',
              'bg-gradient-to-br from-white to-red-50 dark:from-zinc-800 dark:to-red-950/20',
            ],
            // 호버 효과
            !isAgentExecuting && 'hover:border-accent/50 hover:shadow-md'
          )}
          onClick={() => onEdit?.(task)}
        >
          {/* 에이전트 실행 중 - 배경 애니메이션 */}
          {isAgentExecuting && (
            <>
              {/* 그라디언트 보더 애니메이션 */}
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 opacity-75 animate-gradient-x" style={{ padding: '2px' }}>
                <div className="absolute inset-[2px] rounded-lg bg-white dark:bg-zinc-800" />
              </div>

              {/* 파티클 효과 */}
              <div className="absolute top-2 right-2 flex gap-1">
                <Sparkles className="w-3 h-3 text-violet-400 animate-pulse" />
                <Sparkles className="w-3 h-3 text-purple-400 animate-pulse delay-100" />
                <Sparkles className="w-3 h-3 text-pink-400 animate-pulse delay-200" />
              </div>
            </>
          )}

          {/* 진행 중 표시 배지 */}
          {isInProgress && !isAgentExecuting && (
            <div className="absolute -top-1 -right-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-medium shadow-lg">
              <Activity className="w-3 h-3 animate-pulse" />
              진행중
            </div>
          )}

          {/* Content - relative z-index to appear above animations */}
          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <h4 className={cn(
                'text-sm font-medium flex-1 pr-2',
                isAgentExecuting ? 'text-violet-900 dark:text-violet-100' : 'text-zinc-800 dark:text-zinc-200'
              )}>
                {task.title}
              </h4>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(!showMenu)
                  }}
                  className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-4 h-4 text-zinc-500" />
                </button>

                {/* Dropdown Menu */}
                {showMenu && (
                  <div
                    className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-[140px] z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        onEdit?.(task)
                        setShowMenu(false)
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <Edit2 className="w-4 h-4" /> 편집
                    </button>
                    <button
                      onClick={() => {
                        onAssign?.(task)
                        setShowMenu(false)
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <UserPlus className="w-4 h-4" /> 할당
                    </button>
                    {isAgentAssigned && !hasAgentResult && !isAgentExecuting && (
                      <button
                        onClick={() => {
                          onExecute?.(task)
                          setShowMenu(false)
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-green-600 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      >
                        <Play className="w-4 h-4" /> 실행
                      </button>
                    )}
                    <hr className="my-1 border-zinc-200 dark:border-zinc-700" />
                    <button
                      onClick={() => {
                        onDelete?.(task.id)
                        setShowMenu(false)
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <Trash2 className="w-4 h-4" /> 삭제
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 에이전트 실행 중 - 실시간 상태 */}
            {isAgentExecuting && (
              <div className="mb-3 p-2 rounded-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-violet-200 dark:border-violet-800">
                {/* 현재 단계 */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <CurrentPhaseIcon className="w-4 h-4 text-white" />
                    </div>
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 animate-ping opacity-30" />
                  </div>
                  <div className="flex-1">
                    <p className={cn('text-xs font-medium', EXECUTION_PHASES[executionPhase].color)}>
                      {EXECUTION_PHASES[executionPhase].label}...
                    </p>
                    <p className="text-[10px] text-zinc-500">AI 에이전트가 작업 중입니다</p>
                  </div>
                  <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                </div>

                {/* 프로그레스 바 */}
                <div className="relative h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </div>

                {/* 단계 인디케이터 */}
                <div className="flex justify-between mt-2 px-1">
                  {EXECUTION_PHASES.map((phase, idx) => {
                    const PhaseIcon = phase.icon
                    const isActive = idx === executionPhase
                    const isPast = idx < executionPhase
                    return (
                      <div
                        key={idx}
                        className={cn(
                          'flex items-center gap-1 text-[9px] transition-all',
                          isActive && phase.color,
                          isPast && 'text-green-500',
                          !isActive && !isPast && 'text-zinc-400'
                        )}
                      >
                        <PhaseIcon className={cn('w-3 h-3', isActive && 'animate-bounce')} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            {task.description && !isAgentExecuting && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 line-clamp-2">
                {task.description}
              </p>
            )}

            {/* 완료된 결과 미리보기 */}
            {hasAgentResult && (
              <div className="mb-3 p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">완료됨</span>
                  <Sparkles className="w-3 h-3 text-green-500" />
                </div>
                <p className="text-[11px] text-green-600 dark:text-green-400 line-clamp-2">
                  {((task.agent_result as any)?.output || '').slice(0, 100)}...
                </p>
              </div>
            )}

            {/* 에러 표시 */}
            {hasAgentError && (
              <div className="mb-3 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-red-600 dark:text-red-400">{task.agent_error}</span>
                </div>
              </div>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mb-3">
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded', priority.bg, priority.color)}>
                {priority.label}
              </span>
              {task.category && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
                  {task.category}
                </span>
              )}
              {task.tags?.slice(0, 2).map((tag, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                  {tag}
                </span>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs">
              {/* Assignee */}
              <div className="flex items-center gap-2">
                {assignee ? (
                  <div className="flex items-center gap-1.5">
                    {isAgentAssigned ? (
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center',
                        isAgentExecuting
                          ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30'
                          : hasAgentResult
                          ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                          : 'bg-accent/20'
                      )}>
                        <Bot className={cn('w-3.5 h-3.5', isAgentExecuting || hasAgentResult ? 'text-white' : 'text-accent')} />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-600 flex items-center justify-center overflow-hidden">
                        {(task.assignee_user as { avatar_url?: string })?.avatar_url ? (
                          <img
                            src={(task.assignee_user as { avatar_url: string }).avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                      </div>
                    )}
                    <span className={cn(
                      'truncate max-w-[80px]',
                      isAgentExecuting
                        ? 'text-violet-700 dark:text-violet-300 font-medium'
                        : 'text-zinc-600 dark:text-zinc-400'
                    )}>
                      {(assignee as { name?: string }).name || '할당됨'}
                    </span>
                  </div>
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                    <UserPlus className="w-3 h-3" />
                    미할당
                  </span>
                )}

                {/* Agent execution status - compact */}
                {isAgentAssigned && !isAgentExecuting && (
                  <>
                    {hasAgentResult && (
                      <span className="flex items-center gap-0.5 text-[10px] text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full">
                        <Zap className="w-3 h-3" />
                        완료
                      </span>
                    )}
                    {hasAgentError && (
                      <span className="flex items-center gap-0.5 text-[10px] text-red-600 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3" />
                        오류
                      </span>
                    )}
                    {!hasAgentResult && !hasAgentError && (
                      <span className="flex items-center gap-0.5 text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded-full">
                        <Play className="w-3 h-3" />
                        대기
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Meta info */}
              <div className="flex items-center gap-2 text-zinc-400">
                {task.estimated_hours && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {task.estimated_hours}h
                  </span>
                )}
                {task.due_date && (
                  <span className="flex items-center gap-0.5">
                    <Calendar className="w-3 h-3" />
                    {new Date(task.due_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  )
}
