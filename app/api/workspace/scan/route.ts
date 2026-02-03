import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import * as fs from 'fs'
import * as path from 'path'

export const runtime = 'nodejs'

interface FileInfo {
  name: string
  path: string
  relativePath: string
  kind: 'file' | 'directory'
  size?: number
  content?: string
  children?: FileInfo[]
}

// 🔥 서버 측에서 프로젝트 폴더 스캔
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
    const { projectPath, includeContent = true } = body

    if (!projectPath) {
      return NextResponse.json({ error: '프로젝트 경로가 필요합니다' }, { status: 400 })
    }

    // 경로가 존재하는지 확인
    if (!fs.existsSync(projectPath)) {
      return NextResponse.json({ error: '경로가 존재하지 않습니다' }, { status: 404 })
    }

    // 코드 파일 확장자
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.py', '.java', '.go', '.rs', '.sql', '.prisma', '.graphql', '.gql', '.yaml', '.yml']

    // 무시할 디렉토리/파일
    const ignorePatterns = ['node_modules', '.git', '.next', 'dist', 'build', '.cache', '__pycache__', '.DS_Store']

    const scanDirectory = (dirPath: string, basePath: string): FileInfo[] => {
      const items: FileInfo[] = []

      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true })

        for (const entry of entries) {
          // 무시할 패턴 체크
          if (ignorePatterns.some(p => entry.name.includes(p))) continue

          const fullPath = path.join(dirPath, entry.name)
          const relativePath = path.relative(basePath, fullPath)

          if (entry.isDirectory()) {
            const children = scanDirectory(fullPath, basePath)
            if (children.length > 0) {
              items.push({
                name: entry.name,
                path: fullPath,
                relativePath,
                kind: 'directory',
                children
              })
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase()
            const stats = fs.statSync(fullPath)

            const fileInfo: FileInfo = {
              name: entry.name,
              path: fullPath,
              relativePath,
              kind: 'file',
              size: stats.size
            }

            // 코드 파일이면 내용도 읽기
            if (includeContent && codeExtensions.includes(ext) && stats.size < 100000) {
              try {
                fileInfo.content = fs.readFileSync(fullPath, 'utf-8')
              } catch {
                // 읽기 실패 시 무시
              }
            }

            items.push(fileInfo)
          }
        }
      } catch (err) {
        console.error('[Workspace Scan] Error scanning directory:', dirPath, err)
      }

      return items
    }

    const tree = scanDirectory(projectPath, projectPath)
    const projectName = path.basename(projectPath)

    // 파일 개수 계산
    const countFiles = (items: FileInfo[]): number => {
      return items.reduce((count, item) => {
        if (item.kind === 'file') return count + 1
        if (item.children) return count + countFiles(item.children)
        return count
      }, 0)
    }

    return NextResponse.json({
      success: true,
      tree: {
        name: projectName,
        path: projectPath,
        relativePath: '',
        kind: 'directory' as const,
        children: tree
      },
      stats: {
        fileCount: countFiles(tree),
        dirCount: tree.filter(i => i.kind === 'directory').length
      }
    })

  } catch (error) {
    console.error('[Workspace Scan] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '스캔 실패' },
      { status: 500 }
    )
  }
}
