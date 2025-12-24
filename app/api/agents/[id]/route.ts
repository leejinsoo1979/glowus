export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

// GET: Get specific agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 개발 모드: DEV_USER 사용
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // DEV 모드에서는 owner_id 체크 없이 조회
    let query = (adminClient as any)
      .from('deployed_agents')
      .select(`
        *,
        next_agent:next_agent_id(id, name, avatar_url, capabilities)
      `)
      .eq('id', id)

    if (!isDevMode()) {
      query = query.eq('owner_id', user.id)
    }

    const { data, error } = await query.single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '에이전트를 찾을 수 없습니다' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 에이전트 정체성 정보 가져오기
    const { data: identity } = await (adminClient as any)
      .from('agent_identity')
      .select('*')
      .eq('agent_id', id)
      .single()

    // 최근 업무 로그 가져오기 (최근 20개)
    const { data: workLogs } = await (adminClient as any)
      .from('agent_work_logs')
      .select('*')
      .eq('agent_id', id)
      .order('created_at', { ascending: false })
      .limit(20)

    // 지식 베이스 가져오기
    const { data: knowledge } = await (adminClient as any)
      .from('agent_knowledge')
      .select('*')
      .eq('agent_id', id)
      .order('updated_at', { ascending: false })
      .limit(20)

    // 최근 커밋 가져오기 (최근 10개)
    const { data: commits } = await (adminClient as any)
      .from('agent_commits')
      .select('*')
      .eq('agent_id', id)
      .order('created_at', { ascending: false })
      .limit(10)

    // 팀 정보 가져오기
    let team = null
    if (data.team_id) {
      const { data: teamData } = await (adminClient as any)
        .from('teams')
        .select('id, name, description, logo_url, founder_id')
        .eq('id', data.team_id)
        .single()
      team = teamData
    }

    // 에이전트가 참여 중인 채팅방 가져오기
    const { data: chatRooms } = await (adminClient as any)
      .from('chat_participants')
      .select(`
        id,
        joined_at,
        room:chat_rooms(
          id,
          name,
          type,
          last_message_at,
          created_at
        )
      `)
      .eq('agent_id', id)
      .order('joined_at', { ascending: false })
      .limit(10)

    // 에이전트 관련 태스크 가져오기 (work_logs에서 task_id가 있는 것들)
    const taskIds = workLogs
      ?.filter((log: any) => log.task_id)
      .map((log: any) => log.task_id)
      .filter((id: string, idx: number, arr: string[]) => arr.indexOf(id) === idx)
      .slice(0, 10) || []

    let tasks: any[] = []
    if (taskIds.length > 0) {
      const { data: taskData } = await (adminClient as any)
        .from('tasks')
        .select(`
          id,
          title,
          status,
          priority,
          start_date,
          end_date,
          project:projects(id, name)
        `)
        .in('id', taskIds)
      tasks = taskData || []
    }

    // 프로젝트별 활동 통계
    const projectStats: Record<string, { name: string; count: number; lastActivity: string }> = {}
    workLogs?.forEach((log: any) => {
      if (log.project_id) {
        if (!projectStats[log.project_id]) {
          projectStats[log.project_id] = {
            name: log.metadata?.project_name || '프로젝트',
            count: 0,
            lastActivity: log.created_at
          }
        }
        projectStats[log.project_id].count++
        if (log.created_at > projectStats[log.project_id].lastActivity) {
          projectStats[log.project_id].lastActivity = log.created_at
        }
      }
    })

    return NextResponse.json({
      ...data,
      identity: identity || null,
      work_logs: workLogs || [],
      knowledge: knowledge || [],
      commits: commits || [],
      team: team,
      chat_rooms: chatRooms?.map((p: any) => p.room).filter(Boolean) || [],
      tasks: tasks,
      project_stats: Object.entries(projectStats).map(([id, stat]) => ({
        id,
        ...stat
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// PATCH: Update agent
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 개발 모드: DEV_USER 사용
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const allowedFields = [
      'name',
      'description',
      'status',
      'workflow_nodes',
      'workflow_edges',
      'capabilities',
      'avatar_url',
      'system_prompt',
      'model',
      'temperature',
      'team_id',
      // 상호작용 설정 필드
      'interaction_mode',
      'llm_provider',
      'llm_model',
      'speak_order',
      // 감정별 표정 이미지
      'emotion_avatars',
      // 커스텀 감정 타입
      'custom_emotions',
      // 채팅 메인 GIF
      'chat_main_gif',
      // 체이닝 필드 (에이전트 자동 연결)
      'next_agent_id',
      'chain_config',
      'chain_order',
      // 8섹션 프롬프트 설정 (JSONB)
      'prompt_sections',
      // 직무/직함
      'job_title',
      // 음성 설정 (JSONB)
      'voice_settings',
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    // Identity 업데이트 처리
    const identityFields = [
      'core_values',
      'personality_traits',
      'communication_style',
      'expertise_areas',
      'working_style',
      'strengths',
      'growth_areas',
      'relationship_notes',
      'self_summary',
      'recent_focus',
    ]

    const identityUpdates: Record<string, unknown> = {}
    for (const field of identityFields) {
      if (body.identity?.[field] !== undefined) {
        identityUpdates[field] = body.identity[field]
      }
    }

    // 에이전트 기본 정보 업데이트
    let agentData = null
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString()

      // DEV 모드에서는 owner_id 체크 없이 업데이트
      let query = (adminClient as any)
        .from('deployed_agents')
        .update(updates)
        .eq('id', id)

      if (!isDevMode()) {
        query = query.eq('owner_id', user.id)
      }

      const { data, error } = await query.select().single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      agentData = data
    }

    // Identity 업데이트
    if (Object.keys(identityUpdates).length > 0) {
      identityUpdates.updated_at = new Date().toISOString()

      // 기존 identity가 있는지 확인
      const { data: existingIdentity } = await (adminClient as any)
        .from('agent_identity')
        .select('id')
        .eq('agent_id', id)
        .single()

      if (existingIdentity) {
        // 업데이트
        const { error: identityError } = await (adminClient as any)
          .from('agent_identity')
          .update(identityUpdates)
          .eq('agent_id', id)

        if (identityError) {
          console.error('Identity update error:', identityError)
        }
      } else {
        // 새로 생성
        const { error: identityError } = await (adminClient as any)
          .from('agent_identity')
          .insert({
            agent_id: id,
            core_values: body.identity?.core_values || [],
            personality_traits: body.identity?.personality_traits || [],
            ...identityUpdates,
          })

        if (identityError) {
          console.error('Identity insert error:', identityError)
        }
      }
    }

    // 업데이트할 내용이 없는 경우
    if (Object.keys(updates).length === 0 && Object.keys(identityUpdates).length === 0) {
      return NextResponse.json({ error: '업데이트할 필드가 없습니다' }, { status: 400 })
    }

    // 최신 데이터 조회
    if (!agentData) {
      const { data } = await (adminClient as any)
        .from('deployed_agents')
        .select('*')
        .eq('id', id)
        .single()
      agentData = data
    }

    // Identity 다시 조회
    const { data: identity } = await (adminClient as any)
      .from('agent_identity')
      .select('*')
      .eq('agent_id', id)
      .single()

    return NextResponse.json({
      ...agentData,
      identity: identity || null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// DELETE: Delete agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { error } = await (supabase as any)
      .from('deployed_agents')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id)

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
