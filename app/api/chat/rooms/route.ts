export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateRoomRequest } from '@/types/chat'
import { getDevUserIfEnabled } from '@/lib/dev-user'

// GET: 내가 참여한 채팅방 목록
export async function GET(request: NextRequest) {
  console.log('[CHAT API] GET /api/chat/rooms 시작')
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    console.log('[CHAT API] Supabase client 생성됨')

    // DEV 바이패스 체크
    const devUser = getDevUserIfEnabled()
    let user: any = null

    if (devUser) {
      console.log('[CHAT API] DEV 바이패스 활성화:', devUser.id)
      user = devUser
    } else {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      console.log('[CHAT API] 인증 결과:', authUser?.id, authError?.message)
      if (authError || !authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = authUser
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 내가 참여한 채팅방 ID 먼저 조회 (adminClient로 RLS 우회)
    console.log('[CHAT API] chat_participants 조회 시작')
    const { data: myParticipations, error: partError } = await (adminClient as any)
      .from('chat_participants')
      .select('room_id')
      .eq('user_id', user.id)
    console.log('[CHAT API] chat_participants 결과:', myParticipations?.length, partError?.message)

    if (!myParticipations || myParticipations.length === 0) {
      console.log('[CHAT API] 참여 채팅방 없음, 빈 배열 반환')
      return NextResponse.json([])
    }

    const myRoomIds = myParticipations.map((p: any) => p.room_id)

    // 내가 참여한 채팅방 조회
    const { data: rooms, error } = await (adminClient as any)
      .from('chat_rooms')
      .select(`
        *,
        participants:chat_participants(*)
      `)
      .in('id', myRoomIds)
      .order('last_message_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch rooms:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 모든 참여자의 user_id와 agent_id 수집
    const allUserIds = new Set<string>()
    const allAgentIds = new Set<string>()

    for (const room of rooms || []) {
      for (const p of room.participants || []) {
        if (p.user_id) allUserIds.add(p.user_id)
        if (p.agent_id) allAgentIds.add(p.agent_id)
      }
    }

    // 사용자 정보 조회
    let usersMap: Record<string, any> = {}
    if (allUserIds.size > 0) {
      const { data: users } = await (adminClient as any)
        .from('users')
        .select('id, name, avatar_url')
        .in('id', Array.from(allUserIds))

      for (const u of users || []) {
        usersMap[u.id] = u
      }
    }

    // 에이전트 정보 조회
    let agentsMap: Record<string, any> = {}
    if (allAgentIds.size > 0) {
      const { data: agents } = await (adminClient as any)
        .from('deployed_agents')
        .select('id, name, description, llm_provider, model')
        .in('id', Array.from(allAgentIds))

      for (const a of agents || []) {
        agentsMap[a.id] = a
      }
    }

    // 각 방의 마지막 메시지와 안읽은 메시지 수 조회
    const roomsWithDetails = await Promise.all(
      (rooms || []).map(async (room: any) => {
        // 마지막 메시지
        const { data: lastMessage } = await (adminClient as any)
          .from('chat_messages')
          .select('*')
          .eq('room_id', room.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        // 안읽은 메시지 수
        const participant = room.participants?.find(
          (p: any) => p.user_id === user.id
        )

        let unreadCount = 0
        if (participant) {
          const { count } = await (adminClient as any)
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', room.id)
            .gt('created_at', participant.last_read_at || '1970-01-01')
            .neq('sender_user_id', user.id)

          unreadCount = count || 0
        }

        // 참여자에 user/agent 정보 추가
        const participantsWithDetails = (room.participants || []).map((p: any) => ({
          ...p,
          user: p.user_id ? usersMap[p.user_id] : null,
          agent: p.agent_id ? agentsMap[p.agent_id] : null,
        }))

        return {
          ...room,
          participants: participantsWithDetails,
          last_message: lastMessage,
          unread_count: unreadCount,
        }
      })
    )

    return NextResponse.json(roomsWithDetails)
  } catch (error) {
    console.error('Chat rooms error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 새 채팅방 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // DEV 바이패스 체크
    const devUser = getDevUserIfEnabled()
    let user: any = null

    if (devUser) {
      console.log('[CHAT API POST] DEV 바이패스 활성화:', devUser.id)
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

    const body: CreateRoomRequest = await request.json()
    const { name, type, team_id, category, attachments, participant_ids, meeting_config } = body

    // 1:1 채팅인 경우 기존 방이 있는지 확인
    if (type === 'direct' && participant_ids.length === 1) {
      const otherParticipant = participant_ids[0]

      // 기존 1:1 채팅방 찾기 (adminClient로 RLS 우회)
      const { data: existingRooms } = await (adminClient as any)
        .from('chat_rooms')
        .select(`
          *,
          participants:chat_participants(*)
        `)
        .eq('type', 'direct')

      const existingRoom = existingRooms?.find((room: any) => {
        const participants = room.participants || []
        if (participants.length !== 2) return false

        const hasMe = participants.some((p: any) => p.user_id === user.id)
        const hasOther = participants.some((p: any) =>
          otherParticipant.type === 'user'
            ? p.user_id === otherParticipant.id
            : p.agent_id === otherParticipant.id
        )

        return hasMe && hasOther
      })

      if (existingRoom) {
        return NextResponse.json(existingRoom)
      }
    }

    // 새 채팅방 생성 (adminClient로 RLS 우회)
    const { data: room, error: roomError } = await (adminClient as any)
      .from('chat_rooms')
      .insert({
        name: name || null,
        type,
        team_id: team_id || null,
        created_by: user.id,
        category: category || null,
        meeting_attachments: attachments && attachments.length > 0 ? attachments : null,
        meeting_config: meeting_config || null,  // 회의 설정 저장
      })
      .select()
      .single()

    if (roomError) {
      console.error('Failed to create room:', roomError)
      return NextResponse.json({ error: roomError.message }, { status: 500 })
    }

    // 참여자 추가 (나 포함)
    const participantsToInsert = [
      {
        room_id: room.id,
        participant_type: 'user' as const,
        user_id: user.id,
        agent_id: null,
      },
      ...participant_ids.map((p) => ({
        room_id: room.id,
        participant_type: p.type,
        user_id: p.type === 'user' ? p.id : null,
        agent_id: p.type === 'agent' ? p.id : null,
      })),
    ]

    const { error: participantError } = await (adminClient as any)
      .from('chat_participants')
      .insert(participantsToInsert)

    if (participantError) {
      console.error('Failed to add participants:', participantError)
      // 방 삭제 (롤백)
      await (adminClient as any).from('chat_rooms').delete().eq('id', room.id)
      return NextResponse.json({ error: participantError.message }, { status: 500 })
    }

    // 시스템 메시지 추가
    let systemContent = '채팅방이 생성되었습니다.'
    if (type === 'meeting') {
      systemContent = '회의가 시작되었습니다.'
      if (attachments && attachments.length > 0) {
        const attachmentNames = attachments.map(a => a.name).join(', ')
        systemContent += ` (첨부자료: ${attachmentNames})`
      }
    }

    await (adminClient as any).from('chat_messages').insert({
      room_id: room.id,
      sender_type: 'user',
      sender_user_id: user.id,
      message_type: 'system',
      content: systemContent,
    })

    // 생성된 방 정보 반환
    const { data: createdRoom } = await (adminClient as any)
      .from('chat_rooms')
      .select(`
        *,
        participants:chat_participants(*)
      `)
      .eq('id', room.id)
      .single()

    return NextResponse.json(createdRoom, { status: 201 })
  } catch (error) {
    console.error('Create room error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
