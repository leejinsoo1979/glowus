/**
 * Memory Timeline API - 타임라인 및 통계 엔드포인트
 *
 * GET: 일별 타임라인 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createImmutableMemoryService } from '@/lib/memory'

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
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const type = searchParams.get('type') || 'timeline' // timeline | statistics

    const memoryService = createImmutableMemoryService(supabase, user.id)

    if (type === 'statistics') {
      // 전체 통계 또는 기간별 통계
      if (startDate && endDate) {
        const stats = await memoryService.getStatisticsByPeriod(startDate, endDate)
        return NextResponse.json({
          success: true,
          data: stats,
        })
      } else {
        const stats = await memoryService.getStatistics()
        return NextResponse.json({
          success: true,
          data: stats,
        })
      }
    }

    // 타임라인 조회
    if (!startDate || !endDate) {
      // 기본값: 최근 7일
      const today = new Date()
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

      const defaultEndDate = today.toISOString().split('T')[0]
      const defaultStartDate = weekAgo.toISOString().split('T')[0]

      const timeline = await memoryService.getDailyTimeline(defaultStartDate, defaultEndDate)
      return NextResponse.json({
        success: true,
        data: timeline,
      })
    }

    const timeline = await memoryService.getDailyTimeline(startDate, endDate)

    return NextResponse.json({
      success: true,
      data: timeline,
    })
  } catch (error) {
    console.error('Memory timeline error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
