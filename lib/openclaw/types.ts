/**
 * OpenClaw Bridge Types
 * GlowUS ↔ OpenClaw Gateway 통합을 위한 타입 정의
 */

// ============================================
// OpenClaw Gateway Events
// ============================================

export type OpenClawEventType =
  | 'message'
  | 'tool_start'
  | 'tool_end'
  | 'error'
  | 'connected'
  | 'disconnected'
  | 'session_started'
  | 'thinking'
  | 'response';

export interface OpenClawEvent {
  type: OpenClawEventType;
  sessionId: string;
  timestamp: Date;
  data: any;
}

export interface OpenClawToolEvent extends OpenClawEvent {
  type: 'tool_start' | 'tool_end';
  data: {
    toolName: string;
    params?: Record<string, any>;
    result?: any;
    error?: string;
    duration?: number;
  };
}

export interface OpenClawMessageEvent extends OpenClawEvent {
  type: 'message' | 'thinking' | 'response';
  data: {
    content: string;
    role: 'user' | 'assistant' | 'system';
  };
}

export interface OpenClawErrorEvent extends OpenClawEvent {
  type: 'error';
  data: {
    code: string;
    message: string;
    details?: any;
  };
}

// ============================================
// OpenClaw Requests
// ============================================

export type OpenClawAction =
  | 'send_message'
  | 'invoke_skill'
  | 'list_skills'
  | 'get_skill'
  | 'cancel'
  | 'reset';

export interface OpenClawRequest {
  action: OpenClawAction;
  sessionId?: string;
  skill?: string;
  message?: string;
  params?: Record<string, any>;
  context?: GlowUSContext;
}

export interface OpenClawResponse {
  success: boolean;
  sessionId: string;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================
// GlowUS Context (OpenClaw에 주입)
// ============================================

export interface GlowUSContext {
  // 사용자/에이전트 식별
  userId: string;
  agentId: string;
  teamId?: string;
  organizationId?: string;

  // 5-Layer Memory에서 추출된 관련 컨텍스트
  memoryContext: string;

  // 에이전트 정보
  agent?: {
    name: string;
    persona?: string;
    role?: string;
  };

  // Governance 정책
  policies: GovernancePolicies;

  // 비용 추적
  costTracking?: {
    maxCostPerTask: number;
    currentSpent: number;
    budgetRemaining: number;
  };
}

export interface GovernancePolicies {
  // 비용 한도
  maxCost: number;
  maxCostPerSkill?: number;

  // 스킬 허용/차단
  allowedSkills: string[];
  blockedSkills: string[];
  requireApproval: string[];

  // 실행 제한
  maxConcurrentSkills?: number;
  maxExecutionTime?: number; // ms

  // 데이터 정책
  allowExternalData?: boolean;
  sensitiveDataMasking?: boolean;
}

// ============================================
// OpenClaw Skill Definition
// ============================================

export interface OpenClawSkill {
  name: string;
  description: string;
  homepage?: string;
  instructions?: string;
  tools?: OpenClawTool[];
  requires_api?: OpenClawApiRequirement[];

  // 메타데이터
  version?: string;
  author?: string;
  tags?: string[];
}

export interface OpenClawTool {
  name: string;
  description: string;
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: OpenClawToolParam[];
}

export interface OpenClawToolParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
  default?: any;
}

export interface OpenClawApiRequirement {
  name: string;
  description?: string;
  required?: boolean;
  default?: string;
}

// ============================================
// Adapted Skill (GlowUS 내부용)
// ============================================

export interface AdaptedSkill {
  id: string;                    // openclaw_${name}
  name: string;
  description: string;
  source: 'openclaw' | 'glowus' | 'custom';
  originalSkill: OpenClawSkill;

  // 실행 함수
  execute: (
    params: Record<string, any>,
    context: AgentExecutionContext
  ) => Promise<SkillResult>;

  // 메타데이터
  tools: string[];
  requiresApproval: boolean;
  estimatedCost?: number;
}

export interface AgentExecutionContext {
  userId: string;
  agentId: string;
  teamId?: string;

  // 서비스 참조
  governance: GovernanceService;
  memory: MemoryService;
  costTracker: CostTrackerService;

  // 실행 컨텍스트
  taskId?: string;
  parentTaskId?: string;
  executionId: string;
}

export interface SkillResult {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };

  // 메타데이터
  duration: number;
  cost?: number;
  toolsUsed?: string[];
}

// ============================================
// Service Interfaces
// ============================================

export interface GovernanceService {
  check(skillName: string, params: Record<string, any>): Promise<GovernanceCheckResult>;
  requestApproval(request: ApprovalRequest): Promise<ApprovalResult>;
  logAction(action: AuditLogEntry): Promise<void>;
}

export interface GovernanceCheckResult {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
  policies?: string[];
}

export interface ApprovalRequest {
  skillName: string;
  params: Record<string, any>;
  reason: string;
  urgency: 'low' | 'normal' | 'high' | 'critical';
}

export interface ApprovalResult {
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  comment?: string;
}

export interface AuditLogEntry {
  action: string;
  skillName?: string;
  params?: Record<string, any>;
  result?: any;
  userId: string;
  agentId: string;
  timestamp: Date;
  duration?: number;
  cost?: number;
  success: boolean;
  error?: string;
}

export interface MemoryService {
  record(skillName: string, params: Record<string, any>, result: any): Promise<void>;
  getRelevantContext(query: string): Promise<string>;
  addExecutionMemory(entry: ExecutionMemoryEntry): Promise<void>;
}

export interface ExecutionMemoryEntry {
  skillName: string;
  params: Record<string, any>;
  result: any;
  success: boolean;
  timestamp: Date;
  feedback?: string;
}

export interface CostTrackerService {
  estimateCost(skillName: string, params: Record<string, any>): Promise<number>;
  recordCost(skillName: string, actualCost: number): Promise<void>;
  checkBudget(estimatedCost: number): Promise<boolean>;
  getCurrentSpent(): Promise<number>;
}

// ============================================
// Gateway Client Options
// ============================================

export interface GatewayClientOptions {
  url?: string;  // default: ws://127.0.0.1:18789

  // 재연결 설정
  autoReconnect?: boolean;
  reconnectInterval?: number;  // ms
  maxReconnectAttempts?: number;

  // 타임아웃
  connectionTimeout?: number;  // ms
  requestTimeout?: number;     // ms

  // 인증
  authToken?: string;

  // 디버그
  debug?: boolean;
}

export interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  sessionId?: string;
  lastConnected?: Date;
  lastDisconnected?: Date;
  reconnectAttempts: number;
  error?: string;
}

// ============================================
// Skill Registry
// ============================================

export interface SkillRegistry {
  // 스킬 관리
  register(skill: AdaptedSkill): void;
  unregister(skillId: string): void;
  get(skillId: string): AdaptedSkill | undefined;
  list(): AdaptedSkill[];

  // 스킬 검색
  search(query: string): AdaptedSkill[];
  getBySource(source: 'openclaw' | 'glowus' | 'custom'): AdaptedSkill[];

  // OpenClaw 동기화
  syncFromOpenClaw(): Promise<void>;
}

// ============================================
// Event Emitter Types
// ============================================

export type EventHandler<T = any> = (event: T) => void | Promise<void>;

export interface EventEmitter {
  on(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void;
  emit(event: string, data: any): void;
  once(event: string, handler: EventHandler): void;
}
