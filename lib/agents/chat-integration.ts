// Chat Integration for Agent Orchestrator
// 채팅 API와 에이전트 오케스트레이터 연동 + 메모리 시스템 통합

import {
  orchestrateAgents,
  AgentConfig,
  AgentResponse,
  InteractionMode,
  OrchestratorOptions,
} from './orchestrator'
import { AgentMemoryService, getMemoryService } from './memory'
import { LLMProvider } from '@/lib/llm/client'

// =====================================================
// Type Definitions
// =====================================================

export interface RoomContext {
  roomId: string
  roomName?: string
  roomType?: string
  isMeeting?: boolean
  meetingTopic?: string
  projectId?: string
}

export interface EnhancedAgentConfig extends AgentConfig {
  memoryContext?: string  // 메모리에서 로드된 컨텍스트
}

// =====================================================
// Agent Configuration Conversion
// =====================================================

// DB에서 가져온 에이전트를 오케스트레이터 형식으로 변환
export function convertToAgentConfig(dbAgent: any): AgentConfig {
  // 강제: Ollama 로컬 LLM 사용 (OpenAI 비용 문제)
  // 모델을 무조건 qwen2.5:3b로 강제 설정 (DB 값 무시)
  const model = 'qwen2.5:3b'

  return {
    id: dbAgent.id,
    name: dbAgent.name,
    role: dbAgent.description || '에이전트',
    description: dbAgent.description,
    systemPrompt: dbAgent.system_prompt || `당신은 ${dbAgent.name}입니다.`,
    interactionMode: (dbAgent.interaction_mode as InteractionMode) || 'solo',
    llmProvider: 'llama' as LLMProvider,  // 강제: Ollama 로컬 LLM
    llmModel: model,
    temperature: dbAgent.temperature ?? 0.7,
    speakOrder: dbAgent.speak_order ?? 0,
    collaboratesWith: dbAgent.collaborates_with || [],
    supervisorId: dbAgent.supervisor_id || null,
  }
}

// 에이전트들의 상호작용 모드 결정
export function determineInteractionMode(agents: AgentConfig[]): InteractionMode {
  if (agents.length === 1) return 'solo'

  // 감독자가 있는지 확인
  const hasSupervisor = agents.some(a => a.supervisorId !== null)
  if (hasSupervisor) return 'supervisor'

  // 에이전트들의 모드 확인
  const modes = agents.map(a => a.interactionMode)
  const modeCount = new Map<InteractionMode, number>()
  modes.forEach(m => modeCount.set(m, (modeCount.get(m) || 0) + 1))

  // 가장 많은 모드 선택 (기본: sequential - 에이전트들이 서로 응답 보고 이어서 대화)
  let maxMode: InteractionMode = 'sequential'
  let maxCount = 0
  modeCount.forEach((count, mode) => {
    if (count > maxCount && mode !== 'solo') {
      maxCount = count
      maxMode = mode
    }
  })

  return maxMode
}

// =====================================================
// Memory-Enhanced Response Processing
// =====================================================

/**
 * 메모리가 포함된 에이전트 응답 처리
 * - 각 에이전트의 기억을 로드하여 컨텍스트에 추가
 * - 응답 후 대화 내용을 기록
 */
export async function processAgentResponsesWithMemory(
  supabase: any,
  agents: any[],
  userMessage: string,
  roomContext: RoomContext,
  options?: Partial<OrchestratorOptions>
): Promise<AgentResponse[]> {
  console.log('[ChatIntegration] processAgentResponsesWithMemory called with', agents?.length, 'agents')
  if (!agents || agents.length === 0) {
    console.log('[ChatIntegration] No agents provided, returning empty')
    return []
  }

  const memoryService = getMemoryService(supabase)

  // 1. 각 에이전트의 메모리 컨텍스트 로드
  const agentConfigs = await Promise.all(
    agents.map(async (agent) => {
      const baseConfig = convertToAgentConfig(agent)

      try {
        // 메모리 로드
        const memory = await memoryService.loadFullContext(agent.id, {
          roomId: roomContext.roomId,
          projectId: roomContext.projectId,
          query: userMessage,
        })

        // 시스템 프롬프트에 메모리 컨텍스트 추가
        const enhancedSystemPrompt = buildEnhancedSystemPrompt(
          baseConfig.systemPrompt,
          memory.contextSummary,
          memory.identity
        )

        return {
          ...baseConfig,
          systemPrompt: enhancedSystemPrompt,
        }
      } catch (error) {
        console.error(`Failed to load memory for agent ${agent.id}:`, error)
        return baseConfig
      }
    })
  )

  // 2. 상호작용 모드 결정
  const mode = options?.mode || determineInteractionMode(agentConfigs)
  const effectiveMode = roomContext.isMeeting ? 'debate' : mode
  console.log('[ChatIntegration] Mode determined:', effectiveMode, '(isMeeting:', roomContext.isMeeting, ')')

  // 3. 컨텍스트 추가된 사용자 메시지
  let contextualMessage = userMessage
  if (roomContext.isMeeting && roomContext.meetingTopic) {
    contextualMessage = `[미팅 주제: ${roomContext.meetingTopic}]\n\n${userMessage}`
  }

  // 4. 오케스트레이터 실행
  const orchestratorOptions: OrchestratorOptions = {
    mode: effectiveMode,
    rounds: options?.rounds ?? 3,
    supervisorId: options?.supervisorId || agentConfigs.find(a => a.supervisorId === null)?.id,
  }

  try {
    console.log('[ChatIntegration] Calling orchestrateAgents...')
    const responses = await orchestrateAgents(
      agentConfigs,
      contextualMessage,
      orchestratorOptions
    )
    console.log('[ChatIntegration] orchestrateAgents returned', responses?.length, 'responses')

    // 5. 응답 후 각 에이전트의 대화 기록 저장
    await logAgentConversations(
      memoryService,
      agents,
      userMessage,
      responses,
      roomContext
    )

    // 6. 에이전트 간 협업 기록 (멀티 에이전트일 경우)
    if (agents.length > 1) {
      await logAgentCollaboration(
        memoryService,
        agents,
        responses,
        roomContext
      )
    }

    return responses
  } catch (error) {
    console.error('Agent orchestration error:', error)
    throw error
  }
}

/**
 * 기존 processAgentResponses 함수 (하위 호환성 유지)
 */
export async function processAgentResponses(
  agents: any[],
  userMessage: string,
  roomContext: RoomContext,
  options?: Partial<OrchestratorOptions>
): Promise<AgentResponse[]> {
  if (!agents || agents.length === 0) {
    return []
  }

  const agentConfigs = agents.map(convertToAgentConfig)
  const mode = options?.mode || determineInteractionMode(agentConfigs)
  const effectiveMode = roomContext.isMeeting ? 'debate' : mode

  let contextualMessage = userMessage
  if (roomContext.isMeeting && roomContext.meetingTopic) {
    contextualMessage = `[미팅 주제: ${roomContext.meetingTopic}]\n\n${userMessage}`
  }

  const orchestratorOptions: OrchestratorOptions = {
    mode: effectiveMode,
    rounds: options?.rounds ?? 3,
    supervisorId: options?.supervisorId || agentConfigs.find(a => a.supervisorId === null)?.id,
  }

  try {
    return await orchestrateAgents(agentConfigs, contextualMessage, orchestratorOptions)
  } catch (error) {
    console.error('Agent orchestration error:', error)
    throw error
  }
}

// =====================================================
// Memory Logging Functions
// =====================================================

/**
 * 시스템 프롬프트에 메모리 컨텍스트 추가
 */
function buildEnhancedSystemPrompt(
  originalPrompt: string,
  memoryContext: string,
  identity: any | null
): string {
  let enhancedPrompt = originalPrompt

  // 정체성 정보 추가
  if (identity) {
    enhancedPrompt += `\n\n## 나의 정체성
${identity.selfSummary || ''}

나의 핵심 가치: ${(identity.coreValues || []).join(', ')}
나의 강점: ${(identity.strengths || []).join(', ')}
최근 집중 분야: ${identity.recentFocus || '없음'}`
  }

  // 메모리 컨텍스트 추가
  if (memoryContext) {
    enhancedPrompt += `\n\n## 내가 기억하는 것들
${memoryContext}

위 기억을 바탕으로 일관성 있게 응답하세요. 이전에 한 말이나 결정을 기억하고 참조하세요.`
  }

  return enhancedPrompt
}

/**
 * 에이전트 대화 기록 저장
 */
async function logAgentConversations(
  memoryService: AgentMemoryService,
  agents: any[],
  userMessage: string,
  responses: AgentResponse[],
  roomContext: RoomContext
): Promise<void> {
  for (const response of responses) {
    const agent = agents.find(a => a.id === response.agentId)
    if (!agent) continue

    try {
      await memoryService.logConversation(
        response.agentId,
        roomContext.roomId,
        userMessage,
        response.content,
        {
          room_name: roomContext.roomName,
          room_type: roomContext.roomType,
          is_meeting: roomContext.isMeeting,
          meeting_topic: roomContext.meetingTopic,
          project_id: roomContext.projectId,
        }
      )
    } catch (error) {
      console.error(`Failed to log conversation for agent ${response.agentId}:`, error)
    }
  }
}

/**
 * 에이전트 간 협업 기록
 */
async function logAgentCollaboration(
  memoryService: AgentMemoryService,
  agents: any[],
  responses: AgentResponse[],
  roomContext: RoomContext
): Promise<void> {
  // 모든 참여 에이전트 ID
  const agentIds = agents.map(a => a.id)

  // 각 에이전트에 대해 협업 기록
  for (const response of responses) {
    const otherAgentIds = agentIds.filter(id => id !== response.agentId)

    if (otherAgentIds.length > 0) {
      try {
        // 협업 요약 생성
        const otherResponses = responses
          .filter(r => r.agentId !== response.agentId)
          .map(r => `${r.agentName}: ${r.content.slice(0, 100)}...`)
          .join('\n')

        await memoryService.logCollaboration(
          response.agentId,
          otherAgentIds,
          roomContext.meetingTopic || roomContext.roomName || '대화',
          `다른 에이전트들과 함께 대화에 참여:\n${otherResponses}`,
          roomContext.roomId
        )
      } catch (error) {
        console.error(`Failed to log collaboration for agent ${response.agentId}:`, error)
      }
    }
  }
}

// =====================================================
// DB Message Conversion
// =====================================================

// 에이전트 응답을 DB 메시지 형식으로 변환
export function convertToDbMessage(
  response: AgentResponse,
  roomId: string
): any {
  return {
    room_id: roomId,
    sender_type: 'agent',
    sender_agent_id: response.agentId,
    message_type: 'text',
    content: response.content,
    is_ai_response: true,
    metadata: {
      ...response.metadata,
      agent_name: response.agentName,
      timestamp: response.timestamp.toISOString(),
    },
  }
}

// =====================================================
// Agent Fetching Functions
// =====================================================

// 그룹 내 에이전트들 가져오기
export async function getGroupAgents(
  supabase: any,
  groupId: string
): Promise<any[]> {
  const { data: members, error: membersError } = await supabase
    .from('agent_group_members')
    .select(`
      *,
      agent:deployed_agents(*)
    `)
    .eq('group_id', groupId)
    .order('speak_order', { ascending: true })

  if (membersError) {
    console.error('Failed to fetch group members:', membersError)
    return []
  }

  return members?.map((m: any) => ({
    ...m.agent,
    speak_order: m.speak_order,
    role_in_group: m.role,
  })) || []
}

// 채팅방의 모든 에이전트 가져오기
export async function getRoomAgents(
  supabase: any,
  roomId: string
): Promise<any[]> {
  // 채팅방 참여자 중 에이전트 조회
  const { data: participants, error: participantsError } = await supabase
    .from('chat_participants')
    .select('agent_id, participant_type')
    .eq('room_id', roomId)
    .not('agent_id', 'is', null)

  console.log(`[getRoomAgents] Room ${roomId}: participants query result:`, {
    participants,
    error: participantsError?.message
  })

  if (participantsError || !participants?.length) {
    console.log('[getRoomAgents] No agent participants found')
    return []
  }

  const agentIds = participants.map((p: any) => p.agent_id)

  // 에이전트 상세 정보 조회
  const { data: agents, error: agentsError } = await supabase
    .from('deployed_agents')
    .select('*')
    .in('id', agentIds)
    .order('created_at', { ascending: true })

  if (agentsError) {
    console.error('Failed to fetch agents:', agentsError)
    return []
  }

  console.log(`[getRoomAgents] Found ${agents?.length || 0} agents:`, agents?.map((a: any) => a.name))
  return agents || []
}

// =====================================================
// Knowledge Extraction (대화에서 지식 자동 추출)
// =====================================================

/**
 * 대화 후 지식 추출 및 저장
 */
export async function extractKnowledgeFromConversation(
  supabase: any,
  agentId: string,
  userMessage: string,
  agentResponse: string,
  context?: { projectId?: string; teamId?: string }
): Promise<void> {
  const memoryService = getMemoryService(supabase)

  const conversation = `사용자: ${userMessage}\n\n에이전트: ${agentResponse}`

  try {
    await memoryService.extractAndSaveKnowledge(agentId, conversation, context)
  } catch (error) {
    console.error('Knowledge extraction failed:', error)
  }
}

// =====================================================
// Identity Management
// =====================================================

/**
 * 에이전트 생성 시 정체성 초기화
 */
export async function initializeAgentIdentity(
  supabase: any,
  agentId: string,
  agentName: string,
  description: string,
  systemPrompt: string
): Promise<boolean> {
  const memoryService = getMemoryService(supabase)
  return memoryService.initializeIdentity(agentId, agentName, description, systemPrompt)
}

/**
 * 일간 커밋 생성
 */
export async function createAgentDailyCommit(
  supabase: any,
  agentId: string,
  date?: Date
): Promise<any> {
  const memoryService = getMemoryService(supabase)
  return memoryService.createDailyCommit(agentId, date)
}
