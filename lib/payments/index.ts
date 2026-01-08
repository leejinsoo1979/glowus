// GlowUS 통합 결제 서비스
// 토스페이먼츠 (한국) + Stripe (글로벌)

import { createAdminClient } from '@/lib/supabase/admin'
import { addCredits, activateSubscription } from '@/lib/credits'
import * as toss from './toss'
import * as stripeClient from './stripe'
import { isStripeAvailable } from './stripe'

export type PaymentProvider = 'toss' | 'stripe'
export type ProductType = 'subscription' | 'credits'

// 구독 플랜 정보
export const SUBSCRIPTION_PLANS = {
  basic: {
    id: 'plan_basic',
    name: 'Basic',
    tier: 'basic' as const,
    credits: 30000,
    priceKRW: 26000,
    priceUSD: 20,
    features: ['월 30,000 크레딧', 'AI 매칭 무제한', '사업계획서 생성 50회', '이메일 지원'],
  },
  pro: {
    id: 'plan_pro',
    name: 'Pro',
    tier: 'pro' as const,
    credits: 100000,
    priceKRW: 65000,
    priceUSD: 50,
    features: ['월 100,000 크레딧', 'AI 매칭 무제한', '사업계획서 생성 무제한', '우선 지원', 'API 액세스'],
  },
  enterprise: {
    id: 'plan_enterprise',
    name: 'Enterprise',
    tier: 'enterprise' as const,
    credits: -1, // 무제한
    priceKRW: 260000,
    priceUSD: 200,
    features: ['무제한 크레딧', '전용 에이전트', '커스텀 통합', '전담 매니저', 'SLA 보장'],
  },
}

// 크레딧 패키지 정보
export const CREDIT_PACKAGES = {
  credits_1000: { id: 'credits_1000', credits: 1000, bonus: 0, priceKRW: 5000, priceUSD: 4 },
  credits_5000: { id: 'credits_5000', credits: 5000, bonus: 500, priceKRW: 20000, priceUSD: 16 },
  credits_10000: { id: 'credits_10000', credits: 10000, bonus: 1500, priceKRW: 35000, priceUSD: 28 },
  credits_50000: { id: 'credits_50000', credits: 50000, bonus: 10000, priceKRW: 150000, priceUSD: 120 },
}

export interface CreatePaymentRequest {
  userId: string
  email: string
  provider: PaymentProvider
  productType: ProductType
  productId: string  // plan_basic, credits_5000 등
  successUrl: string
  cancelUrl: string
  customerName?: string
}

export interface PaymentResult {
  success: boolean
  orderId?: string
  checkoutUrl?: string
  sessionId?: string
  error?: string
}

/**
 * 국가/언어 기반 결제 제공자 자동 선택
 */
export function detectPaymentProvider(
  locale: string = 'ko',
  country: string = 'KR'
): PaymentProvider {
  // 한국이면 토스, 그 외는 Stripe (Stripe가 설정된 경우에만)
  if (country === 'KR' || locale === 'ko' || locale === 'ko-KR') {
    return 'toss'
  }
  // Stripe 미설정 시 토스로 폴백
  return isStripeAvailable ? 'stripe' : 'toss'
}

/**
 * 결제 세션 생성 (토스 or Stripe)
 */
export async function createPayment(
  request: CreatePaymentRequest
): Promise<PaymentResult> {
  const supabase = createAdminClient()

  try {
    // 주문번호 생성
    const orderId = toss.generateOrderId(request.productType)

    // 상품 정보 조회
    let amount: number
    let productName: string
    let currency = 'KRW'

    if (request.productType === 'subscription') {
      const plan = Object.values(SUBSCRIPTION_PLANS).find(p => p.id === request.productId)
      if (!plan) throw new Error('Invalid plan ID')

      amount = request.provider === 'toss' ? plan.priceKRW : plan.priceUSD * 100
      productName = `GlowUS ${plan.name} 구독`
      currency = request.provider === 'toss' ? 'KRW' : 'USD'
    } else {
      const pkg = Object.values(CREDIT_PACKAGES).find(p => p.id === request.productId)
      if (!pkg) throw new Error('Invalid package ID')

      amount = request.provider === 'toss' ? pkg.priceKRW : pkg.priceUSD * 100
      productName = `GlowUS ${pkg.credits.toLocaleString()} 크레딧`
      currency = request.provider === 'toss' ? 'KRW' : 'USD'
    }

    // 결제 레코드 생성
    await (supabase as any)
      .from('payments')
      .insert({
        user_id: request.userId,
        provider: request.provider,
        order_id: orderId,
        amount: request.provider === 'toss' ? amount : Math.round(amount / 100 * 1300), // USD to KRW 환산
        currency,
        product_type: request.productType,
        product_id: request.productId,
        product_name: productName,
        status: 'pending',
        requested_at: new Date().toISOString(),
      })

    if (request.provider === 'toss') {
      // 토스페이먼츠: 클라이언트에서 결제창 호출 필요
      // 서버에서는 주문 정보만 반환
      return {
        success: true,
        orderId,
        checkoutUrl: undefined, // 클라이언트에서 SDK로 처리
      }
    } else if (request.provider === 'stripe' && isStripeAvailable) {
      // Stripe: Checkout Session 생성
      const session = await stripeClient.createCheckoutSession({
        userId: request.userId,
        email: request.email,
        mode: request.productType === 'subscription' ? 'subscription' : 'payment',
        priceId: request.productType === 'subscription'
          ? process.env[`STRIPE_PRICE_${request.productId.toUpperCase()}`]
          : undefined,
        amount: request.productType === 'credits' ? amount : undefined,
        productName,
        successUrl: `${request.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: request.cancelUrl,
        metadata: {
          orderId,
          productType: request.productType,
          productId: request.productId,
        },
      })

      // payment_key 업데이트
      await (supabase as any)
        .from('payments')
        .update({ payment_key: session.id })
        .eq('order_id', orderId)

      return {
        success: true,
        orderId,
        sessionId: session.id,
        checkoutUrl: session.url || undefined,
      }
    } else {
      // Stripe가 설정되지 않았을 때
      return {
        success: false,
        error: 'Stripe 결제가 설정되지 않았습니다. 토스페이먼츠를 사용해주세요.',
      }
    }
  } catch (error: any) {
    console.error('[Payment] Create error:', error)
    return {
      success: false,
      error: error.message || '결제 생성 실패',
    }
  }
}

/**
 * 토스 결제 승인
 */
export async function confirmTossPayment(
  paymentKey: string,
  orderId: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()

  try {
    // 1. 토스 결제 승인 API 호출
    const tossResult = await toss.confirmPayment({ paymentKey, orderId, amount })

    // 2. 결제 정보 조회
    const { data: payment } = await (supabase as any)
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .single()

    if (!payment) {
      throw new Error('결제 정보를 찾을 수 없습니다')
    }

    // 3. 결제 레코드 업데이트
    await (supabase as any)
      .from('payments')
      .update({
        payment_key: paymentKey,
        status: 'done',
        method: tossResult.method,
        card_company: tossResult.card?.company,
        card_number: tossResult.card?.number,
        approved_at: tossResult.approvedAt,
        metadata: {
          ...payment.metadata,
          tossResponse: tossResult,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)

    // 4. 상품 지급
    await fulfillOrder(payment.user_id, payment.product_type, payment.product_id, 'toss')

    return { success: true }
  } catch (error: any) {
    console.error('[Payment] Toss confirm error:', error)

    // 결제 실패 기록
    await (supabase as any)
      .from('payments')
      .update({
        status: 'failed',
        metadata: { error: error.message },
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)

    return { success: false, error: error.message }
  }
}

/**
 * Stripe 결제 완료 처리 (Webhook에서 호출)
 */
export async function handleStripePaymentSuccess(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isStripeAvailable || !stripeClient.stripe) {
    return { success: false, error: 'Stripe가 설정되지 않았습니다' }
  }

  const supabase = createAdminClient()

  try {
    // 1. 세션 조회
    const session = await stripeClient.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'payment_intent'],
    })

    const orderId = session.metadata?.orderId
    const productType = session.metadata?.productType as ProductType
    const productId = session.metadata?.productId

    if (!orderId || !productType || !productId) {
      throw new Error('Invalid session metadata')
    }

    // 2. 결제 레코드 업데이트
    await (supabase as any)
      .from('payments')
      .update({
        status: 'done',
        payment_key: session.payment_intent
          ? (session.payment_intent as any).id
          : session.subscription
            ? (session.subscription as any).id
            : session.id,
        approved_at: new Date().toISOString(),
        metadata: {
          stripeSessionId: session.id,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription
            ? (session.subscription as any).id
            : null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)

    // 3. 구독인 경우 구독 레코드 생성
    if (productType === 'subscription' && session.subscription) {
      const subscription = session.subscription as any
      const plan = Object.values(SUBSCRIPTION_PLANS).find(p => p.id === productId)

      await (supabase as any)
        .from('payment_subscriptions')
        .upsert({
          user_id: session.metadata?.userId,
          provider: 'stripe',
          stripe_subscription_id: subscription.id,
          stripe_customer_id: session.customer,
          tier: plan?.tier || 'basic',
          price_krw: plan?.priceKRW || 0,
          price_usd: plan?.priceUSD || 0,
          status: 'active',
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          next_billing_date: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,provider',
        })
    }

    // 4. 상품 지급
    await fulfillOrder(session.metadata?.userId!, productType, productId, 'stripe')

    return { success: true }
  } catch (error: any) {
    console.error('[Payment] Stripe success handler error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 주문 이행 (크레딧/구독 지급)
 */
async function fulfillOrder(
  userId: string,
  productType: ProductType,
  productId: string,
  provider: PaymentProvider
): Promise<void> {
  if (productType === 'subscription') {
    const plan = Object.values(SUBSCRIPTION_PLANS).find(p => p.id === productId)
    if (plan) {
      await activateSubscription(userId, plan.tier)
      console.log(`[Payment] Subscription activated: ${plan.tier} for user ${userId}`)
    }
  } else if (productType === 'credits') {
    const pkg = Object.values(CREDIT_PACKAGES).find(p => p.id === productId)
    if (pkg) {
      const totalCredits = pkg.credits + pkg.bonus
      await addCredits(userId, totalCredits, {
        type: 'purchase',
        description: `크레딧 구매: ${pkg.credits.toLocaleString()} + 보너스 ${pkg.bonus.toLocaleString()}`,
      })
      console.log(`[Payment] Credits added: ${totalCredits} for user ${userId}`)
    }
  }
}

/**
 * 결제 취소
 */
export async function cancelPayment(
  orderId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()

  try {
    const { data: payment } = await (supabase as any)
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .single()

    if (!payment) {
      throw new Error('결제 정보를 찾을 수 없습니다')
    }

    if (payment.provider === 'toss') {
      await toss.cancelPayment(payment.payment_key, reason)
    } else if (payment.provider === 'stripe' && isStripeAvailable) {
      await stripeClient.createRefund(payment.payment_key)
    } else {
      throw new Error('해당 결제 취소를 처리할 수 없습니다')
    }

    await (supabase as any)
      .from('payments')
      .update({
        status: 'canceled',
        metadata: { ...payment.metadata, cancelReason: reason },
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)

    return { success: true }
  } catch (error: any) {
    console.error('[Payment] Cancel error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 구독 취소
 */
export async function cancelSubscription(
  userId: string,
  immediately: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()

  try {
    const { data: subscription } = await (supabase as any)
      .from('payment_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (!subscription) {
      throw new Error('활성 구독이 없습니다')
    }

    if (subscription.provider === 'stripe' && subscription.stripe_subscription_id && isStripeAvailable) {
      await stripeClient.cancelSubscription(subscription.stripe_subscription_id, immediately)
    }

    await (supabase as any)
      .from('payment_subscriptions')
      .update({
        status: immediately ? 'canceled' : 'active',
        cancel_at_period_end: !immediately,
        canceled_at: immediately ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)

    return { success: true }
  } catch (error: any) {
    console.error('[Payment] Cancel subscription error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 사용자 결제 내역 조회
 */
export async function getPaymentHistory(
  userId: string,
  limit: number = 20
): Promise<any[]> {
  const supabase = createAdminClient()

  const { data, error } = await (supabase as any)
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['done', 'canceled'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[Payment] History error:', error)
    return []
  }

  return data || []
}

/**
 * 사용자 구독 정보 조회
 */
export async function getUserSubscription(userId: string): Promise<any | null> {
  const supabase = createAdminClient()

  const { data, error } = await (supabase as any)
    .from('payment_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (error) {
    return null
  }

  return data
}

// Re-export
export { toss, stripeClient }
