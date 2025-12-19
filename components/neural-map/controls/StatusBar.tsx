'use client'

import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import {
  Circle,
  GitBranch,
  Layers,
  Clock,
  Wifi,
  WifiOff,
} from 'lucide-react'

export function StatusBar() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const graph = useNeuralMapStore((s) => s.graph)
  const isSimulationRunning = useNeuralMapStore((s) => s.isSimulationRunning)
  const simulationAlpha = useNeuralMapStore((s) => s.simulationAlpha)

  const nodeCount = graph?.nodes.length || 0
  const edgeCount = graph?.edges.length || 0
  const clusterCount = graph?.clusters.length || 0

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '방금 전'
    if (minutes < 60) return `${minutes}분 전`
    if (hours < 24) return `${hours}시간 전`
    return `${days}일 전`
  }

  return (
    <div
      className={cn(
        'h-8 flex items-center justify-between px-4 border-t text-xs',
        isDark ? 'bg-zinc-900/95 border-zinc-800 text-zinc-500' : 'bg-white border-zinc-200 text-zinc-500'
      )}
    >
      {/* Left: Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Circle className="w-3 h-3" />
          <span>Nodes: {nodeCount.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <GitBranch className="w-3 h-3" />
          <span>Edges: {edgeCount.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Layers className="w-3 h-3" />
          <span>Clusters: {clusterCount}</span>
        </div>
      </div>

      {/* Center: Simulation Status */}
      <div className="flex items-center gap-2">
        {isSimulationRunning && simulationAlpha > 0.01 ? (
          <>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Simulation: {Math.round(simulationAlpha * 100)}%</span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 rounded-full bg-zinc-500" />
            <span>Simulation: Idle</span>
          </>
        )}
      </div>

      {/* Right: Last saved */}
      <div className="flex items-center gap-4">
        {graph?.updatedAt && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>Last saved: {formatDate(graph.updatedAt)}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Wifi className="w-3 h-3 text-green-500" />
          <span>Connected</span>
        </div>
      </div>
    </div>
  )
}
