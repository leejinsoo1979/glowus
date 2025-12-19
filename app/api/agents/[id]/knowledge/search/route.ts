/**
 * Agent Knowledge Search API
 *
 * POST /api/agents/:id/knowledge/search
 * 지식베이스 검색
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import {
  searchKnowledge,
  buildKnowledgeContext,
  type AccessLevel,
} from '@/lib/memory/agent-knowledge-service'

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

    if (agent.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      query,
      limit = 10,
      similarityThreshold = 0.7,
      category,
      accessLevel,
      tags,
      buildContext = false,  // true이면 RAG 컨텍스트 생성
      maxContextTokens = 2000,
    } = body

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // 기본 검색 또는 컨텍스트 빌딩
    if (buildContext) {
      const { context, sources } = await buildKnowledgeContext(agentId, query, {
        maxResults: limit,
        maxTokens: maxContextTokens,
        category,
      })

      return NextResponse.json({
        success: true,
        query,
        context,
        sources,
      })
    }

    const results = await searchKnowledge({
      agentId,
      query,
      limit,
      similarityThreshold,
      category,
      accessLevel: accessLevel as AccessLevel | undefined,
      tags,
    })

    return NextResponse.json({
      success: true,
      query,
      results,
      count: results.length,
    })
  } catch (error) {
    console.error('[API] Knowledge search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
