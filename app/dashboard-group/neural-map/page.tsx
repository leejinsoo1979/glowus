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

// Controls
import { Toolbar } from '@/components/neural-map/controls/Toolbar'
import { ViewTabs } from '@/components/neural-map/controls/ViewTabs'
import { StatusBar } from '@/components/neural-map/controls/StatusBar'

// Modals
import { NodeEditorModal } from '@/components/neural-map/modals/NodeEditorModal'
import { EdgeEditorModal } from '@/components/neural-map/modals/EdgeEditorModal'

// Lucide Icons
import {
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
    mapId,
    setMapId,
    graph,
    isLoading,
    error,
    rightPanelWidth,
    rightPanelCollapsed,
    toggleRightPanel,
    setGraph,
    setLoading,
    setError,
    setFiles,
    currentTheme,
    modalType,
    closeModal,
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
            ) : (
              <NeuralMapCanvas className="absolute inset-0" />
            )}
          </div>
        </div>

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

        {/* Right Panel Toggle Button */}
        <button
          onClick={toggleRightPanel}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-l-lg transition-all',
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
