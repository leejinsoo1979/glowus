import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import {
  processDocument,
  fetchUrlContent,
  getAgentDocuments,
  deleteDocument,
  type SupportedFileType,
} from '@/lib/rag/processor'
import { getKnowledgeStats } from '@/lib/rag/retriever'

// GET: 에이전트의 지식베이스 문서 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const supabase = await createClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 문서 목록 조회
    const documents = await getAgentDocuments(agentId)

    // 통계 조회
    const stats = await getKnowledgeStats(agentId)

    return NextResponse.json({
      documents,
      stats,
    })
  } catch (error) {
    console.error('Knowledge GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '조회 실패' },
      { status: 500 }
    )
  }
}

// POST: 새 문서 추가 (텍스트, URL, 파일)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const supabase = await createClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 에이전트 소유권 확인
    const adminClient = createAdminClient()
    const { data: agent, error: agentError } = await (adminClient as any)
      .from('deployed_agents')
      .select('id, owner_id')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: '에이전트를 찾을 수 없습니다' }, { status: 404 })
    }

    // Content-Type 확인
    const contentType = request.headers.get('content-type') || ''

    let content: string
    let title: string
    let source: string
    let sourceType: SupportedFileType

    if (contentType.includes('multipart/form-data')) {
      // 파일 업로드 처리
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const inputTitle = formData.get('title') as string | null

      if (!file) {
        return NextResponse.json({ error: '파일이 필요합니다' }, { status: 400 })
      }

      // 파일 타입 확인
      const fileName = file.name.toLowerCase()
      if (fileName.endsWith('.txt')) {
        sourceType = 'text'
      } else if (fileName.endsWith('.md') || fileName.endsWith('.markdown')) {
        sourceType = 'markdown'
      } else if (fileName.endsWith('.pdf')) {
        // PDF는 현재 텍스트 추출만 지원 (간단한 구현)
        sourceType = 'pdf'
      } else {
        return NextResponse.json(
          { error: '지원하지 않는 파일 형식입니다 (txt, md, pdf만 지원)' },
          { status: 400 }
        )
      }

      // 파일 내용 읽기
      const arrayBuffer = await file.arrayBuffer()
      const textDecoder = new TextDecoder('utf-8')
      content = textDecoder.decode(arrayBuffer)

      title = inputTitle || file.name
      source = file.name
    } else {
      // JSON 요청 처리
      const body = await request.json()
      const { type, text, url, title: inputTitle } = body

      if (type === 'text') {
        // 텍스트 직접 입력
        if (!text || typeof text !== 'string') {
          return NextResponse.json({ error: '텍스트가 필요합니다' }, { status: 400 })
        }
        content = text
        title = inputTitle || '직접 입력'
        source = '직접 입력'
        sourceType = 'text'
      } else if (type === 'url') {
        // URL 크롤링
        if (!url || typeof url !== 'string') {
          return NextResponse.json({ error: 'URL이 필요합니다' }, { status: 400 })
        }

        const urlContent = await fetchUrlContent(url)
        if (!urlContent) {
          return NextResponse.json({ error: 'URL 콘텐츠를 가져올 수 없습니다' }, { status: 400 })
        }

        content = urlContent.content
        title = inputTitle || urlContent.title
        source = url
        sourceType = 'url'
      } else {
        return NextResponse.json({ error: '유효하지 않은 타입입니다' }, { status: 400 })
      }
    }

    // 콘텐츠 길이 확인
    if (content.length < 10) {
      return NextResponse.json({ error: '콘텐츠가 너무 짧습니다' }, { status: 400 })
    }

    if (content.length > 500000) {
      return NextResponse.json({ error: '콘텐츠가 너무 깁니다 (최대 500KB)' }, { status: 400 })
    }

    // 문서 처리
    const result = await processDocument(content, {
      agentId,
      title,
      source,
      sourceType,
      metadata: {
        uploaded_by: user.id,
        uploaded_at: new Date().toISOString(),
      },
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || '처리 실패' }, { status: 500 })
    }

    console.log(`[Knowledge] Added document: ${title} (${result.chunksCount} chunks)`)

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      chunksCount: result.chunksCount,
      message: `"${title}" 문서가 추가되었습니다 (${result.chunksCount}개 청크)`,
    })
  } catch (error) {
    console.error('Knowledge POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '업로드 실패' },
      { status: 500 }
    )
  }
}

// DELETE: 문서 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const supabase = await createClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json({ error: 'documentId가 필요합니다' }, { status: 400 })
    }

    // 문서 삭제
    const success = await deleteDocument(agentId, documentId)

    if (!success) {
      return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '문서가 삭제되었습니다',
    })
  } catch (error) {
    console.error('Knowledge DELETE error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '삭제 실패' },
      { status: 500 }
    )
  }
}
