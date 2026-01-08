/**
 * Mission Control - Type Definitions
 *
 * 멀티 에이전트 오케스트레이션 시스템의 핵심 타입 정의
 */

// ============================================================================
// Agent Types
// ============================================================================

export type AgentRole = 'orchestrator' | 'planner' | 'implementer' | 'tester' | 'reviewer'

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'waiting' | 'error'

export interface AgentConfig {
  id: AgentRole
  name: string
  nameKr: string
  color: string
  description: string
  systemPrompt: string
  model: string
  maxTokens: number
  temperature: number
}

export interface AgentState {
  role: AgentRole
  status: AgentStatus
  currentTaskId?: string
  progress: number           // 0-100
  lastMessage?: string
  tokenUsage: number
  startedAt?: number
  error?: string
}

// ============================================================================
// Task Types
// ============================================================================

export type TaskType = 'analyze' | 'plan' | 'implement' | 'test' | 'review'

export type TaskStatus = 'pending' | 'queued' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Task {
  id: string
  missionId: string
  type: TaskType
  assignedAgent: AgentRole
  status: TaskStatus
  priority: TaskPriority

  // 태스크 내용
  title: string
  description: string
  input: string

  // 의존성
  dependencies: string[]      // 선행 태스크 ID들
  dependents: string[]        // 후행 태스크 ID들 (이 태스크를 기다리는)

  // 결과
  output?: string
  artifacts: string[]         // 생성된 Artifact ID들

  // 메타데이터
  retryCount: number
  maxRetries: number
  createdAt: number
  startedAt?: number
  completedAt?: number
  error?: string
}

export interface TaskCreateInput {
  type: TaskType
  assignedAgent: AgentRole
  title: string
  description: string
  input: string
  dependencies?: string[]
  priority?: TaskPriority
}

// ============================================================================
// Mission Types
// ============================================================================

export type MissionStatus =
  | 'created'       // 생성됨
  | 'analyzing'     // Orchestrator가 분석 중
  | 'planning'      // 태스크 계획 수립 중
  | 'executing'     // 태스크 실행 중
  | 'reviewing'     // 최종 리뷰 중
  | 'completed'     // 완료
  | 'failed'        // 실패
  | 'cancelled'     // 취소됨

export interface Mission {
  id: string
  userRequest: string         // 원본 사용자 요청
  status: MissionStatus

  // 분석 결과
  analysis?: MissionAnalysis

  // 태스크 & 산출물
  tasks: Task[]
  artifacts: Artifact[]

  // 진행 상황
  progress: number            // 0-100 (전체 진행률)
  currentPhase: string        // 현재 단계 설명

  // 메타데이터
  createdAt: number
  startedAt?: number
  completedAt?: number
  totalTokensUsed: number
  estimatedCost: number       // USD
}

export interface MissionAnalysis {
  summary: string             // 요청 요약
  requirements: string[]      // 추출된 요구사항
  constraints: string[]       // 제약사항
  acceptanceCriteria: string[] // 수용 기준
  estimatedComplexity: 'simple' | 'medium' | 'complex'
  suggestedApproach: string
}

// ============================================================================
// Artifact Types
// ============================================================================

export type ArtifactType =
  | 'blueprint'     // 아키텍처 설계도
  | 'schema'        // DB 스키마, API 스펙
  | 'diagram'       // ERD, 시퀀스 다이어그램 등
  | 'code'          // 소스 코드
  | 'test'          // 테스트 코드
  | 'review'        // 리뷰 결과
  | 'document'      // 문서
  | 'log'           // 🔥 액션 실행 로그

export interface Artifact {
  id: string
  missionId: string
  taskId: string
  createdBy: AgentRole

  type: ArtifactType
  title: string
  description?: string
  content: string

  // 파일 정보 (코드인 경우)
  filePath?: string
  language?: string

  // 메타데이터
  metadata?: Record<string, any>
  createdAt: number
  updatedAt?: number
}

// ============================================================================
// Event Types (실시간 업데이트용)
// ============================================================================

export type MissionEventType =
  | 'mission:created'
  | 'mission:started'
  | 'mission:analyzing'
  | 'mission:planned'
  | 'mission:progress'
  | 'mission:completed'
  | 'mission:failed'
  | 'task:created'
  | 'task:queued'
  | 'task:started'
  | 'task:progress'
  | 'task:completed'
  | 'task:failed'
  | 'agent:status'
  | 'agent:message'
  | 'artifact:created'
  | 'error'

export interface MissionEvent {
  type: MissionEventType
  timestamp: number
  missionId: string
  data: any
}

export interface AgentStatusEvent {
  type: 'agent:status'
  timestamp: number
  missionId: string
  data: {
    role: AgentRole
    status: AgentStatus
    taskId?: string
    progress?: number
    message?: string
  }
}

export interface AgentMessageEvent {
  type: 'agent:message'
  timestamp: number
  missionId: string
  data: {
    role: AgentRole
    message: string
    isThinking?: boolean
  }
}

// ============================================================================
// API Types
// ============================================================================

export interface StartMissionRequest {
  userRequest: string
  options?: {
    model?: string
    maxConcurrentTasks?: number
    autoApprove?: boolean     // 자동 진행 여부
  }
}

export interface StartMissionResponse {
  missionId: string
  status: MissionStatus
}

export interface AgentCallRequest {
  missionId: string
  taskId: string
  agentRole: AgentRole
  instruction: string
  context?: string
  artifacts?: Artifact[]
  history?: AgentMessage[]
}

export interface AgentCallResponse {
  response: string
  artifacts?: Artifact[]
  toolsUsed?: string[]
  tokenUsage: {
    input: number
    output: number
    total: number
  }
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

// ============================================================================
// Store Types
// ============================================================================

export interface MissionControlState {
  // 현재 미션
  currentMission: Mission | null

  // 에이전트 상태
  agents: Record<AgentRole, AgentState>

  // 이벤트 로그
  events: MissionEvent[]

  // UI 상태
  isLoading: boolean
  error: string | null

  // 설정
  settings: MissionControlSettings
}

export interface MissionControlSettings {
  maxConcurrentTasks: number
  autoApprove: boolean
  defaultModel: string
  showThinking: boolean       // 에이전트 사고 과정 표시
  soundEnabled: boolean       // 알림음
}

// ============================================================================
// Orchestrator Plan Types
// ============================================================================

export interface OrchestratorPlan {
  analysis: MissionAnalysis
  tasks: TaskPlanItem[]
  phases: Phase[]
  estimatedDuration: string
  estimatedCost: number
}

export interface TaskPlanItem {
  tempId: string              // 임시 ID (실제 생성 전)
  type: TaskType
  agent: AgentRole
  title: string
  description: string
  dependencies: string[]      // tempId 참조
  priority: TaskPriority
}

export interface Phase {
  name: string
  description: string
  taskIds: string[]           // 해당 Phase에 속하는 태스크들
  canParallelize: boolean     // 병렬 실행 가능 여부
}
