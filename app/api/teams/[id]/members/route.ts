import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface TeamMember {
  id: string
  user_id: string
  team_id: string
  role: string
  joined_at: string
  user?: {
    id: string
    name: string
    email: string
    avatar_url?: string
  }
}

// GET /api/teams/[id]/members - Get team members
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const adminClient = createAdminClient()

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teamId = params.id

  try {
    // Check if user has access to this team
    const { data: team } = await (adminClient
      .from('teams') as any)
      .select('founder_id')
      .eq('id', teamId)
      .single()

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const isFounder = team.founder_id === user.id

    if (!isFounder) {
      const { data: membership } = await (adminClient
        .from('team_members') as any)
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single()

      if (!membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Get team members with user info
    const { data: members, error } = await (adminClient
      .from('team_members') as any)
      .select(`
        id,
        user_id,
        team_id,
        role,
        joined_at
      `)
      .eq('team_id', teamId) as { data: TeamMember[] | null; error: any }

    if (error) {
      console.error('Get members error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Build member list - from team_members table AND deployed_agents
    // Founder는 팀 소유자일 뿐, team_members에 등록되어야만 팀원으로 표시됨
    const memberList: Array<{
      id: string
      name: string
      role: string
      avatar_url?: string
      status: string
      commits: number
      type: 'person' | 'agent'
    }> = []

    // Add human members from team_members table
    if (members) {
      for (const member of members) {
        const { data: memberUser } = await (adminClient
          .from('users') as any)
          .select('id, name, email, avatar_url')
          .eq('id', member.user_id)
          .single()

        if (memberUser) {
          memberList.push({
            id: memberUser.id,
            name: memberUser.name || memberUser.email?.split('@')[0] || 'Member',
            role: member.role,
            avatar_url: memberUser.avatar_url,
            status: 'offline',
            commits: 0,
            type: 'person'
          })
        }
      }
    }

    // Add AI agents - team_id가 일치하는 에이전트 조회
    const { data: agents } = await (adminClient
      .from('deployed_agents') as any)
      .select('id, name, description, avatar_url, status, capabilities')
      .eq('team_id', teamId)

    if (agents) {
      for (const agent of agents) {
        memberList.push({
          id: agent.id,
          name: agent.name,
          role: 'agent',
          avatar_url: agent.avatar_url,
          status: agent.status === 'ACTIVE' ? 'online' : 'offline',
          commits: 0,
          type: 'agent'
        })
      }
    }

    return NextResponse.json({ data: memberList })
  } catch (error) {
    console.error('GET /api/teams/[id]/members error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
