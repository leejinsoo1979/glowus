'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

function PaymentFailContent() {
  const searchParams = useSearchParams()

  // 토스페이먼츠 실패 파라미터
  const code = searchParams.get('code')
  const message = searchParams.get('message')
  const orderId = searchParams.get('orderId')

  // 에러 메시지 매핑
  const getErrorMessage = (code: string | null, message: string | null) => {
    if (code === 'USER_CANCEL') {
      return '결제가 취소되었습니다.'
    }
    if (code === 'INVALID_CARD_EXPIRATION') {
      return '카드 유효기간이 만료되었습니다.'
    }
    if (code === 'EXCEED_MAX_CARD_INSTALLMENT_PLAN') {
      return '할부 개월 수가 초과되었습니다.'
    }
    if (code === 'NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT') {
      return '할부가 지원되지 않는 카드입니다.'
    }
    if (code === 'BELOW_MINIMUM_AMOUNT') {
      return '최소 결제 금액보다 적습니다.'
    }
    if (code === 'EXCEED_MAX_AMOUNT') {
      return '최대 결제 금액을 초과했습니다.'
    }

    return message || '결제에 실패했습니다. 다시 시도해주세요.'
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-12 h-12 text-red-500" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">결제 실패</h1>
        <p className="text-gray-600 mb-2">{getErrorMessage(code, message)}</p>

        {code && code !== 'USER_CANCEL' && (
          <p className="text-sm text-gray-400 mb-8">오류 코드: {code}</p>
        )}

        {!code && <div className="mb-8" />}

        <div className="flex flex-col gap-3">
          <Link
            href="/dashboard/billing"
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            다시 시도하기
          </Link>
          <Link
            href="/dashboard"
            className="w-full py-3 border rounded-lg hover:bg-gray-50 transition"
          >
            대시보드로 이동
          </Link>
        </div>

        {orderId && (
          <p className="text-xs text-gray-400 mt-6">주문번호: {orderId}</p>
        )}
      </div>
    </div>
  )
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-600">로딩 중...</p>
      </div>
    }>
      <PaymentFailContent />
    </Suspense>
  )
}
