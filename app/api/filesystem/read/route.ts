import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// 보안: 허용된 경로만 접근 가능
const allowedPaths = [
  '/Users/jinsoolee/Documents/GlowUS-Projects',
  '/tmp/glowus-projects',
  process.env.GLOWUS_PROJECTS_PATH,
].filter(Boolean) as string[]

function isPathAllowed(filePath: string): boolean {
  const normalizedPath = path.normalize(filePath)
  return allowedPaths.some(allowed => normalizedPath.startsWith(allowed))
}

// CSS/JS 파일 경로를 인라인 콘텐츠로 변환
async function inlineAssets(html: string, basePath: string): Promise<string> {
  let result = html

  // CSS 파일 인라인화: <link rel="stylesheet" href="...">
  const cssLinkRegex = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi
  const cssLinks = [...html.matchAll(cssLinkRegex)]

  for (const match of cssLinks) {
    const cssHref = match[1]
    if (!cssHref.startsWith('http')) {
      const cssPath = path.resolve(basePath, cssHref)
      if (isPathAllowed(cssPath)) {
        try {
          const cssContent = await fs.readFile(cssPath, 'utf-8')
          result = result.replace(match[0], `<style>${cssContent}</style>`)
        } catch {
          console.warn(`[API] Could not inline CSS: ${cssPath}`)
        }
      }
    }
  }

  // JS 파일 인라인화: <script src="...">
  const jsScriptRegex = /<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi
  const jsScripts = [...html.matchAll(jsScriptRegex)]

  for (const match of jsScripts) {
    const jsSrc = match[1]
    if (!jsSrc.startsWith('http')) {
      const jsPath = path.resolve(basePath, jsSrc)
      if (isPathAllowed(jsPath)) {
        try {
          const jsContent = await fs.readFile(jsPath, 'utf-8')
          result = result.replace(match[0], `<script>${jsContent}</script>`)
        } catch {
          console.warn(`[API] Could not inline JS: ${jsPath}`)
        }
      }
    }
  }

  // 이미지 인라인화 (작은 이미지만): <img src="...">
  const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi
  const imgs = [...html.matchAll(imgRegex)]

  for (const match of imgs) {
    const imgSrc = match[1]
    if (!imgSrc.startsWith('http') && !imgSrc.startsWith('data:')) {
      const imgPath = path.resolve(basePath, imgSrc)
      if (isPathAllowed(imgPath)) {
        try {
          const stats = await fs.stat(imgPath)
          // 500KB 이하만 인라인
          if (stats.size < 500 * 1024) {
            const imgBuffer = await fs.readFile(imgPath)
            const ext = path.extname(imgPath).toLowerCase().slice(1)
            const mimeType = ext === 'svg' ? 'image/svg+xml' :
                            ext === 'png' ? 'image/png' :
                            ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                            ext === 'gif' ? 'image/gif' :
                            ext === 'webp' ? 'image/webp' : 'image/png'
            const base64 = imgBuffer.toString('base64')
            const newSrc = `data:${mimeType};base64,${base64}`
            result = result.replace(match[0], match[0].replace(imgSrc, newSrc))
          }
        } catch {
          console.warn(`[API] Could not inline image: ${imgPath}`)
        }
      }
    }
  }

  return result
}

export async function POST(request: NextRequest) {
  try {
    const { path: filePath, inline = true } = await request.json()

    if (!filePath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 })
    }

    const normalizedPath = path.normalize(filePath)

    if (!isPathAllowed(normalizedPath)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // 파일 읽기
    let content = await fs.readFile(normalizedPath, 'utf-8')

    // HTML 파일이고 inline 옵션이 true면 CSS/JS 인라인화
    if (inline && normalizedPath.endsWith('.html')) {
      const basePath = path.dirname(normalizedPath)
      content = await inlineAssets(content, basePath)
    }

    return NextResponse.json({ content })
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    console.error('[API] filesystem/read error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
