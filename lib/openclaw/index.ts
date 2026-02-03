/**
 * OpenClaw Bridge
 * GlowUS ↔ OpenClaw 통합 모듈
 *
 * 사용 예시:
 *
 * ```typescript
 * import { OpenClawBridge, createOpenClawBridge } from '@/lib/openclaw';
 *
 * // 1. 브릿지 생성
 * const bridge = createOpenClawBridge({
 *   userId: 'user_123',
 *   agentId: 'agent_456',
 * });
 *
 * // 2. Gateway 연결
 * await bridge.connect();
 *
 * // 3. 스킬 실행
 * const result = await bridge.invokeSkill('web_search', {
 *   query: 'AI trends 2026',
 * });
 *
 * // 4. 연결 종료
 * bridge.disconnect();
 * ```
 */

// Types
export * from './types';

// Gateway Client
export {
  OpenClawGatewayClient,
  getDefaultClient,
  resetDefaultClient,
} from './gateway-client';

// Skill Adapter
export {
  parseSkillMd,
  adaptToGlowUS,
  adaptMultipleSkills,
  loadAndAdaptSkills,
  toLangChainTool,
  toLangChainTools,
} from './skill-adapter';

// Event Handler
export {
  OpenClawEventProcessor,
  OpenClawStreamHandler,
  TaskProgressTracker,
  type EventProcessorOptions,
  type StreamHandlerCallbacks,
  type Notification,
  type TaskProgress,
} from './event-handler';

// Services
export {
  GlowUSGovernanceService,
  GlowUSMemoryService,
  GlowUSCostTrackerService,
  createServices,
  type GovernanceServiceConfig,
  type MemoryServiceConfig,
  type CostTrackerConfig,
  type ServiceContext,
} from './services';

// Skill Tools (LangChain Integration)
export {
  createOpenClawSkillTool,
  createAgentSkillTool,
  createDynamicSkillTools,
  createOpenClawTools,
  createAllOpenClawTools,
  getOrCreateBridge,
  cleanupBridge,
} from './skill-tools';

// ============================================
// High-Level Bridge API
// ============================================

import {
  OpenClawGatewayClient,
} from './gateway-client';
import {
  OpenClawEventProcessor,
  EventProcessorOptions,
  TaskProgressTracker,
} from './event-handler';
import {
  createServices,
  ServiceContext,
} from './services';
import {
  AdaptedSkill,
  SkillResult,
  AgentExecutionContext,
  OpenClawSkill,
  GatewayClientOptions,
} from './types';
import {
  adaptToGlowUS,
  parseSkillMd,
} from './skill-adapter';

export interface OpenClawBridgeOptions extends GatewayClientOptions {
  userId: string;
  agentId: string;
  teamId?: string;
  eventProcessorOptions?: EventProcessorOptions;
  autoConnect?: boolean;
}

/**
 * OpenClaw Bridge - 고수준 통합 API
 */
export class OpenClawBridge {
  private client: OpenClawGatewayClient;
  private eventProcessor: OpenClawEventProcessor;
  private progressTracker: TaskProgressTracker;
  private services: ReturnType<typeof createServices>;
  private skills: Map<string, AdaptedSkill> = new Map();
  private options: OpenClawBridgeOptions;

  constructor(options: OpenClawBridgeOptions) {
    this.options = options;

    // Gateway 클라이언트 생성
    this.client = new OpenClawGatewayClient({
      url: options.url,
      autoReconnect: options.autoReconnect,
      reconnectInterval: options.reconnectInterval,
      maxReconnectAttempts: options.maxReconnectAttempts,
      connectionTimeout: options.connectionTimeout,
      requestTimeout: options.requestTimeout,
      authToken: options.authToken,
      debug: options.debug,
    });

    // 이벤트 프로세서 생성
    this.eventProcessor = new OpenClawEventProcessor(
      this.client,
      options.eventProcessorOptions
    );

    // 진행 상황 추적기
    this.progressTracker = new TaskProgressTracker();

    // 서비스 생성
    this.services = createServices({
      userId: options.userId,
      agentId: options.agentId,
      teamId: options.teamId,
    });
  }

  // ============================================
  // Connection
  // ============================================

  /**
   * Gateway 연결
   */
  async connect(): Promise<void> {
    await this.client.connect();
  }

  /**
   * Gateway 연결 해제
   */
  disconnect(): void {
    this.client.disconnect();
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.client.isConnected();
  }

  /**
   * 연결 상태 조회
   */
  getConnectionState() {
    return this.client.getState();
  }

  // ============================================
  // Skill Management
  // ============================================

  /**
   * OpenClaw 스킬 목록 동기화
   */
  async syncSkills(): Promise<void> {
    const skillNames = await this.client.listSkills();

    for (const name of skillNames) {
      const skillData = await this.client.getSkill(name);
      if (skillData) {
        const adapted = adaptToGlowUS(skillData, this.client);
        this.skills.set(adapted.id, adapted);
      }
    }
  }

  /**
   * SKILL.md 내용으로 스킬 등록
   */
  registerSkillFromMd(content: string): AdaptedSkill {
    const skill = parseSkillMd(content);
    const adapted = adaptToGlowUS(skill, this.client);
    this.skills.set(adapted.id, adapted);
    return adapted;
  }

  /**
   * 스킬 직접 등록
   */
  registerSkill(skill: OpenClawSkill): AdaptedSkill {
    const adapted = adaptToGlowUS(skill, this.client);
    this.skills.set(adapted.id, adapted);
    return adapted;
  }

  /**
   * 스킬 조회
   */
  getSkill(skillId: string): AdaptedSkill | undefined {
    return this.skills.get(skillId);
  }

  /**
   * 모든 스킬 조회
   */
  getAllSkills(): AdaptedSkill[] {
    return Array.from(this.skills.values());
  }

  // ============================================
  // Skill Execution
  // ============================================

  /**
   * 스킬 실행 (Governance, Memory, Cost 통합)
   */
  async invokeSkill(
    skillName: string,
    params: Record<string, any>
  ): Promise<SkillResult> {
    const context = this.createExecutionContext();

    // 등록된 스킬 찾기
    const skillId = `openclaw_${skillName}`;
    const adaptedSkill = this.skills.get(skillId);

    if (adaptedSkill) {
      // 등록된 스킬 실행 (Governance/Memory/Cost 통합)
      return adaptedSkill.execute(params, context);
    }

    // 등록되지 않은 스킬은 직접 호출
    return this.client.invokeSkill(skillName, params, {
      userId: this.options.userId,
      agentId: this.options.agentId,
      teamId: this.options.teamId,
      memoryContext: await this.services.memory.getRelevantContext(''),
      policies: {
        maxCost: 100,
        allowedSkills: [],
        blockedSkills: [],
        requireApproval: [],
      },
    });
  }

  /**
   * 메시지 전송
   */
  async sendMessage(message: string): Promise<any> {
    const context = await this.services.memory.getRelevantContext(message);

    return this.client.sendMessage(message, {
      userId: this.options.userId,
      agentId: this.options.agentId,
      teamId: this.options.teamId,
      memoryContext: context,
      policies: {
        maxCost: 100,
        allowedSkills: [],
        blockedSkills: [],
        requireApproval: [],
      },
    });
  }

  /**
   * 실행 컨텍스트 생성
   */
  private createExecutionContext(): AgentExecutionContext {
    return {
      userId: this.options.userId,
      agentId: this.options.agentId,
      teamId: this.options.teamId,
      executionId: `exec_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      governance: this.services.governance,
      memory: this.services.memory,
      costTracker: this.services.costTracker,
    };
  }

  // ============================================
  // Event & Progress
  // ============================================

  /**
   * 이벤트 핸들러 등록
   */
  on(event: string, handler: (data: any) => void): void {
    this.client.on(event, handler);
  }

  /**
   * 이벤트 핸들러 해제
   */
  off(event: string, handler: (data: any) => void): void {
    this.client.off(event, handler);
  }

  /**
   * 통계 조회
   */
  getStats() {
    return this.eventProcessor.getStats();
  }

  /**
   * 진행 상황 추적기 접근
   */
  getProgressTracker(): TaskProgressTracker {
    return this.progressTracker;
  }

  // ============================================
  // Services
  // ============================================

  /**
   * Governance 서비스 접근
   */
  get governance() {
    return this.services.governance;
  }

  /**
   * Memory 서비스 접근
   */
  get memory() {
    return this.services.memory;
  }

  /**
   * Cost Tracker 서비스 접근
   */
  get costTracker() {
    return this.services.costTracker;
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * 세션 리셋
   */
  async reset(): Promise<void> {
    await this.client.reset();
    this.services.memory.clearExecutionMemory();
    this.services.costTracker.resetSessionCost();
  }

  /**
   * 작업 취소
   */
  async cancel(): Promise<void> {
    await this.client.cancel();
  }
}

/**
 * OpenClaw Bridge 팩토리 함수
 */
export function createOpenClawBridge(options: OpenClawBridgeOptions): OpenClawBridge {
  return new OpenClawBridge(options);
}

// ============================================
// Singleton Instance (선택적)
// ============================================

let defaultBridge: OpenClawBridge | null = null;

export function getDefaultBridge(): OpenClawBridge | null {
  return defaultBridge;
}

export function setDefaultBridge(bridge: OpenClawBridge): void {
  defaultBridge = bridge;
}

export function resetDefaultBridge(): void {
  if (defaultBridge) {
    defaultBridge.disconnect();
    defaultBridge = null;
  }
}
