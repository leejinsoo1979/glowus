/**
 * Memory API - 메모리 CRUD 엔드포인트
 *
 * GET: 최근 메모리 조회 또는 필터링된 메모리 조회
 * POST: 새 메모리 추가 (불변 - Append-Only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createImmutableMemoryService,
  createMemoryEmbeddingService,
  createMemoryAnalysisService,
} from '@/lib/memory'
import { CreateMemoryInput, MemoryEventType, MemoryRole } from '@/types/memory'

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
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const eventType = searchParams.get('event_type') as MemoryEventType | null
    const agent = searchParams.get('agent')
    const sessionId = searchParams.get('session_id')
    const date = searchParams.get('date')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const natural = searchParams.get('natural') // 자연어 시간 표현

    const memoryService = createImmutableMemoryService(supabase, user.id)

    let memories

    // 세션 ID로 조회
    if (sessionId) {
      memories = await memoryService.getBySessionId(sessionId)
    }
    // 자연어 시간 표현으로 조회
    else if (natural) {
      memories = await memoryService.queryByTime({ natural })
    }
    // 특정 날짜로 조회
    else if (date) {
      memories = await memoryService.getByDate(date)
    }
    // 날짜 범위로 조회
    else if (startDate && endDate) {
      memories = await memoryService.getByDateRange(startDate, endDate)
    }
    // 이벤트 타입으로 필터링
    else if (eventType) {
      memories = await memoryService.filterByEventType([eventType], { limit, offset })
    }
    // 에이전트로 필터링
    else if (agent) {
      memories = await memoryService.filterByAgent(agent, { limit, offset })
    }
    // 기본: 최근 메모리
    else {
      memories = await memoryService.getRecent(limit)
    }

    return NextResponse.json({
      success: true,
      data: memories,
      count: memories.length,
    })
  } catch (error) {
    console.error('Memory GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

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
      raw_content,
      event_type,
      role,
      source_agent,
      source_model,
      session_id,
      parent_id,
      context,
      timestamp,
      auto_embed = true,
      auto_analyze = false,
    } = body as CreateMemoryInput & {
      auto_embed?: boolean
      auto_analyze?: boolean
    }

    // 필수 필드 검증
    if (!raw_content || !event_type || !role) {
      return NextResponse.json(
        { error: 'raw_content, event_type, role 필드는 필수입니다.' },
        { status: 400 }
      )
    }

    const memoryService = createImmutableMemoryService(supabase, user.id)

    // 메모리 저장 (불변)
    const memory = await memoryService.append({
      raw_content,
      event_type,
      role,
      source_agent,
      source_model,
      session_id,
      parent_id,
      context,
      timestamp,
    })

    // 자동 임베딩 생성
    if (auto_embed) {
      try {
        const embeddingService = createMemoryEmbeddingService(supabase, user.id)
        await embeddingService.createEmbeddingForMemory(memory)
      } catch (embError) {
        console.error('Auto embedding failed:', embError)
        // 임베딩 실패해도 메모리 저장은 성공으로 처리
      }
    }

    // 자동 분석 생성
    if (auto_analyze) {
      try {
        const analysisService = createMemoryAnalysisService(supabase, user.id)
        await analysisService.analyzeMemory(memory)
      } catch (anaError) {
        console.error('Auto analysis failed:', anaError)
        // 분석 실패해도 메모리 저장은 성공으로 처리
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: memory,
        message: '메모리가 영구적으로 저장되었습니다.',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Memory POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
