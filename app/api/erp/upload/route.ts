import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role client for server-side uploads
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = formData.get('folder') as string || 'uploads'
    const companyId = formData.get('companyId') as string

    if (!file) {
      return NextResponse.json({ success: false, error: '파일이 없습니다.' }, { status: 400 })
    }

    // 파일을 Buffer로 변환
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 고유 파일명 생성
    const fileExt = file.name.split('.').pop() || 'png'
    const uniqueName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

    // Storage에 업로드
    const { data, error } = await supabase.storage
      .from('company-files')
      .upload(uniqueName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('[Upload] Storage error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Public URL 가져오기
    const { data: urlData } = supabase.storage
      .from('company-files')
      .getPublicUrl(data.path)

    const publicUrl = urlData.publicUrl

    // DB에도 저장
    if (companyId) {
      if (folder === 'logos') {
        await supabase
          .from('companies')
          .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
          .eq('id', companyId)
      } else if (folder === 'business-registration') {
        // business_registration_url 컬럼에 직접 저장
        await supabase
          .from('companies')
          .update({
            business_registration_url: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', companyId)
      }
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: data.path
    })

  } catch (error: any) {
    console.error('[Upload] Error:', error)
    return NextResponse.json({
      success: false,
      error: error?.message || '업로드 실패'
    }, { status: 500 })
  }
}
