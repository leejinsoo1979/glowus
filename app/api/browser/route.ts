import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Electron AI Browser 서버 URL (main.ts에서 실행됨)
const ELECTRON_BROWSER_SERVER = 'http://127.0.0.1:45678'

/**
 * 브라우저 자동화 API
 *
 * 이 API는 Electron 앱 내의 BrowserView webview를 제어합니다.
 * Playwright가 아닌 Electron IPC를 통해 실제 앱 내 브라우저를 제어합니다.
 *
 * 사용 방법:
 * 1. 앱에서 브라우저 패널을 열어주세요 (BrowserView 컴포넌트)
 * 2. 채팅에서 "네이버 열어서 날씨 검색해줘" 같이 자연어로 요청하세요
 * 3. AI가 화면을 보고 자동으로 클릭, 입력, 스크롤 등을 수행합니다
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { task, maxSteps = 10 } = body

    if (!task) {
      return NextResponse.json({ error: 'task가 필요합니다' }, { status: 400 })
    }

    console.log('[Browser API] Task received:', task)

    // Electron AI Browser 서버로 요청 전달
    const response = await fetch(ELECTRON_BROWSER_SERVER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, maxSteps }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))

      // 브라우저가 등록되지 않은 경우 친절한 메시지
      if (errorData.error?.includes('No AI browser registered')) {
        return NextResponse.json({
          success: false,
          error: '브라우저 패널을 먼저 열어주세요!',
          message: '앱에서 브라우저 패널을 열면 AI가 해당 브라우저를 제어할 수 있습니다.',
          hint: 'Neural Map에서 브라우저 패널을 추가하거나, 사이드바에서 브라우저를 열어주세요.',
        }, { status: 400 })
      }

      return NextResponse.json(errorData, { status: response.status })
    }

    const result = await response.json()
    console.log('[Browser API] Task completed:', result.finalMessage)

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('[Browser API] Error:', error)

    // Electron 서버에 연결할 수 없는 경우
    if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
      return NextResponse.json({
        success: false,
        error: 'Electron 앱이 실행 중이지 않습니다.',
        message: '이 기능은 Electron 앱에서만 사용할 수 있습니다. 앱을 실행해주세요.',
        hint: 'npm run electron:dev 또는 앱을 직접 실행해주세요.',
      }, { status: 503 })
    }

    return NextResponse.json(
      { error: error.message || 'Browser automation failed' },
      { status: 500 }
    )
  }
}

// 브라우저 상태 확인 API
export async function GET() {
  try {
    const response = await fetch(ELECTRON_BROWSER_SERVER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: '__status_check__', maxSteps: 0 }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json({
        connected: true,
        browserRegistered: false,
        message: errorData.error || '브라우저가 등록되지 않았습니다',
      })
    }

    return NextResponse.json({
      connected: true,
      browserRegistered: true,
      message: '브라우저가 연결되어 있습니다',
    })

  } catch (error: any) {
    return NextResponse.json({
      connected: false,
      browserRegistered: false,
      message: 'Electron 앱에 연결할 수 없습니다',
      error: error.message,
    })
  }
}

// 브라우저 종료는 더 이상 필요 없음 (Electron webview는 앱과 함께 유지됨)
export async function DELETE() {
  return NextResponse.json({
    success: true,
    message: 'Electron 앱 내 브라우저는 앱이 종료될 때까지 유지됩니다.',
  })
}
