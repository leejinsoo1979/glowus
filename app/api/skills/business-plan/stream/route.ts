// @ts-nocheck
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
const getGeminiModel = () => genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// =====================================================
// 섹션 타입 정의 (generate API와 동일)
// =====================================================
interface SectionDefinition {
  key: string
  title: string
  subtitle: string
  required: boolean
  max_chars: number
  order: number
  description: string
  table_template?: string
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
// 시스템 프롬프트 - 시각자료 포함 버전
// =====================================================
const BUSINESS_PLAN_SYSTEM_PROMPT = `당신은 정부지원사업 사업계획서 작성 전문가입니다.
당신에게는 실제 회사 데이터가 제공됩니다. 이 데이터를 기반으로 사업계획서를 작성하세요.

## 핵심 원칙
1. **데이터 기반 작성**: 제공된 회사 정보만 사용하세요. 추측하지 마세요.
2. **평가 기준 반영**: 프로그램의 평가 기준에 맞춰 내용을 구성하세요.
3. **구체적 수치**: 가능한 한 정량적 데이터를 사용하세요.
4. **차별화 강조**: 회사의 핵심 역량과 차별점을 부각하세요.
5. **시각자료 필수**: 표, 차트, 다이어그램을 적극 활용하세요.

## 작성 스타일
- 간결하고 명확한 문장
- 핵심 포인트는 강조
- 마크다운 형식 사용

## 시각자료 작성 규칙 (매우 중요)

### 1. 표 (Table) - 마크다운 테이블 사용
정량적 데이터, 비교 분석, 일정 등에는 반드시 표를 사용하세요.
예시:
| 구분 | 2024년 | 2025년 | 2026년 |
|------|--------|--------|--------|
| 매출 | 3억 | 5억 | 10억 |

### 2. 차트 (Chart) - JSON 블록으로 데이터 제공
차트가 필요한 곳에는 아래 형식으로 데이터를 제공하세요:
\`\`\`chart
{
  "type": "bar|line|pie|area",
  "title": "차트 제목",
  "data": [
    {"name": "항목1", "value": 100},
    {"name": "항목2", "value": 200}
  ]
}
\`\`\`

### 3. 이미지 플레이스홀더 - 이미지가 필요한 위치 표시
제품 사진, 시스템 구성도 등이 필요한 곳에는:
\`\`\`image
{
  "type": "product|diagram|screenshot|logo|team",
  "description": "필요한 이미지 설명",
  "placeholder": "이미지 업로드 필요"
}
\`\`\`

### 4. 다이어그램 - Mermaid 문법 사용
프로세스, 조직도, 플로우차트 등에는:
\`\`\`mermaid
graph TD
    A[시작] --> B[프로세스]
    B --> C[결과]
\`\`\`

## 섹션별 필수 시각자료
- **회사/팀 소개**: 조직도(mermaid), 핵심인력표
- **제품/서비스**: 제품이미지(image), 기술스택표, 시스템구성도(mermaid)
- **시장 분석**: 시장규모차트(chart-bar), 경쟁사비교표, TAM/SAM/SOM차트(chart-pie)
- **비즈니스 모델**: 수익구조다이어그램(mermaid), 가격표
- **사업화 전략**: 추진일정표(간트차트형 테이블), 마일스톤표
- **재무 계획**: 매출전망차트(chart-line), 손익계산표, 자금사용계획표

## 주의사항
- 허위 정보 작성 금지
- 데이터가 없으면 "[데이터 필요]"로 표시
- 과장된 표현 자제
- 시각자료 없이 텍스트만 나열하지 마세요`

// =====================================================
// Fallback 섹션 정의 (generate API와 동일)
// =====================================================
const DEFAULT_SECTIONS: SectionDefinition[] = [
  { key: 'summary', title: '1. 사업 개요', subtitle: 'Executive Summary', required: true, max_chars: 2500, order: 1, description: '사업 아이디어 요약, 핵심 가치 제안, 목표 시장' },
  { key: 'company', title: '2. 회사 및 팀 소개', subtitle: 'Company & Team', required: true, max_chars: 3000, order: 2, description: '회사 현황, 대표자 역량, 핵심 인력 구성' },
  { key: 'product', title: '3. 제품/서비스', subtitle: 'Product & Service', required: true, max_chars: 3500, order: 3, description: '제품/서비스 소개, 핵심 기술, 차별화 포인트' },
  { key: 'market', title: '4. 시장 분석', subtitle: 'Market Analysis', required: true, max_chars: 3000, order: 4, description: '목표 시장 규모, 경쟁 현황, 시장 진입 전략' },
  { key: 'business_model', title: '5. 비즈니스 모델', subtitle: 'Business Model', required: true, max_chars: 2500, order: 5, description: '수익 모델, 가격 전략, 고객 획득 전략' },
  { key: 'strategy', title: '6. 사업화 전략', subtitle: 'Go-to-Market Strategy', required: true, max_chars: 3000, order: 6, description: '마케팅/영업 전략, 추진 일정, 마일스톤' },
  { key: 'financials', title: '7. 재무 계획', subtitle: 'Financial Plan', required: true, max_chars: 2500, order: 7, description: '자금 소요, 예상 매출, 손익 계획' },
]

// =====================================================
// 회사 지식베이스 로드 함수 (generate API와 동일 - 확장됨)
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
// 템플릿 로드 함수 (generate API와 동일한 우선순위)
// =====================================================
async function loadTemplate(
  adminSupabase: any,
  programId: string,
  templateId: string | null,
  programCategory: string | null
): Promise<{ sections: SectionDefinition[], source: string }> {
  let template: any = null
  let templateSource = 'default'

  try {
    if (templateId) {
      // 1. 명시적 template_id가 있으면 해당 템플릿 사용
      const { data: t } = await adminSupabase
        .from('business_plan_templates')
        .select('*')
        .eq('id', templateId)
        .single()
      template = t
      templateSource = 'explicit_id'
    }

    if (!template) {
      // 2. 이 프로그램에 연결된 템플릿 찾기
      const { data: t } = await adminSupabase
        .from('business_plan_templates')
        .select('*')
        .eq('program_id', programId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (t) {
        template = t
        templateSource = 'program_linked'
      }
    }

    if (!template && programCategory) {
      // 3. 프로그램 카테고리에 맞는 템플릿 찾기
      const { data: t } = await adminSupabase
        .from('business_plan_templates')
        .select('*')
        .contains('target_program_types', [programCategory])
        .eq('is_active', true)
        .order('usage_count', { ascending: false })
        .limit(1)
        .single()
      if (t) {
        template = t
        templateSource = 'category_matched'
      }
    }

    if (!template) {
      // 4. 가장 많이 사용된 활성 템플릿 찾기
      const { data: t } = await adminSupabase
        .from('business_plan_templates')
        .select('*')
        .eq('is_active', true)
        .order('usage_count', { ascending: false })
        .limit(1)
        .single()
      if (t) {
        template = t
        templateSource = 'most_used'
      }
    }

    // 템플릿에서 섹션 구조 추출
    if (template) {
      const sections = template.section_structure || template.sections
      if (sections && Array.isArray(sections) && sections.length > 0) {
        console.log(`[Stream] Template loaded: ${template.name || template.template_name} (source: ${templateSource}, sections: ${sections.length})`)
        return { sections: sections as SectionDefinition[], source: templateSource }
      }
    }
  } catch (e) {
    console.log('[Stream] Template lookup failed, using defaults:', e)
  }

  console.log('[Stream] No template found, using DEFAULT_SECTIONS')
  return { sections: DEFAULT_SECTIONS, source: 'default' }
}

// =====================================================
// 컨텍스트 기반 섹션 프롬프트 생성 (generate API와 동일)
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

  // 공통 컨텍스트 (모든 섹션에 제공)
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
`

  // 동적 프롬프트 생성 - 섹션 정의 기반
  const sectionTitle = sectionDef.title
  const sectionDescription = sectionDef.description || ''

  // 섹션 유형 자동 감지 (제목/설명에서 키워드 추출)
  const titleLower = sectionTitle.toLowerCase()
  const descLower = sectionDescription.toLowerCase()
  const combined = `${titleLower} ${descLower}`

  // 관련 데이터 영역 판별
  let relevantDataHints: string[] = []

  if (combined.includes('대표자') || combined.includes('ceo') || combined.includes('역량')) {
    relevantDataHints.push('팀 구성에서 대표자 정보를 참조하세요.')
  }
  if (combined.includes('팀') || combined.includes('인력') || combined.includes('조직')) {
    relevantDataHints.push('팀 구성 데이터를 적극 활용하세요.')
  }
  if (combined.includes('시장') || combined.includes('market')) {
    relevantDataHints.push('시장 분석 데이터(TAM/SAM/SOM)를 활용하세요.')
  }
  if (combined.includes('재무') || combined.includes('사업비') || combined.includes('budget') || combined.includes('자금')) {
    relevantDataHints.push('재무 현황 데이터를 참조하세요.')
  }
  if (combined.includes('기술') || combined.includes('아이템') || combined.includes('제품') || combined.includes('서비스')) {
    relevantDataHints.push('제품/서비스 데이터를 중심으로 작성하세요.')
  }
  if (combined.includes('경쟁') || combined.includes('차별')) {
    relevantDataHints.push('경쟁사 분석 및 차별화 포인트를 강조하세요.')
  }
  if (combined.includes('성과') || combined.includes('실적') || combined.includes('수상')) {
    relevantDataHints.push('주요 성과 데이터를 활용하세요.')
  }
  if (combined.includes('투자') || combined.includes('exit') || combined.includes('출구')) {
    relevantDataHints.push('투자 유치 현황 및 계획을 중심으로 작성하세요.')
  }
  if (combined.includes('일정') || combined.includes('추진') || combined.includes('로드맵') || combined.includes('timeline')) {
    relevantDataHints.push('구체적인 일정과 마일스톤을 포함하세요.')
  }
  if (combined.includes('협력') || combined.includes('파트너')) {
    relevantDataHints.push('협력사/파트너 정보를 활용하세요.')
  }
  if (combined.includes('해외') || combined.includes('글로벌') || combined.includes('global')) {
    relevantDataHints.push('해외 시장 진출 관련 데이터를 포함하세요.')
  }
  if (combined.includes('bm') || combined.includes('비즈니스 모델') || combined.includes('수익')) {
    relevantDataHints.push('수익 모델과 가격 전략을 명확히 설명하세요.')
  }

  const dataHintsText = relevantDataHints.length > 0
    ? `\n\n## 데이터 활용 가이드\n${relevantDataHints.map(h => `- ${h}`).join('\n')}`
    : ''

  // 표 템플릿이 있으면 포함
  const tableTemplateText = sectionDef.table_template
    ? `\n\n## 표 양식 (반드시 아래 표 형식을 사용하세요)\n${sectionDef.table_template}`
    : ''

  // 최종 프롬프트 생성 (동적)
  return `${baseContext}

=== 작성할 섹션 ===
## ${sectionTitle}
${sectionDescription}
${tableTemplateText}

=== 작성 요건 ===
- 최대 ${sectionDef.max_chars}자 이내
- 마크다운 형식으로 작성
- 표, 리스트 등 적절히 활용
- **표 양식이 있는 경우 반드시 해당 양식대로 표를 작성**
${dataHintsText}

=== 지시사항 ===
위 회사 지식베이스를 기반으로 **${sectionTitle}** 섹션을 작성해주세요.

1. 섹션 설명에 맞는 내용을 구체적으로 작성
2. 지식베이스에 있는 실제 데이터만 사용
3. 데이터가 없는 항목은 "[데이터 필요: 항목명]"으로 표시
4. 프로그램의 평가 기준을 고려하여 작성
5. 정량적 수치가 있으면 적극 활용
6. **표 양식이 제공된 경우 해당 형식대로 마크다운 표를 작성** (표 헤더와 구조 유지)

⚠️ 추측이나 허위 내용 작성 금지. 실제 데이터만 사용하세요.`
}

// =====================================================
// SSE 스트리밍 POST 핸들러
// =====================================================
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

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
          send({ type: 'error', message: 'Unauthorized' })
          controller.close()
          return
        }

        const body = await request.json()
        const { program_id, template_id } = body

        if (!program_id) {
          send({ type: 'error', message: 'program_id가 필요합니다.' })
          controller.close()
          return
        }

        // 프로그램 정보 로드
        const { data: program, error: programError } = await adminSupabase
          .from('government_programs')
          .select('*')
          .eq('id', program_id)
          .single()

        if (programError || !program) {
          send({ type: 'error', message: '지원사업을 찾을 수 없습니다.' })
          controller.close()
          return
        }

        send({ type: 'start', program: { id: program.id, title: program.title, organization: program.organization } })

        // 회사 컨텍스트 로드 (확장된 버전)
        send({ type: 'status', message: '회사 정보 로딩 중...' })
        const companyContext = await loadCompanyContext(adminSupabase, user.id)
        send({ type: 'status', message: '회사 정보 로드 완료' })

        // 프로그램 요구사항 로드
        send({ type: 'status', message: '프로그램 요구사항 분석 중...' })
        const programRequirements = await loadProgramRequirements(adminSupabase, program_id)
        send({ type: 'status', message: programRequirements ? '평가 기준 적용됨' : '기본 양식 사용' })

        // 템플릿 로드 (우선순위 기반)
        send({ type: 'status', message: '템플릿 로딩 중...' })
        const { sections: templateSections, source: templateSource } = await loadTemplate(
          adminSupabase,
          program_id,
          template_id || null,
          program.category
        )
        send({
          type: 'template_loaded',
          template_source: templateSource,
          section_count: templateSections.length,
          message: `템플릿 로드 완료 (${templateSource})`
        })

        // 사업계획서 레코드 생성
        const { data: businessPlan, error: planError } = await adminSupabase
          .from('business_plans')
          .insert({
            user_id: user.id,
            program_id: program_id,
            company_id: companyContext.profile?.company_id || null,
            title: `${program.title} - 사업계획서`,
            status: 'generating',
            ai_model: 'gemini-2.5-flash',
            sections: {},
            web_search_results: {
              knowledge_base_used: true,
              template_source: templateSource
            }
          })
          .select()
          .single()

        if (planError) {
          send({ type: 'error', message: '사업계획서 생성 실패' })
          controller.close()
          return
        }

        send({ type: 'plan_created', business_plan_id: businessPlan.id })

        const sections: Record<string, any> = {}
        const model = getGeminiModel()
        const totalSections = templateSections.length

        // 각 섹션별 스트리밍 생성
        for (let i = 0; i < templateSections.length; i++) {
          const sectionDef = templateSections[i]

          send({
            type: 'section_start',
            section_key: sectionDef.key,
            section_title: sectionDef.title,
            section_index: i + 1,
            total_sections: totalSections,
            progress: Math.round(((i) / totalSections) * 100)
          })

          // 지식베이스 기반 프롬프트 생성 (generate API와 동일)
          const sectionPrompt = buildSectionPrompt(
            sectionDef.key,
            companyContext,
            program,
            programRequirements,
            sectionDef
          )

          const fullPrompt = `${BUSINESS_PLAN_SYSTEM_PROMPT}\n\n${sectionPrompt}`

          try {
            // 스트리밍으로 생성
            const result = await model.generateContentStream(fullPrompt)
            let fullContent = ''

            for await (const chunk of result.stream) {
              const text = chunk.text()
              if (text) {
                fullContent += text
                send({
                  type: 'section_chunk',
                  section_key: sectionDef.key,
                  chunk: text,
                  full_content: fullContent
                })
              }
            }

            // 데이터 부족 경고 추출
            const dataNeededMatches = fullContent.match(/\[.*?필요\]/g) || []
            const dataNeededWarnings = [...new Set(dataNeededMatches)]

            sections[sectionDef.key] = {
              content: fullContent,
              title: sectionDef.title,
              order: sectionDef.order,
              generated_at: new Date().toISOString(),
              char_count: fullContent.length,
              data_warnings: dataNeededWarnings.length > 0 ? dataNeededWarnings : undefined,
              knowledge_base_used: true
            }

            send({
              type: 'section_complete',
              section_key: sectionDef.key,
              section_title: sectionDef.title,
              content: fullContent,
              char_count: fullContent.length,
              progress: Math.round(((i + 1) / totalSections) * 100),
              data_warnings: dataNeededWarnings.length > 0 ? dataNeededWarnings : undefined
            })

          } catch (error: any) {
            console.error(`[Stream] Section ${sectionDef.key} error:`, error)
            sections[sectionDef.key] = {
              content: `[생성 실패: ${error.message}]`,
              title: sectionDef.title,
              order: sectionDef.order,
              error: error.message
            }
            send({
              type: 'section_error',
              section_key: sectionDef.key,
              error: error.message
            })
          }
        }

        // DB 업데이트
        await adminSupabase
          .from('business_plans')
          .update({
            sections,
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', businessPlan.id)

        send({
          type: 'complete',
          business_plan_id: businessPlan.id,
          sections,
          total_sections: Object.keys(sections).length,
          template_source: templateSource,
          knowledge_base_info: {
            team_count: companyContext.team_members.length,
            product_count: companyContext.products.length,
            achievement_count: companyContext.achievements.length,
            has_financials: companyContext.financials.length > 0,
            has_market_data: !!companyContext.market_data
          }
        })

        controller.close()

      } catch (error: any) {
        console.error('[Stream] Error:', error)
        send({ type: 'error', message: error.message || '생성 중 오류 발생' })
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
