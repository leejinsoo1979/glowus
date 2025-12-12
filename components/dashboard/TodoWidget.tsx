"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, Circle, Plus, Clock, AlertCircle } from "lucide-react"
import { useThemeStore } from "@/stores/themeStore"
import { cn } from "@/lib/utils"

interface Task {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  due_date?: string
  created_at: string
}

const priorityConfig = {
  URGENT: { color: "text-red-500", bg: "bg-red-500/10", label: "긴급" },
  HIGH: { color: "text-orange-500", bg: "bg-orange-500/10", label: "높음" },
  MEDIUM: { color: "text-yellow-500", bg: "bg-yellow-500/10", label: "중간" },
  LOW: { color: "text-zinc-400", bg: "bg-zinc-500/10", label: "낮음" },
}

const statusConfig = {
  TODO: { icon: Circle, color: "text-zinc-400" },
  IN_PROGRESS: { icon: Clock, color: "text-blue-500" },
  DONE: { icon: CheckCircle2, color: "text-green-500" },
  CANCELLED: { icon: AlertCircle, color: "text-zinc-400" },
}

export function TodoWidget() {
  const { accentColor } = useThemeStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('todo')

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tasks?limit=20')
      if (res.ok) {
        const data = await res.json()
        setTasks(data.data || [])
      }
    } catch (error) {
      console.error("Failed to fetch tasks:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE'

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === task.id ? { ...t, status: newStatus } : t
    ))

    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
    } catch (error) {
      // Revert on error
      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, status: task.status } : t
      ))
    }
  }

  const filteredTasks = tasks.filter(task => {
    if (filter === 'todo') return task.status !== 'DONE' && task.status !== 'CANCELLED'
    if (filter === 'done') return task.status === 'DONE'
    return true
  })

  const todoCount = tasks.filter(t => t.status === 'TODO' || t.status === 'IN_PROGRESS').length
  const doneCount = tasks.filter(t => t.status === 'DONE').length

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-accent" />
          <span className="font-semibold text-zinc-700 dark:text-zinc-100">할 일</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-zinc-500">{todoCount} 남음</span>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <span className="text-green-500">{doneCount} 완료</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-3 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
        {[
          { id: 'todo', label: '할 일' },
          { id: 'done', label: '완료' },
          { id: 'all', label: '전체' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as typeof filter)}
            className={cn(
              "flex-1 py-1 text-xs font-medium rounded-md transition-colors",
              filter === tab.id
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredTasks.length > 0 ? (
          filteredTasks.map(task => {
            const StatusIcon = statusConfig[task.status]?.icon || Circle
            const statusColor = statusConfig[task.status]?.color || "text-zinc-400"
            const priority = priorityConfig[task.priority] || priorityConfig.MEDIUM

            return (
              <div
                key={task.id}
                className={cn(
                  "flex items-start gap-2 p-2 rounded-lg transition-colors cursor-pointer",
                  "bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                  task.status === 'DONE' && "opacity-60"
                )}
                onClick={() => toggleTaskStatus(task)}
              >
                <StatusIcon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", statusColor)} />
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm text-zinc-800 dark:text-zinc-200 truncate",
                    task.status === 'DONE' && "line-through text-zinc-400"
                  )}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded", priority.bg, priority.color)}>
                      {priority.label}
                    </span>
                    {task.due_date && (
                      <span className="text-[10px] text-zinc-400">
                        {new Date(task.due_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400">
            <CheckCircle2 className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs">
              {filter === 'done' ? '완료된 할 일이 없습니다' : '할 일이 없습니다'}
            </p>
          </div>
        )}
      </div>

      {/* Add Task Button */}
      <button className="mt-3 flex items-center justify-center gap-1 w-full py-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-accent hover:border-accent transition-colors">
        <Plus className="w-4 h-4" />
        <span className="text-xs">새 할 일 추가</span>
      </button>
    </div>
  )
}
