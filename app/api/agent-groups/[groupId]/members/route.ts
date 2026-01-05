export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST: Add a member to the group
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { groupId } = await params
    const body = await request.json()
    const { agent_id, role = 'member', speak_order } = body

    if (!agent_id) {
      return NextResponse.json({ error: '에이전트 ID가 필요합니다' }, { status: 400 })
    }

    // Get current max speak_order if not provided
    let finalSpeakOrder = speak_order
    if (finalSpeakOrder === undefined) {
      const { data: existingMembers } = await (adminClient as any)
        .from('agent_group_members')
        .select('speak_order')
        .eq('group_id', groupId)
        .order('speak_order', { ascending: false })
        .limit(1)

      finalSpeakOrder = existingMembers?.[0]?.speak_order !== undefined
        ? existingMembers[0].speak_order + 1
        : 0
    }

    const { data, error } = await (adminClient as any)
      .from('agent_group_members')
      .insert({
        group_id: groupId,
        agent_id,
        role,
        speak_order: finalSpeakOrder,
      })
      .select(`
        *,
        agent:deployed_agents(id, name, avatar_url, status)
      `)
      .single()

    if (error) {
      console.error('그룹 멤버 추가 오류:', error)
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({ error: '이미 그룹에 포함된 에이전트입니다' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('그룹 멤버 추가 API 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// DELETE: Remove a member from the group
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { groupId } = await params
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agent_id')

    if (!agentId) {
      return NextResponse.json({ error: '에이전트 ID가 필요합니다' }, { status: 400 })
    }

    const { error } = await (adminClient as any)
      .from('agent_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('agent_id', agentId)

    if (error) {
      console.error('그룹 멤버 삭제 오류:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('그룹 멤버 삭제 API 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// PATCH: Update member role or speak order
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { groupId } = await params
    const body = await request.json()
    const { agent_id, role, speak_order } = body

    if (!agent_id) {
      return NextResponse.json({ error: '에이전트 ID가 필요합니다' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (role !== undefined) updateData.role = role
    if (speak_order !== undefined) updateData.speak_order = speak_order

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '업데이트할 내용이 없습니다' }, { status: 400 })
    }

    const { data, error } = await (adminClient as any)
      .from('agent_group_members')
      .update(updateData)
      .eq('group_id', groupId)
      .eq('agent_id', agent_id)
      .select(`
        *,
        agent:deployed_agents(id, name, avatar_url, status)
      `)
      .single()

    if (error) {
      console.error('그룹 멤버 업데이트 오류:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('그룹 멤버 업데이트 API 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
