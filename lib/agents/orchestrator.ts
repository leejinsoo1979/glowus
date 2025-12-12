// Agent Orchestrator - 멀티 에이전트 상호작용 시스템
import { Annotation } from '@langchain/langgraph'
import { BaseMessage, AIMessage } from '@langchain/core/messages'
import { chat, LLMProvider, LLMConfig } from '@/lib/llm/client'

// ============================================
// Types
// ============================================

export type InteractionMode =
  | 'solo'        // 단독 응답
  | 'sequential'  // 순차 (A → B → C)
  | 'debate'      // 토론 (서로 반박)
  | 'collaborate' // 협업 (역할 분담)
  | 'supervisor'  // 감독자가 조율

export interface AgentConfig {
  id: string
  name: string
  role: string
  description?: string
  systemPrompt: string
  interactionMode: InteractionMode
  llmProvider: LLMProvider
  llmModel: string
  temperature?: number
  speakOrder?: number
  collaboratesWith?: string[]
  supervisorId?: string | null
}

export interface AgentResponse {
  agentId: string
  agentName: string
  content: string
  timestamp: Date
  metadata?: Record<string, any>
}

// ============================================
// State Definition
// ============================================

const ConversationState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  userMessage: Annotation<string>({
    reducer: (_, update) => update,
    default: () => '',
  }),
  responses: Annotation<AgentResponse[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  currentAgentIndex: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0,
  }),
  round: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0,
  }),
  maxRounds: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 3,
  }),
  mode: Annotation<InteractionMode>({
    reducer: (_, update) => update,
    default: () => 'solo',
  }),
  completed: Annotation<boolean>({
    reducer: (_, update) => update,
    default: () => false,
  }),
})

type ConversationStateType = typeof ConversationState.State

// ============================================
// Agent Node Factory
// ============================================

function createAgentNode(agent: AgentConfig) {
  return async (state: ConversationStateType): Promise<Partial<ConversationStateType>> => {
    const { userMessage, responses, round, mode } = state

    // 시스템 프롬프트 구성
    let systemPrompt = agent.systemPrompt

    // 모드별 컨텍스트 추가
    if (mode === 'debate' && responses.length > 0) {
      const recentResponses = responses.slice(-3).map(r =>
        `[${r.agentName}]: ${r.content}`
      ).join('\n\n')
      systemPrompt += `\n\n이전 토론 내용:\n${recentResponses}\n\n위 의견에 대해 반론하거나 동의하며 자신의 관점을 명확히 하세요.`
    } else if (mode === 'collaborate' && responses.length > 0) {
      const teamAnalysis = responses.map(r =>
        `[${r.agentName}]: ${r.content}`
      ).join('\n\n')
      systemPrompt += `\n\n팀원들의 분석:\n${teamAnalysis}\n\n위 내용을 참고하여 당신의 역할(${agent.role})에 맞는 관점을 추가하세요.`
    } else if (mode === 'sequential' && responses.length > 0) {
      const previousResponse = responses[responses.length - 1]
      systemPrompt += `\n\n이전 담당자(${previousResponse.agentName})의 의견:\n${previousResponse.content}\n\n위 내용을 바탕으로 당신의 의견을 추가하세요.`
    }

    // LLM 호출
    const llmConfig: LLMConfig = {
      provider: agent.llmProvider,
      model: agent.llmModel,
      temperature: agent.temperature ?? 0.7,
    }

    try {
      const response = await chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        llmConfig
      )

      const content = response.choices[0]?.message?.content || ''

      const agentResponse: AgentResponse = {
        agentId: agent.id,
        agentName: agent.name,
        content,
        timestamp: new Date(),
        metadata: {
          provider: agent.llmProvider,
          model: agent.llmModel,
          round,
          mode,
        },
      }

      return {
        responses: [agentResponse],
        messages: [new AIMessage({ content, name: agent.name })],
      }
    } catch (error: any) {
      console.error(`[Orchestrator] Agent ${agent.name} error:`)
      console.error('  Provider:', agent.llmProvider)
      console.error('  Model:', agent.llmModel)
      console.error('  Error:', error?.message || error)
      console.error('  Stack:', error?.stack)

      // Fallback 응답
      const fallbackResponse: AgentResponse = {
        agentId: agent.id,
        agentName: agent.name,
        content: `죄송합니다. 일시적인 오류가 발생했습니다.`,
        timestamp: new Date(),
        metadata: { error: true, errorMessage: error?.message },
      }

      return {
        responses: [fallbackResponse],
      }
    }
  }
}

// ============================================
// Orchestrator Classes
// ============================================

// Solo Mode: 각 에이전트가 독립적으로 응답
export async function runSoloMode(
  agents: AgentConfig[],
  userMessage: string
): Promise<AgentResponse[]> {
  const responses: AgentResponse[] = []

  // 병렬 실행
  const promises = agents.map(async (agent) => {
    const node = createAgentNode(agent)
    const result = await node({
      messages: [],
      userMessage,
      responses: [],
      currentAgentIndex: 0,
      round: 0,
      maxRounds: 1,
      mode: 'solo',
      completed: false,
    })
    return result.responses?.[0]
  })

  const results = await Promise.all(promises)
  return results.filter((r): r is AgentResponse => r !== undefined)
}

// Sequential Mode: 순차적으로 응답 (이전 응답 참조)
export async function runSequentialMode(
  agents: AgentConfig[],
  userMessage: string
): Promise<AgentResponse[]> {
  console.log('[Orchestrator] Sequential mode starting with', agents.length, 'agents')
  const sortedAgents = [...agents].sort((a, b) =>
    (a.speakOrder ?? 0) - (b.speakOrder ?? 0)
  )

  const responses: AgentResponse[] = []

  for (const agent of sortedAgents) {
    console.log(`[Orchestrator] Processing agent: ${agent.name}`)
    const node = createAgentNode(agent)
    const result = await node({
      messages: [],
      userMessage,
      responses,
      currentAgentIndex: 0,
      round: 0,
      maxRounds: 1,
      mode: 'sequential',
      completed: false,
    })

    if (result.responses?.[0]) {
      console.log(`[Orchestrator] Agent ${agent.name} responded:`, result.responses[0].content.slice(0, 50))
      responses.push(result.responses[0])
    }
  }

  console.log('[Orchestrator] Sequential mode completed with', responses.length, 'responses')
  return responses
}

// Debate Mode: 여러 라운드에 걸쳐 토론
export async function runDebateMode(
  agents: AgentConfig[],
  userMessage: string,
  rounds: number = 3
): Promise<AgentResponse[]> {
  const responses: AgentResponse[] = []

  for (let round = 0; round < rounds; round++) {
    for (const agent of agents) {
      const node = createAgentNode(agent)
      const result = await node({
        messages: [],
        userMessage: round === 0
          ? userMessage
          : `주제: ${userMessage}\n\n이전 토론 내용을 참고하여 의견을 제시하세요.`,
        responses,
        currentAgentIndex: 0,
        round,
        maxRounds: rounds,
        mode: 'debate',
        completed: false,
      })

      if (result.responses?.[0]) {
        responses.push(result.responses[0])
      }
    }
  }

  return responses
}

// Collaborate Mode: 역할 분담 협업
export async function runCollaborateMode(
  agents: AgentConfig[],
  userMessage: string
): Promise<AgentResponse[]> {
  const responses: AgentResponse[] = []

  // 1단계: 각자 역할에 맞게 분석 (병렬)
  const analysisPromises = agents.map(async (agent) => {
    const node = createAgentNode(agent)
    const result = await node({
      messages: [],
      userMessage: `[역할: ${agent.role}]\n\n${userMessage}\n\n당신의 역할에 맞게 분석하고 의견을 제시하세요.`,
      responses: [],
      currentAgentIndex: 0,
      round: 0,
      maxRounds: 2,
      mode: 'collaborate',
      completed: false,
    })
    return result.responses?.[0]
  })

  const analyses = await Promise.all(analysisPromises)
  responses.push(...analyses.filter((r): r is AgentResponse => r !== undefined))

  // 2단계: 종합 (첫 번째 에이전트가 종합)
  const summarizer = agents[0]
  const summaryNode = createAgentNode({
    ...summarizer,
    systemPrompt: `${summarizer.systemPrompt}\n\n당신은 팀 리더로서 팀원들의 분석을 종합하여 최종 결론을 도출해야 합니다.`,
  })

  const summaryResult = await summaryNode({
    messages: [],
    userMessage: `다음 팀원들의 분석을 종합하여 최종 결론을 작성하세요:\n\n${
      responses.map(r => `[${r.agentName}]: ${r.content}`).join('\n\n')
    }`,
    responses,
    currentAgentIndex: 0,
    round: 1,
    maxRounds: 2,
    mode: 'collaborate',
    completed: false,
  })

  if (summaryResult.responses?.[0]) {
    const summaryResponse = {
      ...summaryResult.responses[0],
      agentName: `${summarizer.name} (종합)`,
    }
    responses.push(summaryResponse)
  }

  return responses
}

// Supervisor Mode: 감독자가 에이전트들을 조율
export async function runSupervisorMode(
  agents: AgentConfig[],
  supervisor: AgentConfig,
  userMessage: string
): Promise<AgentResponse[]> {
  const responses: AgentResponse[] = []

  // 1단계: 감독자가 작업 분배 결정
  const supervisorNode = createAgentNode({
    ...supervisor,
    systemPrompt: `${supervisor.systemPrompt}

당신은 팀 감독자입니다. 다음 팀원들이 있습니다:
${agents.map(a => `- ${a.name}: ${a.role}`).join('\n')}

사용자 요청을 분석하고, 각 팀원에게 어떤 작업을 맡길지 결정하세요.
응답 형식:
[작업 분배]
- {팀원이름}: {맡길 작업}
...

[추가 지시사항]
{팀원들에게 전달할 공통 지시사항}`,
  })

  const planResult = await supervisorNode({
    messages: [],
    userMessage,
    responses: [],
    currentAgentIndex: 0,
    round: 0,
    maxRounds: 3,
    mode: 'supervisor',
    completed: false,
  })

  if (planResult.responses?.[0]) {
    responses.push({
      ...planResult.responses[0],
      agentName: `${supervisor.name} (계획)`,
    })
  }

  // 2단계: 각 에이전트가 작업 수행
  const taskPromises = agents.map(async (agent) => {
    const node = createAgentNode(agent)
    const result = await node({
      messages: [],
      userMessage: `감독자 지시:\n${planResult.responses?.[0]?.content || ''}\n\n원래 요청:\n${userMessage}\n\n당신의 역할(${agent.role})에 맞게 작업을 수행하세요.`,
      responses: [],
      currentAgentIndex: 0,
      round: 1,
      maxRounds: 3,
      mode: 'supervisor',
      completed: false,
    })
    return result.responses?.[0]
  })

  const taskResults = await Promise.all(taskPromises)
  responses.push(...taskResults.filter((r): r is AgentResponse => r !== undefined))

  // 3단계: 감독자가 결과 검토 및 종합
  const reviewNode = createAgentNode({
    ...supervisor,
    systemPrompt: `${supervisor.systemPrompt}

당신은 팀 감독자입니다. 팀원들의 작업 결과를 검토하고 최종 결론을 도출하세요.`,
  })

  const reviewResult = await reviewNode({
    messages: [],
    userMessage: `팀원들의 작업 결과:\n\n${
      responses.slice(1).map(r => `[${r.agentName}]:\n${r.content}`).join('\n\n---\n\n')
    }\n\n위 결과를 검토하고 최종 결론을 작성하세요.`,
    responses,
    currentAgentIndex: 0,
    round: 2,
    maxRounds: 3,
    mode: 'supervisor',
    completed: false,
  })

  if (reviewResult.responses?.[0]) {
    responses.push({
      ...reviewResult.responses[0],
      agentName: `${supervisor.name} (최종 검토)`,
    })
  }

  return responses
}

// ============================================
// Main Orchestrator
// ============================================

export interface OrchestratorOptions {
  mode?: InteractionMode
  rounds?: number // debate 모드에서 사용
  supervisorId?: string // supervisor 모드에서 사용
}

export async function orchestrateAgents(
  agents: AgentConfig[],
  userMessage: string,
  options: OrchestratorOptions = {}
): Promise<AgentResponse[]> {
  const { mode = 'solo', rounds = 3, supervisorId } = options

  // 모드 결정: 옵션 > 에이전트 설정
  const effectiveMode = mode || agents[0]?.interactionMode || 'solo'
  console.log(`[Orchestrator] orchestrateAgents called - mode: ${effectiveMode}, agents: ${agents.length}`)

  switch (effectiveMode) {
    case 'solo':
      return runSoloMode(agents, userMessage)

    case 'sequential':
      return runSequentialMode(agents, userMessage)

    case 'debate':
      return runDebateMode(agents, userMessage, rounds)

    case 'collaborate':
      return runCollaborateMode(agents, userMessage)

    case 'supervisor': {
      const supervisor = supervisorId
        ? agents.find(a => a.id === supervisorId)
        : agents[0]

      if (!supervisor) {
        throw new Error('Supervisor not found')
      }

      const workers = agents.filter(a => a.id !== supervisor.id)
      return runSupervisorMode(workers, supervisor, userMessage)
    }

    default:
      return runSoloMode(agents, userMessage)
  }
}

// ============================================
// LangGraph Workflow Builder (향후 확장용)
// ============================================

// 참고: 복잡한 워크플로우가 필요할 때 LangGraph StateGraph를 사용하여
// 더 정교한 에이전트 간 상호작용을 구현할 수 있습니다.
// 현재는 위의 orchestrateAgents 함수로 대부분의 유스케이스를 커버합니다.
