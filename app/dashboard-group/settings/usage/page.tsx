'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTheme } from 'next-themes'
import { Loader2, TrendingUp, DollarSign, Zap, Calendar } from 'lucide-react'

interface DailyUsage {
  date: string
  provider: string
  model: string
  totalTokens: number
  costUsd: number
  requestCount: number
}

interface MonthlyTotal {
  totalTokens: number
  totalCostUsd: number
  requestCount: number
  byProvider: Record<string, { tokens: number; cost: number; requests: number }>
  byModel: Record<string, { tokens: number; cost: number; requests: number; provider: string }>
}

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10B981', // emerald
  google: '#3B82F6', // blue
  xai: '#8B5CF6', // violet
  mistral: '#F59E0B', // amber
  groq: '#EF4444', // red
}

const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  google: 'Google AI',
  xai: 'xAI (Grok)',
  mistral: 'Mistral',
  groq: 'Groq',
}

export default function UsagePage() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [monthlyTotal, setMonthlyTotal] = useState<MonthlyTotal | null>(null)
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([])
  const [selectedDays, setSelectedDays] = useState(30)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    fetchUsageData()
  }, [selectedDays])

  const isDark = mounted ? resolvedTheme === 'dark' : true

  const fetchUsageData = async () => {
    setIsLoading(true)
    try {
      const [monthlyRes, dailyRes] = await Promise.all([
        fetch('/api/usage?period=monthly'),
        fetch(`/api/usage?period=daily&days=${selectedDays}`),
      ])

      if (monthlyRes.ok) {
        const data = await monthlyRes.json()
        setMonthlyTotal({
          totalTokens: data.totalTokens,
          totalCostUsd: data.totalCostUsd,
          requestCount: data.requestCount,
          byProvider: data.byProvider,
          byModel: data.byModel || {},
        })
      }

      if (dailyRes.ok) {
        const data = await dailyRes.json()
        setDailyUsage(data.usage || [])
      }
    } catch (err) {
      console.error('Failed to fetch usage:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // 차트 데이터 준비
  const chartData = useMemo(() => {
    const dateMap: Record<string, Record<string, number>> = {}

    // 최근 N일 날짜 배열 생성
    const dates: string[] = []
    for (let i = selectedDays - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      dates.push(dateStr)
      dateMap[dateStr] = {}
    }

    // 데이터 채우기 (선택된 모델 필터링)
    for (const item of dailyUsage) {
      if (selectedModel && item.model !== selectedModel) continue
      if (!dateMap[item.date]) dateMap[item.date] = {}
      const key = selectedModel ? item.model : item.provider
      dateMap[item.date][key] = (dateMap[item.date][key] || 0) + item.costUsd
    }

    return dates.map((date) => ({
      date,
      ...dateMap[date],
    }))
  }, [dailyUsage, selectedDays, selectedModel])

  // 최대값 계산 (차트 스케일링용)
  const maxDailyCost = useMemo(() => {
    let max = 0
    for (const day of chartData) {
      const total = Object.entries(day)
        .filter(([k]) => k !== 'date')
        .reduce((sum, [, v]) => sum + (v as number), 0)
      if (total > max) max = total
    }
    return max || 1
  }, [chartData])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value)
  }

  const formatNumber = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
    return value.toString()
  }

  if (!mounted) return null

  return (
    <div className={`min-h-screen p-8 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-xl font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
            API 사용량
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>
            LLM API 사용량 및 비용을 확인합니다
          </p>
          <p className={`mt-2 text-xs ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
            * 표시된 비용은 토큰 사용량 기반 추정치입니다
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
          </div>
        ) : (
          <>
            {/* 이번 달 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* 총 비용 */}
              <div
                className={`p-5 rounded-xl border ${
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                  </div>
                  <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    이번 달 비용
                  </span>
                </div>
                <p className={`text-2xl font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                  {formatCurrency(monthlyTotal?.totalCostUsd || 0)}
                </p>
              </div>

              {/* 총 토큰 */}
              <div
                className={`p-5 rounded-xl border ${
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                    <Zap className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    총 토큰 사용량
                  </span>
                </div>
                <p className={`text-2xl font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                  {formatNumber(monthlyTotal?.totalTokens || 0)}
                </p>
              </div>

              {/* 요청 수 */}
              <div
                className={`p-5 rounded-xl border ${
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                    <TrendingUp className="w-5 h-5 text-violet-500" />
                  </div>
                  <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    API 요청 수
                  </span>
                </div>
                <p className={`text-2xl font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                  {formatNumber(monthlyTotal?.requestCount || 0)}
                </p>
              </div>
            </div>

            {/* 제공자별 사용량 */}
            {monthlyTotal?.byProvider && Object.keys(monthlyTotal.byProvider).length > 0 && (
              <div
                className={`p-5 rounded-xl border mb-4 ${
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                }`}
              >
                <h2 className={`text-sm font-medium mb-4 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  제공자별 사용량
                </h2>
                <div className="space-y-3">
                  {Object.entries(monthlyTotal.byProvider).map(([provider, stats]) => (
                    <div key={provider} className="flex items-center gap-4">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: PROVIDER_COLORS[provider] || '#6B7280' }}
                      />
                      <span className={`text-sm w-24 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        {PROVIDER_NAMES[provider] || provider}
                      </span>
                      <div className="flex-1">
                        <div
                          className={`h-2 rounded-full ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(stats.cost / (monthlyTotal.totalCostUsd || 1)) * 100}%`,
                              backgroundColor: PROVIDER_COLORS[provider] || '#6B7280',
                            }}
                          />
                        </div>
                      </div>
                      <span className={`text-sm w-24 text-right ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        {formatCurrency(stats.cost)}
                      </span>
                      <span className={`text-xs w-20 text-right ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {stats.requests} 요청
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 모델별 사용량 */}
            {monthlyTotal?.byModel && Object.keys(monthlyTotal.byModel).length > 0 && (
              <div
                className={`p-5 rounded-xl border mb-8 ${
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    모델별 사용량
                  </h2>
                  {selectedModel && (
                    <button
                      onClick={() => setSelectedModel(null)}
                      className={`text-xs px-2 py-1 rounded ${
                        isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                      }`}
                    >
                      전체 보기
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {Object.entries(monthlyTotal.byModel)
                    .sort((a, b) => b[1].cost - a[1].cost)
                    .map(([model, stats]) => (
                    <button
                      key={model}
                      onClick={() => setSelectedModel(selectedModel === model ? null : model)}
                      className={`w-full flex items-center gap-4 p-2 rounded-lg transition-all ${
                        selectedModel === model
                          ? isDark ? 'bg-zinc-800 ring-1 ring-zinc-700' : 'bg-zinc-100 ring-1 ring-zinc-300'
                          : isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PROVIDER_COLORS[stats.provider] || '#6B7280' }}
                      />
                      <div className="flex flex-col min-w-0 w-36 text-left">
                        <span className={`text-sm truncate ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                          {model}
                        </span>
                        <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          {PROVIDER_NAMES[stats.provider] || stats.provider}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div
                          className={`h-2 rounded-full ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(stats.cost / (monthlyTotal.totalCostUsd || 1)) * 100}%`,
                              backgroundColor: PROVIDER_COLORS[stats.provider] || '#6B7280',
                            }}
                          />
                        </div>
                      </div>
                      <span className={`text-sm w-24 text-right ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        {formatCurrency(stats.cost)}
                      </span>
                      <span className={`text-xs w-16 text-right ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {formatNumber(stats.tokens)} tk
                      </span>
                      <span className={`text-xs w-16 text-right ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {stats.requests}회
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 일별 차트 */}
            <div
              className={`p-5 rounded-xl border ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    일별 비용 추이
                  </h2>
                  {selectedModel && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                    }`}>
                      {selectedModel}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className={`w-4 h-4 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                  <select
                    value={selectedDays}
                    onChange={(e) => setSelectedDays(parseInt(e.target.value, 10))}
                    className={`text-sm px-2 py-1 rounded border ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        : 'bg-white border-zinc-300 text-zinc-700'
                    }`}
                  >
                    <option value={7}>최근 7일</option>
                    <option value={14}>최근 14일</option>
                    <option value={30}>최근 30일</option>
                    <option value={90}>최근 90일</option>
                  </select>
                </div>
              </div>

              {/* 간단한 바 차트 */}
              <div className="h-64 flex items-end gap-1">
                {chartData.map((day, idx) => {
                  const providers = Object.entries(day).filter(([k]) => k !== 'date')
                  const total = providers.reduce((sum, [, v]) => sum + (v as number), 0)
                  const heightPercent = (total / maxDailyCost) * 100

                  return (
                    <div
                      key={day.date}
                      className="flex-1 flex flex-col items-center group relative"
                    >
                      {/* 툴팁 */}
                      <div
                        className={`absolute bottom-full mb-2 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 ${
                          isDark ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800 text-white'
                        }`}
                      >
                        <div className="font-medium">{day.date}</div>
                        <div>{formatCurrency(total)}</div>
                      </div>

                      {/* 바 */}
                      <div
                        className={`w-full rounded-t transition-all ${
                          isDark ? 'bg-emerald-500/80' : 'bg-emerald-500'
                        }`}
                        style={{
                          height: `${Math.max(heightPercent, total > 0 ? 2 : 0)}%`,
                        }}
                      />

                      {/* 날짜 라벨 (7일 간격으로 표시) */}
                      {(idx === 0 || idx === chartData.length - 1 || idx % 7 === 0) && (
                        <span
                          className={`text-[10px] mt-1 ${
                            isDark ? 'text-zinc-600' : 'text-zinc-400'
                          }`}
                        >
                          {day.date.slice(5)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 범례 */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-zinc-800">
                {Object.entries(PROVIDER_COLORS).map(([provider, color]) => (
                  <div key={provider} className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {PROVIDER_NAMES[provider] || provider}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 데이터 없음 */}
            {(!monthlyTotal || monthlyTotal.requestCount === 0) && (
              <div className={`text-center py-12 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                <p className="text-sm">아직 API 사용 기록이 없습니다</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
