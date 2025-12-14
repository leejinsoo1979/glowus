"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Plus,
  Bot,
  FileText,
  Users,
  Zap,
  Sparkles,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/Button"

interface ProjectQuickActionsProps {
  projectId: string
  onAddTask?: () => void
  onAddMember?: () => void
  onAddAgent?: () => void
  onGenerateWorkflow?: () => void
}

export function ProjectQuickActions({
  projectId,
  onAddTask,
  onAddMember,
  onAddAgent,
  onGenerateWorkflow,
}: ProjectQuickActionsProps) {
  const [generatingWorkflow, setGeneratingWorkflow] = useState(false)

  const handleGenerateWorkflow = async () => {
    if (onGenerateWorkflow) {
      onGenerateWorkflow()
      return
    }

    setGeneratingWorkflow(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-workflow`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("워크플로우 생성 실패")
      // Reload the page to show new tasks
      window.location.reload()
    } catch (error) {
      console.error("Generate workflow error:", error)
      alert("워크플로우 생성에 실패했습니다")
    } finally {
      setGeneratingWorkflow(false)
    }
  }

  const actions = [
    {
      label: "태스크 추가",
      icon: Plus,
      color: "#3B82F6",
      onClick: onAddTask,
      description: "새 태스크 생성",
    },
    {
      label: "AI 워크플로우",
      icon: Sparkles,
      color: "#8B5CF6",
      onClick: handleGenerateWorkflow,
      description: "AI가 자동으로 생성",
      loading: generatingWorkflow,
    },
    {
      label: "팀원 추가",
      icon: Users,
      color: "#10B981",
      onClick: onAddMember,
      description: "프로젝트에 팀원 추가",
    },
    {
      label: "에이전트 추가",
      icon: Bot,
      color: "#F59E0B",
      onClick: onAddAgent,
      description: "AI 에이전트 투입",
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {actions.map((action, idx) => (
        <motion.button
          key={action.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          onClick={action.onClick}
          disabled={action.loading}
          className="flex flex-col items-center gap-2 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 hover:bg-zinc-800/50 transition-all group disabled:opacity-50"
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
            style={{ backgroundColor: `${action.color}15` }}
          >
            {action.loading ? (
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: action.color }} />
            ) : (
              <action.icon className="w-6 h-6" style={{ color: action.color }} />
            )}
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-white">{action.label}</div>
            <div className="text-xs text-zinc-500">{action.description}</div>
          </div>
        </motion.button>
      ))}
    </div>
  )
}
