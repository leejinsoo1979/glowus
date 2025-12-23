'use client'

import { useState, useCallback, useRef } from 'react'
import type { ViewfinderBounds, ViewfinderCaptureResult } from './AIViewfinder'

export interface UseViewfinderOptions {
  /** 기본 활성화 상태 */
  defaultActive?: boolean
  /** 초기 위치/크기 */
  initialBounds?: Partial<ViewfinderBounds>
  /** 분석 모드 */
  mode?: 'manual' | 'auto'
  /** 자동 모드 간격 (ms) */
  autoInterval?: number
  /** 캡처 대상 element selector */
  captureTarget?: string
}

export interface ViewfinderState {
  /** 활성화 여부 */
  isActive: boolean
  /** 현재 위치/크기 */
  bounds: ViewfinderBounds
  /** 캡처 중 여부 */
  isCapturing: boolean
  /** 분석 중 여부 */
  isAnalyzing: boolean
  /** 마지막 캡처 결과 */
  lastCapture: ViewfinderCaptureResult | null
  /** 마지막 분석 결과 */
  lastAnalysis: string | null
  /** 분석 스트리밍 중 여부 */
  isStreaming: boolean
  /** 분석 히스토리 */
  analysisHistory: Array<{
    capture: ViewfinderCaptureResult
    analysis: string
    timestamp: number
  }>
}

export interface UseViewfinderReturn extends ViewfinderState {
  /** 뷰파인더 열기 */
  open: () => void
  /** 뷰파인더 닫기 */
  close: () => void
  /** 뷰파인더 토글 */
  toggle: () => void
  /** 위치/크기 업데이트 */
  updateBounds: (bounds: Partial<ViewfinderBounds>) => void
  /** 캡처 콜백 (AIViewfinder에 전달) */
  handleCapture: (result: ViewfinderCaptureResult) => void
  /** 분석 콜백 (AIViewfinder에 전달) */
  handleAnalysis: (analysis: string, isStreaming: boolean) => void
  /** 히스토리 초기화 */
  clearHistory: () => void
  /** 현재 옵션 */
  options: UseViewfinderOptions
}

export function useViewfinder(options: UseViewfinderOptions = {}): UseViewfinderReturn {
  const {
    defaultActive = false,
    initialBounds = { x: 100, y: 100, width: 400, height: 300 },
    mode = 'manual',
    autoInterval = 3000,
    captureTarget
  } = options

  // 상태
  const [isActive, setIsActive] = useState(defaultActive)
  const [bounds, setBounds] = useState<ViewfinderBounds>({
    x: initialBounds.x ?? 100,
    y: initialBounds.y ?? 100,
    width: initialBounds.width ?? 400,
    height: initialBounds.height ?? 300
  })
  const [isCapturing, setIsCapturing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [lastCapture, setLastCapture] = useState<ViewfinderCaptureResult | null>(null)
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [analysisHistory, setAnalysisHistory] = useState<Array<{
    capture: ViewfinderCaptureResult
    analysis: string
    timestamp: number
  }>>([])

  // Ref for tracking current capture during streaming
  const currentCaptureRef = useRef<ViewfinderCaptureResult | null>(null)

  // 액션
  const open = useCallback(() => {
    setIsActive(true)
  }, [])

  const close = useCallback(() => {
    setIsActive(false)
  }, [])

  const toggle = useCallback(() => {
    setIsActive(prev => !prev)
  }, [])

  const updateBounds = useCallback((newBounds: Partial<ViewfinderBounds>) => {
    setBounds(prev => ({ ...prev, ...newBounds }))
  }, [])

  // 캡처 핸들러
  const handleCapture = useCallback((result: ViewfinderCaptureResult) => {
    setLastCapture(result)
    currentCaptureRef.current = result
    setIsCapturing(false)
  }, [])

  // 분석 핸들러
  const handleAnalysis = useCallback((analysis: string, streaming: boolean) => {
    setLastAnalysis(analysis)
    setIsStreaming(streaming)

    if (!streaming && analysis && currentCaptureRef.current) {
      // 스트리밍 완료 시 히스토리에 추가
      setAnalysisHistory(prev => [
        ...prev,
        {
          capture: currentCaptureRef.current!,
          analysis,
          timestamp: Date.now()
        }
      ])
      setIsAnalyzing(false)
    } else if (streaming && analysis === '') {
      // 스트리밍 시작
      setIsAnalyzing(true)
    }
  }, [])

  // 히스토리 초기화
  const clearHistory = useCallback(() => {
    setAnalysisHistory([])
    setLastCapture(null)
    setLastAnalysis(null)
  }, [])

  return {
    // State
    isActive,
    bounds,
    isCapturing,
    isAnalyzing,
    lastCapture,
    lastAnalysis,
    isStreaming,
    analysisHistory,

    // Actions
    open,
    close,
    toggle,
    updateBounds,
    handleCapture,
    handleAnalysis,
    clearHistory,

    // Options
    options: {
      defaultActive,
      initialBounds,
      mode,
      autoInterval,
      captureTarget
    }
  }
}

// 타입 re-export
export type { ViewfinderBounds, ViewfinderCaptureResult } from './AIViewfinder'
