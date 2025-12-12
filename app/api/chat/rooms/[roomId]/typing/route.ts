import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST: 타이핑 상태 업데이트
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
    const { is_typing } = await request.json()

    // 참여자 타이핑 상태 업데이트
    const { error } = await supabase
      .from('chat_participants')
      .update({ is_typing: !!is_typing })
      .eq('room_id', roomId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to update typing status:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Typing status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
