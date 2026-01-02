/**
 * Agent Knowledge Base API
 *
 * GET /api/agents/:id/knowledge - 지식 문서 목록 조회
 * POST /api/agents/:id/knowledge - 문서 업로드
 * DELETE /api/agents/:id/knowledge - 문서 삭제
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import {
  uploadDocument,
  listKnowledgeDocuments,
  deleteDocument,
  getKnowledgeStats,
  type AccessLevel,
} from '@/lib/memory/agent-knowledge-service'

// Route segment config for file uploads
export const dynamic = 'force-dynamic'
export const maxDuration = 30 // seconds

interface Params {
  params: { id: string }
}

/**
 * GET - 지식 문서 목록 조회
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agentId = params.id

    // 에이전트 소유자 확인
    const { data: agent } = await supabase
      .from('deployed_agents')
      .select('id, owner_id')
      .eq('id', agentId)
      .single() as { data: { id: string; owner_id: string } | null }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined
    const accessLevel = searchParams.get('accessLevel') as AccessLevel | undefined
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const { documents, total } = await listKnowledgeDocuments(agentId, {
      category,
      accessLevel,
      limit,
      offset,
    })

    // 통계 항상 포함 (UI에서 기대하는 필드명으로 변환)
    const rawStats = await getKnowledgeStats(agentId)
    const lastUpdated = documents.length > 0
      ? documents.reduce((latest: string | null, doc: any) => {
          if (!latest) return doc.created_at
          return new Date(doc.created_at) > new Date(latest) ? doc.created_at : latest
        }, null as string | null)
      : null

    const response: any = {
      success: true,
      documents,
      total,
      limit,
      offset,
      hasMore: offset + documents.length < total,
      stats: {
        documentCount: rawStats.totalDocuments,
        chunkCount: rawStats.totalChunks,
        lastUpdated,
        byCategory: rawStats.byCategory,
        byAccessLevel: rawStats.byAccessLevel,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API] Knowledge list error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST - 문서 업로드
 *
 * 지원 형식:
 * 1. 텍스트: { type: 'text', text: '내용', title: '제목' }
 * 2. URL: { type: 'url', url: 'https://...', title?: '제목' }
 * 3. 파일: FormData (file)
 * 4. 직접: { title: '제목', content: '내용' }
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agentId = params.id

    // 에이전트 소유자 확인
    const { data: agent } = await supabase
      .from('deployed_agents')
      .select('id, owner_id')
      .eq('id', agentId)
      .single() as { data: { id: string; owner_id: string } | null }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Content-Type 확인
    const contentType = request.headers.get('content-type') || ''

    let title: string
    let content: string
    let fileUrl: string | undefined
    let fileType: string | undefined
    let category: string | undefined
    let accessLevel: AccessLevel | undefined
    let tags: string[] | undefined

    // 📁 파일 업로드 (FormData)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      // 파일 타입 검증
      const allowedTypes = ['text/plain', 'text/markdown', 'application/pdf']
      const allowedExtensions = ['.txt', '.md', '.markdown', '.pdf']
      const fileName = file.name.toLowerCase()
      const isAllowed = allowedTypes.includes(file.type) ||
                        allowedExtensions.some(ext => fileName.endsWith(ext))

      if (!isAllowed) {
        return NextResponse.json(
          { error: '지원하지 않는 파일 형식입니다. (txt, md, pdf만 가능)' },
          { status: 400 }
        )
      }

      // PDF 파일 처리
      if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
        try {
          // unpdf 라이브러리로 PDF 텍스트 추출
          const { extractText } = await import('unpdf')
          const arrayBuffer = await file.arrayBuffer()
          const pdfData = await extractText(new Uint8Array(arrayBuffer))

          // text는 페이지별 배열로 반환됨
          content = Array.isArray(pdfData.text) ? pdfData.text.join('\n\n') : String(pdfData.text)
          title = file.name.replace(/\.pdf$/i, '')
          fileType = 'pdf'

          console.log(`[Knowledge] PDF upload: ${file.name}, ${pdfData.totalPages} pages, ${content.length} chars`)
        } catch (pdfError) {
          console.error('[Knowledge] PDF parse error:', pdfError)
          return NextResponse.json(
            { error: 'PDF 파일을 읽을 수 없습니다. 파일이 손상되었거나 암호로 보호되어 있을 수 있습니다.' },
            { status: 400 }
          )
        }
      } else {
        // 텍스트/마크다운 파일 처리
        content = await file.text()
        title = file.name.replace(/\.(txt|md|markdown)$/i, '')
        fileType = fileName.endsWith('.md') || fileName.endsWith('.markdown') ? 'markdown' : 'text'

        console.log(`[Knowledge] File upload: ${file.name}, ${content.length} chars`)
      }
    }
    // 📝 JSON 요청 (텍스트/URL/직접)
    else {
      const body = await request.json()

      // 타입별 처리
      if (body.type === 'text') {
        // 텍스트 입력
        title = body.title || '직접 입력'
        content = body.text
        fileType = 'text'
      } else if (body.type === 'url') {
        // URL에서 가져오기
        const url = body.url
        if (!url) {
          return NextResponse.json({ error: 'URL is required' }, { status: 400 })
        }

        try {
          console.log(`[Knowledge] Fetching URL: ${url}`)
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; GlowUS/1.0; +https://glowus.ai)',
            },
          })

          if (!response.ok) {
            return NextResponse.json(
              { error: `URL 가져오기 실패: ${response.status}` },
              { status: 400 }
            )
          }

          content = await response.text()

          // HTML인 경우 텍스트만 추출 (간단한 방법)
          if (content.includes('<html') || content.includes('<!DOCTYPE')) {
            content = content
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
          }

          // 제목 추출 (URL의 마지막 경로 또는 사용자 입력)
          const urlObj = new URL(url)
          title = body.title || urlObj.pathname.split('/').pop() || urlObj.hostname
          fileUrl = url
          fileType = 'url'

          console.log(`[Knowledge] URL content: ${content.length} chars`)
        } catch (fetchError) {
          console.error('[Knowledge] URL fetch error:', fetchError)
          return NextResponse.json(
            { error: 'URL을 가져올 수 없습니다.' },
            { status: 400 }
          )
        }
      } else {
        // 직접 입력 (기존 방식)
        title = body.title
        content = body.content
        fileUrl = body.fileUrl
        fileType = body.fileType
      }

      category = body.category
      accessLevel = body.accessLevel
      tags = body.tags
    }

    // 필수 값 검증
    if (!title || !content) {
      return NextResponse.json(
        { error: '제목과 내용이 필요합니다.' },
        { status: 400 }
      )
    }

    // 내용 길이 검증 (5MB)
    if (content.length > 5000000) {
      return NextResponse.json(
        { error: '내용이 너무 깁니다. (최대 5MB)' },
        { status: 400 }
      )
    }

    // 문서 업로드
    const result = await uploadDocument({
      agentId,
      title,
      content,
      fileUrl,
      fileType,
      category,
      accessLevel,
      tags,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Upload failed' },
        { status: 400 }
      )
    }

    console.log(`[Knowledge] Document created: ${title}, ${result.chunksCreated} chunks`)

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      chunksCreated: result.chunksCreated,
    }, { status: 201 })
  } catch (error) {
    console.error('[API] Knowledge upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - 문서 삭제
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agentId = params.id

    // 에이전트 소유자 확인
    const { data: agent } = await supabase
      .from('deployed_agents')
      .select('id, owner_id')
      .eq('id', agentId)
      .single() as { data: { id: string; owner_id: string } | null }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { documentId } = body

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    const success = await deleteDocument(documentId)

    if (!success) {
      return NextResponse.json(
        { error: 'Delete failed' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Knowledge delete error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
