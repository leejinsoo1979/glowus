export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Project Workspace API
 *
 * GET: 프로젝트 워크스페이스의 파일 목록 조회 (Supabase Storage)
 * POST: 파일 업로드
 * DELETE: 파일 삭제
 */

// GET: 프로젝트 워크스페이스 파일 목록
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 프로젝트 존재 확인
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, name, owner_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다' }, { status: 404 })
    }

    // Storage에서 파일 목록 조회
    // 경로: projects/{projectId}/
    const storagePath = `projects/${projectId}`

    const { data: files, error: storageError } = await adminClient.storage
      .from('neural-files')
      .list(storagePath, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
      })

    if (storageError) {
      console.error('Storage list error:', storageError)
      // 폴더가 없으면 빈 배열 반환
      return NextResponse.json([])
    }

    // 파일 정보 변환
    const fileList = (files || [])
      .filter(f => f.name !== '.emptyFolderPlaceholder')
      .map(file => {
        const { data: urlData } = adminClient.storage
          .from('neural-files')
          .getPublicUrl(`${storagePath}/${file.name}`)

        return {
          id: file.id,
          name: file.name,
          path: `${storagePath}/${file.name}`,
          type: getFileType(file.name),
          url: urlData.publicUrl,
          size: file.metadata?.size || 0,
          createdAt: file.created_at,
          updatedAt: file.updated_at,
        }
      })

    return NextResponse.json(fileList)
  } catch (error) {
    console.error('Workspace GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// POST: 파일 업로드
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const relativePath = formData.get('path') as string | null // 상대 경로 (폴더 구조 유지)

    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다' }, { status: 400 })
    }

    // Storage 경로 생성
    const fileName = relativePath || file.name
    const storagePath = `projects/${projectId}/${fileName}`

    // MIME 타입 결정
    const contentType = file.type || getMimeType(file.name)

    // 파일 업로드
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from('neural-files')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true, // 덮어쓰기 허용
        contentType,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // 공개 URL
    const { data: urlData } = adminClient.storage
      .from('neural-files')
      .getPublicUrl(uploadData.path)

    return NextResponse.json({
      id: uploadData.id,
      name: file.name,
      path: storagePath,
      type: getFileType(file.name),
      url: urlData.publicUrl,
      size: file.size,
      createdAt: new Date().toISOString(),
    }, { status: 201 })
  } catch (error) {
    console.error('Workspace POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// DELETE: 파일 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')

    if (!filePath) {
      return NextResponse.json({ error: '파일 경로가 필요합니다' }, { status: 400 })
    }

    // 프로젝트 경로 검증
    if (!filePath.startsWith(`projects/${projectId}/`)) {
      return NextResponse.json({ error: '잘못된 파일 경로입니다' }, { status: 400 })
    }

    const { error } = await adminClient.storage
      .from('neural-files')
      .remove([filePath])

    if (error) {
      console.error('Delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Workspace DELETE error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// 파일 타입 결정
function getFileType(fileName: string): 'pdf' | 'image' | 'video' | 'markdown' | 'code' | 'text' | 'binary' {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff']
  if (imageExts.includes(ext)) return 'image'

  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv']
  if (videoExts.includes(ext)) return 'video'

  if (ext === 'pdf') return 'pdf'

  const mdExts = ['md', 'markdown', 'mdx']
  if (mdExts.includes(ext)) return 'markdown'

  const codeExts = [
    'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java',
    'cpp', 'c', 'cs', 'php', 'swift', 'kt', 'scala', 'dart',
    'html', 'htm', 'css', 'scss', 'sass', 'less', 'vue', 'svelte',
    'json', 'yaml', 'yml', 'xml', 'toml', 'ini',
    'sh', 'bash', 'zsh', 'fish', 'sql', 'prisma',
    'env', 'gitignore', 'dockerignore'
  ]
  if (codeExts.includes(ext)) return 'code'

  const textExts = ['txt', 'csv', 'log', 'readme']
  if (textExts.includes(ext)) return 'text'

  return 'text'
}

// MIME 타입 결정
function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const mimeTypes: Record<string, string> = {
    'ts': 'text/typescript',
    'tsx': 'text/typescript',
    'js': 'text/javascript',
    'jsx': 'text/javascript',
    'json': 'application/json',
    'css': 'text/css',
    'html': 'text/html',
    'md': 'text/markdown',
    'py': 'text/x-python',
    'txt': 'text/plain',
    'pdf': 'application/pdf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}
