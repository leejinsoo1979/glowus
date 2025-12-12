import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDevUserIfEnabled } from '@/lib/dev-user'

// GET: 회의록 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const adminClient = createAdminClient()

    const devUser = getDevUserIfEnabled()
    let user: any = devUser

    if (!devUser) {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = authUser
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('room_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // 사용자가 참여한 채팅방 ID 목록 가져오기
    const { data: participantRooms, error: participantError } = await (adminClient as any)
      .from('chat_participants')
      .select('room_id')
      .eq('user_id', user.id)

    if (participantError) {
      console.error('[Meetings API] Participant query error:', participantError)
      return NextResponse.json({ error: participantError.message }, { status: 500 })
    }

    const roomIds = participantRooms?.map((p: any) => p.room_id) || []

    if (roomIds.length === 0) {
      return NextResponse.json([])
    }

    // 회의록 조회 쿼리 작성
    let query = (adminClient as any)
      .from('meeting_records')
      .select('*')
      .in('room_id', roomIds)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // 특정 채팅방 필터
    if (roomId) {
      query = query.eq('room_id', roomId)
    }

    const { data: meetings, error } = await query

    if (error) {
      console.error('[Meetings API] Query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(meetings || [])
  } catch (error) {
    console.error('[Meetings API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 회의 종료 시 회의록 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const adminClient = createAdminClient()

    const devUser = getDevUserIfEnabled()
    let user: any = devUser

    if (!devUser) {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = authUser
    }

    const body = await request.json()
    const { room_id } = body

    if (!room_id) {
      return NextResponse.json({ error: 'room_id is required' }, { status: 400 })
    }

    // 채팅방 정보 조회
    const { data: room, error: roomError } = await (adminClient as any)
      .from('chat_rooms')
      .select('*')
      .eq('id', room_id)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // 회의 시작 시간부터 지금까지의 메시지 수 조회
    const meetingStartedAt = room.meeting_started_at || new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { data: messages, error: msgError } = await (adminClient as any)
      .from('chat_messages')
      .select('id, sender_type')
      .eq('room_id', room_id)
      .gte('created_at', meetingStartedAt)

    const messageCount = messages?.length || 0
    const agentMessages = messages?.filter((m: any) => m.sender_type === 'agent')?.length || 0

    // 참여자 수 조회
    const { data: participants, error: partError } = await (adminClient as any)
      .from('chat_participants')
      .select('id, participant_type')
      .eq('room_id', room_id)

    const participantCount = participants?.filter((p: any) => p.participant_type === 'user')?.length || 0
    const agentCount = participants?.filter((p: any) => p.participant_type === 'agent')?.length || 0

    // 회의 시간 계산
    const startedAt = new Date(meetingStartedAt)
    const endedAt = new Date()
    const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / (1000 * 60))

    // 회의록 생성
    const { data: record, error: insertError } = await (adminClient as any)
      .from('meeting_records')
      .insert({
        room_id: room_id,
        room_name: room.name,
        topic: room.meeting_topic || '자유 토론',
        started_at: meetingStartedAt,
        ended_at: endedAt.toISOString(),
        duration_minutes: durationMinutes,
        participant_count: participantCount,
        agent_count: agentCount,
        message_count: messageCount,
        facilitator_id: room.meeting_facilitator_id,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Meetings API] Insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    console.log(`[Meetings API] Created meeting record: ${record.id}`)

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('[Meetings API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
