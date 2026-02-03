import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: 사용자의 모든 AI 스레드 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const threadType = searchParams.get('type') // null이면 모든 타입
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('ai_threads')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(limit)

    // type 파라미터가 있으면 필터링, 없거나 'all'이면 전체 조회
    if (threadType && threadType !== 'all') {
      query = query.eq('thread_type', threadType)
    }

    const { data: threads, error } = await query

    if (error) {
      console.error('Failed to fetch threads:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ threads })
  } catch (error: any) {
    console.error('AI threads GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: 새 스레드 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, threadType = 'glow_code', metadata = {} } = body

    const { data: thread, error } = await supabase
      .from('ai_threads')
      .insert({
        user_id: user.id,
        title: title || 'New Chat',
        thread_type: threadType,
        metadata,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create thread:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ thread })
  } catch (error: any) {
    console.error('AI threads POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
