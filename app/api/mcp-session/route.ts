import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// 세션 파일 경로 (MCP 서버가 읽을 수 있는 위치)
const SESSION_FILE_PATH = '/tmp/glow-mcp-session.txt'
const PROJECT_SESSION_PATH = path.join(process.cwd(), '.mcp-session')

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    // 두 위치에 저장 (시스템 temp + 프로젝트 루트)
    const sessionData = JSON.stringify({
      sessionId,
      timestamp: Date.now(),
      updatedAt: new Date().toISOString(),
    })

    // /tmp에 저장
    await writeFile(SESSION_FILE_PATH, sessionData, 'utf-8')

    // 프로젝트 루트에도 저장 (MCP 서버가 더 쉽게 접근)
    await writeFile(PROJECT_SESSION_PATH, sessionData, 'utf-8')

    console.log(`[MCP Session] Saved session ID: ${sessionId}`)

    return NextResponse.json({ success: true, sessionId })
  } catch (error) {
    console.error('[MCP Session] Error saving session:', error)
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 })
  }
}

export async function GET() {
  try {
    // 프로젝트 루트에서 먼저 읽기 시도
    if (existsSync(PROJECT_SESSION_PATH)) {
      const { readFile } = await import('fs/promises')
      const data = await readFile(PROJECT_SESSION_PATH, 'utf-8')
      return NextResponse.json(JSON.parse(data))
    }

    // 없으면 /tmp에서 읽기
    if (existsSync(SESSION_FILE_PATH)) {
      const { readFile } = await import('fs/promises')
      const data = await readFile(SESSION_FILE_PATH, 'utf-8')
      return NextResponse.json(JSON.parse(data))
    }

    return NextResponse.json({ error: 'No session found' }, { status: 404 })
  } catch (error) {
    console.error('[MCP Session] Error reading session:', error)
    return NextResponse.json({ error: 'Failed to read session' }, { status: 500 })
  }
}
