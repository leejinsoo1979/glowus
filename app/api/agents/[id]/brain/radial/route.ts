export const dynamic = 'force-dynamic'

/**
 * Brain Map - Radial Layout API (중심 노드 기준 방사형)
 * GET /api/agents/:agentId/brain/radial?centerId=...&depth=2
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { BrainNode, BrainEdge, NodeType, EdgeType } from '@/types/brain-map'

interface RadialNode extends BrainNode {
  ring: number // 0 = center, 1 = first ring, etc.
  angle: number // radians
  parentId?: string
}

interface RadialResponse {
  center: RadialNode
  rings: RadialNode[][]
  edges: BrainEdge[]
  maxRing: number
}

// Mock radial data
function generateRadialData(centerId: string, depth: number): RadialResponse {
  const types: NodeType[] = ['memory', 'concept', 'person', 'doc', 'task', 'decision']
  const edgeTypes: EdgeType[] = ['mentions', 'supports', 'related', 'causes', 'follows']

  // Center node
  const center: RadialNode = {
    id: centerId || 'center-node',
    type: 'concept',
    title: '중심 노드',
    summary: '방사형 레이아웃의 중심입니다.',
    createdAt: Date.now(),
    importance: 10,
    confidence: 1,
    ring: 0,
    angle: 0,
  }

  const rings: RadialNode[][] = [[]]
  const edges: BrainEdge[] = []
  let nodeCounter = 0

  // Generate rings
  for (let ring = 1; ring <= depth; ring++) {
    const ringNodes: RadialNode[] = []
    const parentRing = rings[ring - 1] || [center]

    // Each parent gets 2-5 children
    parentRing.forEach((parent, parentIdx) => {
      const childCount = Math.floor(Math.random() * 4) + 2

      for (let i = 0; i < childCount; i++) {
        const nodeId = `radial-${ring}-${nodeCounter++}`
        const baseAngle = ring === 1 ? 0 : parent.angle
        const spreadAngle = (2 * Math.PI) / (parentRing.length * childCount)
        const angle = baseAngle + spreadAngle * (parentIdx * childCount + i)

        const node: RadialNode = {
          id: nodeId,
          type: types[Math.floor(Math.random() * types.length)],
          title: `Ring ${ring} 노드 #${i}`,
          summary: `${ring}번째 링의 노드입니다.`,
          createdAt: Date.now() - Math.random() * 30 * 86400000,
          importance: Math.max(1, 10 - ring * 2),
          confidence: Math.random(),
          ring,
          angle,
          parentId: parent.id,
        }

        ringNodes.push(node)

        edges.push({
          id: `edge-${parent.id}-${nodeId}`,
          source: parent.id,
          target: nodeId,
          type: edgeTypes[Math.floor(Math.random() * edgeTypes.length)],
          weight: 0.5 + Math.random() * 0.5,
          createdAt: Date.now(),
        })
      }
    })

    rings.push(ringNodes)
  }

  return {
    center,
    rings,
    edges,
    maxRing: depth,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const { searchParams } = new URL(request.url)

    const centerId = searchParams.get('centerId') || 'default-center'
    const depth = Math.min(parseInt(searchParams.get('depth') || '2'), 5) // max 5 rings

    const supabase = await createClient()
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // TODO: 실제 방사형 레이아웃 데이터 조회
    // 현재는 Mock 데이터 반환
    const radialData = generateRadialData(centerId, depth)

    const allNodes = [radialData.center, ...radialData.rings.flat()]

    return NextResponse.json({
      ...radialData,
      meta: {
        totalNodes: allNodes.length,
        totalEdges: radialData.edges.length,
        depth,
      },
    })
  } catch (error) {
    console.error('[Brain Radial API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Radial 조회 실패' },
      { status: 500 }
    )
  }
}
