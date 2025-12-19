export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDevUserIfEnabled } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'
// @ts-ignore - pdf-parse has no proper type exports
const pdfParse = require('pdf-parse')

/**
 * PDF 전체 텍스트 추출 API
 * GET /api/docs/:docId/text
 *
 * Query params:
 * - pages: 특정 페이지들만 추출 (예: "1,2,5" 또는 "1-5")
 *
 * Session Room v2 - 에이전트가 PDF 전체 또는 일부 페이지 텍스트 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { docId: string } }
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

    const { docId } = params
    const { searchParams } = new URL(request.url)
    const pagesParam = searchParams.get('pages')

    // shared_viewer_state에서 PDF 정보 조회
    let viewerState: any = null

    const { data: viewerById } = await (adminClient
      .from('shared_viewer_state') as any)
      .select('*')
      .eq('id', docId)
      .single()

    if (viewerById) {
      viewerState = viewerById
    } else {
      // docId가 room_id인 경우 시도
      const { data: viewerByRoom } = await (adminClient
        .from('shared_viewer_state') as any)
        .select('*')
        .eq('room_id', docId)
        .single()

      if (viewerByRoom) {
        viewerState = viewerByRoom
      }
    }

    if (!viewerState) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (viewerState.media_type !== 'pdf') {
      return NextResponse.json({ error: 'Document is not a PDF' }, { status: 400 })
    }

    // PDF 다운로드
    const pdfResponse = await fetch(viewerState.media_url)
    if (!pdfResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 502 })
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer())

    // pdf-parse로 텍스트 추출
    const pdfData = await pdfParse(pdfBuffer)

    // 전체 텍스트를 페이지별로 분리
    const allPages = pdfData.text.split('\f')

    // 요청한 페이지들만 필터링
    let requestedPages: number[] = []

    if (pagesParam) {
      // "1,2,5" 또는 "1-5" 형식 파싱
      const parts = pagesParam.split(',')
      for (const part of parts) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(n => parseInt(n.trim()))
          for (let i = start; i <= end && i <= pdfData.numpages; i++) {
            if (i >= 1) requestedPages.push(i)
          }
        } else {
          const pageNum = parseInt(part.trim())
          if (pageNum >= 1 && pageNum <= pdfData.numpages) {
            requestedPages.push(pageNum)
          }
        }
      }
      // 중복 제거 및 정렬
      requestedPages = [...new Set(requestedPages)].sort((a, b) => a - b)
    } else {
      // 전체 페이지
      requestedPages = Array.from({ length: pdfData.numpages }, (_, i) => i + 1)
    }

    // 페이지별 텍스트 구성
    const pagesData = requestedPages.map(pageNum => ({
      page: pageNum,
      text: (allPages[pageNum - 1] || '').trim(),
      evidence_format: `[Evidence: ${viewerState.media_name} p.${pageNum} "인용문"]`,
    }))

    return NextResponse.json({
      doc_id: viewerState.id,
      doc_name: viewerState.media_name,
      doc_url: viewerState.media_url,
      total_pages: pdfData.numpages,
      requested_pages: requestedPages,
      pages: pagesData,
      // 전체 텍스트 (요약용)
      full_text: requestedPages.length === pdfData.numpages
        ? pdfData.text
        : pagesData.map(p => p.text).join('\n\n---\n\n'),
    })
  } catch (error: any) {
    console.error('[PDF Text API] Error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
}
