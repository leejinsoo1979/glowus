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
    const file = formData.get('file') as File
    const path = formData.get('path') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 파일 타입 분류 (VS Code처럼 대부분 파일 허용)
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || ''
    let fileType: 'pdf' | 'image' | 'video' | 'markdown' | 'code' | 'text' | 'binary'

    if (fileExtension === 'pdf') {
      fileType = 'pdf'
    } else if (IMAGE_EXTENSIONS.has(fileExtension)) {
      fileType = 'image'
    } else if (VIDEO_EXTENSIONS.has(fileExtension)) {
      fileType = 'video'
    } else if (MARKDOWN_EXTENSIONS.has(fileExtension)) {
      fileType = 'markdown'
    } else if (CODE_EXTENSIONS.has(fileExtension)) {
      fileType = 'code'
    } else if (TEXT_EXTENSIONS.has(fileExtension)) {
      fileType = 'text'
    } else {
      fileType = 'binary'
    }

    // Storage에 파일 업로드 (adminSupabase for storage operations)
    const fileName = `${userId}/${mapId}/${Date.now()}-${file.name}`

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
      .upload(fileName, file, {
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

    // path 컬럼 관련 에러시 path 없이 재시도
    if (error && error.message.includes('path')) {
      console.warn('Path column error, retrying without path:', error.message)
      const insertDataWithoutPath: Record<string, unknown> = {
        map_id: mapId,
        name: file.name,
        type: fileType,
        url: urlData.publicUrl,
        size: file.size,
      }
      const retryResult = await adminSupabase
        .from('neural_files')
        .insert(insertDataWithoutPath as never)
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
      createdAt: fileData.created_at,
    }

    return NextResponse.json(savedFile, { status: 201 })
  } catch (err) {
    console.error('Files POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
