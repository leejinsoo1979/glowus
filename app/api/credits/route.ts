export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import {
  getUserCredits,
  getCreditHistory,
  checkCredits,
  CREDIT_PRICING,
  SUBSCRIPTION_TIERS,
} from '@/lib/credits'

// GET - 크레딧 잔액 및 내역 조회
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
    const includeHistory = searchParams.get('history') === 'true'
    const historyLimit = parseInt(searchParams.get('limit') || '20')

    // 크레딧 잔액 조회
    const credits = await getUserCredits(user.id)

    if (!credits) {
      return NextResponse.json({
        error: '크레딧 정보를 찾을 수 없습니다. 관리자에게 문의하세요.',
      }, { status: 404 })
    }

    const response: any = {
      balance: credits.balance,
      dailyBalance: credits.daily_balance,
      totalBalance: credits.balance + credits.daily_balance,
      tier: credits.tier,
      tierExpiresAt: credits.tier_expires_at,
      totalEarned: credits.total_earned,
      totalSpent: credits.total_spent,
      dailyResetAt: credits.daily_reset_at,
      pricing: CREDIT_PRICING,
      tiers: SUBSCRIPTION_TIERS,
    }

    // 내역 포함
    if (includeHistory) {
      response.history = await getCreditHistory(user.id, historyLimit)
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Credits API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
