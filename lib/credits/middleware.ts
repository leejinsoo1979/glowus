// 크레딧 미들웨어 - API 라우트에서 사용
import { NextResponse } from 'next/server'
import { checkCredits, deductCredits, deductCreditsForAction, CREDIT_PRICING } from './index'
import { isDevMode } from '@/lib/dev-user'

export interface CreditCheckResult {
  success: boolean
  userId: string
  balance: number
  tier: string
  error?: string
  response?: NextResponse
}

/**
 * API 호출 전 크레딧 확인
 * 사용 예:
 * const creditCheck = await requireCredits(userId, 'matching')
 * if (!creditCheck.success) return creditCheck.response
 */
export async function requireCredits(
  userId: string,
  action: string
): Promise<CreditCheckResult> {
  // 개발 모드에서는 크레딧 체크 스킵
  if (isDevMode()) {
    return { success: true, userId, balance: 999999, tier: 'dev' }
  }

  const requiredCredits = CREDIT_PRICING[action]

  if (!requiredCredits) {
    // 알 수 없는 액션은 통과
    return { success: true, userId, balance: 0, tier: 'free' }
  }

  const check = await checkCredits(userId, requiredCredits)

  if (!check.canUse) {
    return {
      success: false,
      userId,
      balance: check.balance + check.dailyBalance,
      tier: check.tier,
      error: '크레딧이 부족합니다',
      response: NextResponse.json(
        {
          error: '크레딧이 부족합니다',
          code: 'INSUFFICIENT_CREDITS',
          required: requiredCredits,
          balance: check.balance + check.dailyBalance,
          tier: check.tier,
        },
        { status: 402 } // Payment Required
      ),
    }
  }

  return {
    success: true,
    userId,
    balance: check.balance + check.dailyBalance,
    tier: check.tier,
  }
}

/**
 * API 호출 성공 후 크레딧 차감
 */
export async function chargeCredits(
  userId: string,
  action: string,
  description?: string
): Promise<{ success: boolean; balance: number; error?: string }> {
  // 개발 모드에서는 차감 스킵
  if (isDevMode()) {
    return { success: true, balance: 999999 }
  }
  return deductCreditsForAction(userId, action, description)
}

/**
 * 크레딧 확인 + 차감을 한번에 하는 래퍼
 * 사용 예:
 * const result = await withCredits(userId, 'business_plan', async () => {
 *   // 실제 작업 수행
 *   return { data: '생성된 사업계획서' }
 * })
 */
export async function withCredits<T>(
  userId: string,
  action: string,
  fn: () => Promise<T>
): Promise<{ success: true; data: T; balance: number } | { success: false; error: string; response: NextResponse }> {
  // 1. 크레딧 확인
  const check = await requireCredits(userId, action)
  if (!check.success) {
    return {
      success: false,
      error: check.error || '크레딧 부족',
      response: check.response!,
    }
  }

  // 2. 작업 실행
  try {
    const data = await fn()

    // 3. 크레딧 차감
    const charge = await chargeCredits(userId, action)

    return {
      success: true,
      data,
      balance: charge.balance,
    }
  } catch (error) {
    // 작업 실패 시 크레딧 차감 안 함
    throw error
  }
}
