/**
 * Workflow Types - 다단계 루프 워크플로우 타입 정의
 */

// 워크플로우 단계 상태
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

// 워크플로우 전체 상태
export type WorkflowStatus = 'draft' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

// 조건 연산자
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'
  | 'regex_match'

// 조건 정의
export interface WorkflowCondition {
  field: string                    // 검사할 필드 (이전 단계 결과에서)
  operator: ConditionOperator      // 비교 연산자
  value?: any                      // 비교 값
}

// 분기 정의
export interface WorkflowBranch {
  condition: WorkflowCondition     // 분기 조건
  nextStepId: string               // 조건 만족 시 이동할 단계
}

// 루프 정의
export interface WorkflowLoop {
  type: 'for_each' | 'while' | 'count'
  source?: string                  // for_each: 반복할 배열 필드
  condition?: WorkflowCondition    // while: 반복 조건
  count?: number                   // count: 반복 횟수
  maxIterations?: number           // 무한 루프 방지
}

// 단계 입력 매핑
export interface InputMapping {
  from: string                     // 소스 (예: "step_1.result.employees")
  to: string                       // 대상 파라미터 이름
  transform?: 'first' | 'last' | 'count' | 'sum' | 'join' | 'json'
}

// 워크플로우 단계 정의
export interface WorkflowStep {
  id: string                       // 단계 고유 ID
  name: string                     // 단계 이름 (표시용)
  description?: string             // 단계 설명

  // 실행할 액션
  action: {
    type: 'tool' | 'api' | 'condition' | 'delay' | 'notify' | 'sub_workflow'
    tool?: string                  // 도구 이름 (type: 'tool')
    endpoint?: string              // API 엔드포인트 (type: 'api')
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    subWorkflowId?: string         // 서브 워크플로우 ID (type: 'sub_workflow')
    delayMs?: number               // 지연 시간 (type: 'delay')
  }

  // 입력 파라미터
  inputs?: Record<string, any>     // 정적 입력
  inputMappings?: InputMapping[]   // 이전 단계에서 매핑

  // 흐름 제어
  branches?: WorkflowBranch[]      // 조건부 분기
  loop?: WorkflowLoop              // 루프 설정

  // 에러 처리
  onError?: 'fail' | 'skip' | 'retry' | 'continue'
  retryCount?: number              // 재시도 횟수
  retryDelayMs?: number            // 재시도 간격

  // 타임아웃
  timeoutMs?: number               // 단계 타임아웃

  // 다음 단계 (분기가 없을 때)
  nextStepId?: string | null       // null이면 종료
}

// 워크플로우 정의
export interface WorkflowDefinition {
  id: string
  name: string
  description?: string
  version: string

  // 입력 스키마
  inputSchema?: {
    required?: string[]
    properties: Record<string, {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object'
      description?: string
      default?: any
    }>
  }

  // 단계들
  steps: WorkflowStep[]
  startStepId: string              // 시작 단계 ID

  // 메타데이터
  tags?: string[]
  category?: string
  createdAt: string
  updatedAt: string
  createdBy?: string
}

// 단계 실행 결과
export interface StepExecutionResult {
  stepId: string
  status: StepStatus
  startedAt: string
  completedAt?: string

  // 결과 데이터
  result?: any
  error?: string

  // 루프 정보
  loopIteration?: number
  loopTotal?: number
}

// 워크플로우 실행 인스턴스
export interface WorkflowExecution {
  id: string
  workflowId: string
  workflowVersion: string

  status: WorkflowStatus
  currentStepId?: string

  // 입력/출력
  inputs: Record<string, any>
  outputs?: Record<string, any>

  // 단계별 결과
  stepResults: Record<string, StepExecutionResult>

  // 타이밍
  startedAt: string
  completedAt?: string

  // 에러 정보
  error?: string

  // 컨텍스트 (에이전트/회사 정보)
  context?: {
    agentId?: string
    companyId?: string
    userId?: string
  }
}

// 워크플로우 템플릿 (자주 사용하는 패턴)
export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: 'hr' | 'finance' | 'project' | 'report' | 'notification' | 'custom'
  workflow: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>

  // 커스터마이징 가능한 변수
  variables?: {
    name: string
    description: string
    type: 'string' | 'number' | 'boolean'
    default?: any
  }[]
}

// 워크플로우 이벤트 (실시간 모니터링용)
export interface WorkflowEvent {
  type: 'started' | 'step_started' | 'step_completed' | 'step_failed' | 'completed' | 'failed'
  executionId: string
  stepId?: string
  timestamp: string
  data?: any
}

// 워크플로우 실행 요청
export interface ExecuteWorkflowRequest {
  workflowId: string
  inputs?: Record<string, any>
  context?: {
    agentId?: string
    companyId?: string
    userId?: string
  }
  async?: boolean                  // 비동기 실행 여부
}

// 워크플로우 실행 응답
export interface ExecuteWorkflowResponse {
  executionId: string
  status: WorkflowStatus
  outputs?: Record<string, any>
  stepResults?: Record<string, StepExecutionResult>
  error?: string
}
