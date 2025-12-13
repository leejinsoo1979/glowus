import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { UpdateProjectInput } from '@/types/database'

// GET: Get specific project with members and agents
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { data, error } = await (adminClient as any)
      .from('projects')
      .select(`
        *,
        owner:users!projects_owner_id_fkey(id, name, email, avatar_url),
        project_members(
          id,
          user_id,
          role,
          joined_at,
          user:users(id, name, email, avatar_url)
        ),
        project_agents(
          id,
          agent_id,
          role,
          is_active,
          assigned_at,
          agent:deployed_agents(id, name, description, avatar_url, status, capabilities)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다' }, { status: 404 })
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

// PATCH: Update project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body: UpdateProjectInput = await request.json()

    const allowedFields = [
      'name',
      'description',
      'status',
      'priority',
      'start_date',
      'end_date',
      'deadline',
      'progress',
      'budget',
      'tags',
      'color',
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field as keyof UpdateProjectInput] !== undefined) {
        updates[field] = body[field as keyof UpdateProjectInput]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '업데이트할 필드가 없습니다' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await (adminClient as any)
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
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

// DELETE: Delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { error } = await (adminClient as any)
      .from('projects')
      .delete()
      .eq('id', id)

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
