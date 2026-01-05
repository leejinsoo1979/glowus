// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface DashboardStats {
  totalPrograms: number
  activePrograms: number
  endingSoonPrograms: number
  upcomingPrograms: number
  latestPrograms: number      // 최신공고 (7일 내 등록)
  eventCount: number          // 행사정보 수
  monthlyApplications: number
  sourceCounts: Record<string, number>
  categoryCounts: Record<string, number>
  statusCounts: Record<string, number>
  monthlyTrend: { month: string; count: number }[]
  regionCounts: Record<string, number>
  // 마감일 기준 데이터
  deadlineTrend: { month: string; count: number }[]  // 마감월별 공고 분포
  deadlineByYear: Record<string, { month: string; count: number }[]>  // 연도별 마감 분포
}

/**
 * 정부지원사업 대시보드 통계 API
 * GET /api/government-programs/dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date().toISOString().split('T')[0]

    // 1. 캐시된 통계 확인 (오늘 날짜)
    const { data: cachedStats } = await adminSupabase
      .from('program_statistics')
      .select('*')
      .eq('period_type', 'daily')
      .eq('period_date', today)
      .single()

    if (cachedStats) {
      // 캐시된 데이터가 있으면 반환
      const stats: DashboardStats = {
        totalPrograms: cachedStats.total_programs || 0,
        activePrograms: cachedStats.active_programs || 0,
        endingSoonPrograms: cachedStats.ending_soon_programs || 0,
        upcomingPrograms: cachedStats.upcoming_programs || 0,
        latestPrograms: cachedStats.latest_programs || 0,
        eventCount: cachedStats.event_count || 0,
        monthlyApplications: 0, // 별도 조회 필요
        sourceCounts: cachedStats.source_counts || {},
        categoryCounts: cachedStats.category_counts || {},
        statusCounts: cachedStats.status_counts || {},
        monthlyTrend: cachedStats.monthly_trend || [],
        regionCounts: cachedStats.region_counts || {},
        deadlineTrend: cachedStats.deadline_trend || [],
        deadlineByYear: cachedStats.deadline_by_year || {}
      }

      // 월별 신청 수 조회
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const { count: appCount } = await adminSupabase
        .from('program_applications')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .gte('created_at', monthStart.toISOString())

      stats.monthlyApplications = appCount || 0

      return NextResponse.json({
        success: true,
        stats,
        cached: true,
        cachedAt: cachedStats.created_at
      })
    }

    // 2. 캐시가 없으면 실시간 계산
    const stats = await calculateRealTimeStats(adminSupabase, user.id)

    // 3. 통계 캐시 저장 (백그라운드)
    saveStatsToCache(adminSupabase, stats, today).catch(err => {
      console.error('[Dashboard] Failed to cache stats:', err)
    })

    return NextResponse.json({
      success: true,
      stats,
      cached: false
    })

  } catch (error: any) {
    console.error('[Dashboard] Error:', error)
    return NextResponse.json(
      { error: error.message || '대시보드 데이터 조회 실패' },
      { status: 500 }
    )
  }
}

/**
 * 실시간 통계 계산
 */
async function calculateRealTimeStats(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<DashboardStats> {
  const today = new Date().toISOString().split('T')[0]
  const sevenDaysLater = new Date()
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
  const sevenDaysLaterStr = sevenDaysLater.toISOString().split('T')[0]

  // 7일 전 날짜 (최신공고 기준)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString()

  // 병렬로 모든 쿼리 실행
  const [
    totalResult,
    activeResult,
    endingSoonResult,
    upcomingResult,
    sourceResult,
    categoryResult,
    trendResult,
    applicationResult,
    deadlineResult,  // 마감일 기준 데이터
    latestResult,    // 최신공고 (7일 내 등록)
    eventResult      // 행사정보 수
  ] = await Promise.all([
    // 전체 프로그램 수
    supabase
      .from('government_programs')
      .select('id', { count: 'exact' })
      .or('archived.is.null,archived.eq.false'),

    // 진행 중 프로그램
    supabase
      .from('government_programs')
      .select('id', { count: 'exact' })
      .or('archived.is.null,archived.eq.false')
      .lte('apply_start_date', today)
      .gte('apply_end_date', today),

    // 7일 내 마감
    supabase
      .from('government_programs')
      .select('id', { count: 'exact' })
      .or('archived.is.null,archived.eq.false')
      .gte('apply_end_date', today)
      .lte('apply_end_date', sevenDaysLaterStr),

    // 예정 프로그램
    supabase
      .from('government_programs')
      .select('id', { count: 'exact' })
      .or('archived.is.null,archived.eq.false')
      .gt('apply_start_date', today),

    // 출처별 분포
    supabase
      .from('government_programs')
      .select('source')
      .or('archived.is.null,archived.eq.false'),

    // 카테고리별 분포
    supabase
      .from('government_programs')
      .select('category')
      .or('archived.is.null,archived.eq.false'),

    // 월별 트렌드 (최근 12개월 - 등록일 기준)
    supabase
      .from('government_programs')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
      .or('archived.is.null,archived.eq.false'),

    // 이번 달 신청 수
    supabase
      .from('program_applications')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', new Date(new Date().setDate(1)).toISOString()),

    // 마감일 기준 데이터 (전체 - 마감일이 있는 것만)
    supabase
      .from('government_programs')
      .select('apply_end_date')
      .or('archived.is.null,archived.eq.false')
      .not('apply_end_date', 'is', null),

    // 최신공고 (7일 내 등록)
    supabase
      .from('government_programs')
      .select('id', { count: 'exact' })
      .or('archived.is.null,archived.eq.false')
      .gte('created_at', sevenDaysAgoStr),

    // 행사정보 수
    supabase
      .from('government_programs')
      .select('id', { count: 'exact' })
      .or('archived.is.null,archived.eq.false')
      .eq('source', 'bizinfo_event')
  ])

  // 출처별 카운트 계산
  const sourceCounts: Record<string, number> = {}
  sourceResult.data?.forEach((item: any) => {
    const source = item.source || 'unknown'
    sourceCounts[source] = (sourceCounts[source] || 0) + 1
  })

  // 카테고리별 카운트 계산
  const categoryCounts: Record<string, number> = {}
  categoryResult.data?.forEach((item: any) => {
    const category = item.category || '기타'
    categoryCounts[category] = (categoryCounts[category] || 0) + 1
  })

  // 월별 트렌드 계산
  const monthlyMap: Record<string, number> = {}
  trendResult.data?.forEach((item: any) => {
    const month = item.created_at?.substring(0, 7) // YYYY-MM
    if (month) {
      monthlyMap[month] = (monthlyMap[month] || 0) + 1
    }
  })

  const monthlyTrend = Object.entries(monthlyMap)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // 마감일 기준 데이터 처리
  const deadlineMap: Record<string, number> = {}
  const deadlineByYearMap: Record<string, Record<string, number>> = {}

  deadlineResult.data?.forEach((item: any) => {
    const endDate = item.apply_end_date
    if (endDate) {
      const month = endDate.substring(0, 7) // YYYY-MM
      const year = endDate.substring(0, 4)  // YYYY
      const monthOnly = endDate.substring(5, 7) // MM

      // 전체 마감월별 분포
      deadlineMap[month] = (deadlineMap[month] || 0) + 1

      // 연도별 마감 분포
      if (!deadlineByYearMap[year]) {
        deadlineByYearMap[year] = {}
      }
      deadlineByYearMap[year][monthOnly] = (deadlineByYearMap[year][monthOnly] || 0) + 1
    }
  })

  // 마감월별 트렌드 (정렬)
  const deadlineTrend = Object.entries(deadlineMap)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // 연도별 마감 분포 (각 연도의 월별 데이터를 배열로 변환)
  const deadlineByYear: Record<string, { month: string; count: number }[]> = {}
  Object.entries(deadlineByYearMap).forEach(([year, monthData]) => {
    deadlineByYear[year] = Object.entries(monthData)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month))
  })

  // 상태별 카운트
  const totalPrograms = totalResult.count || 0
  const activePrograms = activeResult.count || 0
  const endingSoonPrograms = endingSoonResult.count || 0
  const upcomingPrograms = upcomingResult.count || 0

  const statusCounts: Record<string, number> = {
    active: activePrograms,
    ending_soon: endingSoonPrograms,
    upcoming: upcomingPrograms,
    ended: Math.max(0, totalPrograms - activePrograms - upcomingPrograms)
  }

  return {
    totalPrograms,
    activePrograms,
    endingSoonPrograms,
    upcomingPrograms,
    latestPrograms: latestResult.count || 0,
    eventCount: eventResult.count || 0,
    monthlyApplications: applicationResult.count || 0,
    sourceCounts,
    categoryCounts,
    statusCounts,
    monthlyTrend,
    regionCounts: {}, // 지역 정보는 추후 추가
    deadlineTrend,
    deadlineByYear
  }
}

/**
 * 통계를 캐시에 저장
 */
async function saveStatsToCache(
  supabase: ReturnType<typeof createAdminClient>,
  stats: DashboardStats,
  date: string
): Promise<void> {
  await supabase
    .from('program_statistics')
    .upsert({
      period_type: 'daily',
      period_date: date,
      total_programs: stats.totalPrograms,
      active_programs: stats.activePrograms,
      ending_soon_programs: stats.endingSoonPrograms,
      upcoming_programs: stats.upcomingPrograms,
      latest_programs: stats.latestPrograms,
      event_count: stats.eventCount,
      source_counts: stats.sourceCounts,
      category_counts: stats.categoryCounts,
      status_counts: stats.statusCounts,
      monthly_trend: stats.monthlyTrend,
      region_counts: stats.regionCounts,
      deadline_trend: stats.deadlineTrend,
      deadline_by_year: stats.deadlineByYear
    }, {
      onConflict: 'period_type,period_date'
    })
}

/**
 * POST: 통계 새로고침 (강제 재계산)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date().toISOString().split('T')[0]

    // 강제 재계산
    const stats = await calculateRealTimeStats(adminSupabase, user.id)

    // 캐시 업데이트
    await saveStatsToCache(adminSupabase, stats, today)

    return NextResponse.json({
      success: true,
      stats,
      refreshedAt: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('[Dashboard Refresh] Error:', error)
    return NextResponse.json(
      { error: error.message || '통계 새로고침 실패' },
      { status: 500 }
    )
  }
}
