export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST: 파일 업로드
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const adminClient = createAdminClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const roomId = formData.get('roomId') as string

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
    }

    // 허용된 파일 타입
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
    const allowedDocTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ]
    const allowedFileTypes = [...allowedImageTypes, ...allowedVideoTypes, ...allowedDocTypes]

    if (!allowedFileTypes.includes(file.type)) {
      return NextResponse.json({ error: '지원하지 않는 파일 형식입니다' }, { status: 400 })
    }

    const isImage = allowedImageTypes.includes(file.type)
    const isVideo = allowedVideoTypes.includes(file.type)

    // 파일 크기 제한 (비디오: 100MB, 기타: 10MB)
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({
        error: isVideo ? '비디오 파일 크기는 100MB 이하여야 합니다' : '파일 크기는 10MB 이하여야 합니다'
      }, { status: 400 })
    }
    const fileExt = file.name.split('.').pop()
    const fileName = `${roomId}/${user.id}/${Date.now()}.${fileExt}`
    const bucket = 'chat-files'

    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Supabase Storage에 업로드
    const { data: uploadData, error: uploadError } = await (adminClient as any).storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // Public URL 가져오기
    const { data: { publicUrl } } = (adminClient as any).storage
      .from(bucket)
      .getPublicUrl(fileName)

    return NextResponse.json({
      url: publicUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      isImage,
      isVideo,
      isPdf: file.type === 'application/pdf',
    })
  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
