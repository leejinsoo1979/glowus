/**
 * 마이뉴런 Graph API
 * GET: 그래프 데이터 조회
 */

import { NextResponse } from 'next/server'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { syncMyNeuronsGraph } from '@/lib/my-neurons/sync-service'

// 인메모리 캐시 (서버 재시작 시 초기화)
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 30 * 1000 // 30초 캐시

export async function GET() {
  try {
    const supabase = await createClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      )
    }

    const cacheKey = `neurons-${user.id}`
    const cached = cache.get(cacheKey)

    // 캐시가 유효하면 즉시 반환
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data)
    }

    const userName = user.user_metadata?.name || user.email?.split('@')[0] || '나'

    const result = await syncMyNeuronsGraph(user.id, userName)

    const responseData = {
      success: true,
      data: result.graph,
      bottlenecks: result.bottlenecks,
      priorities: result.priorities,
    }

    // 캐시 저장
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() })

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('[my-neurons/graph] Error:', error)
    return NextResponse.json(
      { error: '그래프 데이터를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
