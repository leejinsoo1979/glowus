import { NextRequest, NextResponse } from 'next/server'
import { createClient, getAuthUser } from '@/lib/supabase/server'

// Google Cloud Storage 버킷명
const GCS_BUCKET = process.env.GCS_BUCKET || 'glowus-projects'

// 토큰 갱신 함수
async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) return null

    const data = await response.json()
    return data.access_token
  } catch {
    return null
  }
}

// Access token 가져오기 (필요시 갱신)
async function getAccessToken(supabase: any, userId: string): Promise<string | null> {
  const { data: connection } = await supabase
    .from('user_google_connections')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!connection) return null

  // 토큰 만료 확인
  const expiresAt = new Date(connection.token_expires_at)
  if (expiresAt <= new Date()) {
    // 토큰 갱신
    const newToken = await refreshGoogleToken(connection.refresh_token)
    if (!newToken) return null

    // 새 토큰 저장
    await supabase
      .from('user_google_connections')
      .update({
        access_token: newToken,
        token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      })
      .eq('user_id', userId)

    return newToken
  }

  return connection.access_token
}

// 파일 목록 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { user } = await getAuthUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const prefix = searchParams.get('prefix') || ''  // 폴더 경로
    const projectId = searchParams.get('projectId')

    const accessToken = await getAccessToken(supabase, user.id)
    if (!accessToken) {
      return NextResponse.json({ error: 'Google not connected' }, { status: 401 })
    }

    // 프로젝트별 prefix
    const fullPrefix = projectId ? `${user.id}/${projectId}/${prefix}` : `${user.id}/${prefix}`

    // GCS API 호출
    const gcsUrl = `https://storage.googleapis.com/storage/v1/b/${GCS_BUCKET}/o?` +
      `prefix=${encodeURIComponent(fullPrefix)}&delimiter=/`

    const response = await fetch(gcsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('GCS list error:', error)
      return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
    }

    const data = await response.json()

    // 응답 변환 (파일 + 폴더)
    const files = (data.items || []).map((item: any) => ({
      name: item.name.replace(fullPrefix, ''),
      path: item.name,
      size: parseInt(item.size),
      updated: item.updated,
      type: 'file',
      contentType: item.contentType,
    }))

    const folders = (data.prefixes || []).map((prefix: string) => ({
      name: prefix.replace(fullPrefix, '').replace(/\/$/, ''),
      path: prefix,
      type: 'folder',
    }))

    return NextResponse.json({
      files,
      folders,
      prefix: fullPrefix,
    })
  } catch (error: any) {
    console.error('GCS list error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 파일 생성/업로드 (POST)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { user } = await getAuthUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { path, content, projectId, contentType = 'text/plain' } = await request.json()

    const accessToken = await getAccessToken(supabase, user.id)
    if (!accessToken) {
      return NextResponse.json({ error: 'Google not connected' }, { status: 401 })
    }

    // 전체 경로 생성
    const fullPath = projectId ? `${user.id}/${projectId}/${path}` : `${user.id}/${path}`

    // GCS 업로드 URL
    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${GCS_BUCKET}/o?` +
      `uploadType=media&name=${encodeURIComponent(fullPath)}`

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': contentType,
      },
      body: content,
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('GCS upload error:', error)
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      path: result.name,
      size: result.size,
    })
  } catch (error: any) {
    console.error('GCS upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 파일 삭제 (DELETE)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { user } = await getAuthUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { path } = await request.json()

    const accessToken = await getAccessToken(supabase, user.id)
    if (!accessToken) {
      return NextResponse.json({ error: 'Google not connected' }, { status: 401 })
    }

    // GCS 삭제
    const deleteUrl = `https://storage.googleapis.com/storage/v1/b/${GCS_BUCKET}/o/${encodeURIComponent(path)}`

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok && response.status !== 404) {
      const error = await response.text()
      console.error('GCS delete error:', error)
      return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('GCS delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
