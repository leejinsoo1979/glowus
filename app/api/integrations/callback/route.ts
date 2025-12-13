/**
 * OAuth Callback Handler
 * 외부 앱 OAuth 인증 콜백 처리
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { handleOAuthCallback } from '@/lib/integrations'
import type { ProviderId } from '@/lib/integrations/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const provider = searchParams.get('provider') as ProviderId | null

  // 에러 처리
  if (error) {
    console.error('[OAuth Callback] Error:', error)
    return NextResponse.redirect(
      new URL(`/dashboard/settings?error=${encodeURIComponent(error)}`, request.url)
    )
  }

  // 필수 파라미터 확인
  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard/settings?error=missing_params', request.url)
    )
  }

  // provider가 없으면 state에서 추출 시도
  let providerId = provider

  if (!providerId) {
    // state에서 provider 추출 (state_provider 형식인 경우)
    const supabase = await createClient()
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const adminClient = createAdminClient()

    const { data: stateData } = await (adminClient as any)
      .from('oauth_states')
      .select('provider_id')
      .eq('state_token', state)
      .single()

    if (stateData) {
      providerId = stateData.provider_id
    }
  }

  if (!providerId) {
    return NextResponse.redirect(
      new URL('/dashboard/settings?error=unknown_provider', request.url)
    )
  }

  try {
    const result = await handleOAuthCallback(providerId, code, state)

    if (!result.success) {
      return NextResponse.redirect(
        new URL(`/dashboard/settings?error=${encodeURIComponent(result.error || 'unknown')}`, request.url)
      )
    }

    // 성공 - 설정 페이지로 리다이렉트
    return NextResponse.redirect(
      new URL(`/dashboard/settings?connected=${providerId}`, request.url)
    )
  } catch (err) {
    console.error('[OAuth Callback] Exception:', err)
    return NextResponse.redirect(
      new URL('/dashboard/settings?error=callback_failed', request.url)
    )
  }
}
