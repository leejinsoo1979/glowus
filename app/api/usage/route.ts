export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { getDailyUsage, getMonthlyTotal, MODEL_PRICING } from '@/lib/usage/tracker'

/**
 * GET /api/usage
 * 사용자의 API 사용량 조회
 *
 * Query params:
 * - period: 'daily' | 'monthly' (default: 'monthly')
 * - days: number (daily 조회 시 최근 N일, default: 30)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data, error: authError } = await supabase.auth.getUser()
      if (authError || !data.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = data.user
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'monthly'
    const days = parseInt(searchParams.get('days') || '30', 10)

    if (period === 'daily') {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const dailyUsage = await getDailyUsage(user.id, startDate, endDate)

      return NextResponse.json({
        period: 'daily',
        days,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        usage: dailyUsage,
      })
    }

    // 이번 달 총 사용량
    const monthlyTotal = await getMonthlyTotal(user.id)

    return NextResponse.json({
      period: 'monthly',
      month: new Date().toISOString().slice(0, 7), // YYYY-MM
      ...monthlyTotal,
    })
  } catch (error) {
    console.error('[Usage API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/usage/pricing
 * 모델별 가격 정보 조회
 */
export async function OPTIONS() {
  return NextResponse.json({ pricing: MODEL_PRICING })
}
