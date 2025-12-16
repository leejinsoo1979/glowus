import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

// GET: 내 이모티콘 목록 조회
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  let user: any = isDevMode() ? DEV_USER : null
  if (!user) {
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    let query = (adminClient as any)
      .from('user_emoticons')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      console.error('Get emoticons error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/emoticons error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 이모티콘 추가
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  let user: any = isDevMode() ? DEV_USER : null
  if (!user) {
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, image_url, category = 'default', keywords = [] } = body

    if (!name || !image_url) {
      return NextResponse.json({ error: 'name과 image_url이 필요합니다' }, { status: 400 })
    }

    // 현재 최대 sort_order 가져오기
    const { data: maxOrder } = await (adminClient as any)
      .from('user_emoticons')
      .select('sort_order')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const sortOrder = (maxOrder?.sort_order || 0) + 1

    console.log('[Emoticons API] Inserting:', { user_id: user.id, name, image_url, category, keywords, sort_order: sortOrder })

    const { data, error } = await (adminClient as any)
      .from('user_emoticons')
      .insert({
        user_id: user.id,
        name,
        image_url,
        category,
        keywords,
        sort_order: sortOrder,
      })
      .select()
      .single()

    if (error) {
      console.error('[Emoticons API] Create error:', error)
      console.error('[Emoticons API] Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('POST /api/emoticons error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: 이모티콘 수정 (키워드 등)
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  let user: any = isDevMode() ? DEV_USER : null
  if (!user) {
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, name, keywords, category } = body

    if (!id) {
      return NextResponse.json({ error: '이모티콘 ID가 필요합니다' }, { status: 400 })
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (keywords !== undefined) updateData.keywords = keywords
    if (category !== undefined) updateData.category = category

    const { data, error } = await (adminClient as any)
      .from('user_emoticons')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('[Emoticons API] Update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('PATCH /api/emoticons error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: 이모티콘 삭제 (bulk)
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  let user: any = isDevMode() ? DEV_USER : null
  if (!user) {
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '삭제할 이모티콘 ID가 필요합니다' }, { status: 400 })
    }

    const { error } = await (adminClient as any)
      .from('user_emoticons')
      .delete()
      .eq('user_id', user.id)
      .in('id', ids)

    if (error) {
      console.error('Delete emoticons error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/emoticons error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
