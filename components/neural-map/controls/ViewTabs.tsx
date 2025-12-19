'use client'

import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { ViewTab } from '@/lib/neural-map/types'
import {
  Circle,
  Layers,
  Route,
  Map,
  Lightbulb,
} from 'lucide-react'

const viewTabs: { id: ViewTab; label: string; icon: typeof Circle; description: string }[] = [
  { id: 'radial', label: 'Radial', icon: Circle, description: '방사형 맵' },
  { id: 'clusters', label: 'Clusters', icon: Layers, description: '주제 군집' },
  { id: 'pathfinder', label: 'Pathfinder', icon: Route, description: '경로 탐색' },
  { id: 'roadmap', label: 'Roadmap', icon: Map, description: '로드뷰' },
  { id: 'insights', label: 'Insights', icon: Lightbulb, description: '분석 리포트' },
]

export function ViewTabs() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const activeTab = useNeuralMapStore((s) => s.activeTab)
  const setActiveTab = useNeuralMapStore((s) => s.setActiveTab)

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1 py-2 px-4 border-b',
        isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/80 border-zinc-200'
      )}
    >
      {viewTabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? isDark
                  ? 'text-zinc-100'
                  : 'text-zinc-900'
                : isDark
                ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100/50'
            )}
            title={tab.description}
          >
            {isActive && (
              <motion.div
                layoutId="activeViewTab"
                className={cn(
                  'absolute inset-0 rounded-lg',
                  isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                )}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <tab.icon className="relative w-4 h-4" />
            <span className="relative">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
