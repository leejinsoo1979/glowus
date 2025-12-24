"use client"

import { Flame, TrendingUp, Users, Clock, Zap, Sparkles, ThermometerSun, Minus } from "lucide-react"
import { useState, useEffect } from "react"
import { useThemeStore, accentColors } from "@/stores/themeStore"

interface EngagementData {
  overallHeat: number
  peakHours: string
  hottestDay: string
  activeMembers: number
  avgSessionTime: string
  heatTrend: "up" | "down" | "stable"
}

interface HotTask {
  title: string
  heat: number
  assignees: number
}

interface EngagementOverviewProps {
  data?: EngagementData
  hotTasks?: HotTask[]
}

const defaultEngagementData: EngagementData = {
  overallHeat: 0.78,
  peakHours: "오후 2시 - 4시",
  hottestDay: "수요일",
  activeMembers: 8,
  avgSessionTime: "45분",
  heatTrend: "up",
}

const defaultHotTasks: HotTask[] = [
  { title: "결제 시스템 연동", heat: 0.95, assignees: 3 },
  { title: "사용자 인증 개선", heat: 0.87, assignees: 2 },
  { title: "대시보드 UI 리팩토링", heat: 0.82, assignees: 2 },
  { title: "API 성능 최적화", heat: 0.74, assignees: 1 },
  { title: "테스트 커버리지 향상", heat: 0.68, assignees: 2 },
]

export function EngagementOverview({
  data = defaultEngagementData,
  hotTasks = defaultHotTasks
}: EngagementOverviewProps) {
  const { accentColor } = useThemeStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentAccent = accentColors.find(c => c.id === accentColor) || accentColors[0]

  const getHeatLevel = (heat: number) => {
    if (heat >= 0.8) return {
      label: "HOT",
      color: "bg-red-500/20 text-red-400",
      icon: <Flame className="w-3 h-3" />
    }
    if (heat >= 0.6) return {
      label: "WARM",
      color: "bg-orange-500/20 text-orange-400",
      icon: <ThermometerSun className="w-3 h-3" />
    }
    return {
      label: "NORMAL",
      color: "bg-zinc-500/20 text-zinc-400",
      icon: <Minus className="w-3 h-3" />
    }
  }

  const overallHeatLevel = getHeatLevel(data.overallHeat)

  return (
    <div className="h-full flex flex-col">
      {/* Top Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Overall Heat */}
        <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">전체 열 지수</span>
            <Flame className="h-3 w-3 text-accent" />
          </div>
          <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{Math.round(data.overallHeat * 100)}%</div>
          <div className="flex items-center gap-1 mt-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${overallHeatLevel.color}`}>
              {overallHeatLevel.icon}
              {overallHeatLevel.label}
            </span>
            {data.heatTrend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
          </div>
        </div>

        {/* Active Members */}
        <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">활성 팀원</span>
            <Users className="h-3 w-3 text-accent" />
          </div>
          <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{data.activeMembers}명</div>
          <p className="text-[10px] text-zinc-500 mt-1">가장 활발한 날: {data.hottestDay}</p>
          <div className="w-full bg-zinc-300 dark:bg-zinc-700 rounded-full h-1 mt-1">
            <div className="h-1 rounded-full bg-accent" style={{ width: `${(data.activeMembers / 12) * 100}%` }} />
          </div>
        </div>

        {/* Average Session Time */}
        <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">평균 작업 시간</span>
            <Clock className="h-3 w-3 text-accent" />
          </div>
          <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{data.avgSessionTime}</div>
          <p className="text-[10px] text-zinc-500 mt-1">지난주 대비 +12%</p>
          <div className="w-full bg-zinc-300 dark:bg-zinc-700 rounded-full h-1 mt-1">
            <div className="bg-accent h-1 rounded-full" style={{ width: "75%" }} />
          </div>
        </div>
      </div>

      {/* Hot Tasks */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-100">Trending Tasks</span>
        </div>
        <p className="text-xs text-zinc-500 mb-2">팀원 활동 및 상호작용 기반 가장 활발한 태스크</p>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {hotTasks.map((task, index) => (
            <div key={task.title} className="flex items-center justify-between p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold bg-accent/20 text-accent">
                  {index + 1}
                </div>
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{task.title}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-0.5 ${getHeatLevel(task.heat).color}`}>
                  {getHeatLevel(task.heat).icon}
                  {getHeatLevel(task.heat).label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">{task.assignees}명 참여</span>
                <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${task.heat * 100}%` }} />
                </div>
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 w-7 text-right">{Math.round(task.heat * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
