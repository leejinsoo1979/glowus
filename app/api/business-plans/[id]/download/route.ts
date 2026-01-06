// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi, getAuthUser } from '@/lib/supabase/server'
import { generateDocument } from '@/lib/business-plan/document-generator'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET: 사업계획서 문서 다운로드 (DOCX/PDF)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClientForApi()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 포맷 파라미터 (기본값: docx)
    const { searchParams } = new URL(request.url)
    const format = (searchParams.get('format') || 'docx') as 'docx' | 'pdf'

    // 사업계획서 존재 확인
    const { data: plan, error: planError } = await supabase
      .from('business_plans')
      .select('id, title')
      .eq('id', id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: '사업계획서를 찾을 수 없습니다' }, { status: 404 })
    }

    // 문서 생성
    const result = await generateDocument(id, format, {
      includeTableOfContents: true,
      includePageNumbers: true
    })

    // 파일로 직접 반환
    return new NextResponse(result.buffer, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
        'Content-Length': result.size.toString()
      }
    })

  } catch (error: any) {
    console.error('[Download] Error:', error)
    return NextResponse.json(
      { error: error.message || '문서 다운로드 실패' },
      { status: 500 }
    )
  }
}
