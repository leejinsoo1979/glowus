import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/teams - List user's teams
export async function GET(request: NextRequest) {
  const supabase = createClient()
  
  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get teams where user is a member
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      role,
      team:teams(
        *,
        founder:users!teams_founder_id_fkey(id, name, email, avatar_url),
        team_members(
          user:users(id, name, email, avatar_url),
          role
        )
      )
    `)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const teams = data?.map(tm => ({
    ...tm.team,
    userRole: tm.role,
  })) || []

  return NextResponse.json({ data: teams })
}

// POST /api/teams - Create team
export async function POST(request: NextRequest) {
  const supabase = createClient()
  
  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, work_style, industry, description, website } = body

  if (!name) {
    return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
  }

  // Create team
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({
      name,
      founder_id: user.id,
      work_style: work_style || 'agile',
      industry,
      description,
      website,
    })
    .select()
    .single()

  if (teamError) {
    return NextResponse.json({ error: teamError.message }, { status: 500 })
  }

  // Add founder as team member
  const { error: memberError } = await supabase
    .from('team_members')
    .insert({
      team_id: team.id,
      user_id: user.id,
      role: 'founder',
    })

  if (memberError) {
    // Rollback team creation
    await supabase.from('teams').delete().eq('id', team.id)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ data: team }, { status: 201 })
}
