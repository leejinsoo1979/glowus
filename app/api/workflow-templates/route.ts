import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { CreateWorkflowTemplateInput } from '@/types/database'

// GET: List workflow templates
export async function GET(request: NextRequest) {
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
    const projectType = searchParams.get('project_type')
    const teamId = searchParams.get('team_id')
    const includeSystem = searchParams.get('include_system') !== 'false'

    let query = adminClient
      .from('workflow_templates')
      .select('*')
      .order('is_system', { ascending: false })
      .order('created_at', { ascending: false })

    // Filter by project type
    if (projectType) {
      query = query.eq('project_type', projectType)
    }

    // Filter: system templates OR user's team templates
    if (teamId) {
      if (includeSystem) {
        query = query.or(`is_system.eq.true,team_id.eq.${teamId}`)
      } else {
        query = query.eq('team_id', teamId)
      }
    } else if (includeSystem) {
      // Only system templates if no team specified
      query = query.eq('is_system', true)
    }

    const { data, error } = await query

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

// POST: Create a new workflow template
export async function POST(request: NextRequest) {
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

    const body: CreateWorkflowTemplateInput = await request.json()

    if (!body.name || !body.project_type || !body.tasks) {
      return NextResponse.json(
        { error: '이름, 프로젝트 타입, 태스크 목록은 필수입니다' },
        { status: 400 }
      )
    }

    const { data, error } = await adminClient
      .from('workflow_templates')
      .insert({
        name: body.name,
        description: body.description,
        project_type: body.project_type,
        tasks: body.tasks,
        is_system: false,
        team_id: body.team_id,
        created_by: user.id,
      })
      .select()
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
