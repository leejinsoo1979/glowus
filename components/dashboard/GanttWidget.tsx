"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import { useAuthStore } from "@/stores/authStore"
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { motion } from "framer-motion"

interface GanttTask {
  id: string
  title: string
  startDate: Date
  endDate: Date
  progress: number
  assignee?: {
    id: string
    name: string
    avatar?: string
    type: 'human' | 'agent'
  }
  dependencies?: string[]
  projectId: string
  projectName: string
  status: string
  priority: string
}

interface ProjectTask {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  start_date?: string
  due_date?: string
  project_id: string
  depends_on?: string[]
  assignee_type?: 'human' | 'agent'
  assignee_user?: { id: string; name: string; avatar_url?: string }
  assignee_agent?: { id: string; name: string; avatar_url?: string }
}

interface Project {
  id: string
  name: string
}

type ViewMode = "day" | "week" | "month"

export function GanttWidget() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<GanttTask[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [startOffset, setStartOffset] = useState(0)
  const { accentColor } = useThemeStore()
  const { currentStartup } = useAuthStore()
  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch tasks from all projects
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // First, get all projects
      const projectsRes = await fetch('/api/projects')
      if (!projectsRes.ok) throw new Error('프로젝트를 불러올 수 없습니다')
      const projectsData = await projectsRes.json()
      const projects: Project[] = Array.isArray(projectsData) ? projectsData : []

      // Then fetch tasks for each project
      const allTasks: GanttTask[] = []

      for (const project of projects) {
        try {
          const tasksRes = await fetch(`/api/projects/${project.id}/tasks?limit=50`)
          if (!tasksRes.ok) continue

          const tasksData = await tasksRes.json()
          const projectTasks: ProjectTask[] = tasksData.data || []

          // Convert to GanttTask format
          for (const task of projectTasks) {
            // Skip tasks without dates
            if (!task.start_date && !task.due_date) continue

            const startDate = task.start_date
              ? new Date(task.start_date)
              : new Date()

            const endDate = task.due_date
              ? new Date(task.due_date)
              : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000) // Default 7 days

            // Calculate progress based on status
            let progress = 0
            switch (task.status) {
              case 'DONE': progress = 100; break
              case 'IN_PROGRESS': progress = 50; break
              case 'IN_REVIEW': progress = 75; break
              case 'TODO': progress = 0; break
              case 'BACKLOG': progress = 0; break
              default: progress = 0
            }

            const assignee = task.assignee_user
              ? {
                  id: task.assignee_user.id,
                  name: task.assignee_user.name,
                  avatar: task.assignee_user.avatar_url,
                  type: 'human' as const
                }
              : task.assignee_agent
                ? {
                    id: task.assignee_agent.id,
                    name: task.assignee_agent.name,
                    avatar: task.assignee_agent.avatar_url,
                    type: 'agent' as const
                  }
                : undefined

            allTasks.push({
              id: task.id,
              title: task.title,
              startDate,
              endDate,
              progress,
              assignee,
              dependencies: task.depends_on || [],
              projectId: project.id,
              projectName: project.name,
              status: task.status,
              priority: task.priority,
            })
          }
        } catch (e) {
          console.error(`Failed to fetch tasks for project ${project.id}:`, e)
        }
      }

      // Sort by start date
      allTasks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      setTasks(allTasks)

    } catch (err) {
      console.error('Gantt data fetch error:', err)
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [currentStartup?.id])

  useEffect(() => {
    if (mounted) {
      fetchTasks()
    }
  }, [mounted, fetchTasks])

  // Calculate date range
  const dateRange = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date()
      const minDate = new Date(today)
      minDate.setDate(minDate.getDate() - 7)
      const maxDate = new Date(today)
      maxDate.setDate(maxDate.getDate() + 30)
      return { minDate, maxDate }
    }

    const allDates = tasks.flatMap((t) => [t.startDate, t.endDate])
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())))

    minDate.setDate(minDate.getDate() - 3)
    maxDate.setDate(maxDate.getDate() + 7)

    return { minDate, maxDate }
  }, [tasks])

  // Generate columns based on view mode
  const columns = useMemo(() => {
    const cols: { date: Date; label: string; isWeekend: boolean; isToday: boolean }[] = []
    const { minDate } = dateRange
    const current = new Date(minDate)
    current.setDate(current.getDate() + startOffset)

    const daysToShow = viewMode === "day" ? 14 : viewMode === "week" ? 21 : 42
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(current)
      const isWeekend = date.getDay() === 0 || date.getDay() === 6
      const isToday = date.toDateString() === today.toDateString()

      cols.push({
        date,
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        isWeekend,
        isToday,
      })

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

    if (startCol === -1 && endCol === -1) {
      // Check if task spans across visible range
      const taskStart = task.startDate.getTime()
      const taskEnd = task.endDate.getTime()
      const visibleStart = columns[0]?.date.getTime() || 0
      const visibleEnd = columns[columns.length - 1]?.date.getTime() || 0

      if (taskStart < visibleStart && taskEnd > visibleEnd) {
        return { left: 0, width: columns.length, isPartialStart: true, isPartialEnd: true }
      }
      return null
    }

    const actualStart = Math.max(0, startCol === -1 ? 0 : startCol)
    const actualEnd = endCol === -1 ? columns.length - 1 : endCol

    return {
      left: actualStart,
      width: Math.max(1, actualEnd - actualStart + 1),
      isPartialStart: startCol < 0,
      isPartialEnd: endCol === -1 || endCol >= columns.length,
    }
  }

  // Group tasks by project
  const groupedTasks = useMemo(() => {
    const groups: Record<string, GanttTask[]> = {}
    tasks.forEach((task) => {
      const group = task.projectName || "기타"
      if (!groups[group]) groups[group] = []
      groups[group].push(task)
    })
    return groups
  }, [tasks])

  const columnWidth = viewMode === "day" ? 50 : viewMode === "week" ? 36 : 22
  const accentColorValue = mounted ? currentAccent.color : "#3b82f6"

  const getProgressColor = (progress: number, priority: string) => {
    if (progress === 100) return "#22c55e" // Green for completed
    if (priority === 'URGENT' || priority === 'HIGH') return "#ef4444" // Red for high priority
    if (progress >= 50) return accentColorValue
    if (progress > 0) return "#f59e0b" // Yellow for in progress
    return "#71717a" // Gray for not started
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT': return { color: '#ef4444', label: '긴급' }
      case 'HIGH': return { color: '#f97316', label: '높음' }
      case 'MEDIUM': return { color: '#eab308', label: '중간' }
      case 'LOW': return { color: '#22c55e', label: '낮음' }
      default: return null
    }
  }

  if (!mounted) return null

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5" style={{ color: accentColorValue }} />
          <span className="font-medium tracking-tight text-zinc-700 dark:text-white">프로젝트 타임라인</span>
          <span className="text-xs font-mono text-zinc-400 dark:text-white/40">
            {tasks.length} TASKS
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Navigation */}
          <button
            onClick={() => setStartOffset((s) => s - 7)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setStartOffset(0)}
            className="px-2 py-1 text-xs font-medium text-zinc-500 dark:text-white/60 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            오늘
          </button>
          <button
            onClick={() => setStartOffset((s) => s + 7)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* View Mode */}
          <div className="flex bg-zinc-100 dark:bg-white/5 rounded-lg p-0.5 ml-2">
            {(["day", "week", "month"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === mode
                    ? "bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
                }`}
              >
                {mode === "day" ? "일" : mode === "week" ? "주" : "월"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
            <span className="text-sm text-zinc-400">타임라인 로딩 중...</span>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
            <button
              onClick={fetchTasks}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-white underline"
            >
              다시 시도
            </button>
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <Calendar className="w-8 h-8 text-zinc-300 dark:text-white/20" />
            <span className="text-sm text-zinc-400 dark:text-white/40">예약된 태스크가 없습니다</span>
            <span className="text-xs text-zinc-300 dark:text-white/20">프로젝트에서 태스크를 생성해보세요</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50" ref={containerRef}>
          <div className="min-w-max">
            {/* Timeline Header */}
            <div className="flex border-b border-zinc-200 dark:border-white/10 sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900">
              {/* Task Info Column */}
              <div className="w-52 flex-shrink-0 px-3 py-2 border-r border-zinc-200 dark:border-white/10 sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-900">
                <span className="text-xs font-medium text-zinc-500 dark:text-white/50">태스크</span>
              </div>

              {/* Date Columns */}
              <div className="flex">
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className={`flex-shrink-0 px-0.5 py-2 text-center border-r border-zinc-100 dark:border-white/5 ${
                      col.isWeekend ? "bg-zinc-100/50 dark:bg-white/5" : ""
                    } ${col.isToday ? "bg-accent/10" : ""}`}
                    style={{ width: columnWidth }}
                  >
                    <span className={`text-[10px] ${col.isToday ? 'text-accent font-bold' : 'text-zinc-400 dark:text-white/40'}`}>
                      {col.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Task Rows */}
            {Object.entries(groupedTasks).map(([projectName, projectTasks]) => (
              <div key={projectName}>
                {/* Project Header */}
                <div className="flex bg-zinc-50 dark:bg-white/5">
                  <div className="w-52 flex-shrink-0 px-3 py-1.5 border-r border-zinc-200 dark:border-white/10 sticky left-0 z-10 bg-zinc-50 dark:bg-white/5">
                    <span className="text-[11px] font-semibold text-zinc-600 dark:text-white/70 truncate">
                      {projectName}
                    </span>
                  </div>
                  <div className="flex-1" />
                </div>

                {/* Tasks in Project */}
                {projectTasks.map((task) => {
                  const position = getTaskPosition(task)
                  const priorityBadge = getPriorityBadge(task.priority)

                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                    >
                      {/* Task Info */}
                      <div className="w-52 flex-shrink-0 px-3 py-2 border-r border-zinc-200 dark:border-white/10 sticky left-0 z-10 bg-white dark:bg-zinc-900/50">
                        <div className="flex items-center gap-2">
                          {task.assignee && (
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 ${
                                task.assignee.type === 'agent'
                                  ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                                  : ''
                              }`}
                              style={task.assignee.type === 'human' ? { backgroundColor: accentColorValue } : undefined}
                              title={task.assignee.name}
                            >
                              {task.assignee.avatar ? (
                                <img src={task.assignee.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                task.assignee.name.charAt(0).toUpperCase()
                              )}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-zinc-800 dark:text-white/90 truncate">
                              {task.title}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] text-zinc-400 dark:text-white/40">
                                {task.progress}%
                              </span>
                              {priorityBadge && (
                                <span
                                  className="text-[9px] px-1 py-0.5 rounded font-medium"
                                  style={{
                                    backgroundColor: `${priorityBadge.color}20`,
                                    color: priorityBadge.color
                                  }}
                                >
                                  {priorityBadge.label}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Gantt Bar Area */}
                      <div className="flex relative" style={{ minHeight: 44 }}>
                        {columns.map((col, i) => (
                          <div
                            key={i}
                            className={`flex-shrink-0 border-r border-zinc-100/50 dark:border-white/5 ${
                              col.isWeekend ? "bg-zinc-50/50 dark:bg-white/5" : ""
                            } ${col.isToday ? "bg-accent/5" : ""}`}
                            style={{ width: columnWidth }}
                          />
                        ))}

                        {/* Task Bar */}
                        {position && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 h-6 rounded cursor-pointer transition-all hover:opacity-80 group"
                            style={{
                              left: position.left * columnWidth + 2,
                              width: position.width * columnWidth - 4,
                              backgroundColor: `${getProgressColor(task.progress, task.priority)}25`,
                              borderLeft: `2px solid ${getProgressColor(task.progress, task.priority)}`,
                            }}
                          >
                            {/* Progress Fill */}
                            <div
                              className="absolute left-0 top-0 bottom-0 rounded-l"
                              style={{
                                width: `${task.progress}%`,
                                backgroundColor: `${getProgressColor(task.progress, task.priority)}40`,
                              }}
                            />
                            {/* Task Title */}
                            {position.width > 3 && (
                              <span className="relative z-10 px-1.5 text-[10px] font-medium text-zinc-700 dark:text-white/80 truncate leading-6 block">
                                {task.title}
                              </span>
                            )}

                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-zinc-800 dark:bg-zinc-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                              <p className="text-xs font-medium text-white">{task.title}</p>
                              <p className="text-[10px] text-zinc-300">
                                {task.startDate.toLocaleDateString("ko-KR")} - {task.endDate.toLocaleDateString("ko-KR")}
                              </p>
                              <p className="text-[10px] text-zinc-400">진행률: {task.progress}%</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
