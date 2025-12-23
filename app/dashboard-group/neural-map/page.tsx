'use client'

import { useEffect, useState, Suspense, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import { useChatStore } from '@/stores/chatStore'
import { PANEL_SIZES, THEME_PRESETS } from '@/lib/neural-map/constants'
import type { NeuralGraph, NeuralNode, ViewTab } from '@/lib/neural-map/types'

// Panels
import { InspectorPanel } from '@/components/neural-map/panels/InspectorPanel'
import { MarkdownEditorPanel } from '@/components/neural-map/panels/MarkdownEditorPanel'
import { CodePreviewPanel } from '@/components/neural-map/panels/CodePreviewPanel'
import { BrowserView } from '@/components/neural-map/panels/BrowserView'

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
  Terminal,
} from 'lucide-react'

// Terminal Panel
import { TerminalPanel } from '@/components/editor'

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

// Dynamically import Life Stream View
const LifeStreamView = dynamic(
  () => import('@/components/neural-map/views/LifeStreamView').then((mod) => mod.LifeStreamView),
  {
    ssr: false,
    loading: () => <CanvasLoadingFallback />,
  }
)

// Dynamically import Cytoscape View (AI-powered code diagram)
const CytoscapeView = dynamic(
  () => import('@/components/neural-map/canvas/CytoscapeView').then((mod) => mod.default),
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
      <Loader2 className="w-8 h-8 animate-spin text-white/50" />
    </div>
  )
}

export default function NeuralMapPage() {
  const { theme, setTheme } = useTheme()
  const { accentColor: globalAccentId } = useThemeStore()
  const isDark = theme === 'dark' || theme === 'cosmic-dark' || theme === undefined

  const {
    graph,
    activeTab,
    selectedNodeIds,
    rightPanelCollapsed,
    editorOpen,
    editorCollapsed,
    isLoading,
    modalType,
    mapId,
    projectPath,
    setLoading,
    setActiveTab,
    closeModal,

    toggleRightPanel,
    updateNode,
    terminalOpen,
    toggleTerminal,
    terminalHeight,
    setTerminalHeight,
    setTheme: setMapTheme
  } = useNeuralMapStore()

  // Chat store for viewfinder → chat integration
  const { setPendingImage } = useChatStore()
  const setNeuralMapRightPanelTab = useNeuralMapStore((s) => s.setRightPanelTab)
  const setProjectPath = useNeuralMapStore((s) => s.setProjectPath)

  // Viewfinder → Chat 연결 핸들러
  const handleViewfinderShareToAI = useCallback((context: { imageDataUrl: string; timestamp: number }) => {
    // 1. 이미지를 chat store에 pending으로 설정
    setPendingImage({ dataUrl: context.imageDataUrl, timestamp: context.timestamp })

    // 2. 오른쪽 패널의 Chat 탭으로 자동 전환
    setNeuralMapRightPanelTab('chat')

    // 3. 패널이 닫혀있다면 열기
    if (rightPanelCollapsed) {
      toggleRightPanel()
    }

    console.log('[NeuralMap] Viewfinder image shared to chat:', {
      timestamp: new Date(context.timestamp).toISOString(),
      imageSize: Math.round(context.imageDataUrl.length / 1024) + 'KB'
    })
  }, [setPendingImage, setNeuralMapRightPanelTab, rightPanelCollapsed, toggleRightPanel])

  const nodes = graph?.nodes || []

  // Initial Data Fetch
  const [mounted, setMounted] = useState(false)

  // Code Editor
  const closeEditor = () => useNeuralMapStore.setState({ editorOpen: false })
  const toggleEditorCollapse = () => useNeuralMapStore.setState({ editorCollapsed: !editorCollapsed })

  // Right Panel Resize
  const [rightPanelWidth, setRightPanelWidth] = useState(PANEL_SIZES.right.default)


  // 리사이즈 상태
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

  // Map Sub-View Mode (2D default)
  const [mapViewMode, setMapViewMode] = useState<'2d' | '3d'>('2d')

  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-set projectPath from Electron cwd if not already set
  useEffect(() => {
    if (!mounted) return
    if (projectPath) return // 이미 설정됨

    // Electron 환경에서 cwd 가져오기
    const initProjectPath = async () => {
      if (typeof window !== 'undefined' && window.electron?.fs?.getCwd) {
        try {
          const cwd = await window.electron.fs.getCwd()
          if (cwd) {
            setProjectPath(cwd)
            console.log('[NeuralMap] Auto-set projectPath from cwd:', cwd)
          }
        } catch (err) {
          console.warn('[NeuralMap] Failed to get cwd:', err)
        }
      }
    }

    initProjectPath()
  }, [mounted, projectPath, setProjectPath])

  // Sync Global Theme to Neural Map
  useEffect(() => {
    if (!mounted) return

    // Find the actual hex color from the global store ID
    const matchedAccent = accentColors.find(c => c.id === globalAccentId)
    const userAccentColor = matchedAccent ? matchedAccent.color : '#22c55e'

    if (isDark) {
      setMapTheme('cosmic-dark', userAccentColor)
    } else {
      setMapTheme('ocean-light', userAccentColor)
    }
  }, [mounted, isDark, setMapTheme, globalAccentId])


  // 리사이즈 핸들러 (RAF 최적화 적용)
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    resizeRef.current = {
      startX: e.clientX,
      startWidth: rightPanelWidth,
    }
  }, [rightPanelWidth])

  useEffect(() => {
    let animationFrameId: number | null = null

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return

      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }

      animationFrameId = requestAnimationFrame(() => {
        if (!resizeRef.current) return

        const delta = resizeRef.current.startX - e.clientX
        const newWidth = resizeRef.current.startWidth + delta

        // 최소 100px, 최대 화면의 90%
        const maxWidth = typeof window !== 'undefined' ? window.innerWidth * 0.9 : 1600
        if (newWidth >= 100 && newWidth <= maxWidth) {
          setRightPanelWidth(newWidth)
        }
      })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      resizeRef.current = null
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
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
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
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

        // 3. 맵 로드
        // await loadGraph(targetMapId) // TODO: Implement graph loading action

      } catch (error) {
        console.error('Failed to init map:', error)
      } finally {
        setLoading(false)
      }
    }

    loadOrCreateMap()
  }, []) // run once


  if (!mounted) return null

  // Group nodes button logic
  const canGroup = selectedNodeIds.length > 1
  const onGroupNodes = () => {
    if (!canGroup) return
    // Simple logic: create a Group Node parent for selected items
    const groupId = crypto.randomUUID()
    // ... logic to update store (omitted for brevity, can be implemented)
  }

  return (
    <div className={cn("flex flex-col h-full w-full overflow-hidden", isDark ? "bg-[#09090b]" : "bg-white")}>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area */}
        <div className={cn("flex-1 flex flex-col min-w-0 relative", isDark ? "bg-zinc-900" : "bg-white")}>

          {/* Top View Controls (Tabs, etc) */}
          <div className={cn("h-10 border-b flex items-center justify-between px-3 select-none z-20", isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200")}>
            <ViewTabs />

            <div className="flex items-center gap-2">


              {/* Right Panel Toggle */}
              <button
                onClick={toggleRightPanel}
                className={cn("p-1.5 rounded-md transition-colors", isDark ? "hover:bg-white/5 text-zinc-400 hover:text-zinc-200" : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700")}
              >
                {rightPanelCollapsed ? <PanelRightOpen className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Canvas / Visualization Area */}
          <div className={cn("flex-1 relative overflow-hidden", isDark ? "bg-zinc-950" : "bg-zinc-50", isResizing && "pointer-events-none")}>
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
              </div>
            ) : (activeTab as any) === '3d' ? (
              <NeuralMapCanvas />
            ) : (activeTab as any) === 'cosmic' ? (
              <div className="absolute inset-0">
                <CosmicForceGraph />
                {/* Floating Action for Grouping */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                  <div className="flex items-center gap-2 pointer-events-auto">
                    {canGroup && (
                      <button
                        onClick={() => {
                          const newGroupId = `group-${Date.now()}`
                          const nodesToGroup = nodes.filter(n => selectedNodeIds.includes(n.id))

                          // Calculate center
                          // ... (省略된 그룹 로직 복원 필요하다면 추가, 여기서는 UI 구조에 집중)
                          const newGroupNode: NeuralNode = {
                            id: newGroupId,
                            name: 'New Group',
                            type: 'group',
                            importance: 5,
                            expanded: true,
                            pinned: false,
                            createdAt: new Date().toISOString(),
                            mapId: mapId || '',
                            url: ''
                          } as any // type assertion for simplicity if needed

                          useNeuralMapStore.getState().addNode(newGroupNode)
                          // Update selected nodes
                          nodesToGroup.forEach(node => {
                            useNeuralMapStore.getState().updateNode(node.id, { parentId: newGroupId })
                          })
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
              <LifeStreamView className="absolute inset-0" />
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
            ) : activeTab === 'browser' ? (
              <BrowserView onShareToAI={handleViewfinderShareToAI} />
            ) : activeTab === 'mermaid' ? (
              <CytoscapeView projectPath={projectPath ?? undefined} mapId={mapId ?? undefined} />
            ) : (
              <Graph2DView className="absolute inset-0" />
            )}
          </div>

          {/* Terminal Panel - Always rendered for persistence, hidden via CSS */}
          <div
            className={cn(
              "shrink-0 border-t",
              isDark ? "border-zinc-800" : "border-zinc-200",
              !terminalOpen && "hidden"
            )}
            style={{ height: terminalHeight }}
          >
            <TerminalPanel
              isOpen={terminalOpen}
              onToggle={toggleTerminal}
              onClose={toggleTerminal}
              height={terminalHeight}
              onHeightChange={setTerminalHeight}
            />
          </div>
          {/* Right Panel Resize Handle (Absolute Positioned for no gap) */}
          <div
            onMouseDown={handleResizeStart}
            onDoubleClick={toggleRightPanel}
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-50 hover:bg-zinc-500/10 transition-colors"
            title="드래그하여 크기 조절 / 더블클릭하여 패널 토글"
          />
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
                isDark ? 'bg-zinc-900/95 border-zinc-800' : 'bg-white border-zinc-200',
                isResizing && 'pointer-events-none' // IMPORTANT: Performance optimization
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
