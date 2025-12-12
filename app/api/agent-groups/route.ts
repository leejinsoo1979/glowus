import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { InteractionMode } from '@/types/database'

// GET: List all agent groups
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const adminClient = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('team_id')

    let query = (adminClient as any)
      .from('agent_groups')
      .select(`
        *,
        members:agent_group_members(
          *,
          agent:deployed_agents(id, name, avatar_url, status, interaction_mode, llm_provider, llm_model)
        )
      `)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })

    if (teamId) {
      query = query.eq('team_id', teamId)
    }

    const { data, error } = await query

    if (error) {
      console.error('에이전트 그룹 조회 오류:', error)
      return NextResponse.json([])
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('에이전트 그룹 API 오류:', error)
    return NextResponse.json([])
  }
}

// POST: Create a new agent group
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const adminClient = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      team_id,
      interaction_mode = 'collaborate' as InteractionMode,
      agent_ids = [],
    } = body

    if (!name) {
      return NextResponse.json({ error: '그룹 이름이 필요합니다' }, { status: 400 })
    }

    // Create the group
    const { data: group, error: groupError } = await (adminClient as any)
      .from('agent_groups')
      .insert({
        name,
        description,
        team_id: team_id || null,
        interaction_mode,
        created_by: user.id,
      })
      .select()
      .single()

    if (groupError) {
      console.error('에이전트 그룹 생성 오류:', groupError)
      return NextResponse.json({ error: groupError.message }, { status: 500 })
    }

    // Add members if provided
    if (agent_ids.length > 0) {
      const members = agent_ids.map((agentId: string, index: number) => ({
        group_id: group.id,
        agent_id: agentId,
        role: index === 0 && interaction_mode === 'supervisor' ? 'supervisor' : 'member',
        speak_order: index,
      }))

      const { error: membersError } = await (adminClient as any)
        .from('agent_group_members')
        .insert(members)

      if (membersError) {
        console.error('에이전트 그룹 멤버 추가 오류:', membersError)
        // Don't fail the entire operation, just log
      }
    }

    // Fetch the complete group with members
    const { data: completeGroup } = await (adminClient as any)
      .from('agent_groups')
      .select(`
        *,
        members:agent_group_members(
          *,
          agent:deployed_agents(id, name, avatar_url, status)
        )
      `)
      .eq('id', group.id)
      .single()

    return NextResponse.json(completeGroup || group, { status: 201 })
  } catch (error) {
    console.error('에이전트 그룹 생성 API 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
