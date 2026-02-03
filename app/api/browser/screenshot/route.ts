import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// 스크린샷 요청 대기 상태를 저장
const pendingRequests = new Map<string, {
  resolve: (path: string | null) => void
  timeout: NodeJS.Timeout
}>()

// 기본 저장 경로
const SCREENSHOT_DIR = '/tmp/glowus-screenshots'

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()

    if (action === 'capture') {
      // 새 스크린샷 요청
      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

      // 디렉토리 생성
      await fs.mkdir(SCREENSHOT_DIR, { recursive: true })

      // 결과를 기다리는 Promise 생성
      const resultPromise = new Promise<string | null>((resolve) => {
        const timeout = setTimeout(() => {
          pendingRequests.delete(requestId)
          resolve(null)
        }, 10000) // 10초 타임아웃

        pendingRequests.set(requestId, { resolve, timeout })
      })

      // 클라이언트에게 requestId 반환 (클라이언트가 이벤트를 발생시켜야 함)
      // 실제 캡처는 브라우저에서 수행되어야 함
      return NextResponse.json({
        success: true,
        requestId,
        message: 'Screenshot request created. Client should trigger glowus:capture-browser event.',
        // 클라이언트에서 캡처 후 /api/browser/screenshot에 POST로 결과 전송해야 함
      })
    }

    if (action === 'result') {
      // 스크린샷 결과 수신 (BrowserView에서 호출)
      const { requestId, path: screenshotPath, success } = await request.json()

      const pending = pendingRequests.get(requestId)
      if (pending) {
        clearTimeout(pending.timeout)
        pending.resolve(success ? screenshotPath : null)
        pendingRequests.delete(requestId)
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('[API] browser/screenshot error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 스크린샷 상태 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const requestId = searchParams.get('requestId')

    if (!requestId) {
      // 최신 스크린샷 목록 반환
      try {
        const files = await fs.readdir(SCREENSHOT_DIR)
        const screenshots = files
          .filter(f => f.endsWith('.png'))
          .map(f => ({
            name: f,
            path: path.join(SCREENSHOT_DIR, f)
          }))
          .sort((a, b) => b.name.localeCompare(a.name))
          .slice(0, 10) // 최근 10개

        return NextResponse.json({ screenshots })
      } catch {
        return NextResponse.json({ screenshots: [] })
      }
    }

    // 특정 요청의 상태 확인
    const pending = pendingRequests.has(requestId)
    return NextResponse.json({ pending, requestId })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
