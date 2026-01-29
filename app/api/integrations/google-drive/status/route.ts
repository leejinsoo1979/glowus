import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 연결 상태 확인
    const { data: connection } = await (supabase
      .from('user_app_connections') as any)
      .select('id, account_info, is_active, token_expires_at')
      .eq('user_id', user.id)
      .eq('provider_id', 'google_drive')
      .eq('is_active', true)
      .single()

    if (!connection) {
      return NextResponse.json({ connected: false })
    }

    // 토큰 만료 확인
    const isExpired = connection.token_expires_at
      ? new Date(connection.token_expires_at) < new Date()
      : false

    return NextResponse.json({
      connected: !isExpired,
      account: connection.account_info
        ? {
            email: connection.account_info.email,
            name: connection.account_info.name,
            avatar_url: connection.account_info.avatar_url,
          }
        : null,
      expires_at: connection.token_expires_at,
    })
  } catch (error) {
    console.error('[Google Drive Status] Error:', error)
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    )
  }
}
