/**
 * Neural Map Types
 * 3D Knowledge Graph Visualization for Users
 */

// ============================================
// Node Types
// ============================================

export type NodeType =
  | 'self'      // 중심 (유일)
  | 'concept'   // 개념
  | 'project'   // 프로젝트
  | 'doc'       // 문서
  | 'idea'      // 아이디어
  | 'decision'  // 의사결정
  | 'memory'    // 기억
  | 'task'      // 할일
  | 'person'    // 사람
  | 'insight'   // AI 인사이트
  | 'folder'    // 폴더
  | 'file'      // 파일

export interface SourceRef {
  fileId: string
  kind: 'pdf' | 'image' | 'video' | 'markdown' | 'code' | 'text' | 'binary'
  page?: number               // PDF 페이지
  timestamp?: number          // 비디오 초
  anchor?: string             // 마크다운 헤딩
}

export interface NodeStats {
  views: number
  lastOpened?: string
}

export interface NodePosition {
  x: number
  y: number
  z: number
}

export interface NeuralNode {
  id: string
  type: NodeType
  title: string
  summary?: string
  content?: string              // 마크다운 상세 내용
  tags: string[]
  importance: number            // 1-10

  // 계층
  parentId?: string
  clusterId?: string

  // 문서 연결
  sourceRef?: SourceRef

  // 시각화
  color?: string
  expanded: boolean
  pinned: boolean

  // 메타
  createdAt: string
  updatedAt: string

  // 3D 위치 (런타임)
  position?: NodePosition

  // 통계
  stats?: NodeStats
}

// ============================================
// Edge Types
// ============================================

export type EdgeType =
  | 'parent_child'   // 계층
  | 'references'     // 참조
  | 'imports'        // import 종속성
  | 'supports'       // 지지
  | 'contradicts'    // 반박
  | 'causes'         // 인과
  | 'same_topic'     // 같은 주제
  | 'sequence'       // 순서 (로드맵)
  | 'semantic'       // 기능적 연결 (ID/Class 등)

export interface EdgeEvidence {
  fileId: string
  page?: number
  quote?: string
  note?: string
}

export interface NeuralEdge {
  id: string
  source: string
  target: string
  type: EdgeType
  weight: number                // 0.1 ~ 1.0
  label?: string
  bidirectional: boolean

  // Alias for compatibility
  sourceId?: string
  targetId?: string
  strength?: number

  // 근거
  evidence?: EdgeEvidence[]

  createdAt: string
}

// ============================================
// Cluster Types
// ============================================

export interface NeuralCluster {
  id: string
  title: string
  description?: string
  color: string
  keywords: string[]            // TOP 5 키워드
  cohesion: number              // 응집도 0~1
  centerNodeId?: string         // 대표 노드
  createdAt: string
}

// ============================================
// Graph Container
// ============================================

export type ViewTab = 'map' | 'life-stream' | 'data' | 'logic' | 'test' | 'browser' | 'mermaid'
export type MermaidDiagramType = 'flowchart' | 'sequence' | 'class' | 'er' | 'gantt' | 'pie' | 'state' | 'gitgraph'
export type LayoutMode = 'organic' | 'radial' | 'structural'

export interface CameraState {
  position: NodePosition
  target: NodePosition
  zoom?: number
}

export interface ViewState {
  activeTab: ViewTab
  expandedNodeIds: string[]
  pinnedNodeIds: string[]
  selectedNodeIds: string[]
  cameraPosition: NodePosition
  cameraTarget: NodePosition
}

export interface NeuralGraph {
  version: string               // "2.0"
  userId: string
  agentId?: string              // 프로필 연결
  rootNodeId: string            // Self ID
  title: string

  nodes: NeuralNode[]
  edges: NeuralEdge[]
  clusters: NeuralCluster[]

  // 뷰 상태
  viewState: ViewState

  // 테마
  themeId: string

  createdAt: string
  updatedAt: string
}

// ============================================
// File Types
// ============================================

export type NeuralFileType = 'pdf' | 'image' | 'video' | 'markdown' | 'code' | 'text' | 'binary'

export interface NeuralFile {
  id: string
  mapId: string
  name: string
  path?: string  // 폴더 내 상대 경로 (예: "docs/images/logo.png")
  type: NeuralFileType
  url: string
  size: number
  content?: string  // 파일 내용 캐시 (편집용)
  linkedNodeCount?: number
  createdAt: string
}

// ============================================
// Analysis Job Types
// ============================================

export type AnalysisJobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface AnalysisJob {
  id: string
  mapId: string
  status: AnalysisJobStatus
  progress: number  // 0-100
  fileIds: string[]
  instructions?: string
  result?: {
    nodes: NeuralNode[]
    edges: NeuralEdge[]
    clusters: NeuralCluster[]
  }
  error?: string
  createdAt: string
  completedAt?: string
}

// ============================================
// History (Undo/Redo)
// ============================================

export type HistoryActionType =
  | 'add_node'
  | 'delete_node'
  | 'update_node'
  | 'add_edge'
  | 'delete_edge'
  | 'move_node'

export interface HistoryAction {
  type: HistoryActionType
  payload: unknown
  inverse: unknown
  timestamp: number
}

// ============================================
// Theme Types
// ============================================

export interface ThemeBackground {
  gradient: [string, string]  // 그라데이션 시작/끝
  starsEnabled: boolean
  starsColor: string
  starsCount: number
}

export interface ThemeNode {
  colors: Record<NodeType, string>
  emissiveIntensity: number
  hoverScale: number
  selectedOutlineColor: string
  selectedOutlineWidth: number
}

export interface ThemeEdge {
  defaultOpacity: number
  selectedOpacity: number
  particlesEnabled: boolean
  baseColor?: string
  baseOpacity?: number
  highlightOpacity?: number
}

export interface ThemePostProcessing {
  bloomIntensity: number
  bloomThreshold: number
  ssaoIntensity: number
}

export interface ThemeUI {
  panelBackground: string
  textColor: string
  accentColor: string
  borderColor: string
}

export interface NeuralMapTheme {
  id: string
  name: string
  background: ThemeBackground
  node: ThemeNode
  edge: ThemeEdge
  postProcessing: ThemePostProcessing
  ui: ThemeUI
}

// ============================================
// Insights Types
// ============================================

export interface NeuralMapInsights {
  centralNodes: NeuralNode[]
  bridgeNodes: NeuralNode[]
  deadEnds: NeuralNode[]
  recentChanges: {
    added: number
    removed: number
  }
  suggestions: {
    type: string
    nodeIds: string[]
    description: string
  }[]
}

// ============================================
// Label Policy Types
// ============================================

export interface LabelShowConditions {
  hover: boolean
  selected: boolean
  distanceThreshold: number
}

export interface LargeGraphPolicy {
  enabled: boolean
  maxVisibleLabels: number
  priority: string[]
}

export interface HugeGraphPolicy {
  enabled: boolean
  maxVisibleLabels: number
  showOnlySelected: boolean
  useSimpleLabels: boolean
}

export interface LabelPolicy {
  defaultVisible: boolean
  showConditions: LabelShowConditions
  largeGraphPolicy: LargeGraphPolicy
  hugeGraphPolicy: HugeGraphPolicy
  maxVisible?: number
  fontSize?: number
  maxLength?: number
}

// ============================================
// LOD Types
// ============================================

export interface LODDistances {
  labelShow: number
  labelHide: number
  nodeSimplify: number
  clusterProxy: number
  near: number
  far: number
  medium: number
}

// ============================================
// Radial Layout Types
// ============================================

export interface RadialLayoutConfig {
  centerNode: string
  ringGap: number
  angleSpread: number
  jitter: number
}

// ============================================
// Pathfinder Types
// ============================================

export interface PathfinderResult {
  path: string[]               // node IDs
  totalWeight: number
  edges: NeuralEdge[]
}

// ============================================
// UI State Types
// ============================================

export type RightPanelTab = 'inspector' | 'actions' | 'chat' | 'settings'

export interface PanelState {
  leftPanelWidth: number
  rightPanelWidth: number
  leftPanelCollapsed: boolean
  rightPanelCollapsed: boolean
  rightPanelTab: RightPanelTab
}

export interface SearchState {
  query: string
  results: NeuralNode[]
  isSearching: boolean
}

// ============================================
// Modal Types
// ============================================

export type ModalType = 'document' | 'nodeEditor' | 'export' | 'import' | 'settings' | null

export interface ModalState {
  type: ModalType
  data?: unknown
}

// ============================================
// Simulation Types (d3-force-3d)
// ============================================

export interface SimulationNode extends NeuralNode {
  x?: number
  y?: number
  z?: number
  vx?: number
  vy?: number
  vz?: number
  fx?: number | null
  fy?: number | null
  fz?: number | null
}


export interface SimulationLink {
  source: string | SimulationNode
  target: string | SimulationNode
  weight: number
}


// ============================================
// Terminal Types
// ============================================

export interface TerminalInstance {
  id: string
  name: string
  shell: string
  cwd: string
  pid?: number
  color?: string
  groupId: string
  customName?: string
}

// ============================================
// Agent State Types (Agentic Loop)
// ============================================

export type AgentExecutionStage = 'idle' | 'plan' | 'modify' | 'verify' | 'commit'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed'
export type TaskRisk = 'low' | 'medium' | 'high'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type DiagnosticSeverity = 'error' | 'warning' | 'info'
export type DiagnosticSource = 'build' | 'lint' | 'test' | 'lsp'
export type SymbolKind = 'function' | 'class' | 'variable' | 'interface' | 'type' | 'method' | 'property'

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  toolCall?: {
    name: string
    args: Record<string, unknown>
    result?: unknown
  }
  imageDataUrl?: string
  metadata?: Record<string, unknown>
}

export interface AgentTask {
  id: string
  description: string
  status: TaskStatus
  files: string[]
  estimatedRisk: TaskRisk
  requiredApproval: boolean
  startTime?: number
  endTime?: number
  error?: string
  operations?: PatchOperation[]
}

export interface PatchOperation {
  op: 'create' | 'modify' | 'delete' | 'rename'
  path: string
  oldPath?: string  // for rename
  content?: string  // for create
  changes?: PatchChange[]  // for modify
}

export interface PatchChange {
  oldText: string
  newText: string
  startLine?: number
  endLine?: number
}

export interface FileContext {
  path: string
  content: string
  language: string
  lastModified: number
  symbols: SymbolInfo[]
}

export interface SymbolInfo {
  name: string
  kind: SymbolKind
  location: {
    file: string
    line: number
    column: number
  }
  references?: SymbolReference[]
}

export interface SymbolReference {
  file: string
  line: number
  column: number
  context?: string
}

export interface AgentDiagnostic {
  severity: DiagnosticSeverity
  message: string
  file: string
  line: number
  column?: number
  source: DiagnosticSource
  code?: string
}

export interface DependencyNode {
  id: string
  path: string
  imports: string[]
  importedBy: string[]
}

export interface DependencyGraph {
  nodes: DependencyNode[]
  rootFiles: string[]
}

export interface GCCCheckpoint {
  id: string
  description: string
  files: string[]
  timestamp: number
  commitSha?: string
  taskId?: string
}

export interface AgentPlan {
  tasks: AgentTask[]
  currentTaskIndex: number
  approvalStatus: ApprovalStatus
  commitMessage?: string
  files: string[]
  generatedAt?: number
}

export interface AgentExecution {
  stage: AgentExecutionStage
  toolCallsCount: number
  lastToolResult: string | null
  error: string | null
  allPassed?: boolean
  results?: {
    build?: ToolResult
    lint?: ToolResult
    test?: ToolResult
    diagnostics?: AgentDiagnostic[]
  }
}

export interface AgentMetadata {
  model: string
  startTime: number
  threadId: string
  userId: string
  projectPath?: string
}

export interface AgentMemory {
  checkpoints: GCCCheckpoint[]
  currentBranch: string
  workingDirectory: string
}

export interface AgentContext {
  files: FileContext[]
  symbols: SymbolInfo[]
  diagnostics: AgentDiagnostic[]
  dependencies?: DependencyGraph
}

export interface AgentState {
  messages: AgentMessage[]
  context: AgentContext
  plan: AgentPlan | null
  execution: AgentExecution
  metadata: AgentMetadata
  memory: AgentMemory
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  output?: string
  exitCode?: number
  executionTime?: number
  metadata?: {
    resourceUsage?: {
      cpu?: number
      memory?: number
    }
  }
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  permissions: ('read' | 'write' | 'execute')[]
  timeout?: number
}

// Initial state factory
export function createInitialAgentState(userId: string, projectPath?: string): AgentState {
  return {
    messages: [],
    context: {
      files: [],
      symbols: [],
      diagnostics: [],
    },
    plan: null,
    execution: {
      stage: 'idle',
      toolCallsCount: 0,
      lastToolResult: null,
      error: null,
    },
    metadata: {
      model: 'claude-3.5-sonnet',
      startTime: Date.now(),
      threadId: crypto.randomUUID(),
      userId,
      projectPath,
    },
    memory: {
      checkpoints: [],
      currentBranch: 'main',
      workingDirectory: projectPath || process.cwd?.() || '/',
    },
  }
}

