'use client'

/**
 * RoadmapPanel - 시간순 타임라인 시각화
 *
 * PRD 12.1 기준 로드맵 기능:
 * - 시간순 이벤트 타임라인
 * - 날짜/주/월 단위 그룹핑
 * - 이벤트 타입별 색상 구분
 * - 사용자 테마 색상 적용
 */

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import {
  Calendar,
  MessageSquare,
  CheckSquare,
  GitBranch,
  Lightbulb,
  Target,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
} from 'lucide-react'

interface RoadmapEvent {
  id: string
  timestamp: number
  type: 'milestone' | 'decision' | 'learning' | 'creation' | 'conversation' | 'task'
  title: string
  description: string
  relatedNodes: string[]
  importance: number
  category: string
}

interface TimeGroup {
  label: string
  startTime: number
  endTime: number
  events: RoadmapEvent[]
}

interface RoadmapData {
  timeline: RoadmapEvent[]
  timeGroups: TimeGroup[]
  dateRange: {
    start: number
    end: number
  }
  meta?: {
    eventCount: number
    nodeCount: number
    granularity: string
  }
}

interface RoadmapPanelProps {
  agentId: string
  isDark?: boolean
  onEventClick?: (event: RoadmapEvent) => void
}

// PRD 기준 이벤트 타입별 색상
const EVENT_TYPE_COLORS: Record<RoadmapEvent['type'], string> = {
  milestone: '#8B5CF6',   // 🟣 보라 - 마일스톤
  decision: '#F8FAFC',    // ⚪ 흰색 - 의사결정
  learning: '#22C55E',    // 🟢 초록 - 학습
  creation: '#3B82F6',    // 🔵 파랑 - 생성
  conversation: '#3B82F6', // 🔵 파랑 - 대화
  task: '#EF4444',        // 🔴 빨강 - 작업
}

// 이벤트 타입 아이콘
const EVENT_TYPE_ICONS: Record<RoadmapEvent['type'], React.ElementType> = {
  milestone: Target,
  decision: GitBranch,
  learning: Lightbulb,
  creation: Calendar,
  conversation: MessageSquare,
  task: CheckSquare,
}

// 이벤트 타입 라벨
const EVENT_TYPE_LABELS: Record<RoadmapEvent['type'], string> = {
  milestone: '마일스톤',
  decision: '의사결정',
  learning: '학습',
  creation: '생성',
  conversation: '대화',
  task: '작업',
}

export function RoadmapPanel({
  agentId,
  isDark = true,
  onEventClick,
}: RoadmapPanelProps) {
  const [data, setData] = useState<RoadmapData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day')
  const [selectedType, setSelectedType] = useState<RoadmapEvent['type'] | null>(null)

  // 사용자 테마 색상
  const accentColor = useThemeStore((s) => s.accentColor)
  const userAccentHex = accentColors.find(c => c.id === accentColor)?.color || '#3b82f6'

  // 데이터 로드
  useEffect(() => {
    const fetchRoadmap = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/agents/${agentId}/brain/roadmap?granularity=${granularity}`)
        if (!res.ok) throw new Error('Failed to fetch roadmap')

        const result = await res.json()
        setData(result)

        // 첫 3개 그룹 자동 펼침
        if (result.timeGroups?.length > 0) {
          const firstGroups = result.timeGroups.slice(-3).map((g: TimeGroup) => g.label)
          setExpandedGroups(new Set(firstGroups))
        }
      } catch (err) {
        console.error('[RoadmapPanel] Error:', err)
        setError('로드맵을 불러오지 못했습니다')
      } finally {
        setIsLoading(false)
      }
    }

    fetchRoadmap()
  }, [agentId, granularity])

  // 그룹 토글
  const toggleGroup = useCallback((label: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(label)) {
        next.delete(label)
      } else {
        next.add(label)
      }
      return next
    })
  }, [])

  // 이벤트 필터링
  const filteredGroups = data?.timeGroups?.map(group => ({
    ...group,
    events: selectedType
      ? group.events.filter(e => e.type === selectedType)
      : group.events
  })).filter(group => group.events.length > 0) || []

  // 시간 포맷
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: userAccentHex }} />
          <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
            로드맵 로딩 중...
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn(
        'h-full flex items-center justify-center text-center p-4',
        isDark ? 'text-red-400' : 'text-red-600'
      )}>
        <div>
          <p className="font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className={cn(
              'mt-2 px-4 py-2 rounded-lg text-sm',
              isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
            )}
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={cn('p-4 border-b', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" style={{ color: userAccentHex }} />
            <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
              로드맵
            </h3>
            {data?.meta && (
              <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                ({data.meta.eventCount}개 이벤트)
              </span>
            )}
          </div>
        </div>

        {/* Granularity Selector */}
        <div className="flex gap-1">
          {(['day', 'week', 'month'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                granularity === g
                  ? 'text-white'
                  : isDark
                    ? 'text-zinc-400 hover:bg-zinc-800'
                    : 'text-zinc-600 hover:bg-zinc-100'
              )}
              style={granularity === g ? { backgroundColor: userAccentHex } : undefined}
            >
              {g === 'day' ? '일별' : g === 'week' ? '주별' : '월별'}
            </button>
          ))}
        </div>

        {/* Type Filter */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <button
            onClick={() => setSelectedType(null)}
            className={cn(
              'px-2 py-1 text-xs rounded-full transition-colors flex items-center gap-1',
              !selectedType
                ? 'text-white'
                : isDark ? 'text-zinc-400 bg-zinc-800' : 'text-zinc-600 bg-zinc-100'
            )}
            style={!selectedType ? { backgroundColor: userAccentHex } : undefined}
          >
            <Filter className="w-3 h-3" />
            전체
          </button>
          {(Object.keys(EVENT_TYPE_LABELS) as RoadmapEvent['type'][]).map((type) => {
            const Icon = EVENT_TYPE_ICONS[type]
            const isSelected = selectedType === type
            return (
              <button
                key={type}
                onClick={() => setSelectedType(isSelected ? null : type)}
                className={cn(
                  'px-2 py-1 text-xs rounded-full transition-colors flex items-center gap-1',
                  isSelected
                    ? 'text-white'
                    : isDark ? 'text-zinc-400 bg-zinc-800' : 'text-zinc-600 bg-zinc-100'
                )}
                style={isSelected ? { backgroundColor: EVENT_TYPE_COLORS[type] } : undefined}
              >
                <Icon className="w-3 h-3" />
                {EVENT_TYPE_LABELS[type]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredGroups.length === 0 ? (
          <div className={cn(
            'text-center py-12',
            isDark ? 'text-zinc-500' : 'text-zinc-400'
          )}>
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">이벤트가 없습니다</p>
            <p className="text-sm mt-1">선택한 기간에 기록된 활동이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGroups.map((group) => (
              <div key={group.label} className="relative">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={cn(
                    'w-full flex items-center gap-2 p-2 rounded-lg transition-colors',
                    isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
                  )}
                >
                  {expandedGroups.has(group.label) ? (
                    <ChevronDown className="w-4 h-4" style={{ color: userAccentHex }} />
                  ) : (
                    <ChevronRight className="w-4 h-4" style={{ color: userAccentHex }} />
                  )}
                  <span className={cn(
                    'font-medium text-sm',
                    isDark ? 'text-zinc-200' : 'text-zinc-800'
                  )}>
                    {group.label}
                  </span>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
                  )}>
                    {group.events.length}
                  </span>
                </button>

                {/* Events */}
                <AnimatePresence>
                  {expandedGroups.has(group.label) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-4 ml-2 border-l-2 space-y-2 py-2" style={{ borderColor: userAccentHex + '40' }}>
                        {group.events.map((event, idx) => {
                          const Icon = EVENT_TYPE_ICONS[event.type]
                          const color = EVENT_TYPE_COLORS[event.type]

                          return (
                            <motion.button
                              key={event.id}
                              initial={{ x: -10, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: idx * 0.05 }}
                              onClick={() => onEventClick?.(event)}
                              className={cn(
                                'w-full text-left p-3 rounded-xl transition-all group',
                                isDark
                                  ? 'bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50'
                                  : 'bg-zinc-50 hover:bg-zinc-100 border border-zinc-200'
                              )}
                            >
                              <div className="flex items-start gap-3">
                                {/* Icon */}
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: color + '20' }}
                                >
                                  <Icon className="w-4 h-4" style={{ color }} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className={cn(
                                      'text-xs',
                                      isDark ? 'text-zinc-500' : 'text-zinc-400'
                                    )}>
                                      {formatTime(event.timestamp)}
                                    </span>
                                    <span
                                      className="text-xs px-1.5 py-0.5 rounded"
                                      style={{ backgroundColor: color + '20', color }}
                                    >
                                      {EVENT_TYPE_LABELS[event.type]}
                                    </span>
                                  </div>
                                  <p className={cn(
                                    'font-medium text-sm truncate',
                                    isDark ? 'text-zinc-200' : 'text-zinc-800'
                                  )}>
                                    {event.title}
                                  </p>
                                  {event.description && (
                                    <p className={cn(
                                      'text-xs mt-1 line-clamp-2',
                                      isDark ? 'text-zinc-500' : 'text-zinc-500'
                                    )}>
                                      {event.description}
                                    </p>
                                  )}
                                </div>

                                {/* Importance indicator */}
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: Math.min(3, Math.ceil(event.importance / 3)) }).map((_, i) => (
                                    <div
                                      key={i}
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{ backgroundColor: userAccentHex }}
                                    />
                                  ))}
                                </div>
                              </div>
                            </motion.button>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Date Range Info */}
      {data?.dateRange && (
        <div className={cn(
          'p-3 border-t text-center text-xs',
          isDark ? 'border-zinc-800 text-zinc-500' : 'border-zinc-200 text-zinc-400'
        )}>
          {new Date(data.dateRange.start).toLocaleDateString('ko-KR')} ~ {new Date(data.dateRange.end).toLocaleDateString('ko-KR')}
        </div>
      )}
    </div>
  )
}

export default RoadmapPanel
