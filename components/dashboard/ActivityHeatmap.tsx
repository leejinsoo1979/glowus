"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useMemo, useEffect } from "react"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import { GitCommit } from "lucide-react"

const generateHeatmapData = (timeRange: string) => {
  const data = []
  const days = ["일", "월", "화", "수", "목", "금", "토"]

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      let intensity = Math.random() * 0.3

      if (timeRange === "month") {
        if (hour >= 9 && hour <= 21) intensity += Math.random() * 0.5
        if (day >= 1 && day <= 5) intensity += Math.random() * 0.4
        intensity *= 1.2
      } else if (timeRange === "quarter") {
        if (hour >= 10 && hour <= 20) intensity += Math.random() * 0.6
        if (day >= 1 && day <= 5) intensity += Math.random() * 0.5
        intensity *= 1.4
      } else {
        if (hour >= 8 && hour <= 22) intensity += Math.random() * 0.4
        if (day >= 1 && day <= 5) intensity += Math.random() * 0.3
      }

      data.push({
        day: days[day],
        hour,
        intensity: Math.min(intensity, 1),
        commits: Math.floor(intensity * (timeRange === "quarter" ? 100 : timeRange === "month" ? 75 : 50)),
      })
    }
  }

  return data
}

export function ActivityHeatmap() {
  const [timeRange, setTimeRange] = useState("week")
  const { accentColor } = useThemeStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const data = useMemo(() => generateHeatmapData(timeRange), [timeRange])
  const currentAccent = accentColors.find(c => c.id === accentColor) || accentColors[0]

  const getIntensityStyle = (intensity: number) => {
    // 낮은 활동은 회색 (라이트 모드: #e4e4e7, 다크 모드: #27272a)
    const emptyColor = typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
      ? "#27272a"
      : "#e4e4e7"
    if (!mounted) return { backgroundColor: emptyColor }
    if (intensity < 0.2) return { backgroundColor: emptyColor }
    if (intensity < 0.4) return { backgroundColor: `${currentAccent.color}33` } // 20% opacity
    if (intensity < 0.6) return { backgroundColor: `${currentAccent.color}66` } // 40% opacity
    if (intensity < 0.8) return { backgroundColor: `${currentAccent.color}99` } // 60% opacity
    return { backgroundColor: `${currentAccent.color}cc` } // 80% opacity
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const days = ["일", "월", "화", "수", "목", "금", "토"]

  const getTimeRangeDescription = () => {
    switch (timeRange) {
      case "month":
        return "지난 한 달간의 팀 활동 패턴"
      case "quarter":
        return "분기별 팀 활동 추세"
      default:
        return "이번 주 팀 활동 패턴"
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitCommit className="w-5 h-5 text-zinc-500 dark:text-white/50" />
          <span className="font-medium tracking-tight text-zinc-700 dark:text-white">COMMIT ACTIVITY</span>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-28 h-8 text-sm bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
            <SelectItem value="week" className="text-zinc-700 dark:text-zinc-100">이번 주</SelectItem>
            <SelectItem value="month" className="text-zinc-700 dark:text-zinc-100">이번 달</SelectItem>
            <SelectItem value="quarter" className="text-zinc-700 dark:text-zinc-100">이번 분기</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Subtitle */}
      <p className="text-sm text-zinc-500 mb-4">{getTimeRangeDescription()}</p>

      {/* Heat Map Grid */}
      <div className="flex-1 overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Hour labels */}
          <div className="flex mb-2">
            <div className="w-10"></div>
            {hours.filter((_, i) => i % 3 === 0).map((hour) => (
              <div key={hour} className="flex-1 text-xs text-center text-zinc-400 dark:text-zinc-500 min-w-[28px]">
                {hour === 0 ? "12a" : hour <= 12 ? `${hour}a` : `${hour - 12}p`}
              </div>
            ))}
          </div>

          {/* Heatmap rows */}
          {days.map((day) => (
            <div key={day} className="flex items-center mb-1">
              <div className="w-10 text-sm font-medium text-zinc-500">{day}</div>
              {hours.map((hour) => {
                const cellData = data.find((d) => d.day === day && d.hour === hour)
                return (
                  <div
                    key={`${day}-${hour}`}
                    className="flex-1 h-5 min-w-[28px] mx-0.5 rounded-sm cursor-pointer transition-all hover:scale-110"
                    style={getIntensityStyle(cellData?.intensity || 0)}
                    title={`${day}요일 ${hour}시 - ${cellData?.commits || 0} 활동 (${timeRange})`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-sm text-zinc-500 mt-4">
        <span>낮은 활동</span>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-zinc-200 dark:bg-zinc-800 rounded-sm"></div>
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: mounted ? `${currentAccent.color}33` : '#e4e4e7' }}
          ></div>
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: mounted ? `${currentAccent.color}66` : '#e4e4e7' }}
          ></div>
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: mounted ? `${currentAccent.color}99` : '#e4e4e7' }}
          ></div>
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: mounted ? `${currentAccent.color}cc` : '#e4e4e7' }}
          ></div>
        </div>
        <span>높은 활동</span>
      </div>
    </div>
  )
}
