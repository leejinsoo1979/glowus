import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { googleDriveClient } from '@/lib/integrations/google-drive'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // 에러 처리
  if (error) {
    console.error('[Google Drive Callback] Auth error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard-group/files?error=${encodeURIComponent(error)}`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard-group/files?error=missing_params`
    )
  }

  try {
    // state 파싱
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    const userId = stateData.user_id

    if (!userId) {
      throw new Error('Invalid state: missing user_id')
    }

    // 토큰 교환
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-drive/callback`
    const result = await googleDriveClient.handleCallback(code, redirectUri)

    if (!result.success) {
      throw new Error(result.error || 'Token exchange failed')
    }

    // Supabase에 연결 정보 저장
    const supabase = createAdminClient()

    // 기존 연결 확인
    const { data: existing } = await (supabase
      .from('user_app_connections') as any)
      .select('id')
      .eq('user_id', userId)
      .eq('provider_id', 'google_drive')
      .single()

    const connectionData = {
      user_id: userId,
      provider_id: 'google_drive',
      account_info: result.account_info,
      access_token: result.account_info?.access_token,
      refresh_token: result.account_info?.refresh_token,
      token_expires_at: result.account_info?.expires_in
        ? new Date(Date.now() + result.account_info.expires_in * 1000).toISOString()
        : null,
      is_active: true,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      // 업데이트
      await (supabase
        .from('user_app_connections') as any)
        .update(connectionData)
        .eq('id', existing.id)
    } else {
      // 새로 생성
      await (supabase
        .from('user_app_connections') as any)
        .insert({
          ...connectionData,
          created_at: new Date().toISOString(),
        })
    }

    // 성공 페이지로 리다이렉트
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard-group/files?connected=google_drive`
    )
  } catch (error) {
    console.error('[Google Drive Callback] Error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard-group/files?error=callback_failed`
    )
  }
}
