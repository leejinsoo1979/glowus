export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

// POST: 에이전트 이미지 업로드 (아바타, GIF, 감정 아바타)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 개발 모드: DEV_USER 사용
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
    const type = formData.get('type') as string // 'avatar' | 'gif' | 'emotion'
    const emotion = formData.get('emotion') as string | null // 감정 타입 (happy, sad, angry, surprised 등)
    const agentId = formData.get('agentId') as string | null // 기존 에이전트 수정 시

    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다' }, { status: 400 })
    }

    if (!type || !['avatar', 'gif', 'emotion'].includes(type)) {
      return NextResponse.json({ error: '올바른 타입을 지정해주세요 (avatar, gif, emotion)' }, { status: 400 })
    }

    // 허용된 파일 타입
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp']
    const allowedGifTypes = ['image/gif']

    let allowedTypes: string[]
    if (type === 'gif') {
      allowedTypes = [...allowedGifTypes, ...allowedImageTypes]
    } else {
      allowedTypes = [...allowedImageTypes, ...allowedGifTypes]
    }

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: type === 'gif'
          ? '지원하지 않는 파일 형식입니다. GIF, PNG, JPG, WebP를 사용해주세요.'
          : '지원하지 않는 파일 형식입니다. PNG, JPG, WebP, GIF를 사용해주세요.'
      }, { status: 400 })
    }

    // 파일 크기 제한
    const maxSize = type === 'gif' ? 10 * 1024 * 1024 : 5 * 1024 * 1024 // GIF: 10MB, 이미지: 5MB
    if (file.size > maxSize) {
      return NextResponse.json({
        error: type === 'gif'
          ? 'GIF 파일 크기는 10MB 이하여야 합니다'
          : '이미지 파일 크기는 5MB 이하여야 합니다'
      }, { status: 400 })
    }

    // 파일명 생성
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png'
    const timestamp = Date.now()
    let fileName: string

    if (type === 'avatar') {
      fileName = `${user.id}/avatars/${agentId || 'new'}_${timestamp}.${fileExt}`
    } else if (type === 'gif') {
      fileName = `${user.id}/gifs/${agentId || 'new'}_main_${timestamp}.${fileExt}`
    } else if (type === 'emotion' && emotion) {
      fileName = `${user.id}/emotions/${agentId || 'new'}_${emotion}_${timestamp}.${fileExt}`
    } else {
      return NextResponse.json({ error: '감정 타입을 지정해주세요' }, { status: 400 })
    }

    const bucket = 'agent-assets'

    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Supabase Storage에 업로드
    const { data: uploadData, error: uploadError } = await (adminClient as any).storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true, // 같은 파일명이면 덮어쓰기
      })

    if (uploadError) {
      console.error('Agent asset upload error:', uploadError)

      // 버킷이 없으면 생성 시도
      if (uploadError.message?.includes('not found') || uploadError.statusCode === '404') {
        // 버킷 생성 시도
        const { error: createBucketError } = await (adminClient as any).storage.createBucket(bucket, {
          public: true,
          fileSizeLimit: 10 * 1024 * 1024, // 10MB
        })

        if (createBucketError && !createBucketError.message?.includes('already exists')) {
          console.error('Failed to create bucket:', createBucketError)
          return NextResponse.json({ error: '스토리지 설정 오류' }, { status: 500 })
        }

        // 재시도
        const { error: retryError } = await (adminClient as any).storage
          .from(bucket)
          .upload(fileName, buffer, {
            contentType: file.type,
            upsert: true,
          })

        if (retryError) {
          console.error('Retry upload error:', retryError)
          return NextResponse.json({ error: retryError.message }, { status: 500 })
        }
      } else {
        return NextResponse.json({ error: uploadError.message }, { status: 500 })
      }
    }

    // Public URL 가져오기
    const { data: { publicUrl } } = (adminClient as any).storage
      .from(bucket)
      .getPublicUrl(fileName)

    return NextResponse.json({
      url: publicUrl,
      type,
      emotion: emotion || null,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    })
  } catch (error) {
    console.error('Agent asset upload error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
