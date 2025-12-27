import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

// GlowUS 프로젝트 루트 경로
const GLOWUS_ROOT = process.cwd()

// 허용된 파일 확장자
const ALLOWED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.scss', '.html', '.py', '.go', '.rs', '.yaml', '.yml', '.env.example']

// 제외 디렉토리
const EXCLUDED_DIRS = ['node_modules', '.next', '.git', 'dist', '.turbo', 'coverage']

// GET: 파일 읽기 또는 프로젝트 스캔
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')
  const action = searchParams.get('action')

  try {
    // 프로젝트 스캔
    if (action === 'scan') {
      const files = await scanDirectory(GLOWUS_ROOT)
      return NextResponse.json({ files, root: GLOWUS_ROOT })
    }

    // 파일 읽기
    if (filePath) {
      const fullPath = path.join(GLOWUS_ROOT, filePath)

      // 보안: 프로젝트 루트 외부 접근 방지
      if (!fullPath.startsWith(GLOWUS_ROOT)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }

      const content = await fs.readFile(fullPath, 'utf-8')
      return NextResponse.json({ content, path: filePath })
    }

    return NextResponse.json({ error: 'Missing path or action parameter' }, { status: 400 })
  } catch (error) {
    console.error('[API/files] Error:', error)
    return NextResponse.json({ error: 'File not found or read error' }, { status: 404 })
  }
}

// POST: 파일 쓰기
export async function POST(request: NextRequest) {
  try {
    const { path: filePath, content } = await request.json()

    if (!filePath || content === undefined) {
      return NextResponse.json({ error: 'Missing path or content' }, { status: 400 })
    }

    const fullPath = path.join(GLOWUS_ROOT, filePath)

    // 보안: 프로젝트 루트 외부 접근 방지
    if (!fullPath.startsWith(GLOWUS_ROOT)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // 디렉토리 생성 (필요시)
    const dir = path.dirname(fullPath)
    await fs.mkdir(dir, { recursive: true })

    // 파일 쓰기
    await fs.writeFile(fullPath, content, 'utf-8')

    return NextResponse.json({ success: true, path: filePath })
  } catch (error) {
    console.error('[API/files] Write error:', error)
    return NextResponse.json({ error: 'Write failed' }, { status: 500 })
  }
}

// 디렉토리 재귀 스캔
async function scanDirectory(dir: string, prefix = ''): Promise<string[]> {
  const results: string[] = []

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      // 제외 디렉토리 스킵
      if (entry.name.startsWith('.') || EXCLUDED_DIRS.includes(entry.name)) {
        continue
      }

      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        // 재귀적으로 하위 디렉토리 스캔
        const subFiles = await scanDirectory(path.join(dir, entry.name), relativePath)
        results.push(...subFiles)
      } else {
        // 허용된 확장자만 포함
        const ext = path.extname(entry.name).toLowerCase()
        if (ALLOWED_EXTENSIONS.includes(ext) || entry.name === 'package.json') {
          results.push(relativePath)
        }
      }

      // 최대 파일 수 제한
      if (results.length >= 1000) break
    }
  } catch (error) {
    console.error(`[API/files] Scan error in ${dir}:`, error)
  }

  return results
}
