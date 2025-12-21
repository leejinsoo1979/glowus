'use client'

import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { ViewTab } from '@/lib/neural-map/types'
import {
  Network, // Map
  Activity, // Life Stream
  Database, // Data
  GitBranch, // Logic
  FlaskConical, // Test
} from 'lucide-react'

const viewTabs: { id: ViewTab; label: string; icon: typeof Network; description: string }[] = [
  { id: 'map', label: 'Map', icon: Network, description: '전체 노드 탐색 (2D/3D)' },
  { id: 'life-stream', label: 'Life Stream', icon: Activity, description: '전체 개발 현황 및 순서 (Blueprint)' },
  { id: 'data', label: 'Data', icon: Database, description: '데이터 구조 및 스키마' },
  { id: 'logic', label: 'Logic', icon: GitBranch, description: '로직 흐름 및 파일 구조' },
  { id: 'test', label: 'Test', icon: FlaskConical, description: '품질 검증 및 테스트' },
]

export function ViewTabs() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const activeTab = useNeuralMapStore((s) => s.activeTab)
  const setActiveTab = useNeuralMapStore((s) => s.setActiveTab)
  const headerCollapsed = useNeuralMapStore((s) => s.headerCollapsed)

  // 헤더가 접힌 상태면 ViewTabs도 숨김
  if (headerCollapsed) {
    return null
  }

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
