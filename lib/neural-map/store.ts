/**
 * Neural Map Zustand Store
 * Global state management for the 3D knowledge graph
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'

enableMapSet()
import type {
  NeuralGraph,
  NeuralNode,
  NeuralEdge,
  NeuralCluster,
  NeuralFile,
  ViewTab,
  MermaidDiagramType,
  RightPanelTab,
  ModalType,
  HistoryAction,
  NodePosition,
  NeuralMapTheme,
  LayoutMode,
  StorageMode,
} from './types'
import {
  DEFAULT_THEME_ID,
  THEME_PRESETS,
  PANEL_SIZES,
  HISTORY_SETTINGS,
  CAMERA_SETTINGS,
} from './constants'

const normalizeFilePath = (path?: string) =>
  path && typeof path === 'string'
    ? path.replace(/\\+/g, '/').replace(/^\/+/, '') || undefined
    : undefined

const normalizeFiles = (files: NeuralFile[]) =>
  files.map((file) => ({
    ...file,
    path: normalizeFilePath(file.path),
  }))

// ============================================
// Store State Interface
// ============================================

interface CameraState {
  position: NodePosition
  target: NodePosition
  zoom?: number
}

interface NeuralMapState {
  // Map ID
  mapId: string | null

  // Graph Data
  graph: NeuralGraph | null
  isLoading: boolean
  error: string | null

  // Selection
  selectedNodeIds: string[]
  hoveredNodeId: string | null

  // View
  activeTab: ViewTab
  mermaidDiagramType: MermaidDiagramType
  rightPanelTab: RightPanelTab

  // Panels
  leftPanelWidth: number
  rightPanelWidth: number
  leftPanelCollapsed: boolean
  rightPanelCollapsed: boolean
  headerCollapsed: boolean

  // Camera
  cameraPosition: NodePosition
  cameraTarget: NodePosition
  cameraState: CameraState
  isAnimatingCamera: boolean

  // Modal
  modalType: ModalType
  modalData: unknown

  // Search
  searchQuery: string
  searchResults: NeuralNode[]
  isSearching: boolean

  // Theme
  themeId: string
  currentTheme: NeuralMapTheme

  // History
  history: HistoryAction[]
  historyIndex: number

  // Files
  files: NeuralFile[]

  // Agent Builder
  currentAgentFolder: string | null
  // 🔥 Agent Workflow (컴포넌트 재마운트 시에도 유지)
  agentWorkflowNodes: any[]
  agentWorkflowEdges: any[]
  agentWorkflowName: string | null

  // Simulation
  isSimulationRunning: boolean
  simulationAlpha: number

  // Expanded nodes (for lazy loading)
  expandedNodeIds: Set<string>

  // Editor
  editorOpen: boolean
  editorCollapsed: boolean
  editingFile: NeuralFile | null  // 편집 중인 파일 (기존 파일 열기)

  // Code Preview
  codePreviewFile: NeuralFile | null
  codePreviewOpen: boolean
  codePreviewEditMode: boolean
  codePreviewDirty: boolean

  // Graph Settings
  radialDistance: number // 방사 거리 (50~300)
  graphExpanded: boolean // 그래프 펼침 상태 (트리 접힘과 연동)
  layoutMode: LayoutMode // 레이아웃 모드 (원형/유기적)

  // Focus Node (for 2D graph camera movement)
  focusNodeId: string | null // 검색 시 포커스할 노드 ID

  // Terminal
  terminalOpen: boolean
  terminalHeight: number
  terminals: import('./types').TerminalInstance[]
  activeTerminalId: string | null
  activeGroupId: string | null

  // Project Path (for Mermaid auto-generation)
  projectPath: string | null

  // Linked Database Project (연결된 워크스페이스 프로젝트)
  linkedProjectId: string | null
  linkedProjectName: string | null

  // Save Modal (Cmd+S에서 모달 열기)
  showSaveModal: boolean

  // 🔥 파일 저장 전략 (local: 경로 참조만, supabase: 업로드, gcs: Google Cloud)
  storageMode: StorageMode
}

// ============================================
// Store Actions Interface
// ============================================

interface NeuralMapActions {
  // Map ID
  setMapId: (mapId: string | null) => void

  // Graph
  setGraph: (graph: NeuralGraph) => void
  clearGraph: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Nodes
  addNode: (node: NeuralNode) => void
  updateNode: (id: string, updates: Partial<NeuralNode>) => void
  deleteNode: (id: string) => void
  setNodePosition: (id: string, position: NodePosition) => void

  // Edges
  addEdge: (edge: NeuralEdge) => void
  deleteEdge: (id: string) => void

  // Clusters
  addCluster: (cluster: NeuralCluster) => void
  updateCluster: (id: string, updates: Partial<NeuralCluster>) => void
  deleteCluster: (id: string) => void

  // Selection
  selectNode: (id: string, multi?: boolean) => void
  selectNodes: (ids: string[]) => void
  setSelectedNodes: (ids: string[]) => void
  addSelectedNode: (id: string) => void
  deselectAll: () => void
  setHoveredNode: (id: string | null) => void

  // View
  setActiveTab: (tab: ViewTab) => void
  setMermaidDiagramType: (type: MermaidDiagramType) => void
  setRightPanelTab: (tab: RightPanelTab) => void

  // Panels
  setLeftPanelWidth: (width: number) => void
  setRightPanelWidth: (width: number) => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  toggleHeader: () => void

  // Camera
  setCameraPosition: (position: NodePosition) => void
  setCameraTarget: (target: NodePosition) => void
  setCameraState: (state: CameraState) => void
  focusOnNode: (nodeId: string) => void
  resetCamera: () => void
  setAnimatingCamera: (animating: boolean) => void

  // Modal
  openModal: (type: ModalType, data?: unknown) => void
  closeModal: () => void

  // Search
  setSearchQuery: (query: string) => void
  setSearchResults: (results: NeuralNode[]) => void
  setSearching: (searching: boolean) => void
  clearSearch: () => void

  // Theme
  setTheme: (themeId: string, customAccentColor?: string) => void

  // History
  pushHistory: (action: HistoryAction) => void
  undo: () => void
  redo: () => void
  clearHistory: () => void

  // Files
  setFiles: (files: NeuralFile[]) => void
  addFile: (file: NeuralFile) => void
  removeFile: (id: string) => void

  // Agent Builder
  setCurrentAgentFolder: (folder: string | null) => void
  // 🔥 Agent Workflow
  setAgentWorkflow: (name: string, nodes: any[], edges: any[]) => void
  clearAgentWorkflow: () => void

  // Simulation
  setSimulationRunning: (running: boolean) => void
  setSimulationAlpha: (alpha: number) => void

  // Expansion
  expandNode: (id: string) => void
  collapseNode: (id: string) => void
  toggleNodeExpansion: (id: string) => void
  setExpandedNodes: (ids: string[]) => void

  // Editor
  openEditor: () => void
  openEditorWithFile: (file: NeuralFile) => void  // 기존 파일 편집
  closeEditor: () => void
  toggleEditorCollapse: () => void

  // Code Preview
  openCodePreview: (file: NeuralFile) => void
  closeCodePreview: () => void
  setCodePreviewEditMode: (editMode: boolean) => void
  setCodePreviewDirty: (dirty: boolean) => void
  updateFileContent: (fileId: string, content: string) => void

  // Graph Settings
  setRadialDistance: (distance: number) => void
  setGraphExpanded: (expanded: boolean) => void
  setLayoutMode: (mode: LayoutMode) => void
  setFocusNodeId: (nodeId: string | null) => void

  // Terminal
  toggleTerminal: () => void
  setTerminalOpen: (open: boolean) => void
  setTerminalHeight: (height: number) => void
  addTerminal: (terminal: import('./types').TerminalInstance) => void
  removeTerminal: (id: string) => void
  splitTerminal: (sourceId: string, newTerminal: import('./types').TerminalInstance) => void
  setActiveTerminal: (id: string) => void
  updateTerminal: (id: string, updates: Partial<import('./types').TerminalInstance>) => void
  setTerminals: (terminals: import('./types').TerminalInstance[]) => void

  // Build graph from real files
  buildGraphFromFiles: () => void
  buildGraphFromFilesAsync: () => Promise<void>

  // Reset layout
  resetLayout: () => void

  // Project Path
  setProjectPath: (path: string | null) => void

  // Linked Database Project
  setLinkedProject: (projectId: string | null, projectName?: string | null) => void
  clearLinkedProject: () => void

  // Save Modal
  setShowSaveModal: (show: boolean) => void

  // 🔥 파일 저장 전략
  setStorageMode: (mode: StorageMode) => void
}

// ============================================
// Initial State
// ============================================

const initialState: NeuralMapState = {
  mapId: null,

  graph: null,
  isLoading: false,
  error: null,

  selectedNodeIds: [],
  hoveredNodeId: null,

  activeTab: 'map',
  mermaidDiagramType: 'flowchart',
  rightPanelTab: 'chat',

  leftPanelWidth: PANEL_SIZES.left.default,
  rightPanelWidth: PANEL_SIZES.right.default,
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  headerCollapsed: false,

  cameraPosition: CAMERA_SETTINGS.initialPosition,
  cameraTarget: CAMERA_SETTINGS.initialTarget,
  cameraState: {
    position: CAMERA_SETTINGS.initialPosition,
    target: CAMERA_SETTINGS.initialTarget,
  },
  isAnimatingCamera: false,

  modalType: null,
  modalData: null,

  searchQuery: '',
  searchResults: [],
  isSearching: false,

  themeId: DEFAULT_THEME_ID,
  currentTheme: THEME_PRESETS[0],

  history: [],
  historyIndex: -1,

  files: [],

  currentAgentFolder: null,
  // 🔥 Agent Workflow
  agentWorkflowNodes: [],
  agentWorkflowEdges: [],
  agentWorkflowName: null,

  isSimulationRunning: true,
  simulationAlpha: 1,

  expandedNodeIds: new Set(),

  editorOpen: false,
  editorCollapsed: false,
  editingFile: null,

  // Code Preview
  codePreviewFile: null,
  codePreviewOpen: false,
  codePreviewEditMode: false,
  codePreviewDirty: false,

  // Graph Settings
  radialDistance: 150, // 기본 방사 거리
  graphExpanded: true, // 기본 펼침 상태
  layoutMode: 'force',  // 🆕 기본 레이아웃: force (물리 시뮬레이션)
  focusNodeId: null, // 검색 시 포커스할 노드 ID

  // Terminal
  terminalOpen: false, // 기본 닫힘 상태
  terminalHeight: 250,
  terminals: [],
  activeTerminalId: null,
  activeGroupId: '1', // 기본값 설정

  projectPath: null,

  // Linked Database Project
  linkedProjectId: null,
  linkedProjectName: null,

  // Save Modal
  showSaveModal: false,

  // 🔥 파일 저장 전략: 기본값은 local (Electron에서 경로 참조만)
  storageMode: 'local' as StorageMode,
}

// ============================================
// Store
// ============================================

export const useNeuralMapStore = create<NeuralMapState & NeuralMapActions>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // ========== Map ID ==========
        setMapId: (mapId) =>
          set((state) => {
            state.mapId = mapId
          }),

        // ========== Graph ==========
        setGraph: (graph) =>
          set((state) => {
            state.graph = graph
            // viewState에서 expandedNodeIds 복원, 없으면 빈 Set
            const initialExpanded = new Set<string>(graph.viewState?.expandedNodeIds || [])
            // 루트(self) 노드는 항상 펼침 상태로 시작
            const selfNode = graph.nodes.find(n => n.type === 'project')
            if (selfNode) {
              initialExpanded.add(selfNode.id)
            }
            state.expandedNodeIds = initialExpanded
          }),

        clearGraph: () =>
          set((state) => {
            state.graph = null
            state.selectedNodeIds = []
            state.hoveredNodeId = null
            state.expandedNodeIds = new Set()
          }),

        setLoading: (loading) =>
          set((state) => {
            state.isLoading = loading
          }),

        setError: (error) =>
          set((state) => {
            state.error = error
          }),

        // ========== Nodes ==========
        addNode: (node) =>
          set((state) => {
            if (!state.graph) return
            state.graph.nodes.push(node)
            state.graph.updatedAt = new Date().toISOString()
          }),

        updateNode: (id, updates) =>
          set((state) => {
            if (!state.graph) return
            const index = state.graph.nodes.findIndex((n) => n.id === id)
            if (index !== -1) {
              state.graph.nodes[index] = {
                ...state.graph.nodes[index],
                ...updates,
                updatedAt: new Date().toISOString(),
              }
              state.graph.updatedAt = new Date().toISOString()
            }
          }),

        deleteNode: (id) =>
          set((state) => {
            if (!state.graph) return
            state.graph.nodes = state.graph.nodes.filter((n) => n.id !== id)
            state.graph.edges = state.graph.edges.filter(
              (e) => e.source !== id && e.target !== id
            )
            state.selectedNodeIds = state.selectedNodeIds.filter((nid) => nid !== id)
            state.expandedNodeIds.delete(id)
            state.graph.updatedAt = new Date().toISOString()
          }),

        setNodePosition: (id, position) =>
          set((state) => {
            if (!state.graph) return
            const node = state.graph.nodes.find((n) => n.id === id)
            if (node) {
              node.position = position
            }
          }),

        // ========== Edges ==========
        addEdge: (edge) =>
          set((state) => {
            if (!state.graph) return
            state.graph.edges.push(edge)
            state.graph.updatedAt = new Date().toISOString()
          }),

        deleteEdge: (id) =>
          set((state) => {
            if (!state.graph) return
            state.graph.edges = state.graph.edges.filter((e) => e.id !== id)
            state.graph.updatedAt = new Date().toISOString()
          }),

        // ========== Clusters ==========
        addCluster: (cluster) =>
          set((state) => {
            if (!state.graph) return
            state.graph.clusters.push(cluster)
            state.graph.updatedAt = new Date().toISOString()
          }),

        updateCluster: (id, updates) =>
          set((state) => {
            if (!state.graph) return
            const index = state.graph.clusters.findIndex((c) => c.id === id)
            if (index !== -1) {
              state.graph.clusters[index] = {
                ...state.graph.clusters[index],
                ...updates,
              }
              state.graph.updatedAt = new Date().toISOString()
            }
          }),

        deleteCluster: (id) =>
          set((state) => {
            if (!state.graph) return
            state.graph.clusters = state.graph.clusters.filter((c) => c.id !== id)
            // Clear cluster reference from nodes
            state.graph.nodes.forEach((n) => {
              if (n.clusterId === id) {
                n.clusterId = undefined
              }
            })
            state.graph.updatedAt = new Date().toISOString()
          }),

        // ========== Selection ==========
        selectNode: (id, multi = false) =>
          set((state) => {
            if (multi) {
              if (state.selectedNodeIds.includes(id)) {
                state.selectedNodeIds = state.selectedNodeIds.filter((nid) => nid !== id)
              } else {
                state.selectedNodeIds.push(id)
              }
            } else {
              state.selectedNodeIds = [id]
            }
          }),

        selectNodes: (ids) =>
          set((state) => {
            state.selectedNodeIds = ids
          }),

        setSelectedNodes: (ids) =>
          set((state) => {
            state.selectedNodeIds = ids
          }),

        addSelectedNode: (id) =>
          set((state) => {
            if (!state.selectedNodeIds.includes(id)) {
              state.selectedNodeIds.push(id)
            }
          }),

        deselectAll: () =>
          set((state) => {
            state.selectedNodeIds = []
          }),

        setHoveredNode: (id) =>
          set((state) => {
            state.hoveredNodeId = id
          }),

        // ========== View ==========
        setActiveTab: (tab) =>
          set((state) => {
            state.activeTab = tab
          }),

        setMermaidDiagramType: (type) =>
          set((state) => {
            state.mermaidDiagramType = type
          }),

        setRightPanelTab: (tab) =>
          set((state) => {
            state.rightPanelTab = tab
          }),

        // ========== Panels ==========
        setLeftPanelWidth: (width) =>
          set((state) => {
            state.leftPanelWidth = Math.max(
              PANEL_SIZES.left.min,
              Math.min(PANEL_SIZES.left.max, width)
            )
          }),

        setRightPanelWidth: (width) =>
          set((state) => {
            state.rightPanelWidth = Math.max(
              PANEL_SIZES.right.min,
              Math.min(PANEL_SIZES.right.max, width)
            )
          }),

        toggleLeftPanel: () =>
          set((state) => {
            state.leftPanelCollapsed = !state.leftPanelCollapsed
            // 그래프 펼침 상태도 연동 (패널 열림 = 그래프 펼침)
            state.graphExpanded = !state.leftPanelCollapsed
          }),

        toggleRightPanel: () =>
          set((state) => {
            state.rightPanelCollapsed = !state.rightPanelCollapsed
          }),

        toggleHeader: () =>
          set((state) => {
            state.headerCollapsed = !state.headerCollapsed
          }),

        // ========== Camera ==========
        setCameraPosition: (position) =>
          set((state) => {
            state.cameraPosition = position
          }),

        setCameraTarget: (target) =>
          set((state) => {
            state.cameraTarget = target
          }),

        setCameraState: (cameraState) =>
          set((state) => {
            state.cameraState = cameraState
            state.cameraPosition = cameraState.position
            state.cameraTarget = cameraState.target
          }),

        focusOnNode: (nodeId) =>
          set((state) => {
            const node = state.graph?.nodes.find((n) => n.id === nodeId)
            if (node?.position) {
              state.cameraTarget = node.position
              state.cameraPosition = {
                x: node.position.x,
                y: node.position.y + 50,
                z: node.position.z + CAMERA_SETTINGS.focusOffset,
              }
              state.isAnimatingCamera = true
            }
          }),

        resetCamera: () =>
          set((state) => {
            state.cameraPosition = CAMERA_SETTINGS.initialPosition
            state.cameraTarget = CAMERA_SETTINGS.initialTarget
            state.isAnimatingCamera = true
          }),

        setAnimatingCamera: (animating) =>
          set((state) => {
            state.isAnimatingCamera = animating
          }),

        // ========== Modal ==========
        openModal: (type, data) =>
          set((state) => {
            state.modalType = type
            state.modalData = data
          }),

        closeModal: () =>
          set((state) => {
            state.modalType = null
            state.modalData = null
          }),

        // ========== Search ==========
        setSearchQuery: (query) =>
          set((state) => {
            state.searchQuery = query
          }),

        setSearchResults: (results) =>
          set((state) => {
            state.searchResults = results
          }),

        setSearching: (searching) =>
          set((state) => {
            state.isSearching = searching
          }),

        clearSearch: () =>
          set((state) => {
            state.searchQuery = ''
            state.searchResults = []
            state.isSearching = false
          }),

        // ========== Theme ==========
        setTheme: (themeId, customAccentColor) =>
          set((state) => {
            const theme = THEME_PRESETS.find((t) => t.id === themeId)
            if (theme) {
              state.themeId = themeId
              // Deep copy to avoid mutating the constant
              state.currentTheme = JSON.parse(JSON.stringify(theme))

              // If a custom accent color is provided, override it
              if (customAccentColor) {
                state.currentTheme.ui.accentColor = customAccentColor
                // Also update node colors if needed, but primary UI accent is key
              }
            }
          }),

        // ========== History ==========
        pushHistory: (action) =>
          set((state) => {
            // Truncate future history if we're in the middle
            if (state.historyIndex < state.history.length - 1) {
              state.history = state.history.slice(0, state.historyIndex + 1)
            }
            // Add new action
            state.history.push(action)
            // Limit history size
            if (state.history.length > HISTORY_SETTINGS.maxActions) {
              state.history.shift()
            } else {
              state.historyIndex++
            }
          }),

        undo: () =>
          set((state) => {
            if (state.historyIndex >= 0) {
              const action = state.history[state.historyIndex]
              // Apply inverse action
              // (Implementation depends on action type)
              state.historyIndex--
            }
          }),

        redo: () =>
          set((state) => {
            if (state.historyIndex < state.history.length - 1) {
              state.historyIndex++
              const action = state.history[state.historyIndex]
              // Apply action
              // (Implementation depends on action type)
            }
          }),

        clearHistory: () =>
          set((state) => {
            state.history = []
            state.historyIndex = -1
          }),

        // ========== Files ==========
        setFiles: (files) =>
          set((state) => {
            state.files = normalizeFiles(files)
          }),

        addFile: (file) =>
          set((state) => {
            state.files.push({
              ...file,
              path: normalizeFilePath(file.path),
            })
          }),

        removeFile: (id) =>
          set((state) => {
            state.files = state.files.filter((f) => f.id !== id)
          }),

        // ========== Agent Builder ==========
        setCurrentAgentFolder: (folder) =>
          set((state) => {
            state.currentAgentFolder = folder
          }),

        // 🔥 Agent Workflow
        setAgentWorkflow: (name, nodes, edges) =>
          set((state) => {
            state.agentWorkflowName = name
            state.agentWorkflowNodes = nodes
            state.agentWorkflowEdges = edges
            console.log('[Store] setAgentWorkflow:', { name, nodesCount: nodes.length, edgesCount: edges.length })
          }),

        clearAgentWorkflow: () =>
          set((state) => {
            state.agentWorkflowName = null
            state.agentWorkflowNodes = []
            state.agentWorkflowEdges = []
          }),

        // ========== Simulation ==========
        setSimulationRunning: (running) =>
          set((state) => {
            state.isSimulationRunning = running
          }),

        setSimulationAlpha: (alpha) =>
          set((state) => {
            state.simulationAlpha = alpha
          }),

        // ========== Expansion ==========
        expandNode: (id) =>
          set((state) => {
            // 새로운 Set 생성으로 React 리렌더링 트리거
            state.expandedNodeIds = new Set([...state.expandedNodeIds, id])
            const node = state.graph?.nodes.find((n) => n.id === id)
            if (node) {
              node.expanded = true
            }
          }),

        collapseNode: (id) =>
          set((state) => {
            // 새로운 Set 생성으로 React 리렌더링 트리거
            const newSet = new Set(state.expandedNodeIds)
            newSet.delete(id)
            state.expandedNodeIds = newSet
            const node = state.graph?.nodes.find((n) => n.id === id)
            if (node) {
              node.expanded = false
            }
          }),

        toggleNodeExpansion: (id) => {
          const state = get()
          if (state.expandedNodeIds.has(id)) {
            get().collapseNode(id)
          } else {
            get().expandNode(id)
          }
        },

        setExpandedNodes: (ids) =>
          set((state) => {
            state.expandedNodeIds = new Set(ids)
          }),

        // ========== Editor ==========
        openEditor: () => {
          // untitled 파일명 생성 (untitled, untitled1, untitled2, ...)
          const state = get()
          const existingUntitled = state.files
            .filter(f => f.name.match(/^untitled\d*\.md$/i))
            .map(f => {
              const match = f.name.match(/^untitled(\d*)\.md$/i)
              return match?.[1] ? parseInt(match[1]) : 0
            })

          let suffix = ''
          if (existingUntitled.length > 0) {
            const maxNum = Math.max(...existingUntitled)
            suffix = String(maxNum + 1)
          }

          const fileName = `untitled${suffix}.md`
          const newFile: NeuralFile = {
            id: `untitled-${Date.now()}`,
            mapId: state.mapId || '',
            name: fileName,
            path: fileName,
            url: '',
            size: 0,
            content: '',
            type: 'markdown',
            createdAt: new Date().toISOString(),
          }

          set((s) => {
            // 파일 추가
            s.files.push(newFile)
            // 에디터 열기
            s.editorOpen = true
            s.editorCollapsed = false
            s.editingFile = newFile
          })

          // 그래프 업데이트
          get().buildGraphFromFilesAsync()
        },
        openEditorWithFile: (file: NeuralFile) =>
          set((state) => {
            state.editorOpen = true
            state.editorCollapsed = false
            state.editingFile = file  // 기존 파일 편집 모드
          }),
        closeEditor: () =>
          set((state) => {
            state.editorOpen = false
            state.editingFile = null
          }),
        toggleEditorCollapse: () =>
          set((state) => {
            state.editorCollapsed = !state.editorCollapsed
          }),

        // ========== Code Preview ==========
        openCodePreview: (file: NeuralFile) =>
          set((state) => {
            state.codePreviewFile = file
            state.codePreviewOpen = true
            state.codePreviewEditMode = false
            state.codePreviewDirty = false
          }),
        closeCodePreview: () =>
          set((state) => {
            state.codePreviewOpen = false
            state.codePreviewFile = null
            state.codePreviewEditMode = false
            state.codePreviewDirty = false
          }),
        setCodePreviewEditMode: (editMode: boolean) =>
          set((state) => {
            state.codePreviewEditMode = editMode
          }),
        setCodePreviewDirty: (dirty: boolean) =>
          set((state) => {
            state.codePreviewDirty = dirty
          }),
        updateFileContent: (fileId: string, content: string) =>
          set((state) => {
            // Update file content in files array
            const fileIndex = state.files.findIndex(f => f.id === fileId)
            if (fileIndex !== -1) {
              state.files[fileIndex].content = content
            }
            // Update current preview file if it matches
            if (state.codePreviewFile?.id === fileId) {
              state.codePreviewFile.content = content
            }
            state.codePreviewDirty = false
          }),

        // ========== Graph Settings ==========
        setRadialDistance: (distance: number) =>
          set((state) => {
            state.radialDistance = distance
          }),
        setGraphExpanded: (expanded: boolean) =>
          set((state) => {
            state.graphExpanded = expanded
          }),
        setLayoutMode: (mode: LayoutMode) =>
          set((state) => {
            state.layoutMode = mode
            // 레이아웃 변경 시 시뮬레이션 재가열
            state.isSimulationRunning = true
            state.simulationAlpha = 1
          }),

        setFocusNodeId: (nodeId: string | null) =>
          set((state) => {
            state.focusNodeId = nodeId
            // 노드 포커스 시 선택 상태도 업데이트
            if (nodeId) {
              state.selectedNodeIds = [nodeId]
            }
          }),

        // ========== Build logic ==========

        buildGraphFromFiles: () =>
          set((state) => {
            const currentFiles = state.files

            const generateId = () => `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            const edgeTracker = new Set<string>()

            // 프로젝트명 우선순위: linkedProjectName > projectPath 폴더명 > 'My Project'
            const getProjectName = (): string => {
              if (state.linkedProjectName) return state.linkedProjectName
              if (state.projectPath) {
                const parts = state.projectPath.replace(/\\/g, '/').split('/')
                return parts[parts.length - 1] || parts[parts.length - 2] || 'My Project'
              }
              return 'My Project'
            }
            const projectName = getProjectName()

            // 파일이 없어도 프로젝트 루트 노드는 생성
            if (!currentFiles || currentFiles.length === 0) {
              const rootNode: NeuralNode = {
                id: 'node-root',
                type: 'project',
                title: projectName,
                summary: '빈 프로젝트',
                tags: ['project'],
                importance: 10,
                expanded: true,
                pinned: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }

              const emptyGraph: NeuralGraph = {
                version: '2.0',
                userId: '',
                rootNodeId: rootNode.id,
                title: projectName,
                nodes: [rootNode],
                edges: [],
                clusters: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                viewState: {
                  activeTab: 'map',
                  expandedNodeIds: [rootNode.id],
                  pinnedNodeIds: [],
                  selectedNodeIds: [],
                  cameraPosition: { x: 0, y: 0, z: 0 },
                  cameraTarget: { x: 0, y: 0, z: 0 },
                },
                themeId: state.themeId || 'cosmic-dark',
              }

              state.graph = emptyGraph
              state.expandedNodeIds = new Set([rootNode.id])
              return
            }

            const addUniqueEdge = (edge: NeuralEdge, edges: NeuralEdge[]) => {
              const pairId = [edge.source, edge.target].sort().join('-')
              if (edge.type === 'parent_child' || !edgeTracker.has(pairId)) {
                edges.push(edge)
                if (edge.type !== 'parent_child') edgeTracker.add(pairId)
                return true
              }
              return false
            }

            const resolvePath = (fromPath: string, importPath: string, fileNodeMap: Map<string, string>): string | null => {
              if (!importPath) return null;
              if (importPath.startsWith('.')) {
                const fromDir = fromPath.includes('/') ? fromPath.substring(0, fromPath.lastIndexOf('/')) : '';
                const parts = fromDir ? fromDir.split('/') : [];
                const importParts = importPath.split('/');
                for (const part of importParts) {
                  if (part === '.') continue;
                  if (part === '..') parts.pop();
                  else parts.push(part);
                }
                const resolved = parts.join('/');
                const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.py'];
                for (const ext of extensions) {
                  if (fileNodeMap.has(resolved + ext)) return resolved + ext;
                  if (fileNodeMap.has(resolved + '/index' + ext)) return resolved + '/index' + ext;
                }
              } else {
                const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.py'];
                for (const ext of extensions) {
                  if (fileNodeMap.has(importPath + ext)) return importPath + ext;
                  if (fileNodeMap.has(projectName + '/' + importPath + ext)) return projectName + '/' + importPath + ext;
                }
              }
              return null;
            };

            const rootNode: NeuralNode = {
              id: 'node-root',
              type: 'project',
              title: projectName,
              summary: `${currentFiles.length}개 파일`,
              tags: ['project'],
              importance: 10,
              expanded: true,
              pinned: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }

            const nodes: NeuralNode[] = [rootNode];
            const edges: NeuralEdge[] = []
            const folderMap = new Map<string, string>();
            folderMap.set('', rootNode.id)
            const fileNodeMap = new Map<string, string>()

            const allFolderPaths = new Set<string>()
            currentFiles.forEach((file: any) => {
              const filePath = file.path || file.name
              const parts = filePath.split('/')
              for (let i = 1; i < parts.length; i++) allFolderPaths.add(parts.slice(0, i).join('/'))
            })

            Array.from(allFolderPaths).sort((a, b) => a.split('/').length - b.split('/').length).forEach(folderPath => {
              if (folderPath === projectName) { folderMap.set(folderPath, rootNode.id); return; }
              const folderId = generateId();
              const folderName = folderPath.split('/').pop() || folderPath
              const parentPath = folderPath.includes('/') ? folderPath.substring(0, folderPath.lastIndexOf('/')) : ''
              nodes.push({
                id: folderId, type: 'folder', title: folderName, summary: `폴더: ${folderPath}`,
                tags: ['folder'], importance: 7, parentId: folderMap.get(parentPath) || rootNode.id,
                expanded: true, pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
              })
              folderMap.set(folderPath, folderId)
              addUniqueEdge({
                id: generateId(), source: folderMap.get(parentPath) || rootNode.id, target: folderId,
                type: 'parent_child', weight: 0.1, bidirectional: false, createdAt: new Date().toISOString(),
              }, edges)
            })

            currentFiles.forEach((file: any) => {
              const fileId = generateId();
              const filePath = file.path || file.name
              const ext = file.name.split('.').pop()?.toLowerCase() || ''
              const fileType = ['tsx', 'ts', 'js', 'jsx'].includes(ext) ? 'code' :
                ext === 'css' || ext === 'scss' ? 'style' : ext === 'json' || ext === 'env' ? 'config' : ext === 'md' ? 'doc' : 'file'
              const parentPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : ''
              const parentId = folderMap.get(parentPath) || rootNode.id
              nodes.push({
                id: fileId, type: fileType as any, title: file.name, summary: filePath,
                tags: [ext, fileType], importance: 5, parentId, expanded: true, pinned: false,
                createdAt: file.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
                sourceRef: { fileId: file.id, kind: file.type as any }
              })
              fileNodeMap.set(filePath, fileId)
              addUniqueEdge({
                id: generateId(), source: parentId, target: fileId, type: 'parent_child',
                weight: 0.1, bidirectional: false, createdAt: new Date().toISOString(),
              }, edges)
            })

            const htmlSelectors = new Map<string, Set<string>>();
            const cssSelectors = new Map<string, Set<string>>()
            currentFiles.forEach((file: any) => {
              const content = file.content || '';
              if (!content) return
              const ext = file.name.split('.').pop()?.toLowerCase() || ''
              if (ext === 'html' || ext === 'htm') {
                const idRegex = /id=["']([^"']+)["']/gi;
                const classRegex = /class=["']([^"']+)["']/gi;
                const sels = new Set<string>()
                let m;
                while ((m = idRegex.exec(content))) sels.add(m[1])
                while ((m = classRegex.exec(content))) m[1].split(/\s+/).forEach((c: any) => c && sels.add(c))
                if (sels.size > 0) htmlSelectors.set(file.path || file.name, sels)
              } else if (ext === 'css' || ext === 'scss') {
                const classRegex = /\.([a-zA-Z0-9_-]+)/g;
                const idRegex = /#([a-zA-Z0-9_-]+)/g;
                const sels = new Set<string>()
                let m;
                while ((m = classRegex.exec(content))) sels.add(m[1])
                while ((m = idRegex.exec(content))) sels.add(m[1])
                if (sels.size > 0) cssSelectors.set(file.path || file.name, sels)
              }
            })

            currentFiles.forEach((file: any) => {
              const content = file.content || '';
              if (!content) return
              const filePath = file.path || file.name;
              const sourceId = fileNodeMap.get(filePath);
              if (!sourceId) return
              const ext = file.name.split('.').pop()?.toLowerCase() || ''
              if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
                const jsImportRegex = /(?:import|from|require)\s*\(?\s*['"]([^'"]+)['"]\s*\)?/g;
                let m
                while ((m = jsImportRegex.exec(content))) {
                  const targetPath = resolvePath(filePath, m[1], fileNodeMap)
                  if (targetPath && fileNodeMap.has(targetPath)) {
                    addUniqueEdge({
                      id: generateId(), source: sourceId, target: fileNodeMap.get(targetPath)!,
                      type: 'imports', label: 'import', weight: 0.8, bidirectional: false, createdAt: new Date().toISOString()
                    }, edges)
                  }
                }
                htmlSelectors.forEach((sels, hPath) => {
                  const tId = fileNodeMap.get(hPath);
                  if (!tId || tId === sourceId) return
                  for (const s of Array.from(sels)) if (content.includes(s)) {
                    addUniqueEdge({
                      id: generateId(), source: sourceId, target: tId, type: 'semantic', label: 'functional',
                      weight: 0.3, bidirectional: true, createdAt: new Date().toISOString()
                    }, edges);
                    break
                  }
                })
              }
              if (ext === 'html' || ext === 'htm') {
                cssSelectors.forEach((sels, cPath) => {
                  const tId = fileNodeMap.get(cPath);
                  if (!tId || tId === sourceId) return
                  const htmlSels = htmlSelectors.get(filePath);
                  if (!htmlSels) return
                  for (const s of Array.from(sels)) if (htmlSels.has(s)) {
                    addUniqueEdge({
                      id: generateId(), source: sourceId, target: tId, type: 'semantic', label: 'style',
                      weight: 0.5, bidirectional: true, createdAt: new Date().toISOString()
                    }, edges);
                    break
                  }
                })
              }
            })

            const graphData: NeuralGraph = {
              version: '2.0',
              userId: '',
              rootNodeId: rootNode.id,
              title: projectName,
              nodes,
              edges,
              clusters: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              viewState: {
                activeTab: 'map',
                expandedNodeIds: [rootNode.id],
                pinnedNodeIds: [],
                selectedNodeIds: [],
                cameraPosition: { x: 0, y: 0, z: 0 },
                cameraTarget: { x: 0, y: 0, z: 0 },
              },
              themeId: state.themeId || 'cosmic-dark',
            }

            if (state.graph) {
              state.graph.nodes = nodes
              state.graph.edges = edges
              state.graph.updatedAt = graphData.updatedAt
            } else {
              state.graph = graphData
            }
            // 모든 폴더 노드를 기본적으로 펼침 (방사형 그래프에서 모든 노드 표시)
            const allFolderIds = nodes
              .filter((n) => n.type === 'folder' || n.type === 'project')
              .map((n) => n.id)
            state.expandedNodeIds = new Set([
              rootNode.id,
              ...allFolderIds
            ])
          }),

        // Async version using Web Worker (non-blocking)
        buildGraphFromFilesAsync: async () => {
          const state = get()
          const currentFiles = state.files
          console.log('[buildGraphFromFilesAsync] Called:', {
            filesCount: currentFiles?.length || 0,
            linkedProjectName: state.linkedProjectName,
            projectPath: state.projectPath,
            hasGraph: !!state.graph,
            graphNodes: state.graph?.nodes?.length || 0
          })

          // 🆕 기존 그래프에서 DB에서 온 노드들 (에이전트 등) 보존
          const existingGraph = state.graph
          const existingDbNodes = existingGraph?.nodes?.filter((n: NeuralNode) => {
            // DB에서 온 노드는 UUID 형태이고 sourceRef가 있음 (에이전트, person 등)
            const hasSourceRef = n.sourceRef && (
              (n.sourceRef as any).isAgent === true ||
              (n.sourceRef as any).agentId
            )
            // 또는 DB에서 온 project/person 노드 (UUID 형태 ID)
            const isDbNode = n.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
            return hasSourceRef || isDbNode
          }) || []

          const existingDbEdges = existingGraph?.edges?.filter((e: NeuralEdge) => {
            // DB 노드와 연결된 엣지 보존
            return existingDbNodes.some((n) => n.id === e.sourceId || n.id === e.targetId)
          }) || []

          console.log('[buildGraphFromFilesAsync] 📌 Preserving DB nodes:', existingDbNodes.map((n: NeuralNode) => ({
            id: n.id,
            title: n.title,
            type: n.type,
            isAgent: (n.sourceRef as any)?.isAgent
          })))

          // 파일이 없어도 프로젝트 루트 노드는 생성
          if (!currentFiles || currentFiles.length === 0) {
            console.log('[buildGraphFromFilesAsync] Creating empty project graph for:', state.linkedProjectName || state.projectPath || 'My Project')
            // 프로젝트명 우선순위: linkedProjectName > projectPath 폴더명 > 'My Project'
            const getProjectName = (): string => {
              if (state.linkedProjectName) return state.linkedProjectName
              if (state.projectPath) {
                const parts = state.projectPath.replace(/\\/g, '/').split('/')
                return parts[parts.length - 1] || parts[parts.length - 2] || 'My Project'
              }
              return 'My Project'
            }
            const projectName = getProjectName()

            // 🆕 기존 DB 루트 노드가 있으면 재사용, 없으면 새로 생성
            const existingRootNode = existingDbNodes.find((n: NeuralNode) => n.type === 'project' || n.type === 'self')
            const rootNode: NeuralNode = existingRootNode || {
              id: 'node-root',
              type: 'project',
              title: projectName,
              summary: '빈 프로젝트',
              tags: ['project'],
              importance: 10,
              expanded: true,
              pinned: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }

            // 🆕 DB 노드들을 포함한 그래프 생성
            const mergedNodes = [rootNode, ...existingDbNodes.filter((n: NeuralNode) => n.id !== rootNode.id)]

            const emptyGraph: NeuralGraph = {
              version: '2.0',
              userId: '',
              rootNodeId: rootNode.id,
              title: projectName,
              nodes: mergedNodes,
              edges: existingDbEdges,
              clusters: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              viewState: {
                activeTab: 'map',
                expandedNodeIds: mergedNodes.map((n) => n.id),
                pinnedNodeIds: [],
                selectedNodeIds: [],
                cameraPosition: { x: 0, y: 0, z: 0 },
                cameraTarget: { x: 0, y: 0, z: 0 },
              },
              themeId: state.themeId || 'cosmic-dark',
            }

            set((s) => {
              s.graph = emptyGraph
              s.expandedNodeIds = new Set(mergedNodes.map((n) => n.id))
            })
            console.log('[buildGraphFromFilesAsync] ✅ Empty project graph created:', {
              title: projectName,
              nodes: mergedNodes.length,
              dbNodes: existingDbNodes.length
            })
            return
          }

          set((s) => {
            s.isLoading = true
          })

          try {
            // Dynamic import to avoid SSR issues
            const { buildGraphAsync } = await import('./workers/useGraphWorker')
            const result = await buildGraphAsync(currentFiles, state.themeId, state.projectPath, state.linkedProjectName)

            console.log(`[Worker] Graph built: ${result.stats.nodeCount} nodes, ${result.stats.edgeCount} edges in ${result.stats.elapsed}ms`)

            // 📁 폴더 노드 상세 로그
            const folderNodes = result.graph.nodes.filter((n) => n.type === 'folder')
            const rootNode = result.graph.nodes.find((n) => n.type === 'project')
            console.log('[buildGraphFromFilesAsync] 📁 Folder nodes created:', folderNodes.map((n) => ({
              id: n.id,
              title: n.title,
              parentId: (n as any).parentId,
              isFirstLevel: (n as any).parentId === rootNode?.id
            })))

            set((s) => {
              // 🆕 파일 기반 노드와 DB 노드를 병합
              // DB 노드는 이미 existingDbNodes에 보존됨
              const fileNodeIds = new Set(result.graph.nodes.map((n) => n.id))

              // 🔥 중복 루트 노드 방지: DB에서 project/self 타입 노드는 제외
              // (워커가 이미 "node-root"로 루트 노드를 생성하므로 중복됨)
              const dbNodesToAdd = existingDbNodes.filter((n: NeuralNode) => {
                // ID가 이미 있으면 제외
                if (fileNodeIds.has(n.id)) return false
                // project/self 타입은 루트 노드이므로 제외 (워커가 이미 생성)
                if (n.type === 'project' || n.type === 'self') return false
                return true
              })
              const mergedNodes = [...result.graph.nodes, ...dbNodesToAdd]

              // 엣지도 병합
              const fileEdgeIds = new Set(result.graph.edges.map((e) => e.id))
              const dbEdgesToAdd = existingDbEdges.filter((e: NeuralEdge) => !fileEdgeIds.has(e.id))
              const mergedEdges = [...result.graph.edges, ...dbEdgesToAdd]

              console.log('[buildGraphFromFilesAsync] 📌 Merging nodes:', {
                fileNodes: result.graph.nodes.length,
                dbNodes: dbNodesToAdd.length,
                total: mergedNodes.length
              })

              if (s.graph) {
                s.graph.nodes = mergedNodes
                s.graph.edges = mergedEdges
                s.graph.updatedAt = result.graph.updatedAt
              } else {
                s.graph = {
                  ...result.graph,
                  nodes: mergedNodes,
                  edges: mergedEdges
                }
              }
              // 🔥 모든 노드를 기본적으로 펼침 (방사형 그래프에서 모든 노드 표시)
              const allNodeIds = mergedNodes.map((n) => n.id)

              s.expandedNodeIds = new Set(allNodeIds)
              console.log('[buildGraphFromFilesAsync] ✅ expandedNodeIds set (all nodes):', allNodeIds.length, 'nodes')
              s.isLoading = false
            })
          } catch (error) {
            console.error('[Worker] Graph building failed:', error)
            console.log('[buildGraphFromFilesAsync] Falling back to sync version')
            // Fallback to sync version
            get().buildGraphFromFiles()
            const syncState = get()
            console.log('[buildGraphFromFilesAsync] After sync fallback, graph nodes:', syncState.graph?.nodes?.length || 0)
            set((s) => {
              s.isLoading = false
            })
          }
        },

        // ========== Terminal ==========
        toggleTerminal: () =>
          set((state) => {
            state.terminalOpen = !state.terminalOpen
          }),

        setTerminalOpen: (open) =>
          set((state) => {
            state.terminalOpen = open
          }),

        setTerminalHeight: (height) =>
          set((state) => {
            state.terminalHeight = height
          }),

        addTerminal: (terminal) =>
          set((state) => {
            state.terminals.push(terminal)
            state.activeTerminalId = terminal.id
            state.activeGroupId = terminal.groupId
          }),

        removeTerminal: (id) =>
          set((state) => {
            const terminalToRemove = state.terminals.find(t => t.id === id)
            if (!terminalToRemove) return

            state.terminals = state.terminals.filter(t => t.id !== id)

            // If active terminal was removed, select another
            if (state.activeTerminalId === id) {
              const sameGroup = state.terminals.filter(t => t.groupId === terminalToRemove.groupId)
              if (sameGroup.length > 0) {
                state.activeTerminalId = sameGroup[sameGroup.length - 1].id
              } else if (state.terminals.length > 0) {
                state.activeTerminalId = state.terminals[state.terminals.length - 1].id
                state.activeGroupId = state.terminals[state.terminals.length - 1].groupId
              } else {
                state.activeTerminalId = null
                state.activeGroupId = null
              }
            }
          }),

        splitTerminal: (sourceId, newTerminal) =>
          set((state) => {
            const sourceIndex = state.terminals.findIndex(t => t.id === sourceId)
            if (sourceIndex === -1) {
              state.terminals.push(newTerminal)
            } else {
              // Insert after source
              state.terminals.splice(sourceIndex + 1, 0, newTerminal)
            }
            state.activeTerminalId = newTerminal.id
          }),

        setActiveTerminal: (id) =>
          set((state) => {
            state.activeTerminalId = id
            const term = state.terminals.find(t => t.id === id)
            if (term) {
              state.activeGroupId = term.groupId
            }
          }),

        updateTerminal: (id, updates) =>
          set((state) => {
            const term = state.terminals.find(t => t.id === id)
            if (term) {
              Object.assign(term, updates)
            }
          }),

        setTerminals: (terminals) =>
          set((state) => {
            state.terminals = terminals
          }),

        resetLayout: () =>
          set((state) => {
            if (!state.graph) return
            // 모든 노드의 고정 위치 해제 및 초기화
            state.graph.nodes.forEach((node) => {
              node.position = undefined
              // @ts-ignore
              delete node.fx
              // @ts-ignore
              delete node.fy
              // @ts-ignore
              delete node.fz
            })
            // 시뮬레이션 재가열을 위해 alpha 값 리셋 (NeuralMapCanvas/CosmicForceGraph에서 감지)
            state.isSimulationRunning = true
            state.simulationAlpha = 1
          }),

        // Project Path
        setProjectPath: (path) => {
          const currentState = get()
          const linkedProjectId = currentState.linkedProjectId

          set((state) => {
            state.projectPath = path
            // 프로젝트가 연결되어 있으면 폴더 경로 매핑 저장 (localStorage 백업)
            if (path && state.linkedProjectId && typeof window !== 'undefined') {
              try {
                const mappings = JSON.parse(localStorage.getItem('project-folder-mappings') || '{}')
                mappings[state.linkedProjectId] = path
                localStorage.setItem('project-folder-mappings', JSON.stringify(mappings))
                console.log('[NeuralMap Store] Saved folder path to localStorage:', state.linkedProjectId, '->', path)
              } catch (e) {
                console.error('[NeuralMap Store] Failed to save folder mapping:', e)
              }
            }
          })

          // 🔥 프로젝트가 연결되어 있으면 DB에도 folder_path 저장 (터미널에서 사용)
          if (path && linkedProjectId && typeof window !== 'undefined') {
            fetch(`/api/projects/${linkedProjectId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ folder_path: path })
            })
              .then(res => {
                if (res.ok) {
                  console.log('[NeuralMap Store] Saved folder_path to DB:', linkedProjectId, '->', path)
                } else {
                  console.error('[NeuralMap Store] Failed to save folder_path to DB:', res.status)
                }
              })
              .catch(err => {
                console.error('[NeuralMap Store] Failed to save folder_path to DB:', err)
              })
          }
        },

        // Linked Database Project
        setLinkedProject: (projectId, projectName = null) => {
          const currentState = get()
          const isProjectChanged = currentState.linkedProjectId !== projectId

          set((state) => {
            // 🔥 프로젝트가 변경되면 기존 그래프만 클리어 (projectPath는 유지!)
            if (isProjectChanged && state.linkedProjectId !== null) {
              console.log('[NeuralMap Store] Project changed, clearing graph:', state.linkedProjectId, '->', projectId)
              state.graph = null
              state.files = []
              state.mapId = null
              // 🔥 projectPath는 클리어하지 않음 - setProjectPath에서 별도로 설정됨
            }

            state.linkedProjectId = projectId
            state.linkedProjectName = projectName ?? null
            console.log('[NeuralMap Store] Project linked:', projectId, projectName)
          })

          // 🔥 프로젝트 연결 시 DB에서 folder_path 자동 가져오기 (브라우저 환경에서만)
          if (projectId && isProjectChanged && typeof window !== 'undefined') {
            const currentProjectPath = get().projectPath
            if (!currentProjectPath) {
              console.log('[NeuralMap Store] 🔍 Fetching folder_path from DB:', projectId)
              fetch(`/api/projects/${projectId}`)
                .then(res => res.ok ? res.json() : null)
                .then(project => {
                  if (project?.folder_path) {
                    console.log('[NeuralMap Store] ✅ Auto-setting projectPath from DB:', project.folder_path)
                    get().setProjectPath(project.folder_path)
                  }
                })
                .catch(err => {
                  console.error('[NeuralMap Store] Failed to fetch folder_path:', err)
                })
            }
          }
        },

        clearLinkedProject: () =>
          set((state) => {
            state.linkedProjectId = null
            state.linkedProjectName = null
            state.projectPath = null
            state.graph = null
            state.files = []
            console.log('[NeuralMap Store] Cleared linked project and graph')
          }),

        // Save Modal
        setShowSaveModal: (show) =>
          set((state) => {
            state.showSaveModal = show
          }),

        // 🔥 파일 저장 전략
        setStorageMode: (mode) =>
          set((state) => {
            state.storageMode = mode
            console.log('[NeuralMap Store] Storage mode changed:', mode)
          }),
      })),
      {
        name: 'neural-map-storage',
        partialize: (state: any) => ({
          // UI 설정
          themeId: state.themeId,
          leftPanelWidth: state.leftPanelWidth,
          rightPanelWidth: state.rightPanelWidth,
          leftPanelCollapsed: state.leftPanelCollapsed,
          rightPanelCollapsed: state.rightPanelCollapsed,
          radialDistance: state.radialDistance,
          // 🔥 프로젝트 정보 저장 (새로고침해도 유지)
          linkedProjectId: state.linkedProjectId,
          linkedProjectName: state.linkedProjectName,
          projectPath: state.projectPath,
          // 🔥 Agent Builder 에이전트 폴더 (새로고침해도 유지)
          currentAgentFolder: state.currentAgentFolder,
          // 🔥 파일 저장 전략 (새로고침해도 유지)
          storageMode: state.storageMode,
          // 🔥 mapId는 저장 안 함 - 프로젝트별로 DB에서 조회
        }),
      }
    ),
    { name: 'NeuralMapStore' }
  )
)

// ============================================
// Selectors
// ============================================

export const selectGraph = (state: NeuralMapState) => state.graph
export const selectNodes = (state: NeuralMapState) => state.graph?.nodes ?? []
export const selectEdges = (state: NeuralMapState) => state.graph?.edges ?? []
export const selectClusters = (state: NeuralMapState) => state.graph?.clusters ?? []

export const selectSelectedNodes = (state: NeuralMapState) => {
  if (!state.graph) return []
  return state.graph.nodes.filter((n) => state.selectedNodeIds.includes(n.id))
}

export const selectFirstSelectedNode = (state: NeuralMapState) => {
  if (!state.graph || state.selectedNodeIds.length === 0) return null
  return state.graph.nodes.find((n) => n.id === state.selectedNodeIds[0]) ?? null
}

export const selectHoveredNode = (state: NeuralMapState) => {
  if (!state.graph || !state.hoveredNodeId) return null
  return state.graph.nodes.find((n) => n.id === state.hoveredNodeId) ?? null
}

export const selectSelfNode = (state: NeuralMapState) => {
  if (!state.graph) return null
  return state.graph.nodes.find((n) => n.type === 'project') ?? null
}

export const selectNodeById = (id: string) => (state: NeuralMapState) => {
  return state.graph?.nodes.find((n) => n.id === id) ?? null
}

export const selectEdgesForNode = (nodeId: string) => (state: NeuralMapState) => {
  if (!state.graph) return []
  return state.graph.edges.filter(
    (e) => e.source === nodeId || e.target === nodeId
  )
}

export const selectChildNodes = (parentId: string) => (state: NeuralMapState) => {
  if (!state.graph) return []
  return state.graph.nodes.filter((n) => n.parentId === parentId)
}

export const selectClusterNodes = (clusterId: string) => (state: NeuralMapState) => {
  if (!state.graph) return []
  return state.graph.nodes.filter((n) => n.clusterId === clusterId)
}

export const selectIsNodeExpanded = (nodeId: string) => (state: NeuralMapState) => {
  return state.expandedNodeIds.has(nodeId)
}

export const selectCanUndo = (state: NeuralMapState) => state.historyIndex >= 0
export const selectCanRedo = (state: NeuralMapState) =>
  state.historyIndex < state.history.length - 1
