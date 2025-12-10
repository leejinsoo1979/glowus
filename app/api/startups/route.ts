import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CreateStartupInput } from '@/types/database'

// GET /api/startups - List startups for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('startups')
      .select(`
        *,
        founder:users!startups_founder_id_fkey(id, name, email, avatar_url),
        team_members(
          id,
          role,
          user:users(id, name, email, avatar_url)
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter based on role
    if (profile?.role === 'FOUNDER') {
      // Founder sees their own startups
      query = query.eq('founder_id', user.id)
    } else if (profile?.role === 'TEAM_MEMBER') {
      // Team members see startups they're part of
      const { data: memberships } = await supabase
        .from('team_members')
        .select('startup_id')
        .eq('user_id', user.id)

      const startupIds = memberships?.map(m => m.startup_id) || []
      if (startupIds.length > 0) {
        query = query.in('id', startupIds)
      } else {
        return NextResponse.json({ data: [], count: 0 })
      }
    } else if (profile?.role === 'INVESTOR') {
      // Investors see startups they have approved access to
      const { data: access } = await supabase
        .from('investor_access')
        .select('startup_id')
        .eq('investor_id', user.id)
        .eq('status', 'APPROVED')

      const startupIds = access?.map(a => a.startup_id) || []
      if (startupIds.length > 0) {
        query = query.in('id', startupIds)
      } else {
        return NextResponse.json({ data: [], count: 0 })
      }
    }
    // ADMIN sees all startups (no filter)

    const { data, error, count } = await query

    if (error) {
      console.error('Startups fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data,
      count,
      page: Math.floor(offset / limit) + 1,
      limit,
      hasMore: (count || 0) > offset + limit,
    })
  } catch (error) {
    console.error('Startups API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/startups - Create new startup
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // Check if user is founder or admin
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'FOUNDER' && profile?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '스타트업을 생성할 권한이 없습니다.' },
        { status: 403 }
      )
    }

    const body: CreateStartupInput = await request.json()

    // Validate required fields
    if (!body.name || !body.industry) {
      return NextResponse.json(
        { error: '스타트업 이름과 산업 분야는 필수입니다.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('startups')
      .insert({
        ...body,
        founder_id: user.id,
        stage: body.stage || 'IDEA',
        monthly_revenue: body.monthly_revenue || 0,
        monthly_burn: body.monthly_burn || 0,
        total_funding: body.total_funding || 0,
        employee_count: body.employee_count || 1,
        country: body.country || 'KR',
      })
      .select(`
        *,
        founder:users!startups_founder_id_fkey(id, name, email, avatar_url)
      `)
      .single()

    if (error) {
      console.error('Startup create error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('Startup create API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
