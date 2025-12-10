import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/team-members - List team members for a startup
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const startupId = searchParams.get('startup_id')

    if (!startupId) {
      return NextResponse.json({ error: 'startup_id가 필요합니다.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('team_members')
      .select(`
        *,
        user:users(id, name, email, avatar_url, role)
      `)
      .eq('startup_id', startupId)
      .order('joined_at', { ascending: true })

    if (error) {
      console.error('Team members fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Team members API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/team-members - Add team member (invite)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { startup_id, email, role } = body

    if (!startup_id || !email || !role) {
      return NextResponse.json(
        { error: '스타트업 ID, 이메일, 역할은 필수입니다.' },
        { status: 400 }
      )
    }

    // Check if user is founder of this startup
    const { data: startup } = await supabase
      .from('startups')
      .select('founder_id')
      .eq('id', startup_id)
      .single()

    if (!startup || startup.founder_id !== user.id) {
      return NextResponse.json(
        { error: '팀원을 추가할 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // Find user by email
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', email)
      .single()

    if (!targetUser) {
      return NextResponse.json(
        { error: '해당 이메일로 가입된 사용자가 없습니다.' },
        { status: 404 }
      )
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('startup_id', startup_id)
      .eq('user_id', targetUser.id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: '이미 팀원으로 등록되어 있습니다.' },
        { status: 400 }
      )
    }

    // Add team member
    const { data, error } = await supabase
      .from('team_members')
      .insert({
        startup_id,
        user_id: targetUser.id,
        role,
      })
      .select(`
        *,
        user:users(id, name, email, avatar_url)
      `)
      .single()

    if (error) {
      console.error('Team member create error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update user role to TEAM_MEMBER if they're a FOUNDER with no startups
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', targetUser.id)
      .single()

    if (userProfile?.role === 'FOUNDER') {
      const { data: ownedStartups } = await supabase
        .from('startups')
        .select('id')
        .eq('founder_id', targetUser.id)
        .limit(1)

      if (!ownedStartups || ownedStartups.length === 0) {
        await supabase
          .from('users')
          .update({ role: 'TEAM_MEMBER' })
          .eq('id', targetUser.id)
      }
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('Team member create API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// DELETE /api/team-members - Remove team member
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const memberId = searchParams.get('id')
    const startupId = searchParams.get('startup_id')

    if (!memberId || !startupId) {
      return NextResponse.json({ error: 'id와 startup_id가 필요합니다.' }, { status: 400 })
    }

    // Check if user is founder
    const { data: startup } = await supabase
      .from('startups')
      .select('founder_id')
      .eq('id', startupId)
      .single()

    if (!startup || startup.founder_id !== user.id) {
      return NextResponse.json(
        { error: '팀원을 삭제할 권한이 없습니다.' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)
      .eq('startup_id', startupId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Team member delete API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
