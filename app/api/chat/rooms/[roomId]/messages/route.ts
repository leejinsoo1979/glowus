import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SendMessageRequest } from '@/types/chat'
import { generateAgentChatResponse, generateAgentMeetingResponse } from '@/lib/langchain/agent-chat'
import {
  processAgentResponsesWithMemory,
  convertToDbMessage,
  getRoomAgents,
  extractKnowledgeFromConversation,
} from '@/lib/agents/chat-integration'
import { getMemoryService } from '@/lib/agents/memory'
import { getDevUserIfEnabled } from '@/lib/dev-user'
import { parseFileFromUrl, formatFilesForContext, ParsedFileContent } from '@/lib/utils/file-parser'
import { getLLMConfigForAgent } from '@/lib/llm/user-keys'

// GET: 메시지 목록 조회 (페이지네이션)
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const supabase = createClient()
    const adminClient = createAdminClient()

    // DEV 바이패스 체크
    const devUser = getDevUserIfEnabled()
    let user: any = null

    if (devUser) {
      user = devUser
    } else {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = authUser
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const before = searchParams.get('before') // cursor for pagination

    // 참여자인지 확인
    const { data: participant } = await (adminClient as any)
      .from('chat_participants')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .single()

    if (!participant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 메시지 조회
    let query = (adminClient as any)
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data: messages, error } = await query

    if (error) {
      console.error('Failed to fetch messages:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // sender 정보 수집 및 조회
    const userIds = new Set<string>()
    const agentIds = new Set<string>()

    for (const msg of (messages as any[]) || []) {
      if (msg.sender_user_id) userIds.add(msg.sender_user_id)
      if (msg.sender_agent_id) agentIds.add(msg.sender_agent_id)
    }

    let usersMap: Record<string, any> = {}
    let agentsMap: Record<string, any> = {}

    if (userIds.size > 0) {
      const { data: users } = await (adminClient as any)
        .from('users')
        .select('id, name, avatar_url')
        .in('id', Array.from(userIds))

      for (const u of users || []) {
        usersMap[u.id] = u
      }
    }

    if (agentIds.size > 0) {
      const { data: agents } = await (adminClient as any)
        .from('deployed_agents')
        .select('id, name')
        .in('id', Array.from(agentIds))

      for (const a of agents || []) {
        agentsMap[a.id] = a
      }
    }

    // 메시지에 sender 정보 추가
    const messagesWithSenders = ((messages as any[]) || []).map((msg: any) => ({
      ...msg,
      sender_user: msg.sender_user_id ? usersMap[msg.sender_user_id] : null,
      sender_agent: msg.sender_agent_id ? agentsMap[msg.sender_agent_id] : null,
    }))

    // 읽음 처리 - last_read_at 업데이트
    await (adminClient as any)
      .from('chat_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', user.id)

    // 역순으로 정렬하여 반환 (오래된 순)
    return NextResponse.json(messagesWithSenders?.reverse() || [])
  } catch (error) {
    console.error('Messages fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 메시지 전송
export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  console.log('[Messages API] POST 요청 시작')
  try {
    const supabase = createClient()
    const adminClient = createAdminClient()

    // DEV 바이패스 체크
    const devUser = getDevUserIfEnabled()
    let user: any = null

    if (devUser) {
      console.log('[Messages API] DEV 바이패스 활성화:', devUser.id)
      user = devUser
    } else {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      console.log('[Messages API] 인증 결과:', authUser?.id, authError?.message)
      if (authError || !authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = authUser
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = params
    console.log('[Messages API] roomId:', roomId)
    const body: SendMessageRequest = await request.json()
    const { content, message_type = 'text', metadata = {}, reply_to_id } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // 참여자인지 확인
    const { data: participant } = await (adminClient as any)
      .from('chat_participants')
      .select('id, participant_type')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .single()

    if (!participant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 메시지 생성 (시스템 메시지도 sender_type은 'user'로, message_type으로 구분)
    const { data: message, error } = await (adminClient as any)
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_type: 'user',
        sender_user_id: user.id,
        message_type,
        content: content.trim(),
        metadata,
        reply_to_id,
        is_ai_response: false,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Failed to send message:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 시스템 메시지는 에이전트 응답 트리거하지 않음
    if (message_type === 'system') {
      console.log('[Messages API] System message, skipping agent response')
      return NextResponse.json(message, { status: 201 })
    }

    // AI 에이전트가 있는 방이면 자동 응답 트리거 (adminClient로 RLS 우회)
    console.log('[Messages API] 메시지 저장 완료, 에이전트 응답 트리거 시작')
    await triggerAgentResponse(adminClient, roomId, message, user.id)
    console.log('[Messages API] 에이전트 응답 트리거 완료')

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('Send message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 채팅방의 최근 파일 메시지를 조회하고 파싱
async function fetchAndParseRoomFiles(
  supabase: any,
  roomId: string,
  limit: number = 5
): Promise<{ fileContext: string; parsedFiles: ParsedFileContent[] }> {
  try {
    // 최근 파일/이미지 메시지 조회
    const { data: fileMessages, error } = await supabase
      .from('chat_messages')
      .select('id, message_type, content, metadata, created_at')
      .eq('room_id', roomId)
      .in('message_type', ['file', 'image'])
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !fileMessages?.length) {
      return { fileContext: '', parsedFiles: [] }
    }

    console.log(`[FileParser] Found ${fileMessages.length} file messages in room`)

    const parsedFiles: ParsedFileContent[] = []

    for (const msg of fileMessages) {
      const { url, fileName, fileType } = msg.metadata || {}
      if (url && fileName && fileType) {
        try {
          const parsed = await parseFileFromUrl(url, fileName, fileType)
          if (parsed.success) {
            parsedFiles.push(parsed)
            console.log(`[FileParser] Parsed: ${fileName} (${parsed.summary})`)
          }
        } catch (err) {
          console.error(`[FileParser] Failed to parse ${fileName}:`, err)
        }
      }
    }

    const fileContext = formatFilesForContext(parsedFiles)
    return { fileContext, parsedFiles }
  } catch (error) {
    console.error('[FileParser] Error fetching room files:', error)
    return { fileContext: '', parsedFiles: [] }
  }
}

// AI 에이전트 자동 응답 트리거 (오케스트레이터 사용)
async function triggerAgentResponse(
  supabase: any,
  roomId: string,
  userMessage: any,
  userId?: string
) {
  try {
    // 방에 참여한 에이전트 조회
    let agents = await getRoomAgents(supabase, roomId)
    console.log(`[Agent Response] Room ${roomId}: Found ${agents?.length || 0} agents`)
    if (!agents || agents.length === 0) {
      console.log('[Agent Response] No agents found in room')
      return
    }

    // 특정 에이전트 멘션 확인 (metadata.target_agent_name)
    const targetAgentName = userMessage.metadata?.target_agent_name
    if (targetAgentName) {
      console.log(`[Agent Response] Target agent mentioned: ${targetAgentName}`)
      // 멘션된 에이전트만 필터링 (부분 일치, 대소문자 무시)
      const targetAgent = agents.find(
        (a: any) => a.name.toLowerCase().includes(targetAgentName.toLowerCase()) ||
                    targetAgentName.toLowerCase().includes(a.name.toLowerCase())
      )
      if (targetAgent) {
        agents = [targetAgent]
        console.log(`[Agent Response] Filtered to target agent: ${targetAgent.name}`)
      } else {
        console.log(`[Agent Response] Target agent "${targetAgentName}" not found in room, available: ${agents.map((a: any) => a.name).join(', ')}`)
        return  // 멘션된 에이전트가 없으면 응답하지 않음
      }
    }

    // 채팅방 정보 조회 (진행자 포함)
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('name, type, is_meeting_active, meeting_topic, meeting_facilitator_id')
      .eq('id', roomId)
      .single()

    console.log(`[triggerAgentResponse] Room data:`, {
      name: room?.name,
      is_meeting_active: room?.is_meeting_active,
      meeting_facilitator_id: room?.meeting_facilitator_id,
      error: roomError?.message
    })

    // 채팅방의 최근 파일 조회 및 파싱
    const { fileContext, parsedFiles } = await fetchAndParseRoomFiles(supabase, roomId)
    if (parsedFiles.length > 0) {
      console.log(`[Agent Response] Found ${parsedFiles.length} files to include in context`)
    }

    // 파일 컨텍스트가 있으면 메시지에 추가
    const messageWithFiles = {
      ...userMessage,
      content: userMessage.content + fileContext,
      fileContext: fileContext,
      parsedFiles: parsedFiles,
    }

    // 에이전트가 1개면 기존 방식 (빠른 응답), 여러 개면 오케스트레이터
    if (agents.length === 1) {
      // 기존 단일 에이전트 방식
      generateAgentResponseHandler(supabase, roomId, agents[0], messageWithFiles, userId).catch((err) =>
        console.error(`Agent ${agents[0].id} response error:`, err)
      )
    } else {
      // 멀티 에이전트 오케스트레이터
      triggerMultiAgentResponse(supabase, roomId, agents, messageWithFiles, room, userId).catch((err) =>
        console.error('Multi-agent response error:', err)
      )
    }
  } catch (error) {
    console.error('Trigger agent response error:', error)
  }
}

// 멀티 에이전트 응답 처리 (메모리 시스템 통합)
async function triggerMultiAgentResponse(
  supabase: any,
  roomId: string,
  agents: any[],
  userMessage: any,
  room: any,
  userId?: string
) {
  console.log(`[Multi-Agent] Starting response for ${agents.length} agents:`, agents.map((a: any) => a.name))
  try {
    // 모든 에이전트 타이핑 상태 활성화
    for (const agent of agents) {
      await supabase
        .from('chat_participants')
        .update({ is_typing: true })
        .eq('room_id', roomId)
        .eq('agent_id', agent.id)
    }
    console.log('[Multi-Agent] Typing status set to true for all agents')

    // 🔥 최근 이미지 메시지에서 이미지 URL 추출
    const { data: recentImageMessages } = await supabase
      .from('chat_messages')
      .select('metadata')
      .eq('room_id', roomId)
      .eq('message_type', 'image')
      .order('created_at', { ascending: false })
      .limit(4)

    const imageUrls: string[] = []
    if (recentImageMessages) {
      for (const msg of recentImageMessages) {
        const url = msg.metadata?.url || msg.metadata?.imageUrl
        if (url && typeof url === 'string') {
          imageUrls.push(url)
        }
      }
    }
    console.log(`[Multi-Agent] Found ${imageUrls.length} recent images`)

    // 메모리가 포함된 오케스트레이터 실행
    // - 각 에이전트의 기억을 로드하여 컨텍스트에 추가
    // - 응답 후 대화 내용 자동 기록
    // - 에이전트 간 협업 기록
    // 릴레이 방식: 각 에이전트가 순차적으로 응답하고 바로 저장
    console.log('[Multi-Agent] Starting relay-style responses...')
    await processAgentResponsesRelay(
      supabase,
      agents,
      userMessage.content,
      {
        roomId,
        roomName: room?.name,
        roomType: room?.type,
        isMeeting: room?.is_meeting_active,
        meetingTopic: room?.meeting_topic,
        facilitatorId: room?.meeting_facilitator_id, // 진행자 ID
      },
      imageUrls, // 🔥 이미지 전달
      userId // 🔥 사용자 ID (API 키 조회용)
    )
    console.log('[Multi-Agent] Relay responses completed')
  } catch (error) {
    console.error('Multi-agent orchestration error:', error)

    // 에러 메시지 저장
    await supabase.from('chat_messages').insert({
      room_id: roomId,
      sender_type: 'agent',
      sender_agent_id: agents[0]?.id,
      message_type: 'text',
      content: '죄송합니다. 멀티 에이전트 처리 중 오류가 발생했습니다.',
      is_ai_response: true,
      metadata: { error: true },
    })
  } finally {
    // 모든 에이전트 타이핑 상태 해제
    for (const agent of agents) {
      await supabase
        .from('chat_participants')
        .update({ is_typing: false })
        .eq('room_id', roomId)
        .eq('agent_id', agent.id)
    }
  }
}

// 응답에서 에이전트 이름 접두어 제거
function cleanAgentResponse(response: string, agents: any[]): string {
  let cleaned = response
  const allAgentNames = agents.map(a => a.name.trim())

  for (let i = 0; i < 3; i++) {
    for (const name of allAgentNames) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const patterns = [
        new RegExp(`^\\s*${escapedName}\\s*:\\s*`, 'gi'),
        new RegExp(`^\\s*\\[${escapedName}\\]\\s*:\\s*`, 'gi'),
        new RegExp(`^\\s*${escapedName}님\\s*:\\s*`, 'gi'),
      ]
      for (const pattern of patterns) {
        cleaned = cleaned.replace(pattern, '')
      }
    }
    cleaned = cleaned.replace(/^\s*[가-힣a-zA-Z]{2,15}\s*:\s*/g, '')
  }

  return cleaned.trim()
}

// AI 에이전트 응답 생성 (메모리 시스템 통합)
// 릴레이 방식 멀티 에이전트 응답 (순차 실행, 즉시 저장)
async function processAgentResponsesRelay(
  supabase: any,
  agents: any[],
  userContent: string,
  roomContext: { roomId: string; roomName?: string; roomType?: string; isMeeting?: boolean; meetingTopic?: string; facilitatorId?: string },
  images: string[] = [], // 🔥 이미지 파라미터 추가
  userId?: string // 🔥 사용자 ID (API 키 조회용)
) {
  const { roomId, facilitatorId } = roomContext

  // 중복 에이전트 제거 (ID 기준)
  const uniqueAgents = agents.filter((agent, index, self) =>
    index === self.findIndex(a => a.id === agent.id)
  )

  // 에이전트가 1명이면 릴레이 불가 - 단일 응답만
  if (uniqueAgents.length <= 1) {
    console.log('[Relay] Only one agent, skipping relay mode')
    if (uniqueAgents.length === 1) {
      const agent = uniqueAgents[0]
      await supabase.from('chat_participants').update({ is_typing: true }).eq('room_id', roomId).eq('agent_id', agent.id)
      try {
        const response = await generateSingleAgentResponse(supabase, agent, userContent, roomContext, images, userId) // 🔥 이미지 전달
        if (response) {
          await supabase.from('chat_messages').insert({
            room_id: roomId,
            sender_type: 'agent',
            sender_agent_id: agent.id,
            message_type: 'text',
            content: response,
            is_ai_response: true,
            metadata: { agent_name: agent.name },
          })
        }
      } finally {
        await supabase.from('chat_participants').update({ is_typing: false }).eq('room_id', roomId).eq('agent_id', agent.id)
      }
    }
    return
  }

  console.log(`[Relay] Starting conversation with ${uniqueAgents.length} agents:`, uniqueAgents.map((a: any) => a.name))

  // 진행자 중심 회의 흐름인지 확인 (먼저 정의)
  const hasFacilitator = !!facilitatorId
  const facilitatorAgent = hasFacilitator ? uniqueAgents.find(a => a.id === facilitatorId) : null
  const nonFacilitatorAgents = hasFacilitator ? uniqueAgents.filter(a => a.id !== facilitatorId) : uniqueAgents

  console.log(`[Relay] Facilitator mode: ${hasFacilitator}, Facilitator: ${facilitatorAgent?.name || 'None'}`)

  // 🔥 DB에서 이전 대화 기록 로드 (초기화 방지)
  const { data: previousMessages } = await supabase
    .from('chat_messages')
    .select('sender_type, sender_agent_id, content, metadata')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(20)  // 최근 20개 메시지

  // 이전 대화를 conversationHistory에 추가
  const conversationHistory: { role: 'user' | 'agent'; name: string; agentId?: string; content: string }[] = []

  if (previousMessages && previousMessages.length > 0) {
    for (const msg of previousMessages) {
      if (msg.sender_type === 'user') {
        conversationHistory.push({
          role: 'user',
          name: '사용자',
          content: msg.content
        })
      } else if (msg.sender_type === 'agent' && msg.sender_agent_id) {
        const agent = uniqueAgents.find(a => a.id === msg.sender_agent_id)
        conversationHistory.push({
          role: 'agent',
          name: msg.metadata?.agent_name || agent?.name || '에이전트',
          agentId: msg.sender_agent_id,
          content: msg.content
        })
      }
    }
    console.log(`[Relay] Loaded ${conversationHistory.length} previous messages from DB`)
  }

  // 현재 사용자 메시지 추가
  conversationHistory.push({ role: 'user', name: '사용자', content: userContent })

  // 🔥 이전 대화가 있으면 시작 라운드 계산 (인사/스몰토크 스킵)
  // 에이전트 응답이 1개라도 있으면 → 무조건 토론 단계(round 3)부터 시작
  const previousAgentMessages = conversationHistory.filter(h => h.role === 'agent').length
  const startingRound = previousAgentMessages > 0 ? 3 : 0  // 이미 대화중이면 토론 단계로 바로 진입

  console.log(`[Relay] Previous messages: ${previousAgentMessages}, Starting from round: ${startingRound}`)

  // 연속 대화 설정
  // - 진행자 모드: 회의 종료 시간까지 계속 (최대 20라운드)
  // - 일반 모드: 최대 5라운드, 3분
  // - 사용자가 새 메시지를 보내면 중단
  const maxRounds = hasFacilitator ? 20 : 5  // 진행자 있으면 더 많은 라운드
  const maxTimeMs = hasFacilitator ? 600000 : 180000 // 진행자: 10분, 일반: 3분
  const startTime = Date.now()
  let totalMessages = 0
  const maxTotalMessages = uniqueAgents.length * maxRounds

  // 원본 사용자 메시지 시간 기록 (이 시간 이후 새 메시지가 있으면 중단)
  const originalMessageTime = new Date().toISOString()

  // 각 에이전트가 몇 번 발언했는지 추적
  const agentSpeakCount: Record<string, number> = {}
  uniqueAgents.forEach(a => { agentSpeakCount[a.id] = 0 })

  for (let round = startingRound; round < maxRounds && totalMessages < maxTotalMessages; round++) {
    // 시간 제한 체크
    if (Date.now() - startTime > maxTimeMs) {
      console.log(`[Relay] Time limit reached (${maxTimeMs}ms), ending conversation`)
      break
    }

    // 회의 상태 체크 (매 라운드마다)
    const { data: currentRoom } = await supabase
      .from('chat_rooms')
      .select('is_meeting_active, meeting_end_time')
      .eq('id', roomId)
      .single()

    // 회의가 종료되었으면 대화 중단
    if (currentRoom && !currentRoom.is_meeting_active) {
      console.log(`[Relay] Meeting ended, stopping conversation`)
      break
    }

    // 회의 종료 시간이 지났으면 대화 중단
    if (currentRoom?.meeting_end_time) {
      const endTime = new Date(currentRoom.meeting_end_time).getTime()
      if (Date.now() > endTime) {
        console.log(`[Relay] Meeting time expired, stopping conversation`)
        // 회의 상태 자동 종료
        await supabase
          .from('chat_rooms')
          .update({ is_meeting_active: false })
          .eq('id', roomId)
        break
      }
    }

    // 사용자가 새 메시지를 보냈는지 확인 (대화 중단 조건)
    if (round > 0) {
      const { data: newUserMessage } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('room_id', roomId)
        .eq('sender_type', 'user')
        .gt('created_at', originalMessageTime)
        .limit(1)
        .single()

      if (newUserMessage) {
        console.log(`[Relay] User sent new message, ending conversation`)
        break
      }
    }

    console.log(`[Relay] Round ${round + 1}/${maxRounds} (elapsed: ${Math.round((Date.now() - startTime) / 1000)}s)`)

    // ========================================
    // 진행자 중심 토론 모드 (Round 2+, 진행자 있을 때)
    // ========================================
    if (hasFacilitator && facilitatorAgent && round >= 2) {
      console.log(`[Facilitator Mode] Starting facilitator-driven discussion round ${round}`)

      // 아직 발언 안 한 에이전트 찾기 (진행자 제외)
      const agentsNotYetSpoken = nonFacilitatorAgents.filter(a => agentSpeakCount[a.id] < round - 1)
      // 현재 라운드에서 질문할 에이전트 선택
      const agentToAsk = agentsNotYetSpoken.length > 0
        ? agentsNotYetSpoken[0]
        : nonFacilitatorAgents[(round - 2) % nonFacilitatorAgents.length]

      console.log(`[Facilitator Mode] Facilitator will ask: ${agentToAsk.name}`)

      // --- 1. 진행자가 에이전트를 지목하여 질문 ---
      await supabase.from('chat_participants').update({ is_typing: true }).eq('room_id', roomId).eq('agent_id', facilitatorAgent.id)

      const recentHistory = conversationHistory.slice(-8)
      const historyText = recentHistory.map(h => `[${h.name}]: ${h.content}`).join('\n\n')
      const topicInstruction = roomContext.meetingTopic && roomContext.meetingTopic !== '자유 토론'
        ? `\n🎯 토론 주제: "${roomContext.meetingTopic}"`
        : ''

      const facilitatorPrompt = `${historyText}

---
👑 당신: ${facilitatorAgent.name} (회의 진행자)${topicInstruction}

지금까지 대화를 듣고, **${agentToAsk.name}**님에게 의견을 물어보세요.

예시:
- "${agentToAsk.name}님은 이 부분에 대해 어떻게 생각하세요?"
- "${agentToAsk.name}님, 혹시 다른 관점이 있으신가요?"
- "그럼 ${agentToAsk.name}님 의견도 들어볼까요?"

규칙:
- 반드시 ${agentToAsk.name}을 이름으로 지목하세요
- 이전 발언을 간단히 정리하거나 코멘트해도 좋아요
- 1-2문장, 한국어만`

      let facilitatorResponse = await generateSingleAgentResponse(supabase, facilitatorAgent, facilitatorPrompt, roomContext, images, userId)

      if (facilitatorResponse) {
        // 응답 정제
        facilitatorResponse = cleanAgentResponse(facilitatorResponse, uniqueAgents)

        await supabase.from('chat_messages').insert({
          room_id: roomId,
          sender_type: 'agent',
          sender_agent_id: facilitatorAgent.id,
          message_type: 'text',
          content: facilitatorResponse,
          is_ai_response: true,
          metadata: { agent_name: facilitatorAgent.name, is_facilitator: true },
        })

        // 🔥 진행자 대화 메모리 저장
        try {
          const memoryService = getMemoryService(supabase)
          await memoryService.logConversation(facilitatorAgent.id, roomId, facilitatorPrompt, facilitatorResponse, {
            room_name: roomContext.roomName, is_facilitator: true, round: round + 1,
          })
        } catch (e) { /* ignore */ }

        conversationHistory.push({
          role: 'agent',
          name: facilitatorAgent.name,
          agentId: facilitatorAgent.id,
          content: facilitatorResponse
        })
        totalMessages++
        agentSpeakCount[facilitatorAgent.id]++

        console.log(`[Facilitator] ${facilitatorAgent.name}: ${facilitatorResponse.slice(0, 50)}...`)
      }

      await supabase.from('chat_participants').update({ is_typing: false }).eq('room_id', roomId).eq('agent_id', facilitatorAgent.id)

      // 잠깐 대기 (자연스러운 흐름)
      await new Promise(resolve => setTimeout(resolve, 1500))

      // --- 2. 지목받은 에이전트가 대답 ---
      await supabase.from('chat_participants').update({ is_typing: true }).eq('room_id', roomId).eq('agent_id', agentToAsk.id)

      const updatedHistory = conversationHistory.slice(-8)
      const updatedHistoryText = updatedHistory.map(h => `[${h.name}]: ${h.content}`).join('\n\n')

      const agentPrompt = `${updatedHistoryText}

---
당신: ${agentToAsk.name}${topicInstruction}
(👑 진행자 ${facilitatorAgent.name}님이 당신에게 질문했습니다)

진행자가 당신에게 의견을 물었습니다. 성실하게 답변하세요.

규칙:
- 질문에 대한 당신의 생각을 명확히 말하세요
- 구체적인 예시나 이유를 들면 좋아요
- 다른 사람 의견에 동의/반박할 수도 있어요
- 1-3문장, 한국어만`

      let agentResponse = await generateSingleAgentResponse(supabase, agentToAsk, agentPrompt, roomContext, images, userId)

      if (agentResponse) {
        agentResponse = cleanAgentResponse(agentResponse, uniqueAgents)

        await supabase.from('chat_messages').insert({
          room_id: roomId,
          sender_type: 'agent',
          sender_agent_id: agentToAsk.id,
          message_type: 'text',
          content: agentResponse,
          is_ai_response: true,
          metadata: { agent_name: agentToAsk.name },
        })

        // 🔥 지목된 에이전트 대화 메모리 저장
        try {
          const memoryService = getMemoryService(supabase)
          await memoryService.logConversation(agentToAsk.id, roomId, agentPrompt, agentResponse, {
            room_name: roomContext.roomName, round: round + 1,
          })
        } catch (e) { /* ignore */ }

        conversationHistory.push({
          role: 'agent',
          name: agentToAsk.name,
          agentId: agentToAsk.id,
          content: agentResponse
        })
        totalMessages++
        agentSpeakCount[agentToAsk.id]++

        console.log(`[Agent] ${agentToAsk.name}: ${agentResponse.slice(0, 50)}...`)
      }

      await supabase.from('chat_participants').update({ is_typing: false }).eq('room_id', roomId).eq('agent_id', agentToAsk.id)

      // 다음 라운드로
      continue
    }

    // ========================================
    // 기존 릴레이 모드 (Round 0-1 또는 진행자 없을 때)
    // ========================================
    for (const agent of uniqueAgents) {
      if (totalMessages >= maxTotalMessages) break

      // 시간 제한 체크 (각 에이전트 턴마다)
      if (Date.now() - startTime > maxTimeMs) {
        console.log(`[Relay] Time limit reached during round, ending conversation`)
        break
      }

      console.log(`[Relay] Agent ${agent.name} turn (round ${round + 1})`)

      // 이 에이전트만 타이핑 상태로 설정
      await supabase
        .from('chat_participants')
        .update({ is_typing: true })
        .eq('room_id', roomId)
        .eq('agent_id', agent.id)

      try {
        // 대화 기록에서 컨텍스트 구성
        const recentHistory = conversationHistory.slice(-10) // 최근 10개로 확장

        // 🔥 연속 발언 체크: 2번까지 허용, 3번 연속이면 스킵
        const lastTwoMessages = recentHistory.slice(-2)
        const consecutiveOwnMessages = lastTwoMessages.filter(m => m.agentId === agent.id).length
        if (consecutiveOwnMessages >= 2) {
          console.log(`[Relay] Skipping ${agent.name} - already spoke 2 times consecutively`)
          await supabase
            .from('chat_participants')
            .update({ is_typing: false })
            .eq('room_id', roomId)
            .eq('agent_id', agent.id)
          continue // 다음 에이전트로 넘어감
        }

        // 🔥 자신의 메시지도 포함 (일관성 유지를 위해)
        const filteredHistory = recentHistory.slice(-8)

        // 🔥 자기 발언은 (나) 표시로 구분
        const historyText = filteredHistory
          .map(h => h.agentId === agent.id
            ? `[나(${h.name})]: ${h.content}`
            : `[${h.name}]: ${h.content}`)
          .join('\n\n')

        // 다른 에이전트들 이름
        const otherAgentNames = uniqueAgents
          .filter(a => a.id !== agent.id)
          .map(a => a.name)
          .join(', ')

        // 토론 주제가 있으면 프롬프트에 포함
        const topicInstruction = roomContext.meetingTopic && roomContext.meetingTopic !== '자유 토론'
          ? `\n🎯 토론 주제: "${roomContext.meetingTopic}"`
          : ''

        // 마지막 발언자 이름 (응답 대상 명시)
        const lastSpeaker = filteredHistory.length > 0
          ? filteredHistory[filteredHistory.length - 1].name
          : '사용자'

        // 🔥 대화 흐름 힌트 (강제하지 않고 자연스럽게)
        const flowHints = [
          '자연스럽게 대화하세요',
          '궁금한 점이 있으면 물어보세요',
          '당신의 경험이나 생각을 공유하세요',
          '이어서 말해도 되고, 다른 관점을 제시해도 됩니다',
          '동의하든 반대하든 솔직하게 말하세요',
          '구체적인 예시나 아이디어가 있으면 말하세요',
        ]
        const flowIndex = (agent.id.charCodeAt(0) + round) % flowHints.length
        const flowHint = flowHints[flowIndex]

        // 회의 단계 구분
        // Phase 0: 첫 인사 (각 에이전트 1번씩)
        // Phase 1: 가벼운 인사 주고받기 (1라운드)
        // Phase 2: 회의 시작 선언 (첫 번째 에이전트가)
        // Phase 3+: 본격 토론

        const agentIndex = uniqueAgents.findIndex(a => a.id === agent.id)
        const isFacilitator = facilitatorId === agent.id  // 진행자인가?
        const facilitatorAgent = facilitatorId ? uniqueAgents.find(a => a.id === facilitatorId) : null
        const facilitatorName = facilitatorAgent?.name || null

        // 디버그 로그 - 에이전트 정체성 확인
        console.log(`[Relay] 🔍 에이전트 정체성 확인:`)
        console.log(`  - Agent ID: ${agent.id}`)
        console.log(`  - Agent Name: ${agent.name}`)
        console.log(`  - Agent Model: ${agent.model}`)
        console.log(`  - Agent Provider: ${agent.llm_provider}`)
        console.log(`  - Round: ${round}, isFacilitator: ${isFacilitator}`)

        const isFirstGreeting = round === 0  // 첫 인사
        const isSmallTalk = round === 1  // 가벼운 대화
        // 진행자가 있으면 진행자가 회의 시작, 없으면 첫 번째 에이전트
        const isMeetingStart = round === 2 && (facilitatorId ? agent.id === facilitatorId : agentIndex === 0)
        const isDiscussion = round >= 2 && !isMeetingStart  // 본격 토론

        let contextMessage: string

        if (isFirstGreeting) {
          // Phase 0: 첫 인사
          const greetingStyles = [
            '반갑게 인사하세요',
            '밝게 인사하세요',
            '편하게 인사하세요',
          ]
          const greetStyle = greetingStyles[agentIndex % greetingStyles.length]

          contextMessage = `회의실에 입장했습니다.

참여자: ${uniqueAgents.map(a => a.name).join(', ')}
당신: ${agent.name}

${filteredHistory.length > 0 ? `[먼저 온 사람들]\n${historyText}\n\n` : ''}지시사항:
- ${greetStyle} (예: "안녕하세요~", "어 왔어요?", "오랜만이에요!")
- 1문장만, 한국어만`

        } else if (isSmallTalk) {
          // Phase 1: 회의 준비 단계 (스몰토크 대신 회의 준비로 변경)
          contextMessage = `[대화]
${historyText}

---
당신: ${agent.name}${topicInstruction}

"${lastSpeaker}"의 인사에 간단히 반응하고, 회의 준비가 됐다고 하세요.
예: "네, 저도 왔어요! 바로 시작할까요?", "안녕하세요, 준비됐어요!"

- 1문장, 친근하게
- 회의 주제와 관련없는 얘기(날씨, 주말 등) 하지 마세요`

        } else if (isMeetingStart) {
          // Phase 2: 회의 시작 선언 (진행자 또는 첫 번째 에이전트가)
          if (isFacilitator) {
            // 진행자가 회의 시작
            contextMessage = `[대화]
${historyText}

---
당신: ${agent.name} (👑 오늘 회의 진행자)${topicInstruction}

당신은 오늘 회의 진행자입니다. 회의를 시작하세요.
- "자, 이제 본론으로 들어가볼까요?" 같이 시작을 알리세요
${topicInstruction ? '- 주제를 언급하고 첫 질문을 던지세요' : '- 자연스럽게 주제를 던지세요'}

진행자로서:
- 회의 진행을 이끌어가세요
- 다른 참여자에게 질문을 던지세요

- 1-2문장, 한국어만`
          } else {
            contextMessage = `[대화]
${historyText}

---
당신: ${agent.name}${topicInstruction}

인사가 끝났으니 회의를 시작하자고 제안하세요.
예: "자, 그럼 슬슬 시작해볼까요?", "좋아요, 본론으로 들어가죠!"

${topicInstruction ? '그리고 주제에 대한 첫 의견을 던지세요.' : ''}

- 1-2문장, 한국어만`
          }

        } else {
          // Phase 3+: 본격 토론
          if (isFacilitator) {
            // 진행자는 특별한 역할
            contextMessage = `${historyText}

---
👑 당신: ${agent.name} (회의 진행자) | 참여자: ${otherAgentNames || '사용자'}${topicInstruction}

"${lastSpeaker}"의 발언 후, 진행자로서 반응하세요.

**진행자 역할:**
- 토론이 주제에서 벗어나면 "잠깐, 다시 본론으로 돌아가죠" 라고 지적
- 불필요한 얘기나 헛소리하면 "그건 좀 관련없는 얘기 같은데요" 라고 따끔하게 지적
- 특정 참여자에게 "~씨는 어떻게 생각해요?" 라고 의견 요청
- 논의가 길어지면 "정리하면..." 으로 요약
- 때로는 날카로운 질문으로 토론 자극

규칙:
- 1-2문장, 한국어만
- 진행자답게 회의를 이끌어가세요`
          } else {
            // 일반 참여자
            const facilitatorNote = facilitatorName ? `\n(👑 진행자: ${facilitatorName} - 진행자 지시에 따르세요)` : ''

            contextMessage = `${historyText}

---
당신: ${agent.name} | 대화 상대: ${otherAgentNames || '사용자'}${topicInstruction}${facilitatorNote}

위 대화를 보고 자연스럽게 참여하세요. ${flowHint}

💬 팁:
- 실제 회의처럼 대화하세요 (끊임없이 주고받기)
- 앞 사람 말에 이어서 "아, 그러고 보니...", "근데 그건..." 처럼 자연스럽게
- 질문하거나, 의견 덧붙이거나, 새 아이디어 제안하거나
- 1-3문장, 한국어`
          }
        }

        // 에이전트 응답 생성
        let response = await generateSingleAgentResponse(supabase, agent, contextMessage, roomContext, images, userId)

        // 자기 이름 및 다른 에이전트 이름 접두어 제거
        if (response) {
          // 모든 에이전트 이름 리스트 (자신 + 다른 에이전트)
          const allAgentNames = uniqueAgents.map(a => a.name.trim())

          // 다양한 패턴으로 이름 접두어 제거 (반복 적용)
          let cleanedResponse = response
          for (let i = 0; i < 3; i++) {  // 여러 번 반복해서 중첩된 패턴도 제거
            for (const name of allAgentNames) {
              // 이름에서 공백을 처리한 패턴들
              const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              const patterns = [
                new RegExp(`^\\s*${escapedName}\\s*:\\s*`, 'gi'),
                new RegExp(`^\\s*\\[${escapedName}\\]\\s*:\\s*`, 'gi'),
                new RegExp(`^\\s*${escapedName}님\\s*:\\s*`, 'gi'),
                // 이름의 일부만 사용하는 경우 (예: "에이미" -> "에미")
                new RegExp(`^\\s*${name.slice(0, Math.min(2, name.length))}\\s*:\\s*`, 'gi'),
              ]
              for (const pattern of patterns) {
                cleanedResponse = cleanedResponse.replace(pattern, '')
              }
            }

            // 일반적인 "이름:" 패턴 제거 (한글 이름 + 콜론, 공백 포함)
            cleanedResponse = cleanedResponse.replace(/^\s*[가-힣a-zA-Z]{2,15}\s*:\s*/g, '')
          }
          response = cleanedResponse.trim()
        }

        if (response) {
          // 즉시 DB에 저장
          await supabase.from('chat_messages').insert({
            room_id: roomId,
            sender_type: 'agent',
            sender_agent_id: agent.id,
            message_type: 'text',
            content: response,
            is_ai_response: true,
            metadata: {
              agent_name: agent.name,
              round: round + 1,
            },
          })
          console.log(`[Relay] Agent ${agent.name} said: ${response.slice(0, 50)}...`)

          // 🔥 메모리 시스템에 대화 기록 저장 (영속적 기억)
          try {
            const memoryService = getMemoryService(supabase)
            await memoryService.logConversation(
              agent.id,
              roomId,
              contextMessage,  // 컨텍스트 메시지 (대화 맥락)
              response,        // 에이전트 응답
              {
                room_name: roomContext.roomName,
                room_type: roomContext.roomType,
                round: round + 1,
                is_relay: true,
              }
            )
          } catch (memError) {
            console.warn(`[Relay] Memory logging failed for ${agent.name}:`, memError)
          }

          // 대화 기록에 추가
          conversationHistory.push({
            role: 'agent',
            name: agent.name,
            agentId: agent.id,
            content: response
          })
          totalMessages++
          agentSpeakCount[agent.id]++  // 발언 횟수 추적
        }
      } catch (error) {
        console.error(`[Relay] Agent ${agent.name} error:`, error)
      } finally {
        // 타이핑 상태 해제
        await supabase
          .from('chat_participants')
          .update({ is_typing: false })
          .eq('room_id', roomId)
          .eq('agent_id', agent.id)
      }

      // 다음 응답 전 딜레이 (자연스러운 대화 속도)
      await new Promise(resolve => setTimeout(resolve, 2500))
    }
  }

  const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
  console.log(`[Relay] Conversation completed: ${totalMessages} messages in ${elapsedSeconds}s`)
}

// 🔥 단일 에이전트 응답 생성 (통합 함수 사용)
// generateAgentChatResponse를 래핑하여 메신저용 메모리 컨텍스트 주입
async function generateSingleAgentResponse(
  supabase: any,
  agent: any,
  contextMessage: string,
  roomContext: { roomId: string; roomName?: string; roomType?: string },
  images: string[] = [], // 🔥 이미지 파라미터 추가
  userId?: string // 🔥 사용자 ID (API 키 조회용)
): Promise<string> {
  // 🔥 에이전트의 과거 기억 로드 (영속적 인격)
  let recentConversations = ''
  let identityContext = ''
  try {
    const memoryService = getMemoryService(supabase)
    const memory = await memoryService.loadFullContext(agent.id, {
      roomId: roomContext.roomId,
      query: contextMessage.slice(0, 200),
    })

    // 최근 대화 기록 요약
    if (memory.recentLogs && memory.recentLogs.length > 0) {
      const conversations = memory.recentLogs
        .filter((log: any) => log.log_type === 'conversation')
        .slice(0, 5)
        .map((log: any) => {
          const content = log.content || ''
          const match = content.match(/에이전트 응답: ([\s\S]+)$/)
          return match ? `- "${match[1].slice(0, 100)}..."` : null
        })
        .filter(Boolean)
        .join('\n')

      if (conversations) {
        recentConversations = conversations
      }
    }

    // 정체성 정보
    if (memory.identity) {
      const id = memory.identity
      let idLines: string[] = []

      if (id.selfSummary) idLines.push(id.selfSummary)
      if (id.coreValues?.length) idLines.push(`핵심 가치: ${id.coreValues.join(', ')}`)
      if (id.personalityTraits?.length) idLines.push(`성격: ${id.personalityTraits.join(', ')}`)
      if (id.communicationStyle) idLines.push(`소통 스타일: ${id.communicationStyle}`)
      if (id.workingStyle) idLines.push(`업무 스타일: ${id.workingStyle}`)
      if (id.strengths?.length) idLines.push(`강점: ${id.strengths.join(', ')}`)
      if (id.expertiseAreas?.length) {
        const expertiseList = id.expertiseAreas
          .map((e: any) => `${e.area}(${Math.round(e.level * 100)}%)`)
          .join(', ')
        idLines.push(`전문 분야: ${expertiseList}`)
      }
      if (id.recentFocus) idLines.push(`최근 집중: ${id.recentFocus}`)

      if (idLines.length > 0) {
        identityContext = `\n[나의 정체성]\n${idLines.join('\n')}\n`
      }
    }
  } catch (memError) {
    console.warn(`[generateSingleAgentResponse] Memory load failed for ${agent.name}:`, memError)
  }

  console.log(`[generateSingleAgentResponse] 🔍 에이전트 확인:`)
  console.log(`  - ID: ${agent.id}`)
  console.log(`  - Name: ${agent.name}`)
  console.log(`  - Memory: ${recentConversations ? 'YES' : 'NO'}`)

  // 🔥 사용자의 LLM API 키 가져오기
  let userApiKey: string | undefined
  if (userId) {
    try {
      const provider = agent.llm_provider || 'grok'
      const llmConfig = await getLLMConfigForAgent(userId, provider)
      userApiKey = llmConfig.apiKey
      if (llmConfig.useUserKey) {
        console.log(`[generateSingleAgentResponse] Using user's ${provider} API key`)
      }
    } catch (keyError) {
      console.warn('[generateSingleAgentResponse] Failed to fetch user LLM key:', keyError)
    }
  }

  // 🔥 통합 함수 호출 (generateAgentChatResponse)
  try {
    const response = await generateAgentChatResponse(
      { ...agent, apiKey: userApiKey }, // 🔥 사용자 API 키 주입
      contextMessage,
      [], // 채팅 히스토리는 contextMessage에 포함됨
      {
        roomName: roomContext.roomName,
        roomType: roomContext.roomType,
        isMessenger: true, // 🔥 메신저 모드 활성화
      },
      images, // 🔥 이미지 전달
      {
        recentConversations,
        identityContext,
      }
    )
    return response
  } catch (error) {
    console.error(`[generateSingleAgentResponse] Error for ${agent.name}:`, error)
    throw error
  }
}

async function generateAgentResponseHandler(
  supabase: any,
  roomId: string,
  agent: any,
  userMessage: any,
  userId?: string
) {
  console.log(`[generateAgentResponse] 시작 - Agent: ${agent.name} (${agent.id})`)
  const memoryService = getMemoryService(supabase)

  try {
    // 타이핑 상태 업데이트
    console.log('[generateAgentResponse] 타이핑 상태 업데이트')
    await supabase
      .from('chat_participants')
      .update({ is_typing: true })
      .eq('room_id', roomId)
      .eq('agent_id', agent.id)

    // 채팅방 정보 조회 (첨부 자료 포함)
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('name, type, is_meeting_active, meeting_topic, meeting_attachments, project_id')
      .eq('id', roomId)
      .single()

    // 에이전트 메모리 컨텍스트 로드
    let memoryContext = ''
    let identityInfo: any = null
    try {
      const memory = await memoryService.loadFullContext(agent.id, {
        roomId,
        projectId: room?.project_id,
        query: userMessage.content,
      })
      memoryContext = memory.contextSummary
      identityInfo = memory.identity
    } catch (memError) {
      console.error(`Failed to load memory for agent ${agent.id}:`, memError)
    }

    // 참여자 조회
    const { data: participants } = await supabase
      .from('chat_participants')
      .select('user_id, agent_id')
      .eq('room_id', roomId)

    // 참여자 이름 가져오기
    const userIds = participants?.filter((p: any) => p.user_id).map((p: any) => p.user_id) || []
    const agentIds = participants?.filter((p: any) => p.agent_id).map((p: any) => p.agent_id) || []

    let participantNames: string[] = []

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('name')
        .in('id', userIds)
      participantNames = participantNames.concat(users?.map((u: any) => u.name) || [])
    }

    if (agentIds.length > 0) {
      const { data: agentList } = await supabase
        .from('deployed_agents')
        .select('name')
        .in('id', agentIds)
      participantNames = participantNames.concat(agentList?.map((a: any) => a.name) || [])
    }

    // 최근 메시지 기록 조회 (더 많은 컨텍스트를 위해 30개)
    const { data: rawRecentMessages } = await supabase
      .from('chat_messages')
      .select('content, sender_type, sender_user_id, sender_agent_id, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(30)

    // 발신자 이름 매핑
    const msgUserIds = Array.from(new Set((rawRecentMessages || []).filter((m: any) => m.sender_user_id).map((m: any) => m.sender_user_id as string)))
    const msgAgentIds = Array.from(new Set((rawRecentMessages || []).filter((m: any) => m.sender_agent_id).map((m: any) => m.sender_agent_id as string)))

    const userNameMap: Record<string, string> = {}
    const agentNameMap: Record<string, string> = {}

    if (msgUserIds.length > 0) {
      const { data: msgUsers } = await supabase
        .from('users')
        .select('id, name')
        .in('id', msgUserIds)
      for (const u of msgUsers || []) {
        userNameMap[u.id] = u.name
      }
    }

    if (msgAgentIds.length > 0) {
      const { data: msgAgents } = await supabase
        .from('deployed_agents')
        .select('id, name')
        .in('id', msgAgentIds)
      for (const a of msgAgents || []) {
        agentNameMap[a.id] = a.name
      }
    }

    // 메시지에 발신자 이름 추가
    const recentMessages = (rawRecentMessages || []).map((msg: any) => ({
      ...msg,
      sender_user: msg.sender_user_id ? { name: userNameMap[msg.sender_user_id] || '사용자' } : null,
      sender_agent: msg.sender_agent_id ? { name: agentNameMap[msg.sender_agent_id] || '에이전트' } : null,
    }))

    // 메모리가 포함된 시스템 프롬프트 생성
    let enhancedSystemPrompt = agent.system_prompt || `당신은 ${agent.name}입니다.`

    // 정체성 정보 추가 (모든 필드 포함)
    if (identityInfo) {
      let identitySection = `\n\n## 나의 정체성\n`

      if (identityInfo.selfSummary) {
        identitySection += `${identityInfo.selfSummary}\n\n`
      }

      // 핵심 가치
      if (identityInfo.coreValues?.length) {
        identitySection += `핵심 가치: ${identityInfo.coreValues.join(', ')}\n`
      }

      // 성격 특성 - 대화 스타일에 중요
      if (identityInfo.personalityTraits?.length) {
        identitySection += `나의 성격: ${identityInfo.personalityTraits.join(', ')}\n`
      }

      // 소통 스타일 - 응답 톤에 직접 영향
      if (identityInfo.communicationStyle) {
        identitySection += `소통 스타일: ${identityInfo.communicationStyle}\n`
      }

      // 업무 스타일
      if (identityInfo.workingStyle) {
        identitySection += `업무 스타일: ${identityInfo.workingStyle}\n`
      }

      // 강점
      if (identityInfo.strengths?.length) {
        identitySection += `강점: ${identityInfo.strengths.join(', ')}\n`
      }

      // 전문 분야
      if (identityInfo.expertiseAreas?.length) {
        const expertiseList = identityInfo.expertiseAreas
          .map((e: any) => `${e.area}(숙련도: ${Math.round(e.level * 100)}%)`)
          .join(', ')
        identitySection += `전문 분야: ${expertiseList}\n`
      }

      // 성장 영역
      if (identityInfo.growthAreas?.length) {
        identitySection += `성장 중인 영역: ${identityInfo.growthAreas.join(', ')}\n`
      }

      // 최근 집중
      if (identityInfo.recentFocus) {
        identitySection += `최근 집중: ${identityInfo.recentFocus}\n`
      }

      identitySection += `\n위 정체성을 바탕으로 일관된 성격과 말투로 대화하세요.`
      enhancedSystemPrompt += identitySection
    }

    // 메모리 컨텍스트 추가
    if (memoryContext) {
      enhancedSystemPrompt += `\n\n## 내가 기억하는 것들
${memoryContext}

위 기억을 바탕으로 일관성 있게 응답하세요. 이전에 한 말이나 결정을 기억하고 참조하세요.`
    }

    // 🔥 사용자의 LLM API 키 가져오기
    let userApiKey: string | undefined
    if (userId) {
      try {
        const provider = agent.llm_provider || 'grok'
        const llmConfig = await getLLMConfigForAgent(userId, provider)
        userApiKey = llmConfig.apiKey
        if (llmConfig.useUserKey) {
          console.log(`[generateAgentResponse] Using user's ${provider} API key`)
        }
      } catch (keyError) {
        console.warn('[generateAgentResponse] Failed to fetch user LLM key:', keyError)
      }
    }

    // LangChain을 사용한 응답 생성
    let response: string

    if (room?.is_meeting_active && room?.meeting_topic) {
      // 미팅 모드: 에이전트 간 토론
      const otherAgentIds = agentIds.filter((id: string) => id !== agent.id)
      let otherAgents: { name: string; role: string }[] = []

      if (otherAgentIds.length > 0) {
        const { data: otherAgentData } = await supabase
          .from('deployed_agents')
          .select('name')
          .in('id', otherAgentIds)
        otherAgents = otherAgentData?.map((a: any) => ({ name: a.name, role: 'AI 에이전트' })) || []
      }

      // 에이전트 설정을 LangChain 형식으로 변환 (메모리 포함)
      // agent.llm_provider, agent.model을 우선 사용 (DB 저장값)
      const agentWithConfig = {
        ...agent,
        system_prompt: enhancedSystemPrompt,
        apiKey: userApiKey, // 🔥 사용자 API 키 주입
      }

      console.log(`[generateAgentResponse] 미팅 모드 - ${agent.name} using ${agent.llm_provider || 'ollama'}/${agent.model || 'qwen2.5:3b'}`)
      response = await generateAgentMeetingResponse(
        agentWithConfig,
        room.meeting_topic,
        recentMessages?.reverse() || [],
        otherAgents,
        room.meeting_attachments  // 첨부 자료 전달
      )
    } else {
      // 일반 채팅 모드 (메모리 포함)
      // agent.llm_provider, agent.model을 우선 사용 (DB 저장값)
      const agentWithConfig = {
        ...agent,
        system_prompt: enhancedSystemPrompt,
        apiKey: userApiKey, // 🔥 사용자 API 키 주입
      }

      console.log(`[generateAgentResponse] LangChain 응답 생성 시작, ${agent.name} using ${agent.llm_provider || 'ollama'}/${agent.model || 'qwen2.5:3b'}`)
      response = await generateAgentChatResponse(
        agentWithConfig,
        userMessage.content,
        recentMessages?.reverse() || [],
        {
          roomName: room?.name || '채팅방',
          roomType: room?.type,
          participantNames,
        }
      )
      console.log('[generateAgentResponse] LangChain 응답 생성 완료:', response?.slice(0, 100))
    }

    // 에이전트 응답 메시지 저장
    await supabase.from('chat_messages').insert({
      room_id: roomId,
      sender_type: 'agent',
      sender_agent_id: agent.id,
      message_type: 'text',
      content: response,
      is_ai_response: true,
      metadata: {
        model: agent.model || 'qwen2.5:3b',
        provider: agent.llm_provider || 'ollama',
        agent_name: agent.name,
        has_memory: !!memoryContext,
      },
    })

    // 대화 로그 기록 (메모리 시스템)
    try {
      await memoryService.logConversation(
        agent.id,
        roomId,
        userMessage.content,
        response,
        {
          room_name: room?.name,
          room_type: room?.type,
          is_meeting: room?.is_meeting_active,
          meeting_topic: room?.meeting_topic,
          project_id: room?.project_id,
        }
      )
    } catch (logError) {
      console.error(`Failed to log conversation for agent ${agent.id}:`, logError)
    }

    // 중요한 대화에서 지식 추출 (비동기, 백그라운드)
    extractKnowledgeFromConversation(
      supabase,
      agent.id,
      userMessage.content,
      response
    ).catch(err => console.error('Knowledge extraction error:', err))

  } catch (error: any) {
    console.error(`Agent ${agent.id} response generation failed:`)
    console.error('Error name:', error?.name)
    console.error('Error message:', error?.message)
    console.error('Error stack:', error?.stack)
    console.error('Full error:', JSON.stringify(error, null, 2))

    // 에러 시 폴백 메시지
    await supabase.from('chat_messages').insert({
      room_id: roomId,
      sender_type: 'agent',
      sender_agent_id: agent.id,
      message_type: 'text',
      content: `죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.`,
      is_ai_response: true,
      metadata: {
        error: true,
        agent_name: agent.name,
      },
    })
  } finally {
    // 타이핑 상태 해제
    await supabase
      .from('chat_participants')
      .update({ is_typing: false })
      .eq('room_id', roomId)
      .eq('agent_id', agent.id)
  }
}
