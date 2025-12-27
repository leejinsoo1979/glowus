export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'

/**
 * Coding Team Stats API
 * 5개 에이전트의 기여도 통계 조회
 */

// 기본 에이전트 정보 (DB에 데이터 없을 때 사용)
const DEFAULT_AGENTS = [
  { agent_role: 'orchestrator', total_tasks: 0, total_files_created: 0, total_files_modified: 0, total_nodes_created: 0, total_actions: 0, successful_tasks: 0, avg_duration_ms: 0, last_active_at: null },
  { agent_role: 'planner', total_tasks: 0, total_files_created: 0, total_files_modified: 0, total_nodes_created: 0, total_actions: 0, successful_tasks: 0, avg_duration_ms: 0, last_active_at: null },
  { agent_role: 'implementer', total_tasks: 0, total_files_created: 0, total_files_modified: 0, total_nodes_created: 0, total_actions: 0, successful_tasks: 0, avg_duration_ms: 0, last_active_at: null },
  { agent_role: 'tester', total_tasks: 0, total_files_created: 0, total_files_modified: 0, total_nodes_created: 0, total_actions: 0, successful_tasks: 0, avg_duration_ms: 0, last_active_at: null },
  { agent_role: 'reviewer', total_tasks: 0, total_files_created: 0, total_files_modified: 0, total_nodes_created: 0, total_actions: 0, successful_tasks: 0, avg_duration_ms: 0, last_active_at: null },
]

export async function GET(request: NextRequest) {
  try {
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

    // 통계 뷰에서 데이터 조회
    const { data: stats, error } = await adminClient
      .from('coding_team_stats')
      .select('*')
      .eq('user_id', user.id) as { data: typeof DEFAULT_AGENTS | null; error: any }

    if (error) {
      // 테이블이 없는 경우 기본값 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.log('[CodingTeam] Table not found, returning defaults')
        return NextResponse.json({ stats: DEFAULT_AGENTS })
      }
      throw error
    }

    // 기본값과 병합 (데이터 없는 에이전트도 표시)
    const mergedStats = DEFAULT_AGENTS.map(defaultAgent => {
      const found = stats?.find(s => s.agent_role === defaultAgent.agent_role)
      return found || defaultAgent
    })

    return NextResponse.json({ stats: mergedStats })
  } catch (error) {
    console.error('[CodingTeam Stats] Error:', error)
    // 에러 시에도 기본값 반환
    return NextResponse.json({ stats: DEFAULT_AGENTS })
  }
}
