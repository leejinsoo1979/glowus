// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * 회사 지원사업 프로필 타입 정의
 */
interface CompanySupportProfile {
  id?: string
  company_id?: string
  user_id: string

  // 사업 분류
  industry_code?: string
  industry_category?: string
  industry_subcategory?: string

  // 사업 내용 (상세)
  business_description?: string
  main_products?: string
  core_technologies?: string

  // 사업 규모
  annual_revenue?: number
  employee_count?: number
  business_years?: number

  // 사업자 유형
  entity_type?: string       // 법인/개인/예비창업자
  startup_stage?: string     // 예비/초기/도약/성장

  // 지역
  region?: string
  city?: string

  // 특수 조건
  is_youth_startup?: boolean
  is_female_owned?: boolean
  is_social_enterprise?: boolean
  is_export_business?: boolean
  tech_certifications?: string[]

  // 관심 분야
  interested_categories?: string[]
  interested_keywords?: string[]

  // 메타데이터
  profile_completeness?: number
}

/**
 * 프로필 완성도 계산
 */
function calculateProfileCompleteness(profile: Partial<CompanySupportProfile>): number {
  const fields = [
    { key: 'industry_category', weight: 10 },
    { key: 'business_description', weight: 15 },
    { key: 'main_products', weight: 10 },
    { key: 'core_technologies', weight: 10 },
    { key: 'annual_revenue', weight: 8 },
    { key: 'employee_count', weight: 7 },
    { key: 'business_years', weight: 5 },
    { key: 'entity_type', weight: 10 },
    { key: 'startup_stage', weight: 5 },
    { key: 'region', weight: 10 },
    { key: 'interested_categories', weight: 5, isArray: true },
    { key: 'tech_certifications', weight: 3, isArray: true },
    { key: 'is_youth_startup', weight: 1, isBoolean: true },
    { key: 'is_female_owned', weight: 1, isBoolean: true },
  ]

  let completeness = 0

  for (const field of fields) {
    const value = (profile as any)[field.key]
    if (field.isArray) {
      if (Array.isArray(value) && value.length > 0) {
        completeness += field.weight
      }
    } else if (field.isBoolean) {
      // boolean 필드는 true일 때만 가산
      if (value === true) {
        completeness += field.weight
      }
    } else if (value !== null && value !== undefined && value !== '') {
      completeness += field.weight
    }
  }

  return Math.min(100, completeness)
}

/**
 * GET: 현재 사용자의 회사 프로필 조회
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 프로필 조회
    const { data: profile, error } = await adminSupabase
      .from('company_support_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw error
    }

    // 프로필이 없으면 빈 프로필 반환
    if (!profile) {
      return NextResponse.json({
        success: true,
        profile: null,
        message: '프로필이 아직 생성되지 않았습니다.'
      })
    }

    return NextResponse.json({
      success: true,
      profile
    })

  } catch (error: any) {
    console.error('[CompanyProfile] GET Error:', error)
    return NextResponse.json(
      { error: error.message || '프로필 조회 실패' },
      { status: 500 }
    )
  }
}

/**
 * POST: 새 프로필 생성
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

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

    // 기존 프로필 확인
    const { data: existing } = await adminSupabase
      .from('company_support_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: '프로필이 이미 존재합니다. PUT 메서드를 사용하세요.' },
        { status: 409 }
      )
    }

    // 프로필 완성도 계산
    const profileCompleteness = calculateProfileCompleteness(body)

    // 새 프로필 생성
    const profileData: CompanySupportProfile = {
      user_id: user.id,
      company_id: body.company_id || undefined,
      industry_code: body.industry_code,
      industry_category: body.industry_category,
      industry_subcategory: body.industry_subcategory,
      business_description: body.business_description,
      main_products: body.main_products,
      core_technologies: body.core_technologies,
      annual_revenue: body.annual_revenue ? parseFloat(body.annual_revenue) : undefined,
      employee_count: body.employee_count ? parseInt(body.employee_count) : undefined,
      business_years: body.business_years ? parseInt(body.business_years) : undefined,
      entity_type: body.entity_type,
      startup_stage: body.startup_stage,
      region: body.region,
      city: body.city,
      is_youth_startup: body.is_youth_startup || false,
      is_female_owned: body.is_female_owned || false,
      is_social_enterprise: body.is_social_enterprise || false,
      is_export_business: body.is_export_business || false,
      tech_certifications: body.tech_certifications || [],
      interested_categories: body.interested_categories || [],
      interested_keywords: body.interested_keywords || [],
      profile_completeness: profileCompleteness
    }

    const { data: profile, error } = await adminSupabase
      .from('company_support_profiles')
      .insert(profileData as any)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      profile,
      message: '프로필이 생성되었습니다.'
    })

  } catch (error: any) {
    console.error('[CompanyProfile] POST Error:', error)
    return NextResponse.json(
      { error: error.message || '프로필 생성 실패' },
      { status: 500 }
    )
  }
}

/**
 * PUT: 프로필 업데이트
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

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

    // 기존 프로필 확인
    const { data: existing } = await adminSupabase
      .from('company_support_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: '프로필이 존재하지 않습니다. POST 메서드를 사용하세요.' },
        { status: 404 }
      )
    }

    // 업데이트할 데이터 준비
    const updateData: Partial<CompanySupportProfile> = {}

    const allowedFields = [
      'company_id', 'industry_code', 'industry_category', 'industry_subcategory',
      'business_description', 'main_products', 'core_technologies',
      'annual_revenue', 'employee_count', 'business_years',
      'entity_type', 'startup_stage', 'region', 'city',
      'is_youth_startup', 'is_female_owned', 'is_social_enterprise', 'is_export_business',
      'tech_certifications', 'interested_categories', 'interested_keywords'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        (updateData as any)[field] = body[field]
      }
    }

    // 숫자 필드 변환
    if (updateData.annual_revenue) {
      updateData.annual_revenue = parseFloat(updateData.annual_revenue as any)
    }
    if (updateData.employee_count) {
      updateData.employee_count = parseInt(updateData.employee_count as any)
    }
    if (updateData.business_years) {
      updateData.business_years = parseInt(updateData.business_years as any)
    }

    // 프로필 완성도 재계산
    const mergedProfile = { ...(existing as object || {}), ...updateData }
    updateData.profile_completeness = calculateProfileCompleteness(mergedProfile as any)

    const { data: profile, error } = await adminSupabase
      .from('company_support_profiles')
      .update(updateData as any)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      profile,
      message: '프로필이 업데이트되었습니다.'
    })

  } catch (error: any) {
    console.error('[CompanyProfile] PUT Error:', error)
    return NextResponse.json(
      { error: error.message || '프로필 업데이트 실패' },
      { status: 500 }
    )
  }
}

/**
 * DELETE: 프로필 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await adminSupabase
      .from('company_support_profiles')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: '프로필이 삭제되었습니다.'
    })

  } catch (error: any) {
    console.error('[CompanyProfile] DELETE Error:', error)
    return NextResponse.json(
      { error: error.message || '프로필 삭제 실패' },
      { status: 500 }
    )
  }
}
