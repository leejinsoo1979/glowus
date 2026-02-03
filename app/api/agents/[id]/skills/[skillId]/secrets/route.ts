export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

// GET: 스킬의 API 설정 목록 조회 (값은 마스킹)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; skillId: string }> }
) {
  try {
    const { id: agentId, skillId } = await params
    const adminClient = createAdminClient()

    // 스킬 소유권 확인
    const { data: skill } = await adminClient
      .from('agent_skills')
      .select('id, agent_id')
      .eq('id', skillId)
      .eq('agent_id', agentId)
      .single()

    if (!skill) {
      return NextResponse.json({ error: '스킬을 찾을 수 없습니다' }, { status: 404 })
    }

    const { data: secrets, error } = await adminClient
      .from('agent_skill_secrets')
      .select('id, key_name, description, is_required, default_value, created_at, updated_at')
      .eq('skill_id', skillId)
      .order('key_name')

    if (error) {
      console.error('Secrets fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 값이 설정되어 있는지 여부만 반환 (실제 값은 숨김)
    const { data: secretsWithValue } = await (adminClient as any)
      .from('agent_skill_secrets')
      .select('id, key_value')
      .eq('skill_id', skillId)

    const secretsMap = new Map((secretsWithValue || []).map((s: any) => [s.id, !!s.key_value]))

    const maskedSecrets = (secrets || []).map((s: any) => ({
      ...s,
      has_value: secretsMap.get(s.id) || false,
    }))

    return NextResponse.json({ secrets: maskedSecrets })
  } catch (error) {
    console.error('Secrets API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// POST: API 키 저장/업데이트
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; skillId: string }> }
) {
  try {
    const { id: agentId, skillId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 스킬 소유권 확인
    const { data: skill } = await adminClient
      .from('agent_skills')
      .select('id, agent_id')
      .eq('id', skillId)
      .eq('agent_id', agentId)
      .single()

    if (!skill) {
      return NextResponse.json({ error: '스킬을 찾을 수 없습니다' }, { status: 404 })
    }

    const body = await request.json()
    const { secrets } = body // [{ key_name, key_value, description?, is_required?, default_value? }]

    if (!secrets || !Array.isArray(secrets)) {
      return NextResponse.json({ error: 'secrets 배열이 필요합니다' }, { status: 400 })
    }

    const results = []

    for (const secret of secrets) {
      const { key_name, key_value, description, is_required, default_value } = secret

      if (!key_name) continue

      // Upsert
      const { data, error } = await (adminClient as any)
        .from('agent_skill_secrets')
        .upsert(
          {
            skill_id: skillId,
            key_name,
            key_value: key_value || '',
            description: description || null,
            is_required: is_required ?? true,
            default_value: default_value || null,
          },
          { onConflict: 'skill_id,key_name' }
        )
        .select('id, key_name, description, is_required, default_value')
        .single()

      if (error) {
        console.error('Secret upsert error:', error)
        continue
      }

      results.push({ ...(data as any), has_value: !!key_value })
    }

    return NextResponse.json({ secrets: results })
  } catch (error) {
    console.error('Secrets save error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// DELETE: API 키 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; skillId: string }> }
) {
  try {
    const { id: agentId, skillId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

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
    const secretId = searchParams.get('secretId')

    if (!secretId) {
      return NextResponse.json({ error: 'secretId가 필요합니다' }, { status: 400 })
    }

    // 스킬 소유권 확인 후 삭제
    const { error } = await adminClient
      .from('agent_skill_secrets')
      .delete()
      .eq('id', secretId)
      .eq('skill_id', skillId)

    if (error) {
      console.error('Secret delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Secret delete error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
