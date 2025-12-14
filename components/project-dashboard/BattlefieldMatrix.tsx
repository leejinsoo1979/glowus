"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MoreHorizontal,
  Bot,
  Link2,
  FileText,
  Sparkles,
  ExternalLink,
  Play,
  CheckCircle2,
} from "lucide-react"

interface Task {
  id: string
  title: string
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE"
  assignee_type?: "human" | "agent"
  assignee?: {
    id: string
    name: string
    avatar_url?: string
    role?: string
  }
  agent?: {
    id: string
    name: string
    avatar_url?: string
  }
  is_ai_generated?: boolean
  evidence_link?: string
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
}

interface TeamMember {
  id: string
  name: string
  avatar_url?: string
  role: string
}

interface BattlefieldMatrixProps {
  projectId: string
}

const statusColumns = [
  { id: "DONE", label: "Done", color: "#10b981" },
  { id: "TODO", label: "To Do", color: "#6b7280" },
  { id: "IN_PROGRESS", label: "Doing", color: "#f59e0b" },
  { id: "REVIEW", label: "Review", color: "#8b5cf6" },
]

export function BattlefieldMatrix({ projectId }: BattlefieldMatrixProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [projectId])

  const fetchData = async () => {
    try {
      // Fetch tasks
      const tasksRes = await fetch(`/api/projects/${projectId}/tasks`)
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        setTasks(tasksData.tasks || [])
      }

      // Sample team members - integrate with actual API
      setMembers([
        { id: "1", name: "디자이너", avatar_url: "", role: "이지은" },
        { id: "2", name: "개발자", avatar_url: "", role: "박준우" },
        { id: "3", name: "PM", avatar_url: "", role: "최현우" },
      ])
    } catch (error) {
      console.error("Data fetch error:", error)
    } finally {
      setLoading(false)
    }
  }

  const getTasksForMemberAndStatus = (memberId: string, status: string) => {
    return tasks.filter(
      (task) =>
        task.status === status &&
        (task.assignee?.id === memberId || (!task.assignee && memberId === "unassigned"))
    )
  }

  const getAITasks = (status: string) => {
    return tasks.filter((task) => task.assignee_type === "agent" && task.status === status)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-2xl">⚔️</span>
          데일리 배틀필드
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-zinc-800/50 text-xs text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            실시간 동기화
          </div>
        </div>
      </div>

      {/* Matrix Container */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />

        {/* Table */}
        <div className="relative overflow-x-auto">
          <table className="w-full">
            {/* Header Row */}
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="w-40 p-4 text-left text-sm font-medium text-zinc-500 bg-zinc-900/80 sticky left-0 z-10">
                  팀원
                </th>
                {statusColumns.map((col) => (
                  <th key={col.id} className="p-4 text-center min-w-[200px]">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm font-medium text-zinc-400">{col.label}</span>
                      <MoreHorizontal className="w-4 h-4 text-zinc-600" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Team Member Rows */}
              {members.map((member, idx) => (
                <motion.tr
                  key={member.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/20"
                >
                  {/* Member Cell */}
                  <td className="p-4 bg-zinc-900/80 sticky left-0 z-10">
                    <div className="flex items-center gap-3">
                      <img
                        src={member.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`}
                        alt={member.name}
                        className="w-10 h-10 rounded-full ring-2 ring-zinc-700"
                      />
                      <div>
                        <p className="font-medium text-white">{member.name}</p>
                        <p className="text-xs text-zinc-500">({member.role})</p>
                      </div>
                    </div>
                  </td>

                  {/* Status Cells */}
                  {statusColumns.map((col) => {
                    const memberTasks = getTasksForMemberAndStatus(member.id, col.id)

                    return (
                      <td key={col.id} className="p-3 align-top">
                        <div className="space-y-2 min-h-[80px]">
                          {memberTasks.map((task) => (
                            <TaskCard key={task.id} task={task} statusColor={col.color} />
                          ))}
                        </div>
                      </td>
                    )
                  })}
                </motion.tr>
              ))}

              {/* AI Agent Row */}
              <motion.tr
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: members.length * 0.1 }}
                className="bg-gradient-to-r from-purple-500/5 to-blue-500/5"
              >
                <td className="p-4 bg-gradient-to-r from-purple-900/20 to-blue-900/20 sticky left-0 z-10">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-white" />
                      </motion.div>
                    </div>
                    <div>
                      <p className="font-medium text-white">AI 에이전트</p>
                      <p className="text-xs text-purple-400">자동 작업</p>
                    </div>
                  </div>
                </td>

                {statusColumns.map((col) => {
                  const aiTasks = getAITasks(col.id)

                  return (
                    <td key={col.id} className="p-3 align-top">
                      <div className="space-y-2 min-h-[80px]">
                        {aiTasks.map((task) => (
                          <TaskCard key={task.id} task={task} statusColor={col.color} isAI />
                        ))}
                      </div>
                    </td>
                  )
                })}
              </motion.tr>
            </tbody>
          </table>
        </div>

        {/* Connection Lines (SVG Overlay) - Visual Effect */}
        <svg className="absolute inset-0 pointer-events-none opacity-30">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
              <stop offset="50%" stopColor="#8b5cf6" stopOpacity="1" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </motion.div>
  )
}

// Task Card Component
function TaskCard({ task, statusColor, isAI }: { task: Task; statusColor: string; isAI?: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className={`relative group p-3 rounded-xl cursor-pointer transition-all ${
        isAI
          ? "bg-gradient-to-br from-purple-500/20 to-blue-500/10 border border-purple-500/30"
          : "bg-zinc-800/80 border border-zinc-700/50 hover:border-zinc-600"
      }`}
      style={{
        boxShadow: isAI ? "0 0 20px rgba(139, 92, 246, 0.2)" : undefined,
      }}
    >
      {/* Priority Indicator */}
      {task.priority === "HIGH" || task.priority === "URGENT" ? (
        <div
          className="absolute top-0 left-3 w-4 h-1 rounded-b"
          style={{ backgroundColor: task.priority === "URGENT" ? "#ef4444" : "#f59e0b" }}
        />
      ) : null}

      {/* Status Dot */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: statusColor }}
          />
          <span className="text-sm font-medium text-white line-clamp-2">{task.title}</span>
        </div>
      </div>

      {/* Evidence Link */}
      {task.evidence_link && (
        <div className="flex items-center gap-1 text-xs text-zinc-400 mt-2">
          <Link2 className="w-3 h-3" />
          <span className="truncate">증거 커밋 완료 (Figma 링크)</span>
        </div>
      )}

      {/* AI Badge */}
      {isAI && (
        <div className="flex items-center gap-1 mt-2 px-2 py-1 rounded-full bg-purple-500/20 w-fit">
          <Sparkles className="w-3 h-3 text-purple-400" />
          <span className="text-xs text-purple-300">AI 자동 생성</span>
        </div>
      )}

      {/* Hover Actions */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-1 rounded bg-zinc-700/50 hover:bg-zinc-600">
          <ExternalLink className="w-3 h-3 text-zinc-400" />
        </button>
      </div>

      {/* Glow effect on hover */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          boxShadow: `0 0 30px ${statusColor}20`,
        }}
      />
    </motion.div>
  )
}
