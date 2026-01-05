'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Trophy, Calendar, Building2, DollarSign, ArrowRight,
  ChevronRight, TrendingUp, CheckCircle
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import Link from 'next/link'

interface SelectedProgram {
  id: string
  application_number: string | null
  status: string
  result_announced_at: string | null
  selected_amount: number | null
  selection_rank: number | null
  program?: {
    id: string
    title: string
    organization: string
    category: string
    support_amount: string | null
  }
  contract?: {
    id: string
    contract_name: string
    status: string
    start_date: string | null
    end_date: string | null
  }
}

export default function SelectedProgramsPage() {
  const [programs, setPrograms] = useState<SelectedProgram[]>([])
  const [loading, setLoading] = useState(true)
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchSelectedPrograms()
  }, [])

  const fetchSelectedPrograms = async () => {
    try {
      const res = await fetch('/api/government-programs/applications?status=selected')
      const data = await res.json()
      setPrograms(data.applications || [])
    } catch (error) {
      console.error('Failed to fetch selected programs:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('ko-KR').format(amount) + '원'
  }

  const totalAmount = programs.reduce((sum, p) => sum + (p.selected_amount || 0), 0)

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
        <div className="p-2 rounded-lg bg-emerald-500/20">
          <Trophy className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">선정된 공고</h1>
          <p className="text-sm text-zinc-400">선정된 지원사업을 확인합니다</p>
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-6 h-6 text-emerald-400" />
            <span className="text-emerald-400">선정 사업</span>
          </div>
          <div className="text-4xl font-bold text-white">{programs.length}</div>
          <div className="text-sm text-zinc-400 mt-1">건</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-6 h-6" style={{ color: themeColor }} />
            <span className="text-zinc-400">총 선정금액</span>
          </div>
          <div className="text-3xl font-bold" style={{ color: themeColor }}>
            {formatCurrency(totalAmount)}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-6 h-6 text-blue-400" />
            <span className="text-zinc-400">협약 진행중</span>
          </div>
          <div className="text-4xl font-bold text-white">
            {programs.filter(p => p.contract?.status === 'active').length}
          </div>
          <div className="text-sm text-zinc-400 mt-1">건</div>
        </motion.div>
      </div>

      {/* 선정 목록 */}
      <div className="space-y-4">
        {programs.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>선정된 사업이 없습니다</p>
            <Link
              href="/dashboard-group/company/government-programs/recommended"
              className="mt-4 inline-block px-4 py-2 rounded-lg text-sm"
              style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
            >
              추천 공고 보기
            </Link>
          </div>
        ) : (
          programs.map((program, index) => (
            <motion.div
              key={program.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-emerald-500/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      선정
                    </span>
                    {program.selection_rank && (
                      <span className="text-xs text-zinc-500">
                        {program.selection_rank}순위
                      </span>
                    )}
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
                        선정일: {program.result_announced_at.split('T')[0]}
                      </span>
                    )}
                  </div>

                  {program.selected_amount && (
                    <div className="inline-block px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                      <span className="text-sm text-zinc-400">선정금액: </span>
                      <span className="text-lg font-bold text-emerald-400">
                        {formatCurrency(program.selected_amount)}
                      </span>
                    </div>
                  )}

                  {program.contract && (
                    <div className="mt-3 pt-3 border-t border-zinc-800">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-500">협약:</span>
                        <span className="text-white">{program.contract.contract_name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          program.contract.status === 'active'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-zinc-700 text-zinc-400'
                        }`}>
                          {program.contract.status === 'active' ? '수행중' : program.contract.status}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 ml-4">
                  {program.contract ? (
                    <Link
                      href={`/dashboard-group/company/government-programs/progress?contract_id=${program.contract.id}`}
                      className="px-3 py-2 rounded-lg text-white text-sm flex items-center gap-1"
                      style={{ backgroundColor: themeColor }}
                    >
                      진행현황
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <Link
                      href={`/dashboard-group/company/government-programs/contracts?program_id=${program.program?.id}`}
                      className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm flex items-center gap-1"
                    >
                      협약진행
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
