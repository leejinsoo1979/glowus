'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  FileSpreadsheet, Plus, Calendar, Building2, DollarSign,
  Clock, Check, AlertCircle, ChevronRight, FileText
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import Link from 'next/link'

interface Contract {
  id: string
  contract_number: string | null
  contract_name: string
  status: string
  start_date: string | null
  end_date: string | null
  total_amount: number | null
  government_amount: number | null
  self_amount: number | null
  conditions: any[]
  signed_at: string | null
  application?: {
    id: string
    application_number: string | null
  }
  program?: {
    id: string
    title: string
    organization: string
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: '협약대기', color: '#f59e0b', bgColor: '#451a03' },
  signed: { label: '체결완료', color: '#3b82f6', bgColor: '#1e3a5f' },
  active: { label: '수행중', color: '#10b981', bgColor: '#064e3b' },
  completed: { label: '완료', color: '#6b7280', bgColor: '#1f2937' },
  terminated: { label: '해지', color: '#ef4444', bgColor: '#450a0a' },
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchContracts()
  }, [filterStatus])

  const fetchContracts = async () => {
    try {
      let url = '/api/government-programs/contracts'
      if (filterStatus) url += `?status=${filterStatus}`
      const res = await fetch(url)
      const data = await res.json()
      setContracts(data.contracts || [])
    } catch (error) {
      console.error('Failed to fetch contracts:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('ko-KR').format(amount) + '원'
  }

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null
    const end = new Date(endDate)
    const today = new Date()
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
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
            <FileSpreadsheet className="w-6 h-6" style={{ color: themeColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">협약서 관리</h1>
            <p className="text-sm text-zinc-400">체결된 협약을 관리합니다</p>
          </div>
        </div>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterStatus('')}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            !filterStatus ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          전체 ({contracts.length})
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filterStatus === key ? 'text-white' : 'text-zinc-400 hover:text-white'
            }`}
            style={filterStatus === key ? { backgroundColor: config.bgColor, color: config.color } : {}}
          >
            {config.label}
          </button>
        ))}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        {['active', 'pending', 'completed', 'terminated'].map((status, index) => {
          const count = contracts.filter(c => c.status === status).length
          const config = STATUS_CONFIG[status]
          const totalAmount = contracts
            .filter(c => c.status === status)
            .reduce((sum, c) => sum + (c.total_amount || 0), 0)

          return (
            <motion.div
              key={status}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{ backgroundColor: config.bgColor, color: config.color }}
                >
                  {config.label}
                </span>
                <span className="text-2xl font-bold text-white">{count}</span>
              </div>
              <div className="text-sm text-zinc-500">
                총 {formatCurrency(totalAmount)}
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className="space-y-4">
        {contracts.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>협약 내역이 없습니다</p>
          </div>
        ) : (
          contracts.map((contract, index) => {
            const statusConfig = STATUS_CONFIG[contract.status] || STATUS_CONFIG.pending
            const daysRemaining = getDaysRemaining(contract.end_date)

            return (
              <motion.div
                key={contract.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
                      >
                        {statusConfig.label}
                      </span>
                      {contract.contract_number && (
                        <span className="text-xs text-zinc-500">
                          {contract.contract_number}
                        </span>
                      )}
                      {daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 30 && (
                        <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          종료 D-{daysRemaining}
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-2">
                      {contract.contract_name}
                    </h3>

                    {contract.program && (
                      <div className="flex items-center gap-2 text-sm text-zinc-400 mb-3">
                        <Building2 className="w-4 h-4" />
                        <span>{contract.program.organization}</span>
                        <span className="text-zinc-600">•</span>
                        <span>{contract.program.title}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-4 mt-4">
                      <div>
                        <div className="text-xs text-zinc-500 mb-1">협약기간</div>
                        <div className="text-sm text-white flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                          {contract.start_date} ~ {contract.end_date}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500 mb-1">총 지원금</div>
                        <div className="text-sm font-medium" style={{ color: themeColor }}>
                          {formatCurrency(contract.total_amount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500 mb-1">정부지원금</div>
                        <div className="text-sm text-white">
                          {formatCurrency(contract.government_amount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500 mb-1">자부담금</div>
                        <div className="text-sm text-white">
                          {formatCurrency(contract.self_amount)}
                        </div>
                      </div>
                    </div>

                    {contract.conditions?.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-zinc-800">
                        <div className="text-xs text-zinc-500 mb-2">주요 협약조건</div>
                        <div className="flex flex-wrap gap-2">
                          {contract.conditions.slice(0, 3).map((condition: any, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-1 rounded text-xs bg-zinc-800 text-zinc-400"
                            >
                              {typeof condition === 'string' ? condition : condition.name}
                            </span>
                          ))}
                          {contract.conditions.length > 3 && (
                            <span className="px-2 py-1 rounded text-xs bg-zinc-800 text-zinc-500">
                              +{contract.conditions.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <Link
                    href={`/dashboard-group/company/government-programs/milestones?contract_id=${contract.id}`}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors ml-4"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
