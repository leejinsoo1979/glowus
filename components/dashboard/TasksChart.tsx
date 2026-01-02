"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { useState, useEffect } from "react"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import { useTheme } from "next-themes"
import { Loader2 } from "lucide-react"

interface WeeklyData {
  name: string
  completed: number
  created: number
  date?: string
}

interface TasksChartProps {
  title?: string
}

export function TasksChart({ title = "태스크 현황" }: TasksChartProps) {
  const [view, setView] = useState<"weekly" | "monthly">("weekly")
  const { accentColor } = useThemeStore()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [monthlyData, setMonthlyData] = useState<WeeklyData[]>([])
  const isDark = mounted && resolvedTheme === "dark"

  useEffect(() => {
    setMounted(true)
    fetchChartData()
  }, [])

  const fetchChartData = async () => {
    try {
      const res = await fetch('/api/dashboard/engagement')
      if (res.ok) {
        const json = await res.json()
        setWeeklyData(json.weeklyStats || [])
        // 월간 데이터: 주간 데이터를 4주로 집계
        const weekly = json.weeklyStats || []
        if (weekly.length > 0) {
          const totalCompleted = weekly.reduce((sum: number, d: WeeklyData) => sum + d.completed, 0)
          const totalCreated = weekly.reduce((sum: number, d: WeeklyData) => sum + d.created, 0)
          setMonthlyData([
            { name: "이번주", completed: totalCompleted, created: totalCreated },
          ])
        }
      }
    } catch (err) {
      console.error('Failed to fetch chart data:', err)
    } finally {
      setLoading(false)
    }
  }

  const data = view === "weekly" ? weeklyData : monthlyData

  const currentAccent = accentColors.find(c => c.id === accentColor) || accentColors[0]
  const chartAccentColor = mounted ? currentAccent.color : "var(--accent-color)"

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 shadow-xl">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="text-sm flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
              <span className="text-zinc-500 dark:text-zinc-400">{entry.dataKey === "completed" ? "완료" : "생성"}:</span>
              <span className="text-zinc-900 dark:text-zinc-100 font-medium">{entry.value}개</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: chartAccentColor }}
              ></div>
              <span className="text-zinc-500 dark:text-zinc-400">완료</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
              <span className="text-zinc-500 dark:text-zinc-400">생성</span>
            </div>
          </div>
          <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setView("weekly")}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${view === "weekly" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
            >
              주간
            </button>
            <button
              onClick={() => setView("monthly")}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${view === "monthly" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
            >
              월간
            </button>
          </div>
        </div>
      </div>
      {/* Chart */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-400 text-sm">
            데이터가 없습니다
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#3f3f46" : "#e4e4e7"} opacity={0.5} />
            <XAxis dataKey="name" stroke={isDark ? "#71717a" : "#a1a1aa"} fontSize={12} fontWeight={500} tick={{ fill: isDark ? "#a1a1aa" : "#71717a" }} />
            <YAxis stroke={isDark ? "#71717a" : "#a1a1aa"} fontSize={12} fontWeight={500} tick={{ fill: isDark ? "#a1a1aa" : "#71717a" }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: isDark ? '#3f3f46' : '#f4f4f5', opacity: 0.4 }} />
            <Bar dataKey="completed" fill={chartAccentColor} radius={[4, 4, 0, 0]} />
            <Bar dataKey="created" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

interface ProductivityData {
  name: string
  score: number
}

export function ProductivityChart() {
  const { accentColor } = useThemeStore()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ProductivityData[]>([])
  const isDark = mounted && resolvedTheme === "dark"

  useEffect(() => {
    setMounted(true)
    fetchProductivityData()
  }, [])

  const fetchProductivityData = async () => {
    try {
      const res = await fetch('/api/dashboard/engagement')
      if (res.ok) {
        const json = await res.json()
        setData(json.productivityData || [])
      }
    } catch (err) {
      console.error('Failed to fetch productivity data:', err)
    } finally {
      setLoading(false)
    }
  }

  const currentAccent = accentColors.find(c => c.id === accentColor) || accentColors[0]
  const chartAccentColor = mounted ? currentAccent.color : "var(--accent-color)"

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 shadow-xl">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{label}요일</p>
          <p className="text-sm font-medium" style={{ color: chartAccentColor }}>생산성: {payload[0].value}%</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-100 mb-4">주간 생산성 추이</h3>
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-400 text-sm">
            데이터가 없습니다
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#3f3f46" : "#e4e4e7"} opacity={0.3} />
            <XAxis dataKey="name" stroke={isDark ? "#71717a" : "#a1a1aa"} fontSize={12} tick={{ fill: isDark ? "#a1a1aa" : "#71717a" }} />
            <YAxis stroke={isDark ? "#71717a" : "#a1a1aa"} fontSize={12} domain={[0, 100]} tick={{ fill: isDark ? "#a1a1aa" : "#71717a" }} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="score"
              stroke={chartAccentColor}
              strokeWidth={3}
              dot={{ fill: chartAccentColor, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: chartAccentColor }}
            />
          </LineChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
