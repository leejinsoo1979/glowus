/**
 * Memory Search API - 하이브리드 검색 엔드포인트
 *
 * POST: 시맨틱 + 시간 + 중요도 기반 하이브리드 검색
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createMemoryEmbeddingService, createImmutableMemoryService } from '@/lib/memory'
import { HybridSearchQuery, MemoryEventType, MemoryRole } from '@/types/memory'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      query_text,
      temporal,
      event_types,
      roles,
      source_agents,
      tags,
      sort_by,
      sort_order,
      limit,
      offset,
      weights,
    } = body as HybridSearchQuery

    // 최소한 하나의 검색 조건 필요
    if (!query_text && !temporal && !event_types && !source_agents) {
      return NextResponse.json(
        { error: '최소 하나의 검색 조건이 필요합니다.' },
        { status: 400 }
      )
    }

    // 시맨틱 검색이 있는 경우 임베딩 서비스 사용
    if (query_text) {
      const embeddingService = createMemoryEmbeddingService(supabase, user.id)

      const results = await embeddingService.hybridSearch({
        query_text,
        temporal,
        event_types,
        roles,
        source_agents,
        tags,
        sort_by,
        sort_order,
        limit,
        offset,
        weights,
      })

      return NextResponse.json({
        success: true,
        ...results,
      })
    }

    // 시맨틱 검색 없이 필터링만 하는 경우
    const memoryService = createImmutableMemoryService(supabase, user.id)

    let memories

    if (temporal) {
      memories = await memoryService.queryByTime(temporal)
    } else if (event_types && event_types.length > 0) {
      memories = await memoryService.filterByEventType(event_types, { limit, offset })
    } else if (source_agents && source_agents.length > 0) {
      memories = await memoryService.filterByAgent(source_agents[0], { limit, offset })
    } else {
      memories = await memoryService.getRecent(limit || 20)
    }

    return NextResponse.json({
      success: true,
      results: memories.map((m) => ({
        memory: m,
        scores: { combined: 1 },
      })),
      total_count: memories.length,
      query_time_ms: 0,
      limit: limit || 20,
      offset: offset || 0,
      has_more: false,
    })
  } catch (error) {
    console.error('Memory search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET: 간단한 텍스트 검색
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const q = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    if (!q) {
      return NextResponse.json({ error: '검색어(q)가 필요합니다.' }, { status: 400 })
    }

    const memoryService = createImmutableMemoryService(supabase, user.id)
    const results = await memoryService.searchByText(q, { limit })

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    })
  } catch (error) {
    console.error('Memory text search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
