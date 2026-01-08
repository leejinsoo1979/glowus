export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { checkCredits, CREDIT_PRICING } from '@/lib/credits'

// POST - 크레딧 사용 가능 여부 확인
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { action, amount } = body

    // action으로 금액 조회 또는 직접 amount 사용
    let requiredCredits = amount
    if (action && CREDIT_PRICING[action]) {
      requiredCredits = CREDIT_PRICING[action]
    }

    if (!requiredCredits || requiredCredits <= 0) {
      return NextResponse.json({ error: '필요한 크레딧 양을 지정해주세요' }, { status: 400 })
    }

    const result = await checkCredits(user.id, requiredCredits)

    return NextResponse.json({
      canUse: result.canUse,
      required: requiredCredits,
      balance: result.balance,
      dailyBalance: result.dailyBalance,
      totalBalance: result.balance + result.dailyBalance,
      tier: result.tier,
      shortage: result.canUse ? 0 : requiredCredits - (result.balance + result.dailyBalance),
    })
  } catch (error) {
    console.error('[Check Credits API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
