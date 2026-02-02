/**
 * Agent Memory Sync API
 *
 * 에이전트의 장기기억을 Claude Code 워크스페이스와 동기화
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  syncMemoriesToWorkspace,
  syncWorkspaceToMemories,
  syncMemoryImmediately,
  updateCurrentContext,
} from '@/lib/agent/agent-memory-sync'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST - 메모리 동기화 실행
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: agentId } = await context.params
    const body = await request.json()
    const { action, workspacePath, userId, content, category, currentMessage } = body

    // 에이전트 확인
    const supabase = createAdminClient()
    const { data: agent, error } = await supabase
      .from('deployed_agents')
      .select('id, name')
      .eq('id', agentId)
      .single()

    if (error || !agent) {
      return NextResponse.json({ error: '에이전트를 찾을 수 없습니다' }, { status: 404 })
    }

    let result

    switch (action) {
      // Supabase → 워크스페이스 동기화 (세션 시작 시)
      case 'to_workspace':
        if (!workspacePath) {
          return NextResponse.json({ error: 'workspacePath가 필요합니다' }, { status: 400 })
        }
        result = await syncMemoriesToWorkspace({
          workspacePath,
          agentId,
          agentName: agent.name,
          userId,
        })
        break

      // 워크스페이스 → Supabase 동기화 (세션 종료 시)
      case 'from_workspace':
        if (!workspacePath) {
          return NextResponse.json({ error: 'workspacePath가 필요합니다' }, { status: 400 })
        }
        result = await syncWorkspaceToMemories({
          workspacePath,
          agentId,
          agentName: agent.name,
        })
        break

      // 즉시 동기화 (실시간)
      case 'immediate':
        if (!content) {
          return NextResponse.json({ error: 'content가 필요합니다' }, { status: 400 })
        }
        result = await syncMemoryImmediately(agentId, content, category, userId)
        break

      // 현재 대화 컨텍스트 업데이트
      case 'update_context':
        if (!workspacePath || !userId) {
          return NextResponse.json({ error: 'workspacePath와 userId가 필요합니다' }, { status: 400 })
        }
        await updateCurrentContext(workspacePath, agentId, userId, currentMessage || '')
        result = { success: true }
        break

      default:
        return NextResponse.json({
          error: `알 수 없는 action: ${action}`,
          availableActions: ['to_workspace', 'from_workspace', 'immediate', 'update_context'],
        }, { status: 400 })
    }

    return NextResponse.json({ success: true, ...result })

  } catch (error: any) {
    console.error('[MemorySync API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * GET - 동기화 상태 확인
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: agentId } = await context.params
    const { searchParams } = new URL(request.url)
    const workspacePath = searchParams.get('workspacePath')

    const supabase = createAdminClient()

    // 에이전트 확인
    const { data: agent } = await supabase
      .from('deployed_agents')
      .select('id, name')
      .eq('id', agentId)
      .single()

    if (!agent) {
      return NextResponse.json({ error: '에이전트를 찾을 수 없습니다' }, { status: 404 })
    }

    // 메모리 통계
    const { count: memoryCount } = await supabase
      .from('agent_memories')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)

    const { count: profileCount } = await (supabase as any)
      .from('agent_user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)

    return NextResponse.json({
      agentId,
      agentName: agent.name,
      memoryCount: memoryCount || 0,
      profileCount: profileCount || 0,
      workspacePath: workspacePath || null,
    })

  } catch (error: any) {
    console.error('[MemorySync API] GET Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
