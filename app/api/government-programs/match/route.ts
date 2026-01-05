// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * 적합도 점수 구성 요소
 */
interface FitScoreBreakdown {
  industry_match: number      // 업종 매칭 (30%)
  scale_match: number         // 매출/직원 규모 (20%)
  region_match: number        // 지역 (15%)
  type_match: number          // 사업자 유형 (15%)
  special_match: number       // 특수 조건 (20%)
  reasons: string[]           // 매칭 이유 설명
}

/**
 * 매칭된 프로그램 정보
 */
interface MatchedProgram {
  program: any
  fit_score: number
  fit_breakdown: FitScoreBreakdown
}

/**
 * 회사 프로필과 프로그램 간의 적합도 계산
 */
function calculateFitScore(profile: any, program: any): FitScoreBreakdown {
  const breakdown: FitScoreBreakdown = {
    industry_match: 0,
    scale_match: 0,
    region_match: 0,
    type_match: 0,
    special_match: 0,
    reasons: []
  }

  // 1. 업종 매칭 (30점)
  if (program.target_industries && profile.industry_category) {
    const industries = Array.isArray(program.target_industries)
      ? program.target_industries
      : []

    // 정확히 일치
    if (industries.includes(profile.industry_category)) {
      breakdown.industry_match = 30
      breakdown.reasons.push(`업종이 정확히 일치 (${profile.industry_category})`)
    }
    // 관련 카테고리 (부분 일치)
    else if (industries.some((ind: string) =>
      ind.includes(profile.industry_category) ||
      profile.industry_category.includes(ind)
    )) {
      breakdown.industry_match = 20
      breakdown.reasons.push('관련 업종')
    }
    // '전업종' 또는 빈 배열은 모두 허용
    else if (industries.length === 0 || industries.includes('전업종')) {
      breakdown.industry_match = 15
      breakdown.reasons.push('모든 업종 대상')
    }
  } else if (!program.target_industries || program.target_industries?.length === 0) {
    // 업종 제한 없음
    breakdown.industry_match = 15
    breakdown.reasons.push('업종 제한 없음')
  }

  // 2. 매출/직원 규모 매칭 (20점)
  if (program.target_scales) {
    const scales = program.target_scales
    let scaleMatch = 0

    // 매출 규모 체크
    if (scales.max_revenue && profile.annual_revenue) {
      if (profile.annual_revenue <= scales.max_revenue) {
        scaleMatch += 10
        breakdown.reasons.push(`매출 규모 적합 (${(profile.annual_revenue / 100000000).toFixed(1)}억)`)
      }
    } else {
      scaleMatch += 5 // 제한 없음
    }

    // 직원 수 체크
    if (scales.max_employees && profile.employee_count) {
      if (profile.employee_count <= scales.max_employees) {
        scaleMatch += 10
        breakdown.reasons.push(`직원 수 적합 (${profile.employee_count}명)`)
      }
    } else {
      scaleMatch += 5 // 제한 없음
    }

    breakdown.scale_match = scaleMatch
  } else {
    // 규모 제한 없음
    breakdown.scale_match = 10
  }

  // 3. 지역 매칭 (15점)
  if (program.target_regions && profile.region) {
    const regions = Array.isArray(program.target_regions)
      ? program.target_regions
      : []

    if (regions.includes(profile.region) || regions.includes('전국')) {
      breakdown.region_match = 15
      breakdown.reasons.push(`지역 조건 충족 (${profile.region})`)
    } else if (regions.length === 0) {
      breakdown.region_match = 10
      breakdown.reasons.push('지역 제한 없음')
    }
  } else {
    // 지역 제한 없음
    breakdown.region_match = 10
    breakdown.reasons.push('지역 제한 없음')
  }

  // 4. 사업자 유형 매칭 (15점)
  if (profile.entity_type) {
    const programType = program.support_type || ''
    const programTitle = (program.title || '').toLowerCase()

    // 예비창업자 대상
    if (profile.entity_type === '예비창업자') {
      if (programTitle.includes('예비') || programTitle.includes('창업')) {
        breakdown.type_match = 15
        breakdown.reasons.push('예비창업자 대상 지원사업')
      } else {
        breakdown.type_match = 5
      }
    }
    // 법인
    else if (profile.entity_type === '법인') {
      breakdown.type_match = 12
      breakdown.reasons.push('법인 사업자 지원 가능')
    }
    // 개인사업자
    else if (profile.entity_type === '개인') {
      breakdown.type_match = 10
      breakdown.reasons.push('개인사업자 지원 가능')
    }
  } else {
    breakdown.type_match = 8
  }

  // 5. 특수 조건 매칭 (20점)
  let specialScore = 0

  // 청년창업
  if (profile.is_youth_startup) {
    const title = (program.title || '').toLowerCase()
    if (title.includes('청년') || title.includes('youth')) {
      specialScore += 8
      breakdown.reasons.push('청년창업 우대 사업')
    }
  }

  // 여성기업
  if (profile.is_female_owned) {
    const title = (program.title || '').toLowerCase()
    if (title.includes('여성') || title.includes('woman')) {
      specialScore += 8
      breakdown.reasons.push('여성기업 우대 사업')
    }
  }

  // 사회적기업
  if (profile.is_social_enterprise) {
    const title = (program.title || '').toLowerCase()
    if (title.includes('사회적') || title.includes('social')) {
      specialScore += 8
      breakdown.reasons.push('사회적기업 우대 사업')
    }
  }

  // 기술 인증
  if (profile.tech_certifications && profile.tech_certifications.length > 0) {
    specialScore += 4
    breakdown.reasons.push(`기술인증 보유 (${profile.tech_certifications.join(', ')})`)
  }

  // 수출기업
  if (profile.is_export_business) {
    const title = (program.title || '').toLowerCase()
    if (title.includes('수출') || title.includes('해외') || title.includes('글로벌')) {
      specialScore += 6
      breakdown.reasons.push('수출기업 우대 사업')
    }
  }

  // 관심 분야 매칭
  if (profile.interested_categories && profile.interested_categories.length > 0) {
    const programCategory = program.category || ''
    if (profile.interested_categories.includes(programCategory)) {
      specialScore += 4
      breakdown.reasons.push(`관심 분야 일치 (${programCategory})`)
    }
  }

  breakdown.special_match = Math.min(20, specialScore)

  return breakdown
}

/**
 * GET: 프로필 기반 맞춤 프로그램 매칭
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

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url)
    const minScore = parseInt(searchParams.get('min_score') || '50')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const activeOnly = searchParams.get('active_only') !== 'false'

    // 사용자 프로필 조회
    const { data: profile, error: profileError } = await adminSupabase
      .from('company_support_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError
    }

    if (!profile) {
      return NextResponse.json({
        success: false,
        error: '프로필을 먼저 생성해주세요.',
        redirect: '/dashboard-group/company/government-programs/profile'
      }, { status: 400 })
    }

    // 진행 중인 프로그램 조회
    const today = new Date().toISOString().split('T')[0]
    let programsQuery = adminSupabase
      .from('government_programs')
      .select('*')
      .or('archived.is.null,archived.eq.false')

    if (activeOnly) {
      programsQuery = programsQuery
        .lte('apply_start_date', today)
        .gte('apply_end_date', today)
    }

    const { data: programs, error: programsError } = await programsQuery

    if (programsError) {
      throw programsError
    }

    // 각 프로그램에 대해 적합도 계산
    const matchedPrograms: MatchedProgram[] = []

    for (const program of programs || []) {
      const fitBreakdown = calculateFitScore(profile, program)
      const fitScore =
        fitBreakdown.industry_match +
        fitBreakdown.scale_match +
        fitBreakdown.region_match +
        fitBreakdown.type_match +
        fitBreakdown.special_match

      if (fitScore >= minScore) {
        matchedPrograms.push({
          program,
          fit_score: fitScore,
          fit_breakdown: fitBreakdown
        })
      }
    }

    // 적합도 순으로 정렬
    matchedPrograms.sort((a, b) => b.fit_score - a.fit_score)

    // 페이지네이션 적용
    const paginatedResults = matchedPrograms.slice(offset, offset + limit)
    const totalMatched = matchedPrograms.length

    return NextResponse.json({
      success: true,
      matches: paginatedResults,
      pagination: {
        total: totalMatched,
        offset,
        limit,
        has_more: offset + limit < totalMatched
      },
      profile_completeness: profile.profile_completeness || 0,
      message: totalMatched > 0
        ? `${totalMatched}개의 맞춤 지원사업을 찾았습니다.`
        : '조건에 맞는 지원사업이 없습니다. 프로필을 업데이트해보세요.'
    })

  } catch (error: any) {
    console.error('[ProgramMatch] GET Error:', error)
    return NextResponse.json(
      { error: error.message || '매칭 실패' },
      { status: 500 }
    )
  }
}

/**
 * POST: 특정 프로그램에 대한 적합도 분석
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

    const { program_id } = await request.json()

    if (!program_id) {
      return NextResponse.json(
        { error: 'program_id가 필요합니다.' },
        { status: 400 }
      )
    }

    // 사용자 프로필 조회
    const { data: profile, error: profileError } = await adminSupabase
      .from('company_support_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError
    }

    if (!profile) {
      return NextResponse.json({
        success: false,
        error: '프로필을 먼저 생성해주세요.'
      }, { status: 400 })
    }

    // 프로그램 조회
    const { data: program, error: programError } = await adminSupabase
      .from('government_programs')
      .select('*')
      .eq('id', program_id)
      .single()

    if (programError || !program) {
      return NextResponse.json(
        { error: '프로그램을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 적합도 계산
    const fitBreakdown = calculateFitScore(profile, program)
    const fitScore =
      fitBreakdown.industry_match +
      fitBreakdown.scale_match +
      fitBreakdown.region_match +
      fitBreakdown.type_match +
      fitBreakdown.special_match

    // 신청 기록 저장 또는 업데이트 (관심 표시)
    const { data: application, error: appError } = await adminSupabase
      .from('program_applications')
      .upsert({
        user_id: user.id,
        program_id: program_id,
        company_id: profile.company_id,
        fit_score: fitScore,
        fit_reasons: fitBreakdown,
        status: 'interested'
      }, {
        onConflict: 'user_id,program_id'
      })
      .select()
      .single()

    if (appError) {
      console.error('[ProgramMatch] Application save error:', appError)
      // 저장 실패해도 분석 결과는 반환
    }

    // 적합도 레벨 결정
    let fitLevel: 'high' | 'medium' | 'low'
    let fitMessage: string

    if (fitScore >= 70) {
      fitLevel = 'high'
      fitMessage = '이 지원사업은 귀사에 매우 적합합니다!'
    } else if (fitScore >= 50) {
      fitLevel = 'medium'
      fitMessage = '이 지원사업은 귀사에 적합할 수 있습니다.'
    } else {
      fitLevel = 'low'
      fitMessage = '이 지원사업은 조건이 맞지 않을 수 있습니다.'
    }

    // 개선 제안 생성
    const suggestions: string[] = []

    if (fitBreakdown.industry_match < 20) {
      suggestions.push('프로필의 업종 정보를 업데이트하면 더 정확한 매칭이 가능합니다.')
    }
    if (fitBreakdown.scale_match < 15) {
      suggestions.push('매출/직원 수 정보를 입력하면 규모 조건을 확인할 수 있습니다.')
    }
    if (fitBreakdown.region_match < 10) {
      suggestions.push('지역 정보를 확인하고 업데이트해보세요.')
    }
    if (fitBreakdown.special_match < 10 && profile.profile_completeness < 80) {
      suggestions.push('특수 조건 (청년/여성/사회적기업 등)을 입력하면 우대 사업을 찾을 수 있습니다.')
    }

    return NextResponse.json({
      success: true,
      program: {
        id: program.id,
        title: program.title,
        organization: program.organization,
        apply_end_date: program.apply_end_date,
        link: program.link
      },
      fit_analysis: {
        score: fitScore,
        level: fitLevel,
        message: fitMessage,
        breakdown: {
          industry: { score: fitBreakdown.industry_match, max: 30 },
          scale: { score: fitBreakdown.scale_match, max: 20 },
          region: { score: fitBreakdown.region_match, max: 15 },
          type: { score: fitBreakdown.type_match, max: 15 },
          special: { score: fitBreakdown.special_match, max: 20 }
        },
        reasons: fitBreakdown.reasons,
        suggestions
      },
      application_id: application?.id
    })

  } catch (error: any) {
    console.error('[ProgramMatch] POST Error:', error)
    return NextResponse.json(
      { error: error.message || '분석 실패' },
      { status: 500 }
    )
  }
}
