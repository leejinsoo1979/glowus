"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Flame, TrendingUp, Users, Clock, Zap, Target } from "lucide-react"
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
    if (heat >= 0.8) return { label: "🔥 핫", color: "bg-danger-500/20 text-danger-400" }
    if (heat >= 0.6) return { label: "🌡️ 따뜻", color: "bg-warning-500/20 text-warning-400" }
    if (heat >= 0.4) return { label: "😐 보통", color: "bg-accent/20 text-accent" }
    return { label: "🧊 차가움", color: "bg-zinc-700 text-zinc-400" }
  }

  const overallHeatLevel = getHeatLevel(data.overallHeat)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Overall Heat Score */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-zinc-400">전체 열 지수</CardTitle>
          <Flame className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-zinc-100">{Math.round(data.overallHeat * 100)}%</div>
          <div className="flex items-center space-x-2 mt-2">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${overallHeatLevel.color}`}>
              {overallHeatLevel.label}
            </span>
            {data.heatTrend === "up" && <TrendingUp className="h-3 w-3 text-success-500" />}
          </div>
          <p className="text-xs text-zinc-500 mt-2">피크 시간: {data.peakHours}</p>
        </CardContent>
      </Card>

      {/* Active Members */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-zinc-400">활성 팀원</CardTitle>
          <Users className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-zinc-100">{data.activeMembers}명</div>
          <p className="text-xs text-zinc-500">가장 활발한 날: {data.hottestDay}</p>
          <div className="mt-2">
            <div className="w-full bg-zinc-700 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-300 bg-accent"
                style={{
                  width: `${(data.activeMembers / 12) * 100}%`
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Average Session Time */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-zinc-400">평균 작업 시간</CardTitle>
          <Clock className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-zinc-100">{data.avgSessionTime}</div>
          <p className="text-xs text-zinc-500">지난주 대비 +12%</p>
          <div className="mt-2">
            <div className="w-full bg-zinc-700 rounded-full h-2">
              <div className="bg-accent h-2 rounded-full transition-all duration-300" style={{ width: "75%" }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hot Tasks */}
      <Card className="lg:col-span-3 bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-accent" />
            <CardTitle className="text-zinc-100">🔥 핫 태스크</CardTitle>
          </div>
          <p className="text-sm text-zinc-500">팀원 활동 및 상호작용 기반 가장 활발한 태스크</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {hotTasks.map((task, index) => (
              <div key={task.title} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
                <div className="flex items-center space-x-3">
                  <div
                    className="flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold bg-accent/20 text-accent"
                  >
                    {index + 1}
                  </div>
                  <span className="font-medium text-zinc-100">{task.title}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getHeatLevel(task.heat).color}`}>
                    {getHeatLevel(task.heat).label}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-zinc-500">{task.assignees}명 참여</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-16 h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-300 bg-accent"
                        style={{
                          width: `${task.heat * 100}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-zinc-300 w-8 text-right">{Math.round(task.heat * 100)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
