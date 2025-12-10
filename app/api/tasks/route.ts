import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CreateTaskInput } from '@/types/database'

// GET /api/tasks - List tasks
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const startupId = searchParams.get('startup_id')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('tasks')
      .select(`
        *,
        author:users!tasks_author_id_fkey(id, name, email, avatar_url),
        startup:startups!tasks_startup_id_fkey(id, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (startupId) {
      query = query.eq('startup_id', startupId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (priority) {
      query = query.eq('priority', priority)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Tasks fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data,
      count,
      page: Math.floor(offset / limit) + 1,
      limit,
      hasMore: (count || 0) > offset + limit,
    })
  } catch (error) {
    console.error('Tasks API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/tasks - Create new task
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body: CreateTaskInput = await request.json()

    // Validate required fields
    if (!body.startup_id || !body.title) {
      return NextResponse.json(
        { error: '스타트업 ID와 제목은 필수입니다.' },
        { status: 400 }
      )
    }

    // Check if user has access to this startup
    const { data: startup } = await supabase
      .from('startups')
      .select('id, founder_id')
      .eq('id', body.startup_id)
      .single()

    if (!startup) {
      return NextResponse.json(
        { error: '스타트업을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Check if user is founder or team member
    const isFounder = startup.founder_id === user.id
    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('startup_id', body.startup_id)
      .eq('user_id', user.id)
      .single()

    if (!isFounder && !membership) {
      return NextResponse.json(
        { error: '태스크를 생성할 권한이 없습니다.' },
        { status: 403 }
      )
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        ...body,
        author_id: user.id,
        status: body.status || 'TODO',
        priority: body.priority || 'MEDIUM',
      })
      .select(`
        *,
        author:users!tasks_author_id_fkey(id, name, email, avatar_url)
      `)
      .single()

    if (error) {
      console.error('Task create error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('Task create API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
