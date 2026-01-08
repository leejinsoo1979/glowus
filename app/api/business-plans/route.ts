// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

// 사업계획서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientForApi()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const programId = searchParams.get('program_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')

    // 회사 조회 (company_support_profiles에서 company_id 조회)
    const { data: profile } = await supabase
      .from('company_support_profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const companyId = profile.company_id

    let query = supabase
      .from('business_plans')
      .select(`
        *,
        program:government_programs(id, title, organization)
      `)
      .eq('company_id', companyId)
      .eq('is_latest', true)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (programId) {
      query = query.eq('program_id', programId)
    }

    if (status) {
      query = query.eq('pipeline_status', status)
    }

    const { data: plans, error } = await query

    if (error) throw error

    return NextResponse.json({ plans })
  } catch (error) {
    console.error('Failed to fetch business plans:', error)
    return NextResponse.json(
      { error: 'Failed to fetch business plans' },
      { status: 500 }
    )
  }
}

// 새 사업계획서 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientForApi()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { program_id, title, project_name } = body

    if (!program_id || !title) {
      return NextResponse.json(
        { error: 'program_id and title are required' },
        { status: 400 }
      )
    }

    // 회사 조회 (company_support_profiles에서 company_id 조회)
    const { data: profile } = await supabase
      .from('company_support_profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const companyId = profile.company_id

    // 프로그램 정보 조회
    const { data: program } = await supabase
      .from('government_programs')
      .select('id, title')
      .eq('id', program_id)
      .single()

    if (!program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // 기존 템플릿 확인
    let templateId = null
    const { data: existingTemplate } = await supabase
      .from('business_plan_templates')
      .select('id')
      .eq('program_id', program_id)
      .eq('parsing_status', 'completed')
      .single()

    if (existingTemplate) {
      templateId = existingTemplate.id
    }

    // 사업계획서 생성
    const { data: plan, error } = await supabase
      .from('business_plans')
      .insert({
        user_id: user.id,
        company_id: companyId,
        program_id,
        title
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ plan })
  } catch (error) {
    console.error('Failed to create business plan:', error)
    return NextResponse.json(
      { error: 'Failed to create business plan' },
      { status: 500 }
    )
  }
}
