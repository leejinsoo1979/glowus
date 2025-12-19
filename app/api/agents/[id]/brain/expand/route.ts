export const dynamic = 'force-dynamic'

/**
 * Brain Map - Expand Node API
 * GET /api/agents/:agentId/brain/expand?nodeId=...&depth=1&limitPerHop=10
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { BrainNode, BrainEdge, NodeType, EdgeType } from '@/types/brain-map'

// Mock expansion data
function generateExpandedNodes(nodeId: string, depth: number, limitPerHop: number): { nodes: BrainNode[], edges: BrainEdge[] } {
  const types: NodeType[] = ['memory', 'concept', 'person', 'doc', 'task', 'decision']
  const edgeTypes: EdgeType[] = ['mentions', 'supports', 'related', 'causes', 'follows']

  const nodes: BrainNode[] = []
  const edges: BrainEdge[] = []

  const count = Math.min(limitPerHop, 8)
  for (let i = 0; i < count; i++) {
    const newNodeId = `${nodeId}-expand-${i}`
    const type = types[Math.floor(Math.random() * types.length)]

    nodes.push({
      id: newNodeId,
      type,
      title: `연결된 ${type} #${i}`,
      summary: '확장된 노드입니다.',
      createdAt: Date.now() - Math.random() * 14 * 86400000,
      importance: Math.floor(Math.random() * 10) + 1,
      confidence: Math.random(),
      hop: depth,
    })

    edges.push({
      id: `edge-${nodeId}-${newNodeId}`,
      source: nodeId,
      target: newNodeId,
      type: edgeTypes[Math.floor(Math.random() * edgeTypes.length)],
      weight: 0.5 + Math.random() * 0.5,
      createdAt: Date.now(),
    })
  }

  return { nodes, edges }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const { searchParams } = new URL(request.url)

    const nodeId = searchParams.get('nodeId')
    const depth = parseInt(searchParams.get('depth') || '1')
    const limitPerHop = parseInt(searchParams.get('limitPerHop') || '10')
    const minWeight = parseFloat(searchParams.get('minWeight') || '0')

    if (!nodeId) {
      return NextResponse.json({ error: 'nodeId is required' }, { status: 400 })
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

    // TODO: 실제 데이터베이스에서 연결된 노드 조회
    // 현재는 Mock 데이터 반환
    const { nodes, edges } = generateExpandedNodes(nodeId, depth, limitPerHop)

    return NextResponse.json({ nodes, edges })
  } catch (error) {
    console.error('[Brain Expand API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Expand 실패' },
      { status: 500 }
    )
  }
}
