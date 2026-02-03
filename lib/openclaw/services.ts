/**
 * OpenClaw Bridge Services
 * Governance, Memory, CostTracker 서비스 구현체
 */

import {
  GovernanceService,
  GovernanceCheckResult,
  ApprovalRequest,
  ApprovalResult,
  AuditLogEntry,
  MemoryService,
  ExecutionMemoryEntry,
  CostTrackerService,
  GovernancePolicies,
} from './types';
import { createAdminClient } from '@/lib/supabase/admin';

// ============================================
// Governance Service Implementation
// ============================================

export interface GovernanceServiceConfig {
  defaultPolicies: GovernancePolicies;
  strictMode?: boolean; // 정책 실패 시 차단 (true) 또는 경고만 (false)
}

export class GlowUSGovernanceService implements GovernanceService {
  private config: GovernanceServiceConfig;
  private agentId: string;
  private userId: string;

  constructor(userId: string, agentId: string, config?: Partial<GovernanceServiceConfig>) {
    this.userId = userId;
    this.agentId = agentId;
    this.config = {
      defaultPolicies: {
        maxCost: 100,
        allowedSkills: [],
        blockedSkills: [],
        requireApproval: [],
      },
      strictMode: true,
      ...config,
    };
  }

  /**
   * 스킬 실행 전 Governance 체크
   */
  async check(skillName: string, params: Record<string, any>): Promise<GovernanceCheckResult> {
    try {
      // 에이전트별 정책 로드
      const policies = await this.loadPolicies();

      // 1. 차단 목록 체크
      if (policies.blockedSkills.includes(skillName)) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: `Skill '${skillName}' is blocked by policy`,
          policies: ['blocked_skills'],
        };
      }

      // 2. 허용 목록 체크 (비어있으면 모두 허용)
      if (policies.allowedSkills.length > 0 && !policies.allowedSkills.includes(skillName)) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: `Skill '${skillName}' is not in allowed list`,
          policies: ['allowed_skills'],
        };
      }

      // 3. 승인 필요 체크
      if (policies.requireApproval.includes(skillName)) {
        return {
          allowed: true,
          requiresApproval: true,
          reason: `Skill '${skillName}' requires human approval`,
          policies: ['require_approval'],
        };
      }

      // 4. 민감 작업 체크
      const sensitiveActions = ['delete', 'remove', 'send_email', 'payment', 'transfer'];
      const isSensitive = sensitiveActions.some(action =>
        skillName.toLowerCase().includes(action) ||
        JSON.stringify(params).toLowerCase().includes(action)
      );

      if (isSensitive) {
        return {
          allowed: true,
          requiresApproval: true,
          reason: 'Action involves sensitive operations',
          policies: ['sensitive_action'],
        };
      }

      // 모든 체크 통과
      return {
        allowed: true,
        requiresApproval: false,
      };

    } catch (error) {
      console.error('Governance check error:', error);

      // 엄격 모드면 차단, 아니면 허용
      if (this.config.strictMode) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: 'Governance check failed',
        };
      }

      return {
        allowed: true,
        requiresApproval: false,
      };
    }
  }

  /**
   * HITL 승인 요청
   */
  async requestApproval(request: ApprovalRequest): Promise<ApprovalResult> {
    try {
      const adminClient = createAdminClient();

      // 승인 요청 저장
      const { data, error } = await (adminClient as any)
        .from('agent_approval_requests')
        .insert({
          agent_id: this.agentId,
          user_id: this.userId,
          skill_name: request.skillName,
          params: request.params,
          reason: request.reason,
          urgency: request.urgency,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create approval request:', error);
        return { approved: false, comment: 'Failed to create approval request' };
      }

      // TODO: 실시간 알림 발송 (Telegram, 웹소켓 등)
      // await this.sendApprovalNotification(data);

      // 자동 승인 정책 체크 (긴급 요청 등)
      if (request.urgency === 'critical') {
        // 고위험 작업은 일단 거부, 관리자 확인 필요
        return {
          approved: false,
          comment: 'Critical actions require explicit admin approval',
        };
      }

      // 일반 요청은 대기 (실제로는 웹훅/폴링으로 결과 대기)
      // 여기서는 간단히 자동 승인 (실제 구현 시 대기 로직 필요)
      return {
        approved: true,
        approvedBy: 'auto_policy',
        approvedAt: new Date(),
        comment: 'Auto-approved by policy',
      };

    } catch (error) {
      console.error('Approval request error:', error);
      return { approved: false, comment: 'Approval request failed' };
    }
  }

  /**
   * 감사 로그 기록
   */
  async logAction(action: AuditLogEntry): Promise<void> {
    try {
      const adminClient = createAdminClient();

      await (adminClient as any)
        .from('agent_audit_logs')
        .insert({
          agent_id: action.agentId || this.agentId,
          user_id: action.userId || this.userId,
          action: action.action,
          skill_name: action.skillName,
          params: action.params,
          result: action.result,
          duration_ms: action.duration,
          cost: action.cost,
          success: action.success,
          error: action.error,
          created_at: action.timestamp.toISOString(),
        });

    } catch (error) {
      // 로깅 실패는 무시 (핵심 기능에 영향 X)
      console.error('Audit log error:', error);
    }
  }

  /**
   * 정책 로드
   */
  private async loadPolicies(): Promise<GovernancePolicies> {
    try {
      const adminClient = createAdminClient();

      // 에이전트별 정책 조회
      const { data } = await (adminClient as any)
        .from('agent_policies')
        .select('*')
        .eq('agent_id', this.agentId)
        .single();

      if (data) {
        return {
          maxCost: data.max_cost || this.config.defaultPolicies.maxCost,
          allowedSkills: data.allowed_skills || [],
          blockedSkills: data.blocked_skills || [],
          requireApproval: data.require_approval || [],
        };
      }

      return this.config.defaultPolicies;

    } catch (error) {
      return this.config.defaultPolicies;
    }
  }
}

// ============================================
// Memory Service Implementation
// ============================================

export interface MemoryServiceConfig {
  maxExecutionMemory?: number; // 최대 실행 기록 수
}

export class GlowUSMemoryService implements MemoryService {
  private agentId: string;
  private userId: string;
  private config: MemoryServiceConfig;
  private executionMemory: ExecutionMemoryEntry[] = [];

  constructor(userId: string, agentId: string, config?: MemoryServiceConfig) {
    this.userId = userId;
    this.agentId = agentId;
    this.config = {
      maxExecutionMemory: 100,
      ...config,
    };
  }

  /**
   * 스킬 실행 결과 기록
   */
  async record(skillName: string, params: Record<string, any>, result: any): Promise<void> {
    const entry: ExecutionMemoryEntry = {
      skillName,
      params,
      result,
      success: result?.success ?? true,
      timestamp: new Date(),
    };

    this.executionMemory.push(entry);

    // 메모리 크기 제한
    if (this.executionMemory.length > this.config.maxExecutionMemory!) {
      this.executionMemory = this.executionMemory.slice(-this.config.maxExecutionMemory!);
    }

    // DB에도 저장 (Execution Layer)
    try {
      const adminClient = createAdminClient();

      await (adminClient as any)
        .from('agent_execution_memory')
        .insert({
          agent_id: this.agentId,
          user_id: this.userId,
          skill_name: skillName,
          params,
          result,
          success: entry.success,
        });

    } catch (error) {
      console.error('Memory record error:', error);
    }
  }

  /**
   * 관련 컨텍스트 조회 (5-Layer Memory에서)
   */
  async getRelevantContext(query: string): Promise<string> {
    try {
      const adminClient = createAdminClient();

      // 1. Private Memory (1:1 대화)
      const { data: privateMemory } = await (adminClient as any)
        .from('agent_memories')
        .select('content')
        .eq('agent_id', this.agentId)
        .eq('user_id', this.userId)
        .eq('layer', 'private')
        .order('created_at', { ascending: false })
        .limit(5);

      // 2. Execution Memory (최근 실행)
      const recentExecutions = this.executionMemory.slice(-5);

      // 3. Team Memory (팀 지식)
      const { data: teamMemory } = await (adminClient as any)
        .from('agent_memories')
        .select('content')
        .eq('agent_id', this.agentId)
        .eq('layer', 'team')
        .order('created_at', { ascending: false })
        .limit(3);

      // 컨텍스트 조합
      const contexts: string[] = [];

      if (privateMemory?.length) {
        contexts.push('## 사용자 선호도\n' + privateMemory.map((m: any) => m.content).join('\n'));
      }

      if (recentExecutions.length) {
        contexts.push('## 최근 실행 기록\n' + recentExecutions.map(e =>
          `- ${e.skillName}: ${e.success ? '성공' : '실패'}`
        ).join('\n'));
      }

      if (teamMemory?.length) {
        contexts.push('## 팀 지식\n' + teamMemory.map((m: any) => m.content).join('\n'));
      }

      return contexts.join('\n\n');

    } catch (error) {
      console.error('Context retrieval error:', error);
      return '';
    }
  }

  /**
   * 실행 메모리 추가
   */
  async addExecutionMemory(entry: ExecutionMemoryEntry): Promise<void> {
    this.executionMemory.push(entry);

    if (this.executionMemory.length > this.config.maxExecutionMemory!) {
      this.executionMemory = this.executionMemory.slice(-this.config.maxExecutionMemory!);
    }
  }

  /**
   * 실행 메모리 조회
   */
  getExecutionMemory(): ExecutionMemoryEntry[] {
    return [...this.executionMemory];
  }

  /**
   * 메모리 클리어
   */
  clearExecutionMemory(): void {
    this.executionMemory = [];
  }
}

// ============================================
// Cost Tracker Service Implementation
// ============================================

export interface CostTrackerConfig {
  defaultMaxCost?: number;
  warningThreshold?: number; // 예산의 몇 % 사용 시 경고 (0-1)
}

export class GlowUSCostTrackerService implements CostTrackerService {
  private agentId: string;
  private userId: string;
  private config: CostTrackerConfig;
  private sessionCost = 0;

  // 스킬별 기본 비용 추정치
  private static SKILL_COSTS: Record<string, number> = {
    'web_search': 0.01,
    'scrape_website': 0.02,
    'browser_automation': 0.05,
    'code_interpreter': 0.03,
    'github_api': 0.01,
    'image_generation': 0.10,
    'voice_synthesis': 0.05,
    'file_operation': 0.001,
    'default': 0.01,
  };

  constructor(userId: string, agentId: string, config?: CostTrackerConfig) {
    this.userId = userId;
    this.agentId = agentId;
    this.config = {
      defaultMaxCost: 100,
      warningThreshold: 0.8,
      ...config,
    };
  }

  /**
   * 스킬 실행 비용 추정
   */
  async estimateCost(skillName: string, params: Record<string, any>): Promise<number> {
    // 기본 비용
    let baseCost = GlowUSCostTrackerService.SKILL_COSTS[skillName]
      || GlowUSCostTrackerService.SKILL_COSTS['default'];

    // 파라미터 기반 추가 비용 (예: 대용량 데이터 처리)
    if (params.size && typeof params.size === 'number') {
      baseCost += params.size * 0.001; // MB당 0.001
    }

    if (params.iterations && typeof params.iterations === 'number') {
      baseCost *= params.iterations;
    }

    return baseCost;
  }

  /**
   * 실제 비용 기록
   */
  async recordCost(skillName: string, actualCost: number): Promise<void> {
    this.sessionCost += actualCost;

    try {
      const adminClient = createAdminClient();

      // 비용 기록
      await (adminClient as any)
        .from('agent_cost_records')
        .insert({
          agent_id: this.agentId,
          user_id: this.userId,
          skill_name: skillName,
          cost: actualCost,
        });

      // 경고 임계치 체크
      const totalSpent = await this.getCurrentSpent();
      const budget = await this.getBudget();

      if (totalSpent / budget >= this.config.warningThreshold!) {
        console.warn(`[Cost Warning] Agent ${this.agentId} has used ${(totalSpent / budget * 100).toFixed(1)}% of budget`);
        // TODO: 알림 발송
      }

    } catch (error) {
      console.error('Cost record error:', error);
    }
  }

  /**
   * 예산 체크
   */
  async checkBudget(estimatedCost: number): Promise<boolean> {
    const currentSpent = await this.getCurrentSpent();
    const budget = await this.getBudget();

    return (currentSpent + estimatedCost) <= budget;
  }

  /**
   * 현재 지출 조회
   */
  async getCurrentSpent(): Promise<number> {
    try {
      const adminClient = createAdminClient();

      // 오늘 지출 합계
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data } = await (adminClient as any)
        .from('agent_cost_records')
        .select('cost')
        .eq('agent_id', this.agentId)
        .gte('created_at', today.toISOString());

      const totalCost = (data || []).reduce((sum: number, r: any) => sum + (r.cost || 0), 0);

      return totalCost + this.sessionCost;

    } catch (error) {
      console.error('Get spent error:', error);
      return this.sessionCost;
    }
  }

  /**
   * 예산 조회
   */
  private async getBudget(): Promise<number> {
    try {
      const adminClient = createAdminClient();

      const { data } = await (adminClient as any)
        .from('agent_policies')
        .select('max_cost')
        .eq('agent_id', this.agentId)
        .single();

      return data?.max_cost || this.config.defaultMaxCost!;

    } catch (error) {
      return this.config.defaultMaxCost!;
    }
  }

  /**
   * 세션 비용 조회
   */
  getSessionCost(): number {
    return this.sessionCost;
  }

  /**
   * 세션 비용 리셋
   */
  resetSessionCost(): void {
    this.sessionCost = 0;
  }
}

// ============================================
// Service Factory
// ============================================

export interface ServiceContext {
  userId: string;
  agentId: string;
  teamId?: string;
}

export function createServices(context: ServiceContext) {
  return {
    governance: new GlowUSGovernanceService(context.userId, context.agentId),
    memory: new GlowUSMemoryService(context.userId, context.agentId),
    costTracker: new GlowUSCostTrackerService(context.userId, context.agentId),
  };
}
