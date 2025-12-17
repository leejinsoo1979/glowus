/**
 * Memory ID API - 개별 메모리 조회 및 관련 작업 엔드포인트
 *
 * GET: 개별 메모리 조회 (임베딩, 분석 포함 옵션)
 *
 * 참고: 메모리는 불변이므로 UPDATE/DELETE는 없음
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createImmutableMemoryService,
  createMemoryEmbeddingService,
  createMemoryAnalysisService,
} from '@/lib/memory'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const includeEmbedding = searchParams.get('include_embedding') === 'true'
    const includeAnalysis = searchParams.get('include_analysis') === 'true'
    const includeChain = searchParams.get('include_chain') === 'true'
    const includeSimilar = searchParams.get('include_similar') === 'true'

    const memoryService = createImmutableMemoryService(supabase, user.id)

    // 기본 메모리 조회
    const memory = await memoryService.getById(id)

    if (!memory) {
      return NextResponse.json({ error: '메모리를 찾을 수 없습니다.' }, { status: 404 })
    }

    const result: {
      memory: typeof memory
      embedding?: unknown
      analysis?: unknown
      chain?: unknown
      similar?: unknown
    } = {
      memory,
    }

    // 임베딩 포함
    if (includeEmbedding) {
      try {
        const embeddingService = createMemoryEmbeddingService(supabase, user.id)
        result.embedding = await embeddingService.getEmbeddingByMemoryId(id)
      } catch (e) {
        result.embedding = null
      }
    }

    // 분석 포함
    if (includeAnalysis) {
      try {
        const analysisService = createMemoryAnalysisService(supabase, user.id)
        result.analysis = await analysisService.getAnalysisByMemoryId(id)
      } catch (e) {
        result.analysis = null
      }
    }

    // 대화 체인 포함
    if (includeChain) {
      try {
        result.chain = await memoryService.getConversationChain(id)
      } catch (e) {
        result.chain = null
      }
    }

    // 유사 메모리 포함
    if (includeSimilar) {
      try {
        const embeddingService = createMemoryEmbeddingService(supabase, user.id)
        result.similar = await embeddingService.findSimilarMemories(id, { limit: 5 })
      } catch (e) {
        result.similar = null
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Memory GET by ID error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST: 개별 메모리에 대한 임베딩/분석 생성
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { action } = body as { action: 'embed' | 'analyze' | 'both' }

    if (!action || !['embed', 'analyze', 'both'].includes(action)) {
      return NextResponse.json(
        { error: 'action 필드가 필요합니다. (embed, analyze, both)' },
        { status: 400 }
      )
    }

    const memoryService = createImmutableMemoryService(supabase, user.id)
    const memory = await memoryService.getById(id)

    if (!memory) {
      return NextResponse.json({ error: '메모리를 찾을 수 없습니다.' }, { status: 404 })
    }

    const result: {
      embedding?: unknown
      analysis?: unknown
    } = {}

    if (action === 'embed' || action === 'both') {
      const embeddingService = createMemoryEmbeddingService(supabase, user.id)
      result.embedding = await embeddingService.createEmbeddingForMemory(memory)
    }

    if (action === 'analyze' || action === 'both') {
      const analysisService = createMemoryAnalysisService(supabase, user.id)
      result.analysis = await analysisService.analyzeMemory(memory)
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: `${action} 작업이 완료되었습니다.`,
    })
  } catch (error) {
    console.error('Memory POST by ID error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
