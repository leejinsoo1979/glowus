import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { AddProjectMemberInput } from '@/types/database'

// GET: Get project members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const adminClient = createAdminClient()

    const { data, error } = await adminClient
      .from('project_members')
      .select(`
        *,
        user:users(id, name, email, avatar_url, role)
      `)
      .eq('project_id', id)
      .order('joined_at', { ascending: true })

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

// POST: Add member to project
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

    const body: AddProjectMemberInput = await request.json()

    if (!body.user_id) {
      return NextResponse.json({ error: '사용자 ID가 필요합니다' }, { status: 400 })
    }

    // 이미 멤버인지 확인
    const { data: existing } = await adminClient
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', body.user_id)
      .single()

    if (existing) {
      return NextResponse.json({ error: '이미 프로젝트 멤버입니다' }, { status: 400 })
    }

    const { data, error } = await adminClient
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: body.user_id,
        role: body.role || 'member',
      })
      .select(`
        *,
        user:users(id, name, email, avatar_url)
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

// DELETE: Remove member from project
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
    const memberId = searchParams.get('member_id')

    if (!memberId) {
      return NextResponse.json({ error: '멤버 ID가 필요합니다' }, { status: 400 })
    }

    const { error } = await adminClient
      .from('project_members')
      .delete()
      .eq('id', memberId)

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
