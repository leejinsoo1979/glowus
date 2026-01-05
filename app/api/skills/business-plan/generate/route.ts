// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2분 타임아웃

// 섹션 타입 정의
interface SectionDefinition {
  key: string
  title: string
  subtitle: string
  required: boolean
  max_chars: number
  order: number
  description: string
}

interface GenerateRequest {
  program_id: string
  template_id?: string
  sections_to_generate?: string[]
  include_market_research?: boolean
}

interface CompanyContext {
  profile: any
  team_members: any[]
  products: any[]
  achievements: any[]
  financials: any[]
  market_data: any
  knowledge_entries: any[]
}

interface ProgramRequirements {
  eligibility_criteria: any
  evaluation_criteria: any[]
  required_documents: any[]
  plan_format_requirements: any
  writing_tips: string[]
  cautions: string[]
}

// =====================================================
// 시스템 프롬프트 - 지식베이스 기반
// =====================================================
const BUSINESS_PLAN_SYSTEM_PROMPT = `당신은 정부지원사업 사업계획서 작성 전문가입니다.
당신에게는 실제 회사 데이터가 제공됩니다. 이 데이터를 기반으로 사업계획서를 작성하세요.

## 핵심 원칙
1. **데이터 기반 작성**: 제공된 회사 정보만 사용하세요. 추측하지 마세요.
2. **평가 기준 반영**: 프로그램의 평가 기준에 맞춰 내용을 구성하세요.
3. **구체적 수치**: 가능한 한 정량적 데이터를 사용하세요.
4. **차별화 강조**: 회사의 핵심 역량과 차별점을 부각하세요.

## 작성 스타일
- 간결하고 명확한 문장
- 핵심 포인트는 강조
- 마크다운 형식 사용
- 적절한 표와 리스트 활용

## 주의사항
- 허위 정보 작성 금지
- 데이터가 없으면 "[데이터 필요]"로 표시
- 과장된 표현 자제`

// =====================================================
// 회사 지식베이스 로드 함수
// =====================================================
async function loadCompanyContext(
  adminSupabase: any,
  userId: string
): Promise<CompanyContext> {
  // 1. 기본 프로필 조회
  const { data: profile } = await adminSupabase
    .from('company_support_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  const companyId = profile?.company_id

  // 2. 팀 멤버 조회
  const { data: team_members } = await adminSupabase
    .from('company_team_members')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('is_key_member', { ascending: false })
    .order('display_order')

  // 3. 제품/서비스 조회
  const { data: products } = await adminSupabase
    .from('company_products')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('is_flagship', { ascending: false })
    .order('display_order')

  // 4. 성과/수상 조회
  const { data: achievements } = await adminSupabase
    .from('company_achievements')
    .select('*')
    .eq('user_id', userId)
    .order('importance_level', { ascending: false })
    .order('date', { ascending: false })
    .limit(15)

  // 5. 재무 정보 조회
  const { data: financials } = await adminSupabase
    .from('company_financials')
    .select('*')
    .eq('user_id', userId)
    .order('fiscal_year', { ascending: false })
    .limit(3)

  // 6. 시장 데이터 조회
  const { data: market_data } = await adminSupabase
    .from('company_market_data')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // 7. 추가 지식베이스 엔트리
  const { data: knowledge_entries } = await adminSupabase
    .from('company_knowledge_entries')
    .select('category, title, content, tags')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(20)

  return {
    profile: profile || {},
    team_members: team_members || [],
    products: products || [],
    achievements: achievements || [],
    financials: financials || [],
    market_data: market_data || null,
    knowledge_entries: knowledge_entries || []
  }
}

// =====================================================
// 프로그램 요구사항 로드 함수
// =====================================================
async function loadProgramRequirements(
  adminSupabase: any,
  programId: string
): Promise<ProgramRequirements | null> {
  const { data } = await adminSupabase
    .from('program_requirements')
    .select('*')
    .eq('program_id', programId)
    .single()

  return data
}

// =====================================================
// 지식베이스 완성도 검사
// =====================================================
function checkKnowledgeBaseCompleteness(context: CompanyContext): {
  score: number
  missing: string[]
  warnings: string[]
} {
  const missing: string[] = []
  const warnings: string[] = []
  let score = 0
  const maxScore = 100

  // 필수 항목 체크
  if (!context.profile?.business_description) {
    missing.push('사업 설명 (business_description)')
  } else {
    score += 15
  }

  if (!context.profile?.main_products) {
    missing.push('주요 제품/서비스 (main_products)')
  } else {
    score += 10
  }

  if (context.team_members.length === 0) {
    missing.push('팀 구성원 정보')
  } else {
    score += 20
    if (!context.team_members.some(m => m.is_key_member)) {
      warnings.push('핵심 인력이 지정되지 않았습니다.')
    }
  }

  if (context.products.length === 0) {
    missing.push('제품/서비스 상세 정보')
  } else {
    score += 15
    if (!context.products.some(p => p.is_flagship)) {
      warnings.push('주력 제품이 지정되지 않았습니다.')
    }
  }

  if (context.financials.length === 0) {
    warnings.push('재무 정보가 없습니다. 재무계획 섹션이 제한됩니다.')
  } else {
    score += 25
  }

  if (!context.market_data) {
    warnings.push('시장 데이터가 없습니다. 시장분석 섹션이 제한됩니다.')
  } else {
    score += 15
  }

  return { score, missing, warnings }
}

// =====================================================
// 컨텍스트 기반 섹션 프롬프트 생성
// =====================================================
function buildSectionPrompt(
  sectionKey: string,
  context: CompanyContext,
  program: any,
  requirements: ProgramRequirements | null,
  sectionDef: SectionDefinition
): string {
  // 회사 정보 포맷팅
  const companyInfo = `
## 회사 기본 정보
- 업종: ${context.profile.industry_category || '미설정'} ${context.profile.industry_subcategory ? `(${context.profile.industry_subcategory})` : ''}
- 사업자 유형: ${context.profile.entity_type || '미설정'}
- 창업 단계: ${context.profile.startup_stage || '미설정'}
- 지역: ${context.profile.region || '미설정'}
- 연매출: ${context.profile.annual_revenue ? `${(context.profile.annual_revenue / 100000000).toFixed(1)}억원` : '미설정'}
- 직원 수: ${context.profile.employee_count ? `${context.profile.employee_count}명` : '미설정'}
- 업력: ${context.profile.business_years ? `${context.profile.business_years}년` : '미설정'}

## 사업 설명
${context.profile.business_description || '[데이터 없음]'}

## 주요 제품/서비스
${context.profile.main_products || '[데이터 없음]'}

## 핵심 기술
${context.profile.core_technologies || '[데이터 없음]'}
`.trim()

  // 팀 정보 포맷팅
  const teamInfo = context.team_members.length > 0
    ? context.team_members.map(m => `
- **${m.name}** (${m.position || m.role || '멤버'})${m.is_key_member ? ' ★핵심인력' : ''}
  - 전문분야: ${m.expertise?.join(', ') || '미상'}
  - 경력: ${m.bio || (m.career_history?.map((c: any) => c.company).join(' → ') || '미상')}
  - 학력: ${m.education?.map((e: any) => `${e.school} ${e.degree}`).join(', ') || '미상'}
`).join('\n')
    : '[팀 정보 없음 - 지식베이스에 팀원을 등록해주세요]'

  // 제품 정보 포맷팅
  const productInfo = context.products.length > 0
    ? context.products.map(p => `
### ${p.name}${p.is_flagship ? ' ★주력제품' : ''}
- 유형: ${p.product_type || p.category || ''}
- 설명: ${p.description || ''}
- 핵심 기능: ${p.key_features?.map((f: any) => typeof f === 'string' ? f : f.name).join(', ') || ''}
- 핵심 기술: ${p.core_technology || ''}
- 개발 단계: ${p.development_stage || ''}
- 타겟 고객: ${p.target_customers || ''}
- 사용자 수: ${p.user_count ? `${p.user_count}명` : '미집계'}
`).join('\n')
    : '[제품 정보 없음 - 지식베이스에 제품을 등록해주세요]'

  // 성과 정보 포맷팅
  const achievementInfo = context.achievements.length > 0
    ? context.achievements.slice(0, 10).map(a => `
- [${a.achievement_type}] ${a.title} (${a.date || ''}) - ${a.issuer || ''}
  ${a.description ? `설명: ${a.description}` : ''}
`).join('\n')
    : '[성과 정보 없음]'

  // 재무 정보 포맷팅
  const financialInfo = context.financials.length > 0
    ? context.financials.map(f => `
### ${f.fiscal_year}년${f.fiscal_quarter ? ` ${f.fiscal_quarter}분기` : ''}
- 매출: ${f.revenue ? `${(f.revenue / 100000000).toFixed(1)}억원` : '미공개'}
- 영업이익: ${f.operating_profit ? `${(f.operating_profit / 100000000).toFixed(1)}억원` : '미공개'}
- 순이익: ${f.net_profit ? `${(f.net_profit / 100000000).toFixed(1)}억원` : '미공개'}
- 직원수: ${f.employee_count || '미공개'}명
- 전년대비 매출성장: ${f.yoy_revenue_growth ? `${f.yoy_revenue_growth}%` : '미공개'}
`).join('\n')
    : '[재무 정보 없음 - 지식베이스에 재무 데이터를 등록해주세요]'

  // 시장 정보 포맷팅
  const marketInfo = context.market_data
    ? `
## 시장 분석 데이터
- 시장: ${context.market_data.industry_name || ''}
- TAM (전체시장): ${context.market_data.tam ? `${context.market_data.tam}억원` : '미상'}
- SAM (유효시장): ${context.market_data.sam ? `${context.market_data.sam}억원` : '미상'}
- SOM (목표시장): ${context.market_data.som ? `${context.market_data.som}억원` : '미상'}
- 시장 성장률: ${context.market_data.market_growth_rate ? `${context.market_data.market_growth_rate}%` : '미상'}
- 경쟁사: ${context.market_data.competitors?.map((c: any) => c.name).join(', ') || '미분석'}
- 시장 트렌드: ${context.market_data.market_trends?.join(', ') || '미분석'}
- SWOT: ${JSON.stringify(context.market_data.swot_analysis || {}, null, 2)}
`
    : '[시장 데이터 없음 - 지식베이스에 시장 정보를 등록해주세요]'

  // 프로그램 요구사항 포맷팅
  const programReq = requirements
    ? `
## 이 프로그램의 평가 기준
${requirements.evaluation_criteria?.map((c: any) => `
### ${c.category} (${c.weight}%)
평가 항목: ${c.items?.join(', ') || ''}
${c.tips ? `팁: ${c.tips}` : ''}
`).join('\n') || '평가 기준 없음'}

## 작성 팁
${requirements.writing_tips?.map((t: string) => `- ${t}`).join('\n') || ''}

## 주의사항
${requirements.cautions?.map((c: string) => `⚠️ ${c}`).join('\n') || ''}
`
    : '[프로그램 요구사항 파싱 필요]'

  // 섹션별 프롬프트
  const baseContext = `
=== 지원사업 정보 ===
- 사업명: ${program.title}
- 주관기관: ${program.organization}
- 분야: ${program.category || ''}
- 지원금액: ${program.support_amount || ''}

=== 회사 지식베이스 ===

${companyInfo}

=== 팀 구성 ===
${teamInfo}

=== 제품/서비스 ===
${productInfo}

=== 주요 성과 ===
${achievementInfo}

=== 재무 현황 ===
${financialInfo}

${marketInfo}

${programReq}

=== 작성 요건 ===
- 최대 ${sectionDef.max_chars}자 이내
- ${sectionDef.description}
`

  const sectionPrompts: Record<string, string> = {
    executive_summary: `${baseContext}

위 회사 지식베이스를 기반으로 **사업 요약(Executive Summary)**을 작성해주세요.

다음 내용을 포함:
1. 핵심 사업 아이디어와 차별점 (실제 제품 데이터 기반)
2. 타겟 시장과 고객 (시장 데이터 기반)
3. 비즈니스 모델의 핵심
4. 팀의 핵심 역량 (팀 데이터 기반)
5. 기대 성과와 지원금 활용 계획

⚠️ 지식베이스에 없는 내용은 추측하지 말고 "[데이터 필요]"로 표시하세요.`,

    company_overview: `${baseContext}

위 회사 지식베이스를 기반으로 **회사 개요**를 작성해주세요.

다음 내용을 포함:
1. 회사 소개 및 비전
2. 주요 연혁 및 마일스톤 (성과 데이터 기반)
3. 조직 구성 및 핵심 인력 (팀 데이터 기반)
4. 주요 사업 영역 및 제품/서비스
5. 핵심 역량 및 경쟁력

⚠️ 실제 데이터만 사용하세요.`,

    problem_statement: `${baseContext}

위 회사 지식베이스를 기반으로 **문제 정의(Problem Statement)**를 작성해주세요.

다음 내용을 포함:
1. 회사가 해결하려는 시장의 문제점
2. 문제의 심각성과 시급성
3. 기존 해결책의 한계점
4. 시장 데이터를 통한 문제의 규모 입증

⚠️ 시장 데이터가 없으면 "[시장 데이터 필요]"로 표시하세요.`,

    solution: `${baseContext}

위 회사 지식베이스를 기반으로 **해결책(Solution)**을 작성해주세요.

다음 내용을 포함:
1. 제안하는 제품/서비스의 핵심 기능 (제품 데이터 기반)
2. 기존 방식 대비 차별화 포인트
3. 기술적 우위성 (핵심 기술 기반)
4. 고객에게 제공하는 핵심 가치

⚠️ 제품 정보가 부족하면 "[제품 상세 필요]"로 표시하세요.`,

    market_research: `${baseContext}

위 회사 지식베이스를 기반으로 **시장 분석**을 작성해주세요.

다음 내용을 포함:
1. TAM/SAM/SOM 시장 규모 분석 (시장 데이터 기반)
2. 시장 성장률 및 전망
3. 주요 경쟁사 분석 (경쟁사 데이터 기반)
4. 시장 트렌드 및 기회 요인
5. SWOT 분석

⚠️ 시장 데이터가 없으면 일반적인 추정치를 사용하되 "[추정치]"로 표시하세요.`,

    business_model: `${baseContext}

위 회사 지식베이스를 기반으로 **비즈니스 모델**을 작성해주세요.

다음 내용을 포함:
1. 수익 모델 (제품 가격 정책 기반)
2. 가격 전략
3. 고객 획득 전략
4. 주요 파트너십
5. 핵심 자원 및 활동`,

    team_introduction: `${baseContext}

위 회사 지식베이스를 기반으로 **팀 소개**를 작성해주세요.

다음 내용을 포함:
1. CEO 및 핵심 인력 소개 (팀 데이터 필수)
2. 각 멤버의 경력, 전문성, 학력
3. 팀의 차별화된 역량
4. 역할 분담 및 조직 구조
5. 외부 자문단/멘토 (있을 경우)

⚠️ 팀 정보가 없으면 "[팀 정보 필요 - 지식베이스에 팀원 등록 필요]"로 표시하세요.`,

    financial_plan: `${baseContext}

위 회사 지식베이스를 기반으로 **재무 계획**을 작성해주세요.

다음 내용을 포함:
1. 현재 재무 현황 (재무 데이터 기반)
2. 3~5년 추정 손익계산서
3. 월별/분기별 매출 계획
4. 손익분기점 분석
5. 주요 비용 구조

⚠️ 재무 데이터가 없으면 "[재무 데이터 필요]"로 표시하세요.`,

    fund_usage: `${baseContext}

위 회사 지식베이스를 기반으로 **자금 사용 계획**을 작성해주세요.

다음 내용을 포함:
1. 항목별 자금 소요 내역 (표 형식)
2. 분기별 집행 계획
3. 자부담/지원금 구분
4. 각 항목의 사용 근거
5. 예비비 계획`,

    expected_outcomes: `${baseContext}

위 회사 지식베이스를 기반으로 **기대 효과**를 작성해주세요.

다음 내용을 포함:
1. 정량적 성과 목표 (매출, 고용, 사용자 수 등)
2. 정성적 성과 목표
3. 사회적 가치 및 파급 효과
4. 후속 사업 계획
5. 성과 측정 방법 (KPI)`
  }

  return sectionPrompts[sectionKey] || `${baseContext}\n\n${sectionDef.title} 섹션을 작성해주세요.`
}

/**
 * 기본 섹션 구조 (템플릿 없을 때 사용)
 */
const DEFAULT_SECTIONS: SectionDefinition[] = [
  { key: 'executive_summary', title: '사업 요약', subtitle: 'Executive Summary', required: true, max_chars: 3000, order: 1, description: '사업의 핵심을 1페이지로 요약' },
  { key: 'company_overview', title: '회사 개요', subtitle: 'Company Overview', required: true, max_chars: 2000, order: 2, description: '회사 연혁, 조직, 핵심역량' },
  { key: 'problem_statement', title: '문제 정의', subtitle: 'Problem Statement', required: true, max_chars: 2000, order: 3, description: '해결하고자 하는 문제와 시급성' },
  { key: 'solution', title: '해결책', subtitle: 'Solution', required: true, max_chars: 3000, order: 4, description: '제안하는 솔루션과 차별점' },
  { key: 'business_model', title: '비즈니스 모델', subtitle: 'Business Model', required: true, max_chars: 2500, order: 5, description: '수익 모델과 고객 획득 전략' },
  { key: 'fund_usage', title: '자금 사용 계획', subtitle: 'Fund Usage Plan', required: true, max_chars: 2000, order: 6, description: '항목별 자금 소요와 집행 계획' },
  { key: 'expected_outcomes', title: '기대 효과', subtitle: 'Expected Outcomes', required: true, max_chars: 2000, order: 7, description: '정량/정성적 성과 목표와 KPI' },
]

/**
 * POST: 사업계획서 생성 (지식베이스 기반)
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

    const body: GenerateRequest = await request.json()
    const { program_id, template_id, sections_to_generate, include_market_research = true } = body

    if (!program_id) {
      return NextResponse.json(
        { error: 'program_id가 필요합니다.' },
        { status: 400 }
      )
    }

    // =====================================================
    // 1. 회사 지식베이스 로드
    // =====================================================
    console.log('[BusinessPlan] Loading company knowledge base...')
    const companyContext = await loadCompanyContext(adminSupabase, user.id)

    // 지식베이스 완성도 검사
    const completeness = checkKnowledgeBaseCompleteness(companyContext)
    console.log('[BusinessPlan] Knowledge base completeness:', completeness)

    if (completeness.score < 30) {
      return NextResponse.json({
        success: false,
        error: '지식베이스가 부족합니다. 사업계획서 생성을 위해 회사 정보를 먼저 입력해주세요.',
        missing_data: completeness.missing,
        completeness_score: completeness.score,
        required_actions: [
          '회사 프로필에 사업 설명 추가',
          '팀 멤버 정보 등록',
          '제품/서비스 정보 등록'
        ]
      }, { status: 400 })
    }

    // =====================================================
    // 2. 프로그램 정보 및 요구사항 로드
    // =====================================================
    const { data: program, error: programError } = await adminSupabase
      .from('government_programs')
      .select('*')
      .eq('id', program_id)
      .single()

    if (programError || !program) {
      return NextResponse.json(
        { error: '지원사업을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 프로그램 요구사항 로드
    const programRequirements = await loadProgramRequirements(adminSupabase, program_id)
    console.log('[BusinessPlan] Program requirements loaded:', !!programRequirements)

    // =====================================================
    // 3. 템플릿 섹션 결정
    // =====================================================
    let templateSections: SectionDefinition[] = DEFAULT_SECTIONS

    try {
      if (template_id) {
        const { data: t } = await adminSupabase
          .from('business_plan_templates')
          .select('*')
          .eq('id', template_id)
          .single()
        if (t?.section_structure) {
          templateSections = t.section_structure as SectionDefinition[]
        }
      } else {
        const { data: t } = await adminSupabase
          .from('business_plan_templates')
          .select('*')
          .eq('is_active', true)
          .limit(1)
          .single()
        if (t?.section_structure) {
          templateSections = t.section_structure as SectionDefinition[]
        }
      }
    } catch {
      console.log('[BusinessPlan] Using default sections (template not found)')
    }

    const allSections = templateSections
    const sectionsToGenerate = sections_to_generate
      ? allSections.filter(s => sections_to_generate.includes(s.key))
      : allSections.filter(s => s.required)

    // =====================================================
    // 4. 사업계획서 레코드 생성
    // =====================================================
    const { data: businessPlan, error: bpError } = await adminSupabase
      .from('business_plans')
      .insert({
        user_id: user.id,
        program_id: program_id,
        company_id: companyContext.profile.company_id,
        title: `${program.title} - 사업계획서`,
        status: 'generating',
        ai_model: 'gpt-4o',
        sections: {},
        web_search_results: {
          knowledge_base_used: true,
          completeness_score: completeness.score,
          warnings: completeness.warnings
        }
      })
      .select()
      .single()

    if (bpError) {
      throw bpError
    }

    // =====================================================
    // 5. OpenAI GPT-4o API 호출 (지식베이스 기반)
    // =====================================================
    const openai = new OpenAI()
    const generatedSections: Record<string, any> = {}
    const aiGenerationLog: any[] = []

    for (const sectionDef of sectionsToGenerate) {
      const startTime = Date.now()

      try {
        // 지식베이스 기반 프롬프트 생성
        const sectionPrompt = buildSectionPrompt(
          sectionDef.key,
          companyContext,
          program,
          programRequirements,
          sectionDef
        )

        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 2500,
          messages: [
            { role: 'system', content: BUSINESS_PLAN_SYSTEM_PROMPT },
            { role: 'user', content: sectionPrompt }
          ]
        })

        const content = response.choices[0]?.message?.content || ''

        // 데이터 부족 경고 추출
        const dataNeededMatches = content.match(/\[.*?필요\]/g) || []
        const dataNeededWarnings = [...new Set(dataNeededMatches)]

        generatedSections[sectionDef.key] = {
          content: content,
          generated_at: new Date().toISOString(),
          edited: false,
          title: sectionDef.title,
          order: sectionDef.order,
          data_warnings: dataNeededWarnings.length > 0 ? dataNeededWarnings : undefined,
          knowledge_base_used: true
        }

        aiGenerationLog.push({
          section: sectionDef.key,
          status: 'success',
          duration_ms: Date.now() - startTime,
          input_tokens: response.usage?.prompt_tokens || 0,
          output_tokens: response.usage?.completion_tokens || 0,
          data_warnings: dataNeededWarnings
        })
      } catch (sectionError: any) {
        aiGenerationLog.push({
          section: sectionDef.key,
          status: 'error',
          error: sectionError.message,
          duration_ms: Date.now() - startTime
        })

        generatedSections[sectionDef.key] = {
          content: '',
          generated_at: new Date().toISOString(),
          edited: false,
          error: sectionError.message,
          title: sectionDef.title,
          order: sectionDef.order
        }
      }
    }

    // =====================================================
    // 6. 사업계획서 업데이트
    // =====================================================
    const { error: updateError } = await adminSupabase
      .from('business_plans')
      .update({
        sections: generatedSections,
        status: 'completed',
        ai_generation_log: aiGenerationLog
      })
      .eq('id', businessPlan.id)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      business_plan_id: businessPlan.id,
      sections: generatedSections,
      generation_log: aiGenerationLog,
      knowledge_base_info: {
        completeness_score: completeness.score,
        warnings: completeness.warnings,
        missing_data: completeness.missing,
        team_count: companyContext.team_members.length,
        product_count: companyContext.products.length,
        achievement_count: companyContext.achievements.length,
        has_financials: companyContext.financials.length > 0,
        has_market_data: !!companyContext.market_data
      },
      program_requirements_used: !!programRequirements,
      message: `${Object.keys(generatedSections).length}개 섹션이 생성되었습니다.`
    })

  } catch (error: any) {
    console.error('[BusinessPlan Generate] Error:', error)
    return NextResponse.json(
      { error: error.message || '사업계획서 생성 실패' },
      { status: 500 }
    )
  }
}

/**
 * GET: 사업계획서 조회
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

    const { searchParams } = new URL(request.url)
    const businessPlanId = searchParams.get('id')
    const programId = searchParams.get('program_id')

    if (businessPlanId) {
      // 특정 사업계획서 조회
      const { data: plan, error } = await adminSupabase
        .from('business_plans')
        .select('*, government_programs(*)')
        .eq('id', businessPlanId)
        .eq('user_id', user.id)
        .single()

      if (error) {
        return NextResponse.json({ error: '사업계획서를 찾을 수 없습니다.' }, { status: 404 })
      }

      return NextResponse.json({ success: true, business_plan: plan })
    }

    if (programId) {
      // 프로그램별 사업계획서 조회
      const { data: plans, error } = await adminSupabase
        .from('business_plans')
        .select('*')
        .eq('program_id', programId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      return NextResponse.json({ success: true, business_plans: plans })
    }

    // 사용자의 모든 사업계획서 조회
    const { data: plans, error } = await adminSupabase
      .from('business_plans')
      .select('*, government_programs(title, organization)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ success: true, business_plans: plans })

  } catch (error: any) {
    console.error('[BusinessPlan] GET Error:', error)
    return NextResponse.json(
      { error: error.message || '조회 실패' },
      { status: 500 }
    )
  }
}
