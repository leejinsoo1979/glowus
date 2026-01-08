/**
 * DIPS 사업계획서 전체 섹션 AI 생성
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)

const PLAN_ID = 'cb2b2230-3495-4616-b330-f5a3a37e4b2a'

async function generateSectionContent(
  section: any,
  company: any,
  program: any
): Promise<string> {
  const prompt = `당신은 정부지원사업 사업계획서 전문 작성자입니다.

다음 정보를 바탕으로 "${section.title}" 섹션을 작성해주세요.

[공고 정보]
- 사업명: ${program?.title || '2026년 초격차 스타트업 프로젝트(DIPS)'}
- 주관기관: ${program?.organization || '중소벤처기업부'}
- 정부지원금: 2억원
- 자기부담금: 0.88억원 (30% 이상)

[작성 가이드라인]
${section.guidelines || '구체적이고 명확하게 작성'}

[회사 정보]
- 회사명: ${company?.company_name || company?.main_products || '유에이블 코퍼레이션'}
- 업종: ${company?.industry_category || '정보통신업'} / ${company?.industry_subcategory || '응용소프트웨어개발'}
- 사업 내용: ${company?.business_description || 'AI 기반 업무 자동화 솔루션 개발'}
- 주요 제품: ${company?.main_products || 'GlowUS - AI Agent OS'}
- 핵심 기술: ${company?.core_technologies || '멀티에이전트, 워크플로우 자동화, RAG/지식베이스, LLM'}
- 대표자: ${company?.ceo_name || '이진수'}
- 직원 수: ${company?.employee_count || 3}명
- 사업 년차: ${company?.business_years || 5}년
- 기술 인증: ${company?.tech_certifications?.join(', ') || '벤처기업, 특허보유'}
- 연 매출: ${company?.annual_revenue ? (company.annual_revenue / 100000000).toFixed(1) + '억원' : '3억원'}
- 지역: ${company?.region || '경기'} ${company?.city || '고양시'}

[섹션별 세부 지침]
${getSectionSpecificGuidelines(section.section_id, section.title)}

[섹션 세부 항목]
${section.subsections?.map((s: any) => `- ${s.title}: ${s.description || ''}`).join('\n') || '없음'}

[작성 요령]
1. 구체적인 수치와 데이터를 활용하세요
2. 평가위원 관점에서 설득력 있게 작성하세요
3. DIPS 평가 기준(기술성, 시장성, 사업성)에 맞게 작성하세요
4. 전문적이고 객관적인 문체를 사용하세요
5. 핵심 내용을 먼저 제시하고 상세 설명을 추가하세요

섹션 내용만 작성해주세요 (제목 제외):`

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  return result.response.text() || ''
}

function getSectionSpecificGuidelines(sectionId: string, title: string): string {
  const guidelines: Record<string, string> = {
    '1': `[신청현황]
- 정부지원사업비 2억원 기준으로 작성
- 자기부담사업비 0.88억원(30% 이상) 포함
- 총 사업비 구성과 비율 명시
- 현재 고용현황, 매출현황, 누적투자금액 포함`,

    '2': `[신청 분야]
- AI 분야 선택 (인공지능산업융합사업단 주관)
- 신산업 분야 중 해당 분야 명시
- 기술 분야와 사업 내용의 연관성 설명`,

    '3': `[기업 일반현황]
- 대표자 정보 (경력, 학력 등 - 개인정보 마스킹)
- 기업 기본정보 (설립일, 업종, 소재지)
- 조직 현황 (임직원 수, 주요 인력)
- 주요 사업 실적`,

    '4': `[창업아이템 개요]
- 아이템명과 핵심 가치 명확히 제시
- 해결하고자 하는 문제(Pain Point) 설명
- 솔루션의 핵심 기능과 차별점
- 기대 효과 및 시장 영향력`,

    '5': `[기술성]
- 핵심 기술 상세 설명 (AI, LLM, RAG 등)
- 기술 개발 현황 및 완성도
- 기술 차별성 및 진입장벽
- 지식재산권 현황 (특허, 저작권 등)
- 기술 로드맵`,

    '6': `[시장성]
- 목표시장 정의 (TAM, SAM, SOM)
- 시장규모 및 성장률 (구체적 수치)
- 경쟁사 분석 및 포지셔닝
- 시장 진입 전략
- 고객 세그먼트 및 타겟`,

    '7': `[사업성]
- 비즈니스 모델 (수익 구조)
- 가격 정책 및 수익 전망
- 마케팅/영업 전략
- 파트너십 및 협력 전략
- 3개년 매출 계획`,

    '8': `[대표자 및 팀 역량]
- 대표자 관련 경력 및 전문성
- 핵심 인력 구성 및 역량
- 조직 구조 및 역할 분담
- 자문단/멘토 네트워크`,

    '9': `[사업비 계획]
- 정부지원금 2억원 세부 항목별 배분
- 자기부담금 0.88억원 조달 계획
- 비목별 사용 계획 (인건비, 재료비, 위탁비 등)
- 연차별 예산 배분`,

    '10': `[추진일정]
- 분기별/월별 마일스톤
- 단계별 목표 및 성과지표
- 주요 일정 및 산출물
- 위험 요소 및 대응 방안`
  }

  return guidelines[sectionId] || ''
}

async function main() {
  console.log('=== DIPS 사업계획서 전체 섹션 AI 생성 ===\n')

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

  // 2. 회사 정보 조회
  const { data: company } = await supabase
    .from('company_support_profiles')
    .select('*')
    .eq('company_id', plan.company_id)
    .single()

  console.log(`🏢 회사: ${company?.company_name || company?.main_products || '유에이블'}`)

  // 3. 전체 섹션 생성
  const sections = plan.sections || []
  let totalTokens = 0
  let generatedCount = 0

  console.log(`\n총 ${sections.length}개 섹션 생성 시작...\n`)

  const updatedSections = []

  for (const section of sections) {
    // 이미 생성된 섹션은 스킵
    if (section.status === 'generated' && section.content?.length > 100) {
      console.log(`⏭️  [${section.section_id}] ${section.title} - 이미 생성됨 (${section.content.length}자)`)
      updatedSections.push(section)
      generatedCount++
      continue
    }

    console.log(`\n🔄 [${section.section_id}] ${section.title} 생성 중...`)

    try {
      const startTime = Date.now()
      const content = await generateSectionContent(section, company, plan.program)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

      console.log(`   ✅ 완료! ${content.length}자 (${elapsed}초)`)
      console.log(`   미리보기: ${content.substring(0, 80).replace(/\n/g, ' ')}...`)

      updatedSections.push({
        ...section,
        content: content,
        status: 'generated',
        char_count: content.length,
        ai_generated: true,
        generated_at: new Date().toISOString()
      })

      generatedCount++
      totalTokens += Math.ceil(content.length / 4) // 대략적 토큰 추정

    } catch (error: any) {
      console.log(`   ❌ 실패: ${error.message}`)
      updatedSections.push(section)
    }

    // API 속도 제한 방지
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  // 4. DB 업데이트
  console.log('\n--- 전체 섹션 DB 저장 ---\n')

  const totalChars = updatedSections.reduce((sum, s) => sum + (s.char_count || 0), 0)
  const completedCount = updatedSections.filter(s => s.status === 'generated').length
  const completionPercentage = Math.round((completedCount / sections.length) * 100)

  const { error: updateError } = await supabase
    .from('business_plans')
    .update({
      sections: updatedSections,
      pipeline_status: completionPercentage === 100 ? 'completed' : 'generating',
      completion_percentage: completionPercentage,
      total_tokens_used: (plan.total_tokens_used || 0) + totalTokens
    })
    .eq('id', PLAN_ID)

  if (updateError) {
    console.error('DB 업데이트 실패:', updateError)
  } else {
    console.log('✅ DB 저장 완료!')
  }

  // 5. 결과 요약
  console.log('\n=== 생성 결과 요약 ===\n')
  console.log(`📊 총 섹션: ${sections.length}개`)
  console.log(`✅ 생성 완료: ${generatedCount}개`)
  console.log(`📝 총 글자 수: ${totalChars.toLocaleString()}자`)
  console.log(`🎯 완성도: ${completionPercentage}%`)

  console.log('\n--- 섹션별 현황 ---\n')
  for (const s of updatedSections) {
    const status = s.status === 'generated' ? '✅' : '⏳'
    console.log(`${status} [${s.section_id}] ${s.title}: ${s.char_count || 0}자`)
  }

  console.log('\n=== 완료 ===')
}

main().catch(console.error)
