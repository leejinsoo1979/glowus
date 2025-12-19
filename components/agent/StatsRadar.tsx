'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import {
  Brain,
  MessageSquare,
  Lightbulb,
  Users,
  Target,
  Zap,
  TrendingUp,
  TrendingDown,
  Code,
  FileText,
  Database,
  Globe,
  Palette,
} from 'lucide-react'

// ============================================
// Types
// ============================================

export interface AgentStatsData {
  analysis: number
  communication: number
  creativity: number
  leadership: number
  execution: number
  adaptability: number
  level?: number
  experience_points?: number
}

export interface DomainExpertise {
  domain: string
  label: string
  score: number
  icon: React.ElementType
  color: string
}

export interface StatsHistory {
  date: string
  analysis: number
  communication: number
  creativity: number
  leadership: number
  execution: number
  adaptability: number
}

interface StatsRadarProps {
  stats: AgentStatsData
  previousStats?: AgentStatsData
  domainExpertise?: DomainExpertise[]
  statsHistory?: StatsHistory[]
  isDark?: boolean
  size?: 'sm' | 'md' | 'lg'
  showLabels?: boolean
  showTooltip?: boolean
  showOverlay?: boolean
  animated?: boolean
  className?: string
}

// ============================================
// Constants
// ============================================

const STAT_CONFIG = {
  analysis: {
    label: '분석력',
    fullName: '분석력',
    icon: Brain,
    color: '#60a5fa',
    glowColor: '#3b82f6',
  },
  communication: {
    label: '소통력',
    fullName: '소통력',
    icon: MessageSquare,
    color: '#4ade80',
    glowColor: '#22c55e',
  },
  creativity: {
    label: '창의력',
    fullName: '창의력',
    icon: Lightbulb,
    color: '#a78bfa',
    glowColor: '#8b5cf6',
  },
  leadership: {
    label: '리더십',
    fullName: '리더십',
    icon: Users,
    color: '#fbbf24',
    glowColor: '#f59e0b',
  },
  execution: {
    label: '실행력',
    fullName: '실행력',
    icon: Target,
    color: '#f87171',
    glowColor: '#ef4444',
  },
  adaptability: {
    label: '적응력',
    fullName: '적응력',
    icon: Zap,
    color: '#22d3ee',
    glowColor: '#06b6d4',
  },
} as const

const DEFAULT_DOMAIN_EXPERTISE: DomainExpertise[] = [
  { domain: 'development', label: '개발', score: 0, icon: Code, color: '#3b82f6' },
  { domain: 'documentation', label: '문서화', score: 0, icon: FileText, color: '#22c55e' },
  { domain: 'data', label: '데이터', score: 0, icon: Database, color: '#8b5cf6' },
  { domain: 'web', label: '웹/API', score: 0, icon: Globe, color: '#f59e0b' },
  { domain: 'design', label: '디자인', score: 0, icon: Palette, color: '#ec4899' },
]

const SIZE_CONFIG = {
  sm: { size: 240, labelOffset: 25 },
  md: { size: 340, labelOffset: 35 },
  lg: { size: 440, labelOffset: 45 },
}

// ============================================
// Modern Hexagonal Radar Chart (SVG-based)
// ============================================

export function StatsRadar({
  stats,
  previousStats,
  isDark = false,
  size = 'md',
  showLabels = true,
  showOverlay = true,
  animated = true,
  className,
}: StatsRadarProps) {
  const config = SIZE_CONFIG[size]
  const svgSize = config.size
  const center = svgSize / 2
  const maxRadius = center - config.labelOffset - 10

  // Animation state
  const [animationProgress, setAnimationProgress] = useState(animated ? 0 : 1)
  const [hoveredStat, setHoveredStat] = useState<string | null>(null)

  useEffect(() => {
    if (!animated) return
    const duration = 1200
    const start = performance.now()

    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimationProgress(eased)
      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [animated])

  // 스탯 키와 값
  const statKeys = ['analysis', 'communication', 'creativity', 'leadership', 'execution', 'adaptability'] as const

  // 각 꼭지점 좌표 계산 (6각형)
  const getPoint = (index: number, value: number): { x: number; y: number } => {
    const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2 // 12시 방향 시작
    const radius = (value / 100) * maxRadius
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    }
  }

  // 폴리곤 포인트 문자열 생성
  const createPolygonPoints = (values: number[]): string => {
    return values
      .map((value, index) => {
        const point = getPoint(index, value * animationProgress)
        return `${point.x},${point.y}`
      })
      .join(' ')
  }

  // 현재 스탯 값
  const currentValues = statKeys.map(key => stats[key] || 0)
  const previousValues = previousStats ? statKeys.map(key => previousStats[key] || 0) : null

  // 평균값
  const average = Math.round(currentValues.reduce((a, b) => a + b, 0) / currentValues.length)
  const previousAverage = previousValues
    ? Math.round(previousValues.reduce((a, b) => a + b, 0) / previousValues.length)
    : null
  const averageChange = previousAverage !== null ? average - previousAverage : null

  // 그리드 레벨 (20, 40, 60, 80, 100)
  const gridLevels = [20, 40, 60, 80, 100]

  // 고유 ID 생성 (gradient용)
  const id = useMemo(() => Math.random().toString(36).substr(2, 9), [])

  return (
    <div className={cn('relative', className)}>
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        className="overflow-visible"
      >
        <defs>
          {/* 메인 그라데이션 */}
          <linearGradient id={`mainGrad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
            <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.7} />
          </linearGradient>

          {/* 이전 스탯 그라데이션 */}
          <linearGradient id={`prevGrad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.2} />
          </linearGradient>

          {/* 글로우 필터 */}
          <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* 강한 글로우 (호버용) */}
          <filter id={`glowStrong-${id}`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 배경 원형 글로우 */}
        <circle
          cx={center}
          cy={center}
          r={maxRadius + 5}
          fill="none"
          stroke={isDark ? '#3f3f4620' : '#e4e4e720'}
          strokeWidth={1}
        />

        {/* 그리드 - 육각형 레벨들 */}
        {gridLevels.map((level, levelIndex) => {
          const points = Array.from({ length: 6 }, (_, i) => {
            const point = getPoint(i, level)
            return `${point.x},${point.y}`
          }).join(' ')

          return (
            <polygon
              key={level}
              points={points}
              fill="none"
              stroke={isDark ? '#3f3f46' : '#d4d4d8'}
              strokeWidth={level === 100 ? 1.5 : 0.5}
              opacity={level === 100 ? 0.5 : 0.3}
            />
          )
        })}

        {/* 축선 (중심에서 각 꼭지점) */}
        {statKeys.map((_, index) => {
          const endPoint = getPoint(index, 100)
          return (
            <line
              key={index}
              x1={center}
              y1={center}
              x2={endPoint.x}
              y2={endPoint.y}
              stroke={isDark ? '#3f3f46' : '#d4d4d8'}
              strokeWidth={0.5}
              opacity={0.4}
            />
          )
        })}

        {/* 30일 전 스탯 (오버레이) */}
        {showOverlay && previousValues && animationProgress > 0 && (
          <polygon
            points={createPolygonPoints(previousValues)}
            fill={`url(#prevGrad-${id})`}
            stroke={isDark ? '#fbbf24' : '#d97706'}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            opacity={0.6 * animationProgress}
          />
        )}

        {/* 현재 스탯 영역 */}
        <polygon
          points={createPolygonPoints(currentValues)}
          fill={`url(#mainGrad-${id})`}
          stroke="none"
          filter={`url(#glow-${id})`}
          opacity={animationProgress}
        />

        {/* 현재 스탯 테두리 (네온 효과) */}
        <polygon
          points={createPolygonPoints(currentValues)}
          fill="none"
          stroke={isDark ? '#a78bfa' : '#8b5cf6'}
          strokeWidth={2.5}
          strokeLinejoin="round"
          filter={`url(#glow-${id})`}
          opacity={animationProgress}
        />

        {/* 각 꼭지점 - 인터랙티브 포인트 */}
        {statKeys.map((key, index) => {
          const config = STAT_CONFIG[key]
          const value = currentValues[index]
          const point = getPoint(index, value * animationProgress)
          const isHovered = hoveredStat === key

          return (
            <g key={key}>
              {/* 포인트 글로우 */}
              <circle
                cx={point.x}
                cy={point.y}
                r={isHovered ? 12 : 8}
                fill={config.glowColor}
                opacity={isHovered ? 0.4 : 0.2}
                filter={isHovered ? `url(#glowStrong-${id})` : `url(#glow-${id})`}
                style={{ transition: 'all 0.3s ease' }}
              />
              {/* 포인트 */}
              <circle
                cx={point.x}
                cy={point.y}
                r={isHovered ? 6 : 4}
                fill={config.color}
                stroke={isDark ? '#18181b' : '#ffffff'}
                strokeWidth={2}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={() => setHoveredStat(key)}
                onMouseLeave={() => setHoveredStat(null)}
              />
            </g>
          )
        })}

        {/* 라벨 */}
        {showLabels && statKeys.map((key, index) => {
          const config = STAT_CONFIG[key]
          const labelPoint = getPoint(index, 115) // 라벨은 더 바깥에
          const value = currentValues[index]
          const Icon = config.icon
          const isHovered = hoveredStat === key

          // 라벨 위치 조정
          const isTop = index === 0
          const isBottom = index === 3
          const isLeft = index === 4 || index === 5
          const isRight = index === 1 || index === 2

          let textAnchor: 'start' | 'middle' | 'end' = 'middle'
          let dx = 0
          let dy = 0

          if (isLeft) { textAnchor = 'end'; dx = -8 }
          if (isRight) { textAnchor = 'start'; dx = 8 }
          if (isTop) dy = -8
          if (isBottom) dy = 8

          return (
            <g
              key={key}
              style={{
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                opacity: hoveredStat && hoveredStat !== key ? 0.5 : 1,
              }}
              onMouseEnter={() => setHoveredStat(key)}
              onMouseLeave={() => setHoveredStat(null)}
            >
              {/* 아이콘 + 라벨 배경 */}
              <foreignObject
                x={labelPoint.x - 40 + dx}
                y={labelPoint.y - 12 + dy}
                width={80}
                height={24}
              >
                <div
                  className={cn(
                    'flex items-center justify-center gap-1 px-2 py-0.5 rounded-full transition-all',
                    isHovered
                      ? 'scale-110'
                      : ''
                  )}
                  style={{
                    background: isHovered
                      ? isDark ? `${config.glowColor}30` : `${config.glowColor}20`
                      : 'transparent',
                  }}
                >
                  <Icon
                    className="w-3 h-3"
                    style={{ color: config.color }}
                  />
                  <span
                    className="text-[11px] font-medium"
                    style={{
                      color: isHovered
                        ? config.color
                        : isDark ? '#a1a1aa' : '#71717a',
                    }}
                  >
                    {config.label}
                  </span>
                </div>
              </foreignObject>

              {/* 값 표시 (호버시) */}
              {isHovered && (
                <foreignObject
                  x={labelPoint.x - 20 + dx}
                  y={labelPoint.y + 10 + dy}
                  width={40}
                  height={20}
                >
                  <div className="flex items-center justify-center">
                    <span
                      className="text-xs font-bold"
                      style={{ color: config.color }}
                    >
                      {value}
                    </span>
                  </div>
                </foreignObject>
              )}
            </g>
          )
        })}
      </svg>

      {/* 중앙 평균값 표시 */}
      <div
        className={cn(
          'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2',
          'flex flex-col items-center justify-center',
          'pointer-events-none'
        )}
      >
        <span
          className={cn(
            'text-3xl font-bold tabular-nums',
            isDark ? 'text-white' : 'text-zinc-900'
          )}
          style={{
            textShadow: isDark
              ? '0 0 20px rgba(139, 92, 246, 0.5)'
              : '0 0 20px rgba(139, 92, 246, 0.3)',
          }}
        >
          {Math.round(average * animationProgress)}
        </span>
        {averageChange !== null && averageChange !== 0 && (
          <div
            className={cn(
              'flex items-center gap-0.5 text-xs font-semibold mt-0.5 px-2 py-0.5 rounded-full',
              averageChange > 0
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-rose-400 bg-rose-500/10'
            )}
          >
            {averageChange > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {averageChange > 0 ? '+' : ''}{averageChange}
          </div>
        )}
        <span
          className={cn(
            'text-[10px] mt-0.5 uppercase tracking-wider',
            isDark ? 'text-zinc-500' : 'text-zinc-400'
          )}
        >
          평균
        </span>
      </div>

      {/* 범례 (30일 전 오버레이 있을 때) */}
      {showOverlay && previousStats && (
        <div
          className={cn(
            'absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full mt-4',
            'flex items-center gap-4 text-[10px]',
            isDark ? 'text-zinc-400' : 'text-zinc-500'
          )}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500" />
            <span>현재</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-0.5 rounded-full bg-amber-500"
              style={{
                backgroundImage: 'repeating-linear-gradient(90deg, #fbbf24 0px, #fbbf24 4px, transparent 4px, transparent 8px)',
              }}
            />
            <span>30일 전</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Domain Expertise Panel
// ============================================

export function DomainExpertisePanel({
  expertise = DEFAULT_DOMAIN_EXPERTISE,
  isDark = false,
  className,
}: {
  expertise?: DomainExpertise[]
  isDark?: boolean
  className?: string
}) {
  return (
    <div className={cn('space-y-4', className)}>
      {expertise.map((domain) => {
        const Icon = domain.icon
        return (
          <div key={domain.domain} className="group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'p-2 rounded-xl transition-all group-hover:scale-110',
                    isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                  )}
                  style={{
                    boxShadow: `0 0 0 1px ${domain.color}20`,
                  }}
                >
                  <Icon
                    className="w-4 h-4 transition-all"
                    style={{ color: domain.color }}
                  />
                </div>
                <span className={cn(
                  'text-sm font-medium',
                  isDark ? 'text-zinc-300' : 'text-zinc-700'
                )}>
                  {domain.label}
                </span>
              </div>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: domain.color }}
              >
                {domain.score}%
              </span>
            </div>
            <div className={cn(
              'h-2 rounded-full overflow-hidden',
              isDark ? 'bg-zinc-800' : 'bg-zinc-200'
            )}>
              <div
                className="h-full rounded-full transition-all duration-700 group-hover:brightness-110"
                style={{
                  width: `${domain.score}%`,
                  background: `linear-gradient(90deg, ${domain.color}cc, ${domain.color})`,
                  boxShadow: `0 0 10px ${domain.color}40`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================
// Stats Change Overview
// ============================================

export function StatsChangeOverview({
  stats,
  previousStats,
  isDark = false,
}: {
  stats: AgentStatsData
  previousStats: AgentStatsData
  isDark?: boolean
}) {
  const changes = useMemo(() => {
    const statKeys: (keyof typeof STAT_CONFIG)[] = [
      'analysis', 'communication', 'creativity',
      'leadership', 'execution', 'adaptability'
    ]

    return statKeys.map(key => {
      const current = stats[key] || 0
      const previous = previousStats[key] || 0
      const change = current - previous
      return {
        key,
        ...STAT_CONFIG[key],
        current,
        previous,
        change,
      }
    }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
  }, [stats, previousStats])

  const improved = changes.filter(c => c.change > 0)
  const declined = changes.filter(c => c.change < 0)

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 상승 */}
      <div className={cn(
        'p-4 rounded-xl border',
        isDark
          ? 'bg-emerald-950/30 border-emerald-900/50'
          : 'bg-emerald-50 border-emerald-200'
      )}>
        <div className="flex items-center gap-2 mb-4">
          <div className={cn(
            'p-1.5 rounded-lg',
            isDark ? 'bg-emerald-900/50' : 'bg-emerald-100'
          )}>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <span className={cn(
            'text-sm font-semibold',
            isDark ? 'text-emerald-400' : 'text-emerald-700'
          )}>
            성장
          </span>
        </div>
        {improved.length > 0 ? (
          <div className="space-y-3">
            {improved.slice(0, 3).map(item => {
              const Icon = item.icon
              return (
                <div key={item.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color: item.color }} />
                    <span className={cn(
                      'text-sm',
                      isDark ? 'text-zinc-300' : 'text-zinc-700'
                    )}>
                      {item.label}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-emerald-500">
                    +{item.change}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            변화 없음
          </p>
        )}
      </div>

      {/* 하락 */}
      <div className={cn(
        'p-4 rounded-xl border',
        isDark
          ? 'bg-rose-950/30 border-rose-900/50'
          : 'bg-rose-50 border-rose-200'
      )}>
        <div className="flex items-center gap-2 mb-4">
          <div className={cn(
            'p-1.5 rounded-lg',
            isDark ? 'bg-rose-900/50' : 'bg-rose-100'
          )}>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <span className={cn(
            'text-sm font-semibold',
            isDark ? 'text-rose-400' : 'text-rose-700'
          )}>
            하락
          </span>
        </div>
        {declined.length > 0 ? (
          <div className="space-y-3">
            {declined.slice(0, 3).map(item => {
              const Icon = item.icon
              return (
                <div key={item.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color: item.color }} />
                    <span className={cn(
                      'text-sm',
                      isDark ? 'text-zinc-300' : 'text-zinc-700'
                    )}>
                      {item.label}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-rose-500">
                    {item.change}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            변화 없음
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================
// Stats Radar Panel (with tabs)
// ============================================

type TabType = 'radar' | 'domain' | 'changes'

export function StatsRadarPanel({
  stats,
  previousStats,
  domainExpertise,
  isDark = false,
  title = '능력치 분석',
  className,
}: {
  stats: AgentStatsData
  previousStats?: AgentStatsData
  domainExpertise?: DomainExpertise[]
  isDark?: boolean
  title?: string
  className?: string
}) {
  const [activeTab, setActiveTab] = useState<TabType>('radar')

  const tabs = [
    { id: 'radar' as const, label: '레이더' },
    { id: 'domain' as const, label: '도메인 전문성' },
    ...(previousStats ? [{ id: 'changes' as const, label: '30일 변화' }] : []),
  ]

  return (
    <div
      className={cn(
        'p-5 md:p-6 rounded-2xl border backdrop-blur-sm',
        isDark
          ? 'bg-zinc-900/50 border-zinc-800'
          : 'bg-white/80 border-zinc-200',
        className
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'p-2 rounded-xl',
            isDark ? 'bg-violet-500/20' : 'bg-violet-100'
          )}>
            <Brain className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h4 className={cn(
              'font-semibold',
              isDark ? 'text-white' : 'text-zinc-900'
            )}>
              {title}
            </h4>
            {stats.level && (
              <span className={cn(
                'text-xs',
                isDark ? 'text-violet-400' : 'text-violet-600'
              )}>
                Level {stats.level}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className={cn(
        'flex gap-1 p-1 rounded-xl mb-5',
        isDark ? 'bg-zinc-800/50' : 'bg-zinc-100'
      )}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 px-4 py-2 text-xs font-medium rounded-lg transition-all',
              activeTab === tab.id
                ? isDark
                  ? 'bg-zinc-700 text-white shadow-lg'
                  : 'bg-white text-zinc-900 shadow-md'
                : isDark
                  ? 'text-zinc-400 hover:text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex items-center justify-center min-h-[340px]">
        {activeTab === 'radar' && (
          <StatsRadar
            stats={stats}
            previousStats={previousStats}
            isDark={isDark}
            size="md"
            showOverlay={!!previousStats}
          />
        )}

        {activeTab === 'domain' && (
          <div className="w-full">
            <DomainExpertisePanel
              expertise={domainExpertise || DEFAULT_DOMAIN_EXPERTISE}
              isDark={isDark}
            />
          </div>
        )}

        {activeTab === 'changes' && previousStats && (
          <div className="w-full">
            <StatsChangeOverview
              stats={stats}
              previousStats={previousStats}
              isDark={isDark}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Stats Radar Summary (legacy compatibility)
// ============================================

export function StatsRadarSummary({
  stats,
  isDark = false,
  className,
}: {
  stats: Partial<AgentStatsData>
  isDark?: boolean
  className?: string
}) {
  const statItems = [
    { key: 'analysis', label: '분석력', color: '#60a5fa' },
    { key: 'communication', label: '소통력', color: '#4ade80' },
    { key: 'creativity', label: '창의력', color: '#a78bfa' },
    { key: 'leadership', label: '리더십', color: '#fbbf24' },
    { key: 'execution', label: '실행력', color: '#f87171' },
    { key: 'adaptability', label: '적응력', color: '#22d3ee' },
  ]

  return (
    <div className={cn('grid grid-cols-3 gap-2 mt-4', className)}>
      {statItems.map((item) => {
        const value = (stats as any)[item.key] || 0
        return (
          <div
            key={item.key}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:scale-105',
              isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'
            )}
            style={{
              boxShadow: `inset 0 0 0 1px ${item.color}20`,
            }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: item.color,
                boxShadow: `0 0 8px ${item.color}60`,
              }}
            />
            <div className="flex-1 min-w-0">
              <span className={cn(
                'text-[10px]',
                isDark ? 'text-zinc-400' : 'text-zinc-500'
              )}>
                {item.label}
              </span>
              <span
                className="text-xs font-bold ml-1 tabular-nums"
                style={{ color: item.color }}
              >
                {value}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default StatsRadar
