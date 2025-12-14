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
    // Sample logs - replace with actual API/WebSocket
    const sampleLogs: LogEntry[] = [
      { id: "1", timestamp: "17:25:33", message: "시스템 시작", type: "info" },
      { id: "2", timestamp: "17:25:33", message: "디자이너 디자인", type: "success" },
      { id: "3", timestamp: "17:25:38", message: "개발자 구현", type: "success" },
      { id: "4", timestamp: "17:25:33", message: "배너 배너 디자인", type: "ai" },
      { id: "5", timestamp: "17:25:33", message: "로그인 구현", type: "success" },
      { id: "6", timestamp: "17:25:33", message: "기획서 v1.2", type: "info" },
      { id: "7", timestamp: "17:25:33", message: "개발자 구현", type: "success" },
      { id: "8", timestamp: "17:25:33", message: "배너 퍼블리싱", type: "ai" },
    ]
    setLogs(sampleLogs)

    // Simulate real-time logs
    const interval = setInterval(() => {
      const newLog: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString("ko-KR", { hour12: false }),
        message: getRandomLogMessage(),
        type: getRandomLogType(),
      }
      setLogs((prev) => [...prev.slice(-50), newLog])
    }, 5000)

    return () => clearInterval(interval)
  }, [projectId])

  useEffect(() => {
    // Auto-scroll to bottom
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

  const getRandomLogMessage = () => {
    const messages = [
      "태스크 상태 업데이트",
      "AI 에이전트 활동 감지",
      "새 커밋 연결됨",
      "문서 자동 생성 완료",
      "팀원 활동 기록",
    ]
    return messages[Math.floor(Math.random() * messages.length)]
  }

  const getRandomLogType = (): LogEntry["type"] => {
    const types: LogEntry["type"][] = ["info", "success", "warning", "ai"]
    return types[Math.floor(Math.random() * types.length)]
  }

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
