import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDevUserIfEnabled } from '@/lib/dev-user'

// GET: 회의 상태 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
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

    const { roomId } = params

    const { data: room, error } = await (adminClient as any)
      .from('chat_rooms')
      .select('is_meeting_active, meeting_topic, meeting_duration_minutes, meeting_started_at, meeting_end_time, meeting_facilitator_id')
      .eq('id', roomId)
      .single()

    if (error) {
      console.error(`[Meeting API] GET error:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[Meeting API] GET room - facilitator_id: ${room?.meeting_facilitator_id}`)

    // 남은 시간 계산
    let remainingSeconds = null
    if (room.is_meeting_active && room.meeting_end_time) {
      const endTime = new Date(room.meeting_end_time).getTime()
      const now = Date.now()
      remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000))
    }

    return NextResponse.json({
      ...room,
      remaining_seconds: remainingSeconds,
    })
  } catch (error) {
    console.error('Meeting status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 회의 시작
export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
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

    const { roomId } = params
    const body = await request.json()
    const { topic, duration_minutes = 30, facilitator_id = null } = body

    console.log(`[Meeting API] Starting meeting - facilitator_id: ${facilitator_id}`)

    const now = new Date()
    const endTime = new Date(now.getTime() + duration_minutes * 60 * 1000)

    const { data, error } = await (adminClient as any)
      .from('chat_rooms')
      .update({
        is_meeting_active: true,
        meeting_topic: topic || '자유 토론',
        meeting_duration_minutes: duration_minutes,
        meeting_started_at: now.toISOString(),
        meeting_end_time: endTime.toISOString(),
        meeting_facilitator_id: facilitator_id,
      })
      .eq('id', roomId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[Meeting] Started in room ${roomId} for ${duration_minutes} minutes`)

    return NextResponse.json({
      ...data,
      message: '회의가 시작되었습니다',
    })
  } catch (error) {
    console.error('Meeting start error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: 회의 종료 및 회의록 자동 생성
export async function DELETE(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
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

    const { roomId } = params

    // 현재 회의 정보 조회 (회의록 생성용)
    const { data: roomBefore } = await (adminClient as any)
      .from('chat_rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    // 회의록 생성 (회의가 활성화 상태였다면)
    let meetingRecord = null
    if (roomBefore?.is_meeting_active && roomBefore?.meeting_started_at) {
      const meetingStartedAt = roomBefore.meeting_started_at
      const endedAt = new Date()

      // 회의 시간 동안의 메시지 수 조회
      const { data: messages } = await (adminClient as any)
        .from('chat_messages')
        .select('id, sender_type')
        .eq('room_id', roomId)
        .gte('created_at', meetingStartedAt)

      const messageCount = messages?.length || 0

      // 참여자 수 조회
      const { data: participants } = await (adminClient as any)
        .from('chat_participants')
        .select('id, participant_type')
        .eq('room_id', roomId)

      const participantCount = participants?.filter((p: any) => p.participant_type === 'user')?.length || 0
      const agentCount = participants?.filter((p: any) => p.participant_type === 'agent')?.length || 0

      // 회의 시간 계산
      const startedAt = new Date(meetingStartedAt)
      const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / (1000 * 60))

      // 회의록 생성
      const { data: record, error: recordError } = await (adminClient as any)
        .from('meeting_records')
        .insert({
          room_id: roomId,
          room_name: roomBefore.name,
          topic: roomBefore.meeting_topic || '자유 토론',
          started_at: meetingStartedAt,
          ended_at: endedAt.toISOString(),
          duration_minutes: durationMinutes,
          participant_count: participantCount,
          agent_count: agentCount,
          message_count: messageCount,
          facilitator_id: roomBefore.meeting_facilitator_id,
          created_by: user.id,
        })
        .select()
        .single()

      if (!recordError && record) {
        meetingRecord = record
        console.log(`[Meeting] Created meeting record: ${record.id}`)
      } else if (recordError) {
        console.error(`[Meeting] Failed to create meeting record:`, recordError)
      }
    }

    // 회의 상태 초기화
    const { data, error } = await (adminClient as any)
      .from('chat_rooms')
      .update({
        is_meeting_active: false,
        meeting_started_at: null,
        meeting_end_time: null,
      })
      .eq('id', roomId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 모든 에이전트 타이핑 상태 해제
    await (adminClient as any)
      .from('chat_participants')
      .update({ is_typing: false })
      .eq('room_id', roomId)

    console.log(`[Meeting] Ended in room ${roomId}`)

    return NextResponse.json({
      ...data,
      message: '회의가 종료되었습니다',
      meeting_record: meetingRecord,
    })
  } catch (error) {
    console.error('Meeting end error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
