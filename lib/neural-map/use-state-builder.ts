/**
 * useStateBuilder - React Hook for State Builder
 *
 * 뉴럴맵에서 Context Pack을 생성하고 AI에게 주입하기 위한 Hook
 */

'use client'

import { useCallback, useMemo, useState } from 'react'
import { useNeuralMapStore } from './store'
import { StateBuilder, formatContextPackForAI } from './state-builder'
import type {
  StateQuery,
  ContextPack,
  ContextPackOptions,
  ExecutionFeedback,
} from './types'

export interface UseStateBuilderOptions {
  /** 커스텀 가중치 */
  weights?: ContextPackOptions['weights']
  /** 기본 최대 뉴런 수 */
  defaultMaxNeurons?: number
}

export interface UseStateBuilderReturn {
  /** Context Pack 생성 */
  buildContextPack: (query: StateQuery, options?: ContextPackOptions) => ContextPack | null
  /** 현재 Context Pack */
  currentPack: ContextPack | null
  /** AI 주입용 문자열로 변환 */
  formatForAI: (pack?: ContextPack) => string
  /** 피드백 적용 */
  applyFeedback: (feedback: ExecutionFeedback) => void
  /** 로딩 상태 */
  isBuilding: boolean
  /** 에러 */
  error: string | null
  /** Context Pack 히스토리 */
  history: ContextPack[]
  /** 히스토리 초기화 */
  clearHistory: () => void
}

export function useStateBuilder(options?: UseStateBuilderOptions): UseStateBuilderReturn {
  const graph = useNeuralMapStore((s) => s.graph)
  const [currentPack, setCurrentPack] = useState<ContextPack | null>(null)
  const [history, setHistory] = useState<ContextPack[]>([])
  const [isBuilding, setIsBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // State Builder 인스턴스
  const builder = useMemo(() => {
    if (!graph) return null
    return new StateBuilder(graph, options?.weights)
  }, [graph, options?.weights])

  // Context Pack 생성
  const buildContextPack = useCallback(
    (query: StateQuery, packOptions?: ContextPackOptions): ContextPack | null => {
      if (!builder || !graph) {
        setError('Graph not loaded')
        return null
      }

      setIsBuilding(true)
      setError(null)

      try {
        const mergedOptions: ContextPackOptions = {
          maxNeurons: options?.defaultMaxNeurons || 50,
          ...packOptions,
        }

        const pack = builder.buildContextPack(query, mergedOptions)

        setCurrentPack(pack)
        setHistory((prev) => [...prev.slice(-9), pack]) // 최근 10개 유지

        return pack
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        setError(message)
        return null
      } finally {
        setIsBuilding(false)
      }
    },
    [builder, graph, options?.defaultMaxNeurons]
  )

  // AI 주입용 문자열 변환
  const formatForAI = useCallback(
    (pack?: ContextPack): string => {
      const target = pack || currentPack
      if (!target) return ''
      return formatContextPackForAI(target)
    },
    [currentPack]
  )

  // 피드백 적용
  const applyFeedback = useCallback(
    (feedback: ExecutionFeedback) => {
      if (!builder) return
      builder.applyFeedback(feedback)
    },
    [builder]
  )

  // 히스토리 초기화
  const clearHistory = useCallback(() => {
    setHistory([])
    setCurrentPack(null)
  }, [])

  return {
    buildContextPack,
    currentPack,
    formatForAI,
    applyFeedback,
    isBuilding,
    error,
    history,
    clearHistory,
  }
}

// ============================================
// Quick Context Pack Generation
// ============================================

/**
 * 프로젝트 컨텍스트로 빠르게 Context Pack 생성
 */
export function useProjectContext(projectId: string | null) {
  const { buildContextPack, currentPack, formatForAI } = useStateBuilder()

  const build = useCallback(() => {
    if (!projectId) return null
    return buildContextPack({
      projectId,
      stage: 'implementing',
    })
  }, [projectId, buildContextPack])

  return {
    build,
    pack: currentPack,
    prompt: formatForAI(),
  }
}

/**
 * 태스크 컨텍스트로 빠르게 Context Pack 생성
 */
export function useTaskContext(taskId: string | null, projectId?: string) {
  const { buildContextPack, currentPack, formatForAI } = useStateBuilder()

  const build = useCallback(() => {
    if (!taskId) return null
    return buildContextPack({
      taskId,
      projectId,
      stage: 'implementing',
    })
  }, [taskId, projectId, buildContextPack])

  return {
    build,
    pack: currentPack,
    prompt: formatForAI(),
  }
}
