import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: 프로젝트 활동 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const projectId = params.id
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  const timeRange = searchParams.get('timeRange') || 'all'

  // 시간 범위 필터
  let startDate: Date | null = null
  const now = new Date()

  switch (timeRange) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0))
      break
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
  }

  try {
    let query = supabase
      .from('project_activities')
      .select(`
        id,
        type,
        title,
        description,
        metadata,
        created_at,
        user:users!project_activities_user_id_fkey (
          id,
          name,
          avatar_url
        ),
        agent:deployed_agents!project_activities_agent_id_fkey (
          id,
          name,
          avatar_url
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // 타입 필터
    if (type) {
      query = query.eq('type', type)
    }

    // 시간 범위 필터
    if (startDate) {
      query = query.gte('created_at', startDate.toISOString())
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Activities fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}

// POST: 활동 기록 생성
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const projectId = params.id

  try {
    const body = await request.json()
    const { type, title, description, agent_id, metadata } = body

    if (!type || !title) {
      return NextResponse.json(
        { error: 'type and title are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('project_activities')
      .insert({
        project_id: projectId,
        type,
        title,
        description,
        user_id: agent_id ? null : user.id,
        agent_id: agent_id || null,
        metadata: metadata || {},
      } as any)
      .select(`
        id,
        type,
        title,
        description,
        metadata,
        created_at,
        user:users!project_activities_user_id_fkey (
          id,
          name,
          avatar_url
        ),
        agent:deployed_agents!project_activities_agent_id_fkey (
          id,
          name,
          avatar_url
        )
      `)
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Activity create error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create activity' },
      { status: 500 }
    )
  }
}
