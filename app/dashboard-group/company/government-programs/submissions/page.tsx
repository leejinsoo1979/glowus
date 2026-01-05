'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  History, Calendar, Building2, CheckCircle, Clock,
  XCircle, Eye, Download, Filter
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import Link from 'next/link'

interface Submission {
  id: string
  application_number: string | null
  status: string
  submitted_at: string | null
  result_announced_at: string | null
  result: string | null
  program?: {
    id: string
    title: string
    organization: string
    category: string
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  submitted: { label: '제출완료', color: '#3b82f6', bgColor: '#1e3a5f', icon: CheckCircle },
  reviewing: { label: '심사중', color: '#f59e0b', bgColor: '#451a03', icon: Clock },
  selected: { label: '선정', color: '#10b981', bgColor: '#064e3b', icon: CheckCircle },
  rejected: { label: '탈락', color: '#ef4444', bgColor: '#450a0a', icon: XCircle },
  reserved: { label: '예비', color: '#8b5cf6', bgColor: '#3b0764', icon: Clock },
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterYear, setFilterYear] = useState<string>('')
  const { themeColor } = useThemeStore()

  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear - 1, currentYear - 2]

  useEffect(() => {
    fetchSubmissions()
  }, [filterStatus, filterYear])

  const fetchSubmissions = async () => {
    try {
      let url = '/api/government-programs/applications?include_submitted=true'
      if (filterStatus) url += `&status=${filterStatus}`
      const res = await fetch(url)
      const data = await res.json()
      // Filter only submitted applications
      const submitted = (data.applications || []).filter((a: Submission) =>
        a.submitted_at && ['submitted', 'reviewing', 'selected', 'rejected', 'reserved'].includes(a.status)
      )
      setSubmissions(submitted)
    } catch (error) {
      console.error('Failed to fetch submissions:', error)
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${themeColor}20` }}>
            <History className="w-6 h-6" style={{ color: themeColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">접수 이력</h1>
            <p className="text-sm text-zinc-400">제출한 신청서의 진행상황을 확인합니다</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
            className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
          >
            <option value="">전체 연도</option>
            {years.map(year => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
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
          전체 ({submissions.length})
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const count = submissions.filter(s => s.status === key).length
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

      {/* 요약 통계 */}
      <div className="grid grid-cols-5 gap-4">
        {Object.entries(STATUS_CONFIG).map(([key, config], index) => {
          const count = submissions.filter(s => s.status === key).length
          const Icon = config.icon
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-5 h-5" style={{ color: config.color }} />
                <span className="text-2xl font-bold" style={{ color: config.color }}>
                  {count}
                </span>
              </div>
              <div className="text-sm text-zinc-400">{config.label}</div>
            </motion.div>
          )
        })}
      </div>

      {/* 접수 이력 목록 */}
      <div className="space-y-4">
        {submissions.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <History className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>제출한 신청서가 없습니다</p>
          </div>
        ) : (
          submissions.map((submission, index) => {
            const statusConfig = STATUS_CONFIG[submission.status] || STATUS_CONFIG.submitted
            const StatusIcon = statusConfig.icon

            return (
              <motion.div
                key={submission.id}
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
                        style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                      {submission.application_number && (
                        <span className="text-xs text-zinc-500">
                          접수번호: {submission.application_number}
                        </span>
                      )}
                      <span
                        className="px-2 py-0.5 rounded text-xs"
                        style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                      >
                        {submission.program?.category}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-2">
                      {submission.program?.title || '프로그램 정보 없음'}
                    </h3>

                    <div className="flex items-center gap-4 text-sm text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {submission.program?.organization}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        제출일: {submission.submitted_at?.split('T')[0]}
                      </span>
                      {submission.result_announced_at && (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          발표일: {submission.result_announced_at.split('T')[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 진행 타임라인 */}
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <div className="w-16 h-0.5 bg-emerald-500" />
                    </div>
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full ${
                        ['reviewing', 'selected', 'rejected', 'reserved'].includes(submission.status)
                          ? 'bg-amber-500'
                          : 'bg-zinc-700'
                      }`} />
                      <div className={`w-16 h-0.5 ${
                        ['selected', 'rejected', 'reserved'].includes(submission.status)
                          ? 'bg-amber-500'
                          : 'bg-zinc-700'
                      }`} />
                    </div>
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full ${
                        ['selected', 'rejected', 'reserved'].includes(submission.status)
                          ? submission.status === 'selected' ? 'bg-emerald-500' : 'bg-red-500'
                          : 'bg-zinc-700'
                      }`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                    <span className="w-20">제출</span>
                    <span className="w-20">심사</span>
                    <span>결과발표</span>
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
