import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { AddProjectAgentInput } from '@/types/database'

// GET: Get project agents
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const adminClient = createAdminClient()

    const { data, error } = await adminClient
      .from('project_agents')
      .select(`
        *,
        agent:deployed_agents(id, name, description, avatar_url, status, capabilities, model)
      `)
      .eq('project_id', id)
      .order('assigned_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// POST: Add agent to project
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

    const body: AddProjectAgentInput = await request.json()

    if (!body.agent_id) {
      return NextResponse.json({ error: '에이전트 ID가 필요합니다' }, { status: 400 })
    }

    // 이미 프로젝트에 할당되었는지 확인
    const { data: existing } = await adminClient
      .from('project_agents')
      .select('id')
      .eq('project_id', projectId)
      .eq('agent_id', body.agent_id)
      .single()

    if (existing) {
      return NextResponse.json({ error: '이미 프로젝트에 할당된 에이전트입니다' }, { status: 400 })
    }

    const { data, error } = await adminClient
      .from('project_agents')
      .insert({
        project_id: projectId,
        agent_id: body.agent_id,
        role: body.role || 'assistant',
        is_active: true,
      })
      .select(`
        *,
        agent:deployed_agents(id, name, description, avatar_url, status, capabilities)
      `)
      .single()

    if (error) {
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

// DELETE: Remove agent from project
export async function DELETE(request: NextRequest) {
  try {
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
    const assignmentId = searchParams.get('assignment_id')

    if (!assignmentId) {
      return NextResponse.json({ error: '할당 ID가 필요합니다' }, { status: 400 })
    }

    const { error } = await adminClient
      .from('project_agents')
      .delete()
      .eq('id', assignmentId)

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

// PATCH: Update agent assignment (toggle active, change role)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const body = await request.json()
    const { assignment_id, role, is_active } = body

    if (!assignment_id) {
      return NextResponse.json({ error: '할당 ID가 필요합니다' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (role !== undefined) updates.role = role
    if (is_active !== undefined) updates.is_active = is_active

    const { data, error } = await adminClient
      .from('project_agents')
      .update(updates)
      .eq('id', assignment_id)
      .select(`
        *,
        agent:deployed_agents(id, name, description, avatar_url, status)
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
