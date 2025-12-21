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
  RightPanelTab,
  ModalType,
  HistoryAction,
  NodePosition,
  NeuralMapTheme,
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

  // Simulation
  isSimulationRunning: boolean
  simulationAlpha: number

  // Expanded nodes (for lazy loading)
  expandedNodeIds: Set<string>

  // Editor
  editorOpen: boolean
  editorCollapsed: boolean

  // Code Preview
  codePreviewFile: NeuralFile | null
  codePreviewOpen: boolean
  codePreviewEditMode: boolean
  codePreviewDirty: boolean

  // Graph Settings
  radialDistance: number // 방사 거리 (50~300)
  graphExpanded: boolean // 그래프 펼침 상태 (트리 접힘과 연동)
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
  setTheme: (themeId: string) => void

  // History
  pushHistory: (action: HistoryAction) => void
  undo: () => void
  redo: () => void
  clearHistory: () => void

  // Files
  setFiles: (files: NeuralFile[]) => void
  addFile: (file: NeuralFile) => void
  removeFile: (id: string) => void

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

  // Demo
  loadMockProjectData: () => void

  // Build graph from real files
  buildGraphFromFiles: () => void
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
  rightPanelTab: 'inspector',

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

  isSimulationRunning: true,
  simulationAlpha: 1,

  expandedNodeIds: new Set(),

  editorOpen: false,
  editorCollapsed: false,

  // Code Preview
  codePreviewFile: null,
  codePreviewOpen: false,
  codePreviewEditMode: false,
  codePreviewDirty: false,

  // Graph Settings
  radialDistance: 150, // 기본 방사 거리
  graphExpanded: true, // 기본 펼침 상태
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
            const selfNode = graph.nodes.find(n => n.type === 'self')
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
        setTheme: (themeId) =>
          set((state) => {
            const theme = THEME_PRESETS.find((t) => t.id === themeId)
            if (theme) {
              state.themeId = themeId
              state.currentTheme = theme
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
        openEditor: () =>
          set((state) => {
            state.editorOpen = true
            state.editorCollapsed = false
          }),
        closeEditor: () =>
          set((state) => {
            state.editorOpen = false
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
        setRadialDistance: (distance) =>
          set((state) => {
            state.radialDistance = Math.max(50, Math.min(300, distance))
          }),
        setGraphExpanded: (expanded) =>
          set((state) => {
            state.graphExpanded = expanded
          }),

        // ========== Demo ==========
        loadMockProjectData: () =>
          set((state) => {
            // 샘플 Next.js 프로젝트 구조
            const mockProject = {
              name: 'my-nextjs-app',
              folders: [
                { path: 'app', children: ['page.tsx', 'layout.tsx', 'globals.css'] },
                { path: 'app/api', children: ['route.ts'] },
                { path: 'app/api/users', children: ['route.ts'] },
                { path: 'app/dashboard', children: ['page.tsx', 'loading.tsx'] },
                { path: 'components', children: ['Header.tsx', 'Footer.tsx', 'Sidebar.tsx'] },
                { path: 'components/ui', children: ['Button.tsx', 'Input.tsx', 'Modal.tsx', 'Card.tsx'] },
                { path: 'lib', children: ['utils.ts', 'db.ts'] },
                { path: 'hooks', children: ['useAuth.ts', 'useTheme.ts'] },
                { path: 'stores', children: ['authStore.ts', 'uiStore.ts'] },
                { path: 'types', children: ['index.ts', 'api.ts'] },
                { path: 'public', children: ['favicon.ico', 'logo.svg'] },
              ],
              rootFiles: ['package.json', 'tsconfig.json', 'next.config.js', 'README.md', '.env.local']
            }

            // 노드 ID 생성 헬퍼
            const generateId = () => `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

            // 루트 노드 (프로젝트)
            const rootNode: NeuralNode = {
              id: generateId(),
              type: 'self',
              title: mockProject.name,
              summary: 'Next.js 14 프로젝트',
              tags: ['project', 'nextjs'],
              importance: 10,
              expanded: true,
              pinned: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }

            const nodes: NeuralNode[] = [rootNode]
            const edges: NeuralEdge[] = []
            const files: NeuralFile[] = []

            // 폴더 노드 맵 (path -> nodeId)
            const folderMap = new Map<string, string>()
            folderMap.set('', rootNode.id) // 루트

            // 폴더 노드 생성
            mockProject.folders.forEach(folder => {
              const folderId = generateId()
              const folderName = folder.path.split('/').pop() || folder.path
              const parentPath = folder.path.includes('/')
                ? folder.path.substring(0, folder.path.lastIndexOf('/'))
                : ''

              const folderNode: NeuralNode = {
                id: folderId,
                type: 'folder',
                title: folderName,
                summary: `폴더: ${folder.path}`,
                tags: ['folder'],
                importance: 7,
                parentId: folderMap.get(parentPath) || rootNode.id,
                expanded: false,
                pinned: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }

              nodes.push(folderNode)
              folderMap.set(folder.path, folderId)

              // 부모와 연결
              edges.push({
                id: generateId(),
                source: folderMap.get(parentPath) || rootNode.id,
                target: folderId,
                type: 'parent_child',
                weight: 0.8,
                bidirectional: false,
                createdAt: new Date().toISOString(),
              })

              // 해당 폴더의 파일들 생성
              folder.children.forEach(fileName => {
                const fileId = generateId()
                const ext = fileName.split('.').pop() || ''
                const fileType = ['tsx', 'ts', 'js', 'jsx'].includes(ext) ? 'code' :
                  ext === 'css' ? 'style' :
                    ext === 'json' ? 'config' :
                      ext === 'md' ? 'doc' : 'file'

                const fileNode: NeuralNode = {
                  id: fileId,
                  type: fileType as any,
                  title: fileName,
                  summary: `${folder.path}/${fileName}`,
                  tags: [ext, fileType],
                  importance: 5,
                  parentId: folderId,
                  expanded: false,
                  pinned: false,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }

                nodes.push(fileNode)

                // 폴더와 연결
                edges.push({
                  id: generateId(),
                  source: folderId,
                  target: fileId,
                  type: 'parent_child',
                  weight: 0.6,
                  bidirectional: false,
                  createdAt: new Date().toISOString(),
                })

                // 파일 목록에 추가
                files.push({
                  id: fileId,
                  mapId: 'mock-graph',
                  name: fileName,
                  type: ext === 'md' ? 'markdown' : 'image' as any,
                  url: `mock://${folder.path}/${fileName}`,
                  size: Math.floor(Math.random() * 10000) + 500,
                  path: `${folder.path}/${fileName}`,
                  createdAt: new Date().toISOString(),
                })
              })
            })

            // 파일 경로 -> nodeId 맵 (import 종속성 연결용)
            const fileNodeMap = new Map<string, string>()

            // 루트 파일들 생성
            mockProject.rootFiles.forEach(fileName => {
              const fileId = generateId()
              const ext = fileName.split('.').pop() || ''

              const fileNode: NeuralNode = {
                id: fileId,
                type: 'config' as any,
                title: fileName,
                summary: `루트 파일: ${fileName}`,
                tags: [ext, 'root'],
                importance: 6,
                parentId: rootNode.id,
                expanded: false,
                pinned: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }

              nodes.push(fileNode)
              fileNodeMap.set(fileName, fileId)

              // 루트와 연결
              edges.push({
                id: generateId(),
                source: rootNode.id,
                target: fileId,
                type: 'parent_child',
                weight: 0.7,
                bidirectional: false,
                createdAt: new Date().toISOString(),
              })

              files.push({
                id: fileId,
                mapId: 'mock-graph',
                name: fileName,
                type: ext === 'md' ? 'markdown' : 'image' as any,
                url: `mock://${fileName}`,
                size: Math.floor(Math.random() * 5000) + 200,
                path: fileName,
                createdAt: new Date().toISOString(),
              })
            })

            // 이전에 생성된 폴더 내 파일들도 fileNodeMap에 추가
            mockProject.folders.forEach(folder => {
              folder.children.forEach(fileName => {
                const filePath = `${folder.path}/${fileName}`
                const existingNode = nodes.find(n => n.summary === filePath)
                if (existingNode) {
                  fileNodeMap.set(filePath, existingNode.id)
                }
              })
            })

            // ========== Import 종속성 (Dependency) 엣지 생성 ==========
            const importDependencies = [
              // app/page.tsx imports
              { from: 'app/page.tsx', to: 'components/Header.tsx', label: 'import Header' },
              { from: 'app/page.tsx', to: 'components/Footer.tsx', label: 'import Footer' },
              { from: 'app/page.tsx', to: 'components/ui/Button.tsx', label: 'import Button' },

              // app/layout.tsx imports
              { from: 'app/layout.tsx', to: 'components/Sidebar.tsx', label: 'import Sidebar' },
              { from: 'app/layout.tsx', to: 'app/globals.css', label: 'import styles' },
              { from: 'app/layout.tsx', to: 'lib/utils.ts', label: 'import utils' },

              // app/dashboard/page.tsx imports
              { from: 'app/dashboard/page.tsx', to: 'components/Header.tsx', label: 'import Header' },
              { from: 'app/dashboard/page.tsx', to: 'components/ui/Card.tsx', label: 'import Card' },
              { from: 'app/dashboard/page.tsx', to: 'hooks/useAuth.ts', label: 'import useAuth' },
              { from: 'app/dashboard/page.tsx', to: 'stores/uiStore.ts', label: 'import uiStore' },

              // components imports
              { from: 'components/Header.tsx', to: 'components/ui/Button.tsx', label: 'import Button' },
              { from: 'components/Header.tsx', to: 'hooks/useAuth.ts', label: 'import useAuth' },
              { from: 'components/Header.tsx', to: 'hooks/useTheme.ts', label: 'import useTheme' },
              { from: 'components/Sidebar.tsx', to: 'components/ui/Button.tsx', label: 'import Button' },
              { from: 'components/Sidebar.tsx', to: 'stores/uiStore.ts', label: 'import uiStore' },
              { from: 'components/Footer.tsx', to: 'lib/utils.ts', label: 'import utils' },

              // components/ui imports
              { from: 'components/ui/Modal.tsx', to: 'components/ui/Button.tsx', label: 'import Button' },
              { from: 'components/ui/Card.tsx', to: 'lib/utils.ts', label: 'import cn' },
              { from: 'components/ui/Button.tsx', to: 'lib/utils.ts', label: 'import cn' },
              { from: 'components/ui/Input.tsx', to: 'lib/utils.ts', label: 'import cn' },

              // hooks imports
              { from: 'hooks/useAuth.ts', to: 'stores/authStore.ts', label: 'import authStore' },
              { from: 'hooks/useAuth.ts', to: 'lib/db.ts', label: 'import db' },
              { from: 'hooks/useTheme.ts', to: 'stores/uiStore.ts', label: 'import uiStore' },

              // stores imports
              { from: 'stores/authStore.ts', to: 'types/index.ts', label: 'import types' },
              { from: 'stores/uiStore.ts', to: 'types/index.ts', label: 'import types' },

              // lib imports
              { from: 'lib/db.ts', to: 'types/api.ts', label: 'import API types' },

              // api routes imports
              { from: 'app/api/route.ts', to: 'lib/db.ts', label: 'import db' },
              { from: 'app/api/users/route.ts', to: 'lib/db.ts', label: 'import db' },
              { from: 'app/api/users/route.ts', to: 'types/api.ts', label: 'import types' },
            ]

            // Import 종속성 엣지 추가
            importDependencies.forEach(dep => {
              const sourceId = fileNodeMap.get(dep.from)
              const targetId = fileNodeMap.get(dep.to)

              if (sourceId && targetId) {
                edges.push({
                  id: generateId(),
                  source: sourceId,
                  target: targetId,
                  type: 'imports',
                  label: dep.label,
                  weight: 0.5,
                  bidirectional: false,
                  createdAt: new Date().toISOString(),
                })
              }
            })

            // 그래프 설정
            const graphData = {
              nodes,
              edges,
              clusters: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }

            if (state.graph) {
              state.graph.nodes = graphData.nodes
              state.graph.edges = graphData.edges
              state.graph.clusters = graphData.clusters
              state.graph.updatedAt = graphData.updatedAt
            } else {
              state.graph = {
                ...graphData,
                title: mockProject.name,
              } as any
            }

            state.files = normalizeFiles(files)
            state.expandedNodeIds = new Set([rootNode.id])
          }),

        // ========== Build Graph from Real Files ==========
        buildGraphFromFiles: () =>
          set((state) => {
            const currentFiles = state.files
            if (!currentFiles || currentFiles.length === 0) {
              return // No files to visualize
            }

            // ID 생성 헬퍼
            const generateId = () => `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

            // 프로젝트 이름 추출 (첫 번째 폴더 또는 "My Project")
            const firstPath = currentFiles[0]?.path || currentFiles[0]?.name
            const projectName = firstPath?.split('/')[0] || 'My Project'

            // 루트 노드 (프로젝트)
            const rootNode: NeuralNode = {
              id: generateId(),
              type: 'self',
              title: projectName,
              summary: `${currentFiles.length}개 파일`,
              tags: ['project'],
              importance: 10,
              expanded: true,
              pinned: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }

            const nodes: NeuralNode[] = [rootNode]
            const edges: NeuralEdge[] = []

            // 폴더 노드 맵 (path -> nodeId)
            const folderMap = new Map<string, string>()
            folderMap.set('', rootNode.id) // 루트

            // 파일 노드 맵 (filePath -> nodeId) - import 분석용
            const fileNodeMap = new Map<string, string>()

            // 모든 폴더 경로 수집 및 생성
            const allFolderPaths = new Set<string>()
            currentFiles.forEach(file => {
              const filePath = file.path || file.name
              const parts = filePath.split('/')
              // 마지막은 파일명이므로 제외
              for (let i = 1; i < parts.length; i++) {
                allFolderPaths.add(parts.slice(0, i).join('/'))
              }
            })

            // 폴더 정렬 (부모 먼저 생성되도록)
            const sortedFolders = Array.from(allFolderPaths).sort((a, b) => {
              const depthA = a.split('/').length
              const depthB = b.split('/').length
              return depthA - depthB
            })

            // 중복 노드 방지: 최상위 폴더가 맵 이름과 같으면 루트 노드에 병합
            if (sortedFolders.length > 0) {
              const firstFolder = sortedFolders[0]
              if (firstFolder === projectName || sortedFolders.length === 1) {
                folderMap.set(firstFolder, rootNode.id)
              }
            }

            // 폴더 노드 생성
            sortedFolders.forEach(folderPath => {
              if (folderMap.has(folderPath)) return // 이미 루트에 병합되었거나 존재

              const folderId = generateId()
              const folderName = folderPath.split('/').pop() || folderPath
              const parentPath = folderPath.includes('/')
                ? folderPath.substring(0, folderPath.lastIndexOf('/'))
                : ''

              const folderNode: NeuralNode = {
                id: folderId,
                type: 'folder',
                title: folderName,
                summary: `폴더: ${folderPath}`,
                tags: ['folder'],
                importance: 7,
                parentId: folderMap.get(parentPath) || rootNode.id,
                expanded: true,
                pinned: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }

              nodes.push(folderNode)
              folderMap.set(folderPath, folderId)

              // 부모와 연결
              edges.push({
                id: generateId(),
                source: folderMap.get(parentPath) || rootNode.id,
                target: folderId,
                type: 'parent_child',
                weight: 0.1, // 구조선은 아주 연하게
                bidirectional: false,
                createdAt: new Date().toISOString(),
              })
            })

            // 파일 노드 생성
            currentFiles.forEach(file => {
              const fileId = generateId()
              const filePath = file.path || file.name
              const fileName = file.name
              const ext = fileName.split('.').pop()?.toLowerCase() || ''

              // 파일 타입 결정
              const fileType = ['tsx', 'ts', 'js', 'jsx', 'py', 'java', 'go', 'rs'].includes(ext) ? 'code' :
                ['css', 'scss', 'less', 'sass'].includes(ext) ? 'style' :
                  ['json', 'yaml', 'yml', 'toml', 'xml', 'env'].includes(ext) ? 'config' :
                    ['md', 'mdx', 'txt', 'rst'].includes(ext) ? 'doc' :
                      ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext) ? 'image' :
                        ['mp4', 'webm', 'mov', 'avi'].includes(ext) ? 'video' :
                          ['pdf'].includes(ext) ? 'pdf' : 'file'

              // 부모 폴더 찾기
              const parentPath = filePath.includes('/')
                ? filePath.substring(0, filePath.lastIndexOf('/'))
                : ''
              const parentId = folderMap.get(parentPath) || rootNode.id

              const fileNode: NeuralNode = {
                id: fileId,
                type: fileType as any,
                title: fileName,
                summary: filePath,
                tags: [ext, fileType],
                importance: 5,
                parentId: parentId,
                expanded: true,
                pinned: false,
                createdAt: file.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                // 실제 파일 참조
                sourceRef: {
                  fileId: file.id,
                  kind: file.type as any,
                },
              }

              nodes.push(fileNode)
              fileNodeMap.set(filePath, fileId)

              // 부모와 연결
              edges.push({
                id: generateId(),
                source: parentId,
                target: fileId,
                type: 'parent_child',
                weight: 0.1, // 구조선은 아주 연하게
                bidirectional: false,
                createdAt: new Date().toISOString(),
              })
            })

            // ========== 파일 내용 분석 (정확한 종속성 연결) ==========
            // 1. 경로 해결 헬퍼
            const resolvePath = (fromPath: string, toPath: string) => {
              if (!toPath || toPath.startsWith('http') || toPath.startsWith('//') || toPath.startsWith('data:')) return null;

              const cleanToPath = toPath.split(/[?#]/)[0];

              // 상대 경로 처리
              if (cleanToPath.startsWith('.')) {
                const parts = fromPath.split('/');
                parts.pop();
                const relativeParts = cleanToPath.split('/');

                for (const part of relativeParts) {
                  if (part === '.' || part === '') continue;
                  if (part === '..') {
                    parts.pop();
                  } else {
                    parts.push(part);
                  }
                }
                return parts.join('/')
              }

              const fromParts = fromPath.split('/');
              const rootFolder = fromParts[0] || '';

              // 후보군: 원본, 루트 폴더 포함, 루트 폴더 제외
              const candidates = [
                cleanToPath,
                rootFolder ? `${rootFolder}/${cleanToPath}` : cleanToPath,
                cleanToPath.includes('/') ? cleanToPath.split('/').slice(1).join('/') : cleanToPath
              ];

              for (const cand of candidates) {
                if (fileNodeMap.has(cand)) return cand;
              }

              // 마지막 수단: 같은 폴더 내 파일로 간주
              fromParts.pop();
              return fromParts.length > 0 ? `${fromParts.join('/')}/${cleanToPath}` : cleanToPath;
            }

            let dependencyCount = 0;

            // 2. 내용 분석 및 엣지 생성
            currentFiles.forEach(file => {
              const content = (file as any).content;
              if (!content || typeof content !== 'string') return;

              const filePath = file.path || file.name;
              const sourceId = fileNodeMap.get(filePath);
              if (!sourceId) return;

              const ext = file.name.split('.').pop()?.toLowerCase() || '';
              const detectedDeps: { path: string; label: string }[] = [];

              if (ext === 'html' || ext === 'htm') {
                // 더 유연한 HTML 레겍스
                const linkRegex = /<link[^>]+href=["']([^"']+)["'][^>]*>/gi;
                const scriptRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
                let match;
                while ((match = linkRegex.exec(content)) !== null) detectedDeps.push({ path: match[1], label: 'link' });
                while ((match = scriptRegex.exec(content)) !== null) detectedDeps.push({ path: match[1], label: 'script' });
              }

              if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
                const importRegex = /import\s+?(?:(?:(?:[\w*\s{},]*)\s+from\s+)|(?:["']))["'](.+?)["']/g;
                const requireRegex = /require\(["'](.+?)["']\)/g;
                const dynamicImportRegex = /import\(["'](.+?)["']\)/g;
                let match;
                while ((match = importRegex.exec(content)) !== null) detectedDeps.push({ path: match[1], label: 'import' });
                while ((match = requireRegex.exec(content)) !== null) detectedDeps.push({ path: match[1], label: 'require' });
                while ((match = dynamicImportRegex.exec(content)) !== null) {
                  detectedDeps.push({ path: match[1], label: 'import()' });
                }
              }

              if (['css', 'scss', 'less'].includes(ext)) {
                const cssImportRegex = /@import\s+["'](.+?)["']/g;
                const cssUrlRegex = /url\(["']?(.+?)["']?\)/g;
                let match;
                while ((match = cssImportRegex.exec(content)) !== null) detectedDeps.push({ path: match[1], label: '@import' });
                while ((match = cssUrlRegex.exec(content)) !== null) detectedDeps.push({ path: match[1], label: 'url' });
              }

              detectedDeps.forEach(dep => {
                const resolved = resolvePath(filePath, dep.path);
                if (!resolved) return;

                const potentialPaths = [
                  resolved,
                  resolved + '.ts',
                  resolved + '.tsx',
                  resolved + '.js',
                  resolved + '.jsx',
                  resolved + '.css',
                  resolved + '/index.ts',
                  resolved + '/index.tsx',
                  resolved + '/index.js',
                ];

                for (const p of potentialPaths) {
                  const targetId = fileNodeMap.get(p);
                  if (targetId && targetId !== sourceId) {
                    edges.push({
                      id: generateId(),
                      source: sourceId,
                      target: targetId,
                      type: 'imports',
                      label: dep.label,
                      weight: 1.5, // 로직 관계는 매우 강하게 결합하여 덩어리를 형성
                      bidirectional: false,
                      createdAt: new Date().toISOString(),
                    });
                    dependencyCount++;
                    break;
                  }
                }
              });
            });

            // ========== 시맨틱 링크 분석 (ID/Class 기반 기능적 연결) ==========
            // 1. HTML에서 모든 ID와 Class 추출
            const htmlSelectors = new Map<string, Set<string>>(); // filePath -> Set of selectors
            currentFiles.forEach(file => {
              const ext = file.name.split('.').pop()?.toLowerCase() || '';
              if (ext === 'html' || ext === 'htm') {
                const content = (file as any).content || '';
                const selectors = new Set<string>();

                // id="my-id", class="btn primary" 등 추출
                const idRegex = /id=["']([^"']+)["']/gi;
                const classRegex = /class=["']([^"']+)["']/gi;

                let match;
                while ((match = idRegex.exec(content)) !== null) selectors.add(match[1]);
                while ((match = classRegex.exec(content)) !== null) {
                  // 클래스는 공백으로 구분된 여러 개일 수 있음
                  match[1].split(/\s+/).filter(Boolean).forEach(cls => selectors.add(cls));
                }

                if (selectors.size > 0) {
                  htmlSelectors.set(file.path || file.name, selectors);
                }
              }
            });

            // 2. JS/CSS에서 해당 셀렉터 사용 여부 확인 및 엣지 생성
            if (htmlSelectors.size > 0) {
              currentFiles.forEach(file => {
                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                if (!['js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'less'].includes(ext)) return;

                const content = (file as any).content || '';
                const sourcePath = file.path || file.name;
                const sourceId = fileNodeMap.get(sourcePath);
                if (!sourceId) return;

                htmlSelectors.forEach((selectors, htmlPath) => {
                  const targetId = fileNodeMap.get(htmlPath);
                  if (!targetId || targetId === sourceId) return;

                  // 이미 직접 로드(imports) 연결이 있는지 확인
                  const hasDirectLink = edges.some(e =>
                    (e.source === sourceId && e.target === targetId) ||
                    (e.source === targetId && e.target === sourceId)
                  );
                  if (hasDirectLink) return;

                  // 셀렉터 중 하나라도 포함되어 있는지 확인 (단순 문자열 포함으로 1차 판단)
                  for (const selector of selectors) {
                    if (content.includes(selector)) {
                      edges.push({
                        id: generateId(),
                        source: sourceId,
                        target: targetId,
                        type: 'semantic',
                        label: 'functional',
                        weight: 0.3, // 기능적 연결은 구조적 배치에 큰 영향을 주지 않도록 낮게 설정
                        bidirectional: true,
                        createdAt: new Date().toISOString(),
                      });
                      dependencyCount++;
                      break; // 하나라도 찾으면 해당 파일과의 연결 생성 후 중단
                    }
                  }
                });
              });
            }

            // 기존 parent_child 엣지들의 가중치를 대폭 낮춤 (배경 구조 역할만 수행)
            edges.forEach(edge => {
              if (edge.type === 'parent_child') {
                edge.weight = 0.1;
              }
            });

            console.log(`[Store] Logic Graph Rebuilt: ${dependencyCount} functional/semantic dependencies found.`);

            // 그래프 설정
            const graphData = {
              nodes,
              edges,
              clusters: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }

            if (state.graph) {
              state.graph.nodes = graphData.nodes
              state.graph.edges = graphData.edges
              state.graph.clusters = graphData.clusters
              state.graph.updatedAt = graphData.updatedAt
            } else {
              state.graph = {
                ...graphData,
                version: '2.0',
                userId: '',
                rootNodeId: rootNode.id,
                title: projectName,
                viewState: {
                  activeTab: 'map',
                  expandedNodeIds: [rootNode.id],
                  pinnedNodeIds: [],
                  selectedNodeIds: [],
                  cameraPosition: { x: 0, y: 0, z: 0 },
                  cameraTarget: { x: 0, y: 0, z: 0 },
                },
                themeId: 'cosmic-dark',
              } as NeuralGraph
            }

            state.expandedNodeIds = new Set(nodes.map(n => n.id))
          }),
      })),
      {
        name: 'neural-map-storage',
        partialize: (state) => ({
          themeId: state.themeId,
          leftPanelWidth: state.leftPanelWidth,
          rightPanelWidth: state.rightPanelWidth,
          leftPanelCollapsed: state.leftPanelCollapsed,
          rightPanelCollapsed: state.rightPanelCollapsed,
          radialDistance: state.radialDistance,
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
  return state.graph.nodes.find((n) => n.type === 'self') ?? null
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
