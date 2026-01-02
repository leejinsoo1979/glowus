export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'

// POST: Key Result 생성
export async function POST(request: NextRequest) {
  try {
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
    const {
      objective_id,
      title,
      description,
      owner_id,
      metric_type = 'percentage',
      start_value = 0,
      target_value,
      unit,
      weight = 1.0,
      sort_order = 0
    } = body

    if (!objective_id) {
      return NextResponse.json({ error: 'objective_id는 필수입니다' }, { status: 400 })
    }

    if (!title) {
      return NextResponse.json({ error: '제목은 필수입니다' }, { status: 400 })
    }

    if (target_value === undefined) {
      return NextResponse.json({ error: '목표 값은 필수입니다' }, { status: 400 })
    }

    const { data, error } = await (adminClient as any)
      .from('key_results')
      .insert({
        objective_id,
        title,
        description,
        owner_id: owner_id || user.id,
        metric_type,
        start_value,
        target_value,
        current_value: start_value,
        unit,
        weight,
        sort_order
      })
      .select(`
        *,
        owner:users!key_results_owner_id_fkey(id, name, email, avatar_url)
      `)
      .single()

    if (error) {
      console.error('Failed to create key result:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating key result:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    )
  }
}
