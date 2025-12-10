'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import {
  TrendingUp,
  TrendingDown,
  Plus,
  X,
  BarChart3,
  DollarSign,
  Users,
  Activity,
  Target,
  Loader2,
  Calendar,
  Trash2,
  ChevronDown,
  LineChart,
} from 'lucide-react'

interface KpiMetric {
  id: string
  startup_id: string
  metric_type: string
  metric_value: number
  metric_unit: string | null
  period_start: string
  period_end: string
  created_at: string
}

interface Startup {
  id: string
  name: string
  founder_id: string
}

const KPI_TYPE_INFO: Record<string, { label: string; icon: typeof TrendingUp; color: string; unit: string }> = {
  mrr: { label: 'MRR (월간 반복 수익)', icon: DollarSign, color: 'text-green-400', unit: '원' },
  arr: { label: 'ARR (연간 반복 수익)', icon: DollarSign, color: 'text-green-500', unit: '원' },
  customers: { label: '고객 수', icon: Users, color: 'text-accent', unit: '명' },
  churn_rate: { label: '이탈률', icon: TrendingDown, color: 'text-red-400', unit: '%' },
  dau: { label: 'DAU (일간 활성 사용자)', icon: Activity, color: 'text-purple-400', unit: '명' },
  mau: { label: 'MAU (월간 활성 사용자)', icon: Activity, color: 'text-purple-500', unit: '명' },
  cac: { label: 'CAC (고객 획득 비용)', icon: Target, color: 'text-orange-400', unit: '원' },
  ltv: { label: 'LTV (고객 생애 가치)', icon: TrendingUp, color: 'text-cyan-400', unit: '원' },
  nps: { label: 'NPS (순추천 지수)', icon: BarChart3, color: 'text-yellow-400', unit: '점' },
  burn_rate: { label: '번레이트 (월간 소모율)', icon: TrendingDown, color: 'text-red-500', unit: '원' },
  runway: { label: '런웨이', icon: Calendar, color: 'text-indigo-400', unit: '개월' },
  revenue: { label: '총 매출', icon: DollarSign, color: 'text-emerald-400', unit: '원' },
  gmv: { label: 'GMV (총 거래액)', icon: BarChart3, color: 'text-teal-400', unit: '원' },
  conversion_rate: { label: '전환율', icon: Target, color: 'text-pink-400', unit: '%' },
  retention_rate: { label: '리텐션율', icon: TrendingUp, color: 'text-sky-400', unit: '%' },
  other: { label: '기타', icon: LineChart, color: 'text-zinc-400', unit: '' },
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export default function KpisPage() {
  const { user } = useAuthStore()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [startups, setStartups] = useState<Startup[]>([])
  const [selectedStartup, setSelectedStartup] = useState<string>('')
  const [kpis, setKpis] = useState<KpiMetric[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedKpiType, setSelectedKpiType] = useState<string>('mrr')

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === 'dark' : true

  // Form state
  const [formData, setFormData] = useState({
    metric_type: 'mrr',
    metric_value: '',
    metric_unit: '',
    period_start: '',
    period_end: '',
  })

  // Fetch startups
  const fetchStartups = useCallback(async () => {
    try {
      const response = await fetch('/api/startups')
      const result = await response.json()
      if (result.data && result.data.length > 0) {
        setStartups(result.data)
        setSelectedStartup(result.data[0].id)
      }
    } catch (error) {
      console.error('Failed to fetch startups:', error)
    }
  }, [])

  // Fetch KPIs
  const fetchKpis = useCallback(async () => {
    if (!selectedStartup) return

    try {
      setIsLoading(true)
      const response = await fetch(`/api/kpis?startup_id=${selectedStartup}`)
      const result = await response.json()
      if (result.data) {
        setKpis(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch KPIs:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedStartup])

  useEffect(() => {
    fetchStartups()
  }, [fetchStartups])

  useEffect(() => {
    if (selectedStartup) {
      fetchKpis()
    }
  }, [selectedStartup, fetchKpis])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStartup) return

    setIsSubmitting(true)
    try {
      const typeInfo = KPI_TYPE_INFO[formData.metric_type]
      const response = await fetch('/api/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startup_id: selectedStartup,
          metric_type: formData.metric_type,
          metric_value: parseFloat(formData.metric_value),
          metric_unit: formData.metric_unit || typeInfo?.unit || null,
          period_start: formData.period_start,
          period_end: formData.period_end,
        }),
      })

      if (response.ok) {
        setIsModalOpen(false)
        setFormData({
          metric_type: 'mrr',
          metric_value: '',
          metric_unit: '',
          period_start: '',
          period_end: '',
        })
        fetchKpis()
      }
    } catch (error) {
      console.error('Failed to create KPI:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (kpiId: string) => {
    if (!confirm('이 KPI 데이터를 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/kpis?id=${kpiId}&startup_id=${selectedStartup}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchKpis()
      }
    } catch (error) {
      console.error('Failed to delete KPI:', error)
    }
  }

  const formatValue = (value: number, type: string): string => {
    const typeInfo = KPI_TYPE_INFO[type]
    if (typeInfo?.unit === '원') {
      if (value >= 100000000) {
        return `${(value / 100000000).toFixed(1)}억원`
      } else if (value >= 10000) {
        return `${(value / 10000).toFixed(0)}만원`
      }
      return `${value.toLocaleString()}원`
    }
    if (typeInfo?.unit === '%') {
      return `${value.toFixed(1)}%`
    }
    if (typeInfo?.unit === '명') {
      return `${value.toLocaleString()}명`
    }
    if (typeInfo?.unit === '개월') {
      return `${value}개월`
    }
    if (typeInfo?.unit === '점') {
      return `${value}점`
    }
    return value.toLocaleString()
  }

  // Group KPIs by type
  const groupedKpis = kpis.reduce((acc, kpi) => {
    if (!acc[kpi.metric_type]) {
      acc[kpi.metric_type] = []
    }
    acc[kpi.metric_type].push(kpi)
    return acc
  }, {} as Record<string, KpiMetric[]>)

  // Get current startup
  const currentStartup = startups.find(s => s.id === selectedStartup)
  const isFounder = currentStartup?.founder_id === user?.id

  if (isLoading && startups.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
          <p className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>KPI 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-8"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>KPI 관리</h1>
          <p className={`mt-2 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>스타트업의 핵심 지표를 추적하세요</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Startup Selector */}
          {startups.length > 1 && (
            <div className="relative">
              <select
                value={selectedStartup}
                onChange={(e) => setSelectedStartup(e.target.value)}
                className={`appearance-none px-4 py-2.5 pr-10 rounded-xl border focus:outline-none focus-accent cursor-pointer ${
                  isDark
                    ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
                    : 'bg-white text-zinc-900 border-zinc-300'
                }`}
              >
                {startups.map((startup) => (
                  <option key={startup.id} value={startup.id}>
                    {startup.name}
                  </option>
                ))}
              </select>
              <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} />
            </div>
          )}

          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            KPI 추가
          </Button>
        </div>
      </motion.div>

      {/* KPI Summary Cards */}
      {Object.keys(groupedKpis).length > 0 && (
        <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {Object.entries(groupedKpis).slice(0, 4).map(([type, metrics]) => {
            const typeInfo = KPI_TYPE_INFO[type] || KPI_TYPE_INFO.other
            const Icon = typeInfo.icon
            const latestMetric = metrics[0]
            const previousMetric = metrics[1]

            let changePercent = 0
            if (previousMetric && previousMetric.metric_value !== 0) {
              changePercent = ((latestMetric.metric_value - previousMetric.metric_value) / previousMetric.metric_value) * 100
            }

            return (
              <Card key={type} variant="default">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isDark ? 'bg-gradient-to-br from-zinc-700 to-zinc-800' : 'bg-zinc-100'
                    }`}>
                      <Icon className={`w-6 h-6 ${typeInfo.color}`} />
                    </div>
                    {previousMetric && (
                      <div className={`flex items-center gap-1 text-sm ${changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {changePercent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {Math.abs(changePercent).toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{typeInfo.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                      {formatValue(latestMetric.metric_value, type)}
                    </p>
                    <p className={`text-xs mt-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {new Date(latestMetric.period_end).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' })} 기준
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </motion.div>
      )}

      {/* KPI History by Type */}
      {Object.keys(groupedKpis).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedKpis).map(([type, metrics]) => {
            const typeInfo = KPI_TYPE_INFO[type] || KPI_TYPE_INFO.other
            const Icon = typeInfo.icon

            return (
              <motion.div key={type} variants={item}>
                <Card variant="default">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${typeInfo.color}`} />
                      </div>
                      <CardTitle>{typeInfo.label}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-zinc-800">
                            <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">기간</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">값</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">변화</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">기록일</th>
                            {isFounder && (
                              <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400"></th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.map((metric, index) => {
                            const prevMetric = metrics[index + 1]
                            let changePercent = 0
                            if (prevMetric && prevMetric.metric_value !== 0) {
                              changePercent = ((metric.metric_value - prevMetric.metric_value) / prevMetric.metric_value) * 100
                            }

                            return (
                              <tr key={metric.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                <td className="py-3 px-4">
                                  <span className="text-sm text-zinc-100">
                                    {new Date(metric.period_start).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                    {' - '}
                                    {new Date(metric.period_end).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="text-sm font-medium text-zinc-100">
                                    {formatValue(metric.metric_value, type)}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {prevMetric ? (
                                    <span className={`inline-flex items-center gap-1 text-sm ${changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      {changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                      {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
                                    </span>
                                  ) : (
                                    <span className="text-sm text-zinc-500">-</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="text-sm text-zinc-500">
                                    {new Date(metric.created_at).toLocaleDateString('ko-KR')}
                                  </span>
                                </td>
                                {isFounder && (
                                  <td className="py-3 px-4 text-right">
                                    <button
                                      onClick={() => handleDelete(metric.id)}
                                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      ) : (
        <motion.div variants={item}>
          <Card variant="default" className="py-16">
            <div className="text-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                <BarChart3 className={`w-8 h-8 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
              </div>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>아직 KPI 데이터가 없습니다</h3>
              <p className={`mt-2 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>첫 번째 KPI를 추가하여 성과를 추적하세요</p>
              <Button className="mt-6" onClick={() => setIsModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                KPI 추가
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Add KPI Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              className={`rounded-2xl p-6 w-full max-w-lg shadow-2xl ${
                isDark
                  ? 'bg-zinc-900 border border-zinc-800'
                  : 'bg-white border border-zinc-200'
              }`}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-xl font-bold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>KPI 추가</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}
                >
                  <X className={`w-5 h-5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    KPI 유형 *
                  </label>
                  <div className="relative">
                    <select
                      value={formData.metric_type}
                      onChange={(e) => {
                        setFormData({ ...formData, metric_type: e.target.value })
                        setSelectedKpiType(e.target.value)
                      }}
                      className={`w-full appearance-none px-4 py-3 pr-10 rounded-xl border focus:outline-none focus-accent ${
                        isDark
                          ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
                          : 'bg-white text-zinc-900 border-zinc-300'
                      }`}
                      required
                    >
                      {Object.entries(KPI_TYPE_INFO).map(([key, info]) => (
                        <option key={key} value={key}>
                          {info.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      값 *
                    </label>
                    <Input
                      type="number"
                      step="any"
                      value={formData.metric_value}
                      onChange={(e) => setFormData({ ...formData, metric_value: e.target.value })}
                      placeholder="0"
                      required
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      단위
                    </label>
                    <Input
                      type="text"
                      value={formData.metric_unit || KPI_TYPE_INFO[selectedKpiType]?.unit || ''}
                      onChange={(e) => setFormData({ ...formData, metric_unit: e.target.value })}
                      placeholder={KPI_TYPE_INFO[selectedKpiType]?.unit || '단위'}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      기간 시작 *
                    </label>
                    <Input
                      type="date"
                      value={formData.period_start}
                      onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      기간 종료 *
                    </label>
                    <Input
                      type="date"
                      value={formData.period_end}
                      onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setIsModalOpen(false)}
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        저장 중...
                      </>
                    ) : (
                      'KPI 추가'
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
