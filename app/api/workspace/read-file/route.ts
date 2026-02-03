import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import * as fs from 'fs'

export const runtime = 'nodejs'

// 서버 측에서 파일 내용 읽기
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { filePath } = body

    if (!filePath) {
      return NextResponse.json({ error: '파일 경로가 필요합니다' }, { status: 400 })
    }

    // 경로가 존재하는지 확인
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: '파일이 존재하지 않습니다' }, { status: 404 })
    }

    // 파일인지 확인
    const stats = fs.statSync(filePath)
    if (!stats.isFile()) {
      return NextResponse.json({ error: '파일이 아닙니다' }, { status: 400 })
    }

    // 파일 크기 제한 (1MB)
    if (stats.size > 1024 * 1024) {
      return NextResponse.json({ error: '파일이 너무 큽니다 (최대 1MB)' }, { status: 400 })
    }

    // 파일 내용 읽기
    const content = fs.readFileSync(filePath, 'utf-8')

    return NextResponse.json({
      success: true,
      content,
      size: stats.size
    })

  } catch (error) {
    console.error('[Workspace ReadFile] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '파일 읽기 실패' },
      { status: 500 }
    )
  }
}
