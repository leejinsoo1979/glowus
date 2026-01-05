'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  FileBarChart, Plus, Calendar, CheckCircle, Clock,
  AlertCircle, Send, Edit3, Eye, Download
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

interface Report {
  id: string
  report_type: string
  title: string
  report_period_start: string | null
  report_period_end: string | null
  due_date: string | null
  submitted_at: string | null
  status: string
  content: any
  contract?: {
    id: string
    contract_name: string
  }
}

const REPORT_TYPES = [
  { value: 'interim', label: '중간보고서' },
  { value: 'final', label: '최종보고서' },
  { value: 'monthly', label: '월간보고서' },
  { value: 'quarterly', label: '분기보고서' },
  { value: 'settlement', label: '정산보고서' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  draft: { label: '작성중', color: '#71717a', bgColor: '#27272a', icon: Edit3 },
  ready: { label: '제출대기', color: '#3b82f6', bgColor: '#1e3a5f', icon: Clock },
  submitted: { label: '제출완료', color: '#10b981', bgColor: '#064e3b', icon: CheckCircle },
  reviewing: { label: '검토중', color: '#f59e0b', bgColor: '#451a03', icon: Clock },
  approved: { label: '승인', color: '#10b981', bgColor: '#064e3b', icon: CheckCircle },
  rejected: { label: '반려', color: '#ef4444', bgColor: '#450a0a', icon: AlertCircle },
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [selectedContract, setSelectedContract] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>('')
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchContracts()
  }, [])

  useEffect(() => {
    if (selectedContract) {
      fetchReports()
    }
  }, [selectedContract, filterType])

  const fetchContracts = async () => {
    try {
      const res = await fetch('/api/government-programs/contracts')
      const data = await res.json()
      setContracts(data.contracts || [])
      if (data.contracts?.length > 0) {
        setSelectedContract(data.contracts[0].id)
      }
    } catch (error) {
      console.error('Failed to fetch contracts:', error)
    }
  }

  const fetchReports = async () => {
    try {
      setLoading(true)
      let url = `/api/government-programs/reports?contract_id=${selectedContract}`
      if (filterType) url += `&report_type=${filterType}`
      const res = await fetch(url)
      const data = await res.json()
      setReports(data.reports || [])
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDaysRemaining = (dueDate: string | null) => {
    if (!dueDate) return null
    const due = new Date(dueDate)
    const today = new Date()
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  const getTypeLabel = (type: string) => {
    return REPORT_TYPES.find(t => t.value === type)?.label || type
  }

  if (loading && !contracts.length) {
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
            <FileBarChart className="w-6 h-6" style={{ color: themeColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">보고서 관리</h1>
            <p className="text-sm text-zinc-400">과제 보고서를 작성하고 제출합니다</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedContract}
            onChange={e => setSelectedContract(e.target.value)}
            className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
          >
            {contracts.map(c => (
              <option key={c.id} value={c.id}>{c.contract_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 보고서 유형 필터 */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterType('')}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            !filterType ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          전체
        </button>
        {REPORT_TYPES.map(type => (
          <button
            key={type.value}
            onClick={() => setFilterType(type.value)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filterType === type.value ? 'text-white' : 'text-zinc-400 hover:text-white'
            }`}
            style={filterType === type.value ? { backgroundColor: `${themeColor}20`, color: themeColor } : {}}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* 예정된 보고서 */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" style={{ color: themeColor }} />
          예정된 보고서
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {reports.filter(r => r.status === 'draft' || r.status === 'ready').slice(0, 3).map((report, index) => {
            const daysRemaining = getDaysRemaining(report.due_date)
            const isUrgent = daysRemaining !== null && daysRemaining <= 7

            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-lg border ${
                  isUrgent ? 'border-red-500/50 bg-red-500/10' : 'border-zinc-700 bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="px-2 py-0.5 rounded text-xs"
                    style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                  >
                    {getTypeLabel(report.report_type)}
                  </span>
                  {daysRemaining !== null && (
                    <span className={`text-xs font-medium ${isUrgent ? 'text-red-400' : 'text-zinc-400'}`}>
                      D-{daysRemaining}
                    </span>
                  )}
                </div>
                <h4 className="text-white font-medium truncate">{report.title}</h4>
                <p className="text-sm text-zinc-500 mt-1">
                  마감: {report.due_date}
                </p>
              </motion.div>
            )
          })}
          {reports.filter(r => r.status === 'draft' || r.status === 'ready').length === 0 && (
            <div className="col-span-3 text-center py-8 text-zinc-500">
              예정된 보고서가 없습니다
            </div>
          )}
        </div>
      </div>

      {/* 보고서 목록 */}
      <div className="space-y-4">
        {reports.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <FileBarChart className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>등록된 보고서가 없습니다</p>
          </div>
        ) : (
          reports.map((report, index) => {
            const statusConfig = STATUS_CONFIG[report.status] || STATUS_CONFIG.draft
            const StatusIcon = statusConfig.icon
            const daysRemaining = getDaysRemaining(report.due_date)
            const isOverdue = daysRemaining !== null && daysRemaining < 0 && report.status !== 'submitted'

            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                      >
                        {getTypeLabel(report.report_type)}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1"
                        style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                      {isOverdue && (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
                          {Math.abs(daysRemaining!)}일 지연
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-2">{report.title}</h3>

                    <div className="flex items-center gap-4 text-sm text-zinc-400">
                      {report.report_period_start && report.report_period_end && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          대상기간: {report.report_period_start} ~ {report.report_period_end}
                        </span>
                      )}
                      {report.due_date && (
                        <span>마감: {report.due_date}</span>
                      )}
                      {report.submitted_at && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle className="w-4 h-4" />
                          제출: {report.submitted_at.split('T')[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                    {report.status === 'draft' && (
                      <button className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    {(report.status === 'draft' || report.status === 'ready') && (
                      <button
                        className="px-3 py-2 rounded-lg text-white text-sm flex items-center gap-1"
                        style={{ backgroundColor: themeColor }}
                      >
                        <Send className="w-4 h-4" />
                        제출
                      </button>
                    )}
                    {report.status === 'submitted' || report.status === 'approved' && (
                      <button className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                    )}
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
