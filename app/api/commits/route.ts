import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/commits - List commits
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  
  const teamId = searchParams.get('teamId')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = parseInt(searchParams.get('offset') || '0')

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Build query
  let query = supabase
    .from('commits')
    .select(`
      *,
      user:users(id, name, email, avatar_url),
      task:tasks(id, title)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (teamId) {
    query = query.eq('team_id', teamId)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data,
    count,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    totalPages: Math.ceil((count || 0) / limit),
  })
}

// POST /api/commits - Create commit
export async function POST(request: NextRequest) {
  const supabase = createClient()
  
  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { description, team_id, task_id, impact_level, next_action, files } = body

  if (!description || !team_id) {
    return NextResponse.json(
      { error: 'Description and team_id are required' },
      { status: 400 }
    )
  }

  // Create commit
  const { data, error } = await supabase
    .from('commits')
    .insert({
      user_id: user.id,
      team_id,
      task_id: task_id || null,
      description,
      impact_level: impact_level || 'medium',
      next_action: next_action || null,
      files: files || [],
    })
    .select(`
      *,
      user:users(id, name, email, avatar_url)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // TODO: Trigger AI analysis in background

  return NextResponse.json({ data }, { status: 201 })
}
