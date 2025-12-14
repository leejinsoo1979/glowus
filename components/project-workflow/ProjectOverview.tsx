"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Bot,
  Users,
  Target,
  TrendingUp,
  Calendar,
  FileText,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"

interface TaskStats {
  total: number
  todo: number
  in_progress: number
  review: number
  done: number
  overdue: number
}

interface ProjectOverviewProps {
  projectId: string
  project: {
    name: string
    progress: number
    deadline?: string | null
    status: string
    members?: any[]
    agents?: any[]
  }
}

export function ProjectOverview({ projectId, project }: ProjectOverviewProps) {
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    todo: 0,
    in_progress: 0,
    review: 0,
    done: 0,
    overdue: 0,
  })
  const [documentCount, setDocumentCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [projectId])

  const fetchStats = async () => {
    try {
      // Fetch tasks
      const tasksRes = await fetch(`/api/projects/${projectId}/tasks`)
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        const tasks = tasksData.tasks || []
        const now = new Date()

        setStats({
          total: tasks.length,
          todo: tasks.filter((t: any) => t.status === "TODO").length,
          in_progress: tasks.filter((t: any) => t.status === "IN_PROGRESS").length,
          review: tasks.filter((t: any) => t.status === "REVIEW").length,
          done: tasks.filter((t: any) => t.status === "DONE").length,
          overdue: tasks.filter((t: any) =>
            t.due_date && new Date(t.due_date) < now && t.status !== "DONE"
          ).length,
        })
      }

      // Fetch documents
      const docsRes = await fetch(`/api/projects/${projectId}/documents`)
      if (docsRes.ok) {
        const docsData = await docsRes.json()
        setDocumentCount(docsData.documents?.length || 0)
      }
    } catch (error) {
      console.error("Stats fetch error:", error)
    } finally {
      setLoading(false)
    }
  }

  const completionRate = stats.total > 0
    ? Math.round((stats.done / stats.total) * 100)
    : 0

  const daysUntilDeadline = project.deadline
    ? Math.ceil((new Date(project.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null

  const kpiCards = [
    {
      label: "전체 태스크",
      value: stats.total,
      icon: Target,
      color: "#3B82F6",
      change: null,
    },
    {
      label: "완료",
      value: stats.done,
      icon: CheckCircle2,
      color: "#10B981",
      change: completionRate > 0 ? `${completionRate}%` : null,
      changePositive: true,
    },
    {
      label: "진행 중",
      value: stats.in_progress,
      icon: Clock,
      color: "#F59E0B",
      change: null,
    },
    {
      label: "검토 대기",
      value: stats.review,
      icon: Zap,
      color: "#8B5CF6",
      change: null,
    },
    {
      label: "지연됨",
      value: stats.overdue,
      icon: AlertTriangle,
      color: "#EF4444",
      change: stats.overdue > 0 ? "주의" : null,
      changePositive: false,
    },
    {
      label: "문서",
      value: documentCount,
      icon: FileText,
      color: "#06B6D4",
      change: null,
    },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((kpi, idx) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${kpi.color}15` }}
              >
                <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
              </div>
              {kpi.change && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                    kpi.changePositive
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {kpi.changePositive ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {kpi.change}
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-white">{kpi.value}</div>
            <div className="text-xs text-zinc-500 mt-1">{kpi.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Progress and Team Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress Ring */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
        >
          <h3 className="text-sm font-medium text-zinc-400 mb-4">프로젝트 진행률</h3>
          <div className="flex items-center justify-center">
            <div className="relative w-32 h-32">
              {/* Background circle */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#27272a"
                  strokeWidth="12"
                  fill="none"
                />
                {/* Progress circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#10B981"
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(project.progress / 100) * 352} 352`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white">{project.progress}%</span>
                <span className="text-xs text-zinc-500">완료</span>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">태스크 완료율</span>
              <span className="text-white">{completionRate}%</span>
            </div>
            {daysUntilDeadline !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">마감까지</span>
                <span className={daysUntilDeadline < 0 ? "text-red-400" : daysUntilDeadline < 7 ? "text-amber-400" : "text-white"}>
                  {daysUntilDeadline < 0 ? `${Math.abs(daysUntilDeadline)}일 지연` : `${daysUntilDeadline}일`}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Task Distribution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
        >
          <h3 className="text-sm font-medium text-zinc-400 mb-4">태스크 분포</h3>
          <div className="space-y-3">
            {[
              { label: "할 일", value: stats.todo, color: "#6B7280", total: stats.total },
              { label: "진행 중", value: stats.in_progress, color: "#F59E0B", total: stats.total },
              { label: "검토", value: stats.review, color: "#8B5CF6", total: stats.total },
              { label: "완료", value: stats.done, color: "#10B981", total: stats.total },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-400">{item.label}</span>
                  <span className="text-white">{item.value}</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: item.total > 0 ? `${(item.value / item.total) * 100}%` : "0%",
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Team & Agents */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
        >
          <h3 className="text-sm font-medium text-zinc-400 mb-4">팀 구성</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="text-lg font-bold text-white">{project.members?.length || 0}</div>
                <div className="text-xs text-zinc-500">팀원</div>
              </div>
              <div className="flex -space-x-2">
                {project.members?.slice(0, 3).map((member: any) => (
                  <img
                    key={member.id}
                    src={member.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user?.name}`}
                    alt=""
                    className="w-8 h-8 rounded-full border-2 border-zinc-900"
                  />
                ))}
                {(project.members?.length || 0) > 3 && (
                  <div className="w-8 h-8 rounded-full border-2 border-zinc-900 bg-zinc-700 flex items-center justify-center text-xs text-white">
                    +{(project.members?.length || 0) - 3}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="text-lg font-bold text-white">{project.agents?.length || 0}</div>
                <div className="text-xs text-zinc-500">AI 에이전트</div>
              </div>
              <div className="flex -space-x-2">
                {project.agents?.slice(0, 3).map((assignment: any) => (
                  <img
                    key={assignment.id}
                    src={assignment.agent?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${assignment.agent?.name}`}
                    alt=""
                    className="w-8 h-8 rounded-full border-2 border-zinc-900"
                  />
                ))}
                {(project.agents?.length || 0) > 3 && (
                  <div className="w-8 h-8 rounded-full border-2 border-zinc-900 bg-zinc-700 flex items-center justify-center text-xs text-white">
                    +{(project.agents?.length || 0) - 3}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Deadline Alert */}
          {daysUntilDeadline !== null && daysUntilDeadline <= 7 && daysUntilDeadline >= 0 && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-400">
                  마감일이 {daysUntilDeadline}일 남았습니다
                </span>
              </div>
            </div>
          )}
          {daysUntilDeadline !== null && daysUntilDeadline < 0 && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400">
                  마감일이 {Math.abs(daysUntilDeadline)}일 지났습니다
                </span>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
