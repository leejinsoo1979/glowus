import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CreateTaskInput } from '@/types/database'

// DEV 모드 설정
const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true'
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

// Type helpers
interface StartupCheck {
  id: string
  founder_id: string
}

// GET /api/tasks - List tasks
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const adminSupabase = createAdminClient()
    const { searchParams } = new URL(request.url)

    let userId: string
    if (DEV_MODE) {
      userId = DEV_USER_ID
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
      }
      userId = user.id
    }

    const startupId = searchParams.get('startup_id')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = adminSupabase
      .from('tasks')
      .select('*', { count: 'exact' })
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
      .single() as { data: StartupCheck | null }

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
        startup_id: body.startup_id,
        title: body.title,
        description: body.description,
        author_id: user.id,
        status: body.status || 'TODO',
        priority: body.priority || 'MEDIUM',
        estimated_hours: body.estimated_hours,
        due_date: body.due_date,
        category: body.category,
        tags: body.tags,
      } as any)
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
