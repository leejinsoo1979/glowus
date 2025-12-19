export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SendMessageRequest, MeetingConfig } from '@/types/chat'
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
import {
  generateMasterPrompt,
  generateAgentSystemPrompt,
  getStepHint,
  roundToStep,
  MEETING_HARD_RULES,
  SPEAKING_FORMAT,
  ROLE_PRESETS,
  DISCUSSION_MODES,
  MeetingContext,
  AgentPromptContext,
} from '@/lib/meeting/prompt-templates'
import {
  validateEvidence,
  getRegenerationPrompt,
  SharedContentInfo,
  parseEvidenceTags,
} from '@/lib/meeting/evidence-validator'

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

    // 채팅방 정보 조회 (진행자, 회의 설정 포함)
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('name, type, is_meeting_active, meeting_topic, meeting_facilitator_id, meeting_config')
      .eq('id', roomId)
      .single()

    console.log(`[triggerAgentResponse] Room data:`, {
      name: room?.name,
      is_meeting_active: room?.is_meeting_active,
      meeting_facilitator_id: room?.meeting_facilitator_id,
      meeting_config: room?.meeting_config,
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
        meetingConfig: room?.meeting_config, // 🔥 회의 설정
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

// 응답에서 에이전트 이름 접두어 및 Thinking 블록 제거
function cleanAgentResponse(response: string, agents: any[]): string {
  let cleaned = response

  // 1. <thinking> 블록 제거 (줄바꿈 포함 모든 문자 매칭)
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
  // 혹시 모를 대괄호 태그 잔재 제거 (안전장치)
  cleaned = cleaned.replace(/\[(FACT|ASSUMPTION|ESTIMATE|근거|논리)\].*?(\n|$)/gi, '')
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '')
  cleaned = cleaned.replace(/\[thinking\][\s\S]*?\[\/thinking\]/gi, '')

  // 1.5. 지문(*행동*) 제거 (강제)
  cleaned = cleaned.replace(/\*[^*]+\*/g, '')

  // 1.6. 번호 매기기 제거 (1. 2. 또는 1) 2) 등) - 문장 시작 부분이나 줄바꿈 후
  cleaned = cleaned.replace(/(^|\n)\s*\d+[.)]\s*/g, '$1')

  // 2. 태그 패턴 제거 [제안], [반박], [근거], [리스크], [질문], [결정], [태그]
  cleaned = cleaned.replace(/\[(제안|반박|근거|리스크|질문|결정|태그)\]/g, '')

  // 3. (FACT), (ASSUMPTION), (ESTIMATE), (RISK) 라벨 제거
  cleaned = cleaned.replace(/\((FACT|ASSUMPTION|ESTIMATE|RISK)\)/gi, '')

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
  roomContext: {
    roomId: string
    roomName?: string
    roomType?: string
    isMeeting?: boolean
    meetingTopic?: string
    facilitatorId?: string
    meetingConfig?: MeetingConfig
  },
  images: string[] = [],
  userId?: string
) {
  const { roomId, facilitatorId, meetingConfig } = roomContext

  // 🔥 회의 설정 로깅
  console.log('[Relay] Meeting config:', meetingConfig)

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
  // 🔥 회의 모드 여부 확인 (회의 시간이 설정되어 있으면 회의 모드)
  const { data: meetingInfo } = await supabase
    .from('chat_rooms')
    .select('is_meeting_active, meeting_end_time, meeting_duration_minutes')
    .eq('id', roomId)
    .single()

  const isMeetingMode = meetingInfo?.is_meeting_active || meetingInfo?.meeting_end_time

  // 라운드 수 계산:
  // - 진행자 있으면: 20라운드
  // - 회의 모드 (시간 설정됨): 15라운드
  // - 일반: 8라운드 (기존 5 -> 8로 증가)
  const maxRounds = hasFacilitator ? 20 : (isMeetingMode ? 15 : 8)

  // 시간 제한:
  // - 진행자: 10분
  // - 회의 모드: 회의 종료 시간까지 (최대 30분)
  // - 일반: 5분 (기존 3분 -> 5분으로 증가)
  const maxTimeMs = hasFacilitator ? 600000 : (isMeetingMode ? 1800000 : 300000)
  const startTime = Date.now()
  let totalMessages = 0
  const maxTotalMessages = uniqueAgents.length * maxRounds

  // 🕐 시간 상태 계산 헬퍼 함수
  type TimePhase = 'start' | 'mid' | 'closing' | 'urgent' | 'expired' | 'no_limit'
  interface TimeStatus {
    phase: TimePhase
    remainingSeconds: number | null
    remainingPercent: number | null
    hint: string
    shouldPushConclusion: boolean
    canRequestExtension: boolean
  }

  const getTimeStatus = async (): Promise<TimeStatus> => {
    const { data: currentRoom } = await supabase
      .from('chat_rooms')
      .select('meeting_started_at, meeting_end_time, meeting_duration_minutes')
      .eq('id', roomId)
      .single()

    // 회의 시간 설정이 없는 경우
    if (!currentRoom?.meeting_end_time) {
      return {
        phase: 'no_limit',
        remainingSeconds: null,
        remainingPercent: null,
        hint: '',
        shouldPushConclusion: false,
        canRequestExtension: false
      }
    }

    const endTime = new Date(currentRoom.meeting_end_time).getTime()
    const startedAt = currentRoom.meeting_started_at ? new Date(currentRoom.meeting_started_at).getTime() : startTime
    const totalDuration = endTime - startedAt
    const now = Date.now()
    const remaining = endTime - now
    const remainingSeconds = Math.floor(remaining / 1000)
    const remainingPercent = Math.max(0, Math.min(100, (remaining / totalDuration) * 100))

    // 시간 만료
    if (remaining <= 0) {
      return {
        phase: 'expired',
        remainingSeconds: 0,
        remainingPercent: 0,
        hint: '⏰ 시간 종료! 마지막 정리 한마디만.',
        shouldPushConclusion: true,
        canRequestExtension: true
      }
    }

    // 1분 이내 - 긴급
    if (remainingPercent <= 15 || remainingSeconds <= 60) {
      return {
        phase: 'urgent',
        remainingSeconds,
        remainingPercent,
        hint: `⚠️ ${remainingSeconds}초 남음! 결론 내려야 해. 핵심만 빠르게.`,
        shouldPushConclusion: true,
        canRequestExtension: true
      }
    }

    // 25% 이하 - 마무리 단계
    if (remainingPercent <= 25) {
      const mins = Math.floor(remainingSeconds / 60)
      return {
        phase: 'closing',
        remainingSeconds,
        remainingPercent,
        hint: `🕐 ${mins}분 남음. 마무리 단계야. 결론 정리하자.`,
        shouldPushConclusion: true,
        canRequestExtension: false
      }
    }

    // 50% 이하 - 중반
    if (remainingPercent <= 50) {
      const mins = Math.floor(remainingSeconds / 60)
      return {
        phase: 'mid',
        remainingSeconds,
        remainingPercent,
        hint: `⏳ 시간 절반 지남 (${mins}분 남음). 핵심 논의에 집중.`,
        shouldPushConclusion: false,
        canRequestExtension: false
      }
    }

    // 50% 이상 - 시작 단계
    return {
      phase: 'start',
      remainingSeconds,
      remainingPercent,
      hint: '',
      shouldPushConclusion: false,
      canRequestExtension: false
    }
  }

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

      // 시간 상태 확인
      const facilTimeStatus = await getTimeStatus()

      // 진행자 역할 결정: 질문/통제/정리
      type FacilitatorRole = 'ask' | 'control' | 'summarize' | 'push_conclusion'
      let facilitatorRole: FacilitatorRole = 'ask'

      // 시간에 따른 역할 변경
      if (facilTimeStatus.phase === 'urgent' || facilTimeStatus.phase === 'expired') {
        facilitatorRole = 'push_conclusion'
      } else if (facilTimeStatus.phase === 'closing') {
        facilitatorRole = 'summarize'
      } else if (round % 4 === 0) {
        // 4라운드마다 중간 정리
        facilitatorRole = 'summarize'
      } else if (conversationHistory.length > 5) {
        // 대화가 길어지면 가끔 통제
        const lastMessages = conversationHistory.slice(-3)
        const offTopicKeywords = ['근데 다른 얘기인데', '아 참', '그건 그렇고']
        const maybeOffTopic = lastMessages.some(m => offTopicKeywords.some(k => m.content.includes(k)))
        if (maybeOffTopic) facilitatorRole = 'control'
      }

      console.log(`[Facilitator Mode] Role: ${facilitatorRole}, Time: ${facilTimeStatus.phase}`)

      // 아직 발언 적은 에이전트 찾기 (진행자 제외)
      const sortedBySpeak = [...nonFacilitatorAgents].sort((a, b) => agentSpeakCount[a.id] - agentSpeakCount[b.id])
      const agentToAsk = sortedBySpeak[0]

      const recentHistory = conversationHistory.slice(-8)
      const historyText = recentHistory.map(h => `[${h.name}]: ${h.content}`).join('\n\n')
      const topicInstruction = roomContext.meetingTopic && roomContext.meetingTopic !== '자유 토론'
        ? `\n🎯 토론 주제: "${roomContext.meetingTopic}"`
        : ''

      // --- 1. 진행자 발언 ---
      await supabase.from('chat_participants').update({ is_typing: true }).eq('room_id', roomId).eq('agent_id', facilitatorAgent.id)

      let facilitatorPrompt = ''

      if (facilitatorRole === 'ask') {
        facilitatorPrompt = `${historyText}

---
👑 ${facilitatorAgent.name} (진행자)${topicInstruction}${facilTimeStatus.hint ? ` ${facilTimeStatus.hint}` : ''}

${agentToAsk.name}님에게 의견을 물어봐.`
      } else if (facilitatorRole === 'control') {
        facilitatorPrompt = `${historyText}

---
👑 ${facilitatorAgent.name} (진행자)${topicInstruction}

본론으로 끌어와.`
      } else if (facilitatorRole === 'summarize') {
        facilitatorPrompt = `${historyText}

---
👑 ${facilitatorAgent.name} (진행자)${topicInstruction}${facilTimeStatus.hint ? ` ${facilTimeStatus.hint}` : ''}

지금까지 의견 정리하고 다음으로 넘어가.`
      } else {
        // push_conclusion
        facilitatorPrompt = `${historyText}

---
👑 ${facilitatorAgent.name} (진행자)${topicInstruction}
⏰ ${facilTimeStatus.hint || '시간 끝!'}

결론 내려. 합의점 찾거나 다수 의견으로 결정해.`
      }

      let facilitatorResponse = await generateSingleAgentResponse(supabase, facilitatorAgent, facilitatorPrompt, roomContext, images, userId)

      if (facilitatorResponse) {
        facilitatorResponse = cleanAgentResponse(facilitatorResponse, uniqueAgents)

        await supabase.from('chat_messages').insert({
          room_id: roomId,
          sender_type: 'agent',
          sender_agent_id: facilitatorAgent.id,
          message_type: 'text',
          content: facilitatorResponse,
          is_ai_response: true,
          metadata: { agent_name: facilitatorAgent.name, is_facilitator: true, facilitator_role: facilitatorRole },
        })

        try {
          const memoryService = getMemoryService(supabase)
          await memoryService.logConversation(facilitatorAgent.id, roomId, facilitatorPrompt, facilitatorResponse, {
            room_name: roomContext.roomName, is_facilitator: true, round: round + 1, role: facilitatorRole,
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

        console.log(`[Facilitator:${facilitatorRole}] ${facilitatorAgent.name}: ${facilitatorResponse.slice(0, 50)}...`)
      }

      await supabase.from('chat_participants').update({ is_typing: false }).eq('room_id', roomId).eq('agent_id', facilitatorAgent.id)
      await new Promise(resolve => setTimeout(resolve, 150))

      // --- 2. 지목받은 에이전트 또는 다른 에이전트들 반응 ---
      // 진행자가 질문했으면 지목된 에이전트가 답변
      // 정리/통제면 다른 에이전트가 동의/반응
      const respondingAgents = facilitatorRole === 'ask'
        ? [agentToAsk]
        : nonFacilitatorAgents.slice(0, 2) // 정리/통제 시 최대 2명 반응

      for (const respondingAgent of respondingAgents) {
        if (totalMessages >= maxTotalMessages) break

        await supabase.from('chat_participants').update({ is_typing: true }).eq('room_id', roomId).eq('agent_id', respondingAgent.id)

        const updatedHistory = conversationHistory.slice(-8)
        const updatedHistoryText = updatedHistory.map(h => `[${h.name}]: ${h.content}`).join('\n\n')

        let agentPrompt = ''

        if (facilitatorRole === 'ask') {
          agentPrompt = `${updatedHistoryText}

---
${respondingAgent.name}${topicInstruction}
(진행자가 질문함)

질문에 답변해.`
        } else if (facilitatorRole === 'push_conclusion') {
          agentPrompt = `${updatedHistoryText}

---
${respondingAgent.name}${topicInstruction}
(진행자가 결론 내림)

동의하거나 마지막 한마디.`
        } else {
          agentPrompt = `${updatedHistoryText}

---
${respondingAgent.name}${topicInstruction}
(진행자 정리중)

짧게 반응.`
        }

        let agentResponse = await generateSingleAgentResponse(supabase, respondingAgent, agentPrompt, roomContext, images, userId)

        if (agentResponse) {
          agentResponse = cleanAgentResponse(agentResponse, uniqueAgents)

          await supabase.from('chat_messages').insert({
            room_id: roomId,
            sender_type: 'agent',
            sender_agent_id: respondingAgent.id,
            message_type: 'text',
            content: agentResponse,
            is_ai_response: true,
            metadata: { agent_name: respondingAgent.name },
          })

          try {
            const memoryService = getMemoryService(supabase)
            await memoryService.logConversation(respondingAgent.id, roomId, agentPrompt, agentResponse, {
              room_name: roomContext.roomName, round: round + 1,
            })
          } catch (e) { /* ignore */ }

          conversationHistory.push({
            role: 'agent',
            name: respondingAgent.name,
            agentId: respondingAgent.id,
            content: agentResponse
          })
          totalMessages++
          agentSpeakCount[respondingAgent.id]++

          console.log(`[Agent] ${respondingAgent.name}: ${agentResponse.slice(0, 50)}...`)
        }

        await supabase.from('chat_participants').update({ is_typing: false }).eq('room_id', roomId).eq('agent_id', respondingAgent.id)
        await new Promise(resolve => setTimeout(resolve, 150))
      }

      // --- 3. 자유 토론 (다른 에이전트들 추가 반응, 선택적) ---
      // 질문 모드일 때만 다른 에이전트들도 반응할 수 있게
      if (facilitatorRole === 'ask' && nonFacilitatorAgents.length > 1) {
        const otherAgents = nonFacilitatorAgents.filter(a => a.id !== agentToAsk.id)
        // 50% 확률로 한 명이 추가 반응
        if (Math.random() > 0.5 && otherAgents.length > 0) {
          const reactor = otherAgents[Math.floor(Math.random() * otherAgents.length)]

          await supabase.from('chat_participants').update({ is_typing: true }).eq('room_id', roomId).eq('agent_id', reactor.id)

          const latestHistory = conversationHistory.slice(-6)
          const latestHistoryText = latestHistory.map(h => `[${h.name}]: ${h.content}`).join('\n\n')

          const reactorPrompt = `${latestHistoryText}

---
${reactor.name}${topicInstruction}

${agentToAsk.name}님 의견에 반응해. 동의/반박/추가 뭐든.`

          let reactorResponse = await generateSingleAgentResponse(supabase, reactor, reactorPrompt, roomContext, images, userId)

          if (reactorResponse) {
            reactorResponse = cleanAgentResponse(reactorResponse, uniqueAgents)

            await supabase.from('chat_messages').insert({
              room_id: roomId,
              sender_type: 'agent',
              sender_agent_id: reactor.id,
              message_type: 'text',
              content: reactorResponse,
              is_ai_response: true,
              metadata: { agent_name: reactor.name, is_reaction: true },
            })

            conversationHistory.push({
              role: 'agent',
              name: reactor.name,
              agentId: reactor.id,
              content: reactorResponse
            })
            totalMessages++
            agentSpeakCount[reactor.id]++

            console.log(`[Reactor] ${reactor.name}: ${reactorResponse.slice(0, 50)}...`)
          }

          await supabase.from('chat_participants').update({ is_typing: false }).eq('room_id', roomId).eq('agent_id', reactor.id)
        }
      }

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

        // 마지막 발언자 정보 (직전 발언 인용용)
        const lastMessage = filteredHistory.length > 0 ? filteredHistory[filteredHistory.length - 1] : null
        const lastSpeaker = lastMessage?.name || '사용자'
        const lastSpeakerContent = lastMessage?.content || ''

        // 🔥 회의 설정 기반 지시사항
        const purposeInstructions: Record<string, string> = {
          strategic_decision: '🎯 전략적 관점에서 최적의 방향을 찾아야 합니다. 장기적 영향, 리소스, 경쟁우위를 고려하세요.',
          problem_analysis: '🔍 문제의 근본 원인을 파악하세요. "왜?"를 반복해서 물어보고 체계적으로 분석하세요.',
          action_planning: '📋 실행 가능한 계획을 세우세요. 담당자, 일정, 필요 리소스를 구체적으로 말하세요.',
          idea_expansion: '💡 창의적으로 생각하세요. 비판은 나중에! 일단 아이디어를 많이 던지세요.',
          risk_validation: '⚠️ 위험요소와 대응책을 점검하세요. "이게 실패하면?", "최악의 경우는?"',
        }

        const modeInstructions: Record<string, string> = {
          quick: '빠르게 핵심만! 긴 설명 NO, 결론 위주로.',
          balanced: '찬반 양쪽을 균형있게 검토하세요.',
          deep: '깊이 있게 분석하세요. 근거와 데이터를 들어 말하세요.',
          brainstorm: '아이디어 자유롭게! 평가/비판은 나중에. "이건 어때?" 식으로.',
        }

        const debateInstruction = meetingConfig?.allowDebate
          ? '💬 다른 의견에 동의하지 않으면 솔직하게 반박해도 됩니다.'
          : ''

        // 🕐 시간 상태 가져오기
        const timeStatus = await getTimeStatus()
        console.log(`[Relay] Time status: ${timeStatus.phase}, remaining: ${timeStatus.remainingSeconds}s (${timeStatus.remainingPercent?.toFixed(0)}%)`)

        // 시간 기반 추가 지시사항
        let timeInstruction = ''
        if (timeStatus.hint) {
          timeInstruction = `\n${timeStatus.hint}`
        }

        // 시간 부족 시 결론 유도 지시사항
        let conclusionPush = ''
        if (timeStatus.shouldPushConclusion) {
          conclusionPush = '\n🏁 시간이 촉박해! 지금까지 나온 의견 정리하거나, 결론/결정을 제안해.'
        }

        // 시간 연장 요청 가능 여부
        let extensionHint = ''
        if (timeStatus.canRequestExtension && timeStatus.phase === 'urgent') {
          extensionHint = '\n💬 시간이 더 필요하면 방장에게 "시간 좀 더 주세요", "5분만 연장해주세요" 같이 요청할 수 있어.'
        }

        // 에이전트별 역할 설정
        const agentRole = meetingConfig?.agentConfigs?.find(c => c.id === agent.id)
        const roleInstructions: Record<string, string> = {
          strategist: '당신은 전략가입니다. 최종 방향을 제안하세요.',
          analyst: '당신은 분석가입니다. 데이터와 근거로 검증하세요.',
          executor: '당신은 실행가입니다. 실행 가능성을 평가하세요.',
          critic: '당신은 반대자입니다. 허점과 리스크를 지적하세요.',
          mediator: '당신은 중재자입니다. 의견을 조율하고 정리하세요.',
        }

        const configInstruction = [
          meetingConfig?.purpose ? purposeInstructions[meetingConfig.purpose] : '',
          meetingConfig?.discussionMode ? modeInstructions[meetingConfig.discussionMode] : '',
          debateInstruction,
          agentRole?.role ? roleInstructions[agentRole.role] : '',
        ].filter(Boolean).join('\n')

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

        // 🔥 인사 단계 최소화: round 0에서 첫 에이전트만 인사 + 바로 본론
        const isFirstGreeting = round === 0 && agentIndex === 0  // 첫 에이전트만 인사
        const isSmallTalk = false  // 스몰토크 스킵
        // 진행자가 있으면 진행자가 회의 시작, 없으면 첫 번째 에이전트
        const isMeetingStart = round === 0 && agentIndex > 0  // 나머지는 바로 본론
        const isDiscussion = round >= 1  // round 1부터 본격 토론

        let contextMessage: string

        if (isFirstGreeting) {
          // Phase 0: 첫 에이전트만 간단 인사 + 본론 시작
          contextMessage = `회의실 입장. 참여자: ${uniqueAgents.map(a => a.name).join(', ')}
당신: ${agent.name}${topicInstruction}

한 문장으로 인사하고 바로 주제에 대한 첫 의견을 말해.`

        } else if (isSmallTalk) {
          // 스킵됨
          contextMessage = ''

        } else if (isMeetingStart) {
          // 나머지 에이전트: 바로 본론
          contextMessage = `${historyText}

---
당신: ${agent.name}${topicInstruction}

주제에 대한 의견을 바로 말해. 인사 불필요.`

        } else {
          // Phase 3+: 본격 토론 (구조화된 회의 모드)

          // 🔥 현재 단계 계산 (5단계 턴 구조)
          const currentStep = roundToStep(round, uniqueAgents.length)
          const stepHint = getStepHint(currentStep, isFacilitator)

          // 🔥 에이전트 역할 설정
          const agentConfig = meetingConfig?.agentConfigs?.find(c => c.id === agent.id)
          const agentRoleType = agentConfig?.role as 'strategist' | 'analyst' | 'executor' | 'critic' | 'mediator' | undefined

          // 🔥 회의 컨텍스트 구성
          const meetingCtx: MeetingContext = {
            meetingTitle: roomContext.meetingTopic || roomContext.roomName,
            decisionStatement: meetingConfig?.decisionStatement,
            successCriteria: meetingConfig?.successCriteria,
            optionsPool: meetingConfig?.optionsPool,
            decisionCriteria: meetingConfig?.decisionCriteria,
            constraints: meetingConfig?.constraints,
            currentTruths: meetingConfig?.currentTruths,
            definitions: meetingConfig?.definitions,
            meetingConfig,
            currentStep,
            roundNumber: round,
          }

          // 🔥 마스터 프롬프트 생성 (회의 전체 컨텍스트)
          const masterPrompt = meetingConfig?.decisionStatement
            ? generateMasterPrompt(meetingCtx)
            : '' // decisionStatement 없으면 기존 방식

          // 🔥 에이전트 시스템 프롬프트 생성
          const agentPromptCtx: AgentPromptContext = {
            agentName: agent.name,
            agentRole: agentRoleType,
            agentTendency: agentConfig?.tendency as 'aggressive' | 'conservative' | 'creative' | 'data-driven' | undefined,
            customMission: agentConfig?.customMission,
            customKpis: agentConfig?.customKpis,
            isFacilitator,
            currentStep,
            meetingContext: meetingCtx,
            conversationHistory: historyText,
            otherParticipants: uniqueAgents.filter(a => a.id !== agent.id).map(a => a.name),
            lastSpeaker: lastSpeaker !== agent.name ? lastSpeaker : undefined, // 자기 발언은 제외
            lastSpeakerContent: lastSpeaker !== agent.name ? lastSpeakerContent : undefined,
          }

          const agentSystemPrompt = generateAgentSystemPrompt(agentPromptCtx)

          // 🔥 시간 상태에 따른 단계 오버라이드
          let effectiveStep = currentStep
          if (timeStatus.phase === 'urgent' || timeStatus.phase === 'expired') {
            effectiveStep = 5 // 강제로 결정 단계
          } else if (timeStatus.phase === 'closing') {
            effectiveStep = Math.max(currentStep, 4) // 최소 수렴 단계
          }

          const effectiveStepHint = getStepHint(effectiveStep, isFacilitator)

          if (isFacilitator) {
            // 진행자 프롬프트 (구조화)
            let facilitatorStepInstruction = ''
            if (effectiveStep === 1) {
              facilitatorStepInstruction = '지금은 컨텍스트 정렬 단계. "~로 이해하고 가면 될까요?" 식으로 확인.'
            } else if (effectiveStep === 2) {
              facilitatorStepInstruction = '옵션 수집 단계. 참여자들에게 옵션을 물어보고 정리해.'
            } else if (effectiveStep === 3) {
              facilitatorStepInstruction = '리스크 점검 단계. "이게 안 되면?" 식으로 허점을 찾아.'
            } else if (effectiveStep === 4) {
              facilitatorStepInstruction = '수렴 단계. "정리하면 ~로 가는 게 맞죠?" 식으로 압축해.'
            } else {
              facilitatorStepInstruction = '결정 단계. 최종 결정 + 태스크 배분. "결정: ~. 태스크: 1) 2) 3)"'
            }

            contextMessage = `${masterPrompt ? `${masterPrompt}\n\n---\n` : ''}[대화 기록]
${historyText}

---
${agentSystemPrompt}
${configInstruction ? `\n${configInstruction}` : ''}

[현재 단계: ${effectiveStep}]
${facilitatorStepInstruction}
${timeStatus.hint ? `\n⏰ ${timeStatus.hint}` : ''}

[발언 형식]
(위의 [대화 규칙]을 엄격히 준수할 것)`
          } else {
            // 일반 참여자 프롬프트 (구조화)
            const facilitatorNote = facilitatorName ? `\n(👑 진행자: ${facilitatorName})` : ''

            contextMessage = `${masterPrompt ? `${masterPrompt}\n\n---\n` : ''}[대화 기록]
${historyText}

---
${agentSystemPrompt}${facilitatorNote}
${configInstruction ? `\n${configInstruction}` : ''}

[현재 단계: ${effectiveStep}. ${effectiveStepHint}]
${timeStatus.hint ? `⏰ ${timeStatus.hint}` : ''}

[발언 형식]
(위의 [대화 규칙]을 엄격히 준수할 것)`
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

      // 다음 응답 전 딜레이 (속도 최적화: 0.8s → 0.2s)
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)

  // 🔥 대화 종료 이유 상세 로그
  let endReason = 'normal'
  if (Date.now() - startTime > maxTimeMs) {
    endReason = `time_limit (${maxTimeMs / 1000}s exceeded)`
  } else if (totalMessages >= maxTotalMessages) {
    endReason = `max_messages (${maxTotalMessages} reached)`
  }

  console.log(`[Relay] Conversation completed:
    - Messages: ${totalMessages}/${maxTotalMessages}
    - Time: ${elapsedSeconds}s/${maxTimeMs / 1000}s
    - Rounds: started from ${startingRound}, max ${maxRounds}
    - Mode: ${hasFacilitator ? 'facilitator' : (isMeetingMode ? 'meeting' : 'normal')}
    - End reason: ${endReason}`)
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

    // 🔥 공유 뷰어 상태 조회 (에이전트가 "실제로 보는" 자료)
    const { data: sharedViewer } = await supabase
      .from('shared_viewer_state')
      .select('*')
      .eq('room_id', roomId)
      .single()

    // 공유 자료 컨텍스트 준비
    let sharedContentImages: string[] = []
    let sharedContentContext = ''

    if (sharedViewer) {
      console.log(`[generateAgentResponse] 🖼️ 공유 자료 감지: ${sharedViewer.media_type} - ${sharedViewer.media_name}`)

      if (sharedViewer.media_type === 'image') {
        // 이미지: Vision 모델에 직접 전달
        sharedContentImages.push(sharedViewer.media_url)
        sharedContentContext = `
## 📎 현재 공유 중인 자료
- 파일명: ${sharedViewer.media_name}
- 유형: 이미지
- 줌: ${sharedViewer.zoom_level || 1}x

⚠️ 위 이미지가 현재 회의 참가자들에게 공유되고 있습니다.
이미지 내용을 분석하고 답변에 반영하세요.
답변 시 반드시 [Evidence: ${sharedViewer.media_name}] 형식으로 근거를 표기하세요.`
      } else if (sharedViewer.media_type === 'pdf') {
        // PDF: 현재 페이지 텍스트 추출 및 전달
        const currentPage = sharedViewer.current_page || 1
        let pdfPageText = ''

        // PDF 텍스트 추출 시도
        try {
          const pdfTextResponse = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/docs/${roomId}/pages/${currentPage}/text`
          )
          if (pdfTextResponse.ok) {
            const pdfTextData = await pdfTextResponse.json()
            pdfPageText = pdfTextData.text || ''
            console.log(`[generateAgentResponse] 📄 PDF p.${currentPage} 텍스트 추출 완료 (${pdfPageText.length}자)`)
          }
        } catch (pdfError) {
          console.warn('[generateAgentResponse] PDF 텍스트 추출 실패:', pdfError)
        }

        sharedContentContext = `
## 📎 현재 공유 중인 PDF 문서
- 파일명: ${sharedViewer.media_name}
- 현재 페이지: ${currentPage} / ${sharedViewer.total_pages || '?'}
- 줌: ${sharedViewer.zoom_level || 1}x

${pdfPageText ? `### 현재 페이지(p.${currentPage}) 내용:
---
${pdfPageText.slice(0, 3000)}${pdfPageText.length > 3000 ? '\n... (이하 생략)' : ''}
---` : '(페이지 텍스트를 추출할 수 없습니다)'}

⚠️ 위 PDF가 현재 회의 참가자들에게 공유되고 있습니다.
현재 페이지(p.${currentPage})를 기준으로 답변하세요.
답변 시 반드시 [Evidence: ${sharedViewer.media_name} p.${currentPage} "인용문"] 형식으로 근거를 표기하세요.
근거 없이 "봤다/확인했다" 표현 금지!`
      } else if (sharedViewer.media_type === 'video') {
        // 비디오: 현재 타임스탬프 정보 전달
        const currentTime = sharedViewer.playback_time || 0
        const formattedTime = `${Math.floor(currentTime / 60)}:${String(Math.floor(currentTime % 60)).padStart(2, '0')}`
        sharedContentContext = `
## 📎 현재 공유 중인 비디오
- 파일명: ${sharedViewer.media_name}
- 현재 재생 위치: ${formattedTime} (${currentTime}초)
- 총 길이: ${sharedViewer.duration || '?'}초
- 재생 상태: ${sharedViewer.is_playing ? '재생 중' : '일시정지'}
- URL: ${sharedViewer.media_url}

⚠️ 위 비디오가 현재 회의 참가자들에게 공유되고 있습니다.
현재 재생 위치(${formattedTime})를 기준으로 답변하세요.
답변 시 반드시 [Evidence: ${sharedViewer.media_name} ${formattedTime}] 형식으로 근거를 표기하세요.
근거 없이 "봤다/확인했다" 표현 금지!`
      }

      // 🔥 Selection 정보 추가 (v2)
      if (sharedViewer.selection) {
        const sel = sharedViewer.selection as any
        if (sel.type === 'text' && sel.text) {
          sharedContentContext += `

### 🎯 현재 선택된 텍스트
\`\`\`
${sel.text}
\`\`\`
${sel.page ? `(p.${sel.page}에서 선택됨)` : ''}

위 선택된 텍스트에 대해 답변할 때 반드시 이 내용을 참조하세요.`
        } else if (sel.type === 'region' && sel.region) {
          sharedContentContext += `

### 🎯 현재 선택된 영역
- 위치: (${Math.round(sel.region.x * 100)}%, ${Math.round(sel.region.y * 100)}%)
- 크기: ${Math.round(sel.region.width * 100)}% x ${Math.round(sel.region.height * 100)}%
${sel.page ? `- 페이지: p.${sel.page}` : ''}

사용자가 이 영역을 지목하고 있습니다. 해당 영역의 내용에 대해 답변하세요.`
        }
      }

      // 하이라이트 정보 추가
      if (sharedViewer.highlight_regions && (sharedViewer.highlight_regions as any[]).length > 0) {
        const highlights = sharedViewer.highlight_regions as any[]
        sharedContentContext += `

### 📌 하이라이트된 영역 (${highlights.length}개)
${highlights.map((h, i) => `${i + 1}. ${h.label || '영역'} ${h.page ? `(p.${h.page})` : ''}`).join('\n')}`
      }

      // 주석 정보 추가
      if (sharedViewer.annotations && (sharedViewer.annotations as any[]).length > 0) {
        const notes = (sharedViewer.annotations as any[]).filter(a => a.type === 'note' && a.text)
        if (notes.length > 0) {
          sharedContentContext += `

### 📝 참가자 메모
${notes.map((n, i) => `${i + 1}. "${n.text}" ${n.page ? `(p.${n.page})` : ''}`).join('\n')}`
        }
      }
    }

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

    // 🔥 공유 자료 컨텍스트 추가 (에이전트가 "실제로 보는" 자료)
    if (sharedContentContext) {
      enhancedSystemPrompt += `\n\n${sharedContentContext}`
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

    // 에이전트 설정 (블록 외부에서 선언)
    const agentWithConfig = {
      ...agent,
      system_prompt: enhancedSystemPrompt,
      apiKey: userApiKey, // 🔥 사용자 API 키 주입
    }

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

      console.log(`[generateAgentResponse] LangChain 응답 생성 시작, ${agent.name} using ${agent.llm_provider || 'ollama'}/${agent.model || 'qwen2.5:3b'}`)
      console.log(`[generateAgentResponse] 🖼️ 공유 이미지 ${sharedContentImages.length}개 전달`)
      response = await generateAgentChatResponse(
        agentWithConfig,
        userMessage.content,
        recentMessages?.reverse() || [],
        {
          roomName: room?.name || '채팅방',
          roomType: room?.type,
          participantNames,
        },
        sharedContentImages  // 🔥 공유 자료 이미지 전달 (Vision 모델 자동 전환)
      )
      console.log('[generateAgentResponse] LangChain 응답 생성 완료:', response?.slice(0, 100))
    }

    // 🔥 Evidence 검증 (공유 자료가 있을 때만)
    if (sharedViewer && response) {
      const sharedContentInfo: SharedContentInfo = {
        mediaType: sharedViewer.media_type as 'pdf' | 'image' | 'video' | null,
        mediaName: sharedViewer.media_name,
        currentPage: sharedViewer.current_page,
        playbackTime: sharedViewer.playback_time,
        // Selection 정보 (v2)
        selection: sharedViewer.selection || null,
        annotations: sharedViewer.annotations || [],
        highlightRegions: sharedViewer.highlight_regions || [],
      }

      const validationResult = validateEvidence(response, sharedContentInfo)
      console.log(`[generateAgentResponse] 🔍 Evidence 검증 결과:`, validationResult)

      // 검증 실패 시 재생성 (최대 2회)
      if (!validationResult.valid && validationResult.action === 'regenerate') {
        console.log(`[generateAgentResponse] ⚠️ Evidence 검증 실패, 재생성 시도`)

        for (let retry = 0; retry < 2; retry++) {
          const correctionPrompt = getRegenerationPrompt(validationResult, sharedContentInfo)
          const retryMessage = `${userMessage.content}\n\n${correctionPrompt}`

          response = await generateAgentChatResponse(
            agentWithConfig,
            retryMessage,
            recentMessages?.reverse() || [],
            {
              roomName: room?.name || '채팅방',
              roomType: room?.type,
              participantNames,
            },
            sharedContentImages
          )

          const retryValidation = validateEvidence(response, sharedContentInfo)
          console.log(`[generateAgentResponse] 🔄 재생성 ${retry + 1}회 결과:`, retryValidation)

          if (retryValidation.valid) {
            console.log(`[generateAgentResponse] ✅ 재생성 성공`)
            break
          }

          if (retry === 1) {
            console.log(`[generateAgentResponse] ❌ 재생성 실패, 경고 메시지 추가`)
            response = `${response}\n\n⚠️ 참고: 위 내용에는 구체적인 근거 표기가 누락되었을 수 있습니다. 정확한 확인을 위해 공유된 자료를 직접 확인해주세요.`
          }
        }
      }

      // Evidence 태그 파싱 및 메타데이터에 저장
      const parsedEvidence = parseEvidenceTags(response)
      if (parsedEvidence.length > 0) {
        console.log(`[generateAgentResponse] 📎 Evidence 태그 ${parsedEvidence.length}개 발견:`, parsedEvidence.map(e => e.docName))
      }
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
        // 🔥 공유 자료 컨텍스트 기록
        shared_content: sharedViewer ? {
          type: sharedViewer.media_type,
          name: sharedViewer.media_name,
          page: sharedViewer.current_page,
          timestamp: sharedViewer.playback_time,
        } : null,
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
