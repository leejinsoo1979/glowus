"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  MoreHorizontal,
  Bot,
  Link2,
  ExternalLink,
  Users,
  Plus,
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
  { id: "DONE", label: "Done", color: "#22c55e" },
  { id: "TODO", label: "To Do", color: "#71717a" },
  { id: "IN_PROGRESS", label: "In Progress", color: "#f59e0b" },
  { id: "REVIEW", label: "Review", color: "#a855f7" },
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
      const [tasksRes, projectRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/tasks`),
        fetch(`/api/projects/${projectId}`),
      ])

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        setTasks(tasksData.tasks || [])
      }

      if (projectRes.ok) {
        const projectData = await projectRes.json()
        const projectMembers = projectData.project_members || projectData.members || []

        const realMembers: TeamMember[] = projectMembers.map((pm: any) => ({
          id: pm.user_id || pm.user?.id || pm.id,
          name: pm.user?.name || pm.name || "Unknown",
          avatar_url: pm.user?.avatar_url || pm.avatar_url || "",
          role: pm.role === "lead" ? "리드" : pm.user?.job_title || pm.role || "멤버",
        }))

        setMembers(realMembers)
      }
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">팀 태스크 보드</h2>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          실시간
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {/* Header */}
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="w-48 min-w-[180px] p-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50/50 dark:bg-zinc-900/80">
                  멤버
                </th>
                {statusColumns.map((col) => (
                  <th key={col.id} className="w-44 min-w-[160px] p-3 text-left bg-zinc-50/50 dark:bg-transparent">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: col.color }}
                      />
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{col.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
              {/* Empty State */}
              {members.length === 0 && !loading && (
                <tr>
                  <td colSpan={statusColumns.length + 1} className="p-8 text-center">
                    <div className="flex flex-col items-center gap-2 text-zinc-500">
                      <Users className="w-8 h-8 opacity-40" />
                      <p className="text-sm">팀원을 추가해주세요</p>
                    </div>
                  </td>
                </tr>
              )}

              {/* Member Rows */}
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="p-3 bg-zinc-50/30 dark:bg-zinc-900/50 border-r border-zinc-100 dark:border-zinc-800/50">
                    <div className="flex items-center gap-3">
                      <img
                        src={member.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${member.name}&backgroundColor=3f3f46`}
                        alt={member.name}
                        className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 shadow-sm"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200 truncate">{member.name}</p>
                        <p className="text-xs text-zinc-500 truncate">{member.role}</p>
                      </div>
                    </div>
                  </td>
                  {statusColumns.map((col) => {
                    const memberTasks = getTasksForMemberAndStatus(member.id, col.id)
                    return (
                      <td key={col.id} className="p-2 align-top border-r border-zinc-100 dark:border-zinc-800/30 last:border-0">
                        <div className="space-y-1.5 min-h-[60px]">
                          {memberTasks.map((task) => (
                            <TaskCard key={task.id} task={task} statusColor={col.color} />
                          ))}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* AI Agent Row */}
              <tr className="bg-zinc-50/50 dark:bg-zinc-800/20">
                <td className="p-3 bg-zinc-50/80 dark:bg-zinc-800/30 border-r border-zinc-100 dark:border-zinc-800/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-600/20 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200">AI 에이전트</p>
                      <p className="text-xs text-violet-600 dark:text-violet-400">자동화</p>
                    </div>
                  </div>
                </td>
                {statusColumns.map((col) => {
                  const aiTasks = getAITasks(col.id)
                  return (
                    <td key={col.id} className="p-2 align-top border-r border-zinc-100 dark:border-zinc-800/30 last:border-0">
                      <div className="space-y-1.5 min-h-[60px]">
                        {aiTasks.map((task) => (
                          <TaskCard key={task.id} task={task} statusColor={col.color} isAI />
                        ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Minimal Task Card
function TaskCard({ task, statusColor, isAI }: { task: Task; statusColor: string; isAI?: boolean }) {
  return (
    <div
      className={`group relative p-2.5 rounded-lg cursor-pointer transition-all shadow-sm ${isAI
          ? "bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 hover:border-violet-300 dark:hover:border-violet-500/40"
          : "bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 hover:border-zinc-300 dark:hover:border-zinc-600"
        }`}
    >
      {/* Priority indicator */}
      {(task.priority === "HIGH" || task.priority === "URGENT") && (
        <div
          className="absolute top-0 left-2 w-3 h-0.5 rounded-b"
          style={{ backgroundColor: task.priority === "URGENT" ? "#ef4444" : "#f59e0b" }}
        />
      )}

      <p className={`text-xs line-clamp-2 leading-relaxed ${isAI ? "text-violet-900 dark:text-violet-100" : "text-zinc-700 dark:text-zinc-300"}`}>
        {task.title}
      </p>

      {task.evidence_link && (
        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-zinc-500">
          <Link2 className="w-2.5 h-2.5" />
          <span>링크</span>
        </div>
      )}

      {isAI && (
        <div className="flex items-center gap-1 mt-1.5">
          <span className="text-[10px] text-violet-500 dark:text-violet-400 font-medium">AI</span>
        </div>
      )}

      {/* Hover action */}
      <button className="absolute top-1.5 right-1.5 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-all">
        <ExternalLink className="w-2.5 h-2.5 text-zinc-400 dark:text-zinc-500" />
      </button>
    </div>
  )
}
