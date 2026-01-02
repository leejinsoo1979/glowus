'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  RefreshCw,
  Filter,
  ExternalLink,
  Calendar,
  Building2,
  Tag,
  Bell,
  BellOff,
  ChevronDown,
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
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore, accentColors } from '@/stores/themeStore'

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

// 프로그램 타입
interface GovernmentProgram {
  id: string
  program_id: string
  title: string
  category: string
  hashtags: string[]
  organization: string
  executing_agency?: string
  reception_agency?: string
  apply_start_date?: string
  apply_end_date?: string
  detail_url?: string
  source: string
  created_at: string
}

type StatusFilter = 'all' | 'active' | 'upcoming' | 'ended'

export default function GovernmentProgramsPage() {
  // 테마 설정
  const { accentColor } = useThemeStore()
  const themeColor = accentColors.find(c => c.id === accentColor)?.color || '#3b82f6'

  // 상태
  const [programs, setPrograms] = useState<GovernmentProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [categoryStats, setCategoryStats] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [showFilters, setShowFilters] = useState(false)

  // 데이터 로드
  const fetchPrograms = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCategory) params.append('category', selectedCategory)
      if (searchQuery) params.append('search', searchQuery)
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const response = await fetch(`/api/government-programs?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setPrograms(data.programs)
        setCategoryStats(data.categoryStats || {})
        setTotal(data.total)
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, searchQuery, statusFilter])

  useEffect(() => {
    fetchPrograms()
  }, [fetchPrograms])

  // 동기화
  const syncPrograms = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/government-programs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullSync: false })
      })
      const data = await response.json()

      if (data.success) {
        alert(data.message)
        fetchPrograms()
      } else {
        alert('동기화 실패: ' + data.error)
      }
    } catch (error) {
      console.error('동기화 실패:', error)
      alert('동기화 중 오류가 발생했습니다.')
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

  // 카테고리 목록
  const categories = Object.keys(categoryStats).sort((a, b) => categoryStats[b] - categoryStats[a])

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="h-16 flex-shrink-0 border-b border-zinc-800 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white">정부지원사업</h1>
          <span className="text-sm text-zinc-500">기업마당 연동</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncPrograms}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: `${themeColor}20`,
              color: themeColor
            }}
          >
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            {syncing ? '동기화 중...' : '새로고침'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - 카테고리 필터 */}
        <div className="w-64 border-r border-zinc-800 p-4 overflow-y-auto">
          {/* 검색 */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="공고 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
            />
          </div>

          {/* 상태 필터 */}
          <div className="mb-6">
            <h3 className="text-xs font-medium text-zinc-500 uppercase mb-2">상태</h3>
            <div className="space-y-1">
              {[
                { id: 'active', label: '진행중', icon: CheckCircle2, color: '#22c55e' },
                { id: 'upcoming', label: '예정', icon: Clock, color: '#3b82f6' },
                { id: 'ended', label: '마감', icon: AlertCircle, color: '#71717a' },
                { id: 'all', label: '전체', icon: Filter, color: '#a1a1aa' }
              ].map(status => (
                <button
                  key={status.id}
                  onClick={() => setStatusFilter(status.id as StatusFilter)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                    statusFilter === status.id
                      ? "text-white"
                      : "text-zinc-400 hover:bg-zinc-800/50"
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

          {/* 분야별 필터 */}
          <div>
            <h3 className="text-xs font-medium text-zinc-500 uppercase mb-2">분야</h3>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all",
                  !selectedCategory
                    ? "text-white"
                    : "text-zinc-400 hover:bg-zinc-800/50"
                )}
                style={!selectedCategory ? {
                  backgroundColor: `${themeColor}20`,
                  color: themeColor
                } : undefined}
              >
                <span>전체</span>
                <span className="text-xs opacity-60">{total}</span>
              </button>
              {categories.map(cat => {
                const Icon = CATEGORY_ICONS[cat] || Settings
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all",
                      selectedCategory === cat
                        ? "text-white"
                        : "text-zinc-400 hover:bg-zinc-800/50"
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
                    <span className="text-xs opacity-60">{categoryStats[cat]}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
          ) : programs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
              <Landmark className="w-12 h-12 mb-4 opacity-50" />
              <p>공고가 없습니다</p>
              <button
                onClick={syncPrograms}
                className="mt-4 text-sm hover:underline"
                style={{ color: themeColor }}
              >
                데이터 동기화하기
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {programs.map(program => {
                const status = getStatus(program)
                const daysRemaining = getDaysRemaining(program.apply_end_date)
                const Icon = CATEGORY_ICONS[program.category] || Settings

                return (
                  <div
                    key={program.id}
                    className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* 카테고리 & 상태 */}
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              backgroundColor: `${themeColor}20`,
                              color: themeColor
                            }}
                          >
                            <Icon className="w-3 h-3" />
                            {program.category}
                          </span>
                          {status === 'active' && daysRemaining !== null && (
                            <span className={cn(
                              "px-2 py-0.5 rounded text-xs font-medium",
                              daysRemaining <= 7 ? "bg-red-500/20 text-red-400" :
                              daysRemaining <= 14 ? "bg-yellow-500/20 text-yellow-400" :
                              "bg-green-500/20 text-green-400"
                            )}>
                              D-{daysRemaining}
                            </span>
                          )}
                          {status === 'upcoming' && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
                              예정
                            </span>
                          )}
                          {status === 'ended' && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-zinc-700 text-zinc-400">
                              마감
                            </span>
                          )}
                        </div>

                        {/* 제목 */}
                        <h3 className="text-white font-medium mb-2 group-hover:text-zinc-100 line-clamp-2">
                          {program.title}
                        </h3>

                        {/* 기관 정보 */}
                        <div className="flex items-center gap-4 text-sm text-zinc-500 mb-2">
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

                        {/* 해시태그 */}
                        {program.hashtags?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {program.hashtags.slice(0, 5).map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex flex-col gap-2">
                        <a
                          href={program.detail_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                          style={{
                            backgroundColor: themeColor,
                            color: 'white'
                          }}
                        >
                          상세보기
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
