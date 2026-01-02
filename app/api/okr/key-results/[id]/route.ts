export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'

// PATCH: Key Result 수정 (현재 값 업데이트 포함)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // 현재 값 업데이트 시 체크인 기록 생성
    if (body.current_value !== undefined) {
      // 기존 값 조회
      const { data: existing } = await adminClient
        .from('key_results')
        .select('current_value')
        .eq('id', id)
        .single() as { data: { current_value: number } | null }

      if (existing && existing.current_value !== body.current_value) {
        // 체크인 기록 생성 (테이블 타입 아직 미생성)
        await (adminClient as any)
          .from('kr_checkins')
          .insert({
            key_result_id: id,
            previous_value: existing.current_value,
            new_value: body.current_value,
            note: body.checkin_note,
            created_by: user.id
          })
      }
    }

    const allowedFields = [
      'title',
      'description',
      'owner_id',
      'metric_type',
      'start_value',
      'target_value',
      'current_value',
      'unit',
      'weight',
      'sort_order'
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '업데이트할 필드가 없습니다' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await (adminClient as any)
      .from('key_results')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        owner:users!key_results_owner_id_fkey(id, name, email, avatar_url)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    )
  }
}

// DELETE: Key Result 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const { error } = await (adminClient as any)
      .from('key_results')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    )
  }
}
