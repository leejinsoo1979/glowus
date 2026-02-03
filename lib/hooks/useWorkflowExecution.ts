'use client'

import { useState } from 'react'

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

/**
 * 워크플로우 실행 훅
 * 🔥 Separate file to avoid bundling WorkflowStepVisualizer component with framer-motion
 */
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
