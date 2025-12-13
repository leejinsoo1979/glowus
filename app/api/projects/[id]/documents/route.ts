import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

// GET: List all documents for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url)
    const docType = searchParams.get('type')
    const status = searchParams.get('status') || 'published'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = (adminClient as any)
      .from('project_documents')
      .select(`
        *,
        created_by_agent:created_by_agent_id(id, name, avatar_url),
        created_by_user:created_by_user_id(id, name, avatar_url)
      `)
      .eq('project_id', projectId)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (docType) {
      query = query.eq('doc_type', docType)
    }

    const { data: documents, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get total count
    const { count: totalCount } = await (adminClient as any)
      .from('project_documents')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('status', status)

    return NextResponse.json({
      documents: documents || [],
      total: totalCount || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Get documents error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// POST: Create a new document manually
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { title, content, summary, doc_type, source_url, source_type, tags, status } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: '제목과 내용이 필요합니다' },
        { status: 400 }
      )
    }

    // Create document
    const { data: document, error } = await (adminClient as any)
      .from('project_documents')
      .insert({
        project_id: projectId,
        title,
        content,
        summary: summary || content.slice(0, 200) + (content.length > 200 ? '...' : ''),
        doc_type: doc_type || 'other',
        source_url,
        source_type,
        created_by_type: 'user',
        created_by_user_id: user.id,
        tags: tags || [],
        status: status || 'published',
      })
      .select(`
        *,
        created_by_user:created_by_user_id(id, name, avatar_url)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Create document error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
