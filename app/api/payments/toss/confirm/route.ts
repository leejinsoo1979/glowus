export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { confirmTossPayment } from '@/lib/payments'

// POST - 토스 결제 승인
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
    const { paymentKey, orderId, amount } = body

    // 필수 파라미터 검증
    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json(
        { error: 'paymentKey, orderId, amount가 필요합니다' },
        { status: 400 }
      )
    }

    console.log(`[Toss Confirm] User: ${user.id}, Order: ${orderId}, Amount: ${amount}`)

    // 결제 승인 처리
    const result = await confirmTossPayment(paymentKey, orderId, amount)

    if (!result.success) {
      console.error(`[Toss Confirm] Failed: ${result.error}`)
      return NextResponse.json(
        { error: result.error || '결제 승인 실패' },
        { status: 400 }
      )
    }

    console.log(`[Toss Confirm] Success: ${orderId}`)

    return NextResponse.json({
      success: true,
      orderId,
      message: '결제가 완료되었습니다',
    })

  } catch (error: any) {
    console.error('[Toss Confirm] Error:', error)
    return NextResponse.json(
      { error: error.message || '결제 승인 처리 실패' },
      { status: 500 }
    )
  }
}
