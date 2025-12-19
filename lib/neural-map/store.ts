/**
 * Neural Map Zustand Store
 * Global state management for the 3D knowledge graph
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
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

// ============================================
// Store State Interface
// ============================================

interface CameraState {
  position: NodePosition
  target: NodePosition
  zoom?: number
}

interface NeuralMapState {
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
}

// ============================================
// Store Actions Interface
// ============================================

interface NeuralMapActions {
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
}

// ============================================
// Initial State
// ============================================

const initialState: NeuralMapState = {
  graph: null,
  isLoading: false,
  error: null,

  selectedNodeIds: [],
  hoveredNodeId: null,

  activeTab: 'radial',
  rightPanelTab: 'inspector',

  leftPanelWidth: PANEL_SIZES.left.default,
  rightPanelWidth: PANEL_SIZES.right.default,
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,

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
}

// ============================================
// Store
// ============================================

export const useNeuralMapStore = create<NeuralMapState & NeuralMapActions>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // ========== Graph ==========
        setGraph: (graph) =>
          set((state) => {
            state.graph = graph
            state.expandedNodeIds = new Set(graph.viewState?.expandedNodeIds || [])
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
          }),

        toggleRightPanel: () =>
          set((state) => {
            state.rightPanelCollapsed = !state.rightPanelCollapsed
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
            state.files = files
          }),

        addFile: (file) =>
          set((state) => {
            state.files.push(file)
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
            state.expandedNodeIds.add(id)
            const node = state.graph?.nodes.find((n) => n.id === id)
            if (node) {
              node.expanded = true
            }
          }),

        collapseNode: (id) =>
          set((state) => {
            state.expandedNodeIds.delete(id)
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
      })),
      {
        name: 'neural-map-storage',
        partialize: (state) => ({
          themeId: state.themeId,
          leftPanelWidth: state.leftPanelWidth,
          rightPanelWidth: state.rightPanelWidth,
          leftPanelCollapsed: state.leftPanelCollapsed,
          rightPanelCollapsed: state.rightPanelCollapsed,
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
