export const dynamic = 'force-dynamic'

/**
 * Brain Map - Roadmap API (시간순 타임라인)
 * GET /api/agents/:agentId/brain/roadmap
 *
 * 실제 DB 데이터 기반 시간순 타임라인 시각화
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { BrainNode, BrainEdge, NodeType, EdgeType } from '@/types/brain-map'

// DB Row types
interface WorkLogRow {
  id: string
  title: string
  summary: string | null
  log_type: string
  importance: number | null
  created_at: string
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

interface RoadmapEvent {
  id: string
  timestamp: number
  type: 'milestone' | 'decision' | 'learning' | 'creation' | 'conversation' | 'task'
  title: string
  description: string
  relatedNodes: string[]
  importance: number
  category: string
}

interface TimeGroup {
  label: string
  startTime: number
  endTime: number
  events: RoadmapEvent[]
}

interface RoadmapResponse {
  timeline: RoadmapEvent[]
  timeGroups: TimeGroup[]
  nodes: BrainNode[]
  edges: BrainEdge[]
  dateRange: {
    start: number
    end: number
  }
}

// Map log_type to event type
function mapLogTypeToEventType(logType: string): RoadmapEvent['type'] {
  const mapping: Record<string, RoadmapEvent['type']> = {
    'conversation': 'conversation',
    'task_work': 'task',
    'decision': 'decision',
    'discovery': 'learning',
    'meeting': 'milestone',
    'reflection': 'learning',
  }
  return mapping[logType] || 'creation'
}

// Map knowledge_type to event type
function mapKnowledgeTypeToEventType(knowledgeType: string): RoadmapEvent['type'] {
  const mapping: Record<string, RoadmapEvent['type']> = {
    'project': 'milestone',
    'team': 'learning',
    'business': 'decision',
    'technical': 'learning',
    'personal': 'creation',
    'market': 'learning',
    'product': 'milestone',
  }
  return mapping[knowledgeType] || 'learning'
}

// Group events by time granularity
function groupEventsByTime(
  events: RoadmapEvent[],
  granularity: 'day' | 'week' | 'month'
): TimeGroup[] {
  const groups: Map<string, TimeGroup> = new Map()

  events.forEach(event => {
    const date = new Date(event.timestamp)
    let groupKey: string
    let groupLabel: string
    let groupStart: Date
    let groupEnd: Date

    if (granularity === 'day') {
      groupKey = date.toISOString().split('T')[0]
      groupLabel = date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })
      groupStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      groupEnd = new Date(groupStart.getTime() + 86400000 - 1)
    } else if (granularity === 'week') {
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      groupKey = weekStart.toISOString().split('T')[0]
      groupLabel = `${weekStart.getMonth() + 1}월 ${Math.ceil(weekStart.getDate() / 7)}주차`
      groupStart = weekStart
      groupEnd = new Date(weekStart.getTime() + 7 * 86400000 - 1)
    } else {
      groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      groupLabel = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })
      groupStart = new Date(date.getFullYear(), date.getMonth(), 1)
      groupEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59)
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        label: groupLabel,
        startTime: groupStart.getTime(),
        endTime: groupEnd.getTime(),
        events: [],
      })
    }

    groups.get(groupKey)!.events.push(event)
  })

  // Sort groups by time and events within each group
  const sortedGroups = Array.from(groups.values())
    .sort((a, b) => a.startTime - b.startTime)

  sortedGroups.forEach(group => {
    group.events.sort((a, b) => a.timestamp - b.timestamp)
  })

  return sortedGroups
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const { searchParams } = new URL(request.url)

    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const granularity = (searchParams.get('granularity') || 'day') as 'day' | 'week' | 'month'

    // Default: last 30 days
    const endDate = endDateParam ? parseInt(endDateParam) : Date.now()
    const startDate = startDateParam ? parseInt(startDateParam) : (endDate - 30 * 86400000)

    const startDateISO = new Date(startDate).toISOString()
    const endDateISO = new Date(endDate).toISOString()

    const supabase = await createClient()
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // Fetch all data sources in parallel
    const [workLogsResult, knowledgeResult, commitsResult] = await Promise.all([
      // Work logs (conversations, tasks, meetings)
      supabase
        .from('agent_work_logs')
        .select('id, title, summary, log_type, importance, created_at')
        .eq('agent_id', agentId)
        .gte('created_at', startDateISO)
        .lte('created_at', endDateISO)
        .order('created_at', { ascending: true }),

      // Knowledge
      supabase
        .from('agent_knowledge')
        .select('id, title, summary, knowledge_type, tags, created_at')
        .eq('agent_id', agentId)
        .gte('created_at', startDateISO)
        .lte('created_at', endDateISO)
        .order('created_at', { ascending: true }),

      // Commits (daily summaries)
      supabase
        .from('agent_commits')
        .select('id, title, summary, commit_type, created_at')
        .eq('agent_id', agentId)
        .gte('created_at', startDateISO)
        .lte('created_at', endDateISO)
        .order('created_at', { ascending: true }),
    ])

    const workLogs = (workLogsResult.data || []) as WorkLogRow[]
    const knowledge = (knowledgeResult.data || []) as KnowledgeRow[]
    const commits = (commitsResult.data || []) as CommitRow[]

    // Convert to timeline events
    const events: RoadmapEvent[] = []
    const nodes: BrainNode[] = []

    // Process work logs
    workLogs.forEach(log => {
      const timestamp = new Date(log.created_at).getTime()
      const nodeId = `log-${log.id}`

      events.push({
        id: `event-log-${log.id}`,
        timestamp,
        type: mapLogTypeToEventType(log.log_type),
        title: log.title,
        description: log.summary || '',
        relatedNodes: [nodeId],
        importance: log.importance || 5,
        category: log.log_type,
      })

      nodes.push({
        id: nodeId,
        type: log.log_type === 'conversation' ? 'memory' :
              log.log_type === 'task_work' ? 'task' :
              log.log_type === 'meeting' ? 'meeting' : 'memory',
        title: log.title,
        summary: log.summary || undefined,
        createdAt: timestamp,
        importance: log.importance || 5,
        confidence: 0.9,
      })
    })

    // Process knowledge
    knowledge.forEach(k => {
      const timestamp = new Date(k.created_at).getTime()
      const nodeId = `knowledge-${k.id}`

      events.push({
        id: `event-knowledge-${k.id}`,
        timestamp,
        type: mapKnowledgeTypeToEventType(k.knowledge_type),
        title: k.title,
        description: k.summary || '',
        relatedNodes: [nodeId],
        importance: 7,
        category: k.knowledge_type,
      })

      nodes.push({
        id: nodeId,
        type: 'concept',
        title: k.title,
        summary: k.summary || undefined,
        tags: k.tags || [],
        createdAt: timestamp,
        importance: 7,
        confidence: 0.85,
      })
    })

    // Process commits (milestones)
    commits.forEach(commit => {
      const timestamp = new Date(commit.created_at).getTime()
      const nodeId = `commit-${commit.id}`

      events.push({
        id: `event-commit-${commit.id}`,
        timestamp,
        type: 'milestone',
        title: commit.title,
        description: commit.summary || '',
        relatedNodes: [nodeId],
        importance: 8,
        category: commit.commit_type || 'daily',
      })

      nodes.push({
        id: nodeId,
        type: 'decision',
        title: commit.title,
        summary: commit.summary || undefined,
        createdAt: timestamp,
        importance: 8,
        confidence: 1.0,
      })
    })

    // Sort events by timestamp
    events.sort((a, b) => a.timestamp - b.timestamp)

    // Create sequential edges (timeline connections)
    const edges: BrainEdge[] = []
    for (let i = 1; i < nodes.length; i++) {
      edges.push({
        id: `edge-timeline-${i}`,
        source: nodes[i - 1].id,
        target: nodes[i].id,
        type: 'follows',
        weight: 0.7,
        createdAt: nodes[i].createdAt || Date.now(),
      })
    }

    // Group events by granularity
    const timeGroups = groupEventsByTime(events, granularity)

    return NextResponse.json({
      timeline: events,
      timeGroups,
      nodes,
      edges,
      dateRange: {
        start: startDate,
        end: endDate
      },
      meta: {
        eventCount: events.length,
        nodeCount: nodes.length,
        granularity,
        sources: {
          workLogs: workLogs.length,
          knowledge: knowledge.length,
          commits: commits.length,
        },
      },
    } as RoadmapResponse & { meta: any })
  } catch (error) {
    console.error('[Brain Roadmap API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Roadmap 조회 실패' },
      { status: 500 }
    )
  }
}
