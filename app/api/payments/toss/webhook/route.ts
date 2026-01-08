export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addCredits, activateSubscription } from '@/lib/credits'
import { SUBSCRIPTION_PLANS, CREDIT_PACKAGES } from '@/lib/payments'

// 토스페이먼츠 웹훅 시크릿 (선택적)
const TOSS_WEBHOOK_SECRET = process.env.TOSS_WEBHOOK_SECRET || ''

// POST - 토스 웹훅 처리
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('[Toss Webhook] Received:', JSON.stringify(body, null, 2))

    const { eventType, data } = body

    // 이벤트 타입별 처리
    switch (eventType) {
      case 'PAYMENT_STATUS_CHANGED':
        await handlePaymentStatusChanged(data)
        break

      case 'BILLING_STATUS_CHANGED':
        await handleBillingStatusChanged(data)
        break

      default:
        console.log(`[Toss Webhook] Unhandled event: ${eventType}`)
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('[Toss Webhook] Error:', error)
    // 웹훅은 항상 200 반환 (재시도 방지)
    return NextResponse.json({ success: false, error: error.message })
  }
}

// 결제 상태 변경 처리
async function handlePaymentStatusChanged(data: any) {
  const supabase = createAdminClient()
  const { paymentKey, orderId, status } = data

  console.log(`[Toss Webhook] Payment status changed: ${orderId} -> ${status}`)

  // 결제 정보 조회
  const { data: payment } = await (supabase as any)
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .single()

  if (!payment) {
    console.error(`[Toss Webhook] Payment not found: ${orderId}`)
    return
  }

  // 상태 업데이트
  await (supabase as any)
    .from('payments')
    .update({
      status: status.toLowerCase(),
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)

  // 결제 완료 시 상품 지급
  if (status === 'DONE') {
    await fulfillOrder(payment)
  }

  // 결제 취소 시 처리
  if (status === 'CANCELED' || status === 'PARTIAL_CANCELED') {
    console.log(`[Toss Webhook] Payment canceled: ${orderId}`)
    // TODO: 크레딧 회수 또는 구독 취소 처리
  }
}

// 빌링(정기결제) 상태 변경 처리
async function handleBillingStatusChanged(data: any) {
  const supabase = createAdminClient()
  const { billingKey, customerKey, status } = data

  console.log(`[Toss Webhook] Billing status changed: ${customerKey} -> ${status}`)

  // 구독 정보 조회
  const { data: subscription } = await (supabase as any)
    .from('payment_subscriptions')
    .select('*')
    .eq('billing_key', billingKey)
    .single()

  if (!subscription) {
    console.error(`[Toss Webhook] Subscription not found: ${billingKey}`)
    return
  }

  // 상태 업데이트
  let newStatus = subscription.status
  if (status === 'ACTIVE') newStatus = 'active'
  else if (status === 'CANCELED') newStatus = 'canceled'
  else if (status === 'PAUSED') newStatus = 'paused'

  await (supabase as any)
    .from('payment_subscriptions')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id)
}

// 주문 이행
async function fulfillOrder(payment: any) {
  const { user_id, product_type, product_id } = payment

  if (product_type === 'subscription') {
    const plan = Object.values(SUBSCRIPTION_PLANS).find(p => p.id === product_id)
    if (plan) {
      await activateSubscription(user_id, plan.tier)
      console.log(`[Toss Webhook] Subscription activated: ${plan.tier} for user ${user_id}`)
    }
  } else if (product_type === 'credits') {
    const pkg = Object.values(CREDIT_PACKAGES).find(p => p.id === product_id)
    if (pkg) {
      const totalCredits = pkg.credits + pkg.bonus
      await addCredits(user_id, totalCredits, {
        type: 'purchase',
        description: `크레딧 구매 (토스): ${pkg.credits.toLocaleString()} + 보너스 ${pkg.bonus.toLocaleString()}`,
      })
      console.log(`[Toss Webhook] Credits added: ${totalCredits} for user ${user_id}`)
    }
  }
}
