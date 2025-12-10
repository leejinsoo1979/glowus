"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Calendar,
  Users,
  Filter,
  Download,
} from "lucide-react"

export interface GanttTask {
  id: string
  title: string
  startDate: Date
  endDate: Date
  progress: number // 0-100
  assignee?: {
    id: string
    name: string
    avatar?: string
  }
  dependencies?: string[]
  color?: string
  milestone?: boolean
  group?: string
}

interface GanttChartProps {
  tasks?: GanttTask[]
  onTaskClick?: (task: GanttTask) => void
  onTaskUpdate?: (task: GanttTask) => void
}

const defaultTasks: GanttTask[] = [
  {
    id: "1",
    title: "프로젝트 킥오프",
    startDate: new Date(2024, 11, 1),
    endDate: new Date(2024, 11, 3),
    progress: 100,
    assignee: { id: "1", name: "김철수" },
    group: "기획",
    milestone: true,
  },
  {
    id: "2",
    title: "요구사항 분석",
    startDate: new Date(2024, 11, 4),
    endDate: new Date(2024, 11, 10),
    progress: 100,
    assignee: { id: "2", name: "이영희" },
    dependencies: ["1"],
    group: "기획",
  },
  {
    id: "3",
    title: "UI/UX 설계",
    startDate: new Date(2024, 11, 8),
    endDate: new Date(2024, 11, 18),
    progress: 75,
    assignee: { id: "3", name: "박민수" },
    dependencies: ["2"],
    group: "디자인",
  },
  {
    id: "4",
    title: "데이터베이스 설계",
    startDate: new Date(2024, 11, 10),
    endDate: new Date(2024, 11, 15),
    progress: 100,
    assignee: { id: "1", name: "김철수" },
    dependencies: ["2"],
    group: "개발",
  },
  {
    id: "5",
    title: "백엔드 API 개발",
    startDate: new Date(2024, 11, 15),
    endDate: new Date(2024, 11, 28),
    progress: 45,
    assignee: { id: "1", name: "김철수" },
    dependencies: ["4"],
    group: "개발",
  },
  {
    id: "6",
    title: "프론트엔드 개발",
    startDate: new Date(2024, 11, 18),
    endDate: new Date(2025, 0, 5),
    progress: 30,
    assignee: { id: "2", name: "이영희" },
    dependencies: ["3"],
    group: "개발",
  },
  {
    id: "7",
    title: "테스트 및 QA",
    startDate: new Date(2025, 0, 2),
    endDate: new Date(2025, 0, 12),
    progress: 0,
    assignee: { id: "4", name: "최수진" },
    dependencies: ["5", "6"],
    group: "QA",
  },
  {
    id: "8",
    title: "배포",
    startDate: new Date(2025, 0, 13),
    endDate: new Date(2025, 0, 15),
    progress: 0,
    assignee: { id: "1", name: "김철수" },
    dependencies: ["7"],
    group: "배포",
    milestone: true,
  },
]

type ViewMode = "day" | "week" | "month"

export function GanttChart({
  tasks = defaultTasks,
  onTaskClick,
  onTaskUpdate,
}: GanttChartProps) {
  const [mounted, setMounted] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [startOffset, setStartOffset] = useState(0)
  const { accentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate date range
  const dateRange = useMemo(() => {
    const allDates = tasks.flatMap((t) => [t.startDate, t.endDate])
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())))

    // Add padding
    minDate.setDate(minDate.getDate() - 3)
    maxDate.setDate(maxDate.getDate() + 7)

    return { minDate, maxDate }
  }, [tasks])

  // Generate columns based on view mode
  const columns = useMemo(() => {
    const cols: { date: Date; label: string; isWeekend: boolean }[] = []
    const { minDate, maxDate } = dateRange
    const current = new Date(minDate)
    current.setDate(current.getDate() + startOffset)

    const daysToShow = viewMode === "day" ? 14 : viewMode === "week" ? 28 : 60

    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(current)
      const isWeekend = date.getDay() === 0 || date.getDay() === 6

      if (viewMode === "day") {
        cols.push({
          date,
          label: `${date.getMonth() + 1}/${date.getDate()}`,
          isWeekend,
        })
      } else if (viewMode === "week") {
        cols.push({
          date,
          label: `${date.getMonth() + 1}/${date.getDate()}`,
          isWeekend,
        })
      } else {
        cols.push({
          date,
          label: `${date.getMonth() + 1}/${date.getDate()}`,
          isWeekend,
        })
      }

      current.setDate(current.getDate() + 1)
    }

    return cols
  }, [dateRange, viewMode, startOffset])

  // Calculate task position
  const getTaskPosition = (task: GanttTask) => {
    const startCol = columns.findIndex(
      (col) => col.date.toDateString() === task.startDate.toDateString()
    )
    const endCol = columns.findIndex(
      (col) => col.date.toDateString() === task.endDate.toDateString()
    )

    if (startCol === -1 && endCol === -1) return null

    const actualStart = Math.max(0, startCol)
    const actualEnd = endCol === -1 ? columns.length - 1 : endCol

    return {
      left: actualStart,
      width: Math.max(1, actualEnd - actualStart + 1),
      isPartialStart: startCol < 0,
      isPartialEnd: endCol === -1 || endCol >= columns.length,
    }
  }

  // Group tasks
  const groupedTasks = useMemo(() => {
    const groups: Record<string, GanttTask[]> = {}
    tasks.forEach((task) => {
      const group = task.group || "기타"
      if (!groups[group]) groups[group] = []
      groups[group].push(task)
    })
    return groups
  }, [tasks])

  const columnWidth = viewMode === "day" ? 60 : viewMode === "week" ? 40 : 25
  const accentColorValue = mounted ? currentAccent.color : "var(--accent-color)"

  const getProgressColor = (progress: number) => {
    if (progress === 100) return "#22c55e"
    if (progress >= 50) return accentColorValue
    if (progress > 0) return "#f59e0b"
    return "#71717a"
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5" style={{ color: accentColorValue }} />
            <CardTitle className="text-zinc-100">프로젝트 타임라인</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {/* Navigation */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setStartOffset((s) => s - 7)}
              className="text-zinc-400 hover:text-zinc-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setStartOffset(0)}
              className="text-zinc-400 hover:text-zinc-100 text-xs px-2"
            >
              오늘
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setStartOffset((s) => s + 7)}
              className="text-zinc-400 hover:text-zinc-100"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* View Mode */}
            <div className="flex bg-zinc-800 rounded-lg p-1 ml-2">
              {(["day", "week", "month"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    viewMode === mode
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {mode === "day" ? "일" : mode === "week" ? "주" : "월"}
                </button>
              ))}
            </div>

            {/* Actions */}
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-100">
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-100">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto" ref={containerRef}>
          <div className="min-w-max">
            {/* Timeline Header */}
            <div className="flex border-b border-zinc-800">
              {/* Task Info Column */}
              <div className="w-64 flex-shrink-0 px-4 py-3 bg-zinc-900 border-r border-zinc-800 sticky left-0 z-10">
                <span className="text-sm font-medium text-zinc-400">태스크</span>
              </div>

              {/* Date Columns */}
              <div className="flex">
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className={`flex-shrink-0 px-1 py-3 text-center border-r border-zinc-800/50 ${
                      col.isWeekend ? "bg-zinc-800/30" : ""
                    } ${
                      col.date.toDateString() === new Date().toDateString()
                        ? "bg-accent/10"
                        : ""
                    }`}
                    style={{ width: columnWidth }}
                  >
                    <span className="text-xs text-zinc-500">{col.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Task Rows */}
            {Object.entries(groupedTasks).map(([group, groupTasks]) => (
              <div key={group}>
                {/* Group Header */}
                <div className="flex bg-zinc-800/50">
                  <div className="w-64 flex-shrink-0 px-4 py-2 border-r border-zinc-800 sticky left-0 z-10 bg-zinc-800/50">
                    <span className="text-xs font-semibold text-zinc-300">{group}</span>
                  </div>
                  <div className="flex-1" />
                </div>

                {/* Tasks in Group */}
                {groupTasks.map((task) => {
                  const position = getTaskPosition(task)

                  return (
                    <div
                      key={task.id}
                      className="flex border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                    >
                      {/* Task Info */}
                      <div className="w-64 flex-shrink-0 px-4 py-3 border-r border-zinc-800 sticky left-0 z-10 bg-zinc-900">
                        <div className="flex items-center gap-3">
                          {task.assignee && (
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0"
                              style={{ backgroundColor: accentColorValue }}
                            >
                              {task.assignee.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-100 truncate">
                              {task.title}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {task.progress}% 완료
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Gantt Bar Area */}
                      <div className="flex relative" style={{ minHeight: 56 }}>
                        {columns.map((col, i) => (
                          <div
                            key={i}
                            className={`flex-shrink-0 border-r border-zinc-800/30 ${
                              col.isWeekend ? "bg-zinc-800/20" : ""
                            } ${
                              col.date.toDateString() === new Date().toDateString()
                                ? "bg-accent/5"
                                : ""
                            }`}
                            style={{ width: columnWidth }}
                          />
                        ))}

                        {/* Task Bar */}
                        {position && (
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 h-8 rounded-lg cursor-pointer transition-all hover:opacity-90 group ${
                              task.milestone ? "flex items-center justify-center" : ""
                            }`}
                            style={{
                              left: position.left * columnWidth + 4,
                              width: task.milestone
                                ? 24
                                : position.width * columnWidth - 8,
                              backgroundColor: task.milestone
                                ? "transparent"
                                : `${getProgressColor(task.progress)}33`,
                              borderLeft: position.isPartialStart
                                ? "none"
                                : `3px solid ${getProgressColor(task.progress)}`,
                            }}
                            onClick={() => onTaskClick?.(task)}
                          >
                            {task.milestone ? (
                              <div
                                className="w-6 h-6 rotate-45 rounded-sm"
                                style={{
                                  backgroundColor: getProgressColor(task.progress),
                                }}
                              />
                            ) : (
                              <>
                                {/* Progress Fill */}
                                <div
                                  className="absolute left-0 top-0 bottom-0 rounded-l-lg"
                                  style={{
                                    width: `${task.progress}%`,
                                    backgroundColor: `${getProgressColor(
                                      task.progress
                                    )}66`,
                                  }}
                                />
                                {/* Task Title */}
                                <span className="relative z-10 px-2 text-xs font-medium text-zinc-100 truncate leading-8">
                                  {task.title}
                                </span>
                              </>
                            )}

                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                              <p className="text-sm font-medium text-zinc-100">
                                {task.title}
                              </p>
                              <p className="text-xs text-zinc-400">
                                {task.startDate.toLocaleDateString("ko-KR")} -{" "}
                                {task.endDate.toLocaleDateString("ko-KR")}
                              </p>
                              <p className="text-xs text-zinc-400">
                                진행률: {task.progress}%
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Today Line */}
            {columns.some(
              (col) => col.date.toDateString() === new Date().toDateString()
            ) && (
              <div
                className="absolute top-0 bottom-0 w-0.5 z-20 pointer-events-none"
                style={{
                  left:
                    264 +
                    columns.findIndex(
                      (col) => col.date.toDateString() === new Date().toDateString()
                    ) *
                      columnWidth +
                    columnWidth / 2,
                  backgroundColor: accentColorValue,
                }}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
