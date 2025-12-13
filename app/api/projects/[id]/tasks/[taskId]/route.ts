import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { UpdateProjectTaskInput } from '@/types/database'

// GET: Get a single task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: projectId, taskId } = await params
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

    const { data, error } = await adminClient
      .from('project_tasks')
      .select(`
        *,
        assignee_user:users!project_tasks_assignee_user_id_fkey(id, name, email, avatar_url),
        assignee_agent:deployed_agents!project_tasks_assignee_agent_id_fkey(id, name, description, avatar_url, status, capabilities)
      `)
      .eq('id', taskId)
      .eq('project_id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '태스크를 찾을 수 없습니다' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// PATCH: Update a single task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: projectId, taskId } = await params
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

    const body: UpdateProjectTaskInput = await request.json()

    const allowedFields = [
      'title',
      'description',
      'status',
      'priority',
      'assignee_type',
      'assignee_user_id',
      'assignee_agent_id',
      'position',
      'depends_on',
      'start_date',
      'due_date',
      'estimated_hours',
      'actual_hours',
      'completed_at',
      'tags',
      'category',
      'agent_result',
      'agent_executed_at',
      'agent_error',
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field as keyof UpdateProjectTaskInput] !== undefined) {
        updates[field] = body[field as keyof UpdateProjectTaskInput]
      }
    }

    // Validate assignee consistency
    if (updates.assignee_type === 'human') {
      updates.assignee_agent_id = null
      if (!updates.assignee_user_id && !body.assignee_user_id) {
        return NextResponse.json({ error: '사람 할당 시 사용자 ID가 필요합니다' }, { status: 400 })
      }
    } else if (updates.assignee_type === 'agent') {
      updates.assignee_user_id = null
      if (!updates.assignee_agent_id && !body.assignee_agent_id) {
        return NextResponse.json({ error: '에이전트 할당 시 에이전트 ID가 필요합니다' }, { status: 400 })
      }
    }

    // Auto-set completed_at when status changes to DONE
    if (updates.status === 'DONE' && !updates.completed_at) {
      updates.completed_at = new Date().toISOString()
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '업데이트할 필드가 없습니다' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await adminClient
      .from('project_tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('project_id', projectId)
      .select(`
        *,
        assignee_user:users!project_tasks_assignee_user_id_fkey(id, name, email, avatar_url),
        assignee_agent:deployed_agents!project_tasks_assignee_agent_id_fkey(id, name, description, avatar_url, status)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// DELETE: Delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: projectId, taskId } = await params
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

    const { error } = await adminClient
      .from('project_tasks')
      .delete()
      .eq('id', taskId)
      .eq('project_id', projectId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
