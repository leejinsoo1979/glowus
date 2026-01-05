// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// PDF 텍스트 추출 (동적 로드)
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // pdf-parse는 Next.js App Router와 호환성 문제가 있어 동적 로드
    const pdfParse = await import('pdf-parse').then(m => m.default || m)
    const data = await pdfParse(buffer)
    return data.text
  } catch (e) {
    console.error('PDF parse error:', e)
    // 폴백: 바이너리에서 텍스트 추출 시도
    return buffer.toString('utf-8').replace(/[^\x20-\x7E\uAC00-\uD7AF\s]/g, ' ')
  }
}

const KNOWLEDGE_EXTRACTOR_PROMPT = `당신은 기업 정보 추출 전문가입니다.
주어진 문서(사업계획서, 회사소개서, IR자료 등)에서 다음 정보를 최대한 상세하게 추출하여 JSON 형식으로 반환하세요.

## 추출 항목

1. **company_profile** (회사 기본 정보):
   - company_name: 회사명
   - business_description: 사업 설명 (최대한 상세하게, 500자 이상)
   - main_products: 주요 제품/서비스 (상세 설명)
   - core_technologies: 핵심 기술/차별화 요소
   - business_model: 수익 모델, 비즈니스 모델
   - target_market: 타겟 시장/고객
   - competitive_advantage: 경쟁 우위, 차별화 포인트
   - vision_mission: 비전, 미션
   - industry_category: 업종 분류

2. **team_members** (팀 구성원 배열):
   - name: 이름
   - position: 직책
   - role: 역할/담당
   - bio: 경력/학력/소개 (상세하게)
   - expertise: 전문분야 배열
   - is_key_member: 핵심 인력 여부 (대표, CTO 등)

3. **products** (제품/서비스 배열):
   - name: 제품명
   - description: 제품 설명 (상세하게)
   - product_type: 유형 (product/service/solution/platform)
   - core_technology: 적용 기술
   - target_customers: 타겟 고객
   - development_stage: 개발 단계 (idea/mvp/beta/launched)
   - is_flagship: 주력 제품 여부
   - features: 주요 기능 배열
   - pricing_model: 가격 모델

4. **achievements** (성과/수상 배열):
   - achievement_type: 유형 (award/certification/patent/partnership/investment/media)
   - title: 성과명
   - issuer: 수여 기관
   - date: 날짜 (YYYY-MM-DD)
   - description: 상세 설명
   - importance_level: 중요도 (1-5)

5. **financials** (재무 정보 배열):
   - fiscal_year: 회계연도
   - revenue: 매출 (원)
   - operating_profit: 영업이익 (원)
   - net_profit: 순이익 (원)
   - employee_count: 직원수
   - investment_received: 투자유치 금액
   - investment_round: 투자 라운드 (seed/pre-a/a/b/c)

6. **market_data** (시장 분석):
   - industry_name: 산업/시장명
   - tam: 전체 시장 규모 (억원)
   - sam: 유효 시장 규모 (억원)
   - som: 목표 시장 규모 (억원)
   - market_growth_rate: 시장 성장률 (%)
   - market_trends: 시장 트렌드 배열
   - competitors: 경쟁사 배열
   - market_position: 시장 내 포지션

7. **roadmap** (로드맵/마일스톤):
   - items: 마일스톤 배열 [{date, title, description, status}]

8. **intellectual_property** (지적재산권):
   - patents: 특허 배열
   - trademarks: 상표 배열
   - copyrights: 저작권 배열

## 추출 원칙
- 문서에 명시된 정보만 추출 (추측하지 않음)
- 정보가 없으면 null 또는 빈 배열로 표시
- 숫자는 단위 변환하여 저장 (억원 → 원으로 변환)
- 날짜는 YYYY-MM-DD 형식으로
- 가능한 상세하게 추출

반드시 유효한 JSON만 출력하세요.`

/**
 * POST: 파일 업로드 → AI 분석 → 지식베이스 자동 채우기
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

    // FormData에서 파일 추출
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    let textContent = ''

    // 파일 타입별 텍스트 추출
    if (fileName.endsWith('.pdf')) {
      const buffer = Buffer.from(await file.arrayBuffer())
      textContent = await extractPdfText(buffer)
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      textContent = await file.text()
    } else if (fileName.endsWith('.pptx') || fileName.endsWith('.docx')) {
      // PPTX/DOCX는 간단히 텍스트 추출 (추후 mammoth 등 라이브러리 추가 가능)
      const buffer = Buffer.from(await file.arrayBuffer())
      // 임시: 바이너리에서 텍스트 추출 시도
      textContent = buffer.toString('utf-8').replace(/[^\x20-\x7E\uAC00-\uD7AF]/g, ' ')
    } else {
      return NextResponse.json({
        error: '지원하지 않는 파일 형식입니다. PDF, TXT, MD 파일만 지원합니다.'
      }, { status: 400 })
    }

    if (!textContent || textContent.trim().length < 100) {
      return NextResponse.json({
        error: '파일에서 충분한 텍스트를 추출할 수 없습니다.'
      }, { status: 400 })
    }

    // 텍스트가 너무 길면 자르기 (GPT-4 토큰 제한)
    const maxChars = 50000
    if (textContent.length > maxChars) {
      textContent = textContent.substring(0, maxChars)
    }

    // OpenAI로 분석
    const openai = new OpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: KNOWLEDGE_EXTRACTOR_PROMPT },
        { role: 'user', content: `다음 문서에서 기업 정보를 추출해주세요:\n\n${textContent}` }
      ]
    })

    const parsedContent = response.choices[0]?.message?.content || '{}'
    let extractedData: any

    try {
      extractedData = JSON.parse(parsedContent)
    } catch (e) {
      console.error('JSON 파싱 실패:', parsedContent)
      return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 })
    }

    // 프로필 조회
    const { data: existingProfile } = await adminSupabase
      .from('company_support_profiles')
      .select('id, company_id')
      .eq('user_id', user.id)
      .single()

    const results = {
      profile_updated: false,
      team_added: 0,
      products_added: 0,
      achievements_added: 0,
      financials_added: 0,
      market_updated: false
    }

    // 1. 프로필 업데이트
    if (extractedData.company_profile) {
      const profileUpdate: any = {}
      const cp = extractedData.company_profile

      if (cp.business_description) profileUpdate.business_description = cp.business_description
      if (cp.main_products) profileUpdate.main_products = cp.main_products
      if (cp.core_technologies) profileUpdate.core_technologies = cp.core_technologies
      if (cp.industry_category) profileUpdate.industry_category = cp.industry_category

      if (Object.keys(profileUpdate).length > 0) {
        const { error } = await adminSupabase
          .from('company_support_profiles')
          .update(profileUpdate)
          .eq('user_id', user.id)

        if (!error) results.profile_updated = true
      }
    }

    // 2. 팀 멤버 추가
    if (extractedData.team_members?.length > 0) {
      for (const member of extractedData.team_members) {
        const { error } = await adminSupabase
          .from('company_team_members')
          .insert({
            user_id: user.id,
            company_id: existingProfile?.company_id,
            name: member.name,
            position: member.position,
            role: member.role,
            bio: member.bio,
            expertise: member.expertise || [],
            is_key_member: member.is_key_member || false,
            is_active: true
          })

        if (!error) results.team_added++
      }
    }

    // 3. 제품 추가
    if (extractedData.products?.length > 0) {
      for (const product of extractedData.products) {
        const { error } = await adminSupabase
          .from('company_products')
          .insert({
            user_id: user.id,
            company_id: existingProfile?.company_id,
            name: product.name,
            description: product.description,
            product_type: product.product_type,
            core_technology: product.core_technology,
            target_customers: product.target_customers,
            development_stage: product.development_stage,
            is_flagship: product.is_flagship || false,
            features: product.features || [],
            is_active: true
          })

        if (!error) results.products_added++
      }
    }

    // 4. 성과 추가
    if (extractedData.achievements?.length > 0) {
      for (const achievement of extractedData.achievements) {
        const { error } = await adminSupabase
          .from('company_achievements')
          .insert({
            user_id: user.id,
            company_id: existingProfile?.company_id,
            achievement_type: achievement.achievement_type || 'milestone',
            title: achievement.title,
            issuer: achievement.issuer,
            date: achievement.date,
            description: achievement.description,
            importance_level: achievement.importance_level || 3
          })

        if (!error) results.achievements_added++
      }
    }

    // 5. 재무 정보 추가
    if (extractedData.financials?.length > 0) {
      for (const financial of extractedData.financials) {
        const { error } = await adminSupabase
          .from('company_financials')
          .insert({
            user_id: user.id,
            company_id: existingProfile?.company_id,
            fiscal_year: financial.fiscal_year,
            revenue: financial.revenue,
            operating_profit: financial.operating_profit,
            net_profit: financial.net_profit,
            employee_count: financial.employee_count
          })

        if (!error) results.financials_added++
      }
    }

    // 6. 시장 데이터 추가/업데이트
    if (extractedData.market_data) {
      const md = extractedData.market_data
      const { error } = await adminSupabase
        .from('company_market_data')
        .upsert({
          user_id: user.id,
          company_id: existingProfile?.company_id,
          industry_name: md.industry_name,
          tam: md.tam,
          sam: md.sam,
          som: md.som,
          market_growth_rate: md.market_growth_rate,
          market_trends: md.market_trends || [],
          competitors: md.competitors || []
        }, {
          onConflict: 'user_id'
        })

      if (!error) results.market_updated = true
    }

    return NextResponse.json({
      success: true,
      message: '파일 분석 및 지식베이스 업데이트 완료',
      results,
      extracted_data: extractedData,
      tokens_used: {
        prompt: response.usage?.prompt_tokens,
        completion: response.usage?.completion_tokens
      }
    })

  } catch (error: any) {
    console.error('[KnowledgeBase Parse] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
