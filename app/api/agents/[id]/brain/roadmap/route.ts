export const dynamic = 'force-dynamic'

/**
 * Brain Map - Roadmap API (시간순 타임라인)
 * GET /api/agents/:agentId/brain/roadmap
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { BrainNode, BrainEdge, NodeType, EdgeType } from '@/types/brain-map'

interface RoadmapEvent {
  id: string
  timestamp: number
  type: 'milestone' | 'decision' | 'learning' | 'creation'
  title: string
  description: string
  relatedNodes: string[]
  importance: number
}

interface RoadmapResponse {
  timeline: RoadmapEvent[]
  nodes: BrainNode[]
  edges: BrainEdge[]
  dateRange: {
    start: number
    end: number
  }
}

// Mock roadmap data
function generateMockRoadmap(startDate: number, endDate: number): RoadmapResponse {
  const types: NodeType[] = ['memory', 'concept', 'decision', 'task', 'meeting']
  const edgeTypes: EdgeType[] = ['follows', 'causes', 'related']
  const eventTypes: Array<'milestone' | 'decision' | 'learning' | 'creation'> = [
    'milestone', 'decision', 'learning', 'creation'
  ]

  const eventCount = Math.floor(Math.random() * 15) + 10
  const timeline: RoadmapEvent[] = []
  const nodes: BrainNode[] = []
  const edges: BrainEdge[] = []

  for (let i = 0; i < eventCount; i++) {
    const timestamp = startDate + Math.random() * (endDate - startDate)
    const nodeId = `roadmap-node-${i}`
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)]

    timeline.push({
      id: `event-${i}`,
      timestamp,
      type: eventType,
      title: `${eventType === 'milestone' ? '마일스톤' : eventType === 'decision' ? '결정' : eventType === 'learning' ? '학습' : '생성'} #${i}`,
      description: `타임라인 이벤트 설명입니다.`,
      relatedNodes: [nodeId],
      importance: Math.floor(Math.random() * 10) + 1,
    })

    nodes.push({
      id: nodeId,
      type: types[Math.floor(Math.random() * types.length)],
      title: `노드 #${i}`,
      summary: `로드맵 노드입니다.`,
      createdAt: timestamp,
      importance: Math.floor(Math.random() * 10) + 1,
      confidence: Math.random(),
    })

    // 시간순 연결
    if (i > 0) {
      edges.push({
        id: `edge-${i}`,
        source: `roadmap-node-${i - 1}`,
        target: nodeId,
        type: edgeTypes[Math.floor(Math.random() * edgeTypes.length)],
        weight: 0.5 + Math.random() * 0.5,
        createdAt: timestamp,
      })
    }
  }

  // Sort timeline by timestamp
  timeline.sort((a, b) => a.timestamp - b.timestamp)

  return {
    timeline,
    nodes,
    edges,
    dateRange: { start: startDate, end: endDate },
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const { searchParams } = new URL(request.url)

    const startDate = parseInt(searchParams.get('startDate') || String(Date.now() - 30 * 86400000))
    const endDate = parseInt(searchParams.get('endDate') || String(Date.now()))
    const granularity = searchParams.get('granularity') || 'day' // day, week, month

    const supabase = await createClient()
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // TODO: 실제 타임라인 데이터 조회
    // 현재는 Mock 데이터 반환
    const roadmap = generateMockRoadmap(startDate, endDate)

    return NextResponse.json({
      ...roadmap,
      meta: {
        eventCount: roadmap.timeline.length,
        granularity,
      },
    })
  } catch (error) {
    console.error('[Brain Roadmap API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Roadmap 조회 실패' },
      { status: 500 }
    )
  }
}
