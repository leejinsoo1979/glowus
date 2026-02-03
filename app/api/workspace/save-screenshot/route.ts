import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// 허용된 스크린샷 저장 경로
const ALLOWED_PATHS = [
  '/tmp/glowus-screenshots',
  '/Users/jinsoolee/Documents/GlowUS-Projects',
  process.env.GLOWUS_PROJECTS_PATH,
].filter(Boolean) as string[]

function isPathAllowed(filePath: string): boolean {
  const normalizedPath = path.normalize(filePath)
  return ALLOWED_PATHS.some(allowed => normalizedPath.startsWith(allowed))
}

export async function POST(request: NextRequest) {
  try {
    const { dataUrl, path: savePath } = await request.json()

    if (!dataUrl || !savePath) {
      return NextResponse.json({ error: 'dataUrl and path are required' }, { status: 400 })
    }

    // 보안 체크
    if (!isPathAllowed(savePath)) {
      return NextResponse.json({ error: 'Path not allowed' }, { status: 403 })
    }

    // 디렉토리 생성
    const dir = path.dirname(savePath)
    await fs.mkdir(dir, { recursive: true })

    // Base64 데이터 추출
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    // 파일 저장
    await fs.writeFile(savePath, buffer)

    console.log('[API] Screenshot saved:', savePath)

    return NextResponse.json({
      success: true,
      path: savePath,
      size: buffer.length
    })
  } catch (error: any) {
    console.error('[API] save-screenshot error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
