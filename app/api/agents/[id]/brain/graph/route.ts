export const dynamic = 'force-dynamic'

/**
 * Brain Map - Graph API
 * GET /api/agents/:agentId/brain/graph
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { BrainNode, BrainEdge, NodeType, EdgeType } from '@/types/brain-map'

// ============================================
// Mock Data Generator
// ============================================

function generateMockNodes(count: number): BrainNode[] {
  const types: NodeType[] = ['memory', 'concept', 'person', 'doc', 'task', 'decision', 'meeting', 'tool', 'skill']
  const tags = ['중요', '긴급', '참고', '검토필요', '완료', '진행중', 'AI', '개발', '디자인', '마케팅']

  const nodes: BrainNode[] = []
  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)]
    nodes.push({
      id: `node-${i}`,
      type,
      title: `${type} 노드 #${i}`,
      summary: `이것은 ${type} 타입의 노드입니다. 테스트 데이터입니다.`,
      createdAt: Date.now() - Math.random() * 30 * 86400000,
      updatedAt: Date.now() - Math.random() * 7 * 86400000,
      importance: Math.floor(Math.random() * 10) + 1,
      confidence: Math.random(),
      clusterId: `cluster-${Math.floor(i / 20)}`,
      tags: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () =>
        tags[Math.floor(Math.random() * tags.length)]
      ),
      source: {
        kind: ['chat', 'file', 'web', 'tool'][Math.floor(Math.random() * 4)] as 'chat' | 'file' | 'web' | 'tool',
        ref: `ref-${i}`,
      },
      stats: {
        accessCount: Math.floor(Math.random() * 100),
        lastAccessAt: Date.now() - Math.random() * 7 * 86400000,
      },
    })
  }
  return nodes
}

function generateMockEdges(nodes: BrainNode[], edgeCount: number): BrainEdge[] {
  const types: EdgeType[] = ['mentions', 'supports', 'contradicts', 'causes', 'follows', 'part_of', 'related', 'assigned_to', 'produced_by']
  const edges: BrainEdge[] = []

  for (let i = 0; i < edgeCount; i++) {
    const sourceIdx = Math.floor(Math.random() * nodes.length)
    let targetIdx = Math.floor(Math.random() * nodes.length)
    while (targetIdx === sourceIdx) {
      targetIdx = Math.floor(Math.random() * nodes.length)
    }

    edges.push({
      id: `edge-${i}`,
      source: nodes[sourceIdx].id,
      target: nodes[targetIdx].id,
      type: types[Math.floor(Math.random() * types.length)],
      weight: Math.random(),
      evidence: {
        memoryIds: [`mem-${i}`],
      },
      createdAt: Date.now() - Math.random() * 30 * 86400000,
    })
  }
  return edges
}

// ============================================
// GET Handler
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const { searchParams } = new URL(request.url)

    const scope = searchParams.get('scope') || 'agent'
    const limit = parseInt(searchParams.get('limit') || '100')

    const supabase = await createClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 실제 데이터 조회 시도
    let nodes: BrainNode[] = []
    let edges: BrainEdge[] = []

    // agent_memories에서 노드 생성 시도
    const { data: memories } = await supabase
      .from('agent_memories')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (memories && memories.length > 0) {
      // 실제 메모리 데이터를 노드로 변환
      nodes = memories.map((mem: any, idx: number) => ({
        id: mem.id,
        type: (mem.memory_type || 'memory') as NodeType,
        title: mem.title || mem.content?.substring(0, 50) || `메모리 #${idx}`,
        summary: mem.content?.substring(0, 200),
        createdAt: new Date(mem.created_at).getTime(),
        importance: mem.importance || 5,
        confidence: mem.confidence || 0.8,
        tags: mem.tags || [],
        source: {
          kind: mem.source_type || 'chat',
          ref: mem.source_ref,
        },
      }))

      // 간단한 연관 엣지 생성 (같은 태그를 가진 노드 연결)
      const tagMap = new Map<string, string[]>()
      nodes.forEach(node => {
        node.tags?.forEach(tag => {
          if (!tagMap.has(tag)) tagMap.set(tag, [])
          tagMap.get(tag)!.push(node.id)
        })
      })

      let edgeId = 0
      tagMap.forEach((nodeIds) => {
        for (let i = 0; i < nodeIds.length - 1; i++) {
          for (let j = i + 1; j < Math.min(i + 3, nodeIds.length); j++) {
            edges.push({
              id: `edge-${edgeId++}`,
              source: nodeIds[i],
              target: nodeIds[j],
              type: 'related',
              weight: 0.5,
              createdAt: Date.now(),
            })
          }
        }
      })
    }

    // 데이터가 없으면 Mock 데이터 사용
    if (nodes.length === 0) {
      const mockNodeCount = Math.min(limit, 50)
      nodes = generateMockNodes(mockNodeCount)
      edges = generateMockEdges(nodes, mockNodeCount * 2)
    }

    return NextResponse.json({
      nodes,
      edges,
      meta: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        isMockData: memories?.length === 0,
      },
    })
  } catch (error) {
    console.error('[Brain Graph API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Graph 데이터 조회 실패' },
      { status: 500 }
    )
  }
}
