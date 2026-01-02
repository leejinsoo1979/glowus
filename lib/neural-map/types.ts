/**
 * Neural Map Types
 * Brain State Builder - Not an Archive, but a State Generator
 *
 * Core Philosophy:
 * - Neuron = Expression Unit (Rule/Decision/Preference/Playbook/Concept)
 * - Synapse = Connection Rule (Why/Evidence/Cause)
 * - Working Memory = Context Pack (Active neurons for current task)
 */

// ============================================
// Neuron Scope & Status (Brain State)
// ============================================

/** 뉴런의 적용 범위 - State Builder가 필터링하는 핵심 기준 */
export type NeuronScope =
  | 'global'    // 전역: 모든 상황에 적용
  | 'project'   // 프로젝트: 특정 프로젝트에만 적용
  | 'role'      // 역할: 특정 역할(개발자/디자이너 등)에 적용
  | 'task'      // 작업: 특정 작업에만 적용

/** 뉴런의 활성 상태 */
export type NeuronStatus =
  | 'draft'       // 초안: 아직 확정되지 않음
  | 'active'      // 활성: 현재 유효한 뉴런
  | 'deprecated'  // 폐기: 더 이상 사용하지 않음 (히스토리 보존)

/** 규칙의 강제성 수준 */
export type EnforcementLevel =
  | 'must'    // 필수: 반드시 따라야 함
  | 'should'  // 권장: 특별한 이유 없으면 따름
  | 'may'     // 선택: 상황에 따라 선택

// ============================================
// Node Types (Neuron Types)
// ============================================

export type NodeType =
  | 'self'        // 중심 (유일) - deprecated, use 'project'
  | 'concept'     // 개념: 정의/용어 통일
  | 'project'     // 프로젝트: 작업의 컨텍스트 허브
  | 'doc'         // 문서: 근거/출처 노드
  | 'idea'        // 아이디어: 가설/검증 단위
  | 'decision'    // 의사결정: 뇌의 골격
  | 'memory'      // 기억(Episodic): 사건 + 교훈
  | 'task'        // 할일: 실행 단위
  | 'person'      // 사람: 인간/조직 관계
  | 'insight'     // 인사이트: 결정에 영향을 준 근거
  | 'folder'      // 폴더
  | 'file'        // 파일
  | 'agent'       // 에이전트
  // === NEW: Brain Core Types ===
  | 'rule'        // 규칙: Identity Core의 기본 단위
  | 'preference'  // 선호: 판단 기준 (강도 포함)
  | 'playbook'    // 플레이북(Procedural): 반복 업무 절차
  | 'identity'    // 정체성: 금기/가치/품질 기준

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

  // ============================================
  // 🧠 Brain Core Fields (NEW)
  // ============================================

  /** 핵심 문장 - 뉴런의 본질 (1줄) */
  statement?: string

  /** 왜 이게 중요한가 - 근거/이유 */
  why?: string

  /** 적용 범위 - State Builder 필터링 기준 */
  scope?: NeuronScope

  /** 활성 상태 */
  neuronStatus?: NeuronStatus

  /** 확신도 0-100 (기본 70) */
  confidence?: number

  /** 연결된 프로젝트 ID (scope가 project일 때) */
  projectId?: string

  /** 연결된 역할 (scope가 role일 때) */
  roleId?: string

  /** 재검토 예정일 (Decision/Rule용) */
  reviewDate?: string

  // ============================================
  // 타입별 전용 필드
  // ============================================

  /** Rule 전용: 강제성 수준 */
  enforcement?: EnforcementLevel

  /** Preference 전용: 선호 강도 1-10 */
  preferenceStrength?: number

  /** Decision 전용: 검토한 대안들 */
  alternatives?: string[]

  /** Decision 전용: 트레이드오프 */
  tradeoffs?: string

  /** Playbook 전용: 실행 단계들 */
  steps?: string[]

  /** Playbook 전용: 트리거 조건 */
  trigger?: string

  /** Playbook 전용: 선행 조건 */
  prerequisites?: string[]

  /** Concept 전용: 동의어/별칭 */
  aliases?: string[]

  /** Concept 전용: 예시 */
  examples?: string[]

  /** Idea 전용: 가설 */
  hypothesis?: string

  /** Idea 전용: 영향도 */
  impact?: 'high' | 'medium' | 'low'

  /** Task 전용: 작업 상태 */
  taskStatus?: 'todo' | 'doing' | 'done' | 'blocked'

  /** Task 전용: 완료 조건 */
  definitionOfDone?: string[]

  /** Task 전용: 의존하는 Task ID들 */
  dependsOnTasks?: string[]

  /** Memory 전용: 발생 시점 */
  occurredAt?: string

  /** Memory 전용: 교훈 */
  lesson?: string

  /** Memory 전용: 참여자 ID들 */
  participants?: string[]

  /** Identity 전용: 카테고리 */
  identityCategory?: 'value' | 'taboo' | 'quality'

  /** Insight 전용: 권고 사항 */
  actionHint?: string

  /** Insight 전용: 영향도 점수 */
  impactScore?: number

  // ============================================
  // 기존 필드
  // ============================================

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
// Edge Types (Synapse Types)
// 시냅스 = 연결 규칙. 뇌가 뇌인 이유는 저장이 아니라 연결
// ============================================

export type EdgeType =
  // === 기존 타입 ===
  | 'parent_child'   // 계층
  | 'references'     // 참조
  | 'imports'        // import 종속성
  | 'supports'       // 지지: "이 근거가 저 결정을 뒷받침"
  | 'contradicts'    // 반박: "이것과 저것은 충돌"
  | 'causes'         // 인과: "이것이 저것을 야기"
  | 'same_topic'     // 같은 주제
  | 'sequence'       // 순서 (로드맵)
  | 'semantic'       // 기능적 연결 (ID/Class 등)
  // === NEW: Brain Synapse Types ===
  | 'defines'        // 정의: "이 개념이 저것을 정의"
  | 'implements'     // 구현: "이 Task가 저 Decision을 구현"
  | 'depends_on'     // 의존: "이것은 저것에 의존"
  | 'example_of'     // 예시: "이것은 저 개념의 예시"
  | 'derived_from'   // 파생: "이 결정은 저 규칙에서 파생"
  | 'reinforced_by'  // 강화: "이 선호는 저 경험으로 강화됨"
  | 'supersedes'     // 대체: "이 결정이 저 결정을 대체"
  | 'related'        // 관련: 일반적 연관 (fallback)

/** 시냅스 타입별 설명 (UI용) */
export const EDGE_TYPE_LABELS: Record<EdgeType, { ko: string; en: string; description: string }> = {
  parent_child: { ko: '계층', en: 'Parent-Child', description: '상위-하위 관계' },
  references: { ko: '참조', en: 'References', description: '문서/소스 참조' },
  imports: { ko: '임포트', en: 'Imports', description: '코드 의존성' },
  supports: { ko: '근거', en: 'Supports', description: '이 노드가 저 노드를 뒷받침' },
  contradicts: { ko: '충돌', en: 'Contradicts', description: '서로 모순되는 관계' },
  causes: { ko: '원인', en: 'Causes', description: '이것이 저것을 야기' },
  same_topic: { ko: '같은주제', en: 'Same Topic', description: '동일 주제 관련' },
  sequence: { ko: '순서', en: 'Sequence', description: '실행 순서' },
  semantic: { ko: '의미연결', en: 'Semantic', description: '기능적 연결' },
  defines: { ko: '정의', en: 'Defines', description: '개념/용어 정의' },
  implements: { ko: '구현', en: 'Implements', description: 'Decision을 Task로 구현' },
  depends_on: { ko: '의존', en: 'Depends On', description: '선행 조건 의존' },
  example_of: { ko: '예시', en: 'Example Of', description: '개념의 구체적 예시' },
  derived_from: { ko: '파생', en: 'Derived From', description: '상위 규칙에서 파생' },
  reinforced_by: { ko: '강화', en: 'Reinforced By', description: '경험으로 강화됨' },
  supersedes: { ko: '대체', en: 'Supersedes', description: '이전 결정을 대체' },
  related: { ko: '관련', en: 'Related', description: '일반적 연관' },
}

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

export type ViewTab = 'map' | 'life-stream' | 'agent-builder' | 'data' | 'logic' | 'test' | 'browser' | 'mermaid' | 'git' | 'architecture'
export type MermaidDiagramType = 'flowchart' | 'sequence' | 'class' | 'er' | 'pie' | 'state' | 'gitgraph' | 'gantt'
export type LayoutMode = 'force' | 'radial' | 'circular' | 'tree'

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

/**
 * 🔥 파일 저장 전략
 * - local: 로컬 경로만 참조 (Electron 전용, 파일 복사 없음)
 * - supabase: Supabase Storage에 업로드 (기존 방식)
 * - gcs: Google Cloud Storage에 업로드
 */
export type StorageMode = 'local' | 'supabase' | 'gcs'

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
  children?: NeuralFile[]  // 폴더 구조를 위한 하위 파일/폴더
  // 🔥 로컬 참조 모드용 필드
  localPath?: string  // 로컬 절대 경로 (Electron에서 직접 읽기용)
  storageMode?: StorageMode  // 이 파일의 저장 방식
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

export type RightPanelTab = 'inspector' | 'actions' | 'chat' | 'settings' | 'agent-builder'

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

// ============================================
// 🧠 Context Pack (Working Memory) Types
// State Builder가 생성하는 "지금의 뇌 상태"
// ============================================

/** 상황 질의 - State Builder 입력 */
export interface StateQuery {
  /** 현재 프로젝트 */
  projectId?: string
  /** 현재 역할 */
  role?: string
  /** 현재 작업 */
  taskId?: string
  /** 작업 단계 */
  stage?: 'planning' | 'implementing' | 'reviewing' | 'deploying'
  /** 제약 조건 */
  constraints?: {
    time?: 'urgent' | 'normal' | 'relaxed'
    cost?: 'tight' | 'normal' | 'flexible'
    quality?: 'mvp' | 'production' | 'enterprise'
  }
  /** 추가 컨텍스트 키워드 */
  keywords?: string[]
}

/** Context Pack - AI에게 주입되는 "지금의 뇌 상태" */
export interface ContextPack {
  /** 고유 ID */
  id: string

  /** 생성 시점 */
  createdAt: string

  /** 원본 질의 */
  query: StateQuery

  // ============================================
  // Context Pack 구성 요소 (순서대로 AI에 주입)
  // ============================================

  /** 1. Mission: 이번 작업의 목표 (1문장) */
  mission: string

  /** 2. Identity/Policy: 지켜야 할 기준 Top N */
  policies: ContextPackNeuron[]

  /** 3. Key Decisions: 반드시 따라야 할 결정 Top N */
  decisions: ContextPackNeuron[]

  /** 4. Playbook: 실행 절차 */
  playbooks: ContextPackNeuron[]

  /** 5. Constraints & Do-Not: 금지/제약 */
  constraints: ContextPackNeuron[]

  /** 6. Reference: 근거 링크/원문 요약 */
  references: ContextPackReference[]

  // ============================================
  // 메타데이터
  // ============================================

  /** 총 뉴런 수 */
  totalNeurons: number

  /** 충돌 해결 로그 */
  conflictResolutions?: ConflictResolution[]

  /** 제외된 뉴런들 (deprecated 등) */
  excludedNeurons?: string[]
}

/** Context Pack에 포함된 뉴런 (경량화된 버전) */
export interface ContextPackNeuron {
  id: string
  type: NodeType
  statement: string
  why?: string
  scope: NeuronScope
  confidence: number
  enforcement?: EnforcementLevel
  /** 이 뉴런이 선택된 이유 (랭킹 점수) */
  relevanceScore: number
}

/** 참조 문서 */
export interface ContextPackReference {
  id: string
  title: string
  type: 'doc' | 'memory' | 'insight'
  summary?: string
  url?: string
}

/** 충돌 해결 로그 */
export interface ConflictResolution {
  /** 충돌한 뉴런들 */
  conflictingNeurons: string[]
  /** 선택된 뉴런 */
  selectedNeuron: string
  /** 선택 이유 */
  reason: 'recency' | 'scope' | 'authority' | 'confidence'
  /** deprecated 처리된 뉴런들 */
  deprecatedNeurons: string[]
}

// ============================================
// State Builder 설정
// ============================================

/** State Builder 랭킹 가중치 */
export interface StateBuilderWeights {
  /** Scope 일치도 (global < project < task) */
  scopeMatch: number
  /** 최신성 (최근일수록 높음) */
  recency: number
  /** 권위 (승인/확정된 것 우선) */
  authority: number
  /** 충돌 페널티 */
  conflictPenalty: number
  /** 리스크 관련성 */
  riskRelevance: number
  /** 확신도 */
  confidence: number
}

/** 기본 가중치 */
export const DEFAULT_STATE_BUILDER_WEIGHTS: StateBuilderWeights = {
  scopeMatch: 0.25,
  recency: 0.15,
  authority: 0.20,
  conflictPenalty: -0.15,
  riskRelevance: 0.10,
  confidence: 0.15,
}

/** Context Pack 생성 옵션 */
export interface ContextPackOptions {
  /** 최대 뉴런 수 */
  maxNeurons?: number
  /** 최소 relevance score */
  minRelevanceScore?: number
  /** 포함할 뉴런 타입 */
  includeTypes?: NodeType[]
  /** 제외할 뉴런 타입 */
  excludeTypes?: NodeType[]
  /** 커스텀 가중치 */
  weights?: Partial<StateBuilderWeights>
}

// ============================================
// 강화 학습 (Consolidation) Types
// ============================================

/** 실행 결과 피드백 */
export interface ExecutionFeedback {
  /** Context Pack ID */
  contextPackId: string
  /** 성공 여부 */
  success: boolean
  /** 결과 점수 (0-100) */
  score: number
  /** 피드백 메모 */
  notes?: string
  /** 강화할 뉴런들 (가중치 상승) */
  reinforceNeurons?: string[]
  /** 약화할 뉴런들 (가중치 하락) */
  weakenNeurons?: string[]
  /** 수정 후보 생성 */
  suggestModifications?: {
    neuronId: string
    suggestedChange: string
  }[]
}

/** 승인 대기 큐 항목 */
export interface ConsolidationQueueItem {
  id: string
  /** 원본 소스 (대화/회의/커밋 등) */
  source: {
    type: 'conversation' | 'meeting' | 'commit' | 'document' | 'manual'
    id?: string
    content: string
  }
  /** AI가 추출한 뉴런 후보 */
  suggestedNeuron: Partial<NeuralNode>
  /** AI가 제안한 시냅스들 */
  suggestedEdges?: Partial<NeuralEdge>[]
  /** 승인 상태 */
  status: 'pending' | 'approved' | 'rejected' | 'modified'
  /** 생성 시점 */
  createdAt: string
  /** 처리 시점 */
  processedAt?: string
}

