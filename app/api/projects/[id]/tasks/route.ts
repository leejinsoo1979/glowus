import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { CreateProjectTaskInput, UpdateProjectTaskInput } from '@/types/database'

// GET: List all tasks for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const assigneeType = searchParams.get('assignee_type')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = adminClient
      .from('project_tasks')
      .select(`
        *,
        assignee_user:users!project_tasks_assignee_user_id_fkey(id, name, email, avatar_url),
        assignee_agent:deployed_agents!project_tasks_assignee_agent_id_fkey(id, name, description, avatar_url, status)
      `, { count: 'exact' })
      .eq('project_id', projectId)
      .order('position', { ascending: true })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (assigneeType) {
      query = query.eq('assignee_type', assigneeType)
    }

    const { data, error, count } = await query

    if (error) {
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// POST: Create a new task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body: CreateProjectTaskInput = await request.json()

    if (!body.title) {
      return NextResponse.json({ error: '태스크 제목은 필수입니다' }, { status: 400 })
    }

    // Validate assignee consistency
    if (body.assignee_type === 'human' && !body.assignee_user_id) {
      return NextResponse.json({ error: '사람 할당 시 사용자 ID가 필요합니다' }, { status: 400 })
    }

    if (body.assignee_type === 'agent' && !body.assignee_agent_id) {
      return NextResponse.json({ error: '에이전트 할당 시 에이전트 ID가 필요합니다' }, { status: 400 })
    }

    // Get max position if not provided
    let position = body.position
    if (position === undefined) {
      const { data: lastTask } = await adminClient
        .from('project_tasks')
        .select('position')
        .eq('project_id', projectId)
        .order('position', { ascending: false })
        .limit(1)
        .single()

      position = (lastTask?.position || 0) + 1
    }

    const { data, error } = await adminClient
      .from('project_tasks')
      .insert({
        project_id: projectId,
        title: body.title,
        description: body.description,
        status: body.status || 'TODO',
        priority: body.priority || 'MEDIUM',
        assignee_type: body.assignee_type,
        assignee_user_id: body.assignee_type === 'human' ? body.assignee_user_id : null,
        assignee_agent_id: body.assignee_type === 'agent' ? body.assignee_agent_id : null,
        position,
        depends_on: body.depends_on || [],
        start_date: body.start_date,
        due_date: body.due_date,
        estimated_hours: body.estimated_hours,
        tags: body.tags || [],
        category: body.category,
        created_by: user.id,
      })
      .select(`
        *,
        assignee_user:users!project_tasks_assignee_user_id_fkey(id, name, email, avatar_url),
        assignee_agent:deployed_agents!project_tasks_assignee_agent_id_fkey(id, name, description, avatar_url, status)
      `)
      .single()

    if (error) {
      console.error('Task create error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// PATCH: Bulk update tasks (for reordering, status changes)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body: { tasks: Array<{ id: string } & Partial<UpdateProjectTaskInput>> } = await request.json()

    if (!body.tasks || !Array.isArray(body.tasks)) {
      return NextResponse.json({ error: '업데이트할 태스크 배열이 필요합니다' }, { status: 400 })
    }

    // Update tasks one by one (Supabase doesn't support bulk upsert with different values)
    const results = []
    for (const task of body.tasks) {
      const { id, ...updates } = task

      // Validate assignee consistency
      if (updates.assignee_type === 'human') {
        updates.assignee_agent_id = undefined
      } else if (updates.assignee_type === 'agent') {
        updates.assignee_user_id = undefined
      }

      const { data, error } = await adminClient
        .from('project_tasks')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('project_id', projectId)
        .select()
        .single()

      if (error) {
        console.error(`Failed to update task ${id}:`, error)
        continue
      }

      results.push(data)
    }

    return NextResponse.json({ updated: results.length, data: results })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
