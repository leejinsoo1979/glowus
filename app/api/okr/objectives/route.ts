export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'

// GET: 목표 목록 조회
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)

    const year = searchParams.get('year')
    const quarter = searchParams.get('quarter')
    const status = searchParams.get('status')
    const companyId = searchParams.get('company_id')

    let query = (adminClient as any)
      .from('objectives')
      .select(`
        *,
        owner:users!objectives_owner_id_fkey(id, name, email, avatar_url),
        department:departments(id, name),
        key_results(
          id,
          title,
          metric_type,
          start_value,
          target_value,
          current_value,
          unit,
          progress,
          status,
          weight,
          sort_order
        )
      `)
      .order('created_at', { ascending: false })

    if (year) {
      query = query.eq('year', parseInt(year))
    }
    if (quarter) {
      query = query.eq('quarter', parseInt(quarter))
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch objectives:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching objectives:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    )
  }
}

// POST: 새 목표 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      description,
      company_id,
      vision_id,
      parent_id,
      owner_id,
      department_id,
      period_type = 'quarterly',
      year,
      quarter,
      start_date,
      end_date,
      priority = 'medium',
      weight = 1.0,
      key_results = []
    } = body

    if (!title) {
      return NextResponse.json({ error: '목표 제목은 필수입니다' }, { status: 400 })
    }

    if (!year) {
      return NextResponse.json({ error: '연도는 필수입니다' }, { status: 400 })
    }

    // 목표 생성 (테이블 타입 미생성 상태)
    const { data: objective, error: objError } = await (adminClient as any)
      .from('objectives')
      .insert({
        title,
        description,
        company_id,
        vision_id,
        parent_id,
        owner_id: owner_id || user.id,
        department_id,
        period_type,
        year,
        quarter,
        start_date,
        end_date,
        priority,
        weight,
        status: 'draft'
      })
      .select()
      .single()

    if (objError) {
      console.error('Failed to create objective:', objError)
      return NextResponse.json({ error: objError.message }, { status: 500 })
    }

    // Key Results 생성
    if (key_results.length > 0) {
      const krData = key_results.map((kr: any, index: number) => ({
        objective_id: objective.id,
        title: kr.title,
        description: kr.description,
        owner_id: kr.owner_id || owner_id || user.id,
        metric_type: kr.metric_type || 'percentage',
        start_value: kr.start_value || 0,
        target_value: kr.target_value || 100,
        current_value: kr.current_value || kr.start_value || 0,
        unit: kr.unit,
        weight: kr.weight || 1.0,
        sort_order: index
      }))

      const { error: krError } = await (adminClient as any)
        .from('key_results')
        .insert(krData)

      if (krError) {
        console.error('Failed to create key results:', krError)
        // 목표는 생성되었으므로 경고만 로그
      }
    }

    // 생성된 목표를 KR과 함께 조회
    const { data: result, error: fetchError } = await (adminClient as any)
      .from('objectives')
      .select(`
        *,
        owner:users!objectives_owner_id_fkey(id, name, email, avatar_url),
        key_results(*)
      `)
      .eq('id', objective.id)
      .single()

    if (fetchError) {
      return NextResponse.json(objective)
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating objective:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    )
  }
}
