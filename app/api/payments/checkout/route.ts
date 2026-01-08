export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import {
  createPayment,
  detectPaymentProvider,
  SUBSCRIPTION_PLANS,
  CREDIT_PACKAGES,
} from '@/lib/payments'
import { getClientKey } from '@/lib/payments/toss'

// GET - 상품 목록 조회
export async function GET() {
  return NextResponse.json({
    subscriptions: SUBSCRIPTION_PLANS,
    creditPackages: CREDIT_PACKAGES,
    tossClientKey: getClientKey(),
  })
}

// POST - 결제 세션 생성
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
    const {
      productType,  // 'subscription' | 'credits'
      productId,    // 'plan_basic', 'credits_5000' 등
      provider,     // 'toss' | 'stripe' (선택적)
      locale,       // 'ko' | 'en' 등
      country,      // 'KR' | 'US' 등
    } = body

    // 유효성 검증
    if (!productType || !productId) {
      return NextResponse.json(
        { error: 'productType과 productId가 필요합니다' },
        { status: 400 }
      )
    }

    // 상품 존재 확인
    if (productType === 'subscription') {
      const plan = Object.values(SUBSCRIPTION_PLANS).find(p => p.id === productId)
      if (!plan) {
        return NextResponse.json({ error: '유효하지 않은 구독 플랜입니다' }, { status: 400 })
      }
    } else if (productType === 'credits') {
      const pkg = Object.values(CREDIT_PACKAGES).find(p => p.id === productId)
      if (!pkg) {
        return NextResponse.json({ error: '유효하지 않은 크레딧 패키지입니다' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: '유효하지 않은 productType입니다' }, { status: 400 })
    }

    // 결제 제공자 결정
    const selectedProvider = provider || detectPaymentProvider(locale, country)

    // 성공/실패 URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = `${baseUrl}/dashboard/billing/success`
    const cancelUrl = `${baseUrl}/dashboard/billing`

    // 결제 세션 생성
    const result = await createPayment({
      userId: user.id,
      email: user.email,
      provider: selectedProvider,
      productType,
      productId,
      successUrl,
      cancelUrl,
      customerName: user.user_metadata?.name,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // 토스의 경우 클라이언트에서 SDK로 결제창 호출 필요
    // Stripe의 경우 checkoutUrl로 리다이렉트
    return NextResponse.json({
      success: true,
      provider: selectedProvider,
      orderId: result.orderId,
      checkoutUrl: result.checkoutUrl,  // Stripe용
      sessionId: result.sessionId,      // Stripe용
      tossClientKey: selectedProvider === 'toss' ? getClientKey() : undefined,
      // 토스 결제 시 프론트엔드에서 필요한 정보
      paymentInfo: selectedProvider === 'toss' ? {
        orderId: result.orderId,
        amount: productType === 'subscription'
          ? Object.values(SUBSCRIPTION_PLANS).find(p => p.id === productId)?.priceKRW
          : Object.values(CREDIT_PACKAGES).find(p => p.id === productId)?.priceKRW,
        orderName: productType === 'subscription'
          ? `GlowUS ${Object.values(SUBSCRIPTION_PLANS).find(p => p.id === productId)?.name} 구독`
          : `GlowUS 크레딧`,
        customerEmail: user.email,
        customerName: user.user_metadata?.name || user.email?.split('@')[0],
        successUrl,
        failUrl: `${baseUrl}/dashboard/billing/fail`,
      } : undefined,
    })

  } catch (error: any) {
    console.error('[Checkout API] Error:', error)
    return NextResponse.json(
      { error: error.message || '결제 생성 실패' },
      { status: 500 }
    )
  }
}
