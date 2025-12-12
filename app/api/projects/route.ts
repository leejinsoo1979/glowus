import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { CreateProjectInput } from '@/types/database'

// GET: List all projects for current user's teams
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 개발 모드: DEV_USER 사용
    let user = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('team_id')
    const status = searchParams.get('status')

    // 프로젝트 조회 (팀 멤버인 프로젝트만)
    let query = adminClient
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
          agent:deployed_agents(id, name, avatar_url, status)
        )
      `)
      .order('created_at', { ascending: false })

    if (teamId) {
      query = query.eq('team_id', teamId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Projects fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Projects API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// POST: Create new project
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 개발 모드: DEV_USER 사용
    let user = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body: CreateProjectInput = await request.json()

    if (!body.name || !body.team_id) {
      return NextResponse.json(
        { error: '프로젝트 이름과 팀 ID가 필요합니다' },
        { status: 400 }
      )
    }

    // 프로젝트 생성
    const { data: project, error } = await adminClient
      .from('projects')
      .insert({
        team_id: body.team_id,
        name: body.name,
        description: body.description || null,
        status: body.status || 'planning',
        priority: body.priority || 'medium',
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        deadline: body.deadline || null,
        budget: body.budget || null,
        tags: body.tags || [],
        color: body.color || '#8B5CF6',
        owner_id: user.id,
        progress: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Project create error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 프로젝트 생성자를 리드로 자동 추가
    await adminClient.from('project_members').insert({
      project_id: project.id,
      user_id: user.id,
      role: 'lead',
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Project create API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
