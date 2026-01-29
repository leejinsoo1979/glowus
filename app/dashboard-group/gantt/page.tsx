'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useTheme } from "next-themes"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import { useAuthStore } from "@/stores/authStore"
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Loader2,
  AlertCircle,
  Filter,
  Download,
  Maximize2,
  RefreshCw,
  Users,
  Bot,
  FolderOpen,
  X,
  Clock,
  Flag,
  User,
  CheckCircle2,
  Circle,
  ArrowRight,
  ExternalLink,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface GanttTask {
  id: string
  title: string
  description?: string
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
type FilterType = "all" | "human" | "agent" | "unassigned"

export default function GanttPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<GanttTask[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [startOffset, setStartOffset] = useState(0)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<FilterType>("all")
  const [showFilters, setShowFilters] = useState(false)
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null)

  const { resolvedTheme } = useTheme()
  const { accentColor } = useThemeStore()
  const { currentStartup } = useAuthStore()
  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]
  const containerRef = useRef<HTMLDivElement>(null)

  const isDark = mounted ? resolvedTheme === 'dark' : true
  const accentColorValue = mounted ? currentAccent.color : "#3b82f6"

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch tasks using batch API (single request instead of N+1)
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Use batch API endpoint - single request for all projects and tasks
      const res = await fetch('/api/gantt/tasks?limit=200')
      if (!res.ok) throw new Error('데이터를 불러올 수 없습니다')

      const data = await res.json()
      const fetchedProjects: Project[] = data.projects || []
      const rawTasks: ProjectTask[] = data.data || []

      setProjects(fetchedProjects)

      // Convert to GanttTask format
      const allTasks: GanttTask[] = rawTasks.map(task => {
        const startDate = task.start_date
          ? new Date(task.start_date)
          : new Date()

        const endDate = task.due_date
          ? new Date(task.due_date)
          : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000)

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

        return {
          id: task.id,
          title: task.title,
          description: task.description,
          startDate,
          endDate,
          progress,
          assignee,
          dependencies: task.depends_on || [],
          projectId: task.project_id,
          projectName: (task as any).project_name || '알 수 없음',
          status: task.status,
          priority: task.priority,
        } as GanttTask
      })

      allTasks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      setTasks(allTasks)

    } catch (err) {
      console.error('Gantt data fetch error:', err)
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mounted) {
      fetchTasks()
    }
  }, [mounted, fetchTasks])

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = tasks

    if (selectedProject) {
      result = result.filter(t => t.projectId === selectedProject)
    }

    if (filterType !== "all") {
      result = result.filter(t => {
        if (filterType === "human") return t.assignee?.type === "human"
        if (filterType === "agent") return t.assignee?.type === "agent"
        if (filterType === "unassigned") return !t.assignee
        return true
      })
    }

    return result
  }, [tasks, selectedProject, filterType])

  // Calculate date range
  const dateRange = useMemo(() => {
    if (filteredTasks.length === 0) {
      const today = new Date()
      const minDate = new Date(today)
      minDate.setDate(minDate.getDate() - 7)
      const maxDate = new Date(today)
      maxDate.setDate(maxDate.getDate() + 60)
      return { minDate, maxDate }
    }

    const allDates = filteredTasks.flatMap((t) => [t.startDate, t.endDate])
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())))

    minDate.setDate(minDate.getDate() - 3)
    maxDate.setDate(maxDate.getDate() + 14)

    return { minDate, maxDate }
  }, [filteredTasks])

  // Generate columns based on view mode
  const columns = useMemo(() => {
    const cols: { date: Date; label: string; isWeekend: boolean; isToday: boolean }[] = []
    const { minDate } = dateRange
    const current = new Date(minDate)
    current.setDate(current.getDate() + startOffset)

    const daysToShow = viewMode === "day" ? 21 : viewMode === "week" ? 42 : 90
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
    filteredTasks.forEach((task) => {
      const group = task.projectName || "기타"
      if (!groups[group]) groups[group] = []
      groups[group].push(task)
    })
    return groups
  }, [filteredTasks])

  const columnWidth = viewMode === "day" ? 50 : viewMode === "week" ? 36 : 18

  // Pre-calculate today column index (avoid repeated findIndex calls)
  const todayColumnIndex = useMemo(() => {
    return columns.findIndex(c => c.isToday)
  }, [columns])

  const getProgressColor = (progress: number, priority: string) => {
    if (progress === 100) return "#22c55e"
    if (priority === 'URGENT' || priority === 'HIGH') return "#ef4444"
    if (progress >= 50) return accentColorValue
    if (progress > 0) return "#f59e0b"
    return "#71717a"
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DONE': return { color: '#22c55e', label: '완료', icon: CheckCircle2 }
      case 'IN_PROGRESS': return { color: accentColorValue, label: '진행 중', icon: Circle }
      case 'IN_REVIEW': return { color: '#8b5cf6', label: '검토 중', icon: Circle }
      case 'TODO': return { color: '#71717a', label: '예정', icon: Circle }
      case 'BACKLOG': return { color: '#71717a', label: '백로그', icon: Circle }
      default: return { color: '#71717a', label: status, icon: Circle }
    }
  }

  const getDaysRemaining = (endDate: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(0, 0, 0, 0)
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return { text: `${Math.abs(diff)}일 지연`, color: '#ef4444' }
    if (diff === 0) return { text: '오늘 마감', color: '#f97316' }
    if (diff <= 3) return { text: `${diff}일 남음`, color: '#eab308' }
    return { text: `${diff}일 남음`, color: '#22c55e' }
  }

  const getDuration = (start: Date, end: Date) => {
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return diff + 1
  }

  const stats = useMemo(() => {
    const total = filteredTasks.length
    const completed = filteredTasks.filter(t => t.progress === 100).length
    const inProgress = filteredTasks.filter(t => t.progress > 0 && t.progress < 100).length
    const overdue = filteredTasks.filter(t => {
      const today = new Date()
      return t.endDate < today && t.progress < 100
    }).length
    return { total, completed, inProgress, overdue }
  }, [filteredTasks])

  if (!mounted) return null

  return (
    <div className={`h-[calc(100vh-64px)] flex flex-col ${isDark ? 'bg-zinc-900' : 'bg-white'}`}>
      {/* Toolbar - h-16 (64px) */}
      <div className={`flex-shrink-0 h-16 px-6 border-b flex items-center justify-between ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <button onClick={() => setStartOffset((s) => s - 14)} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-500'}`}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={() => setStartOffset(0)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-zinc-200 text-zinc-600'}`}>오늘</button>
            <button onClick={() => setStartOffset((s) => s + 14)} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-500'}`}>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}><strong className={isDark ? 'text-white' : 'text-zinc-900'}>{stats.total}</strong> 전체</span>
            <span className="text-green-500"><strong>{stats.completed}</strong> 완료</span>
            <span style={{ color: accentColorValue }}><strong>{stats.inProgress}</strong> 진행</span>
            {stats.overdue > 0 && <span className="text-red-500"><strong>{stats.overdue}</strong> 지연</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex rounded-lg p-1 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
            {(["day", "week", "month"] as ViewMode[]).map((mode) => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === mode ? (isDark ? 'bg-zinc-700 text-white' : 'bg-white text-zinc-900') : (isDark ? 'text-zinc-400' : 'text-zinc-500')}`}>
                {mode === "day" ? "일간" : mode === "week" ? "주간" : "월간"}
              </button>
            ))}
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-lg transition-colors ${showFilters ? 'bg-accent/20 text-accent' : isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-500 hover:bg-zinc-100'}`}>
            <Filter className="h-5 w-5" />
          </button>
          <button onClick={fetchTasks} disabled={loading} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-500 hover:bg-zinc-100'}`}>
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`flex-shrink-0 overflow-hidden border-b ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'}`}
          >
            <div className="px-6 py-3 flex items-center gap-4">
              <select
                value={selectedProject || ''}
                onChange={(e) => setSelectedProject(e.target.value || null)}
                className={`px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-zinc-900'} border`}
              >
                <option value="">전체 프로젝트</option>
                {projects.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
              <div className="flex gap-1">
                {(['all', 'human', 'agent', 'unassigned'] as FilterType[]).map((type) => (
                  <button key={type} onClick={() => setFilterType(type)} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${filterType === type ? 'bg-accent text-white' : isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                    {type === 'all' ? '전체' : type === 'human' ? '사람' : type === 'agent' ? 'AI' : '미배정'}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColorValue }} />
              <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>타임라인 로딩 중...</span>
            </div>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <span className="text-red-400">{error}</span>
              <button
                onClick={fetchTasks}
                className={`text-sm underline ${isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
              >
                다시 시도
              </button>
            </div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <Calendar className="w-12 h-12" style={{ color: `${accentColorValue}40` }} />
              <span className={`text-lg font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                예약된 태스크가 없습니다
              </span>
              <span className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                프로젝트에서 시작일/마감일이 있는 태스크를 생성해보세요
              </span>
            </div>
          </div>
        ) : (
          <div className={`h-full overflow-auto ${isDark ? 'bg-zinc-900' : 'bg-white'}`} ref={containerRef}>
            <div className="min-w-max min-h-full">
              {/* Timeline Header */}
              <div className={`flex border-b sticky top-0 z-10 ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'}`}>
                {/* Task Info Column */}
                <div className={`w-52 flex-shrink-0 px-3 py-1 border-r sticky left-0 z-20 ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'}`}>
                  <span className={`text-[10px] font-semibold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>태스크</span>
                </div>

                {/* Date Columns */}
                <div className="flex">
                  {columns.map((col, i) => (
                    <div
                      key={i}
                      className={`flex-shrink-0 py-1 text-center border-r ${isDark ? 'border-zinc-800/50' : 'border-zinc-200/50'} ${col.isWeekend ? (isDark ? 'bg-zinc-800/30' : 'bg-zinc-100/50') : ''} ${col.isToday ? 'bg-accent/20' : ''}`}
                      style={{ width: columnWidth }}
                    >
                      <span className={`text-[10px] font-bold ${col.isToday ? 'text-accent' : isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{col.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Task Rows */}
              {Object.entries(groupedTasks).map(([projectName, projectTasks]) => (
                <div key={projectName}>
                  {/* Project Header */}
                  <div className={`flex ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-100'}`}>
                    <div className={`w-52 flex-shrink-0 px-3 py-0.5 border-r sticky left-0 z-10 ${isDark ? 'border-zinc-800 bg-zinc-800/50' : 'border-zinc-200 bg-zinc-100'}`}>
                      <span className={`text-[10px] font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{projectName}</span>
                    </div>
                    <div className="flex-1" />
                  </div>

                  {/* Tasks in Project */}
                  {projectTasks.map((task) => {
                    const position = getTaskPosition(task)
                    const priorityBadge = getPriorityBadge(task.priority)

                    return (
                      <div
                        key={task.id}
                        className={`flex border-b ${isDark ? 'border-zinc-800/30 hover:bg-zinc-800/20' : 'border-zinc-100 hover:bg-zinc-50'} transition-colors`}
                      >
                        {/* Task Info */}
                        <div className={`w-52 flex-shrink-0 px-3 py-2 border-r sticky left-0 z-10 ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
                          <div className="flex items-center gap-2">
                            {task.assignee && (
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${task.assignee.type === 'agent' ? 'bg-gradient-to-br from-violet-500 to-purple-600' : ''}`}
                                style={task.assignee.type === 'human' ? { backgroundColor: accentColorValue } : undefined}
                                title={task.assignee.name}
                              >
                                {task.assignee.avatar ? (<img src={task.assignee.avatar} alt="" className="w-full h-full rounded-full object-cover" />) : task.assignee.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-medium truncate ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>{task.title}</p>
                            </div>
                            {priorityBadge && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${priorityBadge.color}20`, color: priorityBadge.color }}>{priorityBadge.label}</span>
                            )}
                          </div>
                        </div>

                        {/* Gantt Bar Area */}
                        <div className="flex relative" style={{ minHeight: 40 }}>
                          {columns.map((col, i) => (
                            <div
                              key={i}
                              className={`flex-shrink-0 border-r ${
                                isDark ? 'border-zinc-800/30' : 'border-zinc-100/50'
                              } ${col.isWeekend ? (isDark ? 'bg-zinc-800/20' : 'bg-zinc-50/50') : ''} ${
                                col.isToday ? 'bg-accent/15' : ''
                              }`}
                              style={{ width: columnWidth }}
                            />
                          ))}

                          {/* Today Line */}
                          {todayColumnIndex >= 0 && (
                            <div
                              className="absolute top-0 bottom-0 w-[2px] bg-accent z-10"
                              style={{ left: todayColumnIndex * columnWidth + columnWidth / 2 }}
                            />
                          )}

                          {/* Task Bar */}
                          {position && (
                            <div
                              className="absolute top-1/2 -translate-y-1/2 h-6 rounded cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg group"
                              onClick={() => setSelectedTask(task)}
                              style={{
                                left: position.left * columnWidth + 1,
                                width: position.width * columnWidth - 2,
                                backgroundColor: `${getProgressColor(task.progress, task.priority)}30`,
                                borderLeft: `3px solid ${getProgressColor(task.progress, task.priority)}`,
                              }}
                            >
                              {/* Progress Fill */}
                              <div className="absolute left-0 top-0 bottom-0 rounded-l" style={{ width: `${task.progress}%`, backgroundColor: `${getProgressColor(task.progress, task.priority)}50` }} />
                              {/* Task Title */}
                              {position.width > 4 && (
                                <span className={`relative z-10 px-1.5 text-[10px] font-medium truncate leading-6 block ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>{task.title}</span>
                              )}

                              {/* Tooltip */}
                              <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30 ${isDark ? 'bg-zinc-800' : 'bg-white border border-zinc-200'}`}>
                                <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>{task.title}</p>
                                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                  {task.startDate.toLocaleDateString("ko-KR")} - {task.endDate.toLocaleDateString("ko-KR")}
                                </p>
                                <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>진행률: {task.progress}%</p>
                                <p className="text-xs text-accent mt-1">클릭하여 상세보기</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Task Detail Panel */}
      <AnimatePresence>
        {selectedTask && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setSelectedTask(null)}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={`fixed right-0 top-0 bottom-0 w-[480px] z-50 shadow-2xl ${isDark ? 'bg-zinc-900' : 'bg-white'}`}
            >
              {/* Header */}
              <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getProgressColor(selectedTask.progress, selectedTask.priority) }}
                  />
                  <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>태스크 상세</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.open(`/dashboard-group/project/${selectedTask.projectId}`, '_blank')}
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'}`}
                    title="프로젝트에서 보기"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSelectedTask(null)}
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'}`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto" style={{ height: 'calc(100% - 73px)' }}>
                {/* Title */}
                <h1 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  {selectedTask.title}
                </h1>

                {/* Project */}
                <div className={`flex items-center gap-2 mb-6 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  <FolderOpen className="w-4 h-4" />
                  <span className="text-sm">{selectedTask.projectName}</span>
                </div>

                {/* Status & Priority */}
                <div className="flex items-center gap-3 mb-6">
                  {(() => {
                    const status = getStatusBadge(selectedTask.status)
                    const StatusIcon = status.icon
                    return (
                      <div
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
                        style={{ backgroundColor: `${status.color}20`, color: status.color }}
                      >
                        <StatusIcon className="w-4 h-4" />
                        {status.label}
                      </div>
                    )
                  })()}
                  {getPriorityBadge(selectedTask.priority) && (
                    <div
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
                      style={{
                        backgroundColor: `${getPriorityBadge(selectedTask.priority)!.color}20`,
                        color: getPriorityBadge(selectedTask.priority)!.color
                      }}
                    >
                      <Flag className="w-4 h-4" />
                      {getPriorityBadge(selectedTask.priority)!.label}
                    </div>
                  )}
                </div>

                {/* Description */}
                {selectedTask.description && (
                  <div className="mb-6">
                    <h3 className={`text-sm font-semibold mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>설명</h3>
                    <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {selectedTask.description}
                    </p>
                  </div>
                )}

                {/* Progress */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>진행률</h3>
                    <span className="text-sm font-bold" style={{ color: getProgressColor(selectedTask.progress, selectedTask.priority) }}>
                      {selectedTask.progress}%
                    </span>
                  </div>
                  <div className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${selectedTask.progress}%`,
                        backgroundColor: getProgressColor(selectedTask.progress, selectedTask.priority)
                      }}
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <Clock className="w-5 h-5 text-accent" />
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>일정</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className={`text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>시작일</p>
                      <p className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                        {selectedTask.startDate.toLocaleDateString("ko-KR", { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>마감일</p>
                      <p className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                        {selectedTask.endDate.toLocaleDateString("ko-KR", { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: isDark ? 'rgba(63,63,70,0.5)' : 'rgba(228,228,231,1)' }}>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" style={{ color: getDaysRemaining(selectedTask.endDate).color }} />
                      <span className="text-sm font-medium" style={{ color: getDaysRemaining(selectedTask.endDate).color }}>
                        {getDaysRemaining(selectedTask.endDate).text}
                      </span>
                    </div>
                    <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      총 {getDuration(selectedTask.startDate, selectedTask.endDate)}일
                    </span>
                  </div>
                </div>

                {/* Assignee */}
                <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <User className="w-5 h-5 text-accent" />
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>담당자</h3>
                  </div>
                  {selectedTask.assignee ? (
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${selectedTask.assignee.type === 'agent' ? 'bg-gradient-to-br from-violet-500 to-purple-600' : ''}`}
                        style={selectedTask.assignee.type === 'human' ? { backgroundColor: accentColorValue } : undefined}
                      >
                        {selectedTask.assignee.avatar ? (
                          <img src={selectedTask.assignee.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          selectedTask.assignee.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className={`font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                          {selectedTask.assignee.name}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          {selectedTask.assignee.type === 'agent' ? 'AI 에이전트' : '팀 멤버'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>담당자 미배정</p>
                  )}
                </div>

                {/* Dependencies */}
                {selectedTask.dependencies && selectedTask.dependencies.length > 0 && (
                  <div className={`p-4 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <ArrowRight className="w-5 h-5 text-accent" />
                      <h3 className={`text-sm font-semibold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>의존성</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedTask.dependencies.map((depId) => {
                        const depTask = filteredTasks.find(t => t.id === depId)
                        return (
                          <span
                            key={depId}
                            className={`px-3 py-1 text-xs rounded-full ${isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-700'}`}
                          >
                            {depTask?.title || depId}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
