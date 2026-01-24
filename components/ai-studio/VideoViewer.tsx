"use client"

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  ChevronRight,
  X,
  Copy,
  Check,
  Video,
  Clock,
  Play
} from 'lucide-react'

interface VideoSection {
  number: number
  title: string
  timeStart: string
  timeEnd: string
  script: string
  keyPoint?: string
}

interface VideoViewerProps {
  content: string
  isDark: boolean
  themeColor: string
  onClose: () => void
}

function parseVideoScript(content: string): { sections: VideoSection[], totalDuration: string } {
  const sections: VideoSection[] = []

  // 섹션 패턴들
  const sectionPatterns = [
    /##\s*(?:📍\s*)?(?:섹션\s*\d+[:\s]*|Section\s*\d+[:\s]*)?([^\n]+?)\s*\((\d+:\d+)\s*-\s*(\d+:\d+)\)/gi,
    /##\s*(?:인트로|아웃트로|Intro|Outro)\s*\((\d+:\d+)\s*-\s*(\d+:\d+)\)/gi,
    /##\s*🎬\s*(?:인트로|아웃트로)\s*\((\d+:\d+)\s*-\s*(\d+:\d+)\)/gi,
  ]

  // 전체 섹션 추출
  const sectionBlocks: { title: string; timeStart: string; timeEnd: string; content: string; startIndex: number }[] = []

  // 모든 ## 헤더 찾기
  const headerRegex = /##\s*([^\n]+)/g
  let match
  const headers: { title: string; index: number }[] = []

  while ((match = headerRegex.exec(content)) !== null) {
    headers.push({ title: match[1], index: match.index })
  }

  // 각 헤더에서 시간 추출
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]
    const nextIndex = i < headers.length - 1 ? headers[i + 1].index : content.length
    const sectionContent = content.slice(header.index, nextIndex)

    // 시간 추출
    const timeMatch = header.title.match(/\((\d+:\d+)\s*-\s*(\d+:\d+)\)/) ||
                      header.title.match(/\((\d+:\d+)[-~](\d+:\d+)\)/)

    if (timeMatch) {
      const titleClean = header.title
        .replace(/\((\d+:\d+)\s*-\s*(\d+:\d+)\)/, '')
        .replace(/📍|🎬/g, '')
        .replace(/섹션\s*\d+[:\s]*/i, '')
        .replace(/Section\s*\d+[:\s]*/i, '')
        .trim()

      sectionBlocks.push({
        title: titleClean || `섹션 ${sectionBlocks.length + 1}`,
        timeStart: timeMatch[1],
        timeEnd: timeMatch[2],
        content: sectionContent,
        startIndex: header.index
      })
    }
  }

  // 섹션별 스크립트와 핵심 포인트 추출
  for (let i = 0; i < sectionBlocks.length; i++) {
    const block = sectionBlocks[i]

    // 스크립트 추출 (나레이션, 스크립트 등의 키워드 이후 텍스트)
    let script = ''
    const scriptMatch = block.content.match(/(?:\*\*나레이션\*\*|\*\*스크립트\*\*|나레이션:|스크립트:)[:\s]*\n?([\s\S]*?)(?=\n📌|\n🔑|\n##|$)/i)
    if (scriptMatch) {
      script = scriptMatch[1]
        .replace(/^[""]|[""]$/g, '')
        .replace(/\*\*/g, '')
        .trim()
    } else {
      // 나레이션 태그가 없으면 내용 전체에서 추출
      const lines = block.content.split('\n')
      const contentLines = lines.filter(l =>
        !l.startsWith('##') &&
        !l.startsWith('📌') &&
        !l.startsWith('🔑') &&
        !l.startsWith('**화면**') &&
        l.trim()
      )
      script = contentLines.join('\n').trim()
    }

    // 핵심 포인트 추출
    let keyPoint: string | undefined
    const keyPointMatch = block.content.match(/(?:📌|🔑)\s*(?:\*\*)?핵심\s*포인트(?:\*\*)?[:\s]*(.+)/i)
    if (keyPointMatch) {
      keyPoint = keyPointMatch[1].trim()
    }

    sections.push({
      number: i + 1,
      title: block.title,
      timeStart: block.timeStart,
      timeEnd: block.timeEnd,
      script: script.slice(0, 1000), // 긴 스크립트 제한
      keyPoint
    })
  }

  // 파싱 실패시 기본 섹션 생성
  if (sections.length === 0) {
    const paragraphs = content.split('\n\n').filter(p => p.trim())
    sections.push({
      number: 1,
      title: '동영상 개요',
      timeStart: '0:00',
      timeEnd: '5:00',
      script: paragraphs.slice(0, 3).join('\n\n'),
      keyPoint: undefined
    })
  }

  // 총 재생 시간 계산
  const lastSection = sections[sections.length - 1]
  const totalDuration = lastSection?.timeEnd || '5:00'

  return { sections, totalDuration }
}

function timeToSeconds(time: string): number {
  const parts = time.split(':').map(Number)
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

export default function VideoViewer({ content, isDark, themeColor, onClose }: VideoViewerProps) {
  const [currentSection, setCurrentSection] = useState(0)
  const [copied, setCopied] = useState(false)

  const { sections, totalDuration } = parseVideoScript(content)
  const section = sections[currentSection]

  const copyAll = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 키보드 네비게이션
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        if (currentSection < sections.length - 1) {
          setCurrentSection(currentSection + 1)
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentSection > 0) {
          setCurrentSection(currentSection - 1)
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentSection, sections.length, onClose])

  // 타임라인 계산
  const totalSeconds = timeToSeconds(totalDuration)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className={cn(
          "relative flex flex-col overflow-hidden w-full max-w-5xl max-h-[90vh] rounded-2xl",
          isDark ? "bg-zinc-900" : "bg-white"
        )}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between px-4 py-3 border-b",
          isDark ? "border-white/10" : "border-gray-200"
        )}>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${themeColor}20` }}
            >
              <Video className="w-4 h-4" style={{ color: themeColor }} />
            </div>
            <div>
              <h3 className={cn("font-semibold", isDark ? "text-white" : "text-gray-900")}>
                동영상 개요 스크립트
              </h3>
              <p className={cn("text-xs", isDark ? "text-zinc-500" : "text-gray-500")}>
                총 {totalDuration} · {sections.length}개 섹션
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyAll}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-100 text-gray-500"
              )}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy all'}
            </button>
            <button
              onClick={onClose}
              className={cn(
                "p-2 rounded-lg transition-colors",
                isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-100 text-gray-500"
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Timeline Bar */}
        <div className={cn(
          "px-4 py-3 border-b",
          isDark ? "border-white/10 bg-black/20" : "border-gray-200 bg-gray-50"
        )}>
          <div className="relative">
            {/* Timeline track */}
            <div className={cn(
              "h-2 rounded-full overflow-hidden",
              isDark ? "bg-white/10" : "bg-gray-200"
            )}>
              {/* Section markers */}
              {sections.map((sec, idx) => {
                const startPct = (timeToSeconds(sec.timeStart) / totalSeconds) * 100
                const endPct = (timeToSeconds(sec.timeEnd) / totalSeconds) * 100
                const width = endPct - startPct

                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentSection(idx)}
                    className={cn(
                      "absolute top-0 h-full transition-all",
                      idx === currentSection ? "opacity-100" : "opacity-60 hover:opacity-80"
                    )}
                    style={{
                      left: `${startPct}%`,
                      width: `${width}%`,
                      backgroundColor: idx === currentSection ? themeColor : isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'
                    }}
                  />
                )
              })}
            </div>

            {/* Time labels */}
            <div className="flex justify-between mt-2">
              <span className={cn("text-xs", isDark ? "text-zinc-500" : "text-gray-500")}>0:00</span>
              <span className={cn("text-xs", isDark ? "text-zinc-500" : "text-gray-500")}>{totalDuration}</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Section List */}
          <div className={cn(
            "w-64 border-r overflow-y-auto flex-shrink-0",
            isDark ? "border-white/10 bg-black/20" : "border-gray-200 bg-gray-50"
          )}>
            {sections.map((sec, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSection(idx)}
                className={cn(
                  "w-full p-3 text-left transition-all border-b",
                  isDark ? "border-white/5" : "border-gray-100",
                  idx === currentSection
                    ? isDark ? "bg-white/10" : "bg-white shadow-sm"
                    : isDark ? "hover:bg-white/5" : "hover:bg-white/50"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: idx === currentSection ? themeColor : isDark ? '#52525b' : '#9ca3af' }}
                  >
                    {sec.number}
                  </span>
                  <span className={cn(
                    "text-xs font-mono",
                    isDark ? "text-zinc-500" : "text-gray-500"
                  )}>
                    {sec.timeStart}
                  </span>
                </div>
                <h4 className={cn(
                  "text-sm font-medium truncate",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  {sec.title}
                </h4>
              </button>
            ))}
          </div>

          {/* Script Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSection}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 p-6 overflow-y-auto"
              >
                {/* Section Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${themeColor}20` }}
                  >
                    <Play className="w-5 h-5" style={{ color: themeColor }} />
                  </div>
                  <div>
                    <h2 className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                      {section.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className={cn("w-4 h-4", isDark ? "text-zinc-500" : "text-gray-400")} />
                      <span className={cn("text-sm font-mono", isDark ? "text-zinc-400" : "text-gray-500")}>
                        {section.timeStart} - {section.timeEnd}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Script */}
                <div className={cn(
                  "p-4 rounded-xl mb-4",
                  isDark ? "bg-white/5" : "bg-gray-50"
                )}>
                  <h4 className={cn(
                    "text-xs font-semibold uppercase tracking-wider mb-3",
                    isDark ? "text-zinc-500" : "text-gray-500"
                  )}>
                    스크립트
                  </h4>
                  <p className={cn(
                    "text-base leading-relaxed whitespace-pre-wrap",
                    isDark ? "text-zinc-300" : "text-gray-700"
                  )}>
                    {section.script || '스크립트 내용이 없습니다.'}
                  </p>
                </div>

                {/* Key Point */}
                {section.keyPoint && (
                  <div
                    className="p-4 rounded-xl border-l-4"
                    style={{
                      borderColor: themeColor,
                      backgroundColor: `${themeColor}10`
                    }}
                  >
                    <h4 className={cn(
                      "text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2",
                      isDark ? "text-zinc-400" : "text-gray-600"
                    )}>
                      📌 핵심 포인트
                    </h4>
                    <p className={cn(
                      "text-sm font-medium",
                      isDark ? "text-white" : "text-gray-900"
                    )}>
                      {section.keyPoint}
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className={cn(
              "flex items-center justify-between px-6 py-4 border-t",
              isDark ? "border-white/10" : "border-gray-200"
            )}>
              <button
                onClick={() => currentSection > 0 && setCurrentSection(currentSection - 1)}
                disabled={currentSection === 0}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-30",
                  isDark
                    ? "hover:bg-white/10 text-white"
                    : "hover:bg-gray-100 text-gray-900"
                )}
              >
                <ChevronLeft className="w-5 h-5" />
                이전
              </button>

              {/* Section indicator */}
              <div className="flex items-center gap-1.5">
                {sections.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSection(idx)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      idx === currentSection
                        ? "w-6"
                        : isDark ? "bg-white/20 hover:bg-white/40" : "bg-gray-300 hover:bg-gray-400"
                    )}
                    style={idx === currentSection ? { backgroundColor: themeColor } : undefined}
                  />
                ))}
              </div>

              <button
                onClick={() => currentSection < sections.length - 1 && setCurrentSection(currentSection + 1)}
                disabled={currentSection === sections.length - 1}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-30",
                  isDark
                    ? "hover:bg-white/10 text-white"
                    : "hover:bg-gray-100 text-gray-900"
                )}
              >
                다음
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
