import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

/**
 * 정부지원사업 목록 조회 API
 * GET /api/government-programs
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const status = searchParams.get('status') // 'active' | 'ended' | 'upcoming' | 'all'
    const source = searchParams.get('source')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // 쿼리 빌드
    let query = supabase
      .from('government_programs')
      .select('*', { count: 'exact' })

    // 필터 적용
    if (category) {
      query = query.eq('category', category)
    }

    if (source) {
      query = query.eq('source', source)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,organization.ilike.%${search}%`)
    }

    // 상태별 필터
    const today = new Date().toISOString().split('T')[0]
    if (status === 'active') {
      query = query.gte('apply_end_date', today).lte('apply_start_date', today)
    } else if (status === 'upcoming') {
      query = query.gt('apply_start_date', today)
    } else if (status === 'ended') {
      query = query.lt('apply_end_date', today)
    }

    // 정렬 및 페이지네이션
    query = query
      .order('apply_end_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: programs, error, count } = await query

    if (error) {
      console.error('[GovernmentPrograms] DB 조회 오류:', error)
      throw error
    }

    // 카테고리별 통계
    const { data: stats } = await supabase
      .from('government_programs')
      .select('category')

    const categoryStats: Record<string, number> = {}
    stats?.forEach(item => {
      const cat = item.category || '기타'
      categoryStats[cat] = (categoryStats[cat] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      programs: programs || [],
      total: count || 0,
      categoryStats,
      pagination: {
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    })

  } catch (error: any) {
    console.error('[GovernmentPrograms] Error:', error)
    return NextResponse.json(
      { error: error.message || '데이터 조회 실패' },
      { status: 500 }
    )
  }
}
