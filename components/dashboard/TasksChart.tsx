"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { useState, useEffect } from "react"
import { useThemeStore, accentColors } from "@/stores/themeStore"

const weeklyData = [
  { name: "월", completed: 12, created: 8 },
  { name: "화", completed: 8, created: 15 },
  { name: "수", completed: 15, created: 12 },
  { name: "목", completed: 10, created: 9 },
  { name: "금", completed: 18, created: 14 },
  { name: "토", completed: 5, created: 3 },
  { name: "일", completed: 3, created: 2 },
]

const monthlyData = [
  { name: "1주", completed: 45, created: 52 },
  { name: "2주", completed: 58, created: 48 },
  { name: "3주", completed: 62, created: 55 },
  { name: "4주", completed: 71, created: 60 },
]

interface TasksChartProps {
  title?: string
}

export function TasksChart({ title = "태스크 현황" }: TasksChartProps) {
  const [view, setView] = useState<"weekly" | "monthly">("weekly")
  const { accentColor } = useThemeStore()
  const [mounted, setMounted] = useState(false)
  const data = view === "weekly" ? weeklyData : monthlyData

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentAccent = accentColors.find(c => c.id === accentColor) || accentColors[0]
  const chartAccentColor = mounted ? currentAccent.color : "var(--accent-color)"

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl">
          <p className="font-semibold text-zinc-100 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
              <span className="text-zinc-400">{entry.dataKey === "completed" ? "완료" : "생성"}:</span>
              <span className="text-zinc-100 font-medium">{entry.value}개</span>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-zinc-100">{title}</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: chartAccentColor }}
                ></div>
                <span className="text-zinc-400">완료</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                <span className="text-zinc-400">생성</span>
              </div>
            </div>
            <div className="flex bg-zinc-800 rounded-lg p-1">
              <button
                onClick={() => setView("weekly")}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  view === "weekly" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                주간
              </button>
              <button
                onClick={() => setView("monthly")}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  view === "monthly" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                월간
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.5} />
              <XAxis dataKey="name" stroke="#71717a" fontSize={12} fontWeight={500} />
              <YAxis stroke="#71717a" fontSize={12} fontWeight={500} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="completed" fill={chartAccentColor} radius={[4, 4, 0, 0]} />
              <Bar dataKey="created" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function ProductivityChart() {
  const { accentColor } = useThemeStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentAccent = accentColors.find(c => c.id === accentColor) || accentColors[0]
  const chartAccentColor = mounted ? currentAccent.color : "var(--accent-color)"

  const data = [
    { name: "월", score: 72 },
    { name: "화", score: 78 },
    { name: "수", score: 85 },
    { name: "목", score: 80 },
    { name: "금", score: 92 },
    { name: "토", score: 68 },
    { name: "일", score: 55 },
  ]

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl">
          <p className="font-semibold text-zinc-100">{label}요일</p>
          <p className="text-sm font-medium" style={{ color: chartAccentColor }}>생산성: {payload[0].value}%</p>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-zinc-100">주간 생산성 추이</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.5} />
              <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
              <YAxis stroke="#71717a" fontSize={12} domain={[0, 100]} />
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
        </div>
      </CardContent>
    </Card>
  )
}
