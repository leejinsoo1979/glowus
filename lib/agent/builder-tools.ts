/**
 * Builder Tools - 워크플로우 빌더 & 에이전트 빌더 제어 도구
 *
 * Claude Code가 워크플로우와 에이전트를 생성/수정/실행할 수 있는 도구 모음
 */

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

// ============================================
// Types (imported from workflow & agent-builder)
// ============================================

interface WorkflowNode {
  id: string
  type: 'trigger' | 'data_input' | 'data_process' | 'custom_code' | 'ai_process' | 'condition' | 'delay' | 'http_request' | 'notification'
  label: string
  description?: string
  config?: Record<string, any>
  position?: { x: number; y: number }
}

interface WorkflowEdge {
  id: string
  source: string
  target: string
  label?: string
}

interface WorkflowDefinition {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  trigger: {
    type: 'webhook' | 'schedule' | 'manual' | 'event'
    config?: Record<string, any>
  }
}

// ============================================
// Workflow Builder Tools
// ============================================

/**
 * 워크플로우 목록 조회
 */
export const listWorkflowsTool = new DynamicStructuredTool({
  name: 'list_workflows',
  description: 'GlowUS 워크플로우 목록을 조회합니다.',
  schema: z.object({
    status: z.enum(['all', 'draft', 'active', 'paused']).optional().describe('워크플로우 상태 필터'),
  }),
  func: async ({ status }) => {
    // TODO: 실제 DB에서 워크플로우 목록 조회
    return JSON.stringify({
      success: true,
      workflows: [
        { id: 'wf_1', name: '신규 직원 온보딩', status: 'active', nodes: 5 },
        { id: 'wf_2', name: '일일 리포트 자동화', status: 'draft', nodes: 3 },
      ],
      message: '워크플로우 목록을 조회했습니다.',
    })
  },
})

/**
 * 새 워크플로우 생성
 */
export const createWorkflowTool = new DynamicStructuredTool({
  name: 'create_workflow',
  description: '새로운 워크플로우를 생성합니다. 노드와 엣지를 정의하여 자동화 흐름을 만듭니다.',
  schema: z.object({
    name: z.string().describe('워크플로우 이름'),
    description: z.string().optional().describe('워크플로우 설명'),
    triggerType: z.enum(['webhook', 'schedule', 'manual', 'event']).describe('트리거 유형'),
    nodes: z.array(z.object({
      type: z.enum(['trigger', 'data_input', 'data_process', 'custom_code', 'ai_process', 'condition', 'delay', 'http_request', 'notification']),
      label: z.string(),
      description: z.string().optional(),
      config: z.record(z.string(), z.any()).optional(),
    })).describe('워크플로우 노드 목록'),
  }),
  func: async ({ name, description, triggerType, nodes }) => {
    // 노드 ID 생성 및 엣지 자동 연결
    const processedNodes: WorkflowNode[] = nodes.map((node, index) => ({
      id: `node_${index + 1}`,
      ...node,
      position: { x: 100, y: 100 + index * 150 },
    }))

    // 순차적 엣지 생성
    const edges: WorkflowEdge[] = processedNodes.slice(0, -1).map((node, index) => ({
      id: `edge_${index + 1}`,
      source: node.id,
      target: processedNodes[index + 1].id,
    }))

    const workflow: WorkflowDefinition = {
      id: `wf_${Date.now()}`,
      name,
      description,
      nodes: processedNodes,
      edges,
      trigger: { type: triggerType },
    }

    return JSON.stringify({
      success: true,
      workflow,
      message: `워크플로우 "${name}"이(가) 생성되었습니다.`,
      action: {
        type: 'navigate',
        url: `/dashboard-group/workflow-builder?id=${workflow.id}`,
      },
    })
  },
})

/**
 * 워크플로우에 노드 추가
 */
export const addWorkflowNodeTool = new DynamicStructuredTool({
  name: 'add_workflow_node',
  description: '기존 워크플로우에 새로운 노드를 추가합니다.',
  schema: z.object({
    workflowId: z.string().describe('워크플로우 ID'),
    nodeType: z.enum([
      'trigger',        // 트리거 - 워크플로우 시작점
      'data_input',     // 데이터 입력 - 외부 데이터 소스 연결
      'data_process',   // 데이터 처리 - 데이터 변환 및 처리
      'custom_code',    // 커스텀 코드 - 사용자 정의 코드 실행
      'ai_process',     // AI 처리 - AI 모델로 데이터 처리
      'condition',      // 조건 분기 - 조건에 따른 흐름 분기
      'delay',          // 딜레이 - 지정 시간 대기
      'http_request',   // HTTP 요청 - 외부 API 호출
      'notification',   // 알림 - 이메일/슬랙 알림 전송
    ]).describe('노드 유형'),
    label: z.string().describe('노드 레이블'),
    config: z.record(z.string(), z.any()).optional().describe('노드 설정'),
    connectAfter: z.string().optional().describe('연결할 이전 노드 ID'),
  }),
  func: async ({ workflowId, nodeType, label, config, connectAfter }) => {
    const newNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type: nodeType,
      label,
      config,
      position: { x: 200, y: 200 },
    }

    return JSON.stringify({
      success: true,
      node: newNode,
      message: `노드 "${label}"이(가) 추가되었습니다.`,
      nextStep: connectAfter
        ? `노드가 "${connectAfter}" 뒤에 연결되었습니다.`
        : '노드를 다른 노드와 연결하세요.',
    })
  },
})

/**
 * 워크플로우 실행
 */
export const executeWorkflowTool = new DynamicStructuredTool({
  name: 'execute_workflow',
  description: '워크플로우를 실행합니다.',
  schema: z.object({
    workflowId: z.string().describe('실행할 워크플로우 ID'),
    inputs: z.record(z.string(), z.any()).optional().describe('워크플로우 입력 데이터'),
    async: z.boolean().optional().default(false).describe('비동기 실행 여부'),
  }),
  func: async ({ workflowId, inputs, async: isAsync }) => {
    return JSON.stringify({
      success: true,
      executionId: `exec_${Date.now()}`,
      workflowId,
      status: isAsync ? 'running' : 'completed',
      message: isAsync
        ? `워크플로우가 백그라운드에서 실행 중입니다.`
        : `워크플로우가 실행 완료되었습니다.`,
    })
  },
})

// ============================================
// Agent Builder Tools
// ============================================

/**
 * 에이전트 목록 조회
 */
export const listAgentsTool = new DynamicStructuredTool({
  name: 'list_agents',
  description: 'GlowUS에 등록된 커스텀 에이전트 목록을 조회합니다.',
  schema: z.object({
    category: z.string().optional().describe('카테고리 필터 (productivity, marketing, sales, support, development, data, creative, education, custom)'),
    status: z.enum(['all', 'draft', 'active', 'paused']).optional().describe('상태 필터'),
  }),
  func: async ({ category, status }) => {
    // TODO: 실제 localStorage 또는 DB에서 조회
    return JSON.stringify({
      success: true,
      agents: [
        { id: 'agent_1', name: '이메일 분류 봇', category: 'productivity', status: 'active' },
        { id: 'agent_2', name: '코드 리뷰 어시스턴트', category: 'development', status: 'active' },
      ],
      message: '에이전트 목록을 조회했습니다.',
    })
  },
})

/**
 * 새 에이전트 생성
 */
export const createAgentTool = new DynamicStructuredTool({
  name: 'create_agent',
  description: '새로운 커스텀 AI 에이전트를 생성합니다. 자연어 설명으로 에이전트를 정의할 수 있습니다.',
  schema: z.object({
    prompt: z.string().describe('에이전트 설명 (예: "이메일을 자동으로 분류하고 답장 초안을 작성하는 에이전트")'),
    name: z.string().optional().describe('에이전트 이름 (자동 생성됨)'),
    category: z.enum(['productivity', 'marketing', 'sales', 'support', 'development', 'data', 'creative', 'education', 'custom']).optional().describe('카테고리'),
    capabilities: z.array(z.enum([
      'web_search',
      'code_execution',
      'image_generation',
      'file_reader',
      'browser_control',
      'email_send',
      'calendar',
      'database',
    ])).optional().describe('에이전트 기능'),
  }),
  func: async ({ prompt, name, category, capabilities }) => {
    // 에이전트 설정 생성 (실제로는 AI가 프롬프트 분석)
    const agentId = `agent_${Date.now()}`
    const agentConfig = {
      id: agentId,
      name: name || `AI 에이전트 ${agentId.slice(-4)}`,
      description: prompt,
      category: category || 'custom',
      capabilities: capabilities || ['web_search'],
      status: 'draft',
      createdAt: new Date().toISOString(),
    }

    return JSON.stringify({
      success: true,
      agent: agentConfig,
      message: `에이전트 "${agentConfig.name}"이(가) 생성되었습니다.`,
      action: {
        type: 'navigate',
        url: `/agent-builder/${agentId}`,
      },
      nextSteps: [
        '에이전트 설정을 확인하고 조정하세요.',
        '테스트 대화를 진행하세요.',
        '"앱으로 배포"를 클릭하여 활성화하세요.',
      ],
    })
  },
})

/**
 * 에이전트 기능 추가
 */
export const addAgentCapabilityTool = new DynamicStructuredTool({
  name: 'add_agent_capability',
  description: '에이전트에 새로운 기능(도구)을 추가합니다.',
  schema: z.object({
    agentId: z.string().describe('에이전트 ID'),
    capability: z.enum([
      'web_search',       // 웹 검색
      'code_execution',   // 코드 실행
      'image_generation', // 이미지 생성
      'file_reader',      // 파일 읽기
      'browser_control',  // 브라우저 제어
      'email_send',       // 이메일 발송
      'calendar',         // 캘린더
      'database',         // 데이터베이스
    ]).describe('추가할 기능'),
    config: z.record(z.string(), z.any()).optional().describe('기능 설정'),
  }),
  func: async ({ agentId, capability, config }) => {
    const capabilityNames: Record<string, string> = {
      'web_search': '웹 검색',
      'code_execution': '코드 실행',
      'image_generation': '이미지 생성',
      'file_reader': '파일 읽기',
      'browser_control': '브라우저 제어',
      'email_send': '이메일 발송',
      'calendar': '캘린더',
      'database': '데이터베이스',
    }

    return JSON.stringify({
      success: true,
      agentId,
      capability: {
        id: capability,
        name: capabilityNames[capability],
        enabled: true,
        config,
      },
      message: `"${capabilityNames[capability]}" 기능이 에이전트에 추가되었습니다.`,
    })
  },
})

/**
 * 에이전트 시스템 프롬프트 수정
 */
export const updateAgentPromptTool = new DynamicStructuredTool({
  name: 'update_agent_prompt',
  description: '에이전트의 시스템 프롬프트(행동 방식)를 수정합니다.',
  schema: z.object({
    agentId: z.string().describe('에이전트 ID'),
    systemPrompt: z.string().describe('새로운 시스템 프롬프트'),
    personality: z.string().optional().describe('에이전트 성격/말투'),
  }),
  func: async ({ agentId, systemPrompt, personality }) => {
    return JSON.stringify({
      success: true,
      agentId,
      updated: {
        systemPrompt: systemPrompt.slice(0, 100) + '...',
        personality,
      },
      message: '에이전트 프롬프트가 수정되었습니다.',
    })
  },
})

/**
 * 에이전트 배포
 */
export const deployAgentTool = new DynamicStructuredTool({
  name: 'deploy_agent',
  description: '에이전트를 앱으로 배포하여 활성화합니다.',
  schema: z.object({
    agentId: z.string().describe('배포할 에이전트 ID'),
    deployTo: z.enum(['apps', 'api', 'both']).optional().default('apps').describe('배포 대상'),
  }),
  func: async ({ agentId, deployTo }) => {
    return JSON.stringify({
      success: true,
      agentId,
      deployment: {
        target: deployTo,
        status: 'active',
        appUrl: deployTo !== 'api' ? `/dashboard-group/apps/custom-agent/${agentId}` : null,
        apiEndpoint: deployTo !== 'apps' ? `/api/agents/${agentId}/chat` : null,
      },
      message: `에이전트가 ${deployTo === 'both' ? '앱과 API로' : deployTo === 'apps' ? '앱으로' : 'API로'} 배포되었습니다.`,
    })
  },
})

// ============================================
// Export All Builder Tools
// ============================================

export const BUILDER_TOOLS = {
  // Workflow Builder
  list_workflows: listWorkflowsTool,
  create_workflow: createWorkflowTool,
  add_workflow_node: addWorkflowNodeTool,
  execute_workflow: executeWorkflowTool,
  // Agent Builder
  list_agents: listAgentsTool,
  create_agent: createAgentTool,
  add_agent_capability: addAgentCapabilityTool,
  update_agent_prompt: updateAgentPromptTool,
  deploy_agent: deployAgentTool,
}

export function getBuilderTools(): DynamicStructuredTool[] {
  return Object.values(BUILDER_TOOLS)
}
