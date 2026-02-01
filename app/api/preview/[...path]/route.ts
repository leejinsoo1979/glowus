import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// 세션별 basePath 저장 (메모리 캐시)
const basePathCache = new Map<string, { basePath: string; timestamp: number }>()
const CACHE_TTL = 30 * 60 * 1000 // 30분

function getSessionBasePath(sessionId: string): string | null {
  const cached = basePathCache.get(sessionId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.basePath
  }
  basePathCache.delete(sessionId)
  return null
}

function setSessionBasePath(sessionId: string, basePath: string) {
  basePathCache.set(sessionId, { basePath, timestamp: Date.now() })
}

// HTML 내 상대 경로를 절대 경로로 변환
function rewriteHtmlUrls(html: string, basePath: string, sessionId: string): string {
  const baseUrl = `/api/preview`
  const sessionParam = `sessionId=${encodeURIComponent(sessionId)}`

  // CSS link 태그
  html = html.replace(
    /(<link[^>]+href=["'])([^"']+)(["'][^>]*>)/gi,
    (match, prefix, href, suffix) => {
      if (href.startsWith('http') || href.startsWith('//') || href.startsWith('data:')) {
        return match
      }
      const newHref = `${baseUrl}/${href.replace(/^\.?\//, '')}?${sessionParam}`
      return `${prefix}${newHref}${suffix}`
    }
  )

  // JS script 태그
  html = html.replace(
    /(<script[^>]+src=["'])([^"']+)(["'][^>]*>)/gi,
    (match, prefix, src, suffix) => {
      if (src.startsWith('http') || src.startsWith('//') || src.startsWith('data:')) {
        return match
      }
      const newSrc = `${baseUrl}/${src.replace(/^\.?\//, '')}?${sessionParam}`
      return `${prefix}${newSrc}${suffix}`
    }
  )

  // 이미지 태그
  html = html.replace(
    /(<img[^>]+src=["'])([^"']+)(["'][^>]*>)/gi,
    (match, prefix, src, suffix) => {
      if (src.startsWith('http') || src.startsWith('//') || src.startsWith('data:')) {
        return match
      }
      const newSrc = `${baseUrl}/${src.replace(/^\.?\//, '')}?${sessionParam}`
      return `${prefix}${newSrc}${suffix}`
    }
  )

  // audio/video source
  html = html.replace(
    /(<(?:audio|video|source)[^>]+src=["'])([^"']+)(["'][^>]*>)/gi,
    (match, prefix, src, suffix) => {
      if (src.startsWith('http') || src.startsWith('//') || src.startsWith('data:')) {
        return match
      }
      const newSrc = `${baseUrl}/${src.replace(/^\.?\//, '')}?${sessionParam}`
      return `${prefix}${newSrc}${suffix}`
    }
  )

  return html
}

// MIME 타입 매핑
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
}

// 보안: 허용된 경로만 접근 가능
const ALLOWED_PATHS = [
  '/Users/jinsoolee/Documents/GlowUS-Projects',
  '/tmp/glowus-projects',
  process.env.GLOWUS_PROJECTS_PATH,
].filter(Boolean) as string[]

function isPathAllowed(filePath: string): boolean {
  const normalizedPath = path.normalize(filePath)
  return ALLOWED_PATHS.some(allowed => normalizedPath.startsWith(allowed))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // 🔥 Next.js 14+: params는 Promise로 전달됨
    const resolvedParams = await params
    const searchParams = request.nextUrl.searchParams
    let basePath = searchParams.get('basePath')
    const sessionId = searchParams.get('sessionId')

    // basePath가 없으면 sessionId로 캐시에서 가져오기
    if (!basePath && sessionId) {
      basePath = getSessionBasePath(sessionId)
    }

    if (!basePath) {
      return NextResponse.json({ error: 'basePath or valid sessionId is required' }, { status: 400 })
    }

    // 세션에 basePath 저장 (새 세션이거나 갱신)
    const currentSessionId = sessionId || `session_${Date.now()}`
    setSessionBasePath(currentSessionId, basePath)

    // path 파라미터 조합
    const filePath = resolvedParams.path?.join('/') || 'index.html'
    const fullPath = path.join(basePath, filePath)

    // 보안 체크
    if (!isPathAllowed(fullPath)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // 파일 존재 확인
    let targetPath = fullPath
    try {
      await fs.access(fullPath)
    } catch {
      // index.html 시도
      if (!filePath.includes('.')) {
        const indexPath = path.join(fullPath, 'index.html')
        if (isPathAllowed(indexPath)) {
          try {
            await fs.access(indexPath)
            targetPath = indexPath
          } catch {
            // 🔥 더 명확한 에러 페이지 반환 (404 대신 HTML)
            const errorHtml = `<!DOCTYPE html>
<html>
<head><title>파일을 찾을 수 없습니다</title>
<style>
body { font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #18181b; color: #fff; }
.container { text-align: center; padding: 2rem; }
.icon { font-size: 4rem; margin-bottom: 1rem; }
h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
p { color: #a1a1aa; font-size: 0.875rem; margin-bottom: 1rem; }
code { background: #27272a; padding: 0.5rem 1rem; border-radius: 0.5rem; display: block; margin-top: 1rem; font-size: 0.75rem; word-break: break-all; }
</style>
</head>
<body>
<div class="container">
<div class="icon">📂</div>
<h1>index.html을 찾을 수 없습니다</h1>
<p>프로젝트 폴더에 index.html 파일이 없거나, 폴더가 비어있습니다.</p>
<code>${basePath}</code>
</div>
</body>
</html>`
            return new NextResponse(errorHtml, {
              status: 404,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'X-Frame-Options': 'SAMEORIGIN',
                'Content-Security-Policy': "frame-ancestors 'self'",
                'Cross-Origin-Resource-Policy': 'same-origin',
              }
            })
          }
        }
      } else {
        return NextResponse.json({ error: 'File not found', path: fullPath }, { status: 404 })
      }
    }

    // 파일 읽기
    const ext = path.extname(targetPath).toLowerCase()
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

    // HTML 파일이면 URL 재작성
    if (ext === '.html' || ext === '.htm') {
      let html = await fs.readFile(targetPath, 'utf-8')
      html = rewriteHtmlUrls(html, basePath, currentSessionId)

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
          // 🔥 iframe 로딩 허용
          'X-Frame-Options': 'SAMEORIGIN',
          'Content-Security-Policy': "frame-ancestors 'self'",
          // 🔥 COEP: require-corp 환경에서 로드 허용
          'Cross-Origin-Resource-Policy': 'same-origin',
        },
      })
    }

    // 그 외 파일은 그대로 반환
    const content = await fs.readFile(targetPath)
    return new NextResponse(content, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'no-cache',
        // 🔥 iframe 로딩 허용
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "frame-ancestors 'self'",
        // 🔥 COEP: require-corp 환경에서 로드 허용
        'Cross-Origin-Resource-Policy': 'same-origin',
      },
    })
  } catch (error: any) {
    console.error('[API] preview error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
