'use client'

// DOM 충돌 에러 전역 억제 (React와 force-graph 충돌 방지) - 최상단에서 실행
if (typeof window !== 'undefined' && typeof Node !== 'undefined') {
  const patchedSymbol = Symbol.for('__dom_patched__')
  if (!(window as any)[patchedSymbol]) {
    (window as any)[patchedSymbol] = true

    const originalRemoveChild = Node.prototype.removeChild
    Node.prototype.removeChild = function<T extends Node>(child: T): T {
      if (child.parentNode !== this) {
        // 충돌 무시 - child를 반환하여 React가 계속 진행하도록
        return child
      }
      return originalRemoveChild.call(this, child) as T
    }

    const originalInsertBefore = Node.prototype.insertBefore
    Node.prototype.insertBefore = function<T extends Node>(node: T, child: Node | null): T {
      if (child && child.parentNode !== this) {
        // 충돌 무시
        return node
      }
      return originalInsertBefore.call(this, node, child) as T
    }
  }
}

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
// FileTreePanel은 TwoLevelSidebar에서 렌더링됨 (layout.tsx)

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

// MCP Bridge for Claude Code CLI integration
import { useMcpBridge } from '@/lib/neural-map/hooks/useMcpBridge'

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

// Dynamically import Cytoscape View (flowchart - code dependencies)
const CytoscapeView = dynamic(
  () => import('@/components/neural-map/canvas/CytoscapeView').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <CanvasLoadingFallback />,
  }
)

// Dynamically import interactive diagram views
const SequenceDiagramView = dynamic(
  () => import('@/components/neural-map/canvas/SequenceDiagramView').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <CanvasLoadingFallback />,
  }
)

const ClassDiagramView = dynamic(
  () => import('@/components/neural-map/canvas/ClassDiagramView').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <CanvasLoadingFallback />,
  }
)

const ERDiagramView = dynamic(
  () => import('@/components/neural-map/canvas/ERDiagramView').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <CanvasLoadingFallback />,
  }
)

const PieChartView = dynamic(
  () => import('@/components/neural-map/canvas/PieChartView').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <CanvasLoadingFallback />,
  }
)

const StateDiagramView = dynamic(
  () => import('@/components/neural-map/canvas/StateDiagramView').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <CanvasLoadingFallback />,
  }
)

const GitGraphView = dynamic(
  () => import('@/components/neural-map/canvas/GitGraphView').then((mod) => mod.default),
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
    mermaidDiagramType,
    selectedNodeIds,
    rightPanelCollapsed,
    editorOpen,
    editorCollapsed,
    isLoading,
    modalType,
    mapId,
    projectPath,
    linkedProjectName,
    linkedProjectId,
    files,
    setLoading,
    setActiveTab,
    closeModal,
    setFiles,

    toggleRightPanel,
    updateNode,
    terminalOpen,
    toggleTerminal,
    terminalHeight,
    setTerminalHeight,
    setTheme: setMapTheme,
    buildGraphFromFilesAsync
  } = useNeuralMapStore()

  // Chat store for viewfinder → chat integration
  const { setPendingImage } = useChatStore()
  const setNeuralMapRightPanelTab = useNeuralMapStore((s) => s.setRightPanelTab)
  const setProjectPath = useNeuralMapStore((s) => s.setProjectPath)

  // MCP Bridge for Claude Code CLI control
  const { isConnected: mcpConnected } = useMcpBridge()

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

  // 진입 시 이전 프로젝트 연결 초기화
  const clearLinkedProject = useNeuralMapStore((s) => s.clearLinkedProject)

  useEffect(() => {
    setMounted(true)

    // URL에서 projectId 확인
    const urlParams = new URLSearchParams(window.location.search)
    const projectIdFromUrl = urlParams.get('projectId')

    // 스토어에 이미 linkedProjectId가 있으면 (project 페이지에서 설정한 경우) 유지
    // URL에서 projectId가 오거나, 스토어에 이미 프로젝트가 설정되어 있으면 유지
    const currentState = useNeuralMapStore.getState()
    const hasLinkedProject = currentState.linkedProjectId || currentState.linkedProjectName

    console.log('[NeuralMap] Init check:', {
      projectIdFromUrl,
      hasLinkedProject,
      linkedProjectId: currentState.linkedProjectId,
      linkedProjectName: currentState.linkedProjectName
    })

    // URL에 projectId가 없고, 스토어에도 프로젝트가 없는 경우에만 초기화
    // (즉, 완전히 새로운 진입인 경우만)
    if (!projectIdFromUrl && !hasLinkedProject) {
      console.log('[NeuralMap] Fresh start - no project linked')
    }

    // 기존 localStorage의 projectPath 캐시만 제거 (linkedProject는 유지)
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('neural-map-storage')
        if (stored) {
          const parsed = JSON.parse(stored)
          let changed = false
          if (parsed.state?.projectPath) {
            delete parsed.state.projectPath
            changed = true
          }
          if (changed) {
            localStorage.setItem('neural-map-storage', JSON.stringify(parsed))
            console.log('[NeuralMap] Cleared cached projectPath from localStorage')
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }, [])

  // Expose store to window for debugging + keyboard shortcut
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Expose store for debugging
      (window as any).__neuralMapStore = useNeuralMapStore

      // Keyboard shortcut: Ctrl+` to toggle terminal
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === '`') {
          e.preventDefault()
          toggleTerminal()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [toggleTerminal])

  // 🔥 프로젝트 문서 로드 및 그래프 빌드 (linkedProjectId가 있을 때)
  const documentsLoadedRef = useRef<string | null>(null) // 이미 로드한 프로젝트 ID 추적

  useEffect(() => {
    if (!mounted || !linkedProjectId) return
    if (documentsLoadedRef.current === linkedProjectId) return // 이미 로드함

    console.log('[NeuralMap] 📂 Loading documents for project:', linkedProjectId)
    setLoading(true)
    documentsLoadedRef.current = linkedProjectId

    const loadAndBuildGraph = async () => {
      try {
        // 먼저 프로젝트 상세 정보 로드 (folder_path 포함)
        try {
          const projectRes = await fetch(`/api/projects/${linkedProjectId}`)
          if (projectRes.ok) {
            const projectData = await projectRes.json()
            if (projectData.folder_path) {
              console.log('[NeuralMap] 📁 Loading folder_path from project:', projectData.folder_path)
              setProjectPath(projectData.folder_path)
            }
          }
        } catch (e) {
          console.warn('[NeuralMap] Failed to load project folder_path:', e)
        }

        const res = await fetch(`/api/projects/${linkedProjectId}/documents?limit=100`)
        if (!res.ok) throw new Error('Failed to fetch documents')

        const data = await res.json()
        const documents = data.documents || []

        console.log('[NeuralMap] 📄 Fetched documents:', documents.length)

        // Convert documents to NeuralFile format
        const neuralFiles = documents.map((doc: any) => ({
          id: doc.id,
          name: doc.title,
          path: `${linkedProjectName || 'Project'}/${doc.doc_type}/${doc.title}`,
          type: 'file' as const,
          content: doc.content || '',
          size: doc.content?.length || 0,
          createdAt: doc.created_at,
          updatedAt: doc.updated_at,
        }))

        // Set files first, then build graph
        if (neuralFiles.length > 0) {
          setFiles(neuralFiles)
          console.log('[NeuralMap] ✅ Set files:', neuralFiles.length, neuralFiles.map((f: any) => f.path))

          // Zustand state 업데이트 확인을 위한 대기
          await new Promise(resolve => setTimeout(resolve, 100))

          // 스토어에 파일이 제대로 설정되었는지 확인
          const storeState = useNeuralMapStore.getState()
          console.log('[NeuralMap] 📋 Store files after set:', storeState.files?.length || 0)
        }

        // 파일이 있든 없든 그래프 빌드 (빈 프로젝트도 루트 노드 표시)
        console.log('[NeuralMap] 🚀 Building graph for project:', linkedProjectName || linkedProjectId)
        await buildGraphFromFilesAsync()

        // 그래프 빌드 후 상태 확인
        const afterBuild = useNeuralMapStore.getState()
        console.log('[NeuralMap] 📊 After build:', {
          graphNodes: afterBuild.graph?.nodes?.length || 0,
          folderNodes: afterBuild.graph?.nodes?.filter((n: any) => n.type === 'folder').length || 0,
          expandedNodeIds: Array.from(afterBuild.expandedNodeIds || [])
        })
      } catch (error) {
        console.error('[NeuralMap] ❌ Failed to load documents:', error)
        // 에러가 나도 빈 그래프는 빌드
        await buildGraphFromFilesAsync()
      } finally {
        setLoading(false)
      }
    }

    loadAndBuildGraph()
  }, [mounted, linkedProjectId, linkedProjectName, setFiles, setLoading, buildGraphFromFilesAsync])

  // 로컬 프로젝트(projectPath)가 연결되어 있으면 그래프 빌드
  useEffect(() => {
    if (!mounted) return
    if (linkedProjectId) return // linkedProjectId가 있으면 위 useEffect에서 처리

    console.log('[NeuralMap] useEffect check (local path):', {
      mounted,
      projectPath,
      filesCount: files?.length || 0,
      hasGraph: !!graph,
      graphNodes: graph?.nodes?.length || 0
    })

    const hasLocalProject = projectPath && !linkedProjectId
    const needsGraph = !graph || (graph?.nodes?.length || 0) === 0

    if (hasLocalProject && needsGraph) {
      console.log('[NeuralMap] 🚀 Building graph for local project:', projectPath)
      buildGraphFromFilesAsync()
    }
  }, [mounted, linkedProjectId, projectPath, files, graph, buildGraphFromFilesAsync])

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
        {/* Left Panel - FileTreePanel은 TwoLevelSidebar에서 렌더링됨 (layout.tsx) */}
        {/* 여기서 중복 렌더링하지 않음 */}

        {/* Main Content Area */}
        <div className={cn("flex-1 flex flex-col min-w-0 relative", isDark ? "bg-zinc-900" : "bg-white")}>

          {/* Top View Controls (Tabs, etc) */}
          <div className={cn("h-10 border-b flex items-center justify-between px-3 select-none z-20 overflow-hidden", isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200")}>
            <div className="flex-1 min-w-0 overflow-hidden">
              <ViewTabs />
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">


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
              // Interactive diagram views based on type
              mermaidDiagramType === 'flowchart' ? (
                <CytoscapeView projectPath={projectPath ?? undefined} mapId={mapId ?? undefined} />
              ) : mermaidDiagramType === 'sequence' ? (
                <SequenceDiagramView projectPath={projectPath ?? undefined} className="absolute inset-0" />
              ) : mermaidDiagramType === 'class' ? (
                <ClassDiagramView projectPath={projectPath ?? undefined} className="absolute inset-0" />
              ) : mermaidDiagramType === 'er' ? (
                <ERDiagramView projectPath={projectPath ?? undefined} className="absolute inset-0" />
              ) : mermaidDiagramType === 'pie' ? (
                <PieChartView projectPath={projectPath ?? undefined} className="absolute inset-0" />
              ) : mermaidDiagramType === 'state' ? (
                <StateDiagramView projectPath={projectPath ?? undefined} className="absolute inset-0" />
              ) : mermaidDiagramType === 'gitgraph' ? (
                <GitGraphView projectPath={projectPath ?? undefined} className="absolute inset-0" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                  <p>Unknown diagram type: {mermaidDiagramType}</p>
                </div>
              )
            ) : (
              <Graph2DView className="absolute inset-0" />
            )}
          </div>

          {/* Terminal Panel - Always rendered for persistence */}
          <div
            className={cn(
              "shrink-0 border-t overflow-hidden transition-all duration-200",
              isDark ? "border-zinc-800" : "border-zinc-200"
            )}
            style={{ height: terminalOpen ? terminalHeight : 0 }}
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
