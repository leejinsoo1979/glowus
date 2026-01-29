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

    // 1. agent_work_logs에서 노드 생성 (대화, 작업, 의사결정 등)
    const { data: workLogs } = await supabase
      .from('agent_work_logs')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(Math.floor(limit * 0.5))

    if (workLogs && workLogs.length > 0) {
      const logTypeToNodeType: Record<string, NodeType> = {
        'conversation': 'memory',
        'task_work': 'task',
        'decision': 'decision',
        'analysis': 'concept',
        'learning': 'skill',
        'collaboration': 'meeting',
        'error': 'memory',
        'milestone': 'decision',
      }

      workLogs.forEach((log: any) => {
        nodes.push({
          id: log.id,
          type: logTypeToNodeType[log.log_type] || 'memory',
          title: log.title || `${log.log_type} 로그`,
          summary: log.summary || log.content?.substring(0, 200),
          createdAt: new Date(log.created_at).getTime(),
          importance: log.importance || 5,
          confidence: 0.9,
          tags: log.tags || [],
          clusterId: log.project_id ? `project-${log.project_id}` : undefined,
          source: {
            kind: log.room_id ? 'chat' : 'tool',
            ref: log.room_id || log.task_id,
          },
        })
      })
    }

    // 2. agent_knowledge에서 노드 생성 (지식 베이스)
    const { data: knowledge } = await supabase
      .from('agent_knowledge')
      .select('*')
      .eq('agent_id', agentId)
      .order('use_count', { ascending: false })
      .limit(Math.floor(limit * 0.3))

    if (knowledge && knowledge.length > 0) {
      const knowledgeTypeToNodeType: Record<string, NodeType> = {
        'project': 'doc',
        'team': 'person',
        'domain': 'concept',
        'preference': 'skill',
        'procedure': 'tool',
        'decision_rule': 'decision',
        'lesson_learned': 'memory',
      }

      knowledge.forEach((k: any) => {
        nodes.push({
          id: k.id,
          type: knowledgeTypeToNodeType[k.knowledge_type] || 'concept',
          title: k.subject,
          summary: k.content?.substring(0, 200),
          createdAt: new Date(k.created_at).getTime(),
          updatedAt: k.updated_at ? new Date(k.updated_at).getTime() : undefined,
          importance: Math.min(10, Math.floor(k.use_count / 5) + 5),
          confidence: k.confidence || 0.8,
          tags: k.tags || [],
          clusterId: k.project_id ? `project-${k.project_id}` : `knowledge-${k.knowledge_type}`,
          source: {
            kind: 'tool',
            ref: k.id,
          },
        })
      })
    }

    // 3. agent_commits에서 노드 생성 (업무 요약)
    const { data: commits } = await supabase
      .from('agent_commits')
      .select('*')
      .eq('agent_id', agentId)
      .order('period_end', { ascending: false })
      .limit(Math.floor(limit * 0.2))

    if (commits && commits.length > 0) {
      commits.forEach((c: any) => {
        nodes.push({
          id: c.id,
          type: 'meeting' as NodeType,
          title: c.title,
          summary: c.summary?.substring(0, 200),
          createdAt: new Date(c.created_at).getTime(),
          importance: c.commit_type === 'milestone' ? 10 : (c.commit_type === 'weekly' ? 7 : 5),
          confidence: 1.0,
          tags: c.stats?.key_topics || [],
          clusterId: `commit-${c.commit_type}`,
          source: {
            kind: 'tool',
            ref: c.id,
          },
        })
      })
    }

    // 4. 엣지 생성 - 같은 태그/클러스터/시간대 기반 연결
    if (nodes.length > 0) {
      let edgeId = 0

      // 태그 기반 연결
      const tagMap = new Map<string, string[]>()
      nodes.forEach(node => {
        node.tags?.forEach(tag => {
          if (!tagMap.has(tag)) tagMap.set(tag, [])
          tagMap.get(tag)!.push(node.id)
        })
      })

      tagMap.forEach((nodeIds) => {
        for (let i = 0; i < nodeIds.length - 1; i++) {
          for (let j = i + 1; j < Math.min(i + 3, nodeIds.length); j++) {
            edges.push({
              id: `edge-tag-${edgeId++}`,
              source: nodeIds[i],
              target: nodeIds[j],
              type: 'related',
              weight: 0.6,
              createdAt: Date.now(),
            })
          }
        }
      })

      // 클러스터 기반 연결
      const clusterMap = new Map<string, string[]>()
      nodes.forEach(node => {
        if (node.clusterId) {
          if (!clusterMap.has(node.clusterId)) clusterMap.set(node.clusterId, [])
          clusterMap.get(node.clusterId)!.push(node.id)
        }
      })

      clusterMap.forEach((nodeIds) => {
        for (let i = 0; i < nodeIds.length - 1; i++) {
          edges.push({
            id: `edge-cluster-${edgeId++}`,
            source: nodeIds[i],
            target: nodeIds[i + 1],
            type: 'part_of',
            weight: 0.8,
            createdAt: Date.now(),
          })
        }
      })

      // 시간순 연결 (follows)
      const sortedNodes = [...nodes].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      for (let i = 0; i < sortedNodes.length - 1; i++) {
        if (Math.random() > 0.7) { // 일부만 연결
          edges.push({
            id: `edge-time-${edgeId++}`,
            source: sortedNodes[i].id,
            target: sortedNodes[i + 1].id,
            type: 'follows',
            weight: 0.4,
            createdAt: Date.now(),
          })
        }
      }
    }

    // 실제 데이터만 반환 (Mock 데이터 제거)
    return NextResponse.json({
      nodes,
      edges,
      meta: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        isEmpty: nodes.length === 0,
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
