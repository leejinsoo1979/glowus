'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Trophy, Calendar, Building2, CheckCircle, XCircle,
  Clock, Download, ArrowRight, Sparkles
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import Link from 'next/link'

interface Result {
  id: string
  application_number: string | null
  status: string
  result: string | null
  result_announced_at: string | null
  selected_amount: number | null
  selection_rank: number | null
  feedback: string | null
  program?: {
    id: string
    title: string
    organization: string
    category: string
    support_amount: string | null
  }
}

const RESULT_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  selected: { label: '최종 선정', color: '#10b981', bgColor: '#064e3b', icon: Trophy },
  reserved: { label: '예비 선정', color: '#8b5cf6', bgColor: '#3b0764', icon: Clock },
  rejected: { label: '미선정', color: '#ef4444', bgColor: '#450a0a', icon: XCircle },
  pending: { label: '결과대기', color: '#71717a', bgColor: '#27272a', icon: Clock },
}

export default function ResultsPage() {
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [filterResult, setFilterResult] = useState<string>('')
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchResults()
  }, [filterResult])

  const fetchResults = async () => {
    try {
      const res = await fetch('/api/government-programs/applications?include_results=true')
      const data = await res.json()
      // Filter applications with results
      let filtered = (data.applications || []).filter((a: Result) =>
        ['selected', 'reserved', 'rejected', 'pending'].includes(a.status)
      )
      if (filterResult) {
        filtered = filtered.filter((a: Result) => a.status === filterResult)
      }
      setResults(filtered)
    } catch (error) {
      console.error('Failed to fetch results:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('ko-KR').format(amount) + '원'
  }

  // 통계 계산
  const stats = {
    total: results.length,
    selected: results.filter(r => r.status === 'selected').length,
    reserved: results.filter(r => r.status === 'reserved').length,
    rejected: results.filter(r => r.status === 'rejected').length,
    totalAmount: results
      .filter(r => r.status === 'selected')
      .reduce((sum, r) => sum + (r.selected_amount || 0), 0)
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
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${themeColor}20` }}>
          <Trophy className="w-6 h-6" style={{ color: themeColor }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">선정 결과</h1>
          <p className="text-sm text-zinc-400">지원사업 선정 결과를 확인합니다</p>
        </div>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterResult('')}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            !filterResult ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          전체
        </button>
        {Object.entries(RESULT_CONFIG).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setFilterResult(key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filterResult === key ? 'text-white' : 'text-zinc-400 hover:text-white'
            }`}
            style={filterResult === key ? { backgroundColor: config.bgColor, color: config.color } : {}}
          >
            {config.label}
          </button>
        ))}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
        >
          <div className="text-sm text-zinc-400 mb-1">선정률</div>
          <div className="text-3xl font-bold" style={{ color: themeColor }}>
            {stats.total > 0 ? Math.round((stats.selected / stats.total) * 100) : 0}%
          </div>
          <div className="text-sm text-zinc-500 mt-1">
            {stats.selected}/{stats.total}건 선정
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
        >
          <div className="text-sm text-zinc-400 mb-1">총 선정금액</div>
          <div className="text-2xl font-bold text-emerald-400">
            {formatCurrency(stats.totalAmount)}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
        >
          <div className="text-sm text-zinc-400 mb-1">예비 선정</div>
          <div className="text-3xl font-bold text-purple-400">{stats.reserved}</div>
          <div className="text-sm text-zinc-500 mt-1">건</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
        >
          <div className="text-sm text-zinc-400 mb-1">미선정</div>
          <div className="text-3xl font-bold text-zinc-400">{stats.rejected}</div>
          <div className="text-sm text-zinc-500 mt-1">건</div>
        </motion.div>
      </div>

      {/* 결과 목록 */}
      <div className="space-y-4">
        {results.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>선정 결과가 없습니다</p>
          </div>
        ) : (
          results.map((result, index) => {
            const resultConfig = RESULT_CONFIG[result.status] || RESULT_CONFIG.pending
            const ResultIcon = resultConfig.icon

            return (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1"
                        style={{ backgroundColor: resultConfig.bgColor, color: resultConfig.color }}
                      >
                        <ResultIcon className="w-3 h-3" />
                        {resultConfig.label}
                      </span>
                      {result.selection_rank && (
                        <span className="text-xs text-zinc-500">
                          {result.selection_rank}순위
                        </span>
                      )}
                      <span
                        className="px-2 py-0.5 rounded text-xs"
                        style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                      >
                        {result.program?.category}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-2">
                      {result.program?.title || '프로그램 정보 없음'}
                    </h3>

                    <div className="flex items-center gap-4 text-sm text-zinc-400 mb-3">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {result.program?.organization}
                      </span>
                      {result.result_announced_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          발표일: {result.result_announced_at.split('T')[0]}
                        </span>
                      )}
                    </div>

                    {result.status === 'selected' && result.selected_amount && (
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <div className="text-sm text-emerald-400">
                          선정금액: <span className="font-bold">{formatCurrency(result.selected_amount)}</span>
                        </div>
                      </div>
                    )}

                    {result.feedback && (
                      <div className="mt-3 p-3 rounded-lg bg-zinc-800/50">
                        <div className="text-xs text-zinc-500 mb-1">평가 피드백</div>
                        <p className="text-sm text-zinc-300">{result.feedback}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 ml-4">
                    {result.status === 'selected' && (
                      <Link
                        href={`/dashboard-group/company/government-programs/contracts?program_id=${result.program?.id}`}
                        className="px-3 py-2 rounded-lg text-white text-sm flex items-center gap-1"
                        style={{ backgroundColor: themeColor }}
                      >
                        협약 진행
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                    <button className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
