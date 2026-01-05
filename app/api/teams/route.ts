export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Team interface
interface Team {
  id: string
  name: string
  founder_id: string
  work_style: string
  industry?: string
  description?: string
  logo_url?: string
  website?: string
  is_open_call: boolean
  is_public: boolean
  created_at: string
  updated_at: string
}

interface TeamMemberRow {
  team_id: string
  role: string
}

// GET /api/teams - List user's teams
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Check auth
  const { user } = await getAuthUser(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get teams where user is founder
    const { data: founderTeams, error: founderError } = await (adminClient
      .from('teams') as any)
      .select('*')
      .eq('founder_id', user.id) as { data: Team[] | null; error: any }

    if (founderError) {
      console.error('Founder teams error:', founderError)
      return NextResponse.json({ error: founderError.message }, { status: 500 })
    }

    // Get teams where user is a member (not founder)
    const { data: memberTeams } = await (adminClient
      .from('team_members') as any)
      .select('team_id, role')
      .eq('user_id', user.id)
      .not('team_id', 'is', null) as { data: TeamMemberRow[] | null; error: any }

    let allTeams = (founderTeams || []).map((team: Team) => ({
      ...team,
      userRole: 'founder',
      memberCount: 1,
    }))

    // If user is member of other teams, fetch those too
    if (memberTeams && memberTeams.length > 0) {
      const teamIds = memberTeams
        .filter((m: TeamMemberRow) => m.team_id && !founderTeams?.some((t: Team) => t.id === m.team_id))
        .map((m: TeamMemberRow) => m.team_id)

      if (teamIds.length > 0) {
        const { data: otherTeams } = await (adminClient
          .from('teams') as any)
          .select('*')
          .in('id', teamIds) as { data: Team[] | null; error: any }

        if (otherTeams) {
          const otherTeamsWithRole = otherTeams.map((team: Team) => ({
            ...team,
            userRole: memberTeams.find((m: TeamMemberRow) => m.team_id === team.id)?.role || 'member',
            memberCount: 1,
          }))
          allTeams = [...allTeams, ...otherTeamsWithRole]
        }
      }
    }

    return NextResponse.json({ data: allTeams })
  } catch (error) {
    console.error('GET /api/teams error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/teams - Create team
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Check auth
  const { user } = await getAuthUser(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Ensure user exists in public.users (trigger may not have fired)
    console.log('Checking if user exists:', user.id)
    const { data: existingUser, error: checkError } = await (adminClient
      .from('users') as any)
      .select('id')
      .eq('id', user.id)
      .single()

    console.log('User check result:', { existingUser, checkError: checkError?.message })

    if (!existingUser) {
      // Create user in public.users
      console.log('Creating user in public.users:', user.id)
      const { error: userError } = await (adminClient
        .from('users') as any)
        .insert({
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          role: 'FOUNDER',
        })

      if (userError) {
        console.error('User create error:', userError)
        return NextResponse.json({
          error: `User create failed: ${userError.message}`,
          code: userError.code
        }, { status: 500 })
      }
      console.log('User created successfully')
    }

    const body = await request.json()
    const { name, work_style, industry, description, website } = body

    if (!name) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
    }

    // Create team
    const { data: team, error: teamError } = await (adminClient
      .from('teams') as any)
      .insert({
        name,
        founder_id: user.id,
        work_style: work_style || 'agile',
        industry,
        description,
        website,
      })
      .select()
      .single() as { data: Team | null; error: any }

    if (teamError) {
      console.error('Team create error:', teamError)
      return NextResponse.json({
        error: `Team create failed: ${teamError.message}`,
        code: teamError.code,
        details: teamError.details,
      }, { status: 500 })
    }

    if (!team) {
      return NextResponse.json({ error: 'Failed to create team' }, { status: 500 })
    }

    return NextResponse.json({ data: team }, { status: 201 })
  } catch (error) {
    console.error('POST /api/teams error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
