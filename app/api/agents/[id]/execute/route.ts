import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { executeAgentWithTools } from '@/lib/agent/executor'

// POST: 에이전트에게 업무 실행 요청 (채팅에서 바로 실행)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { instruction, title } = body

    if (!instruction) {
      return NextResponse.json({ error: '실행할 업무 지시가 필요합니다' }, { status: 400 })
    }

    // 에이전트 조회
    const { data: agent, error: agentError } = await (adminClient as any)
      .from('deployed_agents')
      .select('*')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: '에이전트를 찾을 수 없습니다' }, { status: 404 })
    }

    console.log(`[Execute] Agent ${agent.name} executing: ${instruction.substring(0, 50)}...`)

    // 가상 태스크 객체 생성 (DB에 저장하지 않고 바로 실행)
    const virtualTask = {
      id: `temp-${Date.now()}`,
      title: title || '채팅 업무 실행',
      description: '',
      instructions: instruction,
      status: 'IN_PROGRESS',
      assigner_type: 'USER',
      assigner_user_id: user.id,
      assignee_agent_id: agentId,
      created_at: new Date().toISOString(),
    }

    // 업무 실행
    const result = await executeAgentWithTools(agent, virtualTask as any)

    // 업무 로그 기록
    try {
      await (adminClient as any).from('agent_work_logs').insert({
        agent_id: agentId,
        log_type: 'task_work',
        content: `업무 실행: "${title || instruction.substring(0, 50)}${instruction.length > 50 ? '...' : ''}"`,
        metadata: {
          user_id: user.id,
          instruction: instruction.substring(0, 200),
          success: result.success,
          tools_used: result.toolsUsed,
          sources_count: result.sources.length,
        },
      })
    } catch (logError) {
      console.error('Work log error:', logError)
    }

    return NextResponse.json({
      success: result.success,
      output: result.output,
      sources: result.sources,
      toolsUsed: result.toolsUsed,
      error: result.error,
    })
  } catch (error) {
    console.error('Agent execute error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '실행 실패' },
      { status: 500 }
    )
  }
}
