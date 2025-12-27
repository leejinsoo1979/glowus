'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  Circle,
  Zap,
  GitBranch,
  ExternalLink,
  RefreshCw,
  Play,
  Pause
} from 'lucide-react'
import type { BlueprintProgress, BlueprintNode } from '@/lib/neural-map/blueprint-sync'

interface BlueprintProgressWidgetProps {
  mapId?: string
  className?: string
}

interface BlueprintData {
  mapId: string
  mapTitle: string
  progress: BlueprintProgress
  nodes: BlueprintNode[]
}

export function BlueprintProgressWidget({ mapId, className }: BlueprintProgressWidgetProps) {
  const [data, setData] = useState<BlueprintData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const fetchBlueprint = async (targetMapId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/neural-map/${targetMapId}/blueprint`)
      if (!response.ok) throw new Error('Failed to fetch')

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  // 자동 갱신 (10초마다)
  useEffect(() => {
    if (!mapId) return

    fetchBlueprint(mapId)

    const interval = setInterval(() => {
      fetchBlueprint(mapId)
    }, 10000)

    return () => clearInterval(interval)
  }, [mapId])

  // Blueprint 업데이트 이벤트 리스닝
  useEffect(() => {
    const handleUpdate = () => {
      if (mapId) fetchBlueprint(mapId)
    }

    window.addEventListener('blueprint-updated', handleUpdate)
    return () => window.removeEventListener('blueprint-updated', handleUpdate)
  }, [mapId])

  const handleStartAgent = async () => {
    if (!mapId) return

    setIsRunning(true)
    try {
      await fetch(`/api/neural-map/${mapId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
    } catch (err) {
      console.error(err)
      setIsRunning(false)
    }
  }

  const handlePauseAgent = async () => {
    if (!mapId) return

    try {
      await fetch(`/api/neural-map/${mapId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' }),
      })
      setIsRunning(false)
    } catch (err) {
      console.error(err)
    }
  }

  if (!mapId) {
    return (
      <div className={cn(
        "p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800",
        className
      )}>
        <div className="text-center text-zinc-500 py-8">
          <Circle size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No Blueprint selected</p>
          <p className="text-xs mt-1">Open a Neural Map to see progress</p>
        </div>
      </div>
    )
  }

  if (isLoading && !data) {
    return (
      <div className={cn(
        "p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800",
        className
      )}>
        <div className="flex items-center justify-center py-8">
          <RefreshCw size={24} className="animate-spin text-cyan-500" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn(
        "p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800",
        className
      )}>
        <div className="text-center text-red-400 py-8">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!data || !data.progress) {
    return (
      <div className={cn(
        "p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800",
        className
      )}>
        <div className="text-center text-zinc-500 py-8">
          <Circle size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No Blueprint data</p>
        </div>
      </div>
    )
  }

  const { progress, nodes, mapTitle } = data
  const currentTask = nodes.find(n => n.status === 'doing')

  return (
    <div className={cn(
      "p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white flex items-center gap-2">
            <GitBranch size={16} className="text-cyan-500" />
            Blueprint Progress
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">{mapTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={isRunning ? handlePauseAgent : handleStartAgent}
            className={cn(
              "p-2 rounded-lg transition-colors",
              isRunning
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
            )}
          >
            {isRunning ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            onClick={() => fetchBlueprint(mapId)}
            disabled={isLoading}
            className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Progress Ring */}
      <div className="flex items-center gap-6 mb-6">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#27272a"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <motion.circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="url(#gradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${progress.percentage * 2.83} 283`}
              initial={{ strokeDasharray: "0 283" }}
              animate={{ strokeDasharray: `${progress.percentage * 2.83} 283` }}
              transition={{ duration: 1 }}
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">{progress.percentage}%</span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 size={14} />
              Done
            </span>
            <span className="font-mono text-white">{progress.done}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Zap size={14} />
              Doing
            </span>
            <span className="font-mono text-white">{progress.doing}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-zinc-500">
              <Circle size={14} />
              Todo
            </span>
            <span className="font-mono text-white">{progress.todo}</span>
          </div>
        </div>
      </div>

      {/* Current Task */}
      {currentTask && (
        <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 mb-4">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse mt-1.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-cyan-300 truncate">
                {currentTask.title}
              </p>
              {currentTask.description && (
                <p className="text-xs text-cyan-400/60 truncate mt-0.5">
                  {currentTask.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task List (최근 5개) */}
      <div className="space-y-1.5">
        {nodes.slice(0, 5).map((node) => (
          <div
            key={node.id}
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg text-xs transition-colors",
              node.status === 'done' && "bg-emerald-500/10 text-emerald-400",
              node.status === 'doing' && "bg-cyan-500/10 text-cyan-400",
              node.status === 'todo' && "bg-zinc-800/50 text-zinc-500"
            )}
          >
            {node.status === 'done' && <CheckCircle2 size={12} />}
            {node.status === 'doing' && <Zap size={12} className="animate-pulse" />}
            {node.status === 'todo' && <Circle size={12} />}
            <span className="truncate flex-1">{node.title}</span>
            {node.gitCommit && (
              <span className="font-mono text-[10px] opacity-60">
                {node.gitCommit.slice(0, 7)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* View All Link */}
      {nodes.length > 5 && (
        <button
          onClick={() => window.open(`/dashboard-group/neural-map?mapId=${mapId}&tab=life-stream`, '_blank')}
          className="flex items-center justify-center gap-1 w-full mt-3 py-2 text-xs text-zinc-400 hover:text-cyan-400 transition-colors"
        >
          View all {nodes.length} tasks
          <ExternalLink size={10} />
        </button>
      )}

      {/* Estimated Time */}
      {progress.estimatedHoursRemaining && progress.estimatedHoursRemaining > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-800 text-center">
          <p className="text-xs text-zinc-500">
            Estimated: <span className="text-cyan-400">{progress.estimatedHoursRemaining}h</span> remaining
          </p>
        </div>
      )}
    </div>
  )
}

export default BlueprintProgressWidget
