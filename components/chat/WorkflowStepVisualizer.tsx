'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Play,
  ArrowRight,
  Zap,
  FileText,
  Send,
  Search,
  Calendar,
  Mail,
  Image,
  Code,
  Database,
  Globe,
  Bot,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WorkflowStep {
  id: string
  name: string
  description?: string
  type: 'tool' | 'api' | 'condition' | 'delay' | 'notify' | 'ai'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  skillId?: string
  endpoint?: string
  inputs?: Record<string, any>
  dependsOn?: string[]
  result?: any
  error?: string
  startedAt?: string
  completedAt?: string
}

interface WorkflowStepVisualizerProps {
  steps: WorkflowStep[]
  title?: string
  className?: string
  compact?: boolean
  onStepClick?: (step: WorkflowStep) => void
}

// 단계 타입별 아이콘
const stepIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  tool: Zap,
  api: Globe,
  condition: Code,
  delay: Circle,
  notify: Send,
  ai: Bot,
  search: Search,
  email: Mail,
  calendar: Calendar,
  image: Image,
  file: FileText,
  database: Database,
}

// 상태별 색상
const statusColors = {
  pending: 'bg-zinc-700 border-zinc-600 text-zinc-400',
  running: 'bg-purple-500/20 border-purple-500 text-purple-400',
  completed: 'bg-emerald-500/20 border-emerald-500 text-emerald-400',
  failed: 'bg-red-500/20 border-red-500 text-red-400',
  skipped: 'bg-zinc-600/50 border-zinc-500 text-zinc-500',
}

const statusGlows = {
  pending: '',
  running: 'shadow-[0_0_15px_rgba(168,85,247,0.5)]',
  completed: 'shadow-[0_0_10px_rgba(16,185,129,0.3)]',
  failed: 'shadow-[0_0_10px_rgba(239,68,68,0.3)]',
  skipped: '',
}

export function WorkflowStepVisualizer({
  steps,
  title = '워크플로우 실행',
  className,
  compact = false,
  onStepClick
}: WorkflowStepVisualizerProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null)

  // 현재 실행 중인 단계 자동 확장
  useEffect(() => {
    const runningStep = steps.find(s => s.status === 'running')
    if (runningStep) {
      setExpandedStep(runningStep.id)
    }
  }, [steps])

  const completedCount = steps.filter(s => s.status === 'completed').length
  const totalCount = steps.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
  const isRunning = steps.some(s => s.status === 'running')
  const hasFailed = steps.some(s => s.status === 'failed')

  if (compact) {
    return (
      <CompactVisualizer
        steps={steps}
        title={title}
        progress={progress}
        isRunning={isRunning}
        hasFailed={hasFailed}
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border border-zinc-700/50 bg-zinc-900/80 backdrop-blur-sm overflow-hidden',
        className
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            isRunning ? 'bg-purple-500/20' : hasFailed ? 'bg-red-500/20' : 'bg-emerald-500/20'
          )}>
            {isRunning ? (
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            ) : hasFailed ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <Sparkles className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-medium text-white">{title}</h4>
            <p className="text-xs text-zinc-500">
              {completedCount}/{totalCount} 단계 완료
            </p>
          </div>
        </div>

        {/* 진행률 바 */}
        <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className={cn(
              'h-full rounded-full',
              hasFailed ? 'bg-red-500' : isRunning ? 'bg-purple-500' : 'bg-emerald-500'
            )}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* 단계 목록 */}
      <div className="p-3 space-y-2">
        {steps.map((step, index) => {
          const Icon = stepIcons[step.type] || Zap
          const isExpanded = expandedStep === step.id

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {/* 연결선 */}
              {index > 0 && (
                <div className="flex justify-center -my-1">
                  <div className={cn(
                    'w-0.5 h-3',
                    steps[index - 1].status === 'completed' ? 'bg-emerald-500/50' : 'bg-zinc-700'
                  )} />
                </div>
              )}

              {/* 단계 카드 */}
              <motion.div
                className={cn(
                  'relative rounded-lg border p-3 cursor-pointer transition-all duration-200',
                  statusColors[step.status],
                  statusGlows[step.status],
                  'hover:border-zinc-500'
                )}
                onClick={() => {
                  setExpandedStep(isExpanded ? null : step.id)
                  onStepClick?.(step)
                }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-center gap-3">
                  {/* 상태 아이콘 */}
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    step.status === 'running' ? 'bg-purple-500/30' :
                    step.status === 'completed' ? 'bg-emerald-500/30' :
                    step.status === 'failed' ? 'bg-red-500/30' : 'bg-zinc-800'
                  )}>
                    {step.status === 'running' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : step.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : step.status === 'failed' ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>

                  {/* 단계 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{step.name}</span>
                      {step.status === 'running' && (
                        <motion.span
                          className="text-xs text-purple-400"
                          animate={{ opacity: [1, 0.5, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          실행 중...
                        </motion.span>
                      )}
                    </div>
                    {step.description && (
                      <p className="text-xs text-zinc-500 truncate">{step.description}</p>
                    )}
                  </div>

                  {/* 화살표 */}
                  <ArrowRight className={cn(
                    'w-4 h-4 transition-transform flex-shrink-0',
                    isExpanded ? 'rotate-90' : ''
                  )} />
                </div>

                {/* 확장된 상세 정보 */}
                <AnimatePresence>
                  {isExpanded && (step.result || step.error) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-3 pt-3 border-t border-zinc-700/50"
                    >
                      {step.error ? (
                        <div className="text-xs text-red-400 bg-red-500/10 rounded p-2">
                          ❌ {step.error}
                        </div>
                      ) : step.result ? (
                        <div className="text-xs text-zinc-400 bg-zinc-800/50 rounded p-2 max-h-32 overflow-auto">
                          <pre className="whitespace-pre-wrap">
                            {typeof step.result === 'string'
                              ? step.result
                              : JSON.stringify(step.result, null, 2)}
                          </pre>
                        </div>
                      ) : null}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

// 컴팩트 버전 (인라인 표시용)
function CompactVisualizer({
  steps,
  title,
  progress,
  isRunning,
  hasFailed
}: {
  steps: WorkflowStep[]
  title: string
  progress: number
  isRunning: boolean
  hasFailed: boolean
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
      {/* 상태 아이콘 */}
      {isRunning ? (
        <Loader2 className="w-4 h-4 text-purple-400 animate-spin flex-shrink-0" />
      ) : hasFailed ? (
        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      )}

      {/* 단계 도트 */}
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <motion.div
            key={step.id}
            className={cn(
              'w-2 h-2 rounded-full',
              step.status === 'completed' ? 'bg-emerald-500' :
              step.status === 'running' ? 'bg-purple-500' :
              step.status === 'failed' ? 'bg-red-500' : 'bg-zinc-600'
            )}
            animate={step.status === 'running' ? {
              scale: [1, 1.3, 1],
              opacity: [1, 0.7, 1]
            } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          />
        ))}
      </div>

      {/* 진행률 텍스트 */}
      <span className="text-xs text-zinc-400">
        {steps.filter(s => s.status === 'completed').length}/{steps.length}
      </span>
    </div>
  )
}

// 워크플로우 실행 훅
export function useWorkflowExecution() {
  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [isExecuting, setIsExecuting] = useState(false)

  const startWorkflow = (initialSteps: Omit<WorkflowStep, 'status'>[]) => {
    setSteps(initialSteps.map(s => ({ ...s, status: 'pending' as const })))
    setIsExecuting(true)
  }

  const updateStep = (stepId: string, update: Partial<WorkflowStep>) => {
    setSteps(prev => prev.map(s =>
      s.id === stepId ? { ...s, ...update } : s
    ))
  }

  const completeWorkflow = () => {
    setIsExecuting(false)
  }

  const resetWorkflow = () => {
    setSteps([])
    setIsExecuting(false)
  }

  return {
    steps,
    isExecuting,
    startWorkflow,
    updateStep,
    completeWorkflow,
    resetWorkflow
  }
}

export default WorkflowStepVisualizer
