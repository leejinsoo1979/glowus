export const dynamic = 'force-dynamic'

/**
 * Brain Map - Pathfinder API (두 노드 간 경로 탐색)
 * GET /api/agents/:agentId/brain/pathfinder?from=...&to=...
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { BrainTrace, TraceStep, StepType } from '@/types/brain-map'

// Mock pathfinder data
function generateMockPath(fromId: string, toId: string): BrainTrace {
  const stepTypes: StepType[] = ['retrieve', 'read', 'reason', 'plan', 'decision']

  // Generate path with 3-7 steps
  const stepCount = Math.floor(Math.random() * 5) + 3
  const steps: TraceStep[] = []

  for (let i = 0; i < stepCount; i++) {
    const stepType = stepTypes[Math.floor(Math.random() * stepTypes.length)]

    steps.push({
      stepId: `step-${i}`,
      index: i,
      stepType,
      input: i === 0 ? `시작 노드: ${fromId}` : undefined,
      output: i === stepCount - 1 ? `목표 도달: ${toId}` : `경유 노드 #${i} 처리 완료`,
      usedNodeIds: i === 0 ? [fromId] : (i === stepCount - 1 ? [toId] : [`path-node-${i}`]),
      createdEdgeIds: i > 0 ? [`edge-path-${i}`] : [],
      confidence: 0.6 + Math.random() * 0.4,
    })
  }

  return {
    traceId: `trace-${Date.now()}`,
    startedAt: Date.now() - 5000,
    endedAt: Date.now(),
    goal: `${fromId}에서 ${toId}까지 경로 탐색`,
    finalAnswer: `${stepCount}단계를 거쳐 경로를 찾았습니다.`,
    steps,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const { searchParams } = new URL(request.url)

    const fromId = searchParams.get('from')
    const toId = searchParams.get('to')
    const maxHops = parseInt(searchParams.get('maxHops') || '10')
    const algorithm = searchParams.get('algorithm') || 'dijkstra' // dijkstra, bfs, astar

    if (!fromId || !toId) {
      return NextResponse.json(
        { error: 'from과 to 파라미터가 필요합니다' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // TODO: 실제 경로 탐색 알고리즘 구현
    // 현재는 Mock 데이터 반환
    const trace = generateMockPath(fromId, toId)
    const stepCount = trace.steps.length

    // Check if path exceeds maxHops
    if (stepCount > maxHops) {
      return NextResponse.json({
        found: false,
        message: `${maxHops}홉 이내에 경로를 찾을 수 없습니다.`,
        trace: null,
      })
    }

    return NextResponse.json({
      found: true,
      trace,
      meta: {
        algorithm,
        maxHops,
        actualHops: stepCount,
      },
    })
  } catch (error) {
    console.error('[Brain Pathfinder API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pathfinder 실패' },
      { status: 500 }
    )
  }
}
