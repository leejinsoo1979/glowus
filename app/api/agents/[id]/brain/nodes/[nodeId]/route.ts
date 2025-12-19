export const dynamic = 'force-dynamic'

/**
 * Brain Map - Node Detail API
 * GET /api/agents/:agentId/brain/nodes/:nodeId
 *
 * 노드 상세 정보 + 관련 노드 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { BrainNode, BrainEdge } from '@/types/brain-map'

// 노드 타입 매핑
type NodeSource = 'work_log' | 'knowledge' | 'commit' | 'skill' | 'relationship'

// DB Row types
interface WorkLogRow {
  id: string
  title: string
  summary: string | null
  log_type: string
  importance: number | null
  created_at: string
  tags?: string[]
  confidence?: number
}

interface KnowledgeRow {
  id: string
  title: string
  summary: string | null
  knowledge_type: string
  tags: string[] | null
  created_at: string
}

interface CommitRow {
  id: string
  title: string
  summary: string | null
  commit_type: string | null
  created_at: string
}

interface SkillRow {
  id: string
  name: string
  description: string | null
  level: number | null
  created_at: string
}

interface RelationshipRow {
  id: string
  name: string
  description: string | null
  relationship_type: string | null
  created_at: string
}

interface NodeDetailResponse {
  node: BrainNode & {
    dataSource: NodeSource
    rawData: Record<string, unknown>
  }
  relatedNodes: Array<{
    node: BrainNode
    relationship: {
      type: string
      strength: number
      direction: 'incoming' | 'outgoing' | 'bidirectional'
    }
  }>
  edges: BrainEdge[]
  stats: {
    connectionCount: number
    incomingCount: number
    outgoingCount: number
    avgStrength: number
  }
}

// Parse node ID to determine source table
function parseNodeId(nodeId: string): { source: NodeSource; id: string } | null {
  const prefixes: Record<string, NodeSource> = {
    'log-': 'work_log',
    'knowledge-': 'knowledge',
    'commit-': 'commit',
    'skill-': 'skill',
    'rel-': 'relationship',
  }

  for (const [prefix, source] of Object.entries(prefixes)) {
    if (nodeId.startsWith(prefix)) {
      return { source, id: nodeId.slice(prefix.length) }
    }
  }

  // If no prefix, try as UUID directly
  return { source: 'work_log', id: nodeId }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  try {
    const { id: agentId, nodeId } = await params

    const supabase = await createClient()
    let user: { id: string } | null = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // Parse node ID
    const parsed = parseNodeId(nodeId)
    if (!parsed) {
      return NextResponse.json({ error: '잘못된 노드 ID' }, { status: 400 })
    }

    let nodeData: Record<string, unknown> | null = null
    let nodeType: BrainNode['type'] = 'memory'

    // Fetch node data based on source
    if (parsed.source === 'work_log') {
      const { data } = await supabase
        .from('agent_work_logs')
        .select('*')
        .eq('agent_id', agentId)
        .eq('id', parsed.id)
        .single()

      const typedData = data as WorkLogRow | null
      nodeData = typedData as Record<string, unknown> | null
      if (typedData) {
        nodeType = typedData.log_type === 'conversation' ? 'memory' :
                   typedData.log_type === 'task_work' ? 'task' :
                   typedData.log_type === 'meeting' ? 'meeting' : 'memory'
      }
    } else if (parsed.source === 'knowledge') {
      const { data } = await supabase
        .from('agent_knowledge')
        .select('*')
        .eq('agent_id', agentId)
        .eq('id', parsed.id)
        .single()

      nodeData = data as Record<string, unknown> | null
      nodeType = 'concept'
    } else if (parsed.source === 'commit') {
      const { data } = await supabase
        .from('agent_commits')
        .select('*')
        .eq('agent_id', agentId)
        .eq('id', parsed.id)
        .single()

      nodeData = data as Record<string, unknown> | null
      nodeType = 'decision'
    } else if (parsed.source === 'skill') {
      const { data } = await supabase
        .from('agent_skills')
        .select('*')
        .eq('agent_id', agentId)
        .eq('id', parsed.id)
        .single()

      nodeData = data as Record<string, unknown> | null
      nodeType = 'skill'
    } else if (parsed.source === 'relationship') {
      const { data } = await supabase
        .from('agent_relationships')
        .select('*')
        .eq('agent_id', agentId)
        .eq('id', parsed.id)
        .single()

      nodeData = data as Record<string, unknown> | null
      nodeType = 'person'
    }

    if (!nodeData) {
      return NextResponse.json({ error: '노드를 찾을 수 없습니다' }, { status: 404 })
    }

    // Build node object
    const node: BrainNode & { dataSource: NodeSource; rawData: Record<string, unknown> } = {
      id: nodeId,
      type: nodeType,
      title: String(nodeData.title || nodeData.name || 'Unknown'),
      summary: nodeData.summary as string | undefined || nodeData.description as string | undefined,
      tags: nodeData.tags as string[] | undefined || [],
      createdAt: new Date(nodeData.created_at as string).getTime(),
      importance: (nodeData.importance as number) || 50,
      confidence: (nodeData.confidence as number) || 0.8,
      dataSource: parsed.source,
      rawData: nodeData,
    }

    // Find related nodes - check knowledge links, same-day work logs, shared tags
    const relatedNodes: NodeDetailResponse['relatedNodes'] = []
    const edges: BrainEdge[] = []

    // 1. Find work logs on the same day (temporal relationship)
    const nodeDate = new Date(nodeData.created_at as string)
    const startOfDay = new Date(nodeDate.getFullYear(), nodeDate.getMonth(), nodeDate.getDate())
    const endOfDay = new Date(startOfDay.getTime() + 86400000)

    const { data: sameDayLogsRaw } = await supabase
      .from('agent_work_logs')
      .select('id, title, summary, log_type, importance, created_at')
      .eq('agent_id', agentId)
      .neq('id', parsed.source === 'work_log' ? parsed.id : '')
      .gte('created_at', startOfDay.toISOString())
      .lt('created_at', endOfDay.toISOString())
      .limit(5)

    const sameDayLogs = (sameDayLogsRaw || []) as WorkLogRow[]
    for (const log of sameDayLogs) {
      const relatedId = `log-${log.id}`
      relatedNodes.push({
        node: {
          id: relatedId,
          type: log.log_type === 'conversation' ? 'memory' :
                log.log_type === 'task_work' ? 'task' : 'memory',
          title: log.title,
          summary: log.summary || undefined,
          createdAt: new Date(log.created_at).getTime(),
          importance: log.importance || 50,
          confidence: 0.7,
        },
        relationship: {
          type: 'temporal',
          strength: 0.6,
          direction: 'bidirectional',
        },
      })
      edges.push({
        id: `edge-${nodeId}-${relatedId}`,
        source: nodeId,
        target: relatedId,
        type: 'related',
        weight: 0.6,
        createdAt: Date.now(),
      })
    }

    // 2. Find knowledge with shared tags (semantic relationship)
    const nodeTags = (nodeData.tags as string[]) || []
    if (nodeTags.length > 0) {
      const { data: relatedKnowledgeRaw } = await supabase
        .from('agent_knowledge')
        .select('id, title, summary, knowledge_type, tags, created_at')
        .eq('agent_id', agentId)
        .neq('id', parsed.source === 'knowledge' ? parsed.id : '')
        .overlaps('tags', nodeTags)
        .limit(5)

      const relatedKnowledge = (relatedKnowledgeRaw || []) as KnowledgeRow[]
      for (const k of relatedKnowledge) {
        const relatedId = `knowledge-${k.id}`
        const sharedTags = (k.tags || []).filter((t: string) => nodeTags.includes(t))
        const strength = Math.min(1.0, 0.3 + sharedTags.length * 0.2)

        relatedNodes.push({
          node: {
            id: relatedId,
            type: 'concept',
            title: k.title,
            summary: k.summary || undefined,
            tags: k.tags || [],
            createdAt: new Date(k.created_at).getTime(),
            importance: 70,
            confidence: 0.85,
          },
          relationship: {
            type: 'semantic',
            strength,
            direction: 'bidirectional',
          },
        })
        edges.push({
          id: `edge-${nodeId}-${relatedId}`,
          source: nodeId,
          target: relatedId,
          type: 'related',
          weight: strength,
          createdAt: Date.now(),
        })
      }
    }

    // 3. Find sequential commits (causal relationship)
    if (parsed.source === 'commit') {
      const { data: nearbyCommitsRaw } = await supabase
        .from('agent_commits')
        .select('id, title, summary, commit_type, created_at')
        .eq('agent_id', agentId)
        .neq('id', parsed.id)
        .order('created_at', { ascending: false })
        .limit(3)

      const nearbyCommits = (nearbyCommitsRaw || []) as CommitRow[]
      for (const commit of nearbyCommits) {
        const relatedId = `commit-${commit.id}`
        const commitTime = new Date(commit.created_at).getTime()
        const nodeTime = new Date(nodeData.created_at as string).getTime()
        const direction: 'incoming' | 'outgoing' = commitTime < nodeTime ? 'incoming' : 'outgoing'

        relatedNodes.push({
          node: {
            id: relatedId,
            type: 'decision',
            title: commit.title,
            summary: commit.summary || undefined,
            createdAt: commitTime,
            importance: 80,
            confidence: 1.0,
          },
          relationship: {
            type: 'causal',
            strength: 0.8,
            direction,
          },
        })
        edges.push({
          id: `edge-${nodeId}-${relatedId}`,
          source: direction === 'outgoing' ? nodeId : relatedId,
          target: direction === 'outgoing' ? relatedId : nodeId,
          type: 'follows',
          weight: 0.8,
          createdAt: Date.now(),
        })
      }
    }

    // Calculate stats
    const incomingCount = relatedNodes.filter(r => r.relationship.direction === 'incoming').length
    const outgoingCount = relatedNodes.filter(r => r.relationship.direction === 'outgoing').length
    const bidirectionalCount = relatedNodes.filter(r => r.relationship.direction === 'bidirectional').length
    const avgStrength = relatedNodes.length > 0
      ? relatedNodes.reduce((sum, r) => sum + r.relationship.strength, 0) / relatedNodes.length
      : 0

    const response: NodeDetailResponse = {
      node,
      relatedNodes,
      edges,
      stats: {
        connectionCount: relatedNodes.length,
        incomingCount: incomingCount + bidirectionalCount,
        outgoingCount: outgoingCount + bidirectionalCount,
        avgStrength: Math.round(avgStrength * 100) / 100,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Node Detail API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '노드 상세 조회 실패' },
      { status: 500 }
    )
  }
}
