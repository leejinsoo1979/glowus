import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { InteractionMode } from '@/types/database'

// GET: Get a specific agent group
export async function GET(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const supabase = createClient()
    const adminClient = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { groupId } = params

    const { data, error } = await (adminClient as any)
      .from('agent_groups')
      .select(`
        *,
        members:agent_group_members(
          *,
          agent:deployed_agents(id, name, avatar_url, status, description, interaction_mode, llm_provider, llm_model, system_prompt)
        )
      `)
      .eq('id', groupId)
      .single()

    if (error) {
      console.error('에이전트 그룹 조회 오류:', error)
      return NextResponse.json({ error: '그룹을 찾을 수 없습니다' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('에이전트 그룹 API 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// PATCH: Update an agent group
export async function PATCH(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const supabase = createClient()
    const adminClient = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { groupId } = params
    const body = await request.json()
    const { name, description, interaction_mode, agent_ids } = body

    // Update group info
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (interaction_mode !== undefined) updateData.interaction_mode = interaction_mode

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await (adminClient as any)
        .from('agent_groups')
        .update(updateData)
        .eq('id', groupId)

      if (updateError) {
        console.error('에이전트 그룹 업데이트 오류:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    // Update members if provided
    if (agent_ids !== undefined) {
      // Remove existing members
      await (adminClient as any)
        .from('agent_group_members')
        .delete()
        .eq('group_id', groupId)

      // Add new members
      if (agent_ids.length > 0) {
        const effectiveMode = interaction_mode || 'collaborate'
        const members = agent_ids.map((agentId: string, index: number) => ({
          group_id: groupId,
          agent_id: agentId,
          role: index === 0 && effectiveMode === 'supervisor' ? 'supervisor' : 'member',
          speak_order: index,
        }))

        const { error: membersError } = await (adminClient as any)
          .from('agent_group_members')
          .insert(members)

        if (membersError) {
          console.error('에이전트 그룹 멤버 업데이트 오류:', membersError)
        }
      }
    }

    // Fetch updated group
    const { data: updatedGroup } = await (adminClient as any)
      .from('agent_groups')
      .select(`
        *,
        members:agent_group_members(
          *,
          agent:deployed_agents(id, name, avatar_url, status)
        )
      `)
      .eq('id', groupId)
      .single()

    return NextResponse.json(updatedGroup)
  } catch (error) {
    console.error('에이전트 그룹 업데이트 API 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// DELETE: Delete an agent group
export async function DELETE(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const supabase = createClient()
    const adminClient = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { groupId } = params

    // Delete will cascade to members due to foreign key constraint
    const { error } = await (adminClient as any)
      .from('agent_groups')
      .delete()
      .eq('id', groupId)

    if (error) {
      console.error('에이전트 그룹 삭제 오류:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('에이전트 그룹 삭제 API 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
