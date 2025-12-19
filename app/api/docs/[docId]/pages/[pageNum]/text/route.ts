export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDevUserIfEnabled } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'
import pdfParse from 'pdf-parse'

/**
 * PDF 페이지별 텍스트 추출 API
 * GET /api/docs/:docId/pages/:pageNum/text
 *
 * Session Room v2 - 에이전트가 PDF의 특정 페이지 텍스트를 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { docId: string; pageNum: string } }
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 인증 확인
    const devUser = getDevUserIfEnabled()
    let user: any = null

    if (devUser) {
      user = devUser
    } else {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = authUser
    }

    const { docId, pageNum } = params
    const pageNumber = parseInt(pageNum)

    if (isNaN(pageNumber) || pageNumber < 1) {
      return NextResponse.json({ error: 'Invalid page number' }, { status: 400 })
    }

    // shared_viewer_state에서 PDF 정보 조회
    const { data: viewerState, error: viewerError } = await adminClient
      .from('shared_viewer_state')
      .select('*')
      .eq('id', docId)
      .single()

    if (viewerError || !viewerState) {
      // docId가 room_id인 경우 시도
      const { data: viewerByRoom } = await adminClient
        .from('shared_viewer_state')
        .select('*')
        .eq('room_id', docId)
        .single()

      if (!viewerByRoom) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      }

      // room_id로 찾은 경우
      if (viewerByRoom.media_type !== 'pdf') {
        return NextResponse.json({ error: 'Document is not a PDF' }, { status: 400 })
      }

      return await extractPdfPageText(viewerByRoom.media_url, pageNumber, viewerByRoom.media_name)
    }

    if (viewerState.media_type !== 'pdf') {
      return NextResponse.json({ error: 'Document is not a PDF' }, { status: 400 })
    }

    return await extractPdfPageText(viewerState.media_url, pageNumber, viewerState.media_name)
  } catch (error) {
    console.error('[PDF Text API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PDF URL에서 특정 페이지 텍스트 추출
 */
async function extractPdfPageText(
  pdfUrl: string,
  pageNumber: number,
  fileName: string
): Promise<NextResponse> {
  try {
    // PDF 다운로드
    const pdfResponse = await fetch(pdfUrl)
    if (!pdfResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 502 })
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer())

    // pdf-parse로 텍스트 추출
    const pdfData = await pdfParse(pdfBuffer, {
      // 특정 페이지만 추출하는 옵션
      max: pageNumber, // 해당 페이지까지만 파싱
    })

    // 전체 텍스트를 페이지별로 분리
    // pdf-parse는 페이지 구분자로 폼피드 문자(\f)를 사용
    const pages = pdfData.text.split('\f')

    // 요청한 페이지 텍스트 추출 (0-indexed)
    const pageIndex = pageNumber - 1
    const pageText = pages[pageIndex] || ''

    // 페이지가 범위를 벗어난 경우
    if (pageNumber > pdfData.numpages) {
      return NextResponse.json({
        error: 'Page number out of range',
        total_pages: pdfData.numpages
      }, { status: 400 })
    }

    return NextResponse.json({
      doc_name: fileName,
      page: pageNumber,
      total_pages: pdfData.numpages,
      text: pageText.trim(),
      // Evidence 형식 힌트
      evidence_format: `[Evidence: ${fileName} p.${pageNumber} "인용문"]`,
    })
  } catch (parseError: any) {
    console.error('[PDF Text API] Parse error:', parseError)
    return NextResponse.json({
      error: 'Failed to parse PDF',
      details: parseError.message
    }, { status: 500 })
  }
}
