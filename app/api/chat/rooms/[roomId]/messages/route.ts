import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SendMessageRequest } from '@/types/chat'
import { generateAgentChatResponse, generateAgentMeetingResponse } from '@/lib/langchain/agent-chat'

// GET: 메시지 목록 조회 (페이지네이션)
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const before = searchParams.get('before') // cursor for pagination

    // 참여자인지 확인
    const { data: participant } = await supabase
      .from('chat_participants')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .single()

    if (!participant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 메시지 조회
    let query = supabase
      .from('chat_messages')
      .select(`
        *,
        sender_user:sender_user_id(id, name, avatar_url),
        sender_agent:sender_agent_id(id, name),
        reply_to:reply_to_id(
          id,
          content,
          sender_user:sender_user_id(id, name),
          sender_agent:sender_agent_id(id, name)
        )
      `)
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

    // 읽음 처리 - last_read_at 업데이트
    await supabase
      .from('chat_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', user.id)

    // 역순으로 정렬하여 반환 (오래된 순)
    return NextResponse.json(messages?.reverse() || [])
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
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = params
    const body: SendMessageRequest = await request.json()
    const { content, message_type = 'text', metadata = {}, reply_to_id } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // 참여자인지 확인
    const { data: participant } = await supabase
      .from('chat_participants')
      .select('id, participant_type')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .single()

    if (!participant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 메시지 생성
    const { data: message, error } = await supabase
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
      .select(`
        *,
        sender_user:sender_user_id(id, name, avatar_url),
        sender_agent:sender_agent_id(id, name),
        reply_to:reply_to_id(
          id,
          content,
          sender_user:sender_user_id(id, name),
          sender_agent:sender_agent_id(id, name)
        )
      `)
      .single()

    if (error) {
      console.error('Failed to send message:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // AI 에이전트가 있는 방이면 자동 응답 트리거
    await triggerAgentResponse(supabase, roomId, message)

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('Send message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// AI 에이전트 자동 응답 트리거
async function triggerAgentResponse(
  supabase: any,
  roomId: string,
  userMessage: any
) {
  try {
    // 방에 참여한 에이전트 조회
    const { data: agents } = await supabase
      .from('chat_participants')
      .select(`
        agent:agent_id(
          id,
          name,
          description,
          capabilities,
          config
        )
      `)
      .eq('room_id', roomId)
      .eq('participant_type', 'agent')
      .not('agent_id', 'is', null)

    if (!agents || agents.length === 0) return

    // 각 에이전트에 대해 응답 생성 (비동기)
    for (const { agent } of agents) {
      if (!agent) continue

      // 백그라운드에서 AI 응답 생성 (non-blocking)
      generateAgentResponseHandler(supabase, roomId, agent, userMessage).catch((err) =>
        console.error(`Agent ${agent.id} response error:`, err)
      )
    }
  } catch (error) {
    console.error('Trigger agent response error:', error)
  }
}

// AI 에이전트 응답 생성
async function generateAgentResponseHandler(
  supabase: any,
  roomId: string,
  agent: any,
  userMessage: any
) {
  try {
    // 타이핑 상태 업데이트
    await supabase
      .from('chat_participants')
      .update({ is_typing: true })
      .eq('room_id', roomId)
      .eq('agent_id', agent.id)

    // 채팅방 정보 조회
    const { data: room } = await supabase
      .from('chat_rooms')
      .select(`
        name,
        type,
        is_meeting_active,
        meeting_topic,
        participants:chat_participants(
          user:user_id(name),
          agent:agent_id(name)
        )
      `)
      .eq('id', roomId)
      .single()

    // 최근 메시지 기록 조회
    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select(`
        content,
        sender_type,
        sender_user:sender_user_id(name),
        sender_agent:sender_agent_id(name)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(15)

    // 참여자 이름 추출
    const participantNames = room?.participants
      ?.map((p: any) => p.user?.name || p.agent?.name)
      .filter(Boolean) || []

    // LangChain을 사용한 응답 생성
    let response: string

    if (room?.is_meeting_active && room?.meeting_topic) {
      // 미팅 모드: 에이전트 간 토론
      const otherAgents = room.participants
        ?.filter((p: any) => p.agent && p.agent.id !== agent.id)
        .map((p: any) => ({ name: p.agent.name, role: 'AI 에이전트' })) || []

      response = await generateAgentMeetingResponse(
        agent,
        room.meeting_topic,
        recentMessages?.reverse() || [],
        otherAgents
      )
    } else {
      // 일반 채팅 모드
      response = await generateAgentChatResponse(
        agent,
        userMessage.content,
        recentMessages?.reverse() || [],
        {
          roomName: room?.name || '채팅방',
          roomType: room?.type,
          participantNames,
        }
      )
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
        model: agent.config?.llm_model || 'gpt-4',
        provider: agent.config?.llm_provider || 'openai',
        agent_name: agent.name,
      },
    })
  } catch (error) {
    console.error(`Agent ${agent.id} response generation failed:`, error)

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
