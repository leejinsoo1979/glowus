// @ts-nocheck
/**
 * Neural Map Files API
 * GET: 특정 맵의 파일 목록 조회
 * POST: 파일 업로드 및 메타데이터 저장
 * DELETE: 파일 삭제
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ mapId: string }>
}

// GET /api/neural-map/[mapId]/files
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { mapId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 맵 소유권 확인
    const { data: neuralMap } = await supabase
      .from('neural_maps')
      .select('id')
      .eq('id', mapId)
      .eq('user_id', user.id)
      .single()

    if (!neuralMap) {
      return NextResponse.json({ error: 'Neural map not found' }, { status: 404 })
    }

    const { data, error } = await supabase
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
      type: string
      url: string
      size: number
      created_at: string
    }>).map((file) => ({
      id: file.id,
      mapId: file.map_id,
      name: file.name,
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
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 맵 소유권 확인
    const { data: neuralMap } = await supabase
      .from('neural_maps')
      .select('id')
      .eq('id', mapId)
      .eq('user_id', user.id)
      .single()

    if (!neuralMap) {
      return NextResponse.json({ error: 'Neural map not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 파일 타입 검증
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    let fileType: 'pdf' | 'image' | 'video' | 'markdown'

    if (fileExtension === 'pdf') {
      fileType = 'pdf'
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '')) {
      fileType = 'image'
    } else if (['mp4', 'webm', 'mov', 'avi'].includes(fileExtension || '')) {
      fileType = 'video'
    } else if (['md', 'markdown', 'txt'].includes(fileExtension || '')) {
      fileType = 'markdown'
    } else {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    // Storage에 파일 업로드
    const fileName = `${user.id}/${mapId}/${Date.now()}-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('neural-files')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    // 공개 URL 가져오기
    const { data: urlData } = supabase.storage
      .from('neural-files')
      .getPublicUrl(uploadData.path)

    // DB에 메타데이터 저장
    const { data, error } = await supabase
      .from('neural_files')
      .insert({
        map_id: mapId,
        name: file.name,
        type: fileType,
        url: urlData.publicUrl,
        size: file.size,
      } as unknown as never)
      .select()
      .single()

    if (error) {
      console.error('Failed to save file metadata:', error)
      // 업로드된 파일 삭제
      await supabase.storage.from('neural-files').remove([uploadData.path])
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 변환해서 반환
    const fileData = data as unknown as {
      id: string
      map_id: string
      name: string
      type: string
      url: string
      size: number
      created_at: string
    }
    const savedFile = {
      id: fileData.id,
      mapId: fileData.map_id,
      name: fileData.name,
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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
    }

    // 파일 정보 조회 (URL에서 storage path 추출)
    const { data: file } = await supabase
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
        await supabase.storage.from('neural-files').remove([path])
      }
    }

    // DB에서 메타데이터 삭제
    const { error } = await supabase
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
