export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { addCredits, activateSubscription } from '@/lib/credits'
import {
  stripeClient,
  handleStripePaymentSuccess,
  SUBSCRIPTION_PLANS,
  CREDIT_PACKAGES,
} from '@/lib/payments'

// Stripe 웹훅은 raw body가 필요
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    // 이벤트 검증
    let event
    try {
      event = stripeClient.constructWebhookEvent(body, signature)
    } catch (err: any) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message)
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      )
    }

    console.log(`[Stripe Webhook] Event: ${event.type}`)

    // 이벤트 타입별 처리
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object)
        break

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object)
        break

      default:
        console.log(`[Stripe Webhook] Unhandled event: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error('[Stripe Webhook] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

// Checkout 세션 완료 처리
async function handleCheckoutCompleted(session: any) {
  console.log(`[Stripe Webhook] Checkout completed: ${session.id}`)

  const result = await handleStripePaymentSuccess(session.id)

  if (!result.success) {
    console.error(`[Stripe Webhook] Failed to process checkout: ${result.error}`)
  }
}

// 구독 업데이트 처리
async function handleSubscriptionUpdate(subscription: any) {
  const supabase = createAdminClient()

  console.log(`[Stripe Webhook] Subscription update: ${subscription.id} -> ${subscription.status}`)

  // 구독 정보 업데이트
  const { error } = await (supabase as any)
    .from('payment_subscriptions')
    .update({
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      next_billing_date: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('[Stripe Webhook] Failed to update subscription:', error)
  }
}

// 구독 삭제 처리
async function handleSubscriptionDeleted(subscription: any) {
  const supabase = createAdminClient()

  console.log(`[Stripe Webhook] Subscription deleted: ${subscription.id}`)

  // 구독 취소
  const { data: sub } = await (supabase as any)
    .from('payment_subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (sub) {
    // 구독 상태 업데이트
    await (supabase as any)
      .from('payment_subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id)

    // 사용자 크레딧 티어 다운그레이드
    await (supabase as any)
      .from('user_credits')
      .update({
        tier: 'free',
        tier_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', sub.user_id)

    console.log(`[Stripe Webhook] User downgraded to free: ${sub.user_id}`)
  }
}

// 인보이스 결제 완료 (정기결제 갱신)
async function handleInvoicePaid(invoice: any) {
  const supabase = createAdminClient()

  // 첫 결제는 checkout.session.completed에서 처리됨
  // 여기서는 갱신 결제만 처리
  if (invoice.billing_reason !== 'subscription_cycle') {
    return
  }

  console.log(`[Stripe Webhook] Invoice paid (renewal): ${invoice.id}`)

  const subscriptionId = invoice.subscription
  if (!subscriptionId) return

  // 구독 정보 조회
  const { data: subscription } = await (supabase as any)
    .from('payment_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (!subscription) {
    console.error(`[Stripe Webhook] Subscription not found: ${subscriptionId}`)
    return
  }

  // 크레딧 충전 (월간 크레딧)
  const plan = Object.values(SUBSCRIPTION_PLANS).find(p => p.tier === subscription.tier)
  if (plan && plan.credits > 0) {
    await addCredits(subscription.user_id, plan.credits, {
      type: 'subscription',
      description: `${plan.name} 구독 갱신 크레딧`,
    })
    console.log(`[Stripe Webhook] Monthly credits added: ${plan.credits} for user ${subscription.user_id}`)
  }

  // 결제 내역 기록
  await (supabase as any)
    .from('payments')
    .insert({
      user_id: subscription.user_id,
      provider: 'stripe',
      payment_key: invoice.payment_intent,
      order_id: `renewal_${invoice.id}`,
      amount: Math.round(invoice.amount_paid / 100 * 1300), // USD to KRW
      currency: invoice.currency.toUpperCase(),
      product_type: 'subscription',
      product_id: `plan_${subscription.tier}`,
      product_name: `GlowUS ${plan?.name} 구독 갱신`,
      status: 'done',
      approved_at: new Date().toISOString(),
    })
}

// 인보이스 결제 실패
async function handleInvoicePaymentFailed(invoice: any) {
  const supabase = createAdminClient()

  console.log(`[Stripe Webhook] Invoice payment failed: ${invoice.id}`)

  const subscriptionId = invoice.subscription
  if (!subscriptionId) return

  // 구독 상태 업데이트
  await (supabase as any)
    .from('payment_subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId)

  // TODO: 사용자에게 결제 실패 알림 이메일 발송
}
