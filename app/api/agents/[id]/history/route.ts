import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

// GET: 특정 에이전트와의 대화 기록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params
  const supabase = await createClient()
  const adminClient = createAdminClient()

  let user: any = isDevMode() ? DEV_USER : null
  if (!user) {
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 대화 세션 찾기
    const { data: conversation } = await (adminClient as any)
      .from('agent_conversations')
      .select('id')
      .eq('user_id', user.id)
      .eq('agent_id', agentId)
      .single()

    if (!conversation) {
      return NextResponse.json({ data: [] })
    }

    // 메시지 조회 (최근 100개)
    const { data: messages, error } = await (adminClient as any)
      .from('agent_chat_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) {
      console.error('Get messages error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: messages })
  } catch (error) {
    console.error('GET /api/agents/[id]/history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 메시지 저장
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params
  const supabase = await createClient()
  const adminClient = createAdminClient()

  let user: any = isDevMode() ? DEV_USER : null
  if (!user) {
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { role, content, image_url, emotion } = body

    if (!role || (!content && !image_url)) {
      return NextResponse.json({ error: 'role과 content 또는 image_url이 필요합니다' }, { status: 400 })
    }

    // 대화 세션 찾기 또는 생성
    let { data: conversation } = await (adminClient as any)
      .from('agent_conversations')
      .select('id')
      .eq('user_id', user.id)
      .eq('agent_id', agentId)
      .single()

    if (!conversation) {
      // 새 대화 세션 생성
      const { data: newConversation, error: createError } = await (adminClient as any)
        .from('agent_conversations')
        .insert({
          user_id: user.id,
          agent_id: agentId,
        })
        .select()
        .single()

      if (createError) {
        console.error('Create conversation error:', createError)
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }
      conversation = newConversation
    }

    // 메시지 저장
    const { data: message, error: messageError } = await (adminClient as any)
      .from('agent_chat_messages')
      .insert({
        conversation_id: conversation.id,
        role,
        content: content || '',
        image_url,
        emotion,
      })
      .select()
      .single()

    if (messageError) {
      console.error('Create message error:', messageError)
      return NextResponse.json({ error: messageError.message }, { status: 500 })
    }

    // 대화 세션 업데이트 (마지막 메시지 시간)
    await (adminClient as any)
      .from('agent_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id)

    return NextResponse.json({ data: message }, { status: 201 })
  } catch (error) {
    console.error('POST /api/agents/[id]/history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: 대화 기록 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params
  const supabase = await createClient()
  const adminClient = createAdminClient()

  let user: any = isDevMode() ? DEV_USER : null
  if (!user) {
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 대화 세션 삭제 (CASCADE로 메시지도 같이 삭제됨)
    const { error } = await (adminClient as any)
      .from('agent_conversations')
      .delete()
      .eq('user_id', user.id)
      .eq('agent_id', agentId)

    if (error) {
      console.error('Delete conversation error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/agents/[id]/history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
