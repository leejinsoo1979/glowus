"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Target,
  Zap,
  RefreshCw,
  ChevronRight,
  BarChart3,
  Users,
  Clock,
  Shield,
  Sparkles,
} from "lucide-react"

interface Insight {
  id: string
  type: "risk" | "opportunity" | "recommendation" | "metric"
  title: string
  description: string
  priority: "low" | "medium" | "high" | "critical"
  category: string
  actionable?: {
    label: string
    action: () => void
  }
  trend?: "up" | "down" | "stable"
  value?: string | number
}

interface AIInsightPanelProps {
  insights?: Insight[]
  isLoading?: boolean
  onRefresh?: () => void
  onInsightClick?: (insight: Insight) => void
}

const defaultInsights: Insight[] = [
  {
    id: "1",
    type: "risk",
    title: "마감일 초과 위험",
    description: "결제 시스템 연동 태스크가 예상보다 3일 지연되고 있습니다. 현재 진행률 45%로 예상 완료일을 넘길 가능성이 높습니다.",
    priority: "high",
    category: "일정",
    actionable: {
      label: "리소스 재배치 제안 보기",
      action: () => console.log("Resource reallocation"),
    },
  },
  {
    id: "2",
    type: "opportunity",
    title: "팀 생산성 향상",
    description: "이번 주 팀 생산성이 지난주 대비 23% 향상되었습니다. 특히 오후 2-4시 집중 시간대 효율이 높습니다.",
    priority: "medium",
    category: "생산성",
    trend: "up",
    value: "+23%",
  },
  {
    id: "3",
    type: "recommendation",
    title: "코드 리뷰 병목 감지",
    description: "현재 5개의 PR이 2일 이상 리뷰 대기 중입니다. 리뷰어 추가 배정을 권장합니다.",
    priority: "medium",
    category: "워크플로우",
    actionable: {
      label: "리뷰어 자동 배정",
      action: () => console.log("Auto-assign reviewers"),
    },
  },
  {
    id: "4",
    type: "metric",
    title: "번다운 차트 분석",
    description: "스프린트 진행률이 이상적인 번다운 라인보다 15% 뒤처져 있습니다.",
    priority: "medium",
    category: "스프린트",
    trend: "down",
    value: "-15%",
  },
  {
    id: "5",
    type: "opportunity",
    title: "자동화 기회 발견",
    description: "반복적인 배포 작업이 감지되었습니다. CI/CD 파이프라인 자동화로 주당 약 4시간을 절약할 수 있습니다.",
    priority: "low",
    category: "효율화",
    actionable: {
      label: "자동화 가이드 보기",
      action: () => console.log("View automation guide"),
    },
  },
  {
    id: "6",
    type: "risk",
    title: "보안 취약점 발견",
    description: "의존성 패키지에서 2개의 중요도 높은 보안 취약점이 발견되었습니다.",
    priority: "critical",
    category: "보안",
    actionable: {
      label: "취약점 상세 보기",
      action: () => console.log("View vulnerabilities"),
    },
  },
]

const typeConfig = {
  risk: {
    icon: AlertTriangle,
    color: "#ef4444",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    label: "위험",
  },
  opportunity: {
    icon: TrendingUp,
    color: "#22c55e",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    label: "기회",
  },
  recommendation: {
    icon: Lightbulb,
    color: "#f59e0b",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    label: "권장",
  },
  metric: {
    icon: BarChart3,
    color: "#a855f7",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    label: "지표",
  },
}

const priorityConfig = {
  low: { label: "낮음", color: "bg-zinc-600 text-zinc-300" },
  medium: { label: "보통", color: "bg-yellow-500/20 text-yellow-400" },
  high: { label: "높음", color: "bg-orange-500/20 text-orange-400" },
  critical: { label: "긴급", color: "bg-red-500/20 text-red-400" },
}

export function AIInsightPanel({
  insights = defaultInsights,
  isLoading = false,
  onRefresh,
  onInsightClick,
}: AIInsightPanelProps) {
  const [mounted, setMounted] = useState(false)
  const [selectedType, setSelectedType] = useState<"all" | Insight["type"]>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { accentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]

  useEffect(() => {
    setMounted(true)
  }, [])

  // Use CSS variable for accent color
  const accentColorValue = "var(--accent-color)"

  const filteredInsights = insights.filter(
    (i) => selectedType === "all" || i.type === selectedType
  )

  // Summary stats
  const stats = {
    risks: insights.filter((i) => i.type === "risk").length,
    opportunities: insights.filter((i) => i.type === "opportunity").length,
    recommendations: insights.filter((i) => i.type === "recommendation").length,
    critical: insights.filter((i) => i.priority === "critical").length,
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-xl"
              style={{ backgroundColor: `${accentColorValue}20` }}
            >
              <Brain className="h-5 w-5" style={{ color: accentColorValue }} />
            </div>
            <div>
              <CardTitle className="text-zinc-100">AI 인사이트</CardTitle>
              <p className="text-xs text-zinc-500 mt-0.5">
                실시간 분석 기반 인사이트
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isLoading}
            className="text-zinc-400 hover:text-zinc-100"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-red-400 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-lg font-bold">{stats.risks}</span>
            </div>
            <span className="text-xs text-zinc-500">위험</span>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-lg font-bold">{stats.opportunities}</span>
            </div>
            <span className="text-xs text-zinc-500">기회</span>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-yellow-400 mb-1">
              <Lightbulb className="h-4 w-4" />
              <span className="text-lg font-bold">{stats.recommendations}</span>
            </div>
            <span className="text-xs text-zinc-500">권장</span>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-red-500 mb-1">
              <Shield className="h-4 w-4" />
              <span className="text-lg font-bold">{stats.critical}</span>
            </div>
            <span className="text-xs text-zinc-500">긴급</span>
          </div>
        </div>

        {/* Type Filter */}
        <div className="flex bg-zinc-800 rounded-lg p-1 mt-4">
          {(["all", "risk", "opportunity", "recommendation", "metric"] as const).map(
            (type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  selectedType === type
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {type === "all"
                  ? "전체"
                  : typeConfig[type as keyof typeof typeConfig].label}
              </button>
            )
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <div
                className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: `${accentColorValue}33`, borderTopColor: "transparent" }}
              />
              <Sparkles
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5"
                style={{ color: accentColorValue }}
              />
            </div>
            <p className="text-sm text-zinc-500 mt-4">AI가 분석 중입니다...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredInsights.map((insight, index) => {
                const config = typeConfig[insight.type]
                const priority = priorityConfig[insight.priority]
                const Icon = config.icon
                const isExpanded = expandedId === insight.id

                return (
                  <motion.div
                    key={insight.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    className={`rounded-xl border ${config.bgColor} ${config.borderColor} overflow-hidden cursor-pointer transition-all hover:shadow-lg`}
                    onClick={() => setExpandedId(isExpanded ? null : insight.id)}
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div
                          className="p-2 rounded-lg flex-shrink-0"
                          style={{ backgroundColor: `${config.color}20` }}
                        >
                          <Icon className="h-4 w-4" style={{ color: config.color }} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${priority.color}`}>
                              {priority.label}
                            </span>
                            <span className="text-xs text-zinc-500">{insight.category}</span>
                            {insight.trend && (
                              <div className={`flex items-center gap-0.5 text-xs ${
                                insight.trend === "up" ? "text-green-400" : "text-red-400"
                              }`}>
                                {insight.trend === "up" ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {insight.value}
                              </div>
                            )}
                          </div>

                          <h4 className="font-semibold text-zinc-100 mb-1">
                            {insight.title}
                          </h4>

                          <p className={`text-sm text-zinc-400 ${isExpanded ? "" : "line-clamp-2"}`}>
                            {insight.description}
                          </p>
                        </div>

                        {/* Arrow */}
                        <ChevronRight
                          className={`h-5 w-5 text-zinc-500 flex-shrink-0 transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      </div>

                      {/* Expanded Action */}
                      <AnimatePresence>
                        {isExpanded && insight.actionable && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 pt-4 border-t border-zinc-700/50">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  insight.actionable?.action()
                                }}
                                className="w-full gap-2"
                                style={{ backgroundColor: config.color }}
                              >
                                <Zap className="h-4 w-4" />
                                {insight.actionable.label}
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {filteredInsights.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-zinc-400">현재 해당 유형의 인사이트가 없습니다.</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
