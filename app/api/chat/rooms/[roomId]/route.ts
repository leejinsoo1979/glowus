import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: 채팅방 상세 정보
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

    // 채팅방 정보 조회
    const { data: room, error } = await supabase
      .from('chat_rooms')
      .select(`
        *,
        participants:chat_participants(
          *,
          user:user_id(id, name, email, avatar_url),
          agent:agent_id(id, name, description, capabilities, status)
        )
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

    return NextResponse.json(room)
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
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = params
    const body = await request.json()
    const { name, is_meeting_active, meeting_topic } = body

    // 채팅방 소유자인지 확인
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('created_by')
      .eq('id', roomId)
      .single()

    if (!room || room.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: updatedRoom, error } = await supabase
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
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = params

    // 채팅방 소유자인지 확인
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('created_by')
      .eq('id', roomId)
      .single()

    if (!room || room.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
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
