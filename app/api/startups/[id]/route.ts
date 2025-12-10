import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UpdateStartupInput } from '@/types/database'

interface RouteParams {
  params: { id: string }
}

// GET /api/startups/[id] - Get single startup
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient()
    const { id } = params

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('startups')
      .select(`
        *,
        founder:users!startups_founder_id_fkey(id, name, email, avatar_url, role),
        team_members(
          id,
          role,
          joined_at,
          user:users(id, name, email, avatar_url)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '스타트업을 찾을 수 없습니다.' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // RLS will handle access control
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Startup fetch error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// PATCH /api/startups/[id] - Update startup
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient()
    const { id } = params

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // Check ownership
    const { data: startup } = await supabase
      .from('startups')
      .select('founder_id')
      .eq('id', id)
      .single()

    if (!startup) {
      return NextResponse.json({ error: '스타트업을 찾을 수 없습니다.' }, { status: 404 })
    }

    // Get user role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (startup.founder_id !== user.id && profile?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '스타트업을 수정할 권한이 없습니다.' },
        { status: 403 }
      )
    }

    const body: UpdateStartupInput = await request.json()

    const { data, error } = await supabase
      .from('startups')
      .update(body)
      .eq('id', id)
      .select(`
        *,
        founder:users!startups_founder_id_fkey(id, name, email, avatar_url)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Startup update error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// DELETE /api/startups/[id] - Delete startup
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient()
    const { id } = params

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // Check ownership
    const { data: startup } = await supabase
      .from('startups')
      .select('founder_id')
      .eq('id', id)
      .single()

    if (!startup) {
      return NextResponse.json({ error: '스타트업을 찾을 수 없습니다.' }, { status: 404 })
    }

    // Get user role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (startup.founder_id !== user.id && profile?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '스타트업을 삭제할 권한이 없습니다.' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('startups')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Startup delete error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
