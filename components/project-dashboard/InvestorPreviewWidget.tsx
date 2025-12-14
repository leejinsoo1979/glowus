"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Eye,
  Minus,
  X,
  TrendingUp,
  Users,
  DollarSign,
} from "lucide-react"

interface InvestorPreviewWidgetProps {
  projectId: string
  projectName: string
}

export function InvestorPreviewWidget({ projectId, projectName }: InvestorPreviewWidgetProps) {
  const [isMinimized, setIsMinimized] = useState(false)

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors"
      >
        <Eye className="w-4 h-4 text-cyan-400" />
        <span className="text-sm text-white">투자자 뷰</span>
      </button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      className="w-72 rounded-xl border border-zinc-800 bg-zinc-900/95 backdrop-blur-xl overflow-hidden"
      style={{
        boxShadow: "0 0 40px rgba(6, 182, 212, 0.1)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-white">투자자 뷰 미리보기</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded hover:bg-zinc-800 transition-colors"
          >
            <Minus className="w-3 h-3 text-zinc-500" />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded hover:bg-zinc-800 transition-colors"
          >
            <X className="w-3 h-3 text-zinc-500" />
          </button>
        </div>
      </div>

      {/* Chart Area */}
      <div className="p-4">
        <div className="h-32 relative">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 to-transparent rounded-lg" />

          {/* SVG Chart */}
          <svg viewBox="0 0 280 120" className="w-full h-full">
            <defs>
              <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Grid Lines */}
            {[...Array(5)].map((_, i) => (
              <line
                key={i}
                x1="0"
                y1={i * 30}
                x2="280"
                y2={i * 30}
                stroke="#27272a"
                strokeWidth="1"
              />
            ))}

            {/* Area Fill */}
            <path
              d="M0,100 Q40,95 80,85 T160,60 T240,40 T280,20 L280,120 L0,120 Z"
              fill="url(#chartGradient)"
            />

            {/* Main Line */}
            <motion.path
              d="M0,100 Q40,95 80,85 T160,60 T240,40 T280,20"
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2"
              filter="url(#glow)"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, ease: "easeInOut" }}
            />

            {/* Purple Secondary Line */}
            <motion.path
              d="M0,110 Q40,100 80,95 T160,80 T240,65 T280,50"
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, delay: 0.5, ease: "easeInOut" }}
            />

            {/* Data Points */}
            <motion.circle
              cx="280"
              cy="20"
              r="4"
              fill="#06b6d4"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 2 }}
            />
          </svg>

          {/* Legend */}
          <div className="absolute bottom-2 right-2 flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-cyan-400 rounded" />
              <span className="text-zinc-500">성장률</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-purple-500 rounded" style={{ borderStyle: "dashed" }} />
              <span className="text-zinc-500">목표</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 pb-4 space-y-3">
        <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/50">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-zinc-400">성장률</span>
          </div>
          <span className="text-sm font-semibold text-emerald-400">+24%</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/50">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-zinc-400">팀 효율</span>
          </div>
          <span className="text-sm font-semibold text-blue-400">87%</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/50">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-zinc-400">ROI 예측</span>
          </div>
          <span className="text-sm font-semibold text-amber-400">3.2x</span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4">
        <button className="w-full py-2 text-xs font-medium text-cyan-400 bg-cyan-500/10 rounded-lg hover:bg-cyan-500/20 transition-colors">
          전체 투자자 뷰 열기
        </button>
      </div>
    </motion.div>
  )
}
