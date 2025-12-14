"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bot,
  User,
  CheckCircle2,
  FileText,
  MessageSquare,
  Play,
  Clock,
  ArrowRight,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/Button"

interface ActivityItem {
  id: string
  type: "task_completed" | "agent_executed" | "document_created" | "task_assigned" | "task_created"
  title: string
  description?: string
  actor: {
    type: "user" | "agent"
    name: string
    avatar?: string
  }
  timestamp: string
  metadata?: Record<string, any>
}

interface ProjectActivityProps {
  projectId: string
}

export function ProjectActivity({ projectId }: ProjectActivityProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchActivities()
  }, [projectId])

  const fetchActivities = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      // Fetch recent agent tasks
      const [tasksRes, docsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/tasks`),
        fetch(`/api/projects/${projectId}/documents`),
      ])

      const activityItems: ActivityItem[] = []

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        const tasks = tasksData.tasks || []

        // Add completed tasks as activities
        tasks
          .filter((t: any) => t.status === "DONE" || t.status === "REVIEW")
          .forEach((task: any) => {
            if (task.agent_executed_at && task.assignee_agent) {
              activityItems.push({
                id: `task-${task.id}`,
                type: "agent_executed",
                title: task.title,
                description: task.agent_result?.output?.slice(0, 100) + "..." || "작업 완료",
                actor: {
                  type: "agent",
                  name: task.assignee_agent.name,
                  avatar: task.assignee_agent.avatar_url,
                },
                timestamp: task.agent_executed_at,
                metadata: { taskId: task.id, status: task.status },
              })
            } else if (task.completed_at) {
              activityItems.push({
                id: `task-complete-${task.id}`,
                type: "task_completed",
                title: task.title,
                description: "태스크가 완료되었습니다",
                actor: {
                  type: "user",
                  name: task.assignee_user?.name || "알 수 없음",
                  avatar: task.assignee_user?.avatar_url,
                },
                timestamp: task.completed_at,
                metadata: { taskId: task.id },
              })
            }
          })

        // Add recent task creations
        tasks
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
          .forEach((task: any) => {
            activityItems.push({
              id: `task-created-${task.id}`,
              type: "task_created",
              title: `"${task.title}" 태스크 생성`,
              description: task.description || "",
              actor: {
                type: "user",
                name: "시스템",
              },
              timestamp: task.created_at,
              metadata: { taskId: task.id },
            })
          })
      }

      if (docsRes.ok) {
        const docsData = await docsRes.json()
        const docs = docsData.documents || []

        docs.forEach((doc: any) => {
          activityItems.push({
            id: `doc-${doc.id}`,
            type: "document_created",
            title: doc.title,
            description: doc.summary || "문서가 생성되었습니다",
            actor: {
              type: doc.created_by_type === "agent" ? "agent" : "user",
              name: doc.created_by_agent?.name || doc.created_by_user?.name || "알 수 없음",
              avatar: doc.created_by_agent?.avatar_url || doc.created_by_user?.avatar_url,
            },
            timestamp: doc.created_at,
            metadata: { documentId: doc.id, docType: doc.doc_type },
          })
        })
      }

      // Sort by timestamp
      activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setActivities(activityItems.slice(0, 20))
    } catch (error) {
      console.error("Activities fetch error:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "task_completed":
        return { icon: CheckCircle2, color: "#10B981", bg: "#10B98120" }
      case "agent_executed":
        return { icon: Bot, color: "#8B5CF6", bg: "#8B5CF620" }
      case "document_created":
        return { icon: FileText, color: "#3B82F6", bg: "#3B82F620" }
      case "task_assigned":
        return { icon: User, color: "#F59E0B", bg: "#F59E0B20" }
      case "task_created":
        return { icon: Play, color: "#06B6D4", bg: "#06B6D420" }
      default:
        return { icon: Clock, color: "#6B7280", bg: "#6B728020" }
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return "방금 전"
    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`
    return date.toLocaleDateString("ko-KR")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Clock className="w-4 h-4" />
          최근 활동
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchActivities(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>아직 활동이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-1">
          {activities.map((activity, idx) => {
            const iconInfo = getActivityIcon(activity.type)
            const IconComponent = iconInfo.icon

            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="flex gap-3 p-3 hover:bg-zinc-800/50 rounded-lg transition-colors group"
              >
                {/* Timeline line */}
                <div className="relative flex flex-col items-center">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: iconInfo.bg }}
                  >
                    <IconComponent className="w-4 h-4" style={{ color: iconInfo.color }} />
                  </div>
                  {idx < activities.length - 1 && (
                    <div className="w-0.5 h-full bg-zinc-800 absolute top-10" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-white font-medium truncate">{activity.title}</p>
                      {activity.description && (
                        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                          {activity.description}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-zinc-600 whitespace-nowrap">
                      {formatTimestamp(activity.timestamp)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    {activity.actor.avatar ? (
                      <img
                        src={activity.actor.avatar}
                        alt={activity.actor.name}
                        className="w-5 h-5 rounded-full"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center">
                        {activity.actor.type === "agent" ? (
                          <Bot className="w-3 h-3 text-zinc-400" />
                        ) : (
                          <User className="w-3 h-3 text-zinc-400" />
                        )}
                      </div>
                    )}
                    <span className="text-xs text-zinc-500">{activity.actor.name}</span>
                    {activity.metadata?.status === "REVIEW" && (
                      <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                        검토 대기
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
