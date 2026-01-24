"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  X,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Maximize2,
  Clock,
  Copy,
  Check,
  Volume2,
  SkipBack,
  SkipForward,
  GripVertical,
  Loader2
} from 'lucide-react'

// PDF 슬라이드 이미지 타입
export interface SlideImage {
  pageNumber: number
  imageUrl: string
  title?: string
}

// 팟캐스트 대화 라인 타입
export interface DialogueLine {
  speaker: string
  text: string
}

// Types
export interface StudioContent {
  id: string
  type: 'audio-overview' | 'video-overview' | 'slides' | 'mindmap' | 'report' | 'flashcard' | 'quiz' | 'infographic' | 'data-table'
  title: string
  subtitle?: string
  content: string
  status: 'generating' | 'ready' | 'error'
  createdAt: Date
  sourceCount?: number
  duration?: string
  audioUrl?: string
  slides?: SlideData[]
  slideImages?: SlideImage[] // 원본 PDF 페이지 이미지들
  imageUrl?: string
  // Podcast-style video-overview (Gemini 2.5 TTS Multi-Speaker)
  podcastAudioUrl?: string  // 전체 팟캐스트 오디오
  dialogueLines?: DialogueLine[]  // 파싱된 대화 라인들
}

export interface SlideData {
  id?: string
  number: number
  title: string
  content?: string[]
  notes?: string
  imageUrl?: string
  type?: 'title' | 'content' | 'image' | 'chart' | 'quote' | 'summary'
  // video-overview용 확장 필드
  narration?: string
  bulletPoints?: string[]
  audioUrl?: string
}

interface StudioPreviewPanelProps {
  content: StudioContent | null
  isDark: boolean
  themeColor: string
  onClose: () => void
  onFeedback?: (type: 'positive' | 'negative') => void
  width: number
  onResize: (width: number) => void
  minWidth?: number
  maxWidth?: number
}

// Audio Player Component
function AudioPlayer({
  audioUrl,
  isDark,
  themeColor
}: {
  audioUrl: string
  duration?: string
  isDark: boolean
  themeColor: string
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => setTotalDuration(audio.duration)
    const onEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(totalDuration, currentTime + seconds))
    }
  }

  const changeSpeed = () => {
    const speeds = [1, 1.25, 1.5, 1.75, 2]
    const nextIndex = (speeds.indexOf(playbackRate) + 1) % speeds.length
    const newRate = speeds[nextIndex]
    setPlaybackRate(newRate)
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={cn("rounded-xl p-4", isDark ? "bg-white/5" : "bg-gray-50")}>
      <audio ref={audioRef} src={audioUrl} />

      {/* Progress Bar */}
      <div className="mb-4">
        <input
          type="range"
          min={0}
          max={totalDuration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${themeColor} ${(currentTime / totalDuration) * 100}%, ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'} 0%)`
          }}
        />
        <div className="flex justify-between mt-2">
          <span className={cn("text-xs font-mono", isDark ? "text-zinc-500" : "text-gray-500")}>
            {formatTime(currentTime)}
          </span>
          <span className={cn("text-xs font-mono", isDark ? "text-zinc-500" : "text-gray-500")}>
            {formatTime(totalDuration)}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={changeSpeed}
          className={cn(
            "px-2 py-1 rounded text-xs font-bold min-w-[40px]",
            isDark ? "bg-white/10 text-white" : "bg-gray-200 text-gray-700"
          )}
        >
          {playbackRate}X
        </button>

        <button
          onClick={() => skip(-15)}
          className={cn(
            "p-2 rounded-full transition-colors",
            isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-200 text-gray-500"
          )}
        >
          <SkipBack className="w-5 h-5" />
        </button>

        <button
          onClick={togglePlay}
          className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105"
          style={{ backgroundColor: themeColor }}
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
        </button>

        <button
          onClick={() => skip(15)}
          className={cn(
            "p-2 rounded-full transition-colors",
            isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-200 text-gray-500"
          )}
        >
          <SkipForward className="w-5 h-5" />
        </button>

        <button className={cn(
          "p-2 rounded-full transition-colors",
          isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-200 text-gray-500"
        )}>
          <Volume2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

// Slides Preview Component - Improved parsing and display
function SlidesPreview({
  slides,
  content,
  isDark,
  themeColor
}: {
  slides?: SlideData[]
  content: string
  isDark: boolean
  themeColor: string
}) {
  const [currentSlide, setCurrentSlide] = useState(0)

  // Parse slides from content if not provided
  const parsedSlides = React.useMemo((): SlideData[] => {
    if (slides && slides.length > 0) return slides

    // Split by "## 슬라이드" or "# 슬라이드" pattern
    const parts = content.split(/(?=#{1,2}\s*슬라이드\s*\d+)/gim).filter(s => s.trim())

    const slideBlocks: SlideData[] = []

    parts.forEach((block, idx) => {
      const lines = block.trim().split('\n').filter(l => l.trim())
      if (lines.length === 0) return

      // Skip if it's just a separator
      if (lines[0].trim() === '---') return

      // Extract title from first line: "## 슬라이드 1: 제목" or "# 슬라이드 1: [제목]"
      const firstLine = lines[0]
      let title = ''

      const titleMatch = firstLine.match(/#{1,2}\s*슬라이드\s*\d+[::]\s*(.+)/i)
      if (titleMatch) {
        title = titleMatch[1].replace(/^\*\*|\*\*$/g, '').replace(/^\[|\]$/g, '').trim()
      } else {
        title = firstLine.replace(/^#+\s*/, '').replace(/^\*\*|\*\*$/g, '').trim() || `슬라이드 ${idx + 1}`
      }

      // Extract content and notes
      const contentLines: string[] = []
      let notes: string | undefined

      lines.slice(1).forEach(line => {
        const trimmedLine = line.trim()
        if (!trimmedLine || trimmedLine === '---') return

        // Check for speaker notes: "📝 발표자 노트: ..."
        if (trimmedLine.startsWith('📝') || trimmedLine.includes('발표자 노트')) {
          notes = trimmedLine.replace(/📝\s*/, '').replace(/발표자 노트[::]\s*/i, '').replace(/^\[|\]$/g, '').trim()
        }
        // Check for bullet points: "- ", "• ", "* ", "1. " etc.
        else if (trimmedLine.match(/^[-•*]\s+/) || trimmedLine.match(/^[0-9]+\.\s+/)) {
          contentLines.push(trimmedLine.replace(/^[-•*]\s+/, '').replace(/^[0-9]+\.\s+/, '').trim())
        }
        // Check for bold text as subtitle: **text**
        else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
          contentLines.push(trimmedLine.replace(/^\*\*|\*\*$/g, '').replace(/^\[|\]$/g, '').trim())
        }
        // Check for "부제목:" line
        else if (trimmedLine.startsWith('부제목:')) {
          contentLines.push(trimmedLine.replace('부제목:', '').replace(/^\[|\]$/g, '').trim())
        }
        // Regular text (not headers)
        else if (!trimmedLine.startsWith('#')) {
          // Check for inline [text] brackets and extract content
          const bracketMatch = trimmedLine.match(/^\[([^\]]+)\]$/)
          if (bracketMatch) {
            contentLines.push(bracketMatch[1].trim())
          } else {
            contentLines.push(trimmedLine)
          }
        }
      })

      slideBlocks.push({
        id: `slide-${idx}`,
        number: idx + 1,
        title: title || `슬라이드 ${idx + 1}`,
        content: contentLines.length > 0 ? contentLines : ['내용 없음'],
        notes,
        type: idx === 0 ? 'title' : 'content'
      })
    })

    // Fallback if no slides found
    if (slideBlocks.length === 0) {
      const lines = content.split('\n').filter(l => l.trim())
      return [{
        id: 'slide-0',
        number: 1,
        title: '프레젠테이션',
        content: lines.slice(0, 5).map(l => l.replace(/^[-•*#]+\s*/, '').trim()).filter(Boolean),
        type: 'title'
      }]
    }

    return slideBlocks
  }, [slides, content])

  const slide = parsedSlides[currentSlide]

  return (
    <div className="h-full flex flex-col">
      {/* Slide Preview */}
      <div className={cn(
        "flex-1 rounded-xl overflow-hidden relative mb-4 min-h-[300px]",
        isDark
          ? "bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10"
          : "bg-gradient-to-br from-slate-50 to-white border border-gray-200 shadow-sm"
      )}>
        <div className="p-6 h-full flex flex-col">
          {/* Slide Title */}
          <h3 className={cn(
            "text-lg font-bold mb-4 pb-3 border-b",
            isDark ? "text-white border-white/10" : "text-gray-900 border-gray-200"
          )}>
            {slide?.title}
          </h3>

          {/* Slide Content */}
          <ul className="space-y-3 flex-1 overflow-y-auto">
            {(slide?.content || []).map((item, i) => (
              <li
                key={i}
                className={cn("text-sm flex items-start gap-3", isDark ? "text-zinc-300" : "text-gray-700")}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                  style={{ backgroundColor: themeColor }}
                />
                <span className="flex-1">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Slide Number Badge */}
        <div className={cn(
          "absolute bottom-4 right-4 px-3 py-1.5 rounded-lg text-xs font-medium",
          isDark ? "bg-white/10 text-white" : "bg-gray-100 text-gray-600"
        )}>
          {currentSlide + 1} / {parsedSlides.length}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
          disabled={currentSlide === 0}
          className={cn(
            "p-2 rounded-lg transition-colors disabled:opacity-30",
            isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-100 text-gray-500"
          )}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Pagination dots */}
        <div className="flex gap-1.5 overflow-x-auto px-2 max-w-[200px]">
          {parsedSlides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={cn(
                "h-2 rounded-full transition-all flex-shrink-0",
                idx === currentSlide ? "w-6" : "w-2"
              )}
              style={{
                backgroundColor: idx === currentSlide
                  ? themeColor
                  : isDark ? 'rgba(255,255,255,0.2)' : '#d1d5db'
              }}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentSlide(Math.min(parsedSlides.length - 1, currentSlide + 1))}
          disabled={currentSlide === parsedSlides.length - 1}
          className={cn(
            "p-2 rounded-lg transition-colors disabled:opacity-30",
            isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-100 text-gray-500"
          )}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Notes */}
      {slide?.notes && (
        <div className={cn(
          "p-3 rounded-lg text-sm",
          isDark ? "bg-white/5 text-zinc-400" : "bg-gray-50 text-gray-600"
        )}>
          <span className="font-medium">📝 발표자 노트:</span> {slide.notes}
        </div>
      )}
    </div>
  )
}

// IR Slide 데이터 타입
interface IRSlide {
  number: number
  title: string
  narration: string
  bulletPoints?: string[]
  imageUrl?: string
  audioUrl?: string
  layout?: 'title' | 'content' | 'image-left' | 'image-right' | 'image-full' | 'two-column' | 'quote'
}

// 슬라이드 레이아웃 타입 자동 결정
function determineSlideLayout(slide: IRSlide, totalSlides: number): IRSlide['layout'] {
  if (slide.number === 1) return 'title'
  if (slide.number === totalSlides) return 'title' // 마지막도 타이틀 스타일
  if (slide.imageUrl && slide.bulletPoints && slide.bulletPoints.length > 0) {
    return slide.number % 2 === 0 ? 'image-left' : 'image-right'
  }
  if (slide.imageUrl && (!slide.bulletPoints || slide.bulletPoints.length === 0)) {
    return 'image-full'
  }
  return 'content'
}

// 전문 PPT 스타일 슬라이드 컴포넌트
function SlideVisual({
  slide,
  isDark,
  themeColor,
  isActive,
  totalSlides
}: {
  slide: IRSlide
  isDark: boolean
  themeColor: string
  isActive: boolean
  totalSlides: number
}) {
  const layout = slide.layout || determineSlideLayout(slide, totalSlides)
  const isFirstSlide = slide.number === 1
  const isLastSlide = slide.number === totalSlides

  // 그라디언트 배경 색상
  const gradients = {
    primary: isDark
      ? 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)'
      : 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #6366f1 100%)',
    secondary: isDark
      ? 'linear-gradient(135deg, #18181b 0%, #27272a 100%)'
      : 'linear-gradient(135deg, #ffffff 0%, #f4f4f5 100%)',
    accent: `linear-gradient(135deg, ${themeColor}22 0%, ${themeColor}11 100%)`
  }

  // 타이틀 슬라이드 (첫/마지막)
  if (layout === 'title') {
    return (
      <div
        className={cn(
          "relative w-full aspect-video rounded-xl overflow-hidden",
          isActive && "ring-2 ring-offset-2",
          isDark ? "ring-offset-[#0f0f1a]" : "ring-offset-white"
        )}
        style={{
          background: slide.imageUrl ? undefined : gradients.primary,
          '--tw-ring-color': themeColor
        } as React.CSSProperties}
      >
        {/* 배경 이미지 */}
        {slide.imageUrl && (
          <>
            <img
              src={slide.imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
          </>
        )}

        {/* 장식 요소 */}
        {!slide.imageUrl && (
          <>
            <div
              className="absolute top-0 right-0 w-1/2 h-full opacity-10"
              style={{
                background: `radial-gradient(circle at 100% 0%, ${themeColor} 0%, transparent 50%)`
              }}
            />
            <div
              className="absolute bottom-0 left-0 w-1/3 h-1/2 opacity-10"
              style={{
                background: `radial-gradient(circle at 0% 100%, ${themeColor} 0%, transparent 50%)`
              }}
            />
          </>
        )}

        {/* 콘텐츠 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
          {/* 슬라이드 번호 뱃지 */}
          <div className="absolute top-4 right-4">
            <span
              className="px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm"
              style={{
                backgroundColor: `${themeColor}33`,
                color: 'white'
              }}
            >
              {slide.number} / {totalSlides}
            </span>
          </div>

          {/* 상단 라인 장식 */}
          <div
            className="w-16 h-1 rounded-full mb-6"
            style={{ backgroundColor: themeColor }}
          />

          {/* 메인 타이틀 */}
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 drop-shadow-lg max-w-[90%]">
            {slide.title}
          </h2>

          {/* 서브 텍스트 */}
          {slide.bulletPoints && slide.bulletPoints.length > 0 && (
            <p className="text-white/70 text-sm md:text-base max-w-[80%]">
              {slide.bulletPoints[0]}
            </p>
          )}

          {/* 하단 장식 */}
          {isLastSlide && (
            <div className="absolute bottom-8 flex items-center gap-2 text-white/50 text-xs">
              <span>Thank You</span>
              <div className="w-8 h-px bg-white/30" />
            </div>
          )}
        </div>
      </div>
    )
  }

  // 이미지 + 텍스트 레이아웃 (좌/우)
  if (layout === 'image-left' || layout === 'image-right') {
    const isImageLeft = layout === 'image-left'

    return (
      <div
        className={cn(
          "relative w-full aspect-video rounded-xl overflow-hidden",
          isActive && "ring-2 ring-offset-2",
          isDark ? "ring-offset-[#0f0f1a] bg-zinc-900" : "ring-offset-white bg-white"
        )}
        style={{ '--tw-ring-color': themeColor } as React.CSSProperties}
      >
        <div className={cn("absolute inset-0 flex", isImageLeft ? "flex-row" : "flex-row-reverse")}>
          {/* 이미지 영역 (45%) */}
          <div className="w-[45%] h-full relative">
            {slide.imageUrl ? (
              <img
                src={slide.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full"
                style={{ background: gradients.primary }}
              />
            )}
            {/* 이미지 오버레이 그라디언트 */}
            <div
              className={cn(
                "absolute inset-0",
                isImageLeft
                  ? "bg-gradient-to-r from-transparent to-black/20"
                  : "bg-gradient-to-l from-transparent to-black/20"
              )}
            />
          </div>

          {/* 텍스트 영역 (55%) */}
          <div className={cn(
            "w-[55%] h-full p-6 flex flex-col justify-center",
            isDark ? "bg-zinc-900" : "bg-white"
          )}>
            {/* 슬라이드 번호 */}
            <div className="absolute top-4 right-4">
              <span
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium",
                  isDark ? "bg-white/10 text-white/60" : "bg-gray-100 text-gray-500"
                )}
              >
                {slide.number}
              </span>
            </div>

            {/* 상단 악센트 라인 */}
            <div
              className="w-10 h-1 rounded-full mb-4"
              style={{ backgroundColor: themeColor }}
            />

            {/* 타이틀 */}
            <h3 className={cn(
              "text-lg font-bold mb-4 leading-tight",
              isDark ? "text-white" : "text-gray-900"
            )}>
              {slide.title}
            </h3>

            {/* 불렛 포인트 */}
            {slide.bulletPoints && slide.bulletPoints.length > 0 && (
              <ul className="space-y-2.5 flex-1 overflow-hidden">
                {slide.bulletPoints.slice(0, 4).map((point, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: themeColor }}
                    />
                    <span className={cn(
                      "text-sm leading-relaxed",
                      isDark ? "text-zinc-300" : "text-gray-700"
                    )}>
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 풀 이미지 레이아웃
  if (layout === 'image-full') {
    return (
      <div
        className={cn(
          "relative w-full aspect-video rounded-xl overflow-hidden",
          isActive && "ring-2 ring-offset-2",
          isDark ? "ring-offset-[#0f0f1a]" : "ring-offset-white"
        )}
        style={{ '--tw-ring-color': themeColor } as React.CSSProperties}
      >
        {/* 배경 이미지 */}
        {slide.imageUrl ? (
          <img
            src={slide.imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: gradients.primary }}
          />
        )}

        {/* 하단 그라디언트 오버레이 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

        {/* 슬라이드 번호 */}
        <div className="absolute top-4 right-4">
          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-black/40 text-white backdrop-blur-sm">
            {slide.number}
          </span>
        </div>

        {/* 하단 타이틀 영역 */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div
            className="w-10 h-1 rounded-full mb-3"
            style={{ backgroundColor: themeColor }}
          />
          <h3 className="text-xl font-bold text-white drop-shadow-lg">
            {slide.title}
          </h3>
        </div>
      </div>
    )
  }

  // 기본 콘텐츠 레이아웃
  return (
    <div
      className={cn(
        "relative w-full aspect-video rounded-xl overflow-hidden",
        isActive && "ring-2 ring-offset-2",
        isDark ? "ring-offset-[#0f0f1a]" : "ring-offset-white"
      )}
      style={{
        background: isDark ? gradients.secondary : '#ffffff',
        '--tw-ring-color': themeColor
      } as React.CSSProperties}
    >
      {/* 상단 악센트 바 */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5"
        style={{ backgroundColor: themeColor }}
      />

      {/* 장식 요소 */}
      <div
        className="absolute top-0 right-0 w-1/3 h-1/3 opacity-5"
        style={{
          background: `radial-gradient(circle at 100% 0%, ${themeColor} 0%, transparent 70%)`
        }}
      />

      {/* 콘텐츠 */}
      <div className="absolute inset-0 p-6 flex flex-col">
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className={cn(
              "text-lg font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              {slide.title}
            </h3>
          </div>
          <span
            className={cn(
              "px-2 py-1 rounded text-xs font-medium",
              isDark ? "bg-white/10 text-white/60" : "bg-gray-100 text-gray-500"
            )}
          >
            {slide.number}
          </span>
        </div>

        {/* 불렛 포인트 */}
        {slide.bulletPoints && slide.bulletPoints.length > 0 && (
          <div className="flex-1 overflow-hidden">
            <ul className="space-y-3">
              {slide.bulletPoints.slice(0, 5).map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                    style={{ backgroundColor: themeColor }}
                  >
                    {i + 1}
                  </div>
                  <span className={cn(
                    "text-sm leading-relaxed pt-0.5",
                    isDark ? "text-zinc-300" : "text-gray-700"
                  )}>
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// Video Overview Preview Component - NotebookLM 스타일
function VideoOverviewPreview({
  content,
  isDark,
  themeColor,
  sourceSlideImages,
  preloadedSlides,
  podcastAudioUrl,
  dialogueLines
}: {
  content: string
  isDark: boolean
  themeColor: string
  sourceSlideImages?: SlideImage[] // 업로드된 이미지들 (슬라이드로 사용)
  preloadedSlides?: SlideData[]    // API에서 미리 생성된 슬라이드 데이터 (TTS 오디오 포함)
  podcastAudioUrl?: string         // Gemini 2.5 TTS Multi-Speaker 전체 오디오
  dialogueLines?: DialogueLine[]   // 파싱된 대화 라인들
}) {
  // Podcast 모드 (Gemini 2.5 TTS Multi-Speaker)
  const isPodcastMode = Boolean(podcastAudioUrl && dialogueLines && dialogueLines.length > 0)

  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [prepareProgress, setPrepareProgress] = useState(0)
  const [slideAudios, setSlideAudios] = useState<Map<number, string>>(new Map())
  const [slideImages, setSlideImages] = useState<Map<number, string>>(new Map())
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const hasPreparedRef = useRef(false)
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Podcast 모드용 상태
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const dialogueContainerRef = useRef<HTMLDivElement>(null)
  const podcastAudioRef = useRef<HTMLAudioElement>(null)

  // IR 슬라이드 파싱 - 타임스탬프 기반으로 슬라이드 분할
  const slides: IRSlide[] = React.useMemo(() => {
    // 0. preloadedSlides가 있으면 그대로 사용 (API에서 TTS 오디오 포함)
    if (preloadedSlides && preloadedSlides.length > 0) {
      return preloadedSlides.map(s => ({
        number: s.number,
        title: s.title,
        narration: s.narration || '',
        bulletPoints: s.bulletPoints || [],
        imageUrl: s.imageUrl,
        audioUrl: s.audioUrl
      }))
    }

    // 1. [SLIDE:N] 형식 체크
    const slideMatches = content.match(/\[SLIDE:\d+\][\s\S]*?(?=\[SLIDE:\d+\]|$)/g)

    if (slideMatches && slideMatches.length > 0) {
      return slideMatches.map((block, idx) => {
        const titleMatch = block.match(/\[TITLE\]([\s\S]*?)\[\/TITLE\]/)
        const narrationMatch = block.match(/\[NARRATION\]([\s\S]*?)\[\/NARRATION\]/)
        const bulletsMatch = block.match(/\[BULLETS\]([\s\S]*?)\[\/BULLETS\]/)

        const bulletPoints = bulletsMatch
          ? bulletsMatch[1].split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
          : []

        return {
          number: idx + 1,
          title: titleMatch?.[1]?.trim() || `슬라이드 ${idx + 1}`,
          narration: narrationMatch?.[1]?.trim() || '',
          bulletPoints
        }
      })
    }

    // 2. 타임스탬프 (0:00) 형식 - NotebookLM 스타일
    const timestampRegex = /\((\d+:\d+)\)\s*/g
    const hasTimestamps = timestampRegex.test(content)

    if (hasTimestamps) {
      // 타임스탬프별로 문장 분할
      const sentences = content.split(/(?=\(\d+:\d+\))/).filter(s => s.trim())

      // 30초(약 6-8문장) 단위로 슬라이드 그룹화
      const SENTENCES_PER_SLIDE = 7
      const slideGroups: string[][] = []

      for (let i = 0; i < sentences.length; i += SENTENCES_PER_SLIDE) {
        slideGroups.push(sentences.slice(i, i + SENTENCES_PER_SLIDE))
      }

      return slideGroups.map((group, idx) => {
        // 나레이션: 타임스탬프 제거하고 연결
        const narration = group
          .map(s => s.replace(/\(\d+:\d+\)\s*/g, '').trim())
          .filter(Boolean)
          .join(' ')

        // 제목: 첫 문장에서 추출 (타임스탬프 제거)
        const firstSentence = group[0]?.replace(/\(\d+:\d+\)\s*/g, '').trim() || ''
        const title = firstSentence.slice(0, 30) + (firstSentence.length > 30 ? '...' : '')

        // 불렛 포인트: 핵심 문장 3개 추출
        const bulletPoints = group
          .slice(0, 3)
          .map(s => s.replace(/\(\d+:\d+\)\s*/g, '').trim())
          .filter(s => s.length > 5 && s.length < 100)

        return {
          number: idx + 1,
          title: title || `슬라이드 ${idx + 1}`,
          narration,
          bulletPoints
        }
      })
    }

    // 3. ## 헤더 형식 폴백
    const sections = content.split(/##\s+/).filter(Boolean)
    if (sections.length > 1) {
      return sections.map((section, idx) => {
        const lines = section.split('\n')
        const title = lines[0]?.replace(/📍|🎬|\([^)]+\)/g, '').trim() || `슬라이드 ${idx + 1}`
        const bulletPoints = lines.slice(1)
          .map(l => l.replace(/^[-•*]\s*/, '').replace(/\*\*[^*]+\*\*:?/g, '').trim())
          .filter(l => l.length > 0 && l.length < 100)
          .slice(0, 4)
        const narration = lines.slice(1).join(' ').replace(/\*\*[^*]+\*\*:?/g, '').trim()

        return {
          number: idx + 1,
          title,
          bulletPoints,
          narration
        }
      })
    }

    // 4. 최종 폴백: 전체 내용을 하나의 슬라이드로
    return [{
      number: 1,
      title: '프레젠테이션',
      narration: content.replace(/\(\d+:\d+\)\s*/g, '').trim(),
      bulletPoints: content.split('\n').slice(0, 3).map(l => l.replace(/\(\d+:\d+\)\s*/g, '').trim())
    }]
  }, [content, preloadedSlides])

  // 슬라이드에 이미지와 오디오 URL 주입
  // preloadedSlides에서 이미 audioUrl/imageUrl이 있으면 그것을 우선 사용
  const enrichedSlides = React.useMemo(() => {
    return slides.map(slide => ({
      ...slide,
      imageUrl: slide.imageUrl || slideImages.get(slide.number),
      audioUrl: slide.audioUrl || slideAudios.get(slide.number)
    }))
  }, [slides, slideImages, slideAudios])

  const currentSlideData = enrichedSlides[currentSlide]

  // 모든 슬라이드 TTS + 이미지 병렬 생성
  const prepareAllAudios = React.useCallback(async () => {
    if (hasPreparedRef.current || slides.length === 0) return new Map<number, string>()

    // preloadedSlides에서 이미 모든 슬라이드에 audioUrl과 imageUrl이 있으면 준비 완료로 간주
    const allHaveAudio = slides.every(s => s.audioUrl)
    const allHaveImage = slides.every(s => s.imageUrl)
    if (allHaveAudio && allHaveImage) {
      console.log('[VideoOverview] All slides already have audio and image from API')
      hasPreparedRef.current = true
      return new Map<number, string>()
    }

    hasPreparedRef.current = true

    setIsPreparing(true)
    setPrepareProgress(0)

    const newAudios = new Map<number, string>()
    const newImages = new Map<number, string>()
    let completed = 0

    // 업로드된 이미지를 먼저 슬라이드에 매핑 (있는 만큼만)
    const sourceImageCount = sourceSlideImages?.length || 0
    if (sourceSlideImages && sourceImageCount > 0) {
      sourceSlideImages.forEach((img, idx) => {
        // 1-indexed로 매핑
        newImages.set(idx + 1, img.imageUrl)
      })
    }

    // 이미 이미지가 있는 슬라이드 제외
    const slidesNeedingImage = slides.filter(slide => !slide.imageUrl && slide.number > sourceImageCount)
    // 이미 오디오가 있는 슬라이드 제외
    const slidesNeedingAudio = slides.filter(slide => !slide.audioUrl)

    const aiImageCount = slidesNeedingImage.length
    const ttsCount = slidesNeedingAudio.length

    // 필요한 TTS + AI 이미지만 생성
    const total = ttsCount + aiImageCount

    if (total === 0) {
      setIsPreparing(false)
      setPrepareProgress(100)
      return newAudios
    }

    // TTS + 필요한 경우 AI 이미지 병렬 생성
    const promises = slides.flatMap(slide => {
      const promiseList: Promise<void>[] = []

      // TTS 생성 (audioUrl이 없는 슬라이드만)
      if (!slide.audioUrl && slide.narration) {
        const ttsPromise = fetch('/api/ai-studio/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: slide.narration, voice: 'male' })
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.audioUrl) {
              newAudios.set(slide.number, data.audioUrl)
            }
            completed++
            setPrepareProgress(Math.round((completed / total) * 100))
          })
          .catch(err => {
            console.error(`TTS error slide ${slide.number}:`, err)
            completed++
            setPrepareProgress(Math.round((completed / total) * 100))
          })
        promiseList.push(ttsPromise)
      }

      // 이미지가 없는 슬라이드만 AI 이미지 생성 (preloaded 이미지도 체크)
      if (!slide.imageUrl && slide.number > sourceImageCount) {
        const imagePromise = fetch('/api/ai-studio/slide-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slideTitle: slide.title,
            slideContent: slide.bulletPoints,
            slideNumber: slide.number,
            totalSlides: slides.length
          })
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.imageUrl) {
              newImages.set(slide.number, data.imageUrl)
            }
            completed++
            setPrepareProgress(Math.round((completed / total) * 100))
          })
          .catch(err => {
            console.error(`Image error slide ${slide.number}:`, err)
            completed++
            setPrepareProgress(Math.round((completed / total) * 100))
          })

        promiseList.push(imagePromise)
      }

      return promiseList
    })

    await Promise.all(promises)

    setSlideAudios(newAudios)
    setSlideImages(newImages)
    setIsPreparing(false)
    setPrepareProgress(100)

    return newAudios
  }, [slides, sourceSlideImages])

  // 컴포넌트 마운트 시 자동으로 슬라이드 준비 시작
  React.useEffect(() => {
    if (slides.length > 0 && !hasPreparedRef.current) {
      prepareAllAudios()
    }
  }, [slides.length, prepareAllAudios])

  // 다음 슬라이드로 이동
  const goToNextSlide = useCallback(() => {
    console.log(`[VideoOverview] goToNextSlide called. current: ${currentSlide}, total: ${enrichedSlides.length}`)
    if (currentSlide < enrichedSlides.length - 1) {
      setCurrentSlide(prev => prev + 1)
    } else {
      console.log('[VideoOverview] Presentation ended')
      setIsPlaying(false)
    }
  }, [currentSlide, enrichedSlides.length])

  // 재생 시작 (이미 준비가 완료되었거나 진행 중일 때만 시작)
  const startPresentation = () => {
    if (isPreparing) return // 준비 중이면 대기
    console.log('[VideoOverview] Starting presentation')
    setCurrentSlide(0)
    setIsPlaying(true)
  }

  // 재생 중지
  const stopPresentation = () => {
    console.log('[VideoOverview] Stopping presentation')
    setIsPlaying(false)
    if (audioRef.current) {
      audioRef.current.pause()
    }
    // 타이머 정리
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }
  }

  // 오디오 재생 완료 시 다음 슬라이드
  const handleAudioEnd = useCallback(() => {
    console.log(`[VideoOverview] Audio ended for slide ${currentSlide + 1}`)
    goToNextSlide()
  }, [goToNextSlide, currentSlide])

  // 슬라이드 변경 시 해당 오디오 재생 또는 타이머로 자동 전환
  useEffect(() => {
    // 재생 중이 아니면 무시
    if (!isPlaying) return

    // 이전 타이머 정리
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }

    const slideData = enrichedSlides[currentSlide]
    console.log(`[VideoOverview] Slide ${currentSlide + 1} playing. audioUrl: ${slideData?.audioUrl ? 'YES' : 'NO'}`)

    if (slideData?.audioUrl && audioRef.current) {
      // 오디오가 있으면 재생
      console.log(`[VideoOverview] Playing audio for slide ${currentSlide + 1}`)
      audioRef.current.src = slideData.audioUrl
      audioRef.current.play().catch(err => {
        console.error('[VideoOverview] Audio play error:', err)
        // 오디오 재생 실패 시 3초 후 다음으로
        autoAdvanceTimerRef.current = setTimeout(() => {
          console.log(`[VideoOverview] Auto-advancing after audio error for slide ${currentSlide + 1}`)
          goToNextSlide()
        }, 3000)
      })
    } else {
      // 오디오가 없으면 4초 후 자동 전환
      console.log(`[VideoOverview] No audio for slide ${currentSlide + 1}, auto-advancing in 4s`)
      autoAdvanceTimerRef.current = setTimeout(() => {
        console.log(`[VideoOverview] Auto-advancing for slide ${currentSlide + 1}`)
        goToNextSlide()
      }, 4000)
    }

    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current)
        autoAdvanceTimerRef.current = null
      }
    }
  }, [currentSlide, isPlaying, enrichedSlides, goToNextSlide])

  // MP4 내보내기 함수
  const exportToVideo = useCallback(async () => {
    if (enrichedSlides.length === 0 || isExporting) return

    setIsExporting(true)
    setExportProgress(0)

    try {
      // 1. Canvas 생성 (1920x1080)
      const canvas = document.createElement('canvas')
      canvas.width = 1920
      canvas.height = 1080
      const ctx = canvas.getContext('2d')!

      // 2. MediaRecorder 설정
      const stream = canvas.captureStream(30)

      // 3. 오디오 컨텍스트 및 오디오 스트림 수집
      const audioContext = new AudioContext()
      const audioDestination = audioContext.createMediaStreamDestination()

      // 4. 모든 오디오를 하나로 합치기
      const audioBuffers: AudioBuffer[] = []
      for (const slide of enrichedSlides) {
        if (slide.audioUrl) {
          try {
            const response = await fetch(slide.audioUrl)
            const arrayBuffer = await response.arrayBuffer()
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
            audioBuffers.push(audioBuffer)
          } catch (err) {
            console.error('Audio decode error:', err)
            // 빈 오디오 버퍼 추가 (4초)
            const emptyBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 4, audioContext.sampleRate)
            audioBuffers.push(emptyBuffer)
          }
        } else {
          // 오디오 없으면 4초 빈 버퍼
          const emptyBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 4, audioContext.sampleRate)
          audioBuffers.push(emptyBuffer)
        }
        setExportProgress(prev => Math.min(prev + 5, 30))
      }

      // 5. 비디오 + 오디오 합성
      const combinedStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks()
      ])

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 5000000
      })

      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      // 6. 슬라이드별 렌더링 + 오디오 재생
      mediaRecorder.start()

      for (let i = 0; i < enrichedSlides.length; i++) {
        const slide = enrichedSlides[i]
        const audioBuffer = audioBuffers[i]

        // 슬라이드 렌더링
        await renderSlideToCanvas(ctx, slide, isDark, themeColor)

        // 오디오 재생
        const source = audioContext.createBufferSource()
        source.buffer = audioBuffer
        source.connect(audioDestination)
        source.start()

        // 오디오 길이만큼 대기
        await new Promise(resolve => setTimeout(resolve, audioBuffer.duration * 1000))

        setExportProgress(30 + Math.round((i / enrichedSlides.length) * 60))
      }

      mediaRecorder.stop()

      // 7. 완료 대기 및 다운로드
      await new Promise<void>(resolve => {
        mediaRecorder.onstop = () => resolve()
      })

      const blob = new Blob(chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)

      // 다운로드
      const a = document.createElement('a')
      a.href = url
      a.download = `presentation-${Date.now()}.webm`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setExportProgress(100)
      console.log('[VideoOverview] Export completed')

    } catch (error) {
      console.error('[VideoOverview] Export error:', error)
      alert('내보내기 중 오류가 발생했습니다')
    } finally {
      setIsExporting(false)
      setExportProgress(0)
    }
  }, [enrichedSlides, isExporting, isDark, themeColor])

  // 슬라이드를 Canvas에 렌더링하는 헬퍼 함수
  const renderSlideToCanvas = async (
    ctx: CanvasRenderingContext2D,
    slide: IRSlide,
    isDark: boolean,
    themeColor: string
  ) => {
    const width = 1920
    const height = 1080

    // 배경
    if (slide.imageUrl) {
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = reject
          img.src = slide.imageUrl!
        })
        ctx.drawImage(img, 0, 0, width, height)
        // 오버레이
        const gradient = ctx.createLinearGradient(0, height * 0.5, 0, height)
        gradient.addColorStop(0, 'rgba(0,0,0,0)')
        gradient.addColorStop(1, 'rgba(0,0,0,0.8)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)
      } catch {
        // 이미지 로드 실패 시 기본 배경
        ctx.fillStyle = isDark ? '#1e1b4b' : '#3b82f6'
        ctx.fillRect(0, 0, width, height)
      }
    } else {
      // 그라디언트 배경
      const gradient = ctx.createLinearGradient(0, 0, width, height)
      if (slide.number === 1) {
        gradient.addColorStop(0, isDark ? '#1e1b4b' : '#3b82f6')
        gradient.addColorStop(0.5, isDark ? '#312e81' : '#6366f1')
        gradient.addColorStop(1, isDark ? '#4338ca' : '#8b5cf6')
      } else {
        gradient.addColorStop(0, isDark ? '#1f2937' : '#f8fafc')
        gradient.addColorStop(1, isDark ? '#111827' : '#e2e8f0')
      }
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
    }

    // 슬라이드 번호
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = 'bold 24px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${slide.number}`, width - 60, 60)

    // 제목
    ctx.fillStyle = 'white'
    ctx.font = 'bold 64px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (slide.number === 1) {
      ctx.fillText(slide.title, width / 2, height / 2)
    } else {
      ctx.textAlign = 'left'
      ctx.fillText(slide.title, 100, 150)

      // 불렛 포인트
      if (slide.bulletPoints && slide.bulletPoints.length > 0) {
        ctx.font = '36px sans-serif'
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        slide.bulletPoints.forEach((point, idx) => {
          const y = 280 + idx * 80
          ctx.beginPath()
          ctx.arc(120, y - 10, 8, 0, Math.PI * 2)
          ctx.fillStyle = themeColor
          ctx.fill()
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.fillText(point, 150, y)
        })
      }
    }
  }

  // 오디오 시간 업데이트
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => setDuration(audio.duration)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
    }
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // === Podcast Mode Helper Functions ===
  const togglePodcastPlay = useCallback(() => {
    if (podcastAudioRef.current) {
      if (isPlaying) {
        podcastAudioRef.current.pause()
      } else {
        podcastAudioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }, [isPlaying])

  const handlePodcastSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (podcastAudioRef.current) {
      podcastAudioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }, [])

  const skipPodcast = useCallback((seconds: number) => {
    if (podcastAudioRef.current) {
      podcastAudioRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds))
    }
  }, [duration, currentTime])

  const changePodcastSpeed = useCallback(() => {
    const speeds = [1, 1.25, 1.5, 1.75, 2]
    const nextIndex = (speeds.indexOf(playbackRate) + 1) % speeds.length
    const newRate = speeds[nextIndex]
    setPlaybackRate(newRate)
    if (podcastAudioRef.current) {
      podcastAudioRef.current.playbackRate = newRate
    }
  }, [playbackRate])

  // === Podcast Mode UI (Gemini 2.5 TTS Multi-Speaker) ===
  if (isPodcastMode && podcastAudioUrl && dialogueLines) {
    return (
      <div className="h-full flex flex-col">
        {/* Podcast Audio Element */}
        <audio
          ref={podcastAudioRef}
          src={podcastAudioUrl}
          onTimeUpdate={() => podcastAudioRef.current && setCurrentTime(podcastAudioRef.current.currentTime)}
          onLoadedMetadata={() => podcastAudioRef.current && setDuration(podcastAudioRef.current.duration)}
          onEnded={() => setIsPlaying(false)}
        />

        {/* Podcast Visual - 진행자 아바타 */}
        <div className={cn(
          "rounded-xl mb-4 p-6",
          isDark ? "bg-gradient-to-br from-purple-900/50 to-pink-900/30" : "bg-gradient-to-br from-purple-100 to-pink-50"
        )}>
          <div className="flex items-center justify-center gap-8 mb-4">
            {/* 민수 (남성) */}
            <div className="text-center">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-2 shadow-lg transition-transform",
                currentDialogueIndex < dialogueLines.length && dialogueLines[currentDialogueIndex]?.speaker === '민수'
                  ? "scale-110 ring-4 ring-purple-500/50"
                  : ""
              )}
              style={{ backgroundColor: '#6366F1' }}
              >
                🎙️
              </div>
              <span className={cn(
                "text-sm font-medium",
                isDark ? "text-zinc-300" : "text-gray-700"
              )}>민수</span>
            </div>

            {/* 지은 (여성) */}
            <div className="text-center">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-2 shadow-lg transition-transform",
                currentDialogueIndex < dialogueLines.length && dialogueLines[currentDialogueIndex]?.speaker === '지은'
                  ? "scale-110 ring-4 ring-pink-500/50"
                  : ""
              )}
              style={{ backgroundColor: '#EC4899' }}
              >
                🎤
              </div>
              <span className={cn(
                "text-sm font-medium",
                isDark ? "text-zinc-300" : "text-gray-700"
              )}>지은</span>
            </div>
          </div>

          {/* 팟캐스트 제목 */}
          <div className="text-center">
            <h3 className={cn(
              "text-lg font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              🎧 테크 톡톡
            </h3>
            <p className={cn(
              "text-sm",
              isDark ? "text-zinc-400" : "text-gray-500"
            )}>
              AI 팟캐스트
            </p>
          </div>
        </div>

        {/* 대화 내용 스크롤 영역 */}
        <div
          ref={dialogueContainerRef}
          className={cn(
            "flex-1 min-h-0 overflow-y-auto rounded-xl p-4 space-y-3 mb-4",
            isDark ? "bg-white/5" : "bg-gray-50"
          )}
        >
          {dialogueLines.map((line, idx) => {
            const isMinsoo = line.speaker === '민수'
            const isActive = idx === currentDialogueIndex

            return (
              <div
                key={idx}
                className={cn(
                  "flex gap-3 transition-all",
                  isActive ? "scale-[1.02]" : "opacity-70"
                )}
              >
                {/* 스피커 뱃지 */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0",
                    isActive && "ring-2 ring-offset-2",
                    isDark ? "ring-offset-zinc-900" : "ring-offset-white"
                  )}
                  style={{
                    backgroundColor: isMinsoo ? '#6366F1' : '#EC4899',
                    '--tw-ring-color': isMinsoo ? '#6366F1' : '#EC4899'
                  } as React.CSSProperties}
                >
                  {isMinsoo ? '민' : '지'}
                </div>

                {/* 대사 */}
                <div className={cn(
                  "flex-1 p-3 rounded-xl text-sm",
                  isMinsoo
                    ? isDark ? "bg-purple-900/30" : "bg-purple-50"
                    : isDark ? "bg-pink-900/30" : "bg-pink-50",
                  isActive && "font-medium"
                )}>
                  <span className={cn(
                    "font-semibold mr-2",
                    isMinsoo
                      ? isDark ? "text-purple-300" : "text-purple-600"
                      : isDark ? "text-pink-300" : "text-pink-600"
                  )}>
                    {line.speaker}:
                  </span>
                  <span className={isDark ? "text-zinc-200" : "text-gray-700"}>
                    {line.text}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handlePodcastSeek}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${themeColor} ${(currentTime / duration) * 100}%, ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'} 0%)`
            }}
          />
          <div className="flex justify-between mt-1">
            <span className={cn("text-xs font-mono", isDark ? "text-zinc-500" : "text-gray-500")}>
              {formatTime(currentTime)}
            </span>
            <span className={cn("text-xs font-mono", isDark ? "text-zinc-500" : "text-gray-500")}>
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={changePodcastSpeed}
            className={cn(
              "px-2 py-1 rounded text-xs font-bold min-w-[40px]",
              isDark ? "bg-white/10 text-white" : "bg-gray-200 text-gray-700"
            )}
          >
            {playbackRate}X
          </button>

          <button
            onClick={() => skipPodcast(-15)}
            className={cn(
              "p-2 rounded-full transition-colors",
              isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-200 text-gray-500"
            )}
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={togglePodcastPlay}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105"
            style={{ backgroundColor: themeColor }}
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
          </button>

          <button
            onClick={() => skipPodcast(15)}
            className={cn(
              "p-2 rounded-full transition-colors",
              isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-200 text-gray-500"
            )}
          >
            <SkipForward className="w-5 h-5" />
          </button>

          <button className={cn(
            "p-2 rounded-full transition-colors",
            isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-200 text-gray-500"
          )}>
            <Volume2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    )
  }

  // === Slide Mode UI (기존 방식) ===
  return (
    <div className="h-full flex flex-col">
      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnd}
        onError={(e) => {
          console.error('[VideoOverview] Audio error:', e)
          // 오디오 에러 시 다음 슬라이드로
          if (isPlaying) {
            goToNextSlide()
          }
        }}
      />

      {/* 슬라이드 비주얼 */}
      <div className="flex-1 min-h-0 mb-4">
        {isPreparing ? (
          // 준비 중 화면
          <div className={cn(
            "h-full rounded-xl flex flex-col items-center justify-center gap-4",
            isDark ? "bg-zinc-900" : "bg-gray-100"
          )}>
            <Loader2 className={cn("w-10 h-10 animate-spin", isDark ? "text-white" : "text-gray-600")} />
            <div className="text-center">
              <p className={cn("font-medium mb-2", isDark ? "text-white" : "text-gray-800")}>
                슬라이드 준비 중...
              </p>
              <p className={cn("text-sm", isDark ? "text-zinc-400" : "text-gray-500")}>
                {Math.round(prepareProgress)}% 완료
              </p>
            </div>
            <div className={cn("w-48 h-1.5 rounded-full overflow-hidden", isDark ? "bg-zinc-800" : "bg-gray-200")}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${prepareProgress}%`, backgroundColor: themeColor }}
              />
            </div>
          </div>
        ) : currentSlideData ? (
          <SlideVisual
            slide={currentSlideData}
            isDark={isDark}
            themeColor={themeColor}
            isActive={isPlaying}
            totalSlides={enrichedSlides.length}
          />
        ) : (
          <div className={cn(
            "h-full rounded-xl flex items-center justify-center",
            isDark ? "bg-zinc-900 text-zinc-400" : "bg-gray-100 text-gray-500"
          )}>
            슬라이드 없음
          </div>
        )}
      </div>

      {/* 나레이션 텍스트 */}
      <div className={cn(
        "p-3 rounded-lg mb-4 max-h-24 overflow-y-auto",
        isDark ? "bg-white/5" : "bg-gray-50"
      )}>
        <p className={cn(
          "text-sm leading-relaxed",
          isDark ? "text-zinc-300" : "text-gray-700"
        )}>
          {currentSlideData?.narration || '나레이션 없음'}
        </p>
      </div>

      {/* 진행률 바 */}
      {isPlaying && duration > 0 && (
        <div className="mb-3">
          <div className={cn(
            "h-1 rounded-full overflow-hidden",
            isDark ? "bg-white/10" : "bg-gray-200"
          )}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(currentTime / duration) * 100}%`,
                backgroundColor: themeColor
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className={cn("text-xs", isDark ? "text-zinc-500" : "text-gray-500")}>
              {formatTime(currentTime)}
            </span>
            <span className={cn("text-xs", isDark ? "text-zinc-500" : "text-gray-500")}>
              {formatTime(duration)}
            </span>
          </div>
        </div>
      )}

      {/* 컨트롤 */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <button
          onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
          disabled={currentSlide === 0 || isPreparing}
          className={cn(
            "p-2 rounded-lg transition-colors disabled:opacity-30",
            isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-100 text-gray-500"
          )}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={isPlaying ? stopPresentation : startPresentation}
          disabled={isPreparing}
          className={cn(
            "px-6 py-2.5 rounded-xl flex items-center gap-2 font-medium transition-all",
            isPlaying
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "text-white"
          )}
          style={!isPlaying ? { backgroundColor: themeColor } : undefined}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4" />
              <span>중지</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>발표 시작</span>
            </>
          )}
        </button>

        <button
          onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
          disabled={currentSlide === slides.length - 1 || isPreparing}
          className={cn(
            "p-2 rounded-lg transition-colors disabled:opacity-30",
            isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-100 text-gray-500"
          )}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 내보내기 진행률 - 상단 헤더의 다운로드 버튼 사용 시 표시 */}
      {isExporting && (
        <div className="mb-3">
          <div className={cn("h-1.5 rounded-full overflow-hidden", isDark ? "bg-zinc-800" : "bg-gray-200")}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${exportProgress}%`, backgroundColor: themeColor }}
            />
          </div>
          <p className={cn(
            "text-xs text-center mt-1",
            isDark ? "text-zinc-400" : "text-gray-500"
          )}>
            내보내는 중... {exportProgress}%
          </p>
        </div>
      )}

      {/* 슬라이드 썸네일 - 16:9 비율 유지 */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {enrichedSlides.map((slide, idx) => {
          const isSelected = idx === currentSlide
          const layout = slide.layout || determineSlideLayout(slide, enrichedSlides.length)

          return (
            <button
              key={idx}
              onClick={() => !isPreparing && setCurrentSlide(idx)}
              disabled={isPreparing}
              className={cn(
                "flex-shrink-0 w-20 aspect-video rounded-lg overflow-hidden transition-all",
                isSelected
                  ? "ring-2 scale-105 shadow-lg"
                  : "opacity-60 hover:opacity-100 hover:scale-102"
              )}
              style={{
                '--tw-ring-color': isSelected ? themeColor : 'transparent',
                boxShadow: isSelected ? `0 4px 12px ${themeColor}33` : undefined
              } as React.CSSProperties}
            >
              {slide.imageUrl ? (
                <div className="relative w-full h-full">
                  <img
                    src={slide.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {/* 썸네일 오버레이 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <span className="absolute bottom-0.5 right-1 text-[8px] font-bold text-white/80">
                    {slide.number}
                  </span>
                </div>
              ) : (
                <div
                  className={cn(
                    "w-full h-full flex flex-col items-center justify-center relative",
                    layout === 'title'
                      ? "bg-gradient-to-br from-indigo-600 to-purple-700"
                      : isDark ? "bg-zinc-800" : "bg-gray-100"
                  )}
                >
                  {/* 미니 레이아웃 프리뷰 */}
                  {layout === 'title' ? (
                    <>
                      <div className="w-4 h-0.5 rounded-full bg-white/40 mb-1" />
                      <div className="w-8 h-1 rounded bg-white/70" />
                    </>
                  ) : layout === 'image-left' || layout === 'image-right' ? (
                    <div className={cn(
                      "flex w-full h-full",
                      layout === 'image-right' && "flex-row-reverse"
                    )}>
                      <div
                        className="w-[45%] h-full"
                        style={{ backgroundColor: `${themeColor}44` }}
                      />
                      <div className="w-[55%] h-full p-1 flex flex-col gap-0.5">
                        <div className={cn(
                          "w-6 h-0.5 rounded",
                          isDark ? "bg-white/40" : "bg-gray-400"
                        )} />
                        <div className={cn(
                          "w-4 h-0.5 rounded",
                          isDark ? "bg-white/20" : "bg-gray-300"
                        )} />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full p-1 flex flex-col">
                      <div
                        className="w-full h-0.5 rounded-t"
                        style={{ backgroundColor: themeColor }}
                      />
                      <div className="flex-1 flex flex-col gap-0.5 pt-1">
                        <div className={cn(
                          "w-6 h-0.5 rounded",
                          isDark ? "bg-white/40" : "bg-gray-400"
                        )} />
                        <div className={cn(
                          "w-5 h-0.5 rounded",
                          isDark ? "bg-white/20" : "bg-gray-300"
                        )} />
                      </div>
                    </div>
                  )}
                  <span className={cn(
                    "absolute bottom-0.5 right-1 text-[8px] font-bold",
                    layout === 'title' ? "text-white/60" : isDark ? "text-zinc-500" : "text-gray-400"
                  )}>
                    {slide.number}
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Placeholder for removed code
function VideoOverviewCopyButton({
  content,
  isDark
}: {
  content: string
  isDark: boolean
}) {
  const [copied, setCopied] = useState(false)

  const copyAll = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copyAll}
      className={cn(
        "w-full py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors",
        isDark ? "bg-white/10 hover:bg-white/15 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
      )}
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? '복사됨' : '스크립트 복사'}
    </button>
  )
}

// Main Preview Panel Component with Resizable
export default function StudioPreviewPanel({
  content,
  isDark,
  themeColor,
  onClose,
  onFeedback,
  width,
  onResize,
  minWidth = 320,
  maxWidth = 800
}: StudioPreviewPanelProps) {
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const newWidth = window.innerWidth - e.clientX
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        onResize(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, onResize, minWidth, maxWidth])

  if (!content) return null

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={cn(
        "h-full flex flex-col relative flex-shrink-0",
        isDark ? "bg-[#0f0f1a]" : "bg-white"
      )}
      style={{ width }}
    >
      {/* Resize Handle - 왼쪽 테두리에 항상 표시 */}
      <div
        ref={resizeRef}
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize group z-50",
          "transition-all duration-150",
          isResizing
            ? "w-1 bg-blue-500"
            : isDark
              ? "bg-white/20 hover:w-1.5 hover:bg-blue-400"
              : "bg-gray-300 hover:w-1.5 hover:bg-blue-500"
        )}
      >
        {/* 클릭 가능 영역 확장 */}
        <div className="absolute -left-3 -right-3 top-0 bottom-0 cursor-col-resize" />

        {/* 중앙 그립 아이콘 */}
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 -left-2.5 w-6 h-20 rounded-lg",
          "flex items-center justify-center transition-all duration-150",
          isResizing
            ? "opacity-100 scale-100"
            : "opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100",
          isDark ? "bg-zinc-800 border border-white/20" : "bg-white border border-gray-300 shadow-md"
        )}>
          <GripVertical className={cn(
            "w-4 h-4",
            isResizing ? "text-blue-400" : isDark ? "text-zinc-400" : "text-gray-500"
          )} />
        </div>
      </div>

      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 border-b flex-shrink-0",
        isDark ? "border-white/10" : "border-gray-200"
      )}>
        <div className="flex items-center gap-2 min-w-0">
          <h3 className={cn(
            "font-semibold truncate",
            isDark ? "text-white" : "text-gray-900"
          )}>
            {content.title}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button className={cn(
            "p-2 rounded-lg transition-colors",
            isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-100 text-gray-500"
          )}>
            <Share2 className="w-4 h-4" />
          </button>
          <button className={cn(
            "p-2 rounded-lg transition-colors",
            isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-100 text-gray-500"
          )}>
            <Download className="w-4 h-4" />
          </button>
          <button className={cn(
            "p-2 rounded-lg transition-colors",
            isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-100 text-gray-500"
          )}>
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className={cn(
              "p-2 rounded-lg transition-colors",
              isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-100 text-gray-500"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subtitle */}
      {content.subtitle && (
        <div className={cn("px-4 py-2 border-b", isDark ? "border-white/10" : "border-gray-200")}>
          <p className={cn("text-sm", isDark ? "text-zinc-400" : "text-gray-500")}>
            {content.subtitle}
          </p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4">
        {content.type === 'audio-overview' && content.audioUrl && (
          <AudioPlayer
            audioUrl={content.audioUrl}
            duration={content.duration}
            isDark={isDark}
            themeColor={themeColor}
          />
        )}

        {content.type === 'slides' && (
          <SlidesPreview
            slides={content.slides}
            content={content.content}
            isDark={isDark}
            themeColor={themeColor}
          />
        )}

        {content.type === 'video-overview' && (
          <VideoOverviewPreview
            content={content.content}
            isDark={isDark}
            themeColor={themeColor}
            sourceSlideImages={content.slideImages}
            preloadedSlides={content.slides}
            podcastAudioUrl={content.podcastAudioUrl}
            dialogueLines={content.dialogueLines}
          />
        )}

        {/* Generic content for other types */}
        {!['audio-overview', 'slides', 'video-overview'].includes(content.type) && (
          <div className={cn(
            "h-full overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap",
            isDark ? "text-zinc-300" : "text-gray-700"
          )}>
            {content.content}
          </div>
        )}
      </div>

      {/* Feedback */}
      {onFeedback && (
        <div className={cn(
          "px-4 py-3 border-t flex items-center justify-center gap-4 flex-shrink-0",
          isDark ? "border-white/10" : "border-gray-200"
        )}>
          <button
            onClick={() => onFeedback('positive')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              isDark
                ? "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
                : "bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            )}
          >
            <ThumbsUp className="w-4 h-4" />
            유용한 콘텐츠
          </button>
          <button
            onClick={() => onFeedback('negative')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              isDark
                ? "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
                : "bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            )}
          >
            <ThumbsDown className="w-4 h-4" />
            불만족스러운 콘텐츠
          </button>
        </div>
      )}
    </motion.div>
  )
}
