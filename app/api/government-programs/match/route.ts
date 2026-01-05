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
 * 키워드 사전 - 업종별 연관 키워드
 */
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  '정보통신업': ['IT', 'ICT', '소프트웨어', 'SW', '플랫폼', '앱', '웹', '클라우드', 'AI', '인공지능', '빅데이터', '데이터', '디지털', '테크', '스타트업', '핀테크', '블록체인', 'SaaS', '솔루션'],
  '제조업': ['제조', '생산', '공장', '기계', '장비', '부품', '소재', '스마트팩토리', '자동화', '로봇', '3D프린팅'],
  '바이오/헬스케어': ['바이오', '헬스케어', '의료', '제약', '건강', '메디컬', '병원', '진단', '치료', '임상', '신약'],
  '콘텐츠/미디어': ['콘텐츠', '미디어', '영상', '게임', '엔터테인먼트', '크리에이터', '방송', 'OTT', '웹툰', '애니메이션'],
  '유통/물류': ['유통', '물류', '이커머스', '커머스', '쇼핑', '배송', '풀필먼트', '라스트마일'],
  '교육/에듀테크': ['교육', '에듀테크', '학습', '강의', 'LMS', '온라인교육', '이러닝'],
  '환경/에너지': ['환경', '에너지', '친환경', 'ESG', '탄소', '신재생', '태양광', '전기차', 'EV'],
  '농업/식품': ['농업', '식품', '푸드테크', 'F&B', '농산물', '스마트팜'],
  '금융/핀테크': ['금융', '핀테크', '은행', '보험', '투자', '결제', '페이먼트'],
  '부동산/건설': ['부동산', '건설', '건축', '프롭테크', '인테리어'],
}

/**
 * 지역 키워드
 */
const REGION_KEYWORDS: Record<string, string[]> = {
  '서울': ['서울', '수도권', '강남', '판교'],
  '경기': ['경기', '수도권', '판교', '성남', '수원', '화성'],
  '인천': ['인천', '수도권'],
  '부산': ['부산', '동남권', '경남'],
  '대구': ['대구', '경북', '대경권'],
  '광주': ['광주', '전남', '호남'],
  '대전': ['대전', '충청', '세종'],
  '울산': ['울산', '동남권'],
  '세종': ['세종', '충청', '대전'],
  '강원': ['강원', '춘천', '원주'],
  '충북': ['충북', '충청', '청주'],
  '충남': ['충남', '충청', '천안'],
  '전북': ['전북', '호남', '전주'],
  '전남': ['전남', '호남', '광주'],
  '경북': ['경북', '대경권', '포항'],
  '경남': ['경남', '동남권', '창원'],
  '제주': ['제주'],
}

/**
 * 창업 단계 키워드
 */
const STAGE_KEYWORDS: Record<string, string[]> = {
  '예비창업': ['예비', '예비창업자', '창업준비', '창업교육', '아이디어'],
  '초기창업': ['초기', '초기창업', '시드', 'seed', '3년이내', '7년이내', '신규창업'],
  '성장기': ['성장', '도약', '스케일업', 'scale-up', '확장'],
  '성숙기': ['글로벌', '해외진출', 'IR', '투자유치', '시리즈'],
}

/**
 * 텍스트에서 키워드 매칭 점수 계산
 */
function calculateKeywordMatch(text: string, keywords: string[]): number {
  if (!text || keywords.length === 0) return 0
  const lowerText = text.toLowerCase()
  let matches = 0
  for (const keyword of keywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      matches++
    }
  }
  return Math.min(matches / Math.max(keywords.length * 0.3, 1), 1) // 30% 이상 매칭시 만점
}

/**
 * 회사 프로필과 프로그램 간의 적합도 계산 (텍스트 분석 기반)
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

  // 프로그램 텍스트 통합
  const programText = [
    program.title || '',
    program.content || '',
    program.summary || '',
    program.target_audience || '',
    program.eligibility || '',
    program.support_details || '',
    program.category || ''
  ].join(' ').toLowerCase()

  const profileText = [
    profile.business_description || '',
    profile.main_products || '',
    profile.core_technologies || '',
    profile.industry_category || ''
  ].join(' ').toLowerCase()

  // 1. 업종 매칭 (30점) - 텍스트 분석 기반
  let industryScore = 0
  let industryReason = ''

  // 프로필 업종의 키워드로 매칭
  if (profile.industry_category && INDUSTRY_KEYWORDS[profile.industry_category]) {
    const keywords = INDUSTRY_KEYWORDS[profile.industry_category]
    const matchScore = calculateKeywordMatch(programText, keywords)
    industryScore = Math.round(matchScore * 25) + 5 // 5~30점

    if (matchScore > 0.5) {
      industryReason = `${profile.industry_category} 업종 관련 사업 (${Math.round(matchScore * 100)}% 연관)`
    } else if (matchScore > 0.2) {
      industryReason = `${profile.industry_category} 업종 일부 연관`
    }
  }

  // 프로필 텍스트와 프로그램 텍스트 직접 비교
  if (profileText.length > 10) {
    const profileWords = profileText.split(/\s+/).filter(w => w.length > 2)
    let directMatches = 0
    for (const word of profileWords) {
      if (programText.includes(word)) directMatches++
    }
    const directScore = Math.min(directMatches / 5, 1) * 15
    if (directScore > industryScore - 5) {
      industryScore = Math.max(industryScore, Math.round(directScore) + 10)
      if (directMatches > 3) {
        industryReason = `사업내용 키워드 ${directMatches}개 일치`
      }
    }
  }

  // 전업종 대상 사업인 경우
  if (programText.includes('전업종') || programText.includes('업종무관') || programText.includes('업종 제한 없')) {
    industryScore = Math.max(industryScore, 20)
    if (!industryReason) industryReason = '전업종 대상 사업'
  }

  breakdown.industry_match = Math.min(30, Math.max(5, industryScore))
  if (industryReason) breakdown.reasons.push(industryReason)

  // 2. 규모 매칭 (20점) - 텍스트 분석 기반
  let scaleScore = 10 // 기본점수

  // 소상공인/소기업 관련
  if (programText.includes('소상공인') || programText.includes('소기업')) {
    if (profile.employee_count && profile.employee_count <= 10) {
      scaleScore = 20
      breakdown.reasons.push('소상공인 우대 사업')
    } else if (!profile.employee_count) {
      scaleScore = 15
    }
  }

  // 중소기업 관련
  if (programText.includes('중소기업') || programText.includes('중소벤처')) {
    if (profile.employee_count && profile.employee_count <= 300) {
      scaleScore = Math.max(scaleScore, 18)
      breakdown.reasons.push('중소기업 대상 사업')
    } else if (!profile.employee_count) {
      scaleScore = Math.max(scaleScore, 15)
    }
  }

  // 스타트업 관련
  if (programText.includes('스타트업') || programText.includes('창업기업')) {
    scaleScore = Math.max(scaleScore, 18)
    if (profile.entity_type === '법인' && profile.business_years && profile.business_years <= 7) {
      scaleScore = 20
      breakdown.reasons.push('창업기업 대상 사업')
    }
  }

  breakdown.scale_match = scaleScore

  // 3. 지역 매칭 (15점) - 텍스트 분석 기반
  let regionScore = 8 // 기본점수
  let regionReason = ''

  if (profile.region) {
    const regionKeywords = REGION_KEYWORDS[profile.region] || [profile.region]

    // 전국 대상
    if (programText.includes('전국') || !regionKeywords.some(k => programText.includes(k.toLowerCase()))) {
      regionScore = 12
      regionReason = '전국 대상 사업'
    }

    // 특정 지역 매칭
    for (const keyword of regionKeywords) {
      if (programText.includes(keyword.toLowerCase())) {
        regionScore = 15
        regionReason = `${profile.region} 지역 우대 사업`
        break
      }
    }
  } else {
    regionScore = 10
    regionReason = '지역 정보 미입력'
  }

  breakdown.region_match = regionScore
  if (regionReason) breakdown.reasons.push(regionReason)

  // 4. 사업자 유형/창업단계 매칭 (15점)
  let typeScore = 8
  let typeReason = ''

  if (profile.entity_type || profile.startup_stage) {
    // 예비창업자
    if (profile.entity_type === '예비창업자' || profile.startup_stage === '예비창업') {
      const stageKeywords = STAGE_KEYWORDS['예비창업']
      if (stageKeywords.some(k => programText.includes(k.toLowerCase()))) {
        typeScore = 15
        typeReason = '예비창업자 대상 사업'
      }
    }
    // 초기창업
    else if (profile.startup_stage === '초기창업' || (profile.business_years && profile.business_years <= 3)) {
      const stageKeywords = STAGE_KEYWORDS['초기창업']
      if (stageKeywords.some(k => programText.includes(k.toLowerCase()))) {
        typeScore = 15
        typeReason = '초기창업기업 대상 사업'
      } else {
        typeScore = 12
      }
    }
    // 성장기
    else if (profile.startup_stage === '성장기' || (profile.business_years && profile.business_years > 3 && profile.business_years <= 7)) {
      const stageKeywords = STAGE_KEYWORDS['성장기']
      if (stageKeywords.some(k => programText.includes(k.toLowerCase()))) {
        typeScore = 15
        typeReason = '성장기 기업 대상 사업'
      } else {
        typeScore = 10
      }
    }
    // 법인
    if (profile.entity_type === '법인' && (programText.includes('법인') || programText.includes('기업'))) {
      typeScore = Math.max(typeScore, 12)
      if (!typeReason) typeReason = '법인 사업자 지원 가능'
    }
  }

  breakdown.type_match = typeScore
  if (typeReason) breakdown.reasons.push(typeReason)

  // 5. 특수 조건 및 우대사항 매칭 (20점)
  let specialScore = 0
  const specialReasons: string[] = []

  // 청년창업
  if (profile.is_youth_startup && (programText.includes('청년') || programText.includes('39세') || programText.includes('youth'))) {
    specialScore += 6
    specialReasons.push('청년창업 우대')
  }

  // 여성기업
  if (profile.is_female_owned && (programText.includes('여성') || programText.includes('woman'))) {
    specialScore += 6
    specialReasons.push('여성기업 우대')
  }

  // 사회적기업
  if (profile.is_social_enterprise && (programText.includes('사회적') || programText.includes('사회적기업'))) {
    specialScore += 6
    specialReasons.push('사회적기업 우대')
  }

  // 벤처인증
  if (profile.is_venture_certified && (programText.includes('벤처') || programText.includes('이노비즈'))) {
    specialScore += 5
    specialReasons.push('벤처인증기업 우대')
  }

  // 기술인증 보유
  if (profile.tech_certifications && profile.tech_certifications.length > 0) {
    const certKeywords = ['기술인증', '특허', '연구소', 'R&D', '기술개발']
    if (certKeywords.some(k => programText.includes(k.toLowerCase()))) {
      specialScore += 5
      specialReasons.push(`기술인증 보유 (${profile.tech_certifications.join(', ')})`)
    }
  }

  // 수출/해외진출
  if (profile.is_export_business && (programText.includes('수출') || programText.includes('해외') || programText.includes('글로벌'))) {
    specialScore += 5
    specialReasons.push('수출기업 우대')
  }

  // 관심 분야 매칭
  if (profile.interested_categories && profile.interested_categories.length > 0) {
    for (const cat of profile.interested_categories) {
      if (programText.includes(cat.toLowerCase())) {
        specialScore += 3
        specialReasons.push(`관심 분야 (${cat}) 일치`)
        break
      }
    }
  }

  // 지원유형 매칭
  if (profile.preferred_support_types && program.support_type) {
    if (profile.preferred_support_types.includes(program.support_type)) {
      specialScore += 4
      specialReasons.push(`선호 지원유형 (${program.support_type})`)
    }
  }

  breakdown.special_match = Math.min(20, specialScore)
  breakdown.reasons.push(...specialReasons)

  // 최소 점수 보장 (프로필이 입력된 경우)
  const totalScore = breakdown.industry_match + breakdown.scale_match +
                     breakdown.region_match + breakdown.type_match + breakdown.special_match

  if (totalScore < 30 && profile.industry_category) {
    // 최소한의 정보가 있으면 30점은 보장
    const deficit = 30 - totalScore
    breakdown.industry_match += Math.ceil(deficit / 2)
    breakdown.scale_match += Math.floor(deficit / 2)
  }

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

    // 진행 중인 프로그램 조회 (데모 제외)
    const today = new Date().toISOString().split('T')[0]
    let programsQuery = adminSupabase
      .from('government_programs')
      .select('*')
      .or('archived.is.null,archived.eq.false')
      .not('title', 'ilike', '%데모%')
      .not('title', 'ilike', '%테스트%')

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
