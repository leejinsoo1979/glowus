import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreateRoomRequest } from '@/types/chat'

// GET: 내가 참여한 채팅방 목록
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 내가 참여한 채팅방 조회
    const { data: rooms, error } = await supabase
      .from('chat_rooms')
      .select(`
        *,
        participants:chat_participants(
          *,
          user:user_id(id, name, email, avatar_url),
          agent:agent_id(id, name, description, capabilities, status)
        )
      `)
      .order('last_message_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch rooms:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 각 방의 마지막 메시지와 안읽은 메시지 수 조회
    const roomsWithDetails = await Promise.all(
      (rooms || []).map(async (room) => {
        // 마지막 메시지
        const { data: lastMessage } = await supabase
          .from('chat_messages')
          .select(`
            *,
            sender_user:sender_user_id(id, name, avatar_url),
            sender_agent:sender_agent_id(id, name)
          `)
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
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', room.id)
            .gt('created_at', participant.last_read_at)
            .neq('sender_user_id', user.id)

          unreadCount = count || 0
        }

        return {
          ...room,
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
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateRoomRequest = await request.json()
    const { name, type, team_id, participant_ids } = body

    // 1:1 채팅인 경우 기존 방이 있는지 확인
    if (type === 'direct' && participant_ids.length === 1) {
      const otherParticipant = participant_ids[0]

      // 기존 1:1 채팅방 찾기
      const { data: existingRooms } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          participants:chat_participants(*)
        `)
        .eq('type', 'direct')

      const existingRoom = existingRooms?.find((room) => {
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

    // 새 채팅방 생성
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .insert({
        name: name || null,
        type,
        team_id: team_id || null,
        created_by: user.id,
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

    const { error: participantError } = await supabase
      .from('chat_participants')
      .insert(participantsToInsert)

    if (participantError) {
      console.error('Failed to add participants:', participantError)
      // 방 삭제 (롤백)
      await supabase.from('chat_rooms').delete().eq('id', room.id)
      return NextResponse.json({ error: participantError.message }, { status: 500 })
    }

    // 시스템 메시지 추가
    await supabase.from('chat_messages').insert({
      room_id: room.id,
      sender_type: 'user',
      sender_user_id: user.id,
      message_type: 'system',
      content: type === 'meeting'
        ? '회의가 시작되었습니다.'
        : '채팅방이 생성되었습니다.',
    })

    // 생성된 방 정보 반환
    const { data: createdRoom } = await supabase
      .from('chat_rooms')
      .select(`
        *,
        participants:chat_participants(
          *,
          user:user_id(id, name, email, avatar_url),
          agent:agent_id(id, name, description, capabilities, status)
        )
      `)
      .eq('id', room.id)
      .single()

    return NextResponse.json(createdRoom, { status: 201 })
  } catch (error) {
    console.error('Create room error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
