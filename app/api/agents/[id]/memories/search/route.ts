/**
 * Agent Memory Search API
 *
 * POST /api/agents/:id/memories/search
 * 에이전트 메모리 벡터 검색 / 하이브리드 검색
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import {
  searchMemories,
  hybridSearch,
  fulltextSearch,
  getAccessibleMemories,
  type AgentMemoryType,
} from '@/lib/memory'

interface Params {
  params: { id: string }
}

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

    // 소유자가 아니어도 검색은 가능 (권한 필터 적용됨)
    const body = await request.json()

    const {
      query,
      searchType = 'hybrid',  // 'semantic' | 'hybrid' | 'fulltext'
      memoryTypes,
      relationshipId,
      meetingId,
      teamId,
      roomId,
      limit = 20,
      similarityThreshold = 0.7,
      minImportance,
      tags,
      weights,
      daysLimit,
    } = body

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    let results

    switch (searchType) {
      case 'semantic':
        results = await searchMemories({
          agentId,
          query,
          memoryTypes: memoryTypes as AgentMemoryType[],
          relationshipId,
          meetingId,
          teamId,
          roomId,
          limit,
          similarityThreshold,
          minImportance,
          tags,
        })
        break

      case 'fulltext':
        results = await fulltextSearch({
          agentId,
          query,
          memoryTypes: memoryTypes as AgentMemoryType[],
          relationshipId,
          meetingId,
          teamId,
          limit,
        })
        break

      case 'hybrid':
      default:
        results = await hybridSearch({
          agentId,
          query,
          memoryTypes: memoryTypes as AgentMemoryType[],
          relationshipId,
          meetingId,
          teamId,
          limit,
          minImportance,
          tags,
          weights,
          daysLimit,
        })
        break
    }

    // 소유자가 아니면 권한 필터 적용
    if (agent.owner_id !== user.id) {
      results = await getAccessibleMemories(agentId, user.id, results)
    }

    return NextResponse.json({
      success: true,
      searchType,
      query,
      results,
      count: results.length,
    })
  } catch (error) {
    console.error('[API] Memory search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
