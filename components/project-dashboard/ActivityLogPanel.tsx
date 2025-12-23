"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Terminal,
  Minus,
  X,
  Maximize2,
  ChevronDown,
} from "lucide-react"

interface LogEntry {
  id: string
  timestamp: string
  message: string
  type: "info" | "success" | "warning" | "error" | "ai"
}

interface ActivityLogPanelProps {
  projectId: string
}

export function ActivityLogPanel({ projectId }: ActivityLogPanelProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isMinimized, setIsMinimized] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const logContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchActivityLogs()
  }, [projectId])

  const fetchActivityLogs = async () => {
    try {
      // Fetch tasks and documents to generate activity logs
      const [tasksRes, docsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/tasks`),
        fetch(`/api/projects/${projectId}/documents`),
      ])

      const activityLogs: LogEntry[] = []

      // Add system start log
      activityLogs.push({
        id: "system-start",
        timestamp: new Date().toLocaleTimeString("ko-KR", { hour12: false }),
        message: "대시보드 연결됨",
        type: "info",
      })

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        const tasks = tasksData.tasks || []

        // Add recent task activities
        tasks.slice(0, 5).forEach((task: any, idx: number) => {
          activityLogs.push({
            id: `task-${task.id || idx}`,
            timestamp: task.updated_at
              ? new Date(task.updated_at).toLocaleTimeString("ko-KR", { hour12: false })
              : new Date().toLocaleTimeString("ko-KR", { hour12: false }),
            message: `태스크: ${task.title}`,
            type: task.status === "DONE" ? "success" : task.assignee_type === "agent" ? "ai" : "info",
          })
        })
      }

      if (docsRes.ok) {
        const docsData = await docsRes.json()
        const docs = docsData.documents || []

        // Add recent document activities
        docs.slice(0, 3).forEach((doc: any, idx: number) => {
          activityLogs.push({
            id: `doc-${doc.id || idx}`,
            timestamp: doc.updated_at
              ? new Date(doc.updated_at).toLocaleTimeString("ko-KR", { hour12: false })
              : new Date().toLocaleTimeString("ko-KR", { hour12: false }),
            message: `문서: ${doc.title}`,
            type: "info",
          })
        })
      }

      // If no activities, show placeholder
      if (activityLogs.length === 1) {
        activityLogs.push({
          id: "no-activity",
          timestamp: new Date().toLocaleTimeString("ko-KR", { hour12: false }),
          message: "아직 활동 기록이 없습니다",
          type: "info",
        })
      }

      setLogs(activityLogs)
    } catch (error) {
      console.error("Activity fetch error:", error)
      setLogs([{
        id: "error",
        timestamp: new Date().toLocaleTimeString("ko-KR", { hour12: false }),
        message: "활동 로그 로드 실패",
        type: "warning",
      }])
    }
  }

  useEffect(() => {
    // Auto-scroll to bottom
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return "text-emerald-400"
      case "warning":
        return "text-amber-400"
      case "error":
        return "text-red-400"
      case "ai":
        return "text-purple-400"
      default:
        return "text-zinc-400"
    }
  }

  const getLogPrefix = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return "[OK]"
      case "warning":
        return "[WARN]"
      case "error":
        return "[ERR]"
      case "ai":
        return "[AI]"
      default:
        return "[LOG]"
    }
  }

  if (isMinimized) {
    return (
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-4 left-4 z-50"
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-white">Log</span>
          <span className="px-1.5 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded">
            {logs.length}
          </span>
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 ${
        isExpanded ? "fixed inset-4 z-50" : ""
      }`}
    >
      {/* Window Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-white">Log</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded hover:bg-zinc-800 transition-colors"
          >
            <Minus className="w-3 h-3 text-zinc-500" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-zinc-800 transition-colors"
          >
            <Maximize2 className="w-3 h-3 text-zinc-500" />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded hover:bg-zinc-800 transition-colors"
          >
            <X className="w-3 h-3 text-zinc-500" />
          </button>
        </div>
      </div>

      {/* Log Content */}
      <div
        ref={logContainerRef}
        className={`overflow-y-auto font-mono text-xs ${isExpanded ? "h-[calc(100%-40px)]" : "h-48"}`}
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.9) 100%)",
        }}
      >
        <div className="p-3 space-y-1">
          <AnimatePresence initial={false}>
            {logs.map((log, idx) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2 hover:bg-zinc-800/30 px-2 py-0.5 rounded"
              >
                <span className="text-zinc-600 flex-shrink-0">[{log.timestamp}]</span>
                <span className={`flex-shrink-0 ${getLogColor(log.type)}`}>
                  {getLogPrefix(log.type)}
                </span>
                <span className="text-zinc-300">{log.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Blinking Cursor */}
          <div className="flex items-center gap-2 px-2 py-0.5">
            <span className="text-zinc-600">[{new Date().toLocaleTimeString("ko-KR", { hour12: false })}]</span>
            <span className="text-emerald-400 animate-pulse">▌</span>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none flex items-end justify-center pb-1">
        <ChevronDown className="w-4 h-4 text-zinc-600 animate-bounce" />
      </div>
    </motion.div>
  )
}
