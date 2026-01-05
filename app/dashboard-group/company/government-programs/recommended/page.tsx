'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles, RefreshCw, Bookmark, BookmarkCheck, ExternalLink,
  Calendar, Building2, TrendingUp, AlertCircle, Zap
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import Link from 'next/link'

interface MatchResult {
  fit_score: number
  fit_breakdown: {
    industry_match: number
    scale_match: number
    region_match: number
    type_match: number
    special_match: number
    reasons: string[]
  }
  program: {
    id: string
    title: string
    organization: string
    category: string
    status: string
    apply_start_date: string | null
    apply_end_date: string | null
    support_amount: string | null
    detail_url: string | null
  }
}

export default function RecommendedPage() {
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [minScore, setMinScore] = useState(40)
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchMatches()
    fetchBookmarks()
  }, [minScore])

  const fetchMatches = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/government-programs/match?min_score=${minScore}&limit=50`)
      const data = await res.json()
      setMatches(data.matches || [])
    } catch (error) {
      console.error('Failed to fetch matches:', error)
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

  const toggleBookmark = async (programId: string) => {
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
          body: JSON.stringify({ program_id: programId, priority: 1 })
        })
        setBookmarkedIds(prev => new Set([...prev, programId]))
      }
    } catch (error) {
      console.error('Failed to toggle bookmark:', error)
    }
  }

  // 점수 breakdown 텍스트 생성
  const getScoreBreakdown = (breakdown: MatchResult['fit_breakdown']) => {
    const items = [
      { label: '업종', score: breakdown.industry_match, max: 30 },
      { label: '규모', score: breakdown.scale_match, max: 20 },
      { label: '지역', score: breakdown.region_match, max: 15 },
      { label: '유형', score: breakdown.type_match, max: 15 },
      { label: '특수', score: breakdown.special_match, max: 20 },
    ]
    return items
  }

  const refresh = async () => {
    setRefreshing(true)
    await fetchMatches()
    setRefreshing(false)
  }

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null
    const end = new Date(endDate)
    const today = new Date()
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  // 테마색 기반 점수 색상 (밝기 조절)
  const getScoreColor = (score: number) => {
    // 점수에 따라 테마색의 밝기/채도 조절
    if (score >= 80) return themeColor // 높은 점수 = 테마색 100%
    if (score >= 60) return themeColor // 중상 점수 = 테마색
    if (score >= 40) return `${themeColor}cc` // 중간 점수 = 테마색 80%
    return `${themeColor}66` // 낮은 점수 = 테마색 40%
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return '적극 추천'
    if (score >= 60) return '추천'
    if (score >= 40) return '검토 권장'
    return '참고'
  }

  const getScoreBgOpacity = (score: number) => {
    if (score >= 80) return '25'
    if (score >= 60) return '20'
    if (score >= 40) return '15'
    return '10'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
          style={{ borderColor: themeColor }} />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${themeColor}20` }}>
            <Sparkles className="w-6 h-6" style={{ color: themeColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI 추천 공고</h1>
            <p className="text-sm text-zinc-400">회사 프로필 기반 맞춤 추천</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={minScore}
            onChange={e => setMinScore(Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
          >
            <option value={0}>모든 점수</option>
            <option value={40}>40점 이상</option>
            <option value={60}>60점 이상</option>
            <option value={80}>80점 이상</option>
          </select>

          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {/* 점수 분포 - 테마색 기반 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { min: 80, max: 100, label: '적극 추천', opacity: 1 },
          { min: 60, max: 79, label: '추천', opacity: 0.8 },
          { min: 40, max: 59, label: '검토 권장', opacity: 0.6 },
          { min: 0, max: 39, label: '참고', opacity: 0.4 },
        ].map((range, index) => {
          const count = matches.filter(m => m.fit_score >= range.min && m.fit_score <= range.max).length
          return (
            <motion.div
              key={range.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center hover:border-zinc-700 transition-colors"
              style={{ borderColor: count > 0 ? `${themeColor}30` : undefined }}
            >
              <div
                className="text-2xl font-bold"
                style={{ color: themeColor, opacity: range.opacity }}
              >
                {count}
              </div>
              <div className="text-sm text-zinc-400">{range.label}</div>
              <div className="text-xs text-zinc-500 mt-1">{range.min}-{range.max}점</div>
            </motion.div>
          )
        })}
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>추천할 공고가 없습니다</p>
          <p className="text-sm mt-2">회사 프로필을 먼저 등록해주세요</p>
          <Link
            href="/dashboard-group/company/government-programs/profile"
            className="mt-4 inline-block px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
          >
            프로필 설정하기
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {matches.map((match, index) => {
            const daysRemaining = getDaysRemaining(match.program.apply_end_date)
            const isUrgent = daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0
            const isExpired = daysRemaining !== null && daysRemaining < 0
            const isBookmarked = bookmarkedIds.has(match.program.id)
            const reasons = match.fit_breakdown?.reasons || []

            return (
              <motion.div
                key={match.program.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all ${
                  isExpired ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start gap-5">
                  {/* 점수 - 원형 게이지 스타일 (테마색 적용) */}
                  <div className="flex-shrink-0">
                    <div
                      className="relative w-20 h-20 rounded-2xl flex flex-col items-center justify-center border-2 shadow-lg"
                      style={{
                        backgroundColor: `${themeColor}${getScoreBgOpacity(match.fit_score)}`,
                        borderColor: `${themeColor}50`,
                        boxShadow: `0 4px 20px ${themeColor}20`
                      }}
                    >
                      {/* 배경 원형 프로그레스 */}
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                        <circle
                          cx="40"
                          cy="40"
                          r="32"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-zinc-800"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="32"
                          fill="none"
                          stroke={themeColor}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={`${(match.fit_score / 100) * 201} 201`}
                          style={{ opacity: match.fit_score >= 60 ? 1 : 0.7 }}
                          className="transition-all duration-500"
                        />
                      </svg>
                      <div
                        className="text-2xl font-bold z-10"
                        style={{ color: themeColor }}
                      >
                        {match.fit_score}
                      </div>
                      <div className="text-[10px] text-zinc-500 z-10 -mt-1">SCORE</div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: `${themeColor}20`,
                          color: themeColor
                        }}
                      >
                        {getScoreLabel(match.fit_score)}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-400">
                        {match.program.category}
                      </span>
                      {isUrgent && (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          D-{daysRemaining}
                        </span>
                      )}
                      {isExpired && (
                        <span className="px-2 py-0.5 rounded text-xs bg-zinc-700 text-zinc-500">
                          마감됨
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-2 truncate">
                      {match.program.title}
                    </h3>

                    <div className="flex items-center gap-4 text-sm text-zinc-400 mb-3">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {match.program.organization}
                      </span>
                      {match.program.apply_end_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          ~{match.program.apply_end_date}
                        </span>
                      )}
                      {match.program.support_amount && (
                        <span className="flex items-center gap-1">
                          💰 {match.program.support_amount}
                        </span>
                      )}
                    </div>

                    {/* 점수 breakdown 바 */}
                    {match.fit_breakdown && (
                      <div className="flex items-center gap-1 mb-2">
                        {getScoreBreakdown(match.fit_breakdown).map((item, idx) => (
                          <div key={idx} className="flex items-center gap-1" title={`${item.label}: ${item.score}/${item.max}`}>
                            <div className="w-12 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${(item.score / item.max) * 100}%`,
                                  backgroundColor: themeColor,
                                  opacity: 0.5 + (item.score / item.max) * 0.5
                                }}
                              />
                            </div>
                          </div>
                        ))}
                        <span className="text-[10px] text-zinc-600 ml-1">
                          업종·규모·지역·유형·특수
                        </span>
                      </div>
                    )}

                    {/* 추천 이유 */}
                    {reasons.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {reasons.slice(0, 3).map((reason, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 rounded-lg bg-zinc-800/80 text-zinc-400"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleBookmark(match.program.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        isBookmarked
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                      }`}
                    >
                      {isBookmarked ? (
                        <BookmarkCheck className="w-5 h-5" />
                      ) : (
                        <Bookmark className="w-5 h-5" />
                      )}
                    </button>
                    <Link
                      href={`/dashboard-group/company/government-programs?id=${match.program.id}`}
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
