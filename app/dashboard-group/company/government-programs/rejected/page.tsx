'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  XCircle, Calendar, Building2, MessageSquare, RefreshCw,
  TrendingUp, ArrowRight, Lightbulb
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import Link from 'next/link'

interface RejectedProgram {
  id: string
  application_number: string | null
  status: string
  result_announced_at: string | null
  feedback: string | null
  rejection_reason: string | null
  program?: {
    id: string
    title: string
    organization: string
    category: string
    apply_end_date: string | null
  }
}

export default function RejectedProgramsPage() {
  const [programs, setPrograms] = useState<RejectedProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState<string>('')
  const { themeColor } = useThemeStore()

  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear - 1, currentYear - 2]

  useEffect(() => {
    fetchRejectedPrograms()
  }, [selectedYear])

  const fetchRejectedPrograms = async () => {
    try {
      const res = await fetch('/api/government-programs/applications?status=rejected')
      const data = await res.json()
      let filtered = data.applications || []

      if (selectedYear) {
        filtered = filtered.filter((p: RejectedProgram) =>
          p.result_announced_at?.startsWith(selectedYear)
        )
      }

      setPrograms(filtered)
    } catch (error) {
      console.error('Failed to fetch rejected programs:', error)
    } finally {
      setLoading(false)
    }
  }

  // 카테고리별 통계
  const categoryStats = programs.reduce((acc, p) => {
    const category = p.program?.category || '기타'
    acc[category] = (acc[category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

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
          <div className="p-2 rounded-lg bg-zinc-700/50">
            <XCircle className="w-6 h-6 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">미선정 공고</h1>
            <p className="text-sm text-zinc-400">미선정된 사업 이력과 피드백을 확인합니다</p>
          </div>
        </div>

        <select
          value={selectedYear}
          onChange={e => setSelectedYear(e.target.value)}
          className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
        >
          <option value="">전체 연도</option>
          {years.map(year => (
            <option key={year} value={year.toString()}>{year}년</option>
          ))}
        </select>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-zinc-400">미선정 건수</span>
            <span className="text-3xl font-bold text-white">{programs.length}</span>
          </div>
          <div className="text-sm text-zinc-500">
            {selectedYear ? `${selectedYear}년 기준` : '전체 기간'}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6"
        >
          <div className="text-zinc-400 mb-3">카테고리별 분포</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(categoryStats).map(([category, count]) => (
              <span
                key={category}
                className="px-2 py-1 rounded text-xs bg-zinc-800 text-zinc-400"
              >
                {category}: {count}건
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* 개선 가이드 */}
      {programs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5"
        >
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-400 mb-1">선정률 향상 TIP</h3>
              <p className="text-sm text-zinc-300">
                미선정 피드백을 분석하여 다음 신청 시 보완하세요.
                프로필 업데이트와 AI 자격진단을 통해 경쟁력을 높일 수 있습니다.
              </p>
              <div className="flex gap-3 mt-3">
                <Link
                  href="/dashboard-group/company/government-programs/ai-diagnosis"
                  className="text-sm flex items-center gap-1 text-amber-400 hover:underline"
                >
                  AI 자격진단 <ArrowRight className="w-3 h-3" />
                </Link>
                <Link
                  href="/dashboard-group/company/government-programs/profile"
                  className="text-sm flex items-center gap-1 text-amber-400 hover:underline"
                >
                  프로필 보완 <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 미선정 목록 */}
      <div className="space-y-4">
        {programs.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>미선정 이력이 없습니다</p>
            <p className="text-sm mt-2 text-zinc-500">지원 이력이 모두 선정되었습니다</p>
          </div>
        ) : (
          programs.map((program, index) => (
            <motion.div
              key={program.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-zinc-700 text-zinc-400 flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      미선정
                    </span>
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                    >
                      {program.program?.category}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-2">
                    {program.program?.title || '프로그램 정보 없음'}
                  </h3>

                  <div className="flex items-center gap-4 text-sm text-zinc-400 mb-3">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {program.program?.organization}
                    </span>
                    {program.result_announced_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        발표일: {program.result_announced_at.split('T')[0]}
                      </span>
                    )}
                  </div>

                  {/* 피드백 */}
                  {(program.feedback || program.rejection_reason) && (
                    <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-zinc-500 mt-0.5" />
                        <div>
                          <div className="text-xs text-zinc-500 mb-1">평가 피드백</div>
                          <p className="text-sm text-zinc-300">
                            {program.feedback || program.rejection_reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 ml-4">
                  <Link
                    href={`/dashboard-group/company/government-programs/search?organization=${encodeURIComponent(program.program?.organization || '')}`}
                    className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm flex items-center gap-1 hover:bg-zinc-700"
                  >
                    <RefreshCw className="w-4 h-4" />
                    유사공고 찾기
                  </Link>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
