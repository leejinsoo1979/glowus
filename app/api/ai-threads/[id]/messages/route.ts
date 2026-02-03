import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST: 메시지 추가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 스레드 소유권 확인
    const { data: thread } = await supabase
      .from('ai_threads')
      .select('id, title')
      .eq('id', threadId)
      .eq('user_id', user.id)
      .single()

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    const body = await request.json()
    const { role, content, toolCalls, metadata = {} } = body

    // 메시지 추가
    const { data: message, error } = await supabase
      .from('ai_messages')
      .insert({
        thread_id: threadId,
        role,
        content,
        tool_calls: toolCalls,
        metadata,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create message:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 첫 번째 사용자 메시지면 스레드 제목 업데이트
    if (role === 'user' && thread.title === 'New Chat') {
      const newTitle = content.slice(0, 50) + (content.length > 50 ? '...' : '')
      await supabase
        .from('ai_threads')
        .update({ title: newTitle })
        .eq('id', threadId)
    }

    return NextResponse.json({ message })
  } catch (error: any) {
    console.error('AI message POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE: 스레드의 모든 메시지 삭제 (대화 초기화)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 스레드 소유권 확인
    const { data: thread } = await supabase
      .from('ai_threads')
      .select('id')
      .eq('id', threadId)
      .eq('user_id', user.id)
      .single()

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // 메시지 삭제
    const { error } = await supabase
      .from('ai_messages')
      .delete()
      .eq('thread_id', threadId)

    if (error) {
      console.error('Failed to delete messages:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 스레드 제목 초기화
    await supabase
      .from('ai_threads')
      .update({ title: 'New Chat', updated_at: new Date().toISOString() })
      .eq('id', threadId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('AI messages DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
