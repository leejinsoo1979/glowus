'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Rnd } from 'react-rnd'
import {
  Camera,
  Eye,
  Pause,
  Play,
  Maximize2,
  Minimize2,
  X,
  Loader2,
  Scan,
  ZoomIn,
  Move
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ViewfinderBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface ViewfinderCaptureResult {
  imageDataUrl: string
  extractedText?: string
  bounds: ViewfinderBounds
  timestamp: number
}

export interface AIViewfinderProps {
  /** 부모 컨테이너 ref (bounds 제한용) */
  containerRef?: React.RefObject<HTMLElement>
  /** 캡처 결과 콜백 */
  onCapture?: (result: ViewfinderCaptureResult) => void
  /** 실시간 분석 결과 콜백 */
  onAnalysis?: (analysis: string, isStreaming: boolean) => void
  /** 분석 모드: 수동 / 자동 (interval) */
  mode?: 'manual' | 'auto'
  /** 자동 모드 간격 (ms) */
  autoInterval?: number
  /** 초기 위치/크기 */
  initialBounds?: Partial<ViewfinderBounds>
  /** 최소 크기 */
  minSize?: { width: number; height: number }
  /** 활성화 여부 */
  isActive?: boolean
  /** 닫기 콜백 */
  onClose?: () => void
  /** 캡처 대상 element selector */
  captureTarget?: string
}

export function AIViewfinder({
  containerRef,
  onCapture,
  onAnalysis,
  mode = 'manual',
  autoInterval = 3000,
  initialBounds,
  minSize = { width: 200, height: 150 },
  isActive = true,
  onClose,
  captureTarget
}: AIViewfinderProps) {
  // 상태
  const [bounds, setBounds] = useState<ViewfinderBounds>({
    x: initialBounds?.x ?? 100,
    y: initialBounds?.y ?? 100,
    width: initialBounds?.width ?? 400,
    height: initialBounds?.height ?? 300
  })
  const [isCapturing, setIsCapturing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isAutoMode, setIsAutoMode] = useState(mode === 'auto')
  const [lastCapture, setLastCapture] = useState<ViewfinderCaptureResult | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  const viewfinderRef = useRef<HTMLDivElement>(null)
  const autoIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 캡처 함수
  const captureViewfinder = useCallback(async () => {
    if (isCapturing || !isActive) return

    setIsCapturing(true)

    try {
      // html2canvas 동적 import
      const html2canvas = (await import('html2canvas')).default

      // 캡처 대상 결정
      let targetElement: HTMLElement | null = null

      if (captureTarget) {
        targetElement = document.querySelector(captureTarget) as HTMLElement
      } else if (containerRef?.current) {
        targetElement = containerRef.current
      } else {
        targetElement = document.body
      }

      if (!targetElement) {
        throw new Error('Capture target not found')
      }

      // 전체 영역 캡처 후 크롭
      const canvas = await html2canvas(targetElement, {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        scale: window.devicePixelRatio || 1
      })

      const imageDataUrl = canvas.toDataURL('image/png')

      // 텍스트 추출 (Tesseract.js 사용)
      let extractedText = ''
      try {
        const Tesseract = await import('tesseract.js')
        const worker = await Tesseract.createWorker('eng+kor')
        const { data } = await worker.recognize(imageDataUrl)
        extractedText = data.text
        await worker.terminate()
      } catch (ocrError) {
        console.warn('OCR failed, continuing without text extraction:', ocrError)
      }

      const result: ViewfinderCaptureResult = {
        imageDataUrl,
        extractedText,
        bounds: { ...bounds },
        timestamp: Date.now()
      }

      setLastCapture(result)
      onCapture?.(result)

      return result
    } catch (error) {
      console.error('Viewfinder capture failed:', error)
      return null
    } finally {
      setIsCapturing(false)
    }
  }, [isCapturing, isActive, bounds, captureTarget, containerRef, onCapture])

  // AI 분석 함수
  const analyzeCapture = useCallback(async (capture?: ViewfinderCaptureResult) => {
    const targetCapture = capture || lastCapture
    if (!targetCapture || isAnalyzing) return

    setIsAnalyzing(true)
    onAnalysis?.('', true) // 스트리밍 시작 알림

    try {
      // AI Vision API 호출
      const response = await fetch('/api/ai/vision/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: targetCapture.imageDataUrl,
          extractedText: targetCapture.extractedText,
          prompt: '이 화면에서 보이는 내용을 자세히 분석해주세요. 텍스트, 이미지, UI 요소 등을 식별하고 설명해주세요.'
        })
      })

      if (!response.ok) {
        throw new Error('Analysis API failed')
      }

      // 스트리밍 응답 처리
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullAnalysis = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          fullAnalysis += chunk
          onAnalysis?.(fullAnalysis, true)
        }
      }

      onAnalysis?.(fullAnalysis, false) // 스트리밍 완료
    } catch (error) {
      console.error('AI analysis failed:', error)
      onAnalysis?.('분석 중 오류가 발생했습니다.', false)
    } finally {
      setIsAnalyzing(false)
    }
  }, [lastCapture, isAnalyzing, onAnalysis])

  // 캡처 후 자동 분석
  const captureAndAnalyze = useCallback(async () => {
    const result = await captureViewfinder()
    if (result) {
      await analyzeCapture(result)
    }
  }, [captureViewfinder, analyzeCapture])

  // 자동 모드 관리
  useEffect(() => {
    if (isAutoMode && !isPaused && isActive) {
      autoIntervalRef.current = setInterval(() => {
        captureAndAnalyze()
      }, autoInterval)
    }

    return () => {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current)
        autoIntervalRef.current = null
      }
    }
  }, [isAutoMode, isPaused, isActive, autoInterval, captureAndAnalyze])

  // 비활성화 시 자동 모드 중지
  useEffect(() => {
    if (!isActive && autoIntervalRef.current) {
      clearInterval(autoIntervalRef.current)
      autoIntervalRef.current = null
    }
  }, [isActive])

  if (!isActive) return null

  // 최소화 상태
  if (isMinimized) {
    return (
      <div
        className="fixed bottom-4 right-4 z-[9999] bg-gradient-to-r from-blue-600 to-purple-600 rounded-full p-3 shadow-lg cursor-pointer hover:scale-110 transition-transform"
        onClick={() => setIsMinimized(false)}
      >
        <Eye className="w-6 h-6 text-white" />
        {isAutoMode && !isPaused && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        )}
      </div>
    )
  }

  return (
    <Rnd
      position={{ x: bounds.x, y: bounds.y }}
      size={{ width: bounds.width, height: bounds.height }}
      minWidth={minSize.width}
      minHeight={minSize.height}
      bounds={containerRef?.current ? 'parent' : 'window'}
      onDragStop={(e, d) => {
        setBounds(prev => ({ ...prev, x: d.x, y: d.y }))
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        setBounds({
          x: position.x,
          y: position.y,
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height)
        })
      }}
      dragHandleClassName="viewfinder-drag-handle"
      className="z-[9999]"
    >
      <div
        ref={viewfinderRef}
        className={cn(
          "w-full h-full rounded-lg overflow-hidden",
          "border-2 border-dashed",
          isCapturing || isAnalyzing
            ? "border-yellow-500 bg-yellow-500/10"
            : "border-blue-500/70 bg-blue-500/5",
          "shadow-2xl backdrop-blur-sm"
        )}
      >
        {/* 헤더 (드래그 핸들) */}
        <div className="viewfinder-drag-handle flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-600/90 to-purple-600/90 backdrop-blur cursor-move">
          <div className="flex items-center gap-2 text-white">
            <Eye className="w-4 h-4" />
            <span className="text-xs font-medium">AI Viewfinder</span>
            {isAutoMode && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full",
                isPaused ? "bg-yellow-500/30" : "bg-green-500/30"
              )}>
                {isPaused ? 'PAUSED' : 'AUTO'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* 최소화 */}
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 rounded hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>

            {/* 닫기 */}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-red-500/50 text-white/80 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 뷰파인더 영역 (투명) */}
        <div className="flex-1 relative" style={{ height: 'calc(100% - 80px)' }}>
          {/* 코너 가이드 */}
          <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-white/50" />
          <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-white/50" />
          <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-white/50" />
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-white/50" />

          {/* 중앙 십자선 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-8 h-px bg-white/30" />
            <div className="absolute w-px h-8 bg-white/30" />
          </div>

          {/* 스캔 애니메이션 */}
          {(isCapturing || isAnalyzing) && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-scan" />
            </div>
          )}

          {/* 상태 표시 */}
          {isCapturing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
              <div className="flex items-center gap-2 px-3 py-2 bg-black/60 rounded-lg text-white text-sm">
                <Camera className="w-4 h-4 animate-pulse" />
                <span>캡처 중...</span>
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
              <div className="flex items-center gap-2 px-3 py-2 bg-black/60 rounded-lg text-white text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI 분석 중...</span>
              </div>
            </div>
          )}
        </div>

        {/* 컨트롤 바 */}
        <div className="flex items-center justify-between px-3 py-2 bg-black/60 backdrop-blur">
          <div className="flex items-center gap-1">
            {/* 수동 캡처 */}
            <button
              onClick={captureViewfinder}
              disabled={isCapturing || isAnalyzing}
              className={cn(
                "p-1.5 rounded-md text-white/80 hover:text-white transition-colors",
                "hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title="캡처"
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* 캡처 + 분석 */}
            <button
              onClick={captureAndAnalyze}
              disabled={isCapturing || isAnalyzing}
              className={cn(
                "p-1.5 rounded-md text-white/80 hover:text-white transition-colors",
                "hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title="캡처 및 분석"
            >
              <Scan className="w-4 h-4" />
            </button>

            {/* 자동 모드 토글 */}
            <button
              onClick={() => setIsAutoMode(!isAutoMode)}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                isAutoMode
                  ? "bg-green-500/30 text-green-400"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              )}
              title={isAutoMode ? "자동 모드 끄기" : "자동 모드 켜기"}
            >
              {isAutoMode ? (
                isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>

            {/* 일시정지 (자동 모드에서만) */}
            {isAutoMode && (
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  isPaused
                    ? "bg-yellow-500/30 text-yellow-400"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                )}
                title={isPaused ? "재개" : "일시정지"}
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* 크기 정보 */}
          <div className="flex items-center gap-2 text-white/60 text-xs">
            <Move className="w-3 h-3" />
            <span>{bounds.width} × {bounds.height}</span>
          </div>
        </div>
      </div>
    </Rnd>
  )
}

// 스캔 애니메이션 CSS
const scanAnimation = `
@keyframes scan {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(calc(100% + 100vh)); }
}
.animate-scan {
  animation: scan 2s linear infinite;
}
`

// 글로벌 스타일 주입
if (typeof document !== 'undefined') {
  const styleId = 'viewfinder-animations'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = scanAnimation
    document.head.appendChild(style)
  }
}
