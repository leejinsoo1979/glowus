// 토스페이먼츠 결제 클라이언트
// 문서: https://docs.tosspayments.com/

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || ''
const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || ''
const TOSS_API_URL = 'https://api.tosspayments.com/v1'

export interface TossPaymentRequest {
  orderId: string
  amount: number
  orderName: string
  customerName?: string
  customerEmail?: string
  successUrl: string
  failUrl: string
  // 카드 결제 옵션
  cardCompany?: string
  cardInstallmentPlan?: number
  maxCardInstallmentPlan?: number
  useCardPoint?: boolean
  // 간편결제 옵션
  flowMode?: 'DEFAULT' | 'DIRECT'
  easyPay?: 'TOSSPAY' | 'NAVERPAY' | 'KAKAOPAY' | 'PAYCO' | 'SAMSUNGPAY' | 'APPLEPAY'
}

export interface TossPaymentConfirmRequest {
  paymentKey: string
  orderId: string
  amount: number
}

export interface TossPaymentResponse {
  paymentKey: string
  orderId: string
  orderName: string
  status: string
  requestedAt: string
  approvedAt?: string
  method: string
  totalAmount: number
  balanceAmount: number
  suppliedAmount: number
  vat: number
  card?: {
    company: string
    number: string
    installmentPlanMonths: number
    isInterestFree: boolean
    approveNo: string
    cardType: string
    ownerType: string
  }
  easyPay?: {
    provider: string
    amount: number
  }
  receipt?: {
    url: string
  }
  failure?: {
    code: string
    message: string
  }
}

export interface TossBillingKeyRequest {
  customerKey: string
  authKey: string
}

export interface TossBillingKeyResponse {
  billingKey: string
  customerKey: string
  card: {
    company: string
    number: string
    cardType: string
    ownerType: string
  }
}

export interface TossBillingPaymentRequest {
  billingKey: string
  customerKey: string
  amount: number
  orderId: string
  orderName: string
  customerEmail?: string
  customerName?: string
}

// Base64 인코딩된 인증 헤더 생성
function getAuthHeader(): string {
  const encoded = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64')
  return `Basic ${encoded}`
}

/**
 * 토스페이먼츠 결제 승인
 */
export async function confirmPayment(
  request: TossPaymentConfirmRequest
): Promise<TossPaymentResponse> {
  const response = await fetch(`${TOSS_API_URL}/payments/confirm`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || '결제 승인 실패')
  }

  return data
}

/**
 * 결제 조회
 */
export async function getPayment(paymentKey: string): Promise<TossPaymentResponse> {
  const response = await fetch(`${TOSS_API_URL}/payments/${paymentKey}`, {
    method: 'GET',
    headers: {
      Authorization: getAuthHeader(),
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || '결제 조회 실패')
  }

  return data
}

/**
 * 결제 취소
 */
export async function cancelPayment(
  paymentKey: string,
  cancelReason: string,
  cancelAmount?: number
): Promise<TossPaymentResponse> {
  const body: Record<string, unknown> = { cancelReason }
  if (cancelAmount) {
    body.cancelAmount = cancelAmount
  }

  const response = await fetch(`${TOSS_API_URL}/payments/${paymentKey}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || '결제 취소 실패')
  }

  return data
}

/**
 * 빌링키 발급 (정기결제용)
 */
export async function issueBillingKey(
  request: TossBillingKeyRequest
): Promise<TossBillingKeyResponse> {
  const response = await fetch(`${TOSS_API_URL}/billing/authorizations/issue`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || '빌링키 발급 실패')
  }

  return data
}

/**
 * 빌링키로 자동결제
 */
export async function payWithBillingKey(
  request: TossBillingPaymentRequest
): Promise<TossPaymentResponse> {
  const response = await fetch(`${TOSS_API_URL}/billing/${request.billingKey}`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerKey: request.customerKey,
      amount: request.amount,
      orderId: request.orderId,
      orderName: request.orderName,
      customerEmail: request.customerEmail,
      customerName: request.customerName,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || '자동결제 실패')
  }

  return data
}

/**
 * 주문번호 생성
 */
export function generateOrderId(prefix: string = 'order'): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}_${timestamp}_${random}`.toUpperCase()
}

/**
 * 클라이언트 키 반환 (프론트엔드용)
 */
export function getClientKey(): string {
  return TOSS_CLIENT_KEY
}
