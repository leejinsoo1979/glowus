import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDevUserIfEnabled } from '@/lib/dev-user'
import { generateAgentChatResponse } from '@/lib/langchain/agent-chat'

// POST: 참여자 추가 (사용자 또는 에이전트 초대)
export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const supabase = createClient()
    const adminClient = createAdminClient()

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

    const { roomId } = params
    const body = await request.json()
    const { user_id, agent_id } = body

    if (!user_id && !agent_id) {
      return NextResponse.json({ error: 'user_id or agent_id required' }, { status: 400 })
    }

    // 현재 사용자가 채팅방 참여자인지 확인
    const { data: myParticipant } = await (adminClient as any)
      .from('chat_participants')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .single()

    if (!myParticipant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 이미 참여 중인지 확인
    let existingQuery = (adminClient as any)
      .from('chat_participants')
      .select('id')
      .eq('room_id', roomId)

    if (user_id) {
      existingQuery = existingQuery.eq('user_id', user_id)
    } else {
      existingQuery = existingQuery.eq('agent_id', agent_id)
    }

    const { data: existing } = await existingQuery.single()

    if (existing) {
      return NextResponse.json({ error: 'Already a participant' }, { status: 409 })
    }

    // 참여자 추가
    const newParticipant: any = {
      room_id: roomId,
      participant_type: user_id ? 'user' : 'agent',
    }

    if (user_id) {
      newParticipant.user_id = user_id
    } else {
      newParticipant.agent_id = agent_id
    }

    const { data: participant, error } = await (adminClient as any)
      .from('chat_participants')
      .insert(newParticipant)
      .select('*')
      .single()

    if (error) {
      console.error('Failed to add participant:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 에이전트 초대 시 에이전트 정보 조회 및 인사 메시지 생성
    if (agent_id) {
      const { data: agent } = await (adminClient as any)
        .from('deployed_agents')
        .select('*')
        .eq('id', agent_id)
        .single()

      if (agent) {
        // 시스템 메시지: 에이전트 입장
        await (adminClient as any)
          .from('chat_messages')
          .insert({
            room_id: roomId,
            sender_type: 'system',
            message_type: 'text',
            content: `${agent.name}이(가) 채팅방에 초대되었습니다.`,
            is_ai_response: false,
            metadata: { type: 'participant_joined', participant_id: participant.id },
          })

        // 채팅방 정보 조회
        const { data: room } = await (adminClient as any)
          .from('chat_rooms')
          .select('name, type')
          .eq('id', roomId)
          .single()

        // 기존 참여자 목록 조회
        const { data: participants } = await (adminClient as any)
          .from('chat_participants')
          .select('user_id, agent_id')
          .eq('room_id', roomId)

        const participantNames: string[] = []
        for (const p of participants || []) {
          if (p.user_id) {
            const { data: u } = await (adminClient as any)
              .from('users')
              .select('name')
              .eq('id', p.user_id)
              .single()
            if (u?.name) participantNames.push(u.name)
          } else if (p.agent_id && p.agent_id !== agent_id) {
            const { data: a } = await (adminClient as any)
              .from('deployed_agents')
              .select('name')
              .eq('id', p.agent_id)
              .single()
            if (a?.name) participantNames.push(a.name)
          }
        }

        // 에이전트 인사 메시지 생성 (백그라운드에서 비동기 처리)
        ;(async () => {
          try {
            const greeting = await generateAgentChatResponse(
              agent,
              `오! 방금 "${room?.name || '채팅방'}"에 초대받았어요! ${participantNames.length > 0 ? `${participantNames.join(', ')}님이랑 같이 있네요.` : ''}
편하게 인사하고 간단히 자기소개 해주세요. 너무 길지 않게, 1-2문장이면 충분해요! 자연스럽게요~`,
              [],
              {
                roomName: room?.name || '채팅방',
                roomType: room?.type || 'group',
                participantNames,
              }
            )

            await (adminClient as any)
              .from('chat_messages')
              .insert({
                room_id: roomId,
                sender_type: 'agent',
                sender_agent_id: agent.id,
                message_type: 'text',
                content: greeting,
                is_ai_response: true,
                metadata: { type: 'agent_greeting' },
              })

            // last_message_at 업데이트
            await (adminClient as any)
              .from('chat_rooms')
              .update({ last_message_at: new Date().toISOString() })
              .eq('id', roomId)
          } catch (err) {
            console.error('Agent greeting error:', err)
          }
        })()
      }
    } else {
      // 사용자 초대 시 시스템 메시지만
      await (adminClient as any)
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_type: 'system',
          message_type: 'text',
          content: `새 사용자가 채팅방에 초대되었습니다.`,
          is_ai_response: false,
          metadata: { type: 'participant_joined', participant_id: participant.id },
        })
    }

    return NextResponse.json(participant, { status: 201 })
  } catch (error) {
    console.error('Add participant error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: 채팅방 나가기
export async function DELETE(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const supabase = createClient()
    const adminClient = createAdminClient()

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

    const { roomId } = params
    const url = new URL(request.url)
    const participantId = url.searchParams.get('participant_id')

    // 특정 참여자 제거 (방장 권한) 또는 본인 나가기
    if (participantId) {
      // 방장인지 확인
      const { data: room } = await (adminClient as any)
        .from('chat_rooms')
        .select('created_by')
        .eq('id', roomId)
        .single()

      if (!room || room.created_by !== user.id) {
        return NextResponse.json({ error: 'Only room owner can remove participants' }, { status: 403 })
      }

      const { error } = await (adminClient as any)
        .from('chat_participants')
        .delete()
        .eq('id', participantId)
        .eq('room_id', roomId)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
      // 본인 나가기
      const { error } = await (adminClient as any)
        .from('chat_participants')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', user.id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // 시스템 메시지
      await (adminClient as any)
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_type: 'system',
          message_type: 'text',
          content: '사용자가 채팅방을 나갔습니다.',
          is_ai_response: false,
          metadata: { type: 'participant_left', user_id: user.id },
        })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Leave room error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
