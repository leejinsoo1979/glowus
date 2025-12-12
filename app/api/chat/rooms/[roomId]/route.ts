import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDevUserIfEnabled } from '@/lib/dev-user'

// GET: 채팅방 상세 정보
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

    const { roomId } = params

    // 채팅방 정보 조회
    const { data: room, error } = await (adminClient as any)
      .from('chat_rooms')
      .select(`
        *,
        participants:chat_participants(*)
      `)
      .eq('id', roomId)
      .single()

    if (error) {
      console.error('Failed to fetch room:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 참여자인지 확인
    const isParticipant = room.participants?.some(
      (p: any) => p.user_id === user.id
    )

    if (!isParticipant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 참여자의 user/agent 정보 조회
    const userIds = room.participants?.filter((p: any) => p.user_id).map((p: any) => p.user_id) || []
    const agentIds = room.participants?.filter((p: any) => p.agent_id).map((p: any) => p.agent_id) || []

    let usersMap: Record<string, any> = {}
    let agentsMap: Record<string, any> = {}

    if (userIds.length > 0) {
      const { data: users } = await (adminClient as any)
        .from('users')
        .select('id, name, avatar_url')
        .in('id', userIds)

      for (const u of users || []) {
        usersMap[u.id] = u
      }
    }

    if (agentIds.length > 0) {
      const { data: agents } = await (adminClient as any)
        .from('deployed_agents')
        .select('id, name, description')
        .in('id', agentIds)

      for (const a of agents || []) {
        agentsMap[a.id] = a
      }
    }

    // 참여자에 user/agent 정보 추가
    const participantsWithDetails = (room.participants || []).map((p: any) => ({
      ...p,
      user: p.user_id ? usersMap[p.user_id] : null,
      agent: p.agent_id ? agentsMap[p.agent_id] : null,
    }))

    return NextResponse.json({
      ...room,
      participants: participantsWithDetails,
    })
  } catch (error) {
    console.error('Room detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: 채팅방 정보 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const supabase = createClient()
    const adminClient = createAdminClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = params
    const body = await request.json()
    const { name, is_meeting_active, meeting_topic } = body

    // 채팅방 소유자인지 확인
    const { data: room } = await (adminClient as any)
      .from('chat_rooms')
      .select('created_by')
      .eq('id', roomId)
      .single()

    if (!room || room.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: updatedRoom, error } = await (adminClient as any)
      .from('chat_rooms')
      .update({
        name,
        is_meeting_active,
        meeting_topic,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roomId)
      .select()
      .single()

    if (error) {
      console.error('Failed to update room:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(updatedRoom)
  } catch (error) {
    console.error('Update room error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: 채팅방 삭제
export async function DELETE(
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

    const { roomId } = params

    // 채팅방 소유자인지 확인
    const { data: room } = await (adminClient as any)
      .from('chat_rooms')
      .select('created_by')
      .eq('id', roomId)
      .single()

    if (!room || room.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await (adminClient as any)
      .from('chat_rooms')
      .delete()
      .eq('id', roomId)

    if (error) {
      console.error('Failed to delete room:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete room error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
