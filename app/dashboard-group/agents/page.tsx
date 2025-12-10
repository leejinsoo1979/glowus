"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import dynamic from "next/dynamic"
import {
  Bot,
  Plus,
  Grid3X3,
  LayoutList,
  Play,
  Pause,
  Settings,
  Copy,
  Trash2,
  Clock,
  Zap,
  MessageSquare,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useThemeStore, accentColors } from "@/stores/themeStore"

// Dynamic import for SSR compatibility
const AgentBuilder = dynamic(
  () => import("@/components/agent/AgentBuilder").then((mod) => mod.AgentBuilder),
  { ssr: false }
)

type ViewMode = "builder" | "list"

interface MockAgent {
  id: string
  name: string
  description: string
  status: "active" | "draft" | "paused" | "testing"
  nodeCount: number
  lastRun?: string
  totalRuns: number
  avgLatency: number
  category: "chatbot" | "assistant" | "analyzer" | "generator" | "custom"
}

const mockAgents: MockAgent[] = [
  {
    id: "1",
    name: "고객 지원 챗봇",
    description: "RAG 기반 FAQ 답변 및 문의 처리",
    status: "active",
    nodeCount: 6,
    lastRun: "2분 전",
    totalRuns: 1250,
    avgLatency: 1.2,
    category: "chatbot",
  },
  {
    id: "2",
    name: "문서 분석 어시스턴트",
    description: "PDF 및 문서 내용 요약 및 질의응답",
    status: "active",
    nodeCount: 8,
    lastRun: "15분 전",
    totalRuns: 342,
    avgLatency: 2.8,
    category: "analyzer",
  },
  {
    id: "3",
    name: "콘텐츠 생성기",
    description: "블로그 포스트 및 마케팅 콘텐츠 자동 생성",
    status: "draft",
    nodeCount: 5,
    totalRuns: 0,
    avgLatency: 0,
    category: "generator",
  },
  {
    id: "4",
    name: "투자자 매칭 에이전트",
    description: "스타트업-투자자 최적 매칭 AI",
    status: "testing",
    nodeCount: 12,
    lastRun: "1시간 전",
    totalRuns: 28,
    avgLatency: 3.5,
    category: "custom",
  },
]

const statusConfig: Record<
  MockAgent["status"],
  { label: string; color: string; bgColor: string }
> = {
  active: { label: "활성", color: "#22c55e", bgColor: "#22c55e20" },
  draft: { label: "초안", color: "#64748b", bgColor: "#64748b20" },
  paused: { label: "일시정지", color: "#f59e0b", bgColor: "#f59e0b20" },
  testing: { label: "테스트 중", color: "#8b5cf6", bgColor: "#8b5cf620" },
}

const categoryConfig: Record<
  MockAgent["category"],
  { label: string; icon: React.ElementType }
> = {
  chatbot: { label: "챗봇", icon: MessageSquare },
  assistant: { label: "어시스턴트", icon: Bot },
  analyzer: { label: "분석기", icon: Zap },
  generator: { label: "생성기", icon: Sparkles },
  custom: { label: "커스텀", icon: Settings },
}

export default function AgentsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [mounted, setMounted] = useState(false)
  const { accentColor } = useThemeStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]

  // Calculate stats
  const totalAgents = mockAgents.length
  const activeAgents = mockAgents.filter((a) => a.status === "active").length
  const totalRuns = mockAgents.reduce((sum, a) => sum + a.totalRuns, 0)
  const avgNodes = Math.round(
    mockAgents.reduce((sum, a) => sum + a.nodeCount, 0) / mockAgents.length
  )

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: mounted ? `${currentAccent.color}20` : "#8b5cf620" }}
            >
              <Bot
                className="w-5 h-5"
                style={{ color: mounted ? currentAccent.color : "#8b5cf6" }}
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">AI 에이전트</h1>
              <p className="text-sm text-zinc-500">
                AI 에이전트를 생성하고 관리하세요
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex rounded-lg p-1 bg-zinc-200 dark:bg-zinc-800">
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === "list"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("builder")}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === "builder"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
            </div>

            <Button
              onClick={() => setViewMode("builder")}
              style={{
                backgroundColor: mounted ? currentAccent.color : "#8b5cf6",
              }}
              className="text-white"
            >
              <Plus className="w-4 h-4 mr-2" />새 에이전트
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === "builder" ? (
        <div className="flex-1">
          <AgentBuilder />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-500">전체 에이전트</span>
                <Bot className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{totalAgents}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-4 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-500">활성 에이전트</span>
                <Zap className="w-4 h-4 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{activeAgents}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-4 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-500">총 실행 수</span>
                <Play className="w-4 h-4 text-accent" />
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {totalRuns.toLocaleString()}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-4 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-500">평균 노드 수</span>
                <Grid3X3 className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{avgNodes}</div>
            </motion.div>
          </div>

          {/* Agent List */}
          <div className="space-y-3">
            {mockAgents.map((agent, index) => {
              const status = statusConfig[agent.status]
              const category = categoryConfig[agent.category]
              const CategoryIcon = category.icon

              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-xl border transition-colors bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{
                          backgroundColor: mounted
                            ? `${currentAccent.color}20`
                            : "#8b5cf620",
                        }}
                      >
                        <CategoryIcon
                          className="w-6 h-6"
                          style={{
                            color: mounted ? currentAccent.color : "#8b5cf6",
                          }}
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                            {agent.name}
                          </h3>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: status.bgColor,
                              color: status.color,
                            }}
                          >
                            {status.label}
                          </span>
                        </div>
                        <p className="text-sm mt-0.5 text-zinc-500">
                          {agent.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Stats */}
                      <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                        <div className="flex items-center gap-1">
                          <Grid3X3 className="w-4 h-4" />
                          <span>{agent.nodeCount} 노드</span>
                        </div>
                        {agent.lastRun && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{agent.lastRun}</span>
                          </div>
                        )}
                        {agent.avgLatency > 0 && (
                          <div className="flex items-center gap-1">
                            <Zap className="w-4 h-4" />
                            <span>{agent.avgLatency}s</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" title="테스트 실행">
                          <Play className="w-4 h-4" />
                        </Button>
                        {agent.status === "active" ? (
                          <Button variant="ghost" size="sm" title="일시정지">
                            <Pause className="w-4 h-4" />
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" title="설정">
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title="복제">
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
