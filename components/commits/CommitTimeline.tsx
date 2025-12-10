"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import {
  GitCommit,
  GitBranch,
  Clock,
  User,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar,
  TrendingUp,
  Zap,
  FileCode,
  CheckCircle2,
} from "lucide-react"

export interface Commit {
  id: string
  title: string
  description?: string
  author: {
    id: string
    name: string
    avatar?: string
  }
  timestamp: Date
  taskTitle?: string
  taskId?: string
  impactLevel: "low" | "medium" | "high"
  aiSummary?: string
  files?: string[]
  tags?: string[]
}

interface CommitTimelineProps {
  commits?: Commit[]
  onCommitClick?: (commit: Commit) => void
}

const defaultCommits: Commit[] = [
  {
    id: "1",
    title: "결제 시스템 Stripe API 연동 완료",
    description: "Stripe 결제 API 연동 및 웹훅 처리 로직 구현. 테스트 환경 검증 완료.",
    author: { id: "1", name: "김철수" },
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    taskTitle: "결제 시스템 연동",
    taskId: "task-3",
    impactLevel: "high",
    aiSummary: "결제 기능의 핵심 인프라 구축 완료. 실제 결제 플로우 테스트 진행 필요.",
    files: ["lib/stripe.ts", "api/webhooks/stripe/route.ts", "hooks/usePayment.ts"],
    tags: ["백엔드", "결제", "API"],
  },
  {
    id: "2",
    title: "대시보드 차트 컴포넌트 리팩토링",
    description: "recharts 라이브러리 적용 및 반응형 차트 구현",
    author: { id: "2", name: "이영희" },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    taskTitle: "대시보드 UI 리팩토링",
    taskId: "task-2",
    impactLevel: "medium",
    aiSummary: "UI 개선으로 데이터 시각화 품질 향상. 사용자 경험 개선 예상.",
    files: ["components/dashboard/TasksChart.tsx", "components/dashboard/index.ts"],
    tags: ["프론트엔드", "UI", "차트"],
  },
  {
    id: "3",
    title: "사용자 인증 OAuth 프로바이더 추가",
    description: "Google, GitHub OAuth 로그인 지원 추가",
    author: { id: "1", name: "김철수" },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    taskTitle: "사용자 인증 플로우 설계",
    taskId: "task-1",
    impactLevel: "high",
    aiSummary: "소셜 로그인 지원으로 사용자 온보딩 간소화. 보안 검토 완료.",
    files: ["lib/auth.ts", "app/api/auth/[...nextauth]/route.ts"],
    tags: ["백엔드", "인증", "OAuth"],
  },
  {
    id: "4",
    title: "API 문서 자동 생성 설정",
    description: "Swagger/OpenAPI 스펙 자동 생성 및 문서 페이지 구현",
    author: { id: "3", name: "박민수" },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    taskTitle: "API 문서화",
    taskId: "task-4",
    impactLevel: "low",
    aiSummary: "API 문서화로 개발자 경험 향상. 외부 연동 준비 완료.",
    files: ["lib/swagger.ts", "app/api/docs/route.ts"],
    tags: ["문서화", "API"],
  },
  {
    id: "5",
    title: "데이터베이스 인덱스 최적화",
    description: "자주 조회되는 테이블에 인덱스 추가 및 쿼리 최적화",
    author: { id: "1", name: "김철수" },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
    taskTitle: "데이터베이스 설계",
    taskId: "task-4",
    impactLevel: "medium",
    aiSummary: "쿼리 성능 약 40% 향상 예상. 대용량 데이터 처리 준비 완료.",
    files: ["supabase/migrations/005_add_indexes.sql"],
    tags: ["백엔드", "DB", "성능"],
  },
]

const impactConfig = {
  low: { label: "낮음", color: "bg-zinc-600 text-zinc-300", icon: "📝" },
  medium: { label: "보통", color: "bg-yellow-500/20 text-yellow-400", icon: "📊" },
  high: { label: "높음", color: "bg-orange-500/20 text-orange-400", icon: "🚀" },
}

export function CommitTimeline({
  commits = defaultCommits,
  onCommitClick,
}: CommitTimelineProps) {
  const [mounted, setMounted] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all")
  const { accentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]

  useEffect(() => {
    setMounted(true)
  }, [])

  // Use CSS variable for accent color
  const accentColorValue = "var(--accent-color)"

  const filteredCommits = commits.filter(
    (c) => filter === "all" || c.impactLevel === filter
  )

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) return `${minutes}분 전`
    if (hours < 24) return `${hours}시간 전`
    if (days < 7) return `${days}일 전`
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
  }

  // Group commits by date
  const groupedCommits = filteredCommits.reduce((acc, commit) => {
    const dateKey = commit.timestamp.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(commit)
    return acc
  }, {} as Record<string, Commit[]>)

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitCommit className="h-5 w-5" style={{ color: accentColorValue }} />
            <CardTitle className="text-zinc-100">업무 커밋 타임라인</CardTitle>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-zinc-800 text-zinc-400">
              {commits.length}개
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Impact Filter */}
            <div className="flex bg-zinc-800 rounded-lg p-1">
              {(["all", "high", "medium", "low"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setFilter(level)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    filter === level
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {level === "all"
                    ? "전체"
                    : level === "high"
                    ? "🚀 높음"
                    : level === "medium"
                    ? "📊 보통"
                    : "📝 낮음"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="relative">
          {/* Timeline Line */}
          <div
            className="absolute left-6 top-0 bottom-0 w-0.5"
            style={{ backgroundColor: `${accentColorValue}33` }}
          />

          <div className="space-y-8">
            {Object.entries(groupedCommits).map(([date, dateCommits]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center z-10"
                    style={{ backgroundColor: `${accentColorValue}20` }}
                  >
                    <Calendar className="h-5 w-5" style={{ color: accentColorValue }} />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-300">{date}</h3>
                </div>

                {/* Commits for this date */}
                <div className="space-y-4 ml-6">
                  {dateCommits.map((commit, index) => {
                    const isExpanded = expandedId === commit.id
                    const impact = impactConfig[commit.impactLevel]

                    return (
                      <motion.div
                        key={commit.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="relative pl-10"
                      >
                        {/* Timeline Node */}
                        <div
                          className="absolute left-0 top-4 w-3 h-3 rounded-full border-2 z-10"
                          style={{
                            backgroundColor: "#18181b",
                            borderColor: accentColorValue,
                          }}
                        />

                        {/* Commit Card */}
                        <div
                          className={`bg-zinc-800/50 rounded-xl border border-zinc-700/50 overflow-hidden transition-all duration-200 hover:border-zinc-600 cursor-pointer ${
                            isExpanded ? "shadow-lg" : ""
                          }`}
                          onClick={() => setExpandedId(isExpanded ? null : commit.id)}
                        >
                          <div className="p-4">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${impact.color}`}>
                                  {impact.icon} {impact.label}
                                </span>
                                {commit.tags?.slice(0, 2).map((tag) => (
                                  <span
                                    key={tag}
                                    className="px-2 py-0.5 text-xs rounded-full"
                                    style={{
                                      backgroundColor: `${accentColorValue}20`,
                                      color: accentColorValue,
                                    }}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-zinc-500">
                                <Clock className="h-3 w-3" />
                                {formatTimestamp(commit.timestamp)}
                              </div>
                            </div>

                            {/* Title */}
                            <h4 className="font-semibold text-zinc-100 mb-1">
                              {commit.title}
                            </h4>

                            {/* Task Link */}
                            {commit.taskTitle && (
                              <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
                                <GitBranch className="h-3 w-3" />
                                <span>{commit.taskTitle}</span>
                              </div>
                            )}

                            {/* Author */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                                  style={{ backgroundColor: accentColorValue }}
                                >
                                  {commit.author.name.charAt(0)}
                                </div>
                                <span className="text-sm text-zinc-400">
                                  {commit.author.name}
                                </span>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-zinc-500" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-zinc-500" />
                              )}
                            </div>
                          </div>

                          {/* Expanded Content */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 pt-2 border-t border-zinc-700/50 space-y-4">
                                  {/* Description */}
                                  {commit.description && (
                                    <div>
                                      <h5 className="text-xs font-medium text-zinc-400 mb-1">
                                        설명
                                      </h5>
                                      <p className="text-sm text-zinc-300">
                                        {commit.description}
                                      </p>
                                    </div>
                                  )}

                                  {/* AI Summary */}
                                  {commit.aiSummary && (
                                    <div
                                      className="p-3 rounded-lg"
                                      style={{
                                        backgroundColor: `${accentColorValue}10`,
                                        borderLeft: `3px solid ${accentColorValue}`,
                                      }}
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <Zap className="h-3 w-3" style={{ color: accentColorValue }} />
                                        <span className="text-xs font-medium" style={{ color: accentColorValue }}>
                                          AI 분석
                                        </span>
                                      </div>
                                      <p className="text-sm text-zinc-300">
                                        {commit.aiSummary}
                                      </p>
                                    </div>
                                  )}

                                  {/* Files */}
                                  {commit.files && commit.files.length > 0 && (
                                    <div>
                                      <h5 className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-1">
                                        <FileCode className="h-3 w-3" />
                                        변경된 파일 ({commit.files.length})
                                      </h5>
                                      <div className="space-y-1">
                                        {commit.files.map((file) => (
                                          <div
                                            key={file}
                                            className="flex items-center gap-2 text-xs text-zinc-400 font-mono bg-zinc-800 px-2 py-1 rounded"
                                          >
                                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                                            {file}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
