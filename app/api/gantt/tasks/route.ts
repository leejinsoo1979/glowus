// @ts-nocheck
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

// GET: 모든 프로젝트의 tasks를 일괄 조회 (Gantt 차트용)
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url)
    const startupId = searchParams.get('startup_id')
    const limit = parseInt(searchParams.get('limit') || '200')

    // 1. 사용자가 속한 프로젝트 목록 조회
    let projectsQuery = adminClient
      .from('projects')
      .select('id, name')
      .order('created_at', { ascending: false })

    if (startupId) {
      projectsQuery = projectsQuery.eq('startup_id', startupId)
    }

    const { data: projects, error: projectsError } = await projectsQuery

    if (projectsError) {
      console.error('Projects fetch error:', projectsError)
      return NextResponse.json({ error: projectsError.message }, { status: 500 })
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({ data: [], projects: [] })
    }

    const projectIds = projects.map(p => p.id)
    const projectMap = new Map(projects.map(p => [p.id, p.name]))

    // 2. 모든 프로젝트의 tasks를 한 번에 조회 (N+1 → 1 쿼리)
    const { data: tasks, error: tasksError } = await adminClient
      .from('project_tasks')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        start_date,
        due_date,
        project_id,
        depends_on,
        assignee_type,
        assignee_user:users!project_tasks_assignee_user_id_fkey(id, name, avatar_url),
        assignee_agent:deployed_agents!project_tasks_assignee_agent_id_fkey(id, name, avatar_url)
      `)
      .in('project_id', projectIds)
      .or('start_date.not.is.null,due_date.not.is.null') // 날짜가 있는 태스크만
      .order('start_date', { ascending: true, nullsFirst: false })
      .limit(limit)

    if (tasksError) {
      console.error('Tasks fetch error:', tasksError)
      return NextResponse.json({ error: tasksError.message }, { status: 500 })
    }

    // 3. 프로젝트 이름 추가
    const tasksWithProjectName = (tasks || []).map(task => ({
      ...task,
      project_name: projectMap.get(task.project_id) || '알 수 없음'
    }))

    return NextResponse.json({
      data: tasksWithProjectName,
      projects: projects,
      count: tasksWithProjectName.length
    })
  } catch (error) {
    console.error('Gantt tasks API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
