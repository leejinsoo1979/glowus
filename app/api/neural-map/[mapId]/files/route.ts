// @ts-nocheck
/**
 * Neural Map Files API
 * GET: 특정 맵의 파일 목록 조회
 * POST: 파일 업로드 및 메타데이터 저장
 * DELETE: 파일 삭제
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// DEV 모드 설정
const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true'
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

// 파일 확장자 분류 (VS Code 스타일 폴더 업로드 지원)
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv'])
const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdx'])
const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'cson', 'css', 'scss', 'sass', 'less',
  'html', 'htm', 'xhtml', 'xml', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf', 'env', 'sh', 'bash', 'zsh',
  'py', 'rb', 'php', 'java', 'kt', 'swift', 'go', 'rs', 'c', 'cc', 'cpp', 'h', 'hpp', 'cs', 'sql',
  'dart', 'scala', 'r', 'lua', 'pl', 'tsv', 'csv', 'ps1', 'dockerfile', 'gradle', 'makefile'
])
const TEXT_EXTENSIONS = new Set([
  'md', 'markdown', 'txt', 'log', 'rtf', 'csv', 'tsv', 'rst', 'tex', 'jsonl', 'ndjson', 'yaml', 'yml'
])

interface RouteParams {
  params: Promise<{ mapId: string }>
}

// GET /api/neural-map/[mapId]/files
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { mapId } = await params
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    let userId: string
    if (DEV_MODE) {
      userId = DEV_USER_ID
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    }

    // 맵 소유권 확인
    const { data: neuralMap } = await adminSupabase
      .from('neural_maps')
      .select('id')
      .eq('id', mapId)
      .eq('user_id', userId)
      .single()

    if (!neuralMap) {
      return NextResponse.json({ error: 'Neural map not found' }, { status: 404 })
    }

    const { data, error } = await adminSupabase
      .from('neural_files')
      .select('*')
      .eq('map_id', mapId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 데이터 변환
    const files = (data as unknown as Array<{
      id: string
      map_id: string
      name: string
      path: string | null
      type: string
      url: string
      size: number
      created_at: string
    }>).map((file) => ({
      id: file.id,
      mapId: file.map_id,
      name: file.name,
      path: file.path || undefined,
      type: file.type,
      url: file.url,
      size: file.size,
      createdAt: file.created_at,
    }))

    return NextResponse.json(files)
  } catch (err) {
    console.error('Files GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/neural-map/[mapId]/files - 파일 업로드
// 🔥 storageMode 지원: local | supabase | gcs
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { mapId } = await params
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    let userId: string
    if (DEV_MODE) {
      userId = DEV_USER_ID
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    }

    // 맵 소유권 확인
    const { data: neuralMap } = await adminSupabase
      .from('neural_maps')
      .select('id')
      .eq('id', mapId)
      .eq('user_id', userId)
      .single()

    if (!neuralMap) {
      return NextResponse.json({ error: 'Neural map not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const path = formData.get('path') as string | null
    const localPath = formData.get('localPath') as string | null  // 🔥 로컬 절대 경로
    const storageMode = (formData.get('storageMode') as string) || 'supabase'  // 🔥 저장 모드
    const fileName = formData.get('fileName') as string | null  // 🔥 local 모드에서 파일명
    const fileSize = formData.get('fileSize') as string | null  // 🔥 local 모드에서 파일 크기

    // 🔥 LOCAL 모드: 파일 업로드 없이 경로 참조만 저장
    if (storageMode === 'local') {
      if (!localPath || !fileName) {
        return NextResponse.json({ error: 'localPath and fileName are required for local mode' }, { status: 400 })
      }

      const fileExtension = fileName.split('.').pop()?.toLowerCase() || ''
      const fileType = getFileType(fileExtension)

      console.log('[POST /files] LOCAL mode - storing path reference only:', localPath)

      // DB에 메타데이터만 저장 (URL 없음, localPath만 저장)
      const insertData: Record<string, unknown> = {
        map_id: mapId,
        name: fileName,
        type: fileType,
        url: `local://${localPath}`,  // 🔥 local:// 프로토콜로 로컬 경로 표시
        size: parseInt(fileSize || '0'),
        local_path: localPath,  // 🔥 로컬 절대 경로 저장
        storage_mode: 'local',  // 🔥 저장 모드 기록
      }
      if (path) {
        insertData.path = path
      }

      let { data, error } = await adminSupabase
        .from('neural_files')
        .insert(insertData as never)
        .select()
        .single()

      // 컬럼 에러시 기본 필드만으로 재시도
      if (error && (error.message.includes('local_path') || error.message.includes('storage_mode'))) {
        console.warn('New column not found, retrying with basic fields:', error.message)
        const basicInsertData: Record<string, unknown> = {
          map_id: mapId,
          name: fileName,
          type: fileType,
          url: `local://${localPath}`,
          size: parseInt(fileSize || '0'),
        }
        if (path) {
          basicInsertData.path = path
        }
        const retryResult = await adminSupabase
          .from('neural_files')
          .insert(basicInsertData as never)
          .select()
          .single()
        data = retryResult.data
        error = retryResult.error
      }

      if (error) {
        console.error('Failed to save file metadata:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const fileData = data as unknown as {
        id: string
        map_id: string
        name: string
        path: string | null
        type: string
        url: string
        size: number
        created_at: string
      }

      return NextResponse.json({
        id: fileData.id,
        mapId: fileData.map_id,
        name: fileData.name,
        path: fileData.path || undefined,
        type: fileData.type,
        url: fileData.url,
        size: fileData.size,
        localPath: localPath,
        storageMode: 'local',
        createdAt: fileData.created_at,
      }, { status: 201 })
    }

    // 🔥 SUPABASE / GCS 모드: 기존 파일 업로드 로직
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 파일 타입 분류 (VS Code처럼 대부분 파일 허용)
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || ''
    const fileType = getFileType(fileExtension)

    console.log('[POST /files] Starting upload for map:', mapId, 'file:', file.name, 'mode:', storageMode)

    // 🔥 GCS 모드: Google Cloud Storage에 업로드
    if (storageMode === 'gcs') {
      console.log('[POST /files] GCS mode - uploading to Google Cloud Storage')

      // 파일 내용 읽기
      const arrayBuffer = await file.arrayBuffer()
      const base64Content = Buffer.from(arrayBuffer).toString('base64')

      // 프로젝트 ID 가져오기 (mapId 기반)
      const { data: neuralMapData } = await adminSupabase
        .from('neural_maps')
        .select('project_id')
        .eq('id', mapId)
        .single()

      const projectId = (neuralMapData as any)?.project_id || mapId

      // GCS API 호출
      const gcsPath = path ? `neural-maps/${mapId}/${path}` : `neural-maps/${mapId}/${Date.now()}-${file.name}`

      const gcsResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/gcs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: gcsPath,
          content: base64Content,
          projectId: projectId,
          contentType: file.type || 'application/octet-stream',
        }),
      })

      if (!gcsResponse.ok) {
        const gcsError = await gcsResponse.json()
        console.error('[GCS Upload] Failed:', gcsError)
        // GCS 실패 시 Supabase로 fallback
        console.log('[GCS Upload] Falling back to Supabase Storage')
        // 아래 Supabase 로직으로 계속 진행 (storageMode는 supabase로 변경)
      } else {
        const gcsResult = await gcsResponse.json()
        console.log('[GCS Upload] Success:', gcsResult)

        // GCS URL 구성
        const GCS_BUCKET = process.env.GCS_BUCKET || 'glowus-projects'
        const gcsUrl = `https://storage.googleapis.com/${GCS_BUCKET}/${gcsResult.path}`

        // DB에 메타데이터 저장
        const insertData: Record<string, unknown> = {
          map_id: mapId,
          name: file.name,
          type: fileType,
          url: gcsUrl,
          size: file.size,
          storage_mode: 'gcs',
        }
        if (path) {
          insertData.path = path
        }

        let { data, error } = await adminSupabase
          .from('neural_files')
          .insert(insertData as never)
          .select()
          .single()

        // 컬럼 에러시 기본 필드만으로 재시도
        if (error && error.message.includes('storage_mode')) {
          const basicInsertData: Record<string, unknown> = {
            map_id: mapId,
            name: file.name,
            type: fileType,
            url: gcsUrl,
            size: file.size,
          }
          if (path) {
            basicInsertData.path = path
          }
          const retryResult = await adminSupabase
            .from('neural_files')
            .insert(basicInsertData as never)
            .select()
            .single()
          data = retryResult.data
          error = retryResult.error
        }

        if (error) {
          console.error('Failed to save file metadata:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const fileData = data as unknown as {
          id: string
          map_id: string
          name: string
          path: string | null
          type: string
          url: string
          size: number
          created_at: string
        }

        return NextResponse.json({
          id: fileData.id,
          mapId: fileData.map_id,
          name: fileData.name,
          path: fileData.path || undefined,
          type: fileData.type,
          url: fileData.url,
          size: fileData.size,
          storageMode: 'gcs',
          createdAt: fileData.created_at,
        }, { status: 201 })
      }
    }

    // Storage에 파일 업로드 (adminSupabase for storage operations)
    // path가 절대 경로로 날아오는 경우를 대비하여 basename만 사용하도록 안전하게 처리
    const safeFileName = file.name.split(/[/\\]/).pop() || 'file'
    const storagePath = `${userId}/${mapId}/${Date.now()}-${safeFileName}`

    // MIME 타입 결정 - 코드 파일도 정상 업로드되도록
    let contentType = file.type || 'application/octet-stream'
    if (!contentType || contentType === 'application/octet-stream') {
      // 확장자 기반으로 MIME 타입 설정
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
      }
      contentType = mimeTypes[fileExtension] || 'application/octet-stream'
    }

    console.log('[Storage Upload] File:', file.name, 'Type:', contentType, 'Size:', file.size)

    const { data: uploadData, error: uploadError } = await adminSupabase.storage
      .from('neural-files')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError, 'File:', file.name)
      return NextResponse.json({ error: 'Failed to upload file: ' + uploadError.message }, { status: 500 })
    }

    // 공개 URL 가져오기
    const { data: urlData } = adminSupabase.storage
      .from('neural-files')
      .getPublicUrl(uploadData.path)

    // DB에 메타데이터 저장 (path 컬럼이 없을 수 있으므로 조건부 추가)
    const insertData: Record<string, unknown> = {
      map_id: mapId,
      name: file.name,
      type: fileType,
      url: urlData.publicUrl,
      size: file.size,
      storage_mode: 'supabase',  // 🔥 저장 모드 기록
    }
    // path가 있을 때만 추가 (DB에 컬럼이 없으면 에러 방지)
    if (path) {
      insertData.path = path
    }

    let { data, error } = await adminSupabase
      .from('neural_files')
      .insert(insertData as never)
      .select()
      .single()

    // path/storage_mode 컬럼 관련 에러시 path 없이 재시도
    if (error && (error.message.includes('path') || error.message.includes('storage_mode'))) {
      console.warn('Column error, retrying with basic fields:', error.message)
      const insertDataWithoutExtras: Record<string, unknown> = {
        map_id: mapId,
        name: file.name,
        type: fileType,
        url: urlData.publicUrl,
        size: file.size,
      }
      const retryResult = await adminSupabase
        .from('neural_files')
        .insert(insertDataWithoutExtras as never)
        .select()
        .single()
      data = retryResult.data
      error = retryResult.error
    }

    if (error) {
      console.error('Failed to save file metadata:', error)
      // 업로드된 파일 삭제
      await adminSupabase.storage.from('neural-files').remove([uploadData.path])
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 변환해서 반환
    const fileData = data as unknown as {
      id: string
      map_id: string
      name: string
      path: string | null
      type: string
      url: string
      size: number
      created_at: string
    }
    const savedFile = {
      id: fileData.id,
      mapId: fileData.map_id,
      name: fileData.name,
      path: fileData.path || undefined,
      type: fileData.type,
      url: fileData.url,
      size: fileData.size,
      storageMode: 'supabase',
      createdAt: fileData.created_at,
    }

    return NextResponse.json(savedFile, { status: 201 })
  } catch (err) {
    console.error('Files POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 🔥 파일 타입 분류 헬퍼 함수
function getFileType(extension: string): 'pdf' | 'image' | 'video' | 'markdown' | 'code' | 'text' | 'binary' {
  if (extension === 'pdf') {
    return 'pdf'
  } else if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image'
  } else if (VIDEO_EXTENSIONS.has(extension)) {
    return 'video'
  } else if (MARKDOWN_EXTENSIONS.has(extension)) {
    return 'markdown'
  } else if (CODE_EXTENSIONS.has(extension)) {
    return 'code'
  } else if (TEXT_EXTENSIONS.has(extension)) {
    return 'text'
  } else {
    return 'binary'
  }
}

// DELETE /api/neural-map/[mapId]/files - 파일 삭제
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { mapId } = await params
    const adminSupabase = createAdminClient()

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
    }

    // 파일 정보 조회 (URL에서 storage path 추출)
    const { data: file } = await adminSupabase
      .from('neural_files')
      .select('url')
      .eq('id', fileId)
      .eq('map_id', mapId)
      .single()

    const fileData = file as unknown as { url: string } | null
    if (fileData?.url) {
      // Storage에서 파일 삭제
      const path = fileData.url.split('/neural-files/').pop()
      if (path) {
        await adminSupabase.storage.from('neural-files').remove([path])
      }
    }

    // DB에서 메타데이터 삭제
    const { error } = await adminSupabase
      .from('neural_files')
      .delete()
      .eq('id', fileId)
      .eq('map_id', mapId)

    if (error) {
      console.error('Failed to delete file:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Files DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
