'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import ProfileModal from '@/components/government-programs/ProfileModal'
import KnowledgeBasePanel from '@/components/government-programs/KnowledgeBasePanel'
import {
  Search,
  RefreshCw,
  Filter,
  Calendar,
  Building2,
  Bell,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Landmark,
  TrendingUp,
  Briefcase,
  Users,
  Globe,
  ShoppingBag,
  Rocket,
  Settings,
  Sparkles,
  FileText,
  Target,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowRight,
  Bookmark,
  ChevronRight,
  Zap,
  UserCircle2,
  Flame,
  Award,
  CircleDot,
  Activity,
  Sun,
  Moon,
  FileEdit
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore, accentColors, ThemeMode } from '@/stores/themeStore'
import { useTheme } from 'next-themes'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts'

// 테마 헬퍼 함수
const getThemeColors = (mode: ThemeMode) => {
  const isDark = mode === 'dark'
  return {
    bg: isDark ? 'bg-[#0a0a0f]' : 'bg-gray-50',
    card: isDark ? 'bg-white/[0.08]' : 'bg-white',
    cardBorder: isDark ? 'border-white/10' : 'border-gray-200',
    cardHover: isDark ? 'hover:bg-white/[0.12]' : 'hover:bg-gray-50',
    text: isDark ? 'text-white' : 'text-gray-900',
    textSecondary: isDark ? 'text-zinc-400' : 'text-gray-500',
    textMuted: isDark ? 'text-zinc-500' : 'text-gray-400',
    headerBg: isDark ? 'bg-black/20' : 'bg-white/80',
    headerBorder: isDark ? 'border-white/5' : 'border-gray-200',
    inputBg: isDark ? 'bg-white/5' : 'bg-gray-100',
    inputBorder: isDark ? 'border-white/10' : 'border-gray-300',
    inputText: isDark ? 'text-white placeholder-zinc-500' : 'text-gray-900 placeholder-gray-400',
    tooltipBg: isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    tooltipBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    tooltipText: isDark ? '#fff' : '#000',
    chartAxis: isDark ? '#71717a' : '#9ca3af',
    progressBg: isDark ? 'bg-white/5' : 'bg-gray-200',
  }
}

// 분야별 아이콘
const CATEGORY_ICONS: Record<string, any> = {
  '금융': Landmark,
  '기술': Sparkles,
  '인력': Users,
  '수출': Globe,
  '내수': ShoppingBag,
  '창업': Rocket,
  '경영': Briefcase,
  '기타': Settings
}

// 소스별 색상
const SOURCE_COLORS: Record<string, string> = {
  bizinfo: '#10b981',
  kstartup: '#6366f1',
  semas: '#f59e0b',
  unknown: '#71717a'
}

// 지원유형별 색상
const SUPPORT_TYPE_COLORS: Record<string, string> = {
  '사업화': '#3b82f6',    // blue
  '기술개발': '#8b5cf6',  // purple
  '시설보육': '#ec4899',  // pink
  '멘토링': '#10b981',    // green
  '행사': '#f59e0b',      // amber
  '융자보증': '#ef4444',  // red
  '인력': '#06b6d4',      // cyan
  '기타': '#71717a'       // gray
}

// 프로그램 타입
interface GovernmentProgram {
  id: string
  program_id: string
  title: string
  category: string
  support_type?: string  // 지원유형: 사업화, 기술개발, 시설보육, 멘토링, 행사, 융자보증, 인력, 기타
  hashtags: string[]
  organization: string
  executing_agency?: string
  reception_agency?: string
  apply_start_date?: string
  apply_end_date?: string
  detail_url?: string
  source: string
  created_at: string
  fit_score?: number
}

// 대시보드 통계 타입
interface DashboardStats {
  totalPrograms: number
  activePrograms: number
  endingSoonPrograms: number
  upcomingPrograms: number
  latestPrograms: number      // 최신공고 (7일 내 등록)
  eventCount: number          // 행사정보 수
  monthlyApplications: number
  sourceCounts: Record<string, number>
  categoryCounts: Record<string, number>
  statusCounts: Record<string, number>
  monthlyTrend: { month: string; count: number }[]
  regionCounts: Record<string, number>
  // 마감일 기준 데이터
  deadlineTrend: { month: string; count: number }[]
  deadlineByYear: Record<string, { month: string; count: number }[]>
}

// 매칭 결과 타입
interface MatchedProgram {
  program: GovernmentProgram
  fit_score: number
  fit_breakdown: {
    industry_match: number
    scale_match: number
    region_match: number
    type_match: number
    special_match: number
    reasons: string[]
  }
}

type StatusFilter = 'all' | 'active' | 'upcoming' | 'ended'
type SourceFilter = 'all' | 'bizinfo' | 'kstartup' | 'semas'
type ViewMode = 'dashboard' | 'list' | 'matches' | 'knowledge'

// 소스 정보
const SOURCES = [
  { id: 'all', label: '전체', color: '#a1a1aa' },
  { id: 'bizinfo', label: '기업마당', color: '#10b981' },
  { id: 'kstartup', label: 'K-Startup', color: '#6366f1' },
  { id: 'semas', label: '소진공', color: '#f59e0b' }
]

// ============================================================
// 새로운 디자인 컴포넌트들
// ============================================================

// 히어로 통계 카드 (프리미엄 글래스)
function HeroStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  onClick,
  isDark = true
}: {
  title: string
  value: number | string
  subtitle?: string
  icon: any
  gradient: string
  onClick?: () => void
  isDark?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-3xl p-6 transition-all duration-300 group",
        "backdrop-blur-xl border",
        isDark
          ? "bg-gradient-to-br from-white/[0.08] to-white/[0.02] border-white/10 hover:border-white/20"
          : "bg-white border-gray-100 shadow-lg hover:shadow-xl",
        onClick && "cursor-pointer"
      )}
    >
      {/* 배경 그라데이션 오버레이 */}
      <div
        className="absolute inset-0 opacity-20 transition-opacity duration-300 group-hover:opacity-30"
        style={{ background: gradient }}
      />

      {/* 장식용 글로우 */}
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20" style={{ background: gradient }} />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full blur-3xl opacity-10" style={{ background: gradient }} />

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            "p-2.5 rounded-2xl backdrop-blur-md shadow-lg transition-transform duration-300 group-hover:scale-110",
            isDark ? "bg-white/10 text-white" : "bg-white text-gray-900"
          )}>
            <Icon className="w-5 h-5" />
          </div>
          <div className={cn("text-sm font-semibold tracking-wide uppercase", isDark ? "text-white/80" : "text-gray-600")}>
            {title}
          </div>
        </div>

        <div className={cn(
          "text-5xl font-bold tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-br",
          isDark ? "from-white to-white/70" : "from-gray-900 to-gray-600"
        )}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>

        {subtitle && (
          <div className={cn("flex items-center gap-1.5 text-xs font-medium", isDark ? "text-zinc-400" : "text-gray-500")}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: gradient }} />
            {subtitle}
          </div>
        )}
      </div>

      {/* 액션 화살표 */}
      {onClick && (
        <div className={cn(
          "absolute top-6 right-6 p-2 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0",
          isDark ? "bg-white/10 hover:bg-white/20 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-900"
        )}>
          <ArrowUpRight className="w-4 h-4" />
        </div>
      )}
    </div>
  )
}

// 미니 통계 카드 (컴팩트)
function MiniStatCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  isDark = true
}: {
  label: string
  value: number
  icon: any
  color: string
  trend?: number
  isDark?: boolean
}) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-xl backdrop-blur-sm border transition-all",
      isDark
        ? "bg-white/5 border-white/10"
        : "bg-white border-gray-200 shadow-sm"
    )}>
      <div
        className="p-2 rounded-lg flex-shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn("text-lg font-bold leading-tight", isDark ? "text-white" : "text-gray-900")}>
          {value.toLocaleString()}
        </div>
        <div className={cn("text-xs truncate", isDark ? "text-zinc-400" : "text-gray-500")}>{label}</div>
      </div>
    </div>
  )
}

// 글래스 카드 (테마 적용)
function GlassCard({
  children,
  className,
  hover = true,
  isDark = true
}: {
  children: React.ReactNode
  className?: string
  hover?: boolean
  isDark?: boolean
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border transition-all duration-300",
        isDark
          ? "bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl border-white/10"
          : "bg-white border-gray-200 shadow-sm",
        hover && (isDark
          ? "hover:border-white/20 hover:from-white/[0.12] hover:to-white/[0.04]"
          : "hover:shadow-md hover:border-gray-300"),
        className
      )}
    >
      {children}
    </div>
  )
}

// 차트 컴포넌트 - 카테고리별 분포 (Premium Theme)
function CategoryChart({
  data,
  color,
  isDark = true
}: {
  data: Record<string, number>
  color: string
  isDark?: boolean
}) {
  const chartData = useMemo(() => {
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4)
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full text-sm", isDark ? "text-zinc-500" : "text-gray-400")}>
        데이터 없음
      </div>
    )
  }

  const maxValue = Math.max(...chartData.map(d => d.value))

  return (
    <div className="space-y-3 py-1">
      {chartData.map((item, index) => {
        const percentage = (item.value / maxValue) * 100
        const Icon = CATEGORY_ICONS[item.name] || Settings
        return (
          <div key={item.name} className="group">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  isDark ? "bg-white/5 text-zinc-300" : "bg-gray-100 text-gray-500"
                )}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className={cn(
                  "text-sm font-medium transition-colors",
                  isDark ? "text-zinc-300" : "text-gray-600"
                )}>
                  {item.name}
                </span>
              </div>
              <span className={cn("text-sm font-bold", isDark ? "text-white" : "text-gray-900")}>
                {item.value}
              </span>
            </div>
            {/* Progress Bar with Glow */}
            <div className={cn("h-2.5 rounded-full overflow-hidden", isDark ? "bg-white/5" : "bg-gray-100")}>
              <div
                className="h-full rounded-full transition-all duration-700 ease-out relative"
                style={{
                  width: `${percentage}%`,
                  background: `linear-gradient(90deg, ${color}, ${color})`
                }}
              >
                <div
                  className="absolute inset-0 opacity-50 blur-[4px]"
                  style={{ background: color }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 차트 컴포넌트 - 월별 트렌드 (Premium Theme)
function MonthlyTrendChart({
  data,
  color,
  isDark = true
}: {
  data: { month: string; count: number }[]
  color: string
  isDark?: boolean
}) {
  const chartData = useMemo(() => {
    return data.slice(-6).map(item => ({
      ...item,
      month: item.month.substring(5)
    }))
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full text-sm", isDark ? "text-zinc-500" : "text-gray-400")}>
        데이터 없음
      </div>
    )
  }

  const gradientId = `trendGradient-${isDark ? 'dark' : 'light'}`

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={isDark ? 0.5 : 0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="month"
          tick={{ fill: isDark ? '#71717a' : '#9ca3af', fontSize: 11, fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
          tickMargin={10}
        />
        <YAxis hide domain={[0, 'auto']} />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? 'rgba(24, 24, 27, 0.8)' : 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(8px)',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
            borderRadius: '12px',
            color: isDark ? '#fff' : '#000',
            fontSize: '12px',
            padding: '8px 12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}
          cursor={{ stroke: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', strokeWidth: 2 }}
          labelStyle={{ color: isDark ? '#fff' : '#000', marginBottom: '4px', fontWeight: 'bold' }}
          itemStyle={{ color: isDark ? '#fff' : '#000' }}
          formatter={(value: number) => [`${value}개`, '']}
          labelFormatter={(label) => `${label}월`}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke={color}
          strokeWidth={3}
          fill={`url(#${gradientId})`}
          dot={{ fill: isDark ? '#18181b' : '#fff', stroke: color, strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, stroke: isDark ? '#fff' : '#000', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// 소스 분포 (테마 적용)
function SourceDistribution({
  data,
  isDark = true
}: {
  data: Record<string, number>
  isDark?: boolean
}) {
  const total = Object.values(data).reduce((a, b) => a + b, 0)
  const sources = [
    { key: 'bizinfo', name: '기업마당', color: '#10b981' },
    { key: 'kstartup', name: 'K-Startup', color: '#6366f1' },
    { key: 'semas', name: '소진공', color: '#f59e0b' }
  ]

  return (
    <div className="space-y-4">
      {sources.map(source => {
        const value = data[source.key] || 0
        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0
        return (
          <div key={source.key} className="flex items-center gap-4">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: source.color }}
            />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className={cn("text-sm", isDark ? "text-zinc-300" : "text-gray-600")}>{source.name}</span>
                <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
                  {value.toLocaleString()}
                  <span className={cn("ml-1", isDark ? "text-zinc-500" : "text-gray-400")}>({percentage}%)</span>
                </span>
              </div>
              <div className={cn("h-1.5 rounded-full overflow-hidden", isDark ? "bg-white/5" : "bg-gray-200")}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: source.color
                  }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 상태 분포 파이 차트 (Premium Gradient)
function StatusPieChart({
  data,
  isDark = true,
  themeColor = '#8b5cf6'
}: {
  data: Record<string, number>
  isDark?: boolean
  themeColor?: string
}) {
  const chartData = useMemo(() => {
    const statusConfig = [
      { key: 'active', name: '진행중', colorMod: 'ff' },
      { key: 'ending_soon', name: '마감임박', colorMod: 'cc' },
      { key: 'upcoming', name: '예정', colorMod: '99' },
      { key: 'ended', name: '마감', colorMod: '66' }
    ]
    return statusConfig
      .map(status => ({
        name: status.name,
        value: data[status.key] || 0,
        color: `${themeColor}${status.colorMod}`
      }))
      .filter(item => item.value > 0)
  }, [data, themeColor])

  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  if (chartData.length === 0 || total === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full text-sm", isDark ? "text-zinc-500" : "text-gray-400")}>
        데이터 없음
      </div>
    )
  }

  return (
    <div className="h-full flex items-center gap-6">
      <div className="flex-1 h-full min-h-[160px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {chartData.map((entry, index) => (
                <linearGradient id={`statusGradient-${index}`} key={`statusGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                  <stop offset="100%" stopColor={entry.color} stopOpacity={0.6} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="65%"
              outerRadius="90%"
              paddingAngle={5}
              dataKey="value"
              stroke="none"
              cornerRadius={5}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`url(#statusGradient-${index})`}
                  style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.2))' }}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? 'rgba(24, 24, 27, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(8px)',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                borderRadius: '12px',
                color: isDark ? '#fff' : '#000',
                fontSize: '12px',
                padding: '8px 12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
              }}
              itemStyle={{ color: isDark ? '#fff' : '#000' }}
              formatter={(value: number) => [`${value.toLocaleString()}건`, '']}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className={cn("text-xs font-medium", isDark ? "text-zinc-400" : "text-gray-500")}>Total</span>
          <span className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>{total}</span>
        </div>
      </div>
      <div className="w-32 space-y-3">
        {chartData.map((item, index) => (
          <div key={item.name} className="group flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-2.5 h-2.5 rounded-full shadow-lg transition-transform group-hover:scale-125"
                style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}88)` }}
              />
              <span className={cn("text-sm font-medium", isDark ? "text-zinc-300" : "text-gray-600")}>{item.name}</span>
            </div>
            <span className={cn("text-sm font-bold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
              {((item.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// 소스 파이 차트 (Premium Gradient)
function SourcePieChart({
  data,
  isDark = true,
  themeColor = '#8b5cf6'
}: {
  data: Record<string, number>
  isDark?: boolean
  themeColor?: string
}) {
  const chartData = useMemo(() => {
    // 출처별 색상 지정
    const sourceConfig = [
      { key: 'bizinfo', name: '기업마당', color: '#10b981' },
      { key: 'kstartup', name: 'K-Startup', color: '#6366f1' },
      { key: 'semas', name: '소진공', color: '#f59e0b' },
      { key: 'bizinfo_event', name: '행사정보', color: '#ec4899' }
    ]
    return sourceConfig
      .map(source => ({
        name: source.name,
        value: data[source.key] || 0,
        color: source.color
      }))
      .filter(item => item.value > 0)
  }, [data])

  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  if (chartData.length === 0 || total === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full text-sm", isDark ? "text-zinc-500" : "text-gray-400")}>
        데이터 없음
      </div>
    )
  }

  return (
    <div className="h-full flex items-center gap-6">
      <div className="flex-1 h-full min-h-[160px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {chartData.map((entry, index) => (
                <linearGradient id={`sourceGradient-${index}`} key={`sourceGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                  <stop offset="100%" stopColor={entry.color} stopOpacity={0.6} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="65%"
              outerRadius="90%"
              paddingAngle={5}
              dataKey="value"
              stroke="none"
              cornerRadius={5}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`url(#sourceGradient-${index})`}
                  style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.2))' }}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? 'rgba(24, 24, 27, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(8px)',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                borderRadius: '12px',
                color: isDark ? '#fff' : '#000',
                fontSize: '12px',
                padding: '8px 12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
              }}
              itemStyle={{ color: isDark ? '#fff' : '#000' }}
              formatter={(value: number) => [`${value.toLocaleString()}건`, '']}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className={cn("text-xs font-medium", isDark ? "text-zinc-400" : "text-gray-500")}>Total</span>
          <span className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>{total}</span>
        </div>
      </div>
      <div className="w-32 space-y-3">
        {chartData.map((item, index) => (
          <div key={item.name} className="group flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-2.5 h-2.5 rounded-full shadow-lg transition-transform group-hover:scale-125"
                style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}88)` }}
              />
              <span className={cn("text-sm font-medium", isDark ? "text-zinc-300" : "text-gray-600")}>{item.name}</span>
            </div>
            <span className={cn("text-sm font-bold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
              {((item.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============ 상세 분석 차트 컴포넌트 ============

// 지원분야 대분류별 막대 차트 (Full)
function DetailedCategoryBarChart({
  data,
  color,
  isDark = true
}: {
  data: Record<string, number>
  color: string
  isDark?: boolean
}) {
  const chartData = useMemo(() => {
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full text-sm", isDark ? "text-zinc-500" : "text-gray-400")}>
        데이터 없음
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
        <XAxis
          type="number"
          tick={{ fill: isDark ? '#71717a' : '#9ca3af', fontSize: 11 }}
          axisLine={{ stroke: isDark ? '#27272a' : '#e5e7eb' }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: isDark ? '#a1a1aa' : '#6b7280', fontSize: 12, fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
            borderRadius: '8px',
            color: isDark ? '#fff' : '#000',
            fontSize: '12px',
            boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.1)'
          }}
          labelStyle={{ color: isDark ? '#fff' : '#000' }}
          itemStyle={{ color: isDark ? '#fff' : '#000' }}
          formatter={(value: number) => [`${value}개`, '공고수']}
        />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// 월별·년도별 마감 분포 차트
function DeadlineDistributionChart({
  data,
  color,
  isDark = true
}: {
  data: { month: string; count: number }[]
  color: string
  isDark?: boolean
}) {
  const chartData = useMemo(() => {
    // 마감일 기준으로 월별 그룹화
    const monthlyData: Record<string, number> = {}
    data.forEach(item => {
      const month = item.month
      monthlyData[month] = (monthlyData[month] || 0) + item.count
    })
    return Object.entries(monthlyData)
      .map(([month, count]) => ({
        month: month.length > 7 ? month.substring(2) : month,
        count
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full text-sm", isDark ? "text-zinc-500" : "text-gray-400")}>
        데이터 없음
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#e5e7eb'} vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: isDark ? '#71717a' : '#9ca3af', fontSize: 11 }}
          axisLine={{ stroke: isDark ? '#27272a' : '#e5e7eb' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: isDark ? '#71717a' : '#9ca3af', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
            borderRadius: '8px',
            color: isDark ? '#fff' : '#000',
            fontSize: '12px',
            boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.1)'
          }}
          labelStyle={{ color: isDark ? '#fff' : '#000' }}
          itemStyle={{ color: isDark ? '#fff' : '#000' }}
          formatter={(value: number) => [`${value}개`, '공고수']}
        />
        <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} maxBarSize={50} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// 연도별 월간 수집 추이 비교 (라인 차트)
function YearlyTrendComparisonChart({
  data,
  color,
  isDark = true
}: {
  data: { month: string; count: number }[]
  color: string
  isDark?: boolean
}) {
  const chartData = useMemo(() => {
    // 연도별로 데이터 분리
    const yearlyData: Record<string, Record<string, number>> = {}

    data.forEach(item => {
      const [year, month] = item.month.split('-')
      if (!yearlyData[year]) {
        yearlyData[year] = {}
      }
      yearlyData[year][month] = item.count
    })

    // 월별 데이터로 변환 (1월~12월)
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    const years = Object.keys(yearlyData).sort()

    return months.map(month => {
      const entry: any = { month: `${parseInt(month)}월` }
      years.forEach(year => {
        entry[year] = yearlyData[year]?.[month] || 0
      })
      return entry
    })
  }, [data])

  const years = useMemo(() => {
    const yearsSet = new Set<string>()
    data.forEach(item => {
      const year = item.month.split('-')[0]
      yearsSet.add(year)
    })
    return Array.from(yearsSet).sort()
  }, [data])

  // 연도별 색상 생성
  const yearColors = useMemo(() => {
    const colors: Record<string, string> = {}
    years.forEach((year, idx) => {
      const opacity = Math.max(0.4, 1 - idx * 0.2)
      colors[year] = `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
    })
    return colors
  }, [years, color])

  if (chartData.length === 0 || years.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full text-sm", isDark ? "text-zinc-500" : "text-gray-400")}>
        데이터 없음
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <ResponsiveContainer width="100%" height="80%">
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#e5e7eb'} />
          <XAxis
            dataKey="month"
            tick={{ fill: isDark ? '#71717a' : '#9ca3af', fontSize: 11 }}
            axisLine={{ stroke: isDark ? '#27272a' : '#e5e7eb' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: isDark ? '#71717a' : '#9ca3af', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
              borderRadius: '8px',
              color: isDark ? '#fff' : '#000',
              fontSize: '12px',
              boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.1)'
            }}
            labelStyle={{ color: isDark ? '#fff' : '#000' }}
            itemStyle={{ color: isDark ? '#fff' : '#000' }}
          />
          {years.map((year) => (
            <Line
              key={year}
              type="monotone"
              dataKey={year}
              stroke={yearColors[year]}
              strokeWidth={2}
              dot={{ fill: yearColors[year], strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {/* 범례 */}
      <div className="flex items-center justify-center gap-4 mt-2">
        {years.map(year => (
          <div key={year} className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: yearColors[year] }} />
            <span className={cn("text-xs", isDark ? "text-zinc-400" : "text-gray-500")}>{year}년</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// 출처별 월간 수집 현황 막대 차트
function SourceMonthlyChart({
  data,
  sourceCounts,
  color,
  isDark = true
}: {
  data: { month: string; count: number }[]
  sourceCounts: Record<string, number>
  color: string
  isDark?: boolean
}) {
  const chartData = useMemo(() => {
    // 월별로 그룹화하여 막대 차트 데이터 생성
    return data.slice(-12).map(item => ({
      month: item.month.substring(5), // MM 형식
      count: item.count
    }))
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full text-sm", isDark ? "text-zinc-500" : "text-gray-400")}>
        데이터 없음
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#e5e7eb'} vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: isDark ? '#71717a' : '#9ca3af', fontSize: 11 }}
          axisLine={{ stroke: isDark ? '#27272a' : '#e5e7eb' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: isDark ? '#71717a' : '#9ca3af', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
            borderRadius: '8px',
            color: isDark ? '#fff' : '#000',
            fontSize: '12px',
            boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.1)'
          }}
          labelStyle={{ color: isDark ? '#fff' : '#000' }}
          itemStyle={{ color: isDark ? '#fff' : '#000' }}
          formatter={(value: number) => [`${value}개`, '수집 공고']}
        />
        <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} maxBarSize={50} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ============ 기존 컴포넌트 ============

// 마감 임박 프로그램 카드 (새 디자인)
function UrgentProgramCard({
  program,
  daysRemaining,
  themeColor,
  isDark = true,
  onClick
}: {
  program: GovernmentProgram
  daysRemaining: number
  themeColor: string
  isDark?: boolean
  onClick?: () => void
}) {
  const urgencyLevel = daysRemaining <= 3 ? 'critical' : daysRemaining <= 5 ? 'warning' : 'normal'

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative p-5 rounded-2xl border transition-all hover:scale-[1.01] cursor-pointer",
        !isDark && "shadow-sm"
      )}
      style={{
        background: urgencyLevel === 'critical'
          ? `linear-gradient(to right, ${themeColor}${isDark ? '20' : '15'}, ${themeColor}${isDark ? '10' : '08'})`
          : urgencyLevel === 'warning'
            ? `linear-gradient(to right, rgba(245, 158, 11, ${isDark ? 0.2 : 0.15}), rgba(245, 158, 11, ${isDark ? 0.1 : 0.08}))`
            : `linear-gradient(to right, rgba(16, 185, 129, ${isDark ? 0.2 : 0.15}), rgba(16, 185, 129, ${isDark ? 0.1 : 0.08}))`,
        borderColor: urgencyLevel === 'critical'
          ? `${themeColor}50`
          : urgencyLevel === 'warning'
            ? 'rgba(245, 158, 11, 0.3)'
            : 'rgba(16, 185, 129, 0.3)'
      }}
    >
      <div className="flex items-center gap-5">
        <div className={cn(
          "flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center backdrop-blur-sm",
          isDark ? "bg-black/30" : "bg-white/60"
        )}>
          <span
            className="text-lg font-bold"
            style={{
              color: urgencyLevel === 'critical' ? themeColor
                : urgencyLevel === 'warning' ? '#f59e0b'
                  : '#10b981'
            }}
          >
            D-{daysRemaining}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={cn(
            "text-base font-semibold line-clamp-2 leading-snug",
            isDark ? "text-white" : "text-gray-900"
          )}>
            {program.title}
          </h4>
          <div className="flex items-center gap-3 mt-2">
            <span className={isDark ? "text-zinc-400" : "text-gray-600"}>{program.organization}</span>
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ backgroundColor: `${SOURCE_COLORS[program.source]}20`, color: SOURCE_COLORS[program.source] }}
            >
              {program.source === 'kstartup' ? 'K-Startup' : program.source === 'semas' ? '소진공' : '기업마당'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClick?.()
          }}
          className={cn(
            "flex-shrink-0 p-3 rounded-xl transition-all",
            isDark ? "bg-white/10 hover:bg-white/20" : "bg-black/5 hover:bg-black/10"
          )}
        >
          <ChevronRight className={cn("w-5 h-5", isDark ? "text-white" : "text-gray-700")} />
        </button>
      </div>
    </div>
  )
}

// AI 추천 카드 (새 디자인)
function AIRecommendCard({
  match,
  themeColor,
  onClick,
  isDark = true
}: {
  match: MatchedProgram
  themeColor: string
  onClick?: () => void
  isDark?: boolean
}) {
  const scoreLevel = match.fit_score >= 80 ? 'excellent' : match.fit_score >= 60 ? 'good' : 'fair'
  const scoreColors = {
    excellent: { ring: 'ring-emerald-500', text: isDark ? 'text-emerald-400' : 'text-emerald-600', bg: 'bg-emerald-500' },
    good: { ring: 'ring-accent', text: 'text-accent', bg: 'bg-accent' },
    fair: { ring: 'ring-amber-500', text: isDark ? 'text-amber-400' : 'text-amber-600', bg: 'bg-amber-500' }
  }
  const colors = scoreColors[scoreLevel]

  return (
    <div
      onClick={onClick}
      className={cn(
        "group p-4 rounded-xl border transition-all cursor-pointer",
        isDark
          ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
          : "bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300 shadow-sm"
      )}
    >
      <div className="flex items-start gap-4">
        {/* 점수 링 */}
        <div className={cn(
          "relative flex-shrink-0 w-14 h-14 rounded-full ring-2 flex items-center justify-center backdrop-blur-sm",
          isDark ? "bg-black/30" : "bg-white",
          colors.ring
        )}>
          <span className={cn("text-lg font-bold", colors.text)}>{match.fit_score}</span>
          <div className={cn(
            "absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center",
            colors.bg
          )}>
            <Sparkles className="w-2.5 h-2.5 text-white" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h4 className={cn(
            "font-medium line-clamp-1",
            isDark ? "text-white group-hover:text-white/90" : "text-gray-900 group-hover:text-gray-700"
          )}>
            {match.program.title}
          </h4>
          <p className={cn("text-sm mt-0.5", isDark ? "text-zinc-400" : "text-gray-600")}>{match.program.organization}</p>
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {match.fit_breakdown.reasons.slice(0, 2).map((reason, idx) => (
              <span key={idx} className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                isDark ? "bg-white/10 text-zinc-300" : "bg-gray-100 text-gray-600"
              )}>
                ✓ {reason}
              </span>
            ))}
          </div>
        </div>

        <ChevronRight className={cn(
          "w-5 h-5 group-hover:translate-x-1 transition-all",
          isDark ? "text-zinc-500 group-hover:text-white" : "text-gray-400 group-hover:text-gray-900"
        )} />
      </div>
    </div>
  )
}

// ============================================================
// 메인 컴포넌트
// ============================================================

export default function GovernmentProgramsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const { accentColor } = useThemeStore()
  const { resolvedTheme, setTheme } = useTheme()
  // hydration 전에는 resolvedTheme이 undefined일 수 있으므로 dark를 기본값으로 사용
  const isDark = resolvedTheme !== 'light'
  const theme = getThemeColors(isDark ? 'dark' : 'light')

  // Hydration 문제 방지를 위한 mounted 상태
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // 프로필 모달 상태
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const themeColor = accentColors.find(c => c.id === accentColor)?.color || '#6366f1'

  // 상태
  const [programs, setPrograms] = useState<GovernmentProgram[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard')

  // AI 매칭 관련 상태
  const [matchedPrograms, setMatchedPrograms] = useState<MatchedProgram[]>([])
  const [matchLoading, setMatchLoading] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  // URL 파라미터에서 view 모드 초기화
  useEffect(() => {
    const view = searchParams.get('view')
    if (view === 'matches' || view === 'list' || view === 'dashboard' || view === 'knowledge') {
      setViewMode(view as ViewMode)
    }
  }, [searchParams])

  // 프로필 로드
  const fetchProfile = useCallback(async () => {
    setProfileLoading(true)
    try {
      const response = await fetch('/api/company-profile')
      const data = await response.json()
      if (data.success && data.profile) {
        setUserProfile(data.profile)
      }
    } catch (error) {
      console.error('프로필 로드 실패:', error)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  // AI 매칭 로드
  const fetchMatches = useCallback(async () => {
    if (!userProfile) return

    setMatchLoading(true)
    try {
      const response = await fetch('/api/government-programs/match?min_score=40&limit=50')
      const data = await response.json()
      if (data.success) {
        setMatchedPrograms(data.matches)
      }
    } catch (error) {
      console.error('매칭 로드 실패:', error)
    } finally {
      setMatchLoading(false)
    }
  }, [userProfile])

  // 대시보드 통계 로드
  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const response = await fetch('/api/government-programs/dashboard')
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('통계 로드 실패:', error)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  // 프로그램 목록 로드
  const fetchPrograms = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCategory) params.append('category', selectedCategory)
      if (searchQuery) params.append('search', searchQuery)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (sourceFilter !== 'all') params.append('source', sourceFilter)
      params.append('limit', '100')

      const response = await fetch(`/api/government-programs?${params.toString()}`)
      const data = await response.json()
      if (data.success) {
        setPrograms(data.programs)
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, searchQuery, statusFilter, sourceFilter])

  useEffect(() => {
    fetchStats()
    fetchPrograms()
    fetchProfile()
  }, [fetchStats, fetchPrograms, fetchProfile])

  useEffect(() => {
    if (viewMode === 'matches' && userProfile) {
      fetchMatches()
    }
  }, [viewMode, userProfile, fetchMatches])

  // 동기화
  const syncPrograms = async () => {
    setSyncing(true)
    try {
      await fetch('/api/government-programs/dashboard', { method: 'POST' })
      await fetchStats()
      await fetchPrograms()
    } catch (error) {
      console.error('동기화 실패:', error)
    } finally {
      setSyncing(false)
    }
  }

  // 상태 계산
  const getStatus = (program: GovernmentProgram) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startDate = program.apply_start_date ? new Date(program.apply_start_date) : null
    const endDate = program.apply_end_date ? new Date(program.apply_end_date) : null
    if (!startDate || !endDate) return 'unknown'
    if (today < startDate) return 'upcoming'
    if (today > endDate) return 'ended'
    return 'active'
  }

  // 남은 일수 계산
  const getDaysRemaining = (endDate?: string) => {
    if (!endDate) return null
    const today = new Date()
    const end = new Date(endDate)
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  // 마감 임박 프로그램 (D-0 ~ D-7, 전체 표시)
  const urgentPrograms = useMemo(() => {
    return programs
      .filter(p => {
        const days = getDaysRemaining(p.apply_end_date)
        return days !== null && days >= 0 && days <= 7
      })
      .sort((a, b) => {
        const daysA = getDaysRemaining(a.apply_end_date) || 0
        const daysB = getDaysRemaining(b.apply_end_date) || 0
        return daysA - daysB
      })
  }, [programs])

  // 카테고리 목록
  const categories = stats?.categoryCounts
    ? Object.keys(stats.categoryCounts).sort((a, b) =>
      (stats.categoryCounts[b] || 0) - (stats.categoryCounts[a] || 0)
    )
    : []

  // Hydration 전까지 로딩 표시
  if (!mounted) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-900">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className={cn("h-full flex flex-col transition-colors duration-300 relative overflow-hidden", theme.bg)}>
      {/* Ambient Background Orbs (Premium Dark Theme) */}
      {isDark && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-purple-900/20 blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-[-10%] left-[-20%] w-[600px] h-[600px] rounded-full bg-blue-900/10 blur-[100px] mix-blend-screen" />
          <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] rounded-full bg-indigo-900/10 blur-[80px] opacity-50" />
        </div>
      )}

      {/* 헤더 */}
      <div className={cn(
        "sticky top-0 z-20 px-8 h-20 flex items-center justify-between transition-colors duration-200 border-b backdrop-blur-xl",
        theme.headerBg,
        theme.headerBorder
      )}>
        <div className="flex items-center gap-4">
          <div className={cn(
            "p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30"
          )}>
            <Landmark className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className={cn("text-xl font-bold tracking-tight", theme.text)}>
              정부지원사업
            </h1>
            <p className="text-xs font-medium text-zinc-500">AI 매칭 플랫폼</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={cn(
            "flex items-center p-1 rounded-xl border backdrop-blur-md",
            isDark ? "bg-white/5 border-white/10" : "bg-gray-100/50 border-gray-200"
          )}>
            <button
              onClick={() => setViewMode('dashboard')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2",
                viewMode === 'dashboard'
                  ? (isDark ? "bg-white/10 text-white shadow-sm" : "bg-white text-gray-900 shadow-sm")
                  : (isDark ? "text-zinc-400 hover:text-zinc-200" : "text-gray-500 hover:text-gray-700")
              )}
            >
              <BarChart3 className="w-4 h-4" />
              대시보드
            </button>
            <button
              onClick={() => setViewMode('matches')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2",
                viewMode === 'matches'
                  ? (isDark ? "bg-white/10 text-white shadow-sm" : "bg-white text-gray-900 shadow-sm")
                  : (isDark ? "text-zinc-400 hover:text-zinc-200" : "text-gray-500 hover:text-gray-700")
              )}
            >
              <Target className="w-4 h-4" />
              AI 매칭
              {userProfile && matchedPrograms.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs rounded-full bg-white/20">
                  {matchedPrograms.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2",
                viewMode === 'list'
                  ? (isDark ? "bg-white/10 text-white shadow-sm" : "bg-white text-gray-900 shadow-sm")
                  : (isDark ? "text-zinc-400 hover:text-zinc-200" : "text-gray-500 hover:text-gray-700")
              )}
            >
              <Filter className="w-4 h-4" />
              전체목록
            </button>
            <button
              onClick={() => setViewMode('knowledge')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2",
                viewMode === 'knowledge'
                  ? (isDark ? "bg-white/10 text-white shadow-sm" : "bg-white text-gray-900 shadow-sm")
                  : (isDark ? "text-zinc-400 hover:text-zinc-200" : "text-gray-500 hover:text-gray-700")
              )}
            >
              <Briefcase className="w-4 h-4" />
              지식베이스
            </button>
          </div>

          {/* 다크/라이트 모드 토글 */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={cn(
              "p-2 rounded-xl transition-all",
              isDark
                ? "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                : "bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200"
            )}
            title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={syncPrograms}
            disabled={syncing}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              isDark
                ? "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                : "bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200"
            )}
          >
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            {syncing ? '동기화...' : '새로고침'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        {viewMode === 'dashboard' ? (
          /* ========== Dashboard View ========== */
          <div className="p-6 space-y-6">
            {statsLoading ? (
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full border-2 animate-spin",
                    isDark ? "border-white/20 border-t-white/70" : "border-gray-300 border-t-gray-600"
                  )} />
                  <p className={cn("text-sm", theme.textMuted)}>데이터를 불러오는 중...</p>
                </div>
              </div>
            ) : (
              <>
                {/* 빠른 액션 */}
                <div className="grid grid-cols-3 gap-4 mb-5">
                  {[
                    {
                      icon: Search,
                      title: '공고 검색',
                      desc: '조건에 맞는 공고 찾기',
                      color: '#10b981',
                      onClick: () => setViewMode('list')
                    },
                    {
                      icon: FileText,
                      title: '사업계획서 작성',
                      desc: 'AI가 자동으로 작성',
                      color: themeColor,
                      onClick: () => router.push('/dashboard-group/company/government-programs/business-plan')
                    },
                    {
                      icon: Bell,
                      title: '알림 설정',
                      desc: '맞춤 공고 알림받기',
                      color: '#8b5cf6',
                      onClick: () => { }
                    }
                  ].map((action, idx) => (
                    <button
                      key={idx}
                      onClick={action.onClick}
                      className={cn(
                        "group p-5 rounded-2xl text-left transition-all hover:scale-[1.02]",
                        isDark
                          ? "bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 hover:border-white/20"
                          : "bg-white border border-gray-200 shadow-sm hover:shadow-md"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="p-2.5 rounded-xl"
                            style={{ backgroundColor: `${action.color}20` }}
                          >
                            <action.icon className="w-5 h-5" style={{ color: action.color }} />
                          </div>
                          <div>
                            <div className={cn("font-medium", theme.text)}>{action.title}</div>
                            <div className={cn("text-xs", theme.textSecondary)}>{action.desc}</div>
                          </div>
                        </div>
                        <ArrowUpRight className={cn(
                          "w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all",
                          isDark ? "text-zinc-500 group-hover:text-white" : "text-gray-400 group-hover:text-gray-700"
                        )} />
                      </div>
                    </button>
                  ))}
                </div>
                {/* 대시보드 뷰 */}
                {viewMode === 'dashboard' && stats && (
                  <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* 상단 통계 카드 (Hero) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <HeroStatCard
                        title="전체 지원사업"
                        value={stats.totalPrograms}
                        subtitle="중기부 · K-Startup · 소진공"
                        icon={Landmark}
                        gradient="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
                        onClick={() => setViewMode('list')}
                        isDark={isDark}
                      />
                      <HeroStatCard
                        title="마감 임박"
                        value={stats.endingSoonPrograms}
                        subtitle="7일 내 마감 예정"
                        icon={Flame}
                        gradient="linear-gradient(135deg, #f97316 0%, #ea580c 100%)"
                        onClick={() => {
                          setStatusFilter('active')
                          setViewMode('list')
                        }}
                        isDark={isDark}
                      />
                      <HeroStatCard
                        title="진행중 공고"
                        value={stats.activePrograms}
                        subtitle="지금 신청 가능"
                        icon={CheckCircle2}
                        gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
                        onClick={() => {
                          setStatusFilter('active')
                          setViewMode('list')
                        }}
                        isDark={isDark}
                      />
                      <HeroStatCard
                        title="AI 매칭"
                        value={userProfile ? matchedPrograms.filter(m => m.fit_score >= 80).length : '-'}
                        subtitle={userProfile ? "나에게 딱 맞는 공고" : "프로필 설정 필요"}
                        icon={Sparkles}
                        gradient="linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
                        onClick={() => setViewMode('matches')}
                        isDark={isDark}
                      />
                    </div>
                  </div>
                )}

                {/* 메인 콘텐츠 그리드 - 행별 높이 맞춤 */}
                <div className="space-y-5">
                  {/* 상단 행: 마감 임박 공고 + 통계/차트 */}
                  <div className="grid grid-cols-2 gap-5">
                    {/* 왼쪽: 마감 임박 공고 */}
                    <GlassCard className="p-6 h-full min-h-[600px] flex flex-col" isDark={isDark}>
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <Flame className="w-6 h-6 text-orange-400" />
                          <h3 className={cn("text-lg font-semibold", theme.text)}>마감 임박 공고</h3>
                          {urgentPrograms.length > 0 && (
                            <span className={cn(
                              "px-2 py-0.5 text-xs font-medium rounded-full",
                              isDark ? "bg-orange-500/20 text-orange-400" : "bg-orange-100 text-orange-600"
                            )}>
                              {urgentPrograms.length}건
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setStatusFilter('active')
                            setViewMode('list')
                          }}
                          className={cn(
                            "flex items-center gap-1 text-xs transition-colors",
                            isDark ? "text-zinc-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
                          )}
                        >
                          전체보기
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar max-h-[500px]">
                        {urgentPrograms.length > 0 ? (
                          urgentPrograms.map(program => (
                            <UrgentProgramCard
                              key={program.id}
                              program={program}
                              daysRemaining={getDaysRemaining(program.apply_end_date) || 0}
                              themeColor={themeColor}
                              isDark={isDark}
                              onClick={() => window.location.href = `/dashboard-group/company/government-programs/${program.id}`}
                            />
                          ))
                        ) : (
                          <div className={cn("text-center py-12", theme.textMuted)}>
                            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg">7일 내 마감 공고가 없습니다</p>
                          </div>
                        )}
                      </div>
                    </GlassCard>

                    {/* 오른쪽: 차트 묶음 */}
                    <div className="flex flex-col gap-5">
                      {/* 상태별 분포 & 데이터 출처 */}
                      <div className="grid grid-cols-2 gap-5 h-[280px]">
                        <GlassCard className="p-5 flex flex-col" isDark={isDark}>
                          <h3 className={cn("font-medium mb-3", theme.text)}>상태별 분포</h3>
                          <div className="flex-1 min-h-0">
                            <StatusPieChart data={stats?.statusCounts || {}} isDark={isDark} themeColor={themeColor} />
                          </div>
                        </GlassCard>

                        <GlassCard className="p-5 flex flex-col" isDark={isDark}>
                          <h3 className={cn("font-medium mb-3", theme.text)}>데이터 출처</h3>
                          <div className="flex-1 min-h-0">
                            <SourcePieChart data={stats?.sourceCounts || {}} isDark={isDark} themeColor={themeColor} />
                          </div>
                        </GlassCard>
                      </div>

                      {/* 분야별 분포 & 월별 트렌드 */}
                      <div className="grid grid-cols-2 gap-5 h-[280px]">
                        <GlassCard className="p-5 flex flex-col" isDark={isDark}>
                          <h3 className={cn("font-medium mb-3", theme.text)}>지원분야별</h3>
                          <div className="flex-1 min-h-0">
                            <CategoryChart data={stats?.categoryCounts || {}} color={themeColor} isDark={isDark} />
                          </div>
                        </GlassCard>

                        <GlassCard className="p-5 flex flex-col" isDark={isDark}>
                          <h3 className={cn("font-medium mb-3", theme.text)}>월별 수집</h3>
                          <div className="flex-1 min-h-0">
                            <MonthlyTrendChart data={stats?.monthlyTrend || []} color={themeColor} isDark={isDark} />
                          </div>
                        </GlassCard>
                      </div>
                    </div>
                  </div>

                  {/* 하단 행: AI 맞춤 추천 + 작성중 지원사업 */}
                  <div className="grid grid-cols-2 gap-5 items-stretch">
                    {/* AI 맞춤 추천 */}
                    <GlassCard className="p-6" isDark={isDark}>
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <Zap className="w-6 h-6" style={{ color: themeColor }} />
                          <h3 className={cn("text-lg font-semibold", theme.text)}>AI 맞춤 추천</h3>
                        </div>
                        {userProfile && (
                          <button
                            onClick={() => setViewMode('matches')}
                            className={cn(
                              "flex items-center gap-1 text-xs transition-colors",
                              isDark ? "text-zinc-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
                            )}
                          >
                            전체보기
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {userProfile ? (
                        <div className="space-y-3">
                          {matchedPrograms.slice(0, 3).map(match => (
                            <AIRecommendCard
                              key={match.program.id}
                              match={match}
                              themeColor={themeColor}
                              onClick={() => setViewMode('matches')}
                              isDark={isDark}
                            />
                          ))}
                          {matchedPrograms.length === 0 && !matchLoading && (
                            <div className={cn("text-center py-8", theme.textMuted)}>
                              <Target className="w-10 h-10 mx-auto mb-3 opacity-50" />
                              <p className="text-sm">매칭된 공고가 없습니다</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <div
                            className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
                            style={{ background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)` }}
                          >
                            <UserCircle2 className="w-7 h-7" style={{ color: themeColor }} />
                          </div>
                          <p className={cn("text-sm mb-4", theme.textSecondary)}>
                            프로필 설정 후 맞춤 추천
                          </p>
                          <button
                            onClick={() => setIsProfileModalOpen(true)}
                            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
                            style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
                          >
                            프로필 설정
                          </button>
                        </div>
                      )}
                    </GlassCard>

                    {/* 작성중 지원사업 */}
                    <GlassCard className="p-6" isDark={isDark}>
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <FileEdit className="w-6 h-6" style={{ color: themeColor }} />
                          <h3 className={cn("text-lg font-semibold", theme.text)}>작성중 지원사업</h3>
                        </div>
                        <button
                          onClick={() => setViewMode('list')}
                          className={cn(
                            "flex items-center gap-1 text-xs transition-colors",
                            isDark ? "text-zinc-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
                          )}
                        >
                          전체보기
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                      <div className={cn("text-center py-8", theme.textMuted)}>
                        <FileEdit className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm mb-4">작성중인 사업계획서가 없습니다</p>
                        <button
                          onClick={() => setViewMode('list')}
                          className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-90"
                          style={{
                            background: `${themeColor}20`,
                            color: themeColor
                          }}
                        >
                          지원사업 둘러보기
                        </button>
                      </div>
                    </GlassCard>
                  </div>
                </div>

                {/* ========== 상세 분석 섹션 ========== */}
                <div className="mt-10">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className={cn("text-xl font-bold", theme.text)}>상세 분석</h2>
                      <p className={cn("text-sm mt-1", theme.textSecondary)}>
                        정부지원사업 데이터의 상세 분포와 트렌드를 분석합니다
                      </p>
                    </div>
                    <div
                      className="p-2 rounded-xl"
                      style={{ backgroundColor: `${themeColor}20` }}
                    >
                      <BarChart3 className="w-5 h-5" style={{ color: themeColor }} />
                    </div>
                  </div>

                  {/* 차트 그리드 - 2x2 균일 레이아웃 */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* 1. 지원분야별 분포 */}
                    <GlassCard className="p-6" isDark={isDark}>
                      <div className="flex items-center gap-3 mb-5">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${themeColor}20` }}
                        >
                          <PieChartIcon className="w-5 h-5" style={{ color: themeColor }} />
                        </div>
                        <div>
                          <h3 className={cn("font-semibold text-base", theme.text)}>지원분야별 분포</h3>
                          <p className={cn("text-xs", theme.textMuted)}>카테고리별 공고 현황</p>
                        </div>
                      </div>
                      <div className="h-60">
                        <DetailedCategoryBarChart
                          data={stats?.categoryCounts || {}}
                          color={themeColor}
                          isDark={isDark}
                        />
                      </div>
                    </GlassCard>

                    {/* 2. 연도별 마감 추이 */}
                    <GlassCard className="p-6" isDark={isDark}>
                      <div className="flex items-center gap-3 mb-5">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${themeColor}20` }}
                        >
                          <Activity className="w-5 h-5" style={{ color: themeColor }} />
                        </div>
                        <div>
                          <h3 className={cn("font-semibold text-base", theme.text)}>연도별 마감 추이</h3>
                          <p className={cn("text-xs", theme.textMuted)}>연도별 월간 트렌드 비교</p>
                        </div>
                      </div>
                      <div className="h-60">
                        <YearlyTrendComparisonChart
                          data={stats?.deadlineTrend || []}
                          color={themeColor}
                          isDark={isDark}
                        />
                      </div>
                    </GlassCard>

                    {/* 3. 월별 마감 현황 */}
                    <GlassCard className="p-6" isDark={isDark}>
                      <div className="flex items-center gap-3 mb-5">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${themeColor}20` }}
                        >
                          <TrendingUp className="w-5 h-5" style={{ color: themeColor }} />
                        </div>
                        <div>
                          <h3 className={cn("font-semibold text-base", theme.text)}>월별 마감 현황</h3>
                          <p className={cn("text-xs", theme.textMuted)}>마감일 기준 월별 분포</p>
                        </div>
                      </div>
                      <div className="h-60">
                        <DeadlineDistributionChart
                          data={stats?.deadlineTrend || []}
                          color={themeColor}
                          isDark={isDark}
                        />
                      </div>
                    </GlassCard>

                    {/* 4. 월별 수집 현황 */}
                    <GlassCard className="p-6" isDark={isDark}>
                      <div className="flex items-center gap-3 mb-5">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${themeColor}20` }}
                        >
                          <Calendar className="w-5 h-5" style={{ color: themeColor }} />
                        </div>
                        <div>
                          <h3 className={cn("font-semibold text-base", theme.text)}>월별 수집 현황</h3>
                          <p className={cn("text-xs", theme.textMuted)}>등록일 기준 수집 추이</p>
                        </div>
                      </div>
                      <div className="h-60">
                        <SourceMonthlyChart
                          data={stats?.monthlyTrend || []}
                          sourceCounts={stats?.sourceCounts || {}}
                          color={themeColor}
                          isDark={isDark}
                        />
                      </div>
                    </GlassCard>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : viewMode === 'matches' ? (
          /* ========== Matches View ========== */
          <div className="p-6">
            {/* 프로필 요약 */}
            <div className="mb-6">
              {userProfile ? (
                <GlassCard className="p-6" isDark={isDark}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)` }}
                      >
                        <UserCircle2 className="w-7 h-7" style={{ color: themeColor }} />
                      </div>
                      <div>
                        <h2 className={cn("text-xl font-bold", theme.text)}>
                          {userProfile.industry_category || '업종 미설정'} · {userProfile.region || '지역 미설정'}
                        </h2>
                        <p className={theme.textSecondary}>
                          {userProfile.entity_type || '사업자유형 미설정'} · {userProfile.startup_stage || '단계 미설정'}
                          {userProfile.employee_count && ` · ${userProfile.employee_count}명`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={cn("text-sm", theme.textSecondary)}>프로필 완성도</div>
                        <div className="text-3xl font-bold" style={{ color: themeColor }}>
                          {userProfile.profile_completeness || 0}%
                        </div>
                      </div>
                      <button
                        onClick={() => setIsProfileModalOpen(true)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                          isDark
                            ? "bg-white/10 text-white hover:bg-white/20"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        )}
                      >
                        프로필 수정
                      </button>
                    </div>
                  </div>
                </GlassCard>
              ) : (
                <GlassCard className="p-12 text-center" isDark={isDark}>
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)` }}
                  >
                    <UserCircle2 className="w-10 h-10" style={{ color: themeColor }} />
                  </div>
                  <h2 className={cn("text-xl font-bold mb-2", theme.text)}>회사 프로필을 설정해주세요</h2>
                  <p className={cn("mb-6", theme.textSecondary)}>
                    업종, 매출, 지역 등의 정보를 입력하면<br />AI가 적합한 지원사업을 추천해드립니다
                  </p>
                  <button
                    onClick={() => setIsProfileModalOpen(true)}
                    className="px-8 py-3 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
                    style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
                  >
                    프로필 설정하기
                  </button>
                </GlassCard>
              )}
            </div>

            {userProfile && (
              <>
                {/* 매칭 통계 - 모두 테마 색상 */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <MiniStatCard label="전체 매칭" value={matchedPrograms.length} icon={Target} color={themeColor} isDark={isDark} />
                  <MiniStatCard
                    label="높은 적합도"
                    value={matchedPrograms.filter(m => m.fit_score >= 70).length}
                    icon={Award}
                    color={themeColor}
                    isDark={isDark}
                  />
                  <MiniStatCard
                    label="중간 적합도"
                    value={matchedPrograms.filter(m => m.fit_score >= 50 && m.fit_score < 70).length}
                    icon={CircleDot}
                    color={themeColor}
                    isDark={isDark}
                  />
                  <MiniStatCard
                    label="검토 필요"
                    value={matchedPrograms.filter(m => m.fit_score < 50).length}
                    icon={AlertCircle}
                    color={themeColor}
                    isDark={isDark}
                  />
                </div>

                {/* 매칭 결과 리스트 */}
                {matchLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className={cn("w-8 h-8 animate-spin", isDark ? "text-zinc-500" : "text-gray-400")} />
                  </div>
                ) : matchedPrograms.length === 0 ? (
                  <div className={cn("text-center py-16", theme.textMuted)}>
                    <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>조건에 맞는 지원사업이 없습니다</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {matchedPrograms.map(match => {
                      const { program, fit_score, fit_breakdown } = match
                      const daysRemaining = getDaysRemaining(program.apply_end_date)
                      const scoreLevel = fit_score >= 70 ? 'high' : fit_score >= 50 ? 'medium' : 'low'
                      const scoreColors = {
                        high: { ring: '#10b981', bg: 'from-emerald-500/20 to-emerald-600/5' },
                        medium: { ring: '#f59e0b', bg: 'from-amber-500/20 to-amber-600/5' },
                        low: { ring: '#71717a', bg: 'from-zinc-500/20 to-zinc-600/5' }
                      }

                      return (
                        <GlassCard key={program.id} className="p-5" isDark={isDark}>
                          <div className="flex gap-5">
                            {/* 점수 */}
                            <div className="flex-shrink-0 text-center">
                              <div
                                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-2"
                                style={{
                                  background: `linear-gradient(135deg, ${scoreColors[scoreLevel].ring}30, ${scoreColors[scoreLevel].ring}10)`,
                                  border: `2px solid ${scoreColors[scoreLevel].ring}`
                                }}
                              >
                                <span className="text-2xl font-bold" style={{ color: scoreColors[scoreLevel].ring }}>
                                  {fit_score}
                                </span>
                              </div>
                              <span className="text-xs" style={{ color: scoreColors[scoreLevel].ring }}>
                                {fit_score >= 70 ? '매우 적합' : fit_score >= 50 ? '적합' : '검토 필요'}
                              </span>
                            </div>

                            {/* 프로그램 정보 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span
                                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{
                                    backgroundColor: `${SOURCE_COLORS[program.source]}20`,
                                    color: SOURCE_COLORS[program.source]
                                  }}
                                >
                                  {program.source === 'kstartup' ? 'K-Startup' : program.source === 'semas' ? '소진공' : '기업마당'}
                                </span>
                                {program.support_type && (
                                  <span
                                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                                    style={{
                                      backgroundColor: `${SUPPORT_TYPE_COLORS[program.support_type] || SUPPORT_TYPE_COLORS['기타']}20`,
                                      color: SUPPORT_TYPE_COLORS[program.support_type] || SUPPORT_TYPE_COLORS['기타']
                                    }}
                                  >
                                    {program.support_type}
                                  </span>
                                )}
                                {program.category && (
                                  <span
                                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                                    style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                                  >
                                    {program.category}
                                  </span>
                                )}
                                {daysRemaining !== null && daysRemaining >= 0 && (
                                  <span
                                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                                    style={{
                                      background: daysRemaining <= 7 ? `${themeColor}30` :
                                        daysRemaining <= 14 ? 'rgba(245, 158, 11, 0.2)' :
                                          'rgba(16, 185, 129, 0.2)',
                                      color: daysRemaining <= 7 ? themeColor :
                                        daysRemaining <= 14 ? '#f59e0b' :
                                          '#10b981'
                                    }}
                                  >
                                    D-{daysRemaining}
                                  </span>
                                )}
                              </div>

                              <h3 className={cn("font-medium mb-2 line-clamp-2", theme.text)}>{program.title}</h3>

                              <div className={cn("flex items-center gap-4 text-sm mb-3", theme.textSecondary)}>
                                <span className="flex items-center gap-1">
                                  <Building2 className="w-3.5 h-3.5" />
                                  {program.organization}
                                </span>
                                {program.apply_start_date && program.apply_end_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {program.apply_start_date} ~ {program.apply_end_date}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-1.5 mb-4">
                                {fit_breakdown.reasons.slice(0, 4).map((reason, idx) => (
                                  <span key={idx} className={cn(
                                    "px-2 py-1 rounded-lg text-xs",
                                    isDark ? "bg-white/5 text-zinc-400" : "bg-gray-100 text-gray-600"
                                  )}>
                                    ✓ {reason}
                                  </span>
                                ))}
                              </div>

                              {/* 적합도 바 */}
                              <div className="grid grid-cols-5 gap-3 text-xs">
                                {[
                                  { label: '업종', score: fit_breakdown.industry_match, max: 30 },
                                  { label: '규모', score: fit_breakdown.scale_match, max: 20 },
                                  { label: '지역', score: fit_breakdown.region_match, max: 15 },
                                  { label: '유형', score: fit_breakdown.type_match, max: 15 },
                                  { label: '특수', score: fit_breakdown.special_match, max: 20 }
                                ].map(item => (
                                  <div key={item.label}>
                                    <div className={cn("flex justify-between mb-1", theme.textMuted)}>
                                      <span>{item.label}</span>
                                      <span>{item.score}/{item.max}</span>
                                    </div>
                                    <div className={cn("h-1.5 rounded-full overflow-hidden", isDark ? "bg-white/5" : "bg-gray-200")}>
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${(item.score / item.max) * 100}%`,
                                          background: `linear-gradient(90deg, ${themeColor}, ${themeColor}80)`
                                        }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* 액션 버튼 */}
                            <div className="flex flex-col gap-2 flex-shrink-0">
                              <button
                                onClick={() => router.push(`/dashboard-group/company/government-programs/${program.id}`)}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
                                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
                              >
                                상세보기
                                <ChevronRight className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => router.push(`/dashboard-group/company/government-programs/business-plan?program_id=${program.id}`)}
                                className={cn(
                                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                                  isDark
                                    ? "bg-white/5 text-zinc-300 hover:bg-white/10"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                )}
                              >
                                <FileText className="w-4 h-4" />
                                계획서 작성
                              </button>
                              <button className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                                isDark
                                  ? "bg-white/5 text-zinc-300 hover:bg-white/10"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              )}>
                                <Bookmark className="w-4 h-4" />
                                저장
                              </button>
                            </div>
                          </div>
                        </GlassCard>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        ) : viewMode === 'knowledge' ? (
          /* ========== Knowledge Base View ========== */
          <KnowledgeBasePanel isDark={isDark} themeColor={themeColor} />
        ) : (
          /* ========== List View ========== */
          <div className="flex h-full">
            {/* Sidebar */}
            <div className={cn(
              "w-72 border-r p-5 overflow-y-auto",
              isDark ? "border-white/5" : "border-gray-200"
            )}>
              {/* 검색 */}
              <div className="relative mb-6">
                <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", theme.textMuted)} />
                <input
                  type="text"
                  placeholder="공고 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all",
                    isDark
                      ? "bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:border-white/20"
                      : "bg-gray-100 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-300"
                  )}
                />
              </div>

              {/* 상태 필터 */}
              <div className="mb-6">
                <h3 className={cn("text-xs font-semibold uppercase tracking-wider mb-3", theme.textMuted)}>상태</h3>
                <div className="space-y-1">
                  {[
                    { id: 'active', label: '진행중', icon: CheckCircle2, color: '#10b981' },
                    { id: 'upcoming', label: '예정', icon: Clock, color: '#6366f1' },
                    { id: 'ended', label: '마감', icon: AlertCircle, color: '#71717a' },
                    { id: 'all', label: '전체', icon: Filter, color: '#a1a1aa' }
                  ].map(status => (
                    <button
                      key={status.id}
                      onClick={() => setStatusFilter(status.id as StatusFilter)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all",
                        statusFilter === status.id
                          ? ""
                          : isDark ? "text-zinc-400 hover:bg-white/5" : "text-gray-600 hover:bg-gray-100"
                      )}
                      style={statusFilter === status.id ? {
                        backgroundColor: `${status.color}20`,
                        color: status.color
                      } : undefined}
                    >
                      <status.icon className="w-4 h-4" />
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 소스 필터 */}
              <div className="mb-6">
                <h3 className={cn("text-xs font-semibold uppercase tracking-wider mb-3", theme.textMuted)}>데이터 소스</h3>
                <div className="space-y-1">
                  {SOURCES.map(source => (
                    <button
                      key={source.id}
                      onClick={() => setSourceFilter(source.id as SourceFilter)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all",
                        sourceFilter === source.id
                          ? ""
                          : isDark ? "text-zinc-400 hover:bg-white/5" : "text-gray-600 hover:bg-gray-100"
                      )}
                      style={sourceFilter === source.id ? {
                        backgroundColor: `${source.color}20`,
                        color: source.color
                      } : undefined}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: source.color }}
                      />
                      {source.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 분야 필터 */}
              <div>
                <h3 className={cn("text-xs font-semibold uppercase tracking-wider mb-3", theme.textMuted)}>분야</h3>
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all",
                      !selectedCategory
                        ? ""
                        : isDark ? "text-zinc-400 hover:bg-white/5" : "text-gray-600 hover:bg-gray-100"
                    )}
                    style={!selectedCategory ? {
                      backgroundColor: `${themeColor}20`,
                      color: themeColor
                    } : undefined}
                  >
                    <span>전체</span>
                    <span className="text-xs opacity-60">{stats?.totalPrograms || 0}</span>
                  </button>
                  {categories.map(cat => {
                    const Icon = CATEGORY_ICONS[cat] || Settings
                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all",
                          selectedCategory === cat
                            ? ""
                            : isDark ? "text-zinc-400 hover:bg-white/5" : "text-gray-600 hover:bg-gray-100"
                        )}
                        style={selectedCategory === cat ? {
                          backgroundColor: `${themeColor}20`,
                          color: themeColor
                        } : undefined}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span>{cat}</span>
                        </div>
                        <span className="text-xs opacity-60">{stats?.categoryCounts?.[cat] || 0}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* 프로그램 리스트 */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className={cn("w-8 h-8 animate-spin", theme.textMuted)} />
                </div>
              ) : programs.length === 0 ? (
                <div className={cn("flex flex-col items-center justify-center h-64", theme.textMuted)}>
                  <Landmark className="w-12 h-12 mb-4 opacity-50" />
                  <p>공고가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {programs.map(program => {
                    const status = getStatus(program)
                    const daysRemaining = getDaysRemaining(program.apply_end_date)
                    const Icon = CATEGORY_ICONS[program.category] || Settings

                    return (
                      <GlassCard key={program.id} className="p-4 hover:scale-[1.01] transition-transform" isDark={isDark}>
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: `${SOURCE_COLORS[program.source]}20`,
                                  color: SOURCE_COLORS[program.source]
                                }}
                              >
                                {program.source === 'kstartup' ? 'K-Startup' : program.source === 'semas' ? '소진공' : '기업마당'}
                              </span>
                              {program.support_type && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{
                                    backgroundColor: `${SUPPORT_TYPE_COLORS[program.support_type] || SUPPORT_TYPE_COLORS['기타']}20`,
                                    color: SUPPORT_TYPE_COLORS[program.support_type] || SUPPORT_TYPE_COLORS['기타']
                                  }}
                                >
                                  {program.support_type}
                                </span>
                              )}
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
                                style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                              >
                                <Icon className="w-3 h-3" />
                                {program.category}
                              </span>
                              {status === 'active' && daysRemaining !== null && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{
                                    background: daysRemaining <= 7 ? `${themeColor}30` :
                                      daysRemaining <= 14 ? 'rgba(245, 158, 11, 0.2)' :
                                        'rgba(16, 185, 129, 0.2)',
                                    color: daysRemaining <= 7 ? themeColor :
                                      daysRemaining <= 14 ? '#f59e0b' :
                                        '#10b981'
                                  }}
                                >
                                  D-{daysRemaining}
                                </span>
                              )}
                              {status === 'upcoming' && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/20 text-accent">예정</span>
                              )}
                              {status === 'ended' && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-500/20 text-zinc-400">마감</span>
                              )}
                            </div>

                            <h3 className={cn("font-medium mb-2 line-clamp-2", theme.text)}>{program.title}</h3>

                            <div className={cn("flex items-center gap-4 text-sm", theme.textSecondary)}>
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5" />
                                {program.organization}
                              </span>
                              {program.apply_start_date && program.apply_end_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {program.apply_start_date} ~ {program.apply_end_date}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => router.push(`/dashboard-group/company/government-programs/${program.id}`)}
                              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90"
                              style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
                            >
                              상세보기
                              <ChevronRight className="w-3 h-3" />
                            </button>
                            <button className={cn(
                              "p-2 rounded-lg transition-all",
                              isDark
                                ? "bg-white/5 text-zinc-400 hover:bg-white/10"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            )}>
                              <Bookmark className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </GlassCard>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 프로필 설정 모달 */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onSave={() => {
          fetchProfile()
          if (viewMode === 'matches') {
            fetchMatches()
          }
        }}
      />
    </div>
  )
}
