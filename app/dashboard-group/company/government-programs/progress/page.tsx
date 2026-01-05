'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, TrendingUp, Calendar, Target, Clock,
  CheckCircle, AlertCircle, ChevronRight
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import Link from 'next/link'

interface Contract {
  id: string
  contract_name: string
  status: string
  start_date: string | null
  end_date: string | null
  total_amount: number | null
  progress_rate: number
  milestones: {
    id: string
    title: string
    status: string
    due_date: string | null
  }[]
  program?: {
    id: string
    title: string
    organization: string
  }
}

export default function ProgressPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchContracts()
  }, [])

  const fetchContracts = async () => {
    try {
      const res = await fetch('/api/government-programs/contracts?status=active')
      const data = await res.json()

      // Fetch milestones for each contract
      const contractsWithMilestones = await Promise.all(
        (data.contracts || []).map(async (contract: Contract) => {
          try {
            const milestonesRes = await fetch(`/api/government-programs/milestones?contract_id=${contract.id}`)
            const milestonesData = await milestonesRes.json()
            return {
              ...contract,
              milestones: milestonesData.milestones || [],
              progress_rate: calculateProgressRate(milestonesData.milestones || [])
            }
          } catch {
            return { ...contract, milestones: [], progress_rate: 0 }
          }
        })
      )

      setContracts(contractsWithMilestones)
    } catch (error) {
      console.error('Failed to fetch contracts:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateProgressRate = (milestones: any[]) => {
    if (milestones.length === 0) return 0
    const completed = milestones.filter(m => m.status === 'completed').length
    return Math.round((completed / milestones.length) * 100)
  }

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null
    const end = new Date(endDate)
    const today = new Date()
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return '#10b981'
    if (progress >= 50) return themeColor
    if (progress >= 25) return '#f59e0b'
    return '#ef4444'
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
          <Activity className="w-6 h-6" style={{ color: themeColor }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">진행 현황</h1>
          <p className="text-sm text-zinc-400">수행 중인 과제의 진행상황을 확인합니다</p>
        </div>
      </div>

      {/* 전체 통계 */}
      <div className="grid grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
        >
          <div className="text-sm text-zinc-400 mb-1">수행 중인 과제</div>
          <div className="text-3xl font-bold" style={{ color: themeColor }}>
            {contracts.length}
          </div>
          <div className="text-sm text-zinc-500 mt-1">건</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
        >
          <div className="text-sm text-zinc-400 mb-1">평균 진행률</div>
          <div className="text-3xl font-bold text-emerald-400">
            {contracts.length > 0
              ? Math.round(contracts.reduce((sum, c) => sum + c.progress_rate, 0) / contracts.length)
              : 0}%
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
        >
          <div className="text-sm text-zinc-400 mb-1">완료 마일스톤</div>
          <div className="text-3xl font-bold text-white">
            {contracts.reduce((sum, c) => sum + c.milestones.filter(m => m.status === 'completed').length, 0)}
          </div>
          <div className="text-sm text-zinc-500 mt-1">
            / {contracts.reduce((sum, c) => sum + c.milestones.length, 0)}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
        >
          <div className="text-sm text-zinc-400 mb-1">지연 마일스톤</div>
          <div className="text-3xl font-bold text-amber-400">
            {contracts.reduce((sum, c) => sum + c.milestones.filter(m =>
              m.status !== 'completed' && m.due_date && new Date(m.due_date) < new Date()
            ).length, 0)}
          </div>
          <div className="text-sm text-zinc-500 mt-1">건</div>
        </motion.div>
      </div>

      {/* 과제별 진행 현황 */}
      <div className="space-y-4">
        {contracts.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <Activity className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>수행 중인 과제가 없습니다</p>
          </div>
        ) : (
          contracts.map((contract, index) => {
            const daysRemaining = getDaysRemaining(contract.end_date)
            const progressColor = getProgressColor(contract.progress_rate)
            const upcomingMilestones = contract.milestones
              .filter(m => m.status !== 'completed')
              .sort((a, b) => {
                if (!a.due_date) return 1
                if (!b.due_date) return -1
                return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
              })
              .slice(0, 3)

            return (
              <motion.div
                key={contract.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {daysRemaining !== null && daysRemaining <= 30 && daysRemaining > 0 && (
                        <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          종료 D-{daysRemaining}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-white">{contract.contract_name}</h3>
                    <p className="text-sm text-zinc-400">{contract.program?.organization}</p>
                  </div>

                  <Link
                    href={`/dashboard-group/company/government-programs/milestones?contract_id=${contract.id}`}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>

                {/* 진행률 바 */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-zinc-400">진행률</span>
                    <span className="font-medium" style={{ color: progressColor }}>
                      {contract.progress_rate}%
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${contract.progress_rate}%`,
                        backgroundColor: progressColor
                      }}
                    />
                  </div>
                </div>

                {/* 기간 */}
                <div className="flex items-center gap-4 text-sm text-zinc-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {contract.start_date} ~ {contract.end_date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    마일스톤 {contract.milestones.filter(m => m.status === 'completed').length}/{contract.milestones.length}
                  </span>
                </div>

                {/* 다가오는 마일스톤 */}
                {upcomingMilestones.length > 0 && (
                  <div className="pt-4 border-t border-zinc-800">
                    <div className="text-xs text-zinc-500 mb-2">다가오는 마일스톤</div>
                    <div className="space-y-2">
                      {upcomingMilestones.map(milestone => {
                        const milestoneDays = getDaysRemaining(milestone.due_date)
                        const isOverdue = milestoneDays !== null && milestoneDays < 0

                        return (
                          <div
                            key={milestone.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className={isOverdue ? 'text-red-400' : 'text-zinc-300'}>
                              {milestone.title}
                            </span>
                            {milestone.due_date && (
                              <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-zinc-500'}`}>
                                {isOverdue ? `${Math.abs(milestoneDays!)}일 지연` : `D-${milestoneDays}`}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
