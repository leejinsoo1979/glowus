'use client'

import { useEffect, useState, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { PANEL_SIZES, THEME_PRESETS } from '@/lib/neural-map/constants'
import type { NeuralGraph, NeuralNode, ViewTab } from '@/lib/neural-map/types'

// Panels
import { FileTreePanel } from '@/components/neural-map/panels/FileTreePanel'
import { InspectorPanel } from '@/components/neural-map/panels/InspectorPanel'

// Controls
import { Toolbar } from '@/components/neural-map/controls/Toolbar'
import { ViewTabs } from '@/components/neural-map/controls/ViewTabs'
import { StatusBar } from '@/components/neural-map/controls/StatusBar'

// Lucide Icons
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Loader2,
} from 'lucide-react'

// Dynamically import 3D Canvas (uses browser APIs)
const NeuralMapCanvas = dynamic(
  () => import('@/components/neural-map/canvas/NeuralMapCanvas').then((mod) => mod.NeuralMapCanvas),
  {
    ssr: false,
    loading: () => <CanvasLoadingFallback />,
  }
)

// Loading fallback for canvas
function CanvasLoadingFallback() {
  const currentTheme = useNeuralMapStore((s) => s.currentTheme)

  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        background: `linear-gradient(135deg, ${currentTheme.background.gradient[0]}, ${currentTheme.background.gradient[1]})`,
      }}
    >
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-zinc-400 mx-auto" />
        <p className="text-zinc-400 text-sm">3D 뉴럴맵 로딩중...</p>
      </div>
    </div>
  )
}

export default function NeuralMapPage() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Store
  const {
    graph,
    isLoading,
    error,
    leftPanelWidth,
    rightPanelWidth,
    leftPanelCollapsed,
    rightPanelCollapsed,
    activeTab,
    toggleLeftPanel,
    toggleRightPanel,
    setGraph,
    setLoading,
    setError,
    currentTheme,
  } = useNeuralMapStore()

  const isDark = mounted ? resolvedTheme === 'dark' : true

  useEffect(() => {
    setMounted(true)
  }, [])

  // Load initial graph (mock for now)
  useEffect(() => {
    const loadGraph = async () => {
      setLoading(true)
      try {
        // TODO: Replace with actual API call
        // const res = await fetch('/api/neural-map')
        // const data = await res.json()
        // setGraph(data)

        // Mock data for now
        const mockGraph: NeuralGraph = {
          version: '2.0',
          userId: 'mock-user',
          rootNodeId: 'self-node',
          title: 'My Neural Map',
          nodes: [
            {
              id: 'self-node',
              type: 'self',
              title: 'SELF',
              summary: '나의 중심 노드',
              tags: [],
              importance: 10,
              expanded: true,
              pinned: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              position: { x: 0, y: 0, z: 0 },
            },
          ],
          edges: [],
          clusters: [],
          viewState: {
            activeTab: 'radial',
            expandedNodeIds: ['self-node'],
            pinnedNodeIds: ['self-node'],
            selectedNodeIds: [],
            cameraPosition: { x: 0, y: 50, z: 200 },
            cameraTarget: { x: 0, y: 0, z: 0 },
          },
          themeId: 'cosmic-dark',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setGraph(mockGraph)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load graph')
      } finally {
        setLoading(false)
      }
    }

    loadGraph()
  }, [setGraph, setLoading, setError])

  if (!mounted) {
    return null
  }

  return (
    <div className={cn('h-screen flex flex-col overflow-hidden', isDark ? 'bg-zinc-950' : 'bg-zinc-50')}>
      {/* Toolbar */}
      <Toolbar />

      {/* Main Content - 3 Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - File Tree */}
        <AnimatePresence initial={false}>
          {!leftPanelCollapsed && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: leftPanelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'h-full border-r flex-shrink-0 overflow-hidden',
                isDark ? 'bg-zinc-900/95 border-zinc-800' : 'bg-white border-zinc-200'
              )}
            >
              <FileTreePanel />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Left Panel Toggle */}
        <button
          onClick={toggleLeftPanel}
          className={cn(
            'absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-r-lg transition-all',
            isDark
              ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600',
            !leftPanelCollapsed && `left-[${leftPanelWidth}px]`
          )}
          style={{ left: leftPanelCollapsed ? 0 : leftPanelWidth }}
        >
          {leftPanelCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        {/* Center - 3D Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* View Tabs */}
          <ViewTabs />

          {/* Canvas Area */}
          <div className="flex-1 relative overflow-hidden">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <p className="text-red-500">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm"
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            ) : (
              <NeuralMapCanvas className="absolute inset-0" />
            )}
          </div>
        </div>

        {/* Right Panel Toggle */}
        <button
          onClick={toggleRightPanel}
          className={cn(
            'absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-l-lg transition-all',
            isDark
              ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
          )}
          style={{ right: rightPanelCollapsed ? 0 : rightPanelWidth }}
        >
          {rightPanelCollapsed ? (
            <PanelRightOpen className="w-4 h-4" />
          ) : (
            <PanelRightClose className="w-4 h-4" />
          )}
        </button>

        {/* Right Panel - Inspector/Actions/Chat */}
        <AnimatePresence initial={false}>
          {!rightPanelCollapsed && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: rightPanelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'h-full border-l flex-shrink-0 overflow-hidden',
                isDark ? 'bg-zinc-900/95 border-zinc-800' : 'bg-white border-zinc-200'
              )}
            >
              <InspectorPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  )
}
