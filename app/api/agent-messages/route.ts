export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import type { AgentMessage, DeployedAgent } from '@/types/database'
import { createUnifiedMemory } from '@/lib/memory/unified-agent-memory'

const getOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

// GET: Get messages for a conversation
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversation_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!conversationId) {
      return NextResponse.json({ error: 'conversation_id가 필요합니다' }, { status: 400 })
    }

    // Verify conversation belongs to user
    const { data: conversation } = await (supabase as any)
      .from('agent_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single()

    if (!conversation) {
      return NextResponse.json({ error: '대화를 찾을 수 없습니다' }, { status: 404 })
    }

    const { data, error } = await (supabase as any)
      .from('agent_messages')
      .select(`
        *,
        sender_agent:deployed_agents!sender_agent_id(id, name, avatar_url),
        receiver_agent:deployed_agents!receiver_agent_id(id, name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('메시지 조회 오류:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('메시지 API 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// POST: Send a message (user to agent, or trigger agent to agent)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const {
      conversation_id,
      content,
      receiver_agent_id,
      delegate_to_agent_id,
    } = body

    if (!conversation_id || !content) {
      return NextResponse.json(
        { error: 'conversation_id와 content가 필요합니다' },
        { status: 400 }
      )
    }

    // Verify conversation
    const { data: conversation, error: convError } = await (supabase as any)
      .from('agent_conversations')
      .select('*')
      .eq('id', conversation_id)
      .eq('user_id', user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: '대화를 찾을 수 없습니다' }, { status: 404 })
    }

    // Get the target agent
    const targetAgentId = receiver_agent_id || conversation.agent_ids[0]
    const { data: targetAgent } = await (supabase as any)
      .from('deployed_agents')
      .select('*')
      .eq('id', targetAgentId)
      .single()

    if (!targetAgent) {
      return NextResponse.json({ error: '에이전트를 찾을 수 없습니다' }, { status: 404 })
    }

    // Save user message
    const userMessage = {
      conversation_id,
      sender_type: 'USER',
      sender_user_id: user.id,
      sender_agent_id: null,
      receiver_type: 'AGENT',
      receiver_user_id: null,
      receiver_agent_id: targetAgentId,
      message_type: 'USER_TO_AGENT',
      content,
      metadata: delegate_to_agent_id ? { delegate_to: delegate_to_agent_id } : null,
    }

    const { data: savedUserMessage, error: userMsgError } = await (supabase as any)
      .from('agent_messages')
      .insert(userMessage)
      .select()
      .single()

    if (userMsgError) {
      return NextResponse.json({ error: userMsgError.message }, { status: 500 })
    }

    // Get conversation history for context
    // 🔥 크로스 플랫폼 통합: GlowUS Web + Telegram 모든 대화 기록 로드
    const unifiedMemory = createUnifiedMemory(supabase as any)
    const unifiedHistory = await unifiedMemory.getConversationHistory({
      userId: user.id,
      agentId: targetAgentId,
      limit: 30,
      crossPlatform: true  // Telegram 대화도 포함
    })

    // 통합 메시지를 agent_messages 형식으로 변환
    const history = unifiedHistory.map(msg => ({
      content: msg.content,
      sender_type: msg.role === 'user' ? 'USER' : 'AGENT',
      created_at: msg.createdAt.toISOString(),
      metadata: { source: msg.source, ...msg.metadata }
    }))

    const telegramCount = unifiedHistory.filter(m => m.source === 'telegram').length
    const webCount = unifiedHistory.filter(m => m.source === 'web').length
    console.log(`[Agent Messages] 🔥 UNIFIED: ${history.length} messages (Web: ${webCount}, Telegram: ${telegramCount})`)

    // Generate agent response
    const agentResponse = await generateAgentResponse(
      targetAgent as DeployedAgent,
      content,
      history as AgentMessage[],
      delegate_to_agent_id
    )

    // Save agent response
    const agentMessage = {
      conversation_id,
      sender_type: 'AGENT',
      sender_user_id: null,
      sender_agent_id: targetAgentId,
      receiver_type: 'USER',
      receiver_user_id: user.id,
      receiver_agent_id: null,
      message_type: 'AGENT_TO_USER',
      content: agentResponse.content,
      metadata: agentResponse.metadata,
    }

    const { data: savedAgentMessage, error: agentMsgError } = await (supabase as any)
      .from('agent_messages')
      .insert(agentMessage)
      .select()
      .single()

    if (agentMsgError) {
      return NextResponse.json({ error: agentMsgError.message }, { status: 500 })
    }

    // If delegation was requested, trigger agent-to-agent communication
    if (delegate_to_agent_id && agentResponse.shouldDelegate) {
      await handleAgentDelegation(
        supabase as any,
        conversation_id,
        targetAgentId,
        delegate_to_agent_id,
        agentResponse.delegationMessage || content,
        user.id
      )
    }

    // Update conversation timestamp
    await (supabase as any)
      .from('agent_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation_id)

    return NextResponse.json({
      userMessage: savedUserMessage,
      agentMessage: savedAgentMessage,
    }, { status: 201 })
  } catch (error) {
    console.error('메시지 전송 API 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// Helper: Generate agent response using OpenAI
async function generateAgentResponse(
  agent: DeployedAgent,
  userMessage: string,
  history: AgentMessage[],
  delegateToAgentId?: string
): Promise<{
  content: string
  metadata: Record<string, unknown> | null
  shouldDelegate: boolean
  delegationMessage?: string
}> {
  const systemPrompt = agent.system_prompt || `당신은 ${agent.name}입니다.`

  // Build conversation history
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ]

  for (const msg of history.slice(-10)) {
    const role = msg.sender_type === 'USER' ? 'user' : 'assistant'
    messages.push({ role, content: msg.content })
  }

  messages.push({ role: 'user', content: userMessage })

  // Add delegation context if needed
  if (delegateToAgentId) {
    messages[0].content += `\n\n사용자가 다른 에이전트에게 작업을 위임하라고 요청했습니다. 작업 내용을 정리하여 전달해주세요.`
  }

  try {
    // gpt-4 계열 모델은 접근 불가하므로 gpt-4o-mini로 변경
    let safeModel = agent.model || 'gpt-4o-mini'
    if (safeModel.startsWith('gpt-4') && !safeModel.includes('gpt-4o')) {
      safeModel = 'gpt-4o-mini'
    }
    const completion = await getOpenAI().chat.completions.create({
      model: safeModel,
      messages,
      temperature: agent.temperature || 0.7,
      max_tokens: 1000,
    })

    const content = completion.choices[0]?.message?.content || '응답을 생성할 수 없습니다.'

    // Check if response indicates delegation
    const shouldDelegate = delegateToAgentId && (
      content.includes('전달하겠습니다') ||
      content.includes('위임하겠습니다') ||
      content.includes('요청하겠습니다')
    )

    return {
      content,
      metadata: {
        model: agent.model,
        tokens: completion.usage?.total_tokens,
      },
      shouldDelegate: !!shouldDelegate,
      delegationMessage: shouldDelegate ? extractDelegationMessage(content) : undefined,
    }
  } catch (error) {
    console.error('AI 응답 생성 오류:', error)
    return {
      content: '죄송합니다. 응답을 생성하는 중 오류가 발생했습니다.',
      metadata: { error: true },
      shouldDelegate: false,
    }
  }
}

// Helper: Extract delegation message from agent response
function extractDelegationMessage(content: string): string {
  const lines = content.split('\n')
  const delegationLine = lines.find(line =>
    line.includes('작업') || line.includes('요청') || line.includes('부탁')
  )
  return delegationLine || content
}

// Helper: Handle agent-to-agent delegation
async function handleAgentDelegation(
  supabase: any,
  conversationId: string,
  fromAgentId: string,
  toAgentId: string,
  message: string,
  userId: string
) {
  // Get both agents
  const { data: agents } = await supabase
    .from('deployed_agents')
    .select('*')
    .in('id', [fromAgentId, toAgentId])

  if (!agents || agents.length !== 2) return

  const fromAgent = agents.find((a: any) => a.id === fromAgentId) as DeployedAgent
  const toAgent = agents.find((a: any) => a.id === toAgentId) as DeployedAgent

  // Save agent-to-agent message
  const agentToAgentMessage = {
    conversation_id: conversationId,
    sender_type: 'AGENT',
    sender_user_id: null,
    sender_agent_id: fromAgentId,
    receiver_type: 'AGENT',
    receiver_user_id: null,
    receiver_agent_id: toAgentId,
    message_type: 'AGENT_TO_AGENT',
    content: `[${fromAgent.name}이(가) ${toAgent.name}에게]: ${message}`,
    metadata: { delegation: true, original_sender: userId },
  }

  await supabase.from('agent_messages').insert(agentToAgentMessage)

  // Generate receiving agent's response
  const response = await generateAgentResponse(
    toAgent,
    message,
    [],
    undefined
  )

  // Save receiving agent's response back to sending agent
  const responseMessage = {
    conversation_id: conversationId,
    sender_type: 'AGENT',
    sender_user_id: null,
    sender_agent_id: toAgentId,
    receiver_type: 'AGENT',
    receiver_user_id: null,
    receiver_agent_id: fromAgentId,
    message_type: 'AGENT_TO_AGENT',
    content: `[${toAgent.name}이(가) ${fromAgent.name}에게]: ${response.content}`,
    metadata: { delegation_response: true },
  }

  await supabase.from('agent_messages').insert(responseMessage)

  // Notify user about the delegation result
  const userNotification = {
    conversation_id: conversationId,
    sender_type: 'AGENT',
    sender_user_id: null,
    sender_agent_id: toAgentId,
    receiver_type: 'USER',
    receiver_user_id: userId,
    receiver_agent_id: null,
    message_type: 'AGENT_TO_USER',
    content: `[${fromAgent.name}의 요청을 처리했습니다]\n\n${response.content}`,
    metadata: { delegation_complete: true, delegated_from: fromAgentId },
  }

  await supabase.from('agent_messages').insert(userNotification)
}
