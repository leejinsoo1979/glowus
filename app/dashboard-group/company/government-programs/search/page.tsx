'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Search, Calendar, Building2, Bookmark, BookmarkCheck,
  ChevronRight, Loader2, X,
  Banknote, Beaker, Building, Users, GraduationCap, Landmark, UserPlus, MoreHorizontal,
  Clock, CheckCircle2, XCircle
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

interface Program {
  id: string
  title: string
  organization: string
  category: string
  status: string
  apply_start_date: string | null
  apply_end_date: string | null
  support_amount: string | null
  support_type: string | null
  target_industries: string[] | null
  source: string
}

// 지원유형 필터 (메인 필터)
const SUPPORT_TYPES = [
  { id: '', label: '전체', icon: MoreHorizontal, color: '#71717a' },
  { id: '사업화', label: '사업화', icon: Banknote, color: '#3b82f6' },
  { id: '기술개발', label: '기술개발', icon: Beaker, color: '#8b5cf6' },
  { id: '시설보육', label: '시설/보육', icon: Building, color: '#ec4899' },
  { id: '멘토링', label: '멘토링', icon: Users, color: '#10b981' },
  { id: '행사', label: '교육/행사', icon: GraduationCap, color: '#f59e0b' },
  { id: '융자보증', label: '융자/보증', icon: Landmark, color: '#ef4444' },
  { id: '인력', label: '인력지원', icon: UserPlus, color: '#06b6d4' },
]

// 상태 필터
const STATUS_FILTERS = [
  { id: '', label: '전체', icon: MoreHorizontal },
  { id: 'active', label: '진행중', icon: CheckCircle2 },
  { id: 'upcoming', label: '예정', icon: Clock },
  { id: 'ended', label: '마감', icon: XCircle },
]

// 출처 필터
const SOURCES = [
  { id: '', label: '전체' },
  { id: 'bizinfo', label: '기업마당' },
  { id: 'kstartup', label: 'K-Startup' },
]

export default function SearchPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { themeColor } = useThemeStore()

  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSupportType, setSelectedSupportType] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedSource, setSelectedSource] = useState('')
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchPrograms()
    fetchBookmarks()
  }, [selectedSupportType, selectedStatus, selectedSource])

  const fetchPrograms = async () => {
    try {
      setLoading(true)
      let url = '/api/government-programs?limit=200'

      if (selectedSource) {
        url += `&source=${selectedSource}`
      }
      if (selectedStatus) {
        url += `&status=${selectedStatus}`
      }
      if (selectedSupportType) {
        url += `&support_type=${encodeURIComponent(selectedSupportType)}`
      }

      const res = await fetch(url)
      const data = await res.json()
      let filtered = data.programs || []

      // 검색어 필터링 (보조)
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        filtered = filtered.filter((p: Program) =>
          p.title.toLowerCase().includes(term) ||
          p.organization?.toLowerCase().includes(term)
        )
      }

      setPrograms(filtered)
    } catch (error) {
      console.error('Failed to fetch programs:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBookmarks = async () => {
    try {
      const res = await fetch('/api/government-programs/bookmarks')
      const data = await res.json()
      const ids = new Set<string>(data.bookmarks?.map((b: any) => b.program_id) || [])
      setBookmarkedIds(ids)
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error)
    }
  }

  const toggleBookmark = async (e: React.MouseEvent, programId: string) => {
    e.stopPropagation()
    try {
      if (bookmarkedIds.has(programId)) {
        await fetch(`/api/government-programs/bookmarks?program_id=${programId}`, {
          method: 'DELETE'
        })
        setBookmarkedIds(prev => {
          const next = new Set(prev)
          next.delete(programId)
          return next
        })
      } else {
        await fetch('/api/government-programs/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ program_id: programId })
        })
        setBookmarkedIds(prev => new Set([...prev, programId]))
      }
    } catch (error) {
      console.error('Failed to toggle bookmark:', error)
    }
  }

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null
    const end = new Date(endDate)
    const today = new Date()
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  const getStatusColor = (program: Program) => {
    const days = getDaysRemaining(program.apply_end_date)
    if (days === null) return '#71717a'
    if (days < 0) return '#71717a'
    if (days <= 7) return '#ef4444'
    if (days <= 14) return '#f59e0b'
    return '#10b981'
  }

  const getSupportTypeInfo = (type: string | null) => {
    return SUPPORT_TYPES.find(t => t.id === type) || SUPPORT_TYPES[0]
  }

  return (
    <div className={cn("min-h-screen", isDark ? "bg-[#0a0a0f]" : "bg-gray-50")}>
      <div className="flex h-screen">
        {/* 왼쪽 필터 사이드바 */}
        <div className={cn(
          "w-72 border-r p-5 overflow-y-auto flex-shrink-0",
          isDark ? "border-white/10 bg-black/20" : "border-gray-200 bg-white"
        )}>
          {/* 검색 (보조) */}
          <div className="relative mb-6">
            <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", isDark ? "text-zinc-500" : "text-gray-400")} />
            <input
              type="text"
              placeholder="공고명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchPrograms()}
              className={cn(
                "w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all",
                isDark
                  ? "bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:border-white/20"
                  : "bg-gray-100 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-300"
              )}
            />
          </div>

          {/* 지원유형 필터 (메인) */}
          <div className="mb-6">
            <h3 className={cn("text-xs font-semibold uppercase tracking-wider mb-3", isDark ? "text-zinc-500" : "text-gray-500")}>
              지원유형
            </h3>
            <div className="space-y-1">
              {SUPPORT_TYPES.map(type => {
                const Icon = type.icon
                const isSelected = selectedSupportType === type.id
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedSupportType(type.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all",
                      isSelected
                        ? ""
                        : isDark ? "text-zinc-400 hover:bg-white/5" : "text-gray-600 hover:bg-gray-100"
                    )}
                    style={isSelected ? {
                      backgroundColor: `${type.color}20`,
                      color: type.color
                    } : undefined}
                  >
                    <Icon className="w-4 h-4" />
                    {type.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 상태 필터 */}
          <div className="mb-6">
            <h3 className={cn("text-xs font-semibold uppercase tracking-wider mb-3", isDark ? "text-zinc-500" : "text-gray-500")}>
              진행상태
            </h3>
            <div className="space-y-1">
              {STATUS_FILTERS.map(status => {
                const Icon = status.icon
                const isSelected = selectedStatus === status.id
                return (
                  <button
                    key={status.id}
                    onClick={() => setSelectedStatus(status.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all",
                      isSelected
                        ? ""
                        : isDark ? "text-zinc-400 hover:bg-white/5" : "text-gray-600 hover:bg-gray-100"
                    )}
                    style={isSelected ? {
                      backgroundColor: `${themeColor}20`,
                      color: themeColor
                    } : undefined}
                  >
                    <Icon className="w-4 h-4" />
                    {status.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 출처 필터 */}
          <div>
            <h3 className={cn("text-xs font-semibold uppercase tracking-wider mb-3", isDark ? "text-zinc-500" : "text-gray-500")}>
              데이터 출처
            </h3>
            <div className="space-y-1">
              {SOURCES.map(source => {
                const isSelected = selectedSource === source.id
                return (
                  <button
                    key={source.id}
                    onClick={() => setSelectedSource(source.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all",
                      isSelected
                        ? ""
                        : isDark ? "text-zinc-400 hover:bg-white/5" : "text-gray-600 hover:bg-gray-100"
                    )}
                    style={isSelected ? {
                      backgroundColor: `${themeColor}20`,
                      color: themeColor
                    } : undefined}
                  >
                    {source.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* 오른쪽 결과 리스트 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                공고 검색
              </h1>
              <p className={cn("text-sm", isDark ? "text-zinc-400" : "text-gray-500")}>
                {programs.length}개의 공고
              </p>
            </div>

            {/* 선택된 필터 표시 */}
            <div className="flex items-center gap-2">
              {selectedSupportType && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1"
                  style={{
                    backgroundColor: `${getSupportTypeInfo(selectedSupportType).color}20`,
                    color: getSupportTypeInfo(selectedSupportType).color
                  }}
                >
                  {getSupportTypeInfo(selectedSupportType).label}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedSupportType('')} />
                </span>
              )}
              {selectedStatus && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1"
                  style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                >
                  {STATUS_FILTERS.find(s => s.id === selectedStatus)?.label}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedStatus('')} />
                </span>
              )}
            </div>
          </div>

          {/* 결과 리스트 */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className={cn("w-8 h-8 animate-spin", isDark ? "text-zinc-500" : "text-gray-400")} />
            </div>
          ) : programs.length === 0 ? (
            <div className={cn("flex flex-col items-center justify-center h-64", isDark ? "text-zinc-500" : "text-gray-400")}>
              <Search className="w-12 h-12 mb-4 opacity-50" />
              <p>검색 결과가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {programs.map((program, index) => {
                const daysRemaining = getDaysRemaining(program.apply_end_date)
                const isExpired = daysRemaining !== null && daysRemaining < 0
                const isBookmarked = bookmarkedIds.has(program.id)
                const supportTypeInfo = getSupportTypeInfo(program.support_type)

                return (
                  <motion.div
                    key={program.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => router.push(`/dashboard-group/company/government-programs?id=${program.id}`)}
                    className={cn(
                      "p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01]",
                      isDark
                        ? "bg-white/5 border-white/10 hover:bg-white/10"
                        : "bg-white border-gray-200 hover:shadow-md",
                      isExpired && "opacity-50"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {/* 뱃지들 */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {/* 지원유형 뱃지 */}
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${supportTypeInfo.color}20`,
                              color: supportTypeInfo.color
                            }}
                          >
                            {program.support_type || '기타'}
                          </span>
                          {/* 출처 뱃지 */}
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs",
                            isDark ? "bg-zinc-800 text-zinc-400" : "bg-gray-100 text-gray-500"
                          )}>
                            {program.source === 'kstartup' ? 'K-Startup' : '기업마당'}
                          </span>
                          {/* D-day 뱃지 */}
                          {daysRemaining !== null && !isExpired && (
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: `${getStatusColor(program)}20`,
                                color: getStatusColor(program)
                              }}
                            >
                              D-{daysRemaining}
                            </span>
                          )}
                          {isExpired && (
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-xs",
                              isDark ? "bg-zinc-800 text-zinc-500" : "bg-gray-100 text-gray-400"
                            )}>
                              마감
                            </span>
                          )}
                        </div>

                        {/* 제목 */}
                        <h3 className={cn("font-medium mb-2 line-clamp-2", isDark ? "text-white" : "text-gray-900")}>
                          {program.title}
                        </h3>

                        {/* 메타 정보 */}
                        <div className={cn("flex items-center gap-4 text-sm", isDark ? "text-zinc-400" : "text-gray-500")}>
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {program.organization}
                          </span>
                          {program.apply_end_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              ~{program.apply_end_date}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        <button
                          onClick={(e) => toggleBookmark(e, program.id)}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            isBookmarked
                              ? "bg-amber-500/20 text-amber-400"
                              : isDark ? "bg-white/5 text-zinc-400 hover:bg-white/10" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                          )}
                        >
                          {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard-group/company/government-programs/${program.id}`)}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90"
                          style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
                        >
                          상세보기
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
