'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle, Loader2, XCircle } from 'lucide-react'
import Link from 'next/link'

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const processPayment = async () => {
      // 토스페이먼츠 결제 성공 파라미터
      const paymentKey = searchParams.get('paymentKey')
      const orderId = searchParams.get('orderId')
      const amount = searchParams.get('amount')

      // Stripe 결제 성공 파라미터
      const sessionId = searchParams.get('session_id')

      if (paymentKey && orderId && amount) {
        // 토스페이먼츠 결제 승인
        try {
          const res = await fetch('/api/payments/toss/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentKey,
              orderId,
              amount: parseInt(amount),
            }),
          })

          const data = await res.json()

          if (data.success) {
            setStatus('success')
            setMessage('결제가 완료되었습니다! 크레딧이 충전되었습니다.')
          } else {
            setStatus('error')
            setMessage(data.error || '결제 승인에 실패했습니다.')
          }
        } catch (err: any) {
          setStatus('error')
          setMessage(err.message || '결제 처리 중 오류가 발생했습니다.')
        }
      } else if (sessionId) {
        // Stripe 결제는 웹훅에서 처리됨
        // 여기서는 성공 메시지만 표시
        setStatus('success')
        setMessage('결제가 완료되었습니다! 잠시 후 크레딧이 충전됩니다.')
      } else {
        setStatus('error')
        setMessage('잘못된 접근입니다.')
      }
    }

    processPayment()
  }, [searchParams])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-600">결제를 처리하고 있습니다...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {status === 'success' ? (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">결제 완료!</h1>
            <p className="text-gray-600 mb-8">{message}</p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-12 h-12 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">결제 실패</h1>
            <p className="text-gray-600 mb-8">{message}</p>
          </>
        )}

        <div className="flex flex-col gap-3">
          <Link
            href="/dashboard/billing"
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            결제 관리로 돌아가기
          </Link>
          <Link
            href="/dashboard"
            className="w-full py-3 border rounded-lg hover:bg-gray-50 transition"
          >
            대시보드로 이동
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-600">로딩 중...</p>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  )
}
