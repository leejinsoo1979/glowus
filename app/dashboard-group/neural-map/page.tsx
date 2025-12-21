'use client'

import { useEffect, useState, Suspense, useCallback, useRef } from 'react'
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
import { CodePreviewPanel } from '@/components/neural-map/panels/CodePreviewPanel'

// Controls
import { ViewTabs } from '@/components/neural-map/controls/ViewTabs'
import { StatusBar } from '@/components/neural-map/controls/StatusBar'

// Modals
import { NodeEditorModal } from '@/components/neural-map/modals/NodeEditorModal'
import { EdgeEditorModal } from '@/components/neural-map/modals/EdgeEditorModal'

// Lucide Icons
import {
  Loader2,
  PanelRightClose,
  PanelRightOpen,
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
  () => import('@/components/neural-map/canvas/Graph2DView').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <CanvasLoadingFallback />,
  }
)

// Dynamically import Cosmic Force Graph (3D universe style)
const CosmicForceGraph = dynamic(
  () => import('@/components/neural-map/canvas/CosmicForceGraph').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <CanvasLoadingFallback />,
  }
)

// Dynamically import Logic Flow (React Flow based Tree)
const LogicFlow = dynamic(
  () => import('@/components/neural-map/canvas/logic/LogicFlow').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <CanvasLoadingFallback />,
  }
)

// Dynamically import Schema View (database ERD)
const SchemaView = dynamic(
  () => import('@/components/neural-map/canvas/SchemaView').then((mod) => mod.SchemaView),
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
    setRightPanelWidth,
    rightPanelCollapsed,
    toggleRightPanel,
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
    selectedNodeIds,
    setSelectedNodes,
    layoutMode,
    setLayoutMode,
  } = useNeuralMapStore()

  const isDark = mounted ? resolvedTheme === 'dark' : true

  // 리사이즈 상태
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

  // Map Sub-View Mode (2D default)
  const [mapViewMode, setMapViewMode] = useState<'2d' | '3d'>('2d')

  useEffect(() => {
    setMounted(true)
  }, [])

  // 리사이즈 핸들러
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    resizeRef.current = {
      startX: e.clientX,
      startWidth: rightPanelWidth,
    }
  }, [rightPanelWidth])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return

      const delta = resizeRef.current.startX - e.clientX
      const newWidth = resizeRef.current.startWidth + delta

      // 최소 200px, 최대 600px
      if (newWidth >= 200 && newWidth <= 600) {
        setRightPanelWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      resizeRef.current = null
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, setRightPanelWidth])

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
            ) : activeTab === 'map' ? (
              // Map View with Sub-modes
              <div className="absolute inset-0">
                {mapViewMode === '2d' ? (
                  <Graph2DView className="absolute inset-0" />
                ) : (
                  <CosmicForceGraph className="absolute inset-0" />
                )}

                {/* Map View Toggle Controls & Actions */}
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                  <div className={cn(
                    "flex rounded-lg shadow-lg border p-1 gap-1",
                    isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-zinc-200"
                  )}>
                    <button
                      onClick={() => setMapViewMode('2d')}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                        mapViewMode === '2d'
                          ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500"
                      )}
                    >
                      2D Graph
                    </button>

                    <button
                      onClick={() => setMapViewMode('3d')}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                        mapViewMode === '3d'
                          ? "bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500"
                      )}
                    >
                      Cosmic
                    </button>

                    <div className={cn("w-px h-4 my-auto mx-1", isDark ? "bg-zinc-700" : "bg-zinc-200")} />

                    {/* Reset Layout / Sort Button */}
                    {/* Layout Mode Toggle */}
                    <button
                      onClick={() => setLayoutMode('organic')}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                        layoutMode === 'organic'
                          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500"
                      )}
                    >
                      Organic
                    </button>
                    <button
                      onClick={() => setLayoutMode('radial')}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                        layoutMode === 'radial'
                          ? "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500"
                      )}
                    >
                      Radial
                    </button>
                    <button
                      onClick={() => setLayoutMode('structural')}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                        layoutMode === 'structural'
                          ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500"
                      )}
                    >
                      Structural
                    </button>

                    {/* Group Action Button */}
                    {(() => {
                      if (!graph) return false
                      const selectedNodes = graph.nodes.filter((n) => selectedNodeIds.includes(n.id))
                      if (selectedNodes.length < 2) return false
                      // 이미 부모가 있으면 그룹화 대상에서 제외 (중복 그룹 방지)
                      if (selectedNodes.some((node) => !!node.parentId)) return false
                      return true
                    })() && (
                        <button
                          onClick={() => {
                            if (!graph) return
                            const nodesToGroup = graph.nodes.filter((n) => selectedNodeIds.includes(n.id) && !n.parentId)
                            if (nodesToGroup.length < 2) {
                              return
                            }
                            const newGroupId = `group-${Date.now()}`
                            const newGroupNode: NeuralNode = {
                              id: newGroupId,
                              title: 'New Group',
                              type: 'folder',
                              tags: [],
                              importance: 5,
                              expanded: true,
                              pinned: false,
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                              position: { x: 0, y: 0, z: 0 }
                            }

                            // Add new group node
                            useNeuralMapStore.getState().addNode(newGroupNode)

                            // Update selected nodes to have this parent
                            nodesToGroup.forEach(node => {
                              useNeuralMapStore.getState().updateNode(node.id, { parentId: newGroupId })
                            })

                            // Select the new group
                            useNeuralMapStore.getState().setSelectedNodes([newGroupId])
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1",
                            "bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400"
                          )}
                        >
                          Group ({selectedNodeIds.length})
                        </button>
                      )}
                  </div>
                </div>
              </div>
            ) : activeTab === 'life-stream' ? (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">Life Stream</h2>
                  <p>Development Pipeline Visualization (The Blueprint) Coming Soon</p>
                </div>
              </div>
            ) : activeTab === 'data' ? (
              <SchemaView className="absolute inset-0" />
            ) : activeTab === 'logic' ? (
              <LogicFlow className="absolute inset-0" />
            ) : activeTab === 'test' ? (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">Test Suite</h2>
                  <p>Automated Verification & QA Dashboard Coming Soon</p>
                </div>
              </div>
            ) : (
              <Graph2DView className="absolute inset-0" />
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

        {/* Code Preview Panel */}
        <CodePreviewPanel />

        {/* Right Panel Resize Handle */}
        <div
          onMouseDown={handleResizeStart}
          onDoubleClick={toggleRightPanel}
          className={cn(
            'flex-shrink-0 h-full w-2 flex items-center justify-center cursor-col-resize',
            'transition-all duration-150 group',
            isResizing
              ? isDark ? 'bg-violet-600' : 'bg-violet-500'
              : isDark
                ? 'bg-zinc-900 hover:bg-zinc-700'
                : 'bg-zinc-100 hover:bg-zinc-200'
          )}
          title="드래그하여 크기 조절 / 더블클릭하여 패널 토글"
        >
          <div className={cn(
            'w-0.5 h-12 rounded-full transition-all duration-150',
            isResizing
              ? 'bg-white'
              : isDark
                ? 'bg-zinc-600 group-hover:bg-zinc-400'
                : 'bg-zinc-300 group-hover:bg-zinc-500'
          )} />
        </div>

        {/* Right Panel - Inspector/Actions/Chat */}
        <AnimatePresence initial={false}>
          {!rightPanelCollapsed && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: rightPanelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: isResizing ? 0 : 0.2 }}
              style={{ width: isResizing ? rightPanelWidth : undefined }}
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
      {
        modalType === 'nodeEditor' && (
          <NodeEditorModal mapId={mapId} onClose={closeModal} />
        )
      }
      {
        modalType === 'export' && (
          <EdgeEditorModal mapId={mapId} onClose={closeModal} />
        )
      }
    </div >
  )
}
