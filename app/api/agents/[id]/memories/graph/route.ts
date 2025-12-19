/**
 * Agent Memory Graph API
 *
 * GET /api/agents/:id/memories/graph
 * 메모리 그래프 데이터 조회 (3D 시각화용)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMemoryGraphData, getLinkedMemories, type AgentMemoryType } from '@/lib/memory'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

interface Params {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agentId = params.id

    // 에이전트 소유자 확인
    const { data: agent } = await supabase
      .from('deployed_agents')
      .select('id, owner_id')
      .eq('id', agentId)
      .single() as { data: { id: string; owner_id: string } | null }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const minImportance = parseInt(searchParams.get('minImportance') || '5', 10)
    const memoryTypesParam = searchParams.get('memoryTypes')
    const memoryTypes = memoryTypesParam
      ? memoryTypesParam.split(',') as AgentMemoryType[]
      : undefined

    const graphData = await getMemoryGraphData(agentId, {
      limit,
      memoryTypes,
      minImportance,
    })

    return NextResponse.json({
      success: true,
      ...graphData,
    })
  } catch (error) {
    console.error('[API] Memory graph error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/agents/:id/memories/graph
 * 특정 메모리에서 연결된 메모리 조회
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agentId = params.id

    // 에이전트 소유자 확인
    const { data: agent } = await supabase
      .from('deployed_agents')
      .select('id, owner_id')
      .eq('id', agentId)
      .single() as { data: { id: string; owner_id: string } | null }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { memoryId, depth = 1 } = body

    if (!memoryId) {
      return NextResponse.json({ error: 'Memory ID is required' }, { status: 400 })
    }

    const linkedMemories = await getLinkedMemories(memoryId, depth)

    return NextResponse.json({
      success: true,
      memoryId,
      depth,
      linkedMemories,
      count: linkedMemories.length,
    })
  } catch (error) {
    console.error('[API] Linked memories error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
