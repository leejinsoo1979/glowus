import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5분 (복잡한 작업용)

// Stagehand 서버 URL (독립 프로세스로 실행됨)
const STAGEHAND_SERVER = 'http://127.0.0.1:45679'

/**
 * Stagehand AI Browser Automation API
 *
 * POST /api/browser/stagehand
 *
 * Actions:
 * - navigate: URL로 이동
 * - act: 자연어로 액션 수행
 * - extract: 페이지에서 정보 추출
 * - observe: 가능한 액션 관찰
 * - agent: 복잡한 작업 자동 수행
 * - info: 현재 페이지 정보
 * - close: 브라우저 종료
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('[Stagehand API] Forwarding request:', body.action)

    const response = await fetch(STAGEHAND_SERVER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      return NextResponse.json(error, { status: response.status })
    }

    const result = await response.json()
    return NextResponse.json(result)

  } catch (error: any) {
    console.error('[Stagehand API] Error:', error)

    // 서버에 연결할 수 없는 경우
    if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
      return NextResponse.json({
        success: false,
        error: 'Stagehand 서버가 실행 중이지 않습니다.',
        message: 'npm run mcp:stagehand 명령으로 서버를 시작해주세요.',
        hint: 'node server/stagehand-server.js',
      }, { status: 503 })
    }

    return NextResponse.json(
      { error: error.message || 'Stagehand operation failed' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/browser/stagehand
 * 현재 상태 확인
 */
export async function GET() {
  try {
    const response = await fetch(STAGEHAND_SERVER)
    const result = await response.json()
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({
      status: 'offline',
      message: 'Stagehand 서버가 실행 중이지 않습니다. npm run mcp:stagehand로 시작하세요.',
    })
  }
}

/**
 * DELETE /api/browser/stagehand
 * 브라우저 종료
 */
export async function DELETE() {
  try {
    const response = await fetch(STAGEHAND_SERVER, { method: 'DELETE' })
    const result = await response.json()
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ success: true, message: '서버가 이미 종료되었습니다' })
  }
}
