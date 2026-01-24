"use client"

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Loader2, Play, Pencil } from 'lucide-react'
import type { StudioContent } from './StudioPreviewPanel'

// Minimal custom SVG icons - clean line style
const MinimalIcons = {
  audio: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  ),
  video: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
    </svg>
  ),
  mindmap: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" />
      <circle cx="4" cy="6" r="2" />
      <circle cx="20" cy="6" r="2" />
      <circle cx="4" cy="18" r="2" />
      <circle cx="20" cy="18" r="2" />
      <path d="M10 12H6M14 12h4M10.5 10.5L6 8M13.5 10.5L18 8M10.5 13.5L6 16M13.5 13.5L18 16" />
    </svg>
  ),
  report: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="12" y2="15" />
    </svg>
  ),
  flashcard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="16" height="12" rx="2" />
      <rect x="6" y="4" width="16" height="12" rx="2" />
    </svg>
  ),
  quiz: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9 9a3 3 0 1 1 3.5 2.95c-.32.11-.5.4-.5.73V14" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  ),
  infographic: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="14" width="4" height="7" rx="1" />
      <rect x="10" y="9" width="4" height="12" rx="1" />
      <rect x="17" y="4" width="4" height="17" rx="1" />
    </svg>
  ),
  slides: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <line x1="12" y1="18" x2="12" y2="21" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </svg>
  ),
  table: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  )
}

// Card config with minimal icons
const STUDIO_CARDS = [
  {
    id: 'audio-overview',
    type: 'audio-overview' as const,
    icon: MinimalIcons.audio,
    label: 'AI 오디오 오버뷰',
    color: '#8B5CF6'
  },
  {
    id: 'video-overview',
    type: 'video-overview' as const,
    icon: MinimalIcons.video,
    label: '동영상 개요',
    color: '#EC4899'
  },
  {
    id: 'mindmap',
    type: 'mindmap' as const,
    icon: MinimalIcons.mindmap,
    label: '마인드맵',
    color: '#10B981'
  },
  {
    id: 'report',
    type: 'report' as const,
    icon: MinimalIcons.report,
    label: '보고서',
    color: '#3B82F6'
  },
  {
    id: 'flashcard',
    type: 'flashcard' as const,
    icon: MinimalIcons.flashcard,
    label: '플래시카드',
    color: '#F59E0B'
  },
  {
    id: 'quiz',
    type: 'quiz' as const,
    icon: MinimalIcons.quiz,
    label: '퀴즈',
    color: '#8B5CF6'
  },
  {
    id: 'infographic',
    type: 'infographic' as const,
    icon: MinimalIcons.infographic,
    label: '인포그래픽',
    color: '#F97316'
  },
  {
    id: 'slides',
    type: 'slides' as const,
    icon: MinimalIcons.slides,
    label: '슬라이드 자료',
    color: '#0EA5E9'
  },
  {
    id: 'data-table',
    type: 'data-table' as const,
    icon: MinimalIcons.table,
    label: '데이터 표',
    color: '#64748B'
  }
]

interface StudioCardGridProps {
  contents: StudioContent[]
  generatingTypes: string[]
  isDark: boolean
  themeColor: string
  onGenerate: (type: StudioContent['type']) => void
  onSelect: (content: StudioContent) => void
  disabled?: boolean
}

export default function StudioCardGrid({
  contents,
  generatingTypes,
  isDark,
  themeColor,
  onGenerate,
  onSelect,
  disabled = false
}: StudioCardGridProps) {
  const [hoveredCard, setHoveredCard] = React.useState<string | null>(null)

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {STUDIO_CARDS.map((card, idx) => {
        const Icon = card.icon
        // 같은 타입의 생성된 콘텐츠들 (여러 개 가능)
        const existingContents = contents.filter(c => c.type === card.type && c.status === 'ready')
        const isGenerating = generatingTypes.includes(card.type)
        const hasContent = existingContents.length > 0
        const contentCount = existingContents.length
        const isHovered = hoveredCard === card.id

        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            className="relative"
            onMouseEnter={() => setHoveredCard(card.id)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <button
              onClick={() => {
                // 항상 새로 생성 (이미 있어도 추가 생성)
                if (!isGenerating && !disabled) {
                  onGenerate(card.type)
                }
              }}
              disabled={disabled && !hasContent}
              className={cn(
                "relative w-full p-3 rounded-xl text-left transition-all",
                "border",
                isDark
                  ? "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50"
                  : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm",
                (disabled && !hasContent) && "opacity-50 cursor-not-allowed"
              )}
            >
              {/* Icon */}
              <div className="flex items-start justify-between mb-2.5">
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                    hasContent
                      ? ""
                      : isDark ? "bg-zinc-800" : "bg-gray-100"
                  )}
                  style={hasContent ? { backgroundColor: `${card.color}20` } : undefined}
                >
                  <div
                    className="w-5 h-5"
                    style={{ color: hasContent ? card.color : isDark ? '#71717a' : '#9ca3af' }}
                  >
                    <Icon />
                  </div>
                </div>

                {/* 생성된 개수 표시 */}
                {contentCount > 0 && (
                  <div
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: card.color }}
                  >
                    {contentCount}
                  </div>
                )}
              </div>

              {/* Label */}
              <span className={cn(
                "text-[13px] font-medium block leading-tight",
                isDark ? "text-zinc-300" : "text-gray-700"
              )}>
                {card.label}
              </span>

              {/* Generating indicator */}
              {isGenerating && (
                <div className="absolute bottom-2.5 right-2.5">
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    style={{ color: card.color }}
                  />
                </div>
              )}
            </button>

            {/* 호버 시 추가 생성 버튼 (이미 콘텐츠가 있을 때) */}
            {hasContent && isHovered && !isGenerating && !disabled && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={(e) => {
                  e.stopPropagation()
                  onGenerate(card.type)
                }}
                className={cn(
                  "absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center",
                  "shadow-lg transition-transform hover:scale-110 text-white text-sm font-bold",
                  "z-10"
                )}
                style={{ backgroundColor: card.color }}
                title="추가 생성"
              >
                +
              </motion.button>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

// Notebook List Item Component
interface NotebookItemProps {
  content: StudioContent
  isDark: boolean
  themeColor: string
  onSelect: () => void
  onPlay?: () => void
}

export function NotebookItem({
  content,
  isDark,
  onSelect,
  onPlay
}: NotebookItemProps) {
  const iconMap: Record<string, () => JSX.Element> = {
    'audio-overview': MinimalIcons.audio,
    'video-overview': MinimalIcons.video,
    'slides': MinimalIcons.slides,
    'mindmap': MinimalIcons.mindmap,
    'report': MinimalIcons.report,
    'flashcard': MinimalIcons.flashcard,
    'quiz': MinimalIcons.quiz,
    'infographic': MinimalIcons.infographic,
    'data-table': MinimalIcons.table
  }

  const colorMap: Record<string, string> = {
    'audio-overview': '#8B5CF6',
    'video-overview': '#EC4899',
    'mindmap': '#10B981',
    'report': '#3B82F6',
    'flashcard': '#F59E0B',
    'quiz': '#8B5CF6',
    'infographic': '#F97316',
    'slides': '#0EA5E9',
    'data-table': '#64748B'
  }

  const Icon = iconMap[content.type] || MinimalIcons.report
  const color = colorMap[content.type] || '#64748B'
  const isPlayable = content.type === 'audio-overview' || content.type === 'video-overview'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "group flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all",
        isDark
          ? "hover:bg-zinc-800/50"
          : "hover:bg-gray-50"
      )}
      onClick={onSelect}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <div className="w-4 h-4" style={{ color }}>
          <Icon />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className={cn(
          "text-sm font-medium truncate",
          isDark ? "text-zinc-200" : "text-gray-800"
        )}>
          {content.title}
        </h4>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-xs",
            isDark ? "text-zinc-500" : "text-gray-500"
          )}>
            {content.subtitle || `소스 ${content.sourceCount || 0}개`}
          </span>
          {content.duration && (
            <>
              <span className={cn("text-[10px]", isDark ? "text-zinc-600" : "text-gray-400")}>·</span>
              <span className={cn("text-xs", isDark ? "text-zinc-500" : "text-gray-500")}>
                {content.duration}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Play button for audio/video */}
      {isPlayable && onPlay && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onPlay()
          }}
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100",
            isDark ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" : "bg-gray-100 hover:bg-gray-200 text-gray-600"
          )}
        >
          <Play className="w-3.5 h-3.5 ml-0.5" />
        </button>
      )}

      {/* More options */}
      <button className={cn(
        "p-1 rounded opacity-0 group-hover:opacity-100 transition-all",
        isDark ? "hover:bg-zinc-800 text-zinc-500" : "hover:bg-gray-100 text-gray-400"
      )}>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
          <circle cx="8" cy="3" r="1" />
          <circle cx="8" cy="8" r="1" />
          <circle cx="8" cy="13" r="1" />
        </svg>
      </button>
    </motion.div>
  )
}
