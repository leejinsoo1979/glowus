import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { googleDriveClient } from '@/lib/integrations/google-drive'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 연결 정보 가져오기
    const { data: connection } = await (supabase
      .from('user_app_connections') as any)
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', user.id)
      .eq('provider_id', 'google_drive')
      .eq('is_active', true)
      .single()

    if (!connection) {
      return NextResponse.json(
        { error: 'Google Drive not connected' },
        { status: 400 }
      )
    }

    let accessToken = connection.access_token

    // 토큰 만료 확인 및 갱신
    const isExpired = connection.token_expires_at
      ? new Date(connection.token_expires_at) < new Date()
      : false

    if (isExpired && connection.refresh_token) {
      try {
        const newTokens = await googleDriveClient.refreshToken(connection.refresh_token)
        accessToken = newTokens.access_token

        // 새 토큰 저장
        await (supabase
          .from('user_app_connections') as any)
          .update({
            access_token: newTokens.access_token,
            token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('provider_id', 'google_drive')
      } catch (refreshError) {
        console.error('[Google Drive] Token refresh failed:', refreshError)
        return NextResponse.json(
          { error: 'Token expired. Please reconnect.' },
          { status: 401 }
        )
      }
    }

    // 쿼리 파라미터
    const searchParams = request.nextUrl.searchParams
    const folderId = searchParams.get('folder_id') || undefined
    const query = searchParams.get('query') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')
    const cursor = searchParams.get('cursor') || undefined

    // 파일 목록 가져오기
    const result = await googleDriveClient.listResources(accessToken, {
      folder_id: folderId,
      query,
      limit,
      cursor,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Google Drive Files] Error:', error)
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    )
  }
}
