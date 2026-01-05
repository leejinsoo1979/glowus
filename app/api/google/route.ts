import { NextRequest, NextResponse } from 'next/server'
import { createClient, getAuthUser } from '@/lib/supabase/server'

// Google Cloud 연결 정보 조회
export async function GET() {
  try {
    const supabase = await createClient()
    const { user } = await getAuthUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: connection, error } = await supabase
      .from('user_google_connections' as any)
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching Google connection:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!connection) {
      return NextResponse.json({ connected: false })
    }

    const conn = connection as any
    return NextResponse.json({
      connected: true,
      email: conn.google_email,
      name: conn.google_name,
      avatar: conn.google_avatar_url,
    })
  } catch (error: any) {
    console.error('Google connection error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Google Cloud 연결 해제
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { user } = await getAuthUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 연결 정보 삭제
    const { error } = await supabase
      .from('user_google_connections' as any)
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting Google connection:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 프로젝트에서 GCS 설정 제거
    // @ts-ignore - 새 필드, 타입 생성 필요
    await supabase.from('projects').update({
      gcs_bucket: null,
      gcs_prefix: null,
      storage_type: 'local',
      gcs_connected_at: null,
    }).eq('user_id', user.id).eq('storage_type', 'gcs')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Google disconnect error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Google OAuth 시작 (리다이렉트 URL 반환)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { user } = await getAuthUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action } = await request.json()

    if (action === 'get_auth_url') {
      // Google OAuth URL 생성
      const clientId = process.env.GOOGLE_CLIENT_ID
      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`

      const scopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/devstorage.full_control',  // GCS 전체 접근
        'https://www.googleapis.com/auth/cloud-platform',  // Cloud Platform
      ].join(' ')

      const state = Buffer.from(JSON.stringify({
        userId: user.id,
        returnUrl: '/dashboard-group/neural-map'
      })).toString('base64')

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${state}`

      return NextResponse.json({ authUrl })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Google auth error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
