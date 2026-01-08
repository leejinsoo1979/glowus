// Stripe 결제 클라이언트
// 문서: https://stripe.com/docs/api

import Stripe from 'stripe'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ''

// Stripe 사용 가능 여부
export const isStripeAvailable = !!STRIPE_SECRET_KEY

// Stripe 클라이언트 초기화 (API 키가 있을 때만)
export const stripe: Stripe | null = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    })
  : null

// Stripe 미설정 에러
function assertStripeAvailable(): void {
  if (!stripe) {
    throw new Error('Stripe API key not configured')
  }
}

export interface StripeCheckoutRequest {
  userId: string
  email: string
  priceId?: string  // 구독용 Price ID
  mode: 'subscription' | 'payment'
  successUrl: string
  cancelUrl: string
  // 일회성 결제용
  amount?: number
  currency?: string
  productName?: string
  // 메타데이터
  metadata?: Record<string, string>
}

export interface StripeCustomerPortalRequest {
  customerId: string
  returnUrl: string
}

/**
 * Stripe Customer 생성 또는 조회
 */
export async function getOrCreateCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<Stripe.Customer> {
  assertStripeAvailable()

  // 기존 Customer 찾기
  const existingCustomers = await stripe!.customers.list({
    email,
    limit: 1,
  })

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0]
  }

  // 새 Customer 생성
  return stripe!.customers.create({
    email,
    name,
    metadata: {
      userId,
    },
  })
}

/**
 * Checkout Session 생성
 */
export async function createCheckoutSession(
  request: StripeCheckoutRequest
): Promise<Stripe.Checkout.Session> {
  assertStripeAvailable()
  const customer = await getOrCreateCustomer(request.userId, request.email)

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customer.id,
    success_url: request.successUrl,
    cancel_url: request.cancelUrl,
    mode: request.mode,
    metadata: {
      userId: request.userId,
      ...request.metadata,
    },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
  }

  if (request.mode === 'subscription' && request.priceId) {
    // 구독 결제
    sessionParams.line_items = [
      {
        price: request.priceId,
        quantity: 1,
      },
    ]
    sessionParams.subscription_data = {
      metadata: {
        userId: request.userId,
      },
    }
  } else if (request.mode === 'payment' && request.amount) {
    // 일회성 결제
    sessionParams.line_items = [
      {
        price_data: {
          currency: request.currency || 'usd',
          product_data: {
            name: request.productName || 'GlowUS Credits',
          },
          unit_amount: request.amount, // 센트 단위
        },
        quantity: 1,
      },
    ]
  }

  return stripe!.checkout.sessions.create(sessionParams)
}

/**
 * Customer Portal 세션 생성 (구독 관리용)
 */
export async function createCustomerPortalSession(
  request: StripeCustomerPortalRequest
): Promise<Stripe.BillingPortal.Session> {
  assertStripeAvailable()
  return stripe!.billingPortal.sessions.create({
    customer: request.customerId,
    return_url: request.returnUrl,
  })
}

/**
 * 구독 조회
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  assertStripeAvailable()
  return stripe!.subscriptions.retrieve(subscriptionId)
}

/**
 * 구독 취소
 */
export async function cancelSubscription(
  subscriptionId: string,
  immediately: boolean = false
): Promise<Stripe.Subscription> {
  assertStripeAvailable()
  if (immediately) {
    return stripe!.subscriptions.cancel(subscriptionId)
  }

  // 현재 결제 주기 끝에서 취소
  return stripe!.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })
}

/**
 * 결제 조회
 */
export async function getPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  assertStripeAvailable()
  return stripe!.paymentIntents.retrieve(paymentIntentId)
}

/**
 * 환불
 */
export async function createRefund(
  paymentIntentId: string,
  amount?: number,
  reason?: Stripe.RefundCreateParams.Reason
): Promise<Stripe.Refund> {
  assertStripeAvailable()
  return stripe!.refunds.create({
    payment_intent: paymentIntentId,
    amount, // undefined면 전액 환불
    reason,
  })
}

/**
 * Webhook 이벤트 검증
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  assertStripeAvailable()
  return stripe!.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET)
}

/**
 * Customer ID로 구독 목록 조회
 */
export async function getCustomerSubscriptions(
  customerId: string
): Promise<Stripe.Subscription[]> {
  assertStripeAvailable()
  const subscriptions = await stripe!.subscriptions.list({
    customer: customerId,
    status: 'active',
  })
  return subscriptions.data
}

/**
 * Price ID로 가격 정보 조회
 */
export async function getPrice(priceId: string): Promise<Stripe.Price> {
  assertStripeAvailable()
  return stripe!.prices.retrieve(priceId, {
    expand: ['product'],
  })
}

/**
 * 모든 활성 가격 목록 조회
 */
export async function getActivePrices(): Promise<Stripe.Price[]> {
  assertStripeAvailable()
  const prices = await stripe!.prices.list({
    active: true,
    expand: ['data.product'],
  })
  return prices.data
}
