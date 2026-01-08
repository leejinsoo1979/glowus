/**
 * DIPS 사업계획서 섹션 AI 생성 테스트
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)

// 테스트할 사업계획서 ID
const PLAN_ID = 'cb2b2230-3495-4616-b330-f5a3a37e4b2a'

// 테스트할 섹션 번호 (1개만 테스트)
const TEST_SECTION_ID = '4' // 창업아이템 개요

async function main() {
  console.log('=== DIPS 사업계획서 섹션 AI 생성 테스트 ===\n')

  // 1. 사업계획서 조회
  const { data: plan, error: planError } = await supabase
    .from('business_plans')
    .select('*, program:government_programs(title, organization)')
    .eq('id', PLAN_ID)
    .single()

  if (planError || !plan) {
    console.error('사업계획서 조회 실패:', planError)
    return
  }

  console.log(`📄 사업계획서: ${plan.title}`)
  console.log(`   프로그램: ${plan.program?.title || '프로그램 정보 없음'}`)

  // 2. 회사 정보 조회
  const { data: company } = await supabase
    .from('company_support_profiles')
    .select('*')
    .eq('company_id', plan.company_id)
    .single()

  console.log(`\n🏢 회사 정보:`)
  console.log(`   이름: ${company?.company_name || company?.main_products || '없음'}`)
  console.log(`   업종: ${company?.industry_category || '없음'}`)
  console.log(`   사업 내용: ${company?.business_description?.substring(0, 100) || '없음'}...`)
  console.log(`   핵심 기술: ${company?.core_technologies || '없음'}`)
  console.log(`   대표자: ${company?.ceo_name || '없음'}`)

  // 3. 테스트 섹션 찾기
  const sections = plan.sections || []
  const targetSection = sections.find((s: any) => s.section_id === TEST_SECTION_ID)

  if (!targetSection) {
    console.error(`섹션 ${TEST_SECTION_ID}을 찾을 수 없습니다`)
    return
  }

  console.log(`\n📝 테스트 섹션: ${targetSection.section_id}. ${targetSection.title}`)
  console.log(`   가이드라인: ${targetSection.guidelines}`)

  // 4. AI 콘텐츠 생성
  console.log('\n--- AI 콘텐츠 생성 시작 ---\n')

  const prompt = `당신은 정부지원사업 사업계획서 전문 작성자입니다.

다음 정보를 바탕으로 "${targetSection.title}" 섹션을 작성해주세요.

[공고 정보]
- 사업명: ${plan.program?.title || '2026년 초격차 스타트업 프로젝트(DIPS)'}
- 주관기관: ${plan.program?.organization || '중소벤처기업부'}
- 정부지원금: 2억원
- 자기부담금: 0.88억원 (30% 이상)

[작성 가이드라인]
${targetSection.guidelines || '구체적이고 명확하게 작성'}

[회사 정보]
- 회사명: ${company?.company_name || company?.main_products || 'AI테크솔루션'}
- 업종: ${company?.industry_category || '정보통신업'}
- 사업 내용: ${company?.business_description || 'AI 기반 솔루션 개발'}
- 주요 제품: ${company?.main_products || 'AI 플랫폼'}
- 핵심 기술: ${company?.core_technologies || 'AI, LLM, RAG'}
- 대표자: ${company?.ceo_name || '홍길동'}
- 직원 수: ${company?.employee_count || 5}명
- 설립년도: ${company?.business_years || 2}년차

[섹션 세부 항목]
${targetSection.subsections?.map((s: any) => `- ${s.title}: ${s.description || ''}`).join('\n') || '없음'}

[작성 요령]
1. 구체적인 수치와 데이터를 활용하세요
2. 평가위원 관점에서 설득력 있게 작성하세요
3. 정부지원사업 평가 기준에 맞게 작성하세요
4. 전문적이고 객관적인 문체를 사용하세요
5. 핵심 내용을 먼저 제시하고 상세 설명을 추가하세요

섹션 내용만 작성해주세요 (제목 제외):`

  console.log('프롬프트 길이:', prompt.length, '자')

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const content = result.response.text() || ''

    console.log(`✅ 생성 완료! (Gemini 2.5 Flash)\n`)
    console.log('=== 생성된 콘텐츠 ===\n')
    console.log(content)
    console.log('\n=== 콘텐츠 끝 ===')
    console.log(`\n📊 콘텐츠 길이: ${content.length}자`)

    // 5. 섹션 업데이트
    console.log('\n--- 섹션 업데이트 ---\n')

    const updatedSections = sections.map((s: any) => {
      if (s.section_id === TEST_SECTION_ID) {
        return {
          ...s,
          content: content,
          status: 'generated',
          char_count: content.length,
          ai_generated: true,
          generated_at: new Date().toISOString()
        }
      }
      return s
    })

    const { error: updateError } = await supabase
      .from('business_plans')
      .update({
        sections: updatedSections,
        pipeline_status: 'generating',
        completion_percentage: 10,
        total_tokens_used: 0
      })
      .eq('id', PLAN_ID)

    if (updateError) {
      console.error('섹션 업데이트 실패:', updateError)
    } else {
      console.log(`✅ 섹션 ${TEST_SECTION_ID}. ${targetSection.title} 업데이트 완료!`)
    }

    // 6. 결과 확인
    const { data: updatedPlan } = await supabase
      .from('business_plans')
      .select('sections')
      .eq('id', PLAN_ID)
      .single()

    const updatedSection = updatedPlan?.sections?.find((s: any) => s.section_id === TEST_SECTION_ID)
    console.log(`\n📝 저장된 섹션 상태: ${updatedSection?.status}`)
    console.log(`   콘텐츠 길이: ${updatedSection?.content?.length || 0}자`)

  } catch (aiError) {
    console.error('AI 생성 실패:', aiError)
  }

  console.log('\n=== 테스트 완료 ===')
}

main().catch(console.error)
