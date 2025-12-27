'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { ViewTab, MermaidDiagramType } from '@/lib/neural-map/types'
import {
  Network, // Map
  Activity, // Life Stream
  Bot, // Agent Builder
  Database, // Data
  GitBranch, // Logic
  FlaskConical, // Test
  Globe, // Browser
  GitCommit, // Git
  ChevronDown,
  Workflow, // Flowchart
  ArrowLeftRight, // Sequence
  Boxes, // Class
  TableProperties, // ER
  PieChart, // Pie
  CircleDot, // State
  GitFork, // GitGraph
} from 'lucide-react'

const viewTabs: { id: ViewTab; label: string; icon: typeof Network; description: string }[] = [
  { id: 'map', label: 'Map', icon: Network, description: '전체 노드 탐색 (2D/3D)' },
  { id: 'life-stream', label: 'Blueprint', icon: Activity, description: '전체 개발 현황 및 순서 (Blueprint)' },
  { id: 'agent-builder', label: 'Agent', icon: Bot, description: 'AI 에이전트 워크플로우 빌더' },
  { id: 'data', label: 'Data', icon: Database, description: '데이터 구조 및 스키마' },
  { id: 'logic', label: 'Logic', icon: GitBranch, description: '로직 흐름 및 파일 구조' },
  { id: 'test', label: 'Test', icon: FlaskConical, description: '품질 검증 및 테스트' },
  { id: 'browser', label: 'Browser', icon: Globe, description: '웹 브라우저' },
  { id: 'git', label: 'Git', icon: GitCommit, description: 'Git 버전 관리' },
]

const mermaidDiagrams: { id: MermaidDiagramType; label: string; icon: typeof Workflow; description: string }[] = [
  { id: 'flowchart', label: 'Flowchart', icon: Workflow, description: '코드 의존성 그래프' },
  { id: 'sequence', label: 'Sequence', icon: ArrowLeftRight, description: '시퀀스 다이어그램 (인터랙티브)' },
  { id: 'class', label: 'Class', icon: Boxes, description: '클래스 다이어그램 (인터랙티브)' },
  { id: 'er', label: 'ER', icon: TableProperties, description: 'ER 다이어그램 (인터랙티브)' },
  { id: 'pie', label: 'Pie', icon: PieChart, description: '파일 분포 차트 (인터랙티브)' },
  { id: 'state', label: 'State', icon: CircleDot, description: '상태 다이어그램 (인터랙티브)' },
  { id: 'gitgraph', label: 'GitGraph', icon: GitFork, description: 'Git 그래프 (인터랙티브)' },
]

export function ViewTabs() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const activeTab = useNeuralMapStore((s) => s.activeTab)
  const setActiveTab = useNeuralMapStore((s) => s.setActiveTab)
  const mermaidDiagramType = useNeuralMapStore((s) => s.mermaidDiagramType)
  const setMermaidDiagramType = useNeuralMapStore((s) => s.setMermaidDiagramType)
  const headerCollapsed = useNeuralMapStore((s) => s.headerCollapsed)

  const [mermaidDropdownOpen, setMermaidDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMermaidDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (headerCollapsed) {
    return null
  }

  const currentMermaidDiagram = mermaidDiagrams.find(d => d.id === mermaidDiagramType) || mermaidDiagrams[0]
  const isMermaidActive = activeTab === 'mermaid'

  return (
    <div
      className={cn(
        'flex items-center justify-start gap-1 h-full px-4 border-b electron-drag overflow-x-auto overflow-y-hidden min-w-0 scrollbar-hide',
        isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/80 border-zinc-200'
      )}
    >
      {/* Regular tabs - only Map first */}
      <button
        onClick={() => setActiveTab('map')}
        className={cn(
          'relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors electron-no-drag flex-shrink-0',
          activeTab === 'map'
            ? isDark ? 'text-zinc-100' : 'text-zinc-900'
            : isDark
              ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100/50'
        )}
        title="전체 노드 탐색 (2D/3D)"
      >
        {activeTab === 'map' && (
          <motion.div
            layoutId="activeViewTab"
            className={cn('absolute inset-0 rounded-md', isDark ? 'bg-zinc-800' : 'bg-zinc-100')}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
        <Network className="relative w-4 h-4" />
        <span className="relative">Map</span>
      </button>

      {/* Mermaid Dropdown */}
      <div ref={dropdownRef} className="relative electron-no-drag flex-shrink-0">
        <button
          onClick={() => {
            if (isMermaidActive) {
              setMermaidDropdownOpen(!mermaidDropdownOpen)
            } else {
              setActiveTab('mermaid')
              setMermaidDropdownOpen(true)
            }
          }}
          className={cn(
            'relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            isMermaidActive
              ? isDark ? 'text-zinc-100' : 'text-zinc-900'
              : isDark
                ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100/50'
          )}
          title="Mermaid 다이어그램"
        >
          {isMermaidActive && (
            <motion.div
              layoutId="activeViewTab"
              className={cn('absolute inset-0 rounded-md', isDark ? 'bg-zinc-800' : 'bg-zinc-100')}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          <currentMermaidDiagram.icon className="relative w-4 h-4" />
          <span className="relative">{currentMermaidDiagram.label}</span>
          <ChevronDown className={cn(
            "relative w-3 h-3 transition-transform",
            mermaidDropdownOpen && "rotate-180"
          )} />
        </button>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {mermaidDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'absolute top-full left-0 mt-1 py-1 rounded-lg shadow-lg border z-50 min-w-[160px]',
                isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'
              )}
            >
              {mermaidDiagrams.map((diagram) => {
                const isSelected = mermaidDiagramType === diagram.id
                return (
                  <button
                    key={diagram.id}
                    onClick={() => {
                      setMermaidDiagramType(diagram.id)
                      setActiveTab('mermaid')
                      setMermaidDropdownOpen(false)
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors',
                      isSelected
                        ? isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900'
                        : isDark
                          ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                    )}
                    title={diagram.description}
                  >
                    <diagram.icon className="w-4 h-4" />
                    <span>{diagram.label}</span>
                    {isSelected && (
                      <span className={cn(
                        "ml-auto text-[10px] px-1.5 py-0.5 rounded",
                        isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"
                      )}>
                        Active
                      </span>
                    )}
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Rest of the tabs */}
      {viewTabs.slice(1).map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors electron-no-drag flex-shrink-0',
              isActive
                ? isDark ? 'text-zinc-100' : 'text-zinc-900'
                : isDark
                  ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                  : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100/50'
            )}
            title={tab.description}
          >
            {isActive && (
              <motion.div
                layoutId="activeViewTab"
                className={cn('absolute inset-0 rounded-md', isDark ? 'bg-zinc-800' : 'bg-zinc-100')}
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
