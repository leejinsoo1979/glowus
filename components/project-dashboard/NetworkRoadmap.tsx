"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import {
  Rocket,
  Target,
  CheckCircle2,
  Circle,
  Sparkles,
  ArrowRight,
} from "lucide-react"

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

const sampleMilestones: Milestone[] = [
  { id: "1", title: "MVP 개발", status: "completed", date: "2024-01", x: 80, y: 150, connections: ["2", "3"] },
  { id: "2", title: "베타 런칭", status: "completed", date: "2024-03", x: 220, y: 80, connections: ["4"] },
  { id: "3", title: "팀 확장", status: "completed", date: "2024-04", x: 220, y: 220, connections: ["5"] },
  { id: "4", title: "시드 투자", status: "in_progress", date: "2024-06", x: 380, y: 120, connections: ["6"] },
  { id: "5", title: "파트너십", status: "in_progress", date: "2024-07", x: 380, y: 200, connections: ["6"] },
  { id: "6", title: "정식 런칭", status: "upcoming", date: "2024-09", x: 540, y: 150, connections: [] },
]

export function NetworkRoadmap({ projectId }: NetworkRoadmapProps) {
  const [milestones, setMilestones] = useState<Milestone[]>(sampleMilestones)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const getStatusColor = (status: Milestone["status"]) => {
    switch (status) {
      case "completed":
        return { fill: "#10b981", stroke: "#34d399", glow: "rgba(16, 185, 129, 0.5)" }
      case "in_progress":
        return { fill: "#f59e0b", stroke: "#fbbf24", glow: "rgba(245, 158, 11, 0.5)" }
      case "upcoming":
        return { fill: "#6b7280", stroke: "#9ca3af", glow: "rgba(107, 114, 128, 0.3)" }
    }
  }

  const getStatusIcon = (status: Milestone["status"]) => {
    switch (status) {
      case "completed":
        return CheckCircle2
      case "in_progress":
        return Sparkles
      case "upcoming":
        return Circle
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50"
    >
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(to right, #27272a 1px, transparent 1px),
            linear-gradient(to bottom, #27272a 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">네트워크 로드맵</h2>
            <p className="text-xs text-zinc-500">마일스톤 연결 시각화</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-zinc-400">완료</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-zinc-400">진행중</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-zinc-500" />
            <span className="text-zinc-400">예정</span>
          </div>
        </div>
      </div>

      {/* Network Graph */}
      <div className="relative z-10 p-4">
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
                  stroke={isHighlighted ? "#06b6d4" : "#3f3f46"}
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
                    className="fill-white text-xs font-medium"
                  >
                    {milestone.title}
                  </text>
                  <text
                    x={milestone.x}
                    y={milestone.y + 60}
                    textAnchor="middle"
                    className="fill-zinc-500 text-[10px]"
                  >
                    {milestone.date}
                  </text>
                </motion.g>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Progress Bar */}
      <div className="relative z-10 px-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500">전체 진행률</span>
          <span className="text-xs text-emerald-400 font-semibold">67%</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: "67%" }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>3 완료</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>2 진행중</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Target className="w-3 h-3 text-zinc-400" />
            <span>1 예정</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
