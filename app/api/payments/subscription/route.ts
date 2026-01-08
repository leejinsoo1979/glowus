export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import {
  getUserSubscription,
  getPaymentHistory,
  cancelSubscription,
  stripeClient,
} from '@/lib/payments'
import { getUserCredits } from '@/lib/credits'

// GET - 구독 및 결제 정보 조회
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

    // 병렬로 정보 조회
    const [subscription, credits, paymentHistory] = await Promise.all([
      getUserSubscription(user.id),
      getUserCredits(user.id),
      getPaymentHistory(user.id, 10),
    ])

    return NextResponse.json({
      subscription,
      credits: credits ? {
        balance: credits.balance,
        dailyBalance: credits.daily_balance,
        totalBalance: credits.balance + credits.daily_balance,
        tier: credits.tier,
        tierExpiresAt: credits.tier_expires_at,
        totalSpent: credits.total_spent,
        totalEarned: credits.total_earned,
      } : null,
      paymentHistory,
    })

  } catch (error: any) {
    console.error('[Subscription API] GET Error:', error)
    return NextResponse.json(
      { error: error.message || '정보 조회 실패' },
      { status: 500 }
    )
  }
}

// DELETE - 구독 취소
export async function DELETE(request: NextRequest) {
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
    const immediately = searchParams.get('immediately') === 'true'

    const result = await cancelSubscription(user.id, immediately)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: immediately
        ? '구독이 즉시 취소되었습니다'
        : '구독이 현재 결제 주기 종료 후 취소됩니다',
    })

  } catch (error: any) {
    console.error('[Subscription API] DELETE Error:', error)
    return NextResponse.json(
      { error: error.message || '구독 취소 실패' },
      { status: 500 }
    )
  }
}

// POST - Customer Portal (Stripe 구독 관리 페이지)
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

    const subscription = await getUserSubscription(user.id)

    if (!subscription || subscription.provider !== 'stripe') {
      return NextResponse.json(
        { error: 'Stripe 구독이 없습니다' },
        { status: 400 }
      )
    }

    // Customer Portal 세션 생성
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const portalSession = await stripeClient.createCustomerPortalSession({
      customerId: subscription.stripe_customer_id,
      returnUrl: `${baseUrl}/dashboard/billing`,
    })

    return NextResponse.json({
      url: portalSession.url,
    })

  } catch (error: any) {
    console.error('[Subscription API] POST Error:', error)
    return NextResponse.json(
      { error: error.message || 'Portal 세션 생성 실패' },
      { status: 500 }
    )
  }
}
