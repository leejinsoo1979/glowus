export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { activateSubscription, SUBSCRIPTION_TIERS } from '@/lib/credits'

// POST - 구독 활성화
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
    const { tier, paymentId } = body

    if (!tier || !['basic', 'pro', 'enterprise'].includes(tier)) {
      return NextResponse.json({ error: '유효하지 않은 구독 티어입니다' }, { status: 400 })
    }

    // TODO: 실제 결제 검증 로직 추가 (Stripe, Paddle 등)
    // if (!paymentId) {
    //   return NextResponse.json({ error: '결제 정보가 필요합니다' }, { status: 400 })
    // }

    const result = await activateSubscription(user.id, tier, paymentId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      tier,
      credits: SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS].credits,
      message: `${tier.toUpperCase()} 구독이 활성화되었습니다`,
    })
  } catch (error) {
    console.error('[Subscribe API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
