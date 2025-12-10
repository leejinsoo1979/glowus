'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Calendar,
  Plus,
  Download,
  Trash2,
  Eye,
  TrendingUp,
  Users,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronRight,
  BarChart3
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

interface Report {
  id: string
  startup_id: string
  type: 'weekly' | 'monthly'
  title: string
  summary: string
  stats: {
    taskStats: {
      total: number
      completed: number
      inProgress: number
      todo: number
      completionRate: number
      highPriority: number
      overdue: number
    }
    kpiHighlights: Array<{
      type: string
      value: number
      unit: string
    }>
    teamActivity: {
      totalMembers: number
      memberProductivity: Array<{
        name: string
        total: number
        completed: number
        rate: number
      }>
    }
  }
  period_start: string
  period_end: string
  created_at: string
}

export default function ReportsPage() {
  const { currentStartup } = useAuthStore()
  const [reports, setReports] = useState<Report[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'weekly' | 'monthly'>('all')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateType, setGenerateType] = useState<'weekly' | 'monthly'>('weekly')

  useEffect(() => {
    if (currentStartup?.id) {
      fetchReports()
    }
  }, [currentStartup?.id, filterType])

  const fetchReports = async () => {
    if (!currentStartup?.id) return

    setIsLoading(true)
    try {
      const typeParam = filterType !== 'all' ? `&type=${filterType}` : ''
      const res = await fetch(`/api/reports?startup_id=${currentStartup.id}${typeParam}`)
      if (res.ok) {
        const data = await res.json()
        setReports(data)
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const generateReport = async () => {
    if (!currentStartup?.id) return

    setIsGenerating(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startup_id: currentStartup.id,
          type: generateType
        })
      })

      if (res.ok) {
        const newReport = await res.json()
        setReports(prev => [newReport, ...prev])
        setShowGenerateModal(false)
        setSelectedReport(newReport)
      } else {
        const error = await res.json()
        alert(error.error || '리포트 생성 실패')
      }
    } catch (error) {
      console.error('Failed to generate report:', error)
      alert('리포트 생성 중 오류가 발생했습니다')
    } finally {
      setIsGenerating(false)
    }
  }

  const deleteReport = async (id: string) => {
    if (!confirm('이 리포트를 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== id))
        if (selectedReport?.id === id) {
          setSelectedReport(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete report:', error)
    }
  }

  const exportToPDF = async (report: Report) => {
    // PDF 내보내기 - 브라우저 프린트 기능 사용
    const printContent = document.getElementById('report-detail')
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${report.title}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 24px; margin-bottom: 8px; }
            h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; color: #374151; }
            h3 { font-size: 16px; margin-top: 16px; margin-bottom: 8px; }
            p { line-height: 1.6; color: #4b5563; }
            .meta { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 16px 0; }
            .stat-card { background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; }
            .stat-value { font-size: 24px; font-weight: bold; color: #111827; }
            .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
            .summary { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; white-space: pre-wrap; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            th { background: #f3f4f6; font-weight: 600; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>${report.title}</h1>
          <p class="meta">생성일: ${new Date(report.created_at).toLocaleDateString('ko-KR')} | 기간: ${report.period_start} ~ ${report.period_end}</p>

          <h2>📊 태스크 현황</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${report.stats?.taskStats?.total || 0}</div>
              <div class="stat-label">전체 태스크</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${report.stats?.taskStats?.completed || 0}</div>
              <div class="stat-label">완료</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${report.stats?.taskStats?.completionRate || 0}%</div>
              <div class="stat-label">완료율</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${report.stats?.taskStats?.overdue || 0}</div>
              <div class="stat-label">지연</div>
            </div>
          </div>

          <h2>👥 팀 활동</h2>
          <table>
            <thead>
              <tr>
                <th>팀원</th>
                <th>전체</th>
                <th>완료</th>
                <th>완료율</th>
              </tr>
            </thead>
            <tbody>
              ${(report.stats?.teamActivity?.memberProductivity || []).map(m => `
                <tr>
                  <td>${m.name}</td>
                  <td>${m.total}</td>
                  <td>${m.completed}</td>
                  <td>${m.rate}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h2>📝 AI 분석 요약</h2>
          <div class="summary">${report.summary || '요약 없음'}</div>

          <p style="margin-top: 40px; color: #9ca3af; font-size: 12px; text-align: center;">
            Generated by GlowUS - ${new Date().toLocaleDateString('ko-KR')}
          </p>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (!currentStartup) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <FileText className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-zinc-200 mb-2">스타트업을 선택해주세요</h2>
          <p className="text-zinc-400">리포트를 생성하려면 먼저 스타트업을 선택하세요</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">리포트</h1>
          <p className="text-zinc-400 mt-1">주간/월간 성과 리포트를 생성하고 관리하세요</p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          리포트 생성
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'weekly', 'monthly'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterType === type
                ? 'bg-accent text-black'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {type === 'all' ? '전체' : type === 'weekly' ? '주간' : '월간'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports List */}
        <div className="lg:col-span-1 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400">아직 생성된 리포트가 없습니다</p>
              <button
                onClick={() => setShowGenerateModal(true)}
                className="mt-4 text-accent hover:underline text-sm"
              >
                첫 리포트 생성하기
              </button>
            </div>
          ) : (
            reports.map((report) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-zinc-900 border rounded-xl p-4 cursor-pointer transition-all hover:border-accent/50 ${
                  selectedReport?.id === report.id ? 'border-accent' : 'border-zinc-800'
                }`}
                onClick={() => setSelectedReport(report)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-accent/20`}>
                      {report.type === 'weekly' ? (
                        <Calendar className="w-5 h-5 text-accent" />
                      ) : (
                        <BarChart3 className="w-5 h-5 text-accent" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-zinc-200 text-sm">
                        {report.type === 'weekly' ? '주간' : '월간'} 리포트
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {formatDate(report.period_start)} ~ {formatDate(report.period_end)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 transition-colors ${
                    selectedReport?.id === report.id ? 'text-accent' : 'text-zinc-600'
                  }`} />
                </div>

                {report.stats?.taskStats && (
                  <div className="mt-3 flex gap-4 text-xs">
                    <span className="text-zinc-400">
                      완료 <span className="text-green-400 font-medium">{report.stats.taskStats.completed}</span>
                    </span>
                    <span className="text-zinc-400">
                      완료율 <span className="text-accent font-medium">{report.stats.taskStats.completionRate}%</span>
                    </span>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>

        {/* Report Detail */}
        <div className="lg:col-span-2">
          {selectedReport ? (
            <motion.div
              id="report-detail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-zinc-800">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-accent/20 text-accent">
                        {selectedReport.type === 'weekly' ? '주간' : '월간'}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-zinc-100">{selectedReport.title}</h2>
                    <p className="text-sm text-zinc-500 mt-1">
                      생성: {formatDate(selectedReport.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportToPDF(selectedReport)}
                      className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                      title="PDF 내보내기"
                    >
                      <Download className="w-5 h-5 text-zinc-300" />
                    </button>
                    <button
                      onClick={() => deleteReport(selectedReport.id)}
                      className="p-2 bg-zinc-800 rounded-lg hover:bg-red-500/20 transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-5 h-5 text-zinc-300 hover:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats */}
              {selectedReport.stats?.taskStats && (
                <div className="p-6 border-b border-zinc-800">
                  <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    태스크 현황
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-zinc-100">
                        {selectedReport.stats.taskStats.total}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">전체</p>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-green-400">
                        {selectedReport.stats.taskStats.completed}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">완료</p>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-accent">
                        {selectedReport.stats.taskStats.completionRate}%
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">완료율</p>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-red-400">
                        {selectedReport.stats.taskStats.overdue}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">지연</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Team Activity */}
              {selectedReport.stats?.teamActivity?.memberProductivity?.length > 0 && (
                <div className="p-6 border-b border-zinc-800">
                  <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    팀원 생산성
                  </h3>
                  <div className="space-y-3">
                    {selectedReport.stats.teamActivity.memberProductivity.map((member, idx) => (
                      <div key={idx} className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-accent">
                            {member.name.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-zinc-200">{member.name}</span>
                            <span className="text-xs text-zinc-400">
                              {member.completed}/{member.total} ({member.rate}%)
                            </span>
                          </div>
                          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full transition-all"
                              style={{ width: `${member.rate}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Summary */}
              <div className="p-6">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  AI 분석 요약
                </h3>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-zinc-300 font-sans">
                      {selectedReport.summary || '요약이 생성되지 않았습니다.'}
                    </pre>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
              <Eye className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400">리포트를 선택하면 상세 내용이 표시됩니다</p>
            </div>
          )}
        </div>
      </div>

      {/* Generate Modal */}
      <AnimatePresence>
        {showGenerateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowGenerateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-zinc-100 mb-4">새 리포트 생성</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    리포트 유형
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setGenerateType('weekly')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        generateType === 'weekly'
                          ? 'border-accent bg-accent/10'
                          : 'border-zinc-700 hover:border-accent/50'
                      }`}
                    >
                      <Calendar className={`w-6 h-6 mx-auto mb-2 ${
                        generateType === 'weekly' ? 'text-accent' : 'text-zinc-400'
                      }`} />
                      <p className={`text-sm font-medium ${
                        generateType === 'weekly' ? 'text-accent' : 'text-zinc-300'
                      }`}>주간 리포트</p>
                      <p className="text-xs text-zinc-500 mt-1">최근 7일</p>
                    </button>
                    <button
                      onClick={() => setGenerateType('monthly')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        generateType === 'monthly'
                          ? 'border-accent bg-accent/10'
                          : 'border-zinc-700 hover:border-accent/50'
                      }`}
                    >
                      <BarChart3 className={`w-6 h-6 mx-auto mb-2 ${
                        generateType === 'monthly' ? 'text-accent' : 'text-zinc-400'
                      }`} />
                      <p className={`text-sm font-medium ${
                        generateType === 'monthly' ? 'text-accent' : 'text-zinc-300'
                      }`}>월간 리포트</p>
                      <p className="text-xs text-zinc-500 mt-1">최근 30일</p>
                    </button>
                  </div>
                </div>

                <p className="text-xs text-zinc-500">
                  AI가 해당 기간의 태스크, KPI, 팀 활동을 분석하여 리포트를 생성합니다.
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="flex-1 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={generateReport}
                  disabled={isGenerating}
                  className="flex-1 px-4 py-2 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    '리포트 생성'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
