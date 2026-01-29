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
import { useSearchParams } from 'next/navigation'
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
import GitPanel from '@/components/neural-map/panels/GitPanel'
// FileTreePanel은 TwoLevelSidebar에서 렌더링됨 (layout.tsx)

// Controls
import { CodingToolbar } from '@/components/neural-map/controls/CodingToolbar'
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

// GlowCode Store for Claude Code UI projectPath sync
import { useGlowCodeStore } from '@/stores/glowCodeStore'

// Mission Control View Sync callbacks
import {
  initializeViewSyncCallbacks,
  cleanupViewSyncCallbacks,
} from '@/lib/mission-control/artifact-view-mapper'

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

// Dynamically import Architecture View (system architecture reverse-engineering)
const ArchitectureView = dynamic(
  () => import('@/components/neural-map/canvas/architecture/ArchitectureView').then((mod) => mod.ArchitectureView),
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

// Dynamically import Mermaid View (architecture flowcharts with diverse shapes)
const MermaidView = dynamic(
  () => import('@/components/neural-map/canvas/MermaidView').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <CanvasLoadingFallback />,
  }
)

// Dynamically import Agent Builder (n8n-style workflow builder)
const AgentBuilder = dynamic(
  () => import('@/components/agent/AgentBuilder').then((mod) => mod.AgentBuilder),
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
    setGraph,
    clearGraph,
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
  const setMapId = useNeuralMapStore((s) => s.setMapId)
  const setLinkedProject = useNeuralMapStore((s) => s.setLinkedProject)
  const clearLinkedProject = useNeuralMapStore((s) => s.clearLinkedProject)

  // URL 파라미터에서 mapId, tab, newProject 처리
  const searchParams = useSearchParams()
  const urlMapId = searchParams.get('mapId')
  const urlTab = searchParams.get('tab')
  const urlNewProject = searchParams.get('newProject')
  const urlProjectName = searchParams.get('name')

  // URL에서 mapId가 있으면 store에 설정
  useEffect(() => {
    if (urlMapId && urlMapId !== mapId) {
      setMapId(urlMapId)
    }
  }, [urlMapId, mapId, setMapId])

  // URL에서 tab 파라미터가 있으면 해당 탭으로 전환
  useEffect(() => {
    if (urlTab === 'browser' && activeTab !== 'browser') {
      console.log('[NeuralMap] 🌐 Setting browser tab from URL parameter')
      setActiveTab('browser')
    }
  }, [urlTab, activeTab, setActiveTab])

  // 🆕 새 프로젝트로 시작 (Apps 페이지에서 진입)
  const newProjectInitializedRef = useRef(false)
  useEffect(() => {
    if (urlNewProject === 'true' && urlProjectName && !newProjectInitializedRef.current) {
      newProjectInitializedRef.current = true
      console.log('[NeuralMap] 🆕 Starting new project:', urlProjectName)

      // 기존 데이터 클리어
      clearGraph()
      setFiles([])
      setMapId(null)
      setProjectPath(null)
      clearLinkedProject()

      // 새 프로젝트 이름으로 스토어 설정 (linkedProjectName만 설정, ID는 저장 시 생성)
      useNeuralMapStore.setState({
        linkedProjectName: urlProjectName,
        linkedProjectId: null
      })

      // URL 파라미터 제거 (깔끔한 URL 유지)
      if (typeof window !== 'undefined') {
        const newUrl = window.location.pathname
        window.history.replaceState({}, '', newUrl)
      }
    }
  }, [urlNewProject, urlProjectName, clearGraph, setFiles, setMapId, setProjectPath, clearLinkedProject])

  // MCP Bridge for Claude Code CLI control
  const { isConnected: mcpConnected } = useMcpBridge()

  // 🔥 GlowCode Store sync: NeuralMapStore.projectPath → GlowCodeStore.context.projectPath
  const glowCodeSetContext = useGlowCodeStore((s) => s.setContext)
  useEffect(() => {
    if (projectPath) {
      console.log('[NeuralMap] Syncing projectPath to GlowCode:', projectPath)
      glowCodeSetContext({ projectPath })
    }
  }, [projectPath, glowCodeSetContext])

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

  // 🌐 AI Browser 패널 자동 열기 이벤트 리스너
  useEffect(() => {
    const electronApi = (window as any).electron?.aiBrowser
    if (!electronApi?.onOpenPanel) return

    const unsubscribe = electronApi.onOpenPanel(() => {
      console.log('[NeuralMap] 🌐 AI Browser requested panel open!')
      setActiveTab('browser')
    })

    return () => unsubscribe?.()
  }, [setActiveTab])

  useEffect(() => {
    setMounted(true)

    // URL에서 projectId 확인 (projectId 또는 project 파라미터 모두 지원)
    const urlParams = new URLSearchParams(window.location.search)
    const projectIdFromUrl = urlParams.get('projectId') || urlParams.get('project')

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

    // 🆕 URL에 projectId가 있지만 스토어에 없으면 프로젝트 정보를 가져와서 설정
    if (projectIdFromUrl && !currentState.linkedProjectId) {
      console.log('[NeuralMap] Setting linked project from URL:', projectIdFromUrl)
      // 프로젝트 정보 가져와서 스토어에 설정
      fetch(`/api/projects/${projectIdFromUrl}`)
        .then(res => res.ok ? res.json() : null)
        .then(project => {
          if (project) {
            console.log('[NeuralMap] Project fetched, setting linked project:', project.id, project.name, 'folder_path:', project.folder_path)
            setLinkedProject(project.id, project.name)
            // 🔥 프로젝트의 folder_path가 있으면 projectPath도 설정 (에이전트가 파일 접근 가능)
            if (project.folder_path) {
              console.log('[NeuralMap] Setting projectPath from DB folder_path:', project.folder_path)
              setProjectPath(project.folder_path)
            } else {
              // 🔥 folder_path가 없으면 Electron에서 자동 폴더 선택 다이얼로그
              const electron = typeof window !== 'undefined' ? (window as any).electron : null
              if (electron?.fs?.selectDirectory) {
                console.log('[NeuralMap] No folder_path, opening folder selection dialog')
                electron.fs.selectDirectory().then((result: { path: string } | null) => {
                  if (result?.path) {
                    setProjectPath(result.path)
                    // DB에도 저장
                    fetch(`/api/projects/${project.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ folder_path: result.path })
                    })
                  }
                })
              }
            }
          } else {
            // 프로젝트 정보가 없어도 ID라도 설정
            console.log('[NeuralMap] Project not found, setting ID only:', projectIdFromUrl)
            setLinkedProject(projectIdFromUrl, null)
          }
        })
        .catch(err => {
          console.error('[NeuralMap] Failed to fetch project:', err)
          // 에러 시에도 ID 설정
          setLinkedProject(projectIdFromUrl, null)
        })
    }

    // 🔥 URL에 projectId가 없어도 기존 프로젝트 유지 (다른 메뉴 갔다 와도 유지됨)
    // 프로젝트 초기화는 사용자가 명시적으로 "New Project" 버튼을 클릭할 때만 수행
    if (!projectIdFromUrl && hasLinkedProject) {
      console.log('[NeuralMap] No project in URL but keeping existing linked project:', {
        linkedProjectId: currentState.linkedProjectId,
        linkedProjectName: currentState.linkedProjectName,
        projectPath: currentState.projectPath
      })

      // 🔥 linkedProjectId는 있는데 projectPath가 없으면 폴더 선택 다이얼로그
      if (currentState.linkedProjectId && !currentState.projectPath) {
        const electron = typeof window !== 'undefined' ? (window as any).electron : null
        if (electron?.fs?.selectDirectory) {
          console.log('[NeuralMap] Existing project has no folder_path, opening folder selection')
          electron.fs.selectDirectory().then((result: { path: string } | null) => {
            if (result?.path) {
              setProjectPath(result.path)
              // DB에도 저장
              fetch(`/api/projects/${currentState.linkedProjectId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder_path: result.path })
              })
            }
          })
        }
      }
    }
  }, [setLinkedProject, clearLinkedProject, setProjectPath])

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

  // 🔥 Mission Control 뷰 동기화 콜백 초기화
  useEffect(() => {
    // 클라이언트 사이드에서만 실행
    if (typeof window !== 'undefined') {
      console.log('[NeuralMap] 🔗 Initializing Mission Control view sync callbacks')
      initializeViewSyncCallbacks()

      return () => {
        console.log('[NeuralMap] 🔌 Cleaning up Mission Control view sync callbacks')
        cleanupViewSyncCallbacks()
      }
    }
  }, [])

  // 🔥 저장 토스트 상태
  const [saveToast, setSaveToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' })

  const showSaveToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setSaveToast({ show: true, message, type })
    setTimeout(() => setSaveToast({ show: false, message: '', type: 'success' }), 2500)
  }, [])

  // 🔥 Electron 메뉴 저장 이벤트 리스너 (Cmd+S)
  useEffect(() => {
    const electron = typeof window !== 'undefined' ? (window as any).electron : null
    if (!electron?.onMenuEvent) return

    const handleSave = async () => {
      console.log('[NeuralMap] 💾 Menu save triggered')
      const state = useNeuralMapStore.getState()
      const { linkedProjectId, mapId, graph, projectPath, linkedProjectName } = state

      // 1. 이미 프로젝트에 연결되어 있으면 바로 저장
      if (linkedProjectId && mapId) {
        try {
          // 맵 상태 저장
          await fetch(`/api/ai-coding/${mapId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ graph }),
          })

          // folder_path도 업데이트
          if (projectPath) {
            await fetch(`/api/projects/${linkedProjectId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ folder_path: projectPath })
            })
          }

          console.log('[NeuralMap] ✅ Saved to project:', linkedProjectId)
          showSaveToast(`"${linkedProjectName || '프로젝트'}" 에 저장됨`)
        } catch (err) {
          console.error('[NeuralMap] Save failed:', err)
          showSaveToast('저장 실패', 'error')
        }
        return
      }

      // 2. 프로젝트 연결 없이 로컬 폴더만 있으면 저장 모달 열기 (카테고리 선택 필요)
      if (projectPath && !linkedProjectId) {
        console.log('[NeuralMap] Opening save modal for category selection')
        useNeuralMapStore.getState().setShowSaveModal(true)
        return
      }

      // 3. 아무것도 없으면 안내
      if (!projectPath && !linkedProjectId) {
        showSaveToast('저장할 폴더를 먼저 열어주세요', 'error')
      }
    }

    const unsubscribe = electron.onMenuEvent('menu:save', handleSave)
    return () => unsubscribe?.()
  }, [setLinkedProject, showSaveToast])

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
        let folderPath: string | null = null
        let projectName: string = linkedProjectName || 'project'
        const electron = typeof window !== 'undefined' ? (window as any).electron : null

        try {
          const projectRes = await fetch(`/api/projects/${linkedProjectId}`)
          if (projectRes.ok) {
            const projectData = await projectRes.json()
            projectName = projectData.name || projectName

            if (projectData.folder_path) {
              folderPath = projectData.folder_path
              console.log('[NeuralMap] 📁 Loading folder_path from project:', folderPath)
              setProjectPath(folderPath)
            } else if (electron?.project?.createWorkspace) {
              // 🆕 folder_path가 없으면 자동으로 워크스페이스 폴더 생성 (Electron 환경)
              // ~/Documents/GlowUS-Projects/{projectName}/ 에 생성됨
              console.log('[NeuralMap] 🆕 Auto-creating workspace folder for:', projectName)

              try {
                const result = await electron.project.createWorkspace(projectName)

                if (result.success && result.path) {
                  folderPath = result.path
                  setProjectPath(folderPath)

                  // DB에 저장
                  await fetch(`/api/projects/${linkedProjectId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folder_path: folderPath })
                  })

                  console.log('[NeuralMap] ✅ Workspace folder created and saved:', folderPath)
                } else {
                  console.warn('[NeuralMap] Workspace creation returned:', result)
                }
              } catch (mkdirErr) {
                console.warn('[NeuralMap] Failed to create workspace folder:', mkdirErr)
              }
            }
          }
        } catch (e) {
          console.warn('[NeuralMap] Failed to load project folder_path:', e)
        }

        // 🔥 Electron 환경이고 folder_path가 있으면 실제 파일 시스템에서 로드 + 워처 시작
        if (folderPath && electron?.fs?.scanTree) {
          console.log('[NeuralMap] 🚀 Loading files from folder:', folderPath)

          try {
            // 파일 워처 시작 (실시간 동기화)
            if (electron.fs.watchStart) {
              electron.fs.watchStart(folderPath).then((result: { success: boolean; path: string }) => {
                if (result.success) {
                  console.log('[NeuralMap] 👁️ File watcher started:', result.path)
                }
              }).catch((err: Error) => {
                console.warn('[NeuralMap] File watcher failed:', err)
              })
            }

            // 파일 시스템에서 실제 파일 스캔 (스키마 파일 포함)
            const scanResult = await electron.fs.scanTree(folderPath, {
              includeSystemFiles: false,
              includeContent: true,
              contentExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.py', '.java', '.go', '.rs', '.sql', '.prisma', '.graphql', '.gql', '.yaml', '.yml']
            })

            if (scanResult?.tree) {
              const neuralFiles: any[] = []
              const timestamp = Date.now()

              const getFileType = (ext: string) => {
                const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']
                const mdExts = ['md', 'markdown', 'mdx']
                // 스키마 파일 확장자 포함
                const codeExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'py', 'java', 'c', 'cpp', 'h', 'rs', 'go', 'sql', 'prisma', 'graphql', 'gql', 'yaml', 'yml']
                if (imageExts.includes(ext)) return 'image'
                if (mdExts.includes(ext)) return 'markdown'
                if (codeExts.includes(ext)) return 'code'
                return 'text'
              }

              const flattenTree = (node: any) => {
                if (node.kind === 'file') {
                  const ext = node.name.split('.').pop()?.toLowerCase() || ''
                  neuralFiles.push({
                    id: `local-${timestamp}-${neuralFiles.length}`,
                    name: node.name,
                    path: node.relativePath,
                    type: getFileType(ext),
                    content: node.content || '',
                    size: node.size || 0,
                    createdAt: new Date().toISOString(),
                    mapId: mapId || '',
                    url: '',
                  })
                }
                if (node.children) {
                  for (const child of node.children) {
                    flattenTree(child)
                  }
                }
              }

              flattenTree(scanResult.tree)
              console.log(`[NeuralMap] ✅ Scanned ${neuralFiles.length} files from folder`)

              if (neuralFiles.length > 0) {
                setFiles(neuralFiles)
                await buildGraphFromFilesAsync()
                setLoading(false)
                return // 파일 시스템에서 로드 성공하면 DB 문서 로드 스킵
              }
            }
          } catch (fsError) {
            console.warn('[NeuralMap] File system scan failed, falling back to DB:', fsError)
          }
        }

        // Fallback: DB에서 문서 로드 (Electron 아니거나 folder_path 없을 때)
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

  // 🔄 파일 변경 이벤트 리스너 (실시간 동기화)
  useEffect(() => {
    if (!mounted) return
    if (!projectPath) return

    const electron = typeof window !== 'undefined' ? (window as any).electron : null
    if (!electron?.fs?.onChanged) return

    console.log('[NeuralMap] 🎧 Setting up file change listener for:', projectPath)

    // Debounce 타이머
    let debounceTimer: NodeJS.Timeout | null = null

    const handleFileChange = async (data: { path: string; type: 'create' | 'change' | 'delete' }) => {
      console.log('[NeuralMap] 📝 File changed:', data.type, data.path)

      // Debounce: 300ms 내에 여러 변경이 있으면 마지막 것만 처리
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      debounceTimer = setTimeout(async () => {
        const currentPath = useNeuralMapStore.getState().projectPath
        if (!currentPath) return

        console.log('[NeuralMap] 🔄 Reloading files after change...')

        try {
          // 파일 다시 스캔 (스키마 파일 포함)
          const scanResult = await electron.fs.scanTree(currentPath, {
            includeSystemFiles: false,
            includeContent: true,
            contentExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.py', '.java', '.go', '.rs', '.sql', '.prisma', '.graphql', '.gql', '.yaml', '.yml']
          })

          if (scanResult?.tree) {
            const neuralFiles: any[] = []
            const timestamp = Date.now()

            const getFileType = (ext: string) => {
              const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']
              const mdExts = ['md', 'markdown', 'mdx']
              // 스키마 파일 확장자 포함
              const codeExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'py', 'java', 'c', 'cpp', 'h', 'rs', 'go', 'sql', 'prisma', 'graphql', 'gql', 'yaml', 'yml']
              if (imageExts.includes(ext)) return 'image'
              if (mdExts.includes(ext)) return 'markdown'
              if (codeExts.includes(ext)) return 'code'
              return 'text'
            }

            const flattenTree = (node: any) => {
              if (node.kind === 'file') {
                const ext = node.name.split('.').pop()?.toLowerCase() || ''
                neuralFiles.push({
                  id: `local-${timestamp}-${neuralFiles.length}`,
                  name: node.name,
                  path: node.relativePath,
                  type: getFileType(ext),
                  content: node.content || '',
                  size: node.size || 0,
                  createdAt: new Date().toISOString(),
                  mapId: mapId || '',
                  url: '',
                })
              }
              if (node.children) {
                for (const child of node.children) {
                  flattenTree(child)
                }
              }
            }

            flattenTree(scanResult.tree)
            console.log(`[NeuralMap] ✅ Rescanned ${neuralFiles.length} files`)

            // 파일 설정 및 그래프 재빌드
            setFiles(neuralFiles)
            await buildGraphFromFilesAsync()
          }
        } catch (error) {
          console.error('[NeuralMap] Failed to reload files:', error)
        }
      }, 300)
    }

    // 이벤트 리스너 등록
    const unsubscribe = electron.fs.onChanged(handleFileChange)

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [mounted, projectPath, mapId, setFiles, buildGraphFromFilesAsync])

  // 🆕 BroadcastChannel로 파일 리스캔 요청 수신 (에이전트 생성 등)
  useEffect(() => {
    if (!mounted) return
    if (!projectPath) return

    const electron = typeof window !== 'undefined' ? (window as any).electron : null
    if (!electron?.fs?.scanTree) return

    const channel = new BroadcastChannel('neural-map-rescan')

    channel.onmessage = async (event) => {
      if (event.data?.type === 'RESCAN_FILES') {
        console.log('[NeuralMap] 📡 Received rescan request via BroadcastChannel')

        try {
          const scanResult = await electron.fs.scanTree(projectPath, {
            includeSystemFiles: false,
            includeContent: true,
            contentExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.py']
          })

          if (scanResult?.tree) {
            const neuralFiles: any[] = []
            const timestamp = Date.now()

            const getFileType = (ext: string) => {
              const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']
              const mdExts = ['md', 'markdown', 'mdx']
              const codeExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'py']
              if (imageExts.includes(ext)) return 'image'
              if (mdExts.includes(ext)) return 'markdown'
              if (codeExts.includes(ext)) return 'code'
              return 'text'
            }

            const flattenTree = (node: any) => {
              if (node.kind === 'file') {
                const ext = node.name.split('.').pop()?.toLowerCase() || ''
                neuralFiles.push({
                  id: `local-${timestamp}-${neuralFiles.length}`,
                  name: node.name,
                  path: node.relativePath,
                  type: getFileType(ext),
                  content: node.content || '',
                  size: node.size || 0,
                  createdAt: new Date().toISOString(),
                  mapId: mapId || '',
                  url: '',
                })
              }
              if (node.children) {
                for (const child of node.children) {
                  flattenTree(child)
                }
              }
            }

            flattenTree(scanResult.tree)
            console.log(`[NeuralMap] ✅ Rescanned ${neuralFiles.length} files via BroadcastChannel`)

            setFiles(neuralFiles)
            await buildGraphFromFilesAsync()
          }
        } catch (error) {
          console.error('[NeuralMap] ❌ Rescan failed:', error)
        }
      }
    }

    return () => channel.close()
  }, [mounted, projectPath, mapId, setFiles, buildGraphFromFilesAsync])

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

  // Load or create neural map - 프로젝트 변경 시에도 다시 실행
  const prevProjectIdRef = useRef<string | null>(null)

  useEffect(() => {
    const loadOrCreateMap = async () => {
      console.log('[NeuralMap] loadOrCreateMap called, projectId:', linkedProjectId)

      // 🔥 프로젝트가 변경되었을 때만 클리어 (첫 로드는 제외)
      const isFirstLoad = prevProjectIdRef.current === null
      const projectChanged = !isFirstLoad && prevProjectIdRef.current !== linkedProjectId
      prevProjectIdRef.current = linkedProjectId

      if (projectChanged) {
        console.log('[NeuralMap] Project changed, clearing graph')
        clearGraph()
        setFiles([])
        setMapId(null)
      }

      // 🔥 프로젝트가 없으면 바로 빈 상태로 표시 (빠른 로딩)
      if (!linkedProjectId) {
        console.log('[NeuralMap] No project - showing empty state immediately')
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        let targetMapId: string | null = null

        // 🔥 1. 프로젝트의 기존 맵 조회
        const listRes = await fetch(`/api/ai-coding?project_id=${linkedProjectId}`)
        if (listRes.ok) {
          const maps = await listRes.json()
          if (Array.isArray(maps) && maps.length > 0) {
            targetMapId = maps[0].id
            console.log('[NeuralMap] Found existing map:', targetMapId)
          }
        }

        // 🔥 2. 기존 맵이 없을 때만 새 맵 생성
        if (!targetMapId) {
          console.log('[NeuralMap] No existing map found, creating new one...')
          const createRes = await fetch('/api/ai-coding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: linkedProjectName || 'My Neural Map',
              project_id: linkedProjectId
            }),
          })

          if (createRes.ok) {
            const newMap = await createRes.json()
            targetMapId = newMap.id
            console.log('[NeuralMap] Created new map:', targetMapId)
          }
        }

        // 🔥 3. 맵 데이터 로드
        if (targetMapId) {
          const graphRes = await fetch(`/api/ai-coding/${targetMapId}`)
          if (graphRes.ok) {
            const { graph: loadedGraph, files: loadedFiles } = await graphRes.json()
            setMapId(targetMapId)
            if (loadedGraph?.nodes?.length > 0) {
              setGraph(loadedGraph)
              console.log('[NeuralMap] Graph loaded from API:', loadedGraph.nodes.length)
            } else if (loadedFiles?.length > 0) {
              setFiles(loadedFiles)
              console.log('[NeuralMap] No graph, setting files:', loadedFiles.length)
            }
          }
        }

      } catch (error) {
        console.error('Failed to init map:', error)
      } finally {
        setLoading(false)
      }
    }

    loadOrCreateMap()
  }, [linkedProjectId])


  // 마운트 전에도 기본 레이아웃은 보여줌 (빈 화면 방지)
  if (!mounted) {
    return (
      <div className="flex flex-col h-full w-full overflow-hidden bg-zinc-900">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      </div>
    )
  }

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

          {/* Toolbar - 코딩 전용 (저장, 검색, 실행, 포맷 등) */}
          <CodingToolbar
            onToggleTerminal={toggleTerminal}
            terminalOpen={terminalOpen}
            projectPath={projectPath}
            linkedProjectName={linkedProjectName}
          />

          {/* Top View Controls (Tabs, etc) */}
          <div className={cn("h-16 border-b flex items-center justify-between px-4 select-none z-20 overflow-hidden", isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200")}>
            <div className="flex-1 min-w-0 overflow-hidden">
              <ViewTabs />
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">

              {/* Terminal Toggle */}
              <button
                onClick={toggleTerminal}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  terminalOpen
                    ? isDark ? "bg-white/10 text-zinc-200" : "bg-zinc-200 text-zinc-700"
                    : isDark ? "hover:bg-white/5 text-zinc-400 hover:text-zinc-200" : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700"
                )}
                title="Toggle Terminal (Ctrl + `)"
              >
                <Terminal className="w-4 h-4" />
              </button>

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
            ) : activeTab === 'agent-builder' ? (
              <div className="absolute inset-0 overflow-hidden">
                <AgentBuilder />
              </div>
            ) : activeTab === 'architecture' ? (
              <ArchitectureView />
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
                <MermaidView className="absolute inset-0" />
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
            ) : activeTab === 'git' ? (
              <GitPanel />
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
              cwd={projectPath || undefined}
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

      {/* Save Toast */}
      <AnimatePresence>
        {saveToast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              'fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2',
              saveToast.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            )}
          >
            {saveToast.type === 'success' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="text-sm font-medium">{saveToast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

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
