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
import { InspectorPanel } from '@/components/neural-map/panels/InspectorPanel'
import { MarkdownEditorPanel } from '@/components/neural-map/panels/MarkdownEditorPanel'

// Controls
import { Toolbar } from '@/components/neural-map/controls/Toolbar'
import { ViewTabs } from '@/components/neural-map/controls/ViewTabs'
import { StatusBar } from '@/components/neural-map/controls/StatusBar'

// Modals
import { NodeEditorModal } from '@/components/neural-map/modals/NodeEditorModal'
import { EdgeEditorModal } from '@/components/neural-map/modals/EdgeEditorModal'

// Lucide Icons
import {
  Loader2,
  ChevronDown,
} from 'lucide-react'

// Dynamically import 3D Canvas (uses browser APIs)
const NeuralMapCanvas = dynamic(
  () => import('@/components/neural-map/canvas/NeuralMapCanvas').then((mod) => mod.NeuralMapCanvas),
  {
    ssr: false,
    loading: () => <CanvasLoadingFallback />,
  }
)

// Dynamically import 2D Graph (Obsidian style)
const Graph2DView = dynamic(
  () => import('@/components/neural-map/canvas/Graph2DView').then((mod) => mod.Graph2DView),
  {
    ssr: false,
    loading: () => <CanvasLoadingFallback />,
  }
)

// Dynamically import Cosmic Force Graph (3D universe style)
const CosmicForceGraph = dynamic(
  () => import('@/components/neural-map/canvas/CosmicForceGraph').then((mod) => mod.CosmicForceGraph),
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
    mapId,
    setMapId,
    graph,
    isLoading,
    error,
    rightPanelWidth,
    rightPanelCollapsed,
    headerCollapsed,
    toggleHeader,
    setGraph,
    setLoading,
    setError,
    setFiles,
    currentTheme,
    modalType,
    closeModal,
    activeTab,
    editorOpen,
    editorCollapsed,
    closeEditor,
    toggleEditorCollapse,
  } = useNeuralMapStore()

  const isDark = mounted ? resolvedTheme === 'dark' : true

  useEffect(() => {
    setMounted(true)
  }, [])

  // Load or create neural map
  useEffect(() => {
    const loadOrCreateMap = async () => {
      setLoading(true)
      try {
        // 1. 기존 맵 목록 조회
        const listRes = await fetch('/api/neural-map')
        const maps = await listRes.json()

        let targetMapId: string

        if (Array.isArray(maps) && maps.length > 0) {
          // 가장 최근 맵 사용
          targetMapId = maps[0].id
        } else {
          // 2. 맵이 없으면 새로 생성
          const createRes = await fetch('/api/neural-map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'My Neural Map' }),
          })

          if (!createRes.ok) {
            throw new Error('Failed to create neural map')
          }

          const newMap = await createRes.json()
          targetMapId = newMap.id
        }

        setMapId(targetMapId)

        // 3. 맵 전체 데이터 로드
        const mapRes = await fetch(`/api/neural-map/${targetMapId}`)
        if (!mapRes.ok) {
          throw new Error('Failed to load neural map')
        }

        const { graph: graphData, files } = await mapRes.json()
        setGraph(graphData)
        setFiles(files || [])
      } catch (err) {
        console.error('Neural map load error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load graph')
      } finally {
        setLoading(false)
      }
    }

    if (mounted) {
      loadOrCreateMap()
    }
  }, [mounted, setGraph, setFiles, setLoading, setError, setMapId])

  if (!mounted) {
    return null
  }

  return (
    <div className={cn('h-full flex flex-col overflow-hidden', isDark ? 'bg-zinc-950' : 'bg-zinc-50')}>
      {/* Collapsed Header Bar - 접힌 상태일 때만 표시 */}
      {headerCollapsed && (
        <div
          className={cn(
            'border-b flex-shrink-0',
            isDark ? 'bg-zinc-900/95 border-zinc-800' : 'bg-white border-zinc-200'
          )}
        >
          <button
            onClick={toggleHeader}
            className={cn(
              'w-full h-8 flex items-center justify-center gap-2 transition-colors',
              isDark
                ? 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                : 'hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600'
            )}
          >
            <ChevronDown className="w-4 h-4" />
            <span className="text-xs">헤더 펼치기</span>
          </button>
        </div>
      )}

      {/* Toolbar */}
      <Toolbar />

      {/* Main Content - 2 Panel Layout (Left sidebar is in TwoLevelSidebar) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Center - 3D Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* View Tabs */}
          <ViewTabs />

          {/* Canvas Area */}
          <div className="flex-1 relative">
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
            ) : activeTab === 'graph2d' ? (
              <Graph2DView className="absolute inset-0" />
            ) : activeTab === 'cosmic' ? (
              <CosmicForceGraph className="absolute inset-0" />
            ) : (
              <NeuralMapCanvas className="absolute inset-0" />
            )}
          </div>
        </div>

        {/* Markdown Editor Panel */}
        <MarkdownEditorPanel
          isOpen={editorOpen}
          onClose={closeEditor}
          isCollapsed={editorCollapsed}
          onToggleCollapse={toggleEditorCollapse}
        />

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

      {/* Modals */}
      {modalType === 'nodeEditor' && (
        <NodeEditorModal mapId={mapId} onClose={closeModal} />
      )}
      {modalType === 'export' && (
        <EdgeEditorModal mapId={mapId} onClose={closeModal} />
      )}
    </div>
  )
}
