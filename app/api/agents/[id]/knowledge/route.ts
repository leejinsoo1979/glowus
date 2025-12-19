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
    const includeStats = searchParams.get('includeStats') === 'true'

    const { documents, total } = await listKnowledgeDocuments(agentId, {
      category,
      accessLevel,
      limit,
      offset,
    })

    const response: any = {
      success: true,
      documents,
      total,
      limit,
      offset,
      hasMore: offset + documents.length < total,
    }

    // 통계 포함
    if (includeStats) {
      response.stats = await getKnowledgeStats(agentId)
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

    const body = await request.json()
    const {
      title,
      content,
      fileUrl,
      fileType,
      category,
      accessLevel,
      tags,
      chunkSize,
      chunkOverlap,
    } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    const result = await uploadDocument({
      agentId,
      title,
      content,
      fileUrl,
      fileType,
      category,
      accessLevel,
      tags,
      chunkSize,
      chunkOverlap,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Upload failed' },
        { status: 400 }
      )
    }

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
