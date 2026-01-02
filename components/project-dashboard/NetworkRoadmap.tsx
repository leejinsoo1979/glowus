"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import {
  Rocket,
  Target,
  CheckCircle2,
  Circle,
  Sparkles,
  Loader2,
  Plus,
  AlertCircle,
} from "lucide-react"
import { useTheme } from "next-themes"

interface RoadmapNode {
  id: string
  title: string
  description?: string
  status: "pending" | "ready" | "running" | "completed" | "failed" | "paused"
  position_x: number
  position_y: number
  created_at: string
  started_at?: string
  completed_at?: string
}

interface NodeDependency {
  id: string
  source_node_id: string
  target_node_id: string
}

interface Milestone {
  id: string
  title: string
  status: "completed" | "in_progress" | "upcoming"
  date: string
  x: number
  y: number
  connections: string[]
}

interface NetworkRoadmapProps {
  projectId: string
}

// DB status를 display status로 변환
const mapStatus = (dbStatus: string): "completed" | "in_progress" | "upcoming" => {
  switch (dbStatus) {
    case "completed":
      return "completed"
    case "running":
      return "in_progress"
    case "pending":
    case "ready":
    case "paused":
    case "failed":
    default:
      return "upcoming"
  }
}

// 날짜 포맷팅
const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

export function NetworkRoadmap({ projectId }: NetworkRoadmapProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const { theme } = useTheme()
  const isDark = theme === "dark"

  useEffect(() => {
    fetchRoadmapData()
  }, [projectId])

  const fetchRoadmapData = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/projects/${projectId}/roadmap`)
      if (!res.ok) {
        throw new Error("로드맵 데이터를 불러오는데 실패했습니다")
      }

      const data = await res.json()
      const rawNodes: RoadmapNode[] = data.raw?.nodes || []
      const rawDeps: NodeDependency[] = data.raw?.dependencies || []

      if (rawNodes.length === 0) {
        setMilestones([])
        return
      }

      // 연결 맵 생성
      const connectionMap: Record<string, string[]> = {}
      rawDeps.forEach((dep) => {
        if (!connectionMap[dep.source_node_id]) {
          connectionMap[dep.source_node_id] = []
        }
        connectionMap[dep.source_node_id].push(dep.target_node_id)
      })

      // 위치 자동 계산 (노드에 위치가 없으면)
      const calculatePositions = (nodes: RoadmapNode[]): Milestone[] => {
        const width = 620
        const height = 300
        const padding = 80
        const count = nodes.length

        return nodes.map((node, idx) => {
          // 저장된 위치가 있으면 사용, 없으면 자동 배치
          let x = node.position_x
          let y = node.position_y

          if (x === 0 && y === 0) {
            // 가로로 균등 분배
            x = padding + (idx * (width - 2 * padding)) / Math.max(count - 1, 1)
            // 약간의 변화 주기
            y = height / 2 + (idx % 2 === 0 ? -30 : 30) + Math.sin(idx) * 20
          }

          return {
            id: node.id,
            title: node.title,
            status: mapStatus(node.status),
            date: formatDate(node.completed_at || node.started_at || node.created_at),
            x,
            y,
            connections: connectionMap[node.id] || [],
          }
        })
      }

      setMilestones(calculatePositions(rawNodes))
    } catch (err) {
      console.error("Roadmap fetch error:", err)
      setError(err instanceof Error ? err.message : "데이터 로드 실패")
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: Milestone["status"]) => {
    switch (status) {
      case "completed":
        return { fill: "#10b981", stroke: "#34d399", glow: "rgba(16, 185, 129, 0.5)" }
      case "in_progress":
        return { fill: "#f59e0b", stroke: "#fbbf24", glow: "rgba(245, 158, 11, 0.5)" }
      case "upcoming":
        return {
          fill: isDark ? "#6b7280" : "#d4d4d8",
          stroke: isDark ? "#9ca3af" : "#a1a1aa",
          glow: "rgba(107, 114, 128, 0.3)"
        }
    }
  }

  // 통계 계산
  const completedCount = milestones.filter((m) => m.status === "completed").length
  const inProgressCount = milestones.filter((m) => m.status === "in_progress").length
  const upcomingCount = milestones.filter((m) => m.status === "upcoming").length
  const totalCount = milestones.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-sm"
    >
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl opacity-50 dark:opacity-100" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl opacity-50 dark:opacity-100" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl opacity-50 dark:opacity-100" />
      </div>

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(to right, ${isDark ? "#27272a" : "#e4e4e7"} 1px, transparent 1px),
            linear-gradient(to bottom, ${isDark ? "#27272a" : "#e4e4e7"} 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-sm">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">네트워크 로드맵</h2>
            <p className="text-xs text-zinc-500">마일스톤 연결 시각화</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-zinc-500 dark:text-zinc-400">완료</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-zinc-500 dark:text-zinc-400">진행중</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-zinc-400 dark:bg-zinc-500" />
            <span className="text-zinc-500 dark:text-zinc-400">예정</span>
          </div>
        </div>
      </div>

      {/* Network Graph */}
      <div className="relative z-10 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
            <AlertCircle className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">{error}</p>
          </div>
        ) : milestones.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
            <Target className="w-12 h-12 mb-3 opacity-40 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm mb-3">아직 등록된 마일스톤이 없습니다</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-600">로드맵 탭에서 마일스톤을 추가해보세요</p>
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox="0 0 620 300"
            className="w-full h-64"
            style={{ overflow: "visible" }}
          >
            <defs>
              {/* Gradient for connections */}
              <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3" />
              </linearGradient>

              {/* Glow filters */}
              <filter id="glowGreen" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="glowAmber" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Arrow marker */}
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#06b6d4" opacity="0.6" />
              </marker>
            </defs>

            {/* Connection Lines */}
            {milestones.map((milestone) =>
              milestone.connections.map((targetId) => {
                const target = milestones.find((m) => m.id === targetId)
                if (!target) return null

                const isHighlighted = hoveredNode === milestone.id || hoveredNode === targetId

                return (
                  <motion.line
                    key={`${milestone.id}-${targetId}`}
                    x1={milestone.x}
                    y1={milestone.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={isHighlighted ? "#06b6d4" : (isDark ? "#3f3f46" : "#e4e4e7")}
                    strokeWidth={isHighlighted ? 2 : 1}
                    strokeDasharray={milestone.status === "upcoming" ? "5,5" : undefined}
                    markerEnd="url(#arrowhead)"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: isHighlighted ? 1 : 0.5 }}
                    transition={{ duration: 1, delay: 0.5 }}
                  />
                )
              })
            )}

            {/* Animated particles on connections */}
            {milestones
              .filter((m) => m.status === "in_progress")
              .map((milestone) =>
                milestone.connections.map((targetId) => {
                  const target = milestones.find((m) => m.id === targetId)
                  if (!target) return null

                  return (
                    <motion.circle
                      key={`particle-${milestone.id}-${targetId}`}
                      r="3"
                      fill="#f59e0b"
                      filter="url(#glowAmber)"
                      initial={{ cx: milestone.x, cy: milestone.y }}
                      animate={{
                        cx: [milestone.x, target.x],
                        cy: [milestone.y, target.y],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                  )
                })
              )}

            {/* Milestone Nodes */}
            {milestones.map((milestone, idx) => {
              const colors = getStatusColor(milestone.status)
              const isHovered = hoveredNode === milestone.id

              return (
                <g
                  key={milestone.id}
                  onMouseEnter={() => setHoveredNode(milestone.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Outer glow ring */}
                  <motion.circle
                    cx={milestone.x}
                    cy={milestone.y}
                    r={isHovered ? 35 : 28}
                    fill="transparent"
                    stroke={colors.stroke}
                    strokeWidth="1"
                    strokeOpacity={isHovered ? 0.5 : 0.2}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                  />

                  {/* Pulse animation for in_progress */}
                  {milestone.status === "in_progress" && (
                    <motion.circle
                      cx={milestone.x}
                      cy={milestone.y}
                      r="28"
                      fill="transparent"
                      stroke={colors.stroke}
                      strokeWidth="2"
                      initial={{ scale: 1, opacity: 1 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}

                  {/* Main node circle */}
                  <motion.circle
                    cx={milestone.x}
                    cy={milestone.y}
                    r={isHovered ? 24 : 20}
                    fill={`${colors.fill}20`}
                    stroke={colors.stroke}
                    strokeWidth="2"
                    filter={milestone.status !== "upcoming" ? "url(#glowGreen)" : undefined}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: idx * 0.1, type: "spring" }}
                  />

                  {/* Inner circle */}
                  <motion.circle
                    cx={milestone.x}
                    cy={milestone.y}
                    r="8"
                    fill={colors.fill}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: idx * 0.1 + 0.2 }}
                  />

                  {/* Label */}
                  <motion.g
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 + 0.3 }}
                  >
                    <text
                      x={milestone.x}
                      y={milestone.y + 45}
                      textAnchor="middle"
                      className="fill-zinc-900 dark:fill-white text-xs font-medium"
                    >
                      {milestone.title}
                    </text>
                    {milestone.date && (
                      <text
                        x={milestone.x}
                        y={milestone.y + 60}
                        textAnchor="middle"
                        className="fill-zinc-500 text-[10px]"
                      >
                        {milestone.date}
                      </text>
                    )}
                  </motion.g>
                </g>
              )
            })}
          </svg>
        )}
      </div>

      {/* Progress Bar */}
      <div className="relative z-10 px-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500">전체 진행률</span>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            {totalCount > 0 ? `${progressPercent}%` : "-"}
          </span>
        </div>
        <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: totalCount > 0 ? `${progressPercent}%` : "0%" }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <CheckCircle2 className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
            <span>{completedCount} 완료</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
            <span>{inProgressCount} 진행중</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Target className="w-3 h-3 text-zinc-400" />
            <span>{upcomingCount} 예정</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
