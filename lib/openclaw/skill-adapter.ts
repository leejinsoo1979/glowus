/**
 * OpenClaw Skill Adapter
 * OpenClaw 스킬을 GlowUS DynamicStructuredTool로 변환
 */

import {
  OpenClawSkill,
  AdaptedSkill,
  AgentExecutionContext,
  SkillResult,
  GlowUSContext,
  GovernanceCheckResult,
} from './types';
import { OpenClawGatewayClient } from './gateway-client';

// ============================================
// Skill Parser (SKILL.md → OpenClawSkill)
// ============================================

/**
 * SKILL.md 파일 파싱
 */
export function parseSkillMd(content: string): OpenClawSkill {
  const lines = content.split('\n');
  const skill: OpenClawSkill = {
    name: '',
    description: '',
    tools: [],
    requires_api: [],
  };

  let inFrontmatter = false;
  let frontmatterLines: string[] = [];
  let bodyLines: string[] = [];
  let currentSection: string | null = null;
  let currentTool: any = null;

  for (const line of lines) {
    // Frontmatter 처리
    if (line.trim() === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true;
        continue;
      } else {
        inFrontmatter = false;
        // Frontmatter 파싱
        parseFrontmatter(frontmatterLines.join('\n'), skill);
        continue;
      }
    }

    if (inFrontmatter) {
      frontmatterLines.push(line);
      continue;
    }

    bodyLines.push(line);

    // 섹션 헤더 감지
    const sectionMatch = line.match(/^##\s+(.+)/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].toLowerCase().trim();
      currentTool = null;
      continue;
    }

    // 툴 헤더 감지
    const toolMatch = line.match(/^###\s+(.+)/);
    if (toolMatch && currentSection === 'tools') {
      if (currentTool) {
        skill.tools?.push(currentTool);
      }
      currentTool = {
        name: toolMatch[1].trim(),
        description: '',
        params: [],
      };
      continue;
    }

    // 툴 설명 파싱
    if (currentTool && line.trim() && !line.startsWith('#')) {
      if (!currentTool.description) {
        currentTool.description = line.trim();
      } else if (line.toLowerCase().includes('endpoint:')) {
        currentTool.endpoint = line.split(':').slice(1).join(':').trim();
      }
    }
  }

  // 마지막 툴 추가
  if (currentTool) {
    skill.tools?.push(currentTool);
  }

  // 이름이 없으면 첫 번째 H1에서 추출
  if (!skill.name) {
    const h1Match = content.match(/^#\s+(.+)/m);
    if (h1Match) {
      skill.name = h1Match[1].trim().toLowerCase().replace(/\s+/g, '-');
    }
  }

  // 설명이 없으면 첫 번째 문단에서 추출
  if (!skill.description) {
    const firstPara = bodyLines.find(l => l.trim() && !l.startsWith('#'));
    if (firstPara) {
      skill.description = firstPara.trim();
    }
  }

  return skill;
}

/**
 * YAML-like Frontmatter 파싱
 */
function parseFrontmatter(content: string, skill: OpenClawSkill): void {
  const lines = content.split('\n');
  let inRequiresApi = false;
  let currentApiItem: any = null;

  for (const line of lines) {
    // requires_api 배열 시작
    if (line.match(/^requires_api:\s*$/)) {
      inRequiresApi = true;
      continue;
    }

    // requires_api 항목
    if (inRequiresApi) {
      const newItemMatch = line.match(/^\s*-\s*name:\s*(.+)$/);
      if (newItemMatch) {
        if (currentApiItem) {
          skill.requires_api?.push(currentApiItem);
        }
        currentApiItem = { name: newItemMatch[1].trim(), required: true };
        continue;
      }

      const propMatch = line.match(/^\s+(description|default|required):\s*(.+)$/);
      if (propMatch && currentApiItem) {
        const [, key, value] = propMatch;
        if (key === 'required') {
          currentApiItem.required = value.trim() === 'true';
        } else {
          currentApiItem[key] = value.trim();
        }
        continue;
      }

      // 배열 끝
      if (!line.startsWith(' ') && !line.startsWith('-') && line.includes(':')) {
        if (currentApiItem) {
          skill.requires_api?.push(currentApiItem);
        }
        currentApiItem = null;
        inRequiresApi = false;
      }
    }

    // 일반 키-값
    if (!inRequiresApi) {
      const match = line.match(/^(\w[\w-]*):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        const val = value.trim();

        switch (key) {
          case 'name':
            skill.name = val;
            break;
          case 'description':
            skill.description = val;
            break;
          case 'homepage':
            skill.homepage = val;
            break;
          case 'version':
            skill.version = val;
            break;
          case 'author':
            skill.author = val;
            break;
          case 'tags':
            skill.tags = val.split(',').map(t => t.trim());
            break;
        }
      }
    }
  }

  // 마지막 API 항목
  if (currentApiItem) {
    skill.requires_api?.push(currentApiItem);
  }
}

// ============================================
// Skill Adapter
// ============================================

/**
 * OpenClaw 스킬을 GlowUS AdaptedSkill로 변환
 */
export function adaptToGlowUS(
  skill: OpenClawSkill,
  gatewayClient: OpenClawGatewayClient,
  options: AdaptOptions = {}
): AdaptedSkill {
  const {
    requiresApproval = false,
    estimatedCost,
  } = options;

  const adaptedSkill: AdaptedSkill = {
    id: `openclaw_${skill.name}`,
    name: skill.name,
    description: skill.description,
    source: 'openclaw',
    originalSkill: skill,
    tools: skill.tools?.map(t => t.name) || [],
    requiresApproval,
    estimatedCost,

    execute: async (params, context) => {
      return executeAdaptedSkill(skill, params, context, gatewayClient);
    },
  };

  return adaptedSkill;
}

interface AdaptOptions {
  requiresApproval?: boolean;
  estimatedCost?: number;
}

/**
 * 적응된 스킬 실행
 */
async function executeAdaptedSkill(
  skill: OpenClawSkill,
  params: Record<string, any>,
  context: AgentExecutionContext,
  gatewayClient: OpenClawGatewayClient
): Promise<SkillResult> {
  const startTime = Date.now();

  try {
    // 1. Governance 체크
    const governanceResult = await checkGovernance(skill.name, params, context);
    if (!governanceResult.allowed) {
      return {
        success: false,
        error: {
          code: 'GOVERNANCE_DENIED',
          message: governanceResult.reason || 'Action not allowed by governance policies',
        },
        duration: Date.now() - startTime,
      };
    }

    // 2. 승인 필요 시 대기
    if (governanceResult.requiresApproval) {
      const approvalResult = await context.governance.requestApproval({
        skillName: skill.name,
        params,
        reason: `Skill ${skill.name} requires approval`,
        urgency: 'normal',
      });

      if (!approvalResult.approved) {
        return {
          success: false,
          error: {
            code: 'APPROVAL_DENIED',
            message: approvalResult.comment || 'Approval denied',
          },
          duration: Date.now() - startTime,
        };
      }
    }

    // 3. 비용 체크
    const estimatedCost = await context.costTracker.estimateCost(skill.name, params);
    const budgetOk = await context.costTracker.checkBudget(estimatedCost);
    if (!budgetOk) {
      return {
        success: false,
        error: {
          code: 'BUDGET_EXCEEDED',
          message: 'Estimated cost exceeds remaining budget',
        },
        duration: Date.now() - startTime,
      };
    }

    // 4. GlowUS 컨텍스트 생성
    const glowusContext = await buildGlowUSContext(context);

    // 5. OpenClaw 스킬 실행
    const result = await gatewayClient.invokeSkill(skill.name, params, glowusContext);

    // 6. 비용 기록
    if (result.cost) {
      await context.costTracker.recordCost(skill.name, result.cost);
    }

    // 7. Memory 기록
    await context.memory.record(skill.name, params, result);

    // 8. 감사 로그
    await context.governance.logAction({
      action: 'invoke_skill',
      skillName: skill.name,
      params,
      result: result.success ? result.data : result.error,
      userId: context.userId,
      agentId: context.agentId,
      timestamp: new Date(),
      duration: result.duration,
      cost: result.cost,
      success: result.success,
      error: result.error?.message,
    });

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // 에러 로그
    await context.governance.logAction({
      action: 'invoke_skill',
      skillName: skill.name,
      params,
      userId: context.userId,
      agentId: context.agentId,
      timestamp: new Date(),
      duration: Date.now() - startTime,
      success: false,
      error: errorMessage,
    });

    return {
      success: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: errorMessage,
      },
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Governance 체크
 */
async function checkGovernance(
  skillName: string,
  params: Record<string, any>,
  context: AgentExecutionContext
): Promise<GovernanceCheckResult> {
  try {
    return await context.governance.check(skillName, params);
  } catch (error) {
    // Governance 서비스 실패 시 기본 허용 (설정에 따라 변경 가능)
    console.warn('Governance check failed, defaulting to allow:', error);
    return { allowed: true, requiresApproval: false };
  }
}

/**
 * GlowUS 컨텍스트 빌드
 */
async function buildGlowUSContext(context: AgentExecutionContext): Promise<GlowUSContext> {
  // Memory에서 관련 컨텍스트 추출
  const memoryContext = await context.memory.getRelevantContext('');

  // 현재 지출 조회
  const currentSpent = await context.costTracker.getCurrentSpent();

  return {
    userId: context.userId,
    agentId: context.agentId,
    teamId: context.teamId,
    memoryContext,
    policies: {
      maxCost: 100, // 기본값, 실제로는 Governance에서 조회
      allowedSkills: [],
      blockedSkills: [],
      requireApproval: [],
    },
    costTracking: {
      maxCostPerTask: 10,
      currentSpent,
      budgetRemaining: 100 - currentSpent,
    },
  };
}

// ============================================
// Batch Adapter
// ============================================

/**
 * 여러 스킬 일괄 변환
 */
export function adaptMultipleSkills(
  skills: OpenClawSkill[],
  gatewayClient: OpenClawGatewayClient,
  globalOptions: AdaptOptions = {}
): AdaptedSkill[] {
  return skills.map(skill => adaptToGlowUS(skill, gatewayClient, globalOptions));
}

/**
 * SKILL.md 파일 목록에서 스킬 로드 및 변환
 */
export async function loadAndAdaptSkills(
  skillContents: { name: string; content: string }[],
  gatewayClient: OpenClawGatewayClient,
  options: AdaptOptions = {}
): Promise<AdaptedSkill[]> {
  const adaptedSkills: AdaptedSkill[] = [];

  for (const { content } of skillContents) {
    try {
      const skill = parseSkillMd(content);
      const adapted = adaptToGlowUS(skill, gatewayClient, options);
      adaptedSkills.push(adapted);
    } catch (error) {
      console.error('Failed to adapt skill:', error);
    }
  }

  return adaptedSkills;
}

// ============================================
// LangChain Integration
// ============================================

/**
 * AdaptedSkill을 LangChain DynamicStructuredTool로 변환
 */
export function toLangChainTool(adaptedSkill: AdaptedSkill) {
  // 동적 import를 피하기 위해 팩토리 함수로 반환
  return {
    name: adaptedSkill.id,
    description: `[OpenClaw] ${adaptedSkill.description}`,
    schema: {
      type: 'object',
      properties: {
        params: {
          type: 'object',
          description: 'Parameters to pass to the skill',
        },
      },
    },
    func: async (input: { params?: Record<string, any> }, context: AgentExecutionContext) => {
      const result = await adaptedSkill.execute(input.params || {}, context);
      if (result.success) {
        return JSON.stringify(result.data);
      } else {
        throw new Error(result.error?.message || 'Skill execution failed');
      }
    },
  };
}

/**
 * 여러 스킬을 LangChain 도구로 일괄 변환
 */
export function toLangChainTools(adaptedSkills: AdaptedSkill[]) {
  return adaptedSkills.map(toLangChainTool);
}
