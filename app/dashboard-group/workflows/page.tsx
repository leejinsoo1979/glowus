"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import { Workflow, Plus, Settings, ChevronRight, Clock, Zap, AlertTriangle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/Button"

// Dynamically import WorkflowBuilder to avoid SSR issues with ReactFlow
const WorkflowBuilder = dynamic(
  () => import("@/components/workflow").then((mod) => mod.WorkflowBuilder),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-zinc-950">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Workflow className="w-8 h-8 text-accent" />
        </motion.div>
      </div>
    ),
  }
)

type ViewMode = "builder" | "list"

interface WorkflowItem {
  id: string
  name: string
  description: string
  status: "draft" | "active" | "paused" | "error"
  lastRun?: string
  runsCount: number
  nodesCount: number
  createdAt: string
}

// Mock workflows for list view
const mockWorkflows: WorkflowItem[] = [
  {
    id: "1",
    name: "새 리드 알림",
    description: "새로운 리드가 등록되면 Slack으로 알림 전송",
    status: "active",
    lastRun: "2024-01-15T10:30:00",
    runsCount: 156,
    nodesCount: 5,
    createdAt: "2024-01-01T00:00:00",
  },
  {
    id: "2",
    name: "일일 리포트 생성",
    description: "매일 아침 9시에 KPI 리포트 자동 생성",
    status: "active",
    lastRun: "2024-01-15T09:00:00",
    runsCount: 45,
    nodesCount: 8,
    createdAt: "2024-01-05T00:00:00",
  },
  {
    id: "3",
    name: "태스크 마감 알림",
    description: "마감일이 다가오는 태스크 담당자에게 알림",
    status: "paused",
    lastRun: "2024-01-10T15:00:00",
    runsCount: 23,
    nodesCount: 4,
    createdAt: "2024-01-08T00:00:00",
  },
  {
    id: "4",
    name: "투자자 리서치 자동화",
    description: "새 투자자 정보를 수집하고 CRM에 추가",
    status: "draft",
    runsCount: 0,
    nodesCount: 12,
    createdAt: "2024-01-14T00:00:00",
  },
]

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  draft: {
    label: "초안",
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/20",
    icon: <Settings className="w-3 h-3" />,
  },
  active: {
    label: "활성",
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    icon: <Zap className="w-3 h-3" />,
  },
  paused: {
    label: "일시정지",
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
    icon: <Clock className="w-3 h-3" />,
  },
  error: {
    label: "오류",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
}

export default function WorkflowsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)] bg-gray-50 dark:bg-zinc-950">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Workflow className="w-8 h-8 text-accent" />
        </motion.div>
      </div>
    )
  }

  if (viewMode === "builder") {
    return (
      <div className="h-[calc(100vh-120px)]">
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode("list")}
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            >
              ← 목록으로
            </button>
            <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">새 워크플로우</h1>
          </div>
        </div>
        <div className="h-[calc(100%-52px)]">
          <WorkflowBuilder />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">워크플로우</h1>
          <p className="text-sm text-zinc-500 mt-1">
            자동화 워크플로우를 생성하고 관리하세요
          </p>
        </div>
        <Button onClick={() => setViewMode("builder")} className="bg-accent hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" />
          새 워크플로우
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "전체 워크플로우", value: mockWorkflows.length, icon: <Workflow className="w-5 h-5" /> },
          { label: "활성", value: mockWorkflows.filter((w) => w.status === "active").length, icon: <Zap className="w-5 h-5 text-green-400" /> },
          { label: "오늘 실행", value: 42, icon: <CheckCircle className="w-5 h-5 text-accent" /> },
          { label: "평균 노드 수", value: Math.round(mockWorkflows.reduce((acc, w) => acc + w.nodesCount, 0) / mockWorkflows.length), icon: <Settings className="w-5 h-5 text-accent" /> },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-sm">{stat.label}</span>
              {stat.icon}
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">{stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Workflow List */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">내 워크플로우</h2>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {mockWorkflows.map((workflow, index) => {
            const status = statusConfig[workflow.status]
            return (
              <motion.div
                key={workflow.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                onClick={() => setViewMode("builder")}
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                    <Workflow className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{workflow.name}</h3>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${status.color} ${status.bgColor}`}
                      >
                        {status.icon}
                        {status.label}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500 mt-0.5">{workflow.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">{workflow.nodesCount} 노드</div>
                    <div className="text-xs text-zinc-500">{workflow.runsCount}회 실행</div>
                  </div>
                  {workflow.lastRun && (
                    <div className="text-right min-w-[100px]">
                      <div className="text-xs text-zinc-500">마지막 실행</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">{formatDate(workflow.lastRun)}</div>
                    </div>
                  )}
                  <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-zinc-600" />
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Empty State (hidden when workflows exist) */}
      {mockWorkflows.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl"
        >
          <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-4">
            <Workflow className="w-8 h-8 text-zinc-500" />
          </div>
          <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">워크플로우가 없습니다</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-4">
            첫 번째 자동화 워크플로우를 만들어보세요
          </p>
          <Button onClick={() => setViewMode("builder")} className="bg-accent hover:bg-accent/90">
            <Plus className="w-4 h-4 mr-2" />
            워크플로우 만들기
          </Button>
        </motion.div>
      )}
    </div>
  )
}
