'use client'

/**
 * ExecutionMonitor - 에이전트 실행 상태 모니터
 * Agentic Loop (Plan → Modify → Verify → Commit) 실시간 추적
 *
 * Features:
 * - 현재 단계 표시
 * - 도구 실행 로그
 * - 진행률 표시
 * - 취소/재시도 기능
 */

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  ClipboardList,
  Pencil,
  CheckCircle2,
  GitCommit,
  Loader2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Terminal,
  File,
  Search,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  Clock,
} from 'lucide-react'

export type AgentStage = 'idle' | 'plan' | 'modify' | 'verify' | 'commit' | 'complete' | 'error'

export interface ToolExecution {
  id: string
  name: string
  args?: Record<string, unknown>
  status: 'pending' | 'running' | 'success' | 'error'
  result?: unknown
  error?: string
  startTime: number
  endTime?: number
}

export interface TaskProgress {
  id: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  files?: string[]
}

interface ExecutionMonitorProps {
  stage: AgentStage
  tasks: TaskProgress[]
  toolExecutions: ToolExecution[]
  currentTaskIndex?: number
  onCancel?: () => void
  onRetry?: () => void
  className?: string
}

const STAGES: { id: AgentStage; label: string; icon: React.ElementType }[] = [
  { id: 'plan', label: 'Plan', icon: ClipboardList },
  { id: 'modify', label: 'Modify', icon: Pencil },
  { id: 'verify', label: 'Verify', icon: CheckCircle2 },
  { id: 'commit', label: 'Commit', icon: GitCommit },
]

export function ExecutionMonitor({
  stage,
  tasks,
  toolExecutions,
  currentTaskIndex = 0,
  onCancel,
  onRetry,
  className,
}: ExecutionMonitorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
  const logsEndRef = useRef<HTMLDivElement>(null)

  // 자동 스크롤
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [toolExecutions])

  const toggleTool = (id: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const getStageIndex = (s: AgentStage) => STAGES.findIndex(st => st.id === s)
  const currentStageIndex = getStageIndex(stage)

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const getToolIcon = (name: string) => {
    if (name.includes('search')) return Search
    if (name.includes('read') || name.includes('file')) return File
    if (name.includes('run') || name.includes('terminal')) return Terminal
    if (name.includes('git')) return GitCommit
    return Terminal
  }

  return (
    <div className={cn(
      "flex flex-col h-full",
      isDark ? "bg-zinc-900" : "bg-white",
      className
    )}>
      {/* 단계 표시 바 */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 border-b",
        isDark ? "border-zinc-800" : "border-zinc-200"
      )}>
        <div className="flex items-center gap-2">
          {STAGES.map((s, idx) => {
            const Icon = s.icon
            const isPast = currentStageIndex > idx
            const isCurrent = currentStageIndex === idx
            const isFuture = currentStageIndex < idx

            return (
              <React.Fragment key={s.id}>
                {idx > 0 && (
                  <div className={cn(
                    "w-8 h-0.5 rounded-full",
                    isPast
                      ? "bg-green-500"
                      : isCurrent
                        ? isDark ? "bg-blue-500" : "bg-blue-600"
                        : isDark ? "bg-zinc-700" : "bg-zinc-300"
                  )} />
                )}

                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    isPast && "text-green-500",
                    isCurrent && (isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"),
                    isFuture && (isDark ? "text-zinc-600" : "text-zinc-400")
                  )}
                >
                  {isPast ? (
                    <Check className="w-4 h-4" />
                  ) : isCurrent && stage !== 'complete' && stage !== 'error' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              </React.Fragment>
            )
          })}
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2">
          {stage !== 'idle' && stage !== 'complete' && onCancel && (
            <button
              onClick={onCancel}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                isDark
                  ? "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700"
              )}
              title="Cancel"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
          {(stage === 'error' || stage === 'complete') && onRetry && (
            <button
              onClick={onRetry}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                isDark
                  ? "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700"
              )}
              title="Retry"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 태스크 목록 */}
      {tasks.length > 0 && (
        <div className={cn(
          "px-4 py-3 border-b",
          isDark ? "border-zinc-800" : "border-zinc-200"
        )}>
          <h3 className={cn(
            "text-xs font-semibold uppercase tracking-wider mb-2",
            isDark ? "text-zinc-500" : "text-zinc-400"
          )}>
            Tasks ({tasks.filter(t => t.status === 'completed').length}/{tasks.length})
          </h3>
          <div className="space-y-2">
            {tasks.map((task, idx) => (
              <div
                key={task.id}
                className={cn(
                  "flex items-start gap-2 text-sm",
                  idx === currentTaskIndex && "font-medium"
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {task.status === 'completed' ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : task.status === 'in_progress' ? (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  ) : task.status === 'failed' ? (
                    <X className="w-4 h-4 text-red-500" />
                  ) : (
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2",
                      isDark ? "border-zinc-600" : "border-zinc-300"
                    )} />
                  )}
                </div>
                <div className="flex-1">
                  <div className={cn(
                    task.status === 'completed' && (isDark ? "text-zinc-500" : "text-zinc-400"),
                    task.status === 'in_progress' && (isDark ? "text-zinc-100" : "text-zinc-900"),
                    task.status === 'pending' && (isDark ? "text-zinc-400" : "text-zinc-600"),
                    task.status === 'failed' && "text-red-500"
                  )}>
                    {task.description}
                  </div>
                  {task.files && task.files.length > 0 && (
                    <div className={cn(
                      "flex flex-wrap gap-1 mt-1",
                      isDark ? "text-zinc-600" : "text-zinc-400"
                    )}>
                      {task.files.map(file => (
                        <span
                          key={file}
                          className={cn(
                            "text-xs font-mono px-1.5 py-0.5 rounded",
                            isDark ? "bg-zinc-800" : "bg-zinc-100"
                          )}
                        >
                          {file.split('/').pop()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 도구 실행 로그 */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className={cn(
          "px-4 py-2 sticky top-0 z-10",
          isDark ? "bg-zinc-900" : "bg-white"
        )}>
          <h3 className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            isDark ? "text-zinc-500" : "text-zinc-400"
          )}>
            Tool Executions
          </h3>
        </div>

        <div className="px-4 pb-4 space-y-1">
          <AnimatePresence initial={false}>
            {toolExecutions.map((tool) => {
              const Icon = getToolIcon(tool.name)
              const isExpanded = expandedTools.has(tool.id)
              const duration = tool.endTime
                ? formatDuration(tool.endTime - tool.startTime)
                : null

              return (
                <motion.div
                  key={tool.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn(
                    "rounded-lg overflow-hidden",
                    isDark ? "bg-zinc-800/50" : "bg-zinc-50"
                  )}
                >
                  <div
                    onClick={() => toggleTool(tool.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors",
                      isDark ? "hover:bg-zinc-800" : "hover:bg-zinc-100"
                    )}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                    )}

                    {tool.status === 'running' ? (
                      <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                    ) : tool.status === 'success' ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : tool.status === 'error' ? (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    ) : (
                      <Icon className="w-3.5 h-3.5 text-zinc-500" />
                    )}

                    <span className={cn(
                      "font-mono text-xs flex-1",
                      isDark ? "text-zinc-300" : "text-zinc-700"
                    )}>
                      {tool.name}
                    </span>

                    {duration && (
                      <span className={cn(
                        "flex items-center gap-1 text-xs",
                        isDark ? "text-zinc-500" : "text-zinc-400"
                      )}>
                        <Clock className="w-3 h-3" />
                        {duration}
                      </span>
                    )}
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className={cn(
                          "px-3 py-2 text-xs font-mono border-t",
                          isDark ? "border-zinc-700 bg-zinc-900" : "border-zinc-200 bg-white"
                        )}>
                          {/* Args */}
                          {tool.args && Object.keys(tool.args).length > 0 && (
                            <div className="mb-2">
                              <div className={cn(
                                "text-xs font-semibold mb-1",
                                isDark ? "text-zinc-500" : "text-zinc-400"
                              )}>
                                Arguments:
                              </div>
                              <pre className={cn(
                                "whitespace-pre-wrap break-all",
                                isDark ? "text-zinc-400" : "text-zinc-600"
                              )}>
                                {JSON.stringify(tool.args, null, 2)}
                              </pre>
                            </div>
                          )}

                          {/* Result */}
                          {tool.status === 'success' && tool.result && (
                            <div>
                              <div className={cn(
                                "text-xs font-semibold mb-1",
                                "text-green-500"
                              )}>
                                Result:
                              </div>
                              <pre className={cn(
                                "whitespace-pre-wrap break-all max-h-48 overflow-auto",
                                isDark ? "text-zinc-400" : "text-zinc-600"
                              )}>
                                {typeof tool.result === 'string'
                                  ? tool.result
                                  : JSON.stringify(tool.result, null, 2)}
                              </pre>
                            </div>
                          )}

                          {/* Error */}
                          {tool.status === 'error' && tool.error && (
                            <div>
                              <div className="text-xs font-semibold mb-1 text-red-500">
                                Error:
                              </div>
                              <pre className="whitespace-pre-wrap break-all text-red-400">
                                {tool.error}
                              </pre>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* 상태 표시 바 */}
      {stage !== 'idle' && (
        <div className={cn(
          "px-4 py-2 border-t text-xs",
          isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50",
          stage === 'complete' && "text-green-500",
          stage === 'error' && "text-red-500"
        )}>
          {stage === 'complete' && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              All tasks completed successfully
            </div>
          )}
          {stage === 'error' && (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Execution failed. Check the logs for details.
            </div>
          )}
          {stage !== 'complete' && stage !== 'error' && stage !== 'idle' && (
            <div className={cn(
              "flex items-center gap-2",
              isDark ? "text-zinc-400" : "text-zinc-600"
            )}>
              <Loader2 className="w-4 h-4 animate-spin" />
              Executing...
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ExecutionMonitor
