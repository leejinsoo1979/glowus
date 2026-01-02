/**
 * 이메일 조회 API
 * 워크플로우 시스템에서 사용하는 이메일 읽기 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { folder = 'inbox', limit = 10 } = body

    // 인증 확인
    const supabase = await createClient()
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다' },
        { status: 401 }
      )
    }

    // TODO: 실제 이메일 서비스 연동 (Gmail API, Outlook API 등)
    // 현재는 데모 데이터 반환

    // 데모 이메일 데이터
    const demoEmails = [
      {
        id: 'email-1',
        from: 'support@example.com',
        subject: '서비스 업데이트 안내',
        preview: '안녕하세요, 새로운 기능이 추가되었습니다...',
        date: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30분 전
        isRead: false,
        hasAttachment: false,
      },
      {
        id: 'email-2',
        from: 'team@company.com',
        subject: '주간 회의 안내',
        preview: '이번 주 금요일 오후 3시에 주간 회의가...',
        date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2시간 전
        isRead: true,
        hasAttachment: true,
      },
      {
        id: 'email-3',
        from: 'newsletter@tech.com',
        subject: '이번 주 기술 트렌드',
        preview: 'AI와 클라우드 기술의 최신 동향을...',
        date: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5시간 전
        isRead: true,
        hasAttachment: false,
      },
      {
        id: 'email-4',
        from: 'hr@company.com',
        subject: '연차 신청 승인',
        preview: '신청하신 연차가 승인되었습니다...',
        date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1일 전
        isRead: true,
        hasAttachment: false,
      },
    ]

    // 요청된 개수만큼 반환
    const emails = demoEmails.slice(0, Math.min(limit, demoEmails.length))

    return NextResponse.json({
      success: true,
      folder,
      count: emails.length,
      emails,
      message: `받은편지함에서 ${emails.length}개의 이메일을 조회했습니다.`,
    })
  } catch (error: any) {
    console.error('[GetEmails] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '이메일 조회 실패' },
      { status: 500 }
    )
  }
}

// GET도 지원 (간단한 조회)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const folder = searchParams.get('folder') || 'inbox'
  const limit = parseInt(searchParams.get('limit') || '10')

  // POST와 동일한 로직 재사용
  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ folder, limit }),
  }))
}
