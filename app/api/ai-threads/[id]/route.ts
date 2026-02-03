import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: 특정 스레드와 메시지 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 스레드 조회
    const { data: thread, error: threadError } = await supabase
      .from('ai_threads')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (threadError || !thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // 메시지 조회
    const { data: messages, error: messagesError } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('thread_id', id)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Failed to fetch messages:', messagesError)
      return NextResponse.json({ error: messagesError.message }, { status: 500 })
    }

    return NextResponse.json({ thread, messages })
  } catch (error: any) {
    console.error('AI thread GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH: 스레드 업데이트 (제목 변경 등)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, metadata } = body

    const updates: any = { updated_at: new Date().toISOString() }
    if (title !== undefined) updates.title = title
    if (metadata !== undefined) updates.metadata = metadata

    const { data: thread, error } = await supabase
      .from('ai_threads')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update thread:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ thread })
  } catch (error: any) {
    console.error('AI thread PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE: 스레드 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('ai_threads')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to delete thread:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('AI thread DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
