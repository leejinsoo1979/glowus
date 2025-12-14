"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Zap,
  AlertTriangle,
  TrendingUp,
  Activity,
  Bot,
  CheckCircle2,
  Clock,
  Target,
} from "lucide-react"
import { Button } from "@/components/ui/Button"

interface AIMetric {
  id: string
  type: "trigger" | "alert" | "insight"
  title: string
  value: string | number
  trend?: "up" | "down" | "stable"
  status?: "success" | "warning" | "danger"
  icon?: typeof Zap
}

interface AICommandCenterProps {
  projectId: string
}

export function AICommandCenter({ projectId }: AICommandCenterProps) {
  const [metrics, setMetrics] = useState<AIMetric[]>([])
  const [pulseActive, setPulseActive] = useState(true)

  useEffect(() => {
    // Sample metrics - replace with actual API
    setMetrics([
      {
        id: "1",
        type: "trigger",
        title: "AI 트리거",
        value: "오늘 5건 자동 연결",
        status: "success",
        icon: Zap,
      },
      {
        id: "2",
        type: "alert",
        title: "AI 감시견",
        value: "박개발 과부하!",
        status: "warning",
        icon: AlertTriangle,
      },
      {
        id: "3",
        type: "insight",
        title: "AI 분석 인사이트",
        value: "속도 20% 증가",
        trend: "up",
        status: "success",
        icon: TrendingUp,
      },
    ])

    // Pulse animation
    const interval = setInterval(() => {
      setPulseActive((prev) => !prev)
    }, 2000)

    return () => clearInterval(interval)
  }, [projectId])

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden"
    >
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-purple-900/20 to-cyan-900/20 rounded-2xl" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />

      {/* Animated Border */}
      <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-r from-blue-500/50 via-purple-500/50 to-cyan-500/50">
        <div className="absolute inset-0 rounded-2xl bg-zinc-950" />
      </div>

      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            {pulseActive && (
              <motion.div
                initial={{ scale: 0.8, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 rounded-xl bg-blue-500/30"
              />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              AI 관제탑
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            </h2>
            <p className="text-xs text-zinc-500">실시간 AI 모니터링</p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.map((metric, idx) => {
            const Icon = metric.icon || Activity

            return (
              <motion.div
                key={metric.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`relative group cursor-pointer overflow-hidden rounded-xl p-4 ${
                  metric.status === "warning"
                    ? "bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/30"
                    : metric.status === "danger"
                    ? "bg-gradient-to-br from-red-500/10 to-pink-500/5 border border-red-500/30"
                    : "bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 border border-emerald-500/30"
                }`}
              >
                {/* Glow Effect */}
                <div
                  className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
                    metric.status === "warning"
                      ? "bg-amber-500/5"
                      : metric.status === "danger"
                      ? "bg-red-500/5"
                      : "bg-emerald-500/5"
                  }`}
                />

                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        metric.status === "warning"
                          ? "bg-amber-500/20"
                          : metric.status === "danger"
                          ? "bg-red-500/20"
                          : "bg-emerald-500/20"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 ${
                          metric.status === "warning"
                            ? "text-amber-400"
                            : metric.status === "danger"
                            ? "text-red-400"
                            : "text-emerald-400"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">{metric.title}</p>
                      <p className="text-sm font-semibold text-white">{metric.value}</p>
                    </div>
                  </div>

                  {/* Trend/Activity Indicator */}
                  {metric.type === "trigger" && (
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <motion.div
                          key={i}
                          animate={{
                            height: [8, 16, 24, 16, 8][i % 5],
                          }}
                          transition={{
                            duration: 0.5,
                            repeat: Infinity,
                            delay: i * 0.1,
                          }}
                          className="w-1 bg-gradient-to-t from-blue-500 to-cyan-400 rounded-full"
                        />
                      ))}
                    </div>
                  )}

                  {metric.type === "alert" && (
                    <Button variant="outline" size="sm" className="text-xs h-7 border-amber-500/50 text-amber-400 hover:bg-amber-500/10">
                      Resolve
                    </Button>
                  )}

                  {metric.trend && (
                    <div className="flex items-center">
                      <svg
                        viewBox="0 0 100 40"
                        className="w-16 h-8"
                      >
                        <path
                          d="M0,35 Q25,30 50,20 T100,5"
                          fill="none"
                          stroke={metric.trend === "up" ? "#10b981" : "#ef4444"}
                          strokeWidth="2"
                        />
                        <path
                          d="M0,35 Q25,30 50,20 T100,5 L100,40 L0,40 Z"
                          fill={`url(#gradient-${metric.id})`}
                          opacity="0.3"
                        />
                        <defs>
                          <linearGradient id={`gradient-${metric.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor={metric.trend === "up" ? "#10b981" : "#ef4444"} />
                            <stop offset="100%" stopColor="transparent" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Quick Stats Bar */}
        <div className="mt-4 pt-4 border-t border-zinc-800/50 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-zinc-400">완료 <span className="text-white font-semibold">12</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-zinc-400">진행중 <span className="text-white font-semibold">5</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-zinc-400">목표 <span className="text-white font-semibold">20</span></span>
            </div>
          </div>
          <div className="text-xs text-zinc-500">
            마지막 동기화: <span className="text-zinc-400">방금 전</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
