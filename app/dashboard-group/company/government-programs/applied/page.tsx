'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Send, Calendar, Building2, Clock, Eye, ExternalLink,
  CheckCircle, AlertCircle
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import Link from 'next/link'

interface AppliedProgram {
  id: string
  application_number: string | null
  status: string
  submitted_at: string | null
  created_at: string
  program?: {
    id: string
    title: string
    organization: string
    category: string
    apply_end_date: string | null
    status: string
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: '작성중', color: '#71717a', bgColor: '#27272a' },
  ready: { label: '제출대기', color: '#3b82f6', bgColor: '#1e3a5f' },
  submitted: { label: '제출완료', color: '#10b981', bgColor: '#064e3b' },
  reviewing: { label: '심사중', color: '#f59e0b', bgColor: '#451a03' },
  returned: { label: '보완요청', color: '#ef4444', bgColor: '#450a0a' },
}

export default function AppliedProgramsPage() {
  const [applications, setApplications] = useState<AppliedProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchApplications()
  }, [filterStatus])

  const fetchApplications = async () => {
    try {
      let url = '/api/government-programs/applications'
      if (filterStatus) url += `?status=${filterStatus}`
      const res = await fetch(url)
      const data = await res.json()
      // Filter only applied (not yet selected/rejected) applications
      const applied = (data.applications || []).filter((a: AppliedProgram) =>
        ['draft', 'ready', 'submitted', 'reviewing', 'returned'].includes(a.status)
      )
      setApplications(applied)
    } catch (error) {
      console.error('Failed to fetch applications:', error)
    } finally {
      setLoading(false)
    }
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
          <Send className="w-6 h-6" style={{ color: themeColor }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">지원한 공고</h1>
          <p className="text-sm text-zinc-400">지원 진행 중인 사업을 확인합니다</p>
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
          전체 ({applications.length})
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const count = applications.filter(a => a.status === key).length
          if (count === 0) return null
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filterStatus === key ? 'text-white' : 'text-zinc-400 hover:text-white'
              }`}
              style={filterStatus === key ? { backgroundColor: config.bgColor, color: config.color } : {}}
            >
              {config.label} ({count})
            </button>
          )
        })}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-5 gap-4">
        {Object.entries(STATUS_CONFIG).map(([key, config], index) => {
          const count = applications.filter(a => a.status === key).length
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center"
            >
              <div className="text-2xl font-bold" style={{ color: config.color }}>
                {count}
              </div>
              <div className="text-sm text-zinc-400">{config.label}</div>
            </motion.div>
          )
        })}
      </div>

      {/* 목록 */}
      <div className="space-y-4">
        {applications.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <Send className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>지원한 공고가 없습니다</p>
            <Link
              href="/dashboard-group/company/government-programs/search"
              className="mt-4 inline-block px-4 py-2 rounded-lg text-sm"
              style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
            >
              공고 검색하기
            </Link>
          </div>
        ) : (
          applications.map((app, index) => {
            const statusConfig = STATUS_CONFIG[app.status] || STATUS_CONFIG.draft

            return (
              <motion.div
                key={app.id}
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
                      {app.application_number && (
                        <span className="text-xs text-zinc-500">
                          {app.application_number}
                        </span>
                      )}
                      <span
                        className="px-2 py-0.5 rounded text-xs"
                        style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                      >
                        {app.program?.category}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-2">
                      {app.program?.title || '프로그램 정보 없음'}
                    </h3>

                    <div className="flex items-center gap-4 text-sm text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {app.program?.organization}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {app.submitted_at
                          ? `제출: ${app.submitted_at.split('T')[0]}`
                          : `작성: ${app.created_at?.split('T')[0]}`
                        }
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Link
                      href={`/dashboard-group/company/government-programs?id=${app.program?.id}`}
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                    <button className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                      <Eye className="w-4 h-4" />
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
