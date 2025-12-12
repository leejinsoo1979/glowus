import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Type helpers for Supabase responses
interface MembershipData {
  role: string
}

interface TeamFounderData {
  founder_id: string
}

// GET /api/teams/[id] - Get single team details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teamId = params.id

  // Check if user is a member of this team
  const { data: membership, error: membershipError } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single() as { data: MembershipData | null; error: any }

  if (membershipError || !membership) {
    return NextResponse.json({ error: 'Team not found or access denied' }, { status: 404 })
  }

  // Get team details
  const { data: team, error } = await supabase
    .from('teams')
    .select(`
      *,
      founder:users!teams_founder_id_fkey(id, name, email, avatar_url),
      team_members(
        user:users(id, name, email, avatar_url),
        role
      )
    `)
    .eq('id', teamId)
    .single() as { data: Record<string, any> | null; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: { ...team, userRole: membership.role } })
}

// PATCH /api/teams/[id] - Update team
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teamId = params.id

  // Check if user is founder of this team
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('founder_id')
    .eq('id', teamId)
    .single() as { data: TeamFounderData | null; error: any }

  if (teamError || !team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  }

  if (team.founder_id !== user.id) {
    return NextResponse.json({ error: 'Only the founder can update the team' }, { status: 403 })
  }

  const body = await request.json()
  const { name, description, industry, work_style, website, is_open_call, is_public } = body

  // Build update object
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }
  if (name !== undefined) updateData.name = name
  if (description !== undefined) updateData.description = description
  if (industry !== undefined) updateData.industry = industry
  if (work_style !== undefined) updateData.work_style = work_style
  if (website !== undefined) updateData.website = website
  if (is_open_call !== undefined) updateData.is_open_call = is_open_call
  if (is_public !== undefined) updateData.is_public = is_public

  // Update team
  const { data: updatedTeam, error: updateError } = await (supabase
    .from('teams') as any)
    .update(updateData)
    .eq('id', teamId)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ data: updatedTeam })
}

// DELETE /api/teams/[id] - Delete team
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teamId = params.id

  // Check if user is founder of this team
  const { data: teamData, error: teamError } = await supabase
    .from('teams')
    .select('founder_id')
    .eq('id', teamId)
    .single() as { data: TeamFounderData | null; error: any }

  if (teamError || !teamData) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  }

  if (teamData.founder_id !== user.id) {
    return NextResponse.json({ error: 'Only the founder can delete the team' }, { status: 403 })
  }

  // Delete team members first (if cascade is not set up)
  await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)

  // Delete the team
  const { error: deleteError } = await supabase
    .from('teams')
    .delete()
    .eq('id', teamId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
