/**
 * DIPS 사업계획서 양식에서 AI 구조 추출 테스트
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// DIPS 사업계획서 양식 PrvText (실제 파싱 결과)
const dipsPrvText = `2026년 초격차 스타트업 프로젝트 창업기업 사업계획서 (DIPS)


※ 사업계획서 양식은 변경‧삭제 불가하며, 추가설명을 위한 이미지(사진), 표 등은 삽입 가능(표 안의 행은 추가 가능하며, 해당 없을 시 공란을 유지) ※ 본문 내 '파란색으로 기재된 안내문구'는 삭제하고 검정색 글씨로 내용을 작성하여 제출 ※ 사업계획서는 30페이지 이내로 작성(증빙서류는 제한 없음) ※ 대표자·직원 성명, 성별, 생년월일, 대학교(원)명 및 소재지, 직장명 등의 개인정보(또는 유추 가능한 정보)는 반드시 제외하거나 '○', '*' 등으로 마스킹하여 작성  ※ 일반현황 표는 미해당[학력] (전문)학·석·박사, 학과·전공 등, [직장] 직업, 주요 수행업무 등만 작성 가능


□ 신청현황

※ 정부지원사업비는 총 사업비의 70% 미만 자기부담사업비(현금 또는 현물)은 30% 이상으로 작성 ※ 정부지원사업비는 평가결과에 따라 신청금액 대비 감액될 수 있으나, 신청금액을 초과하여 지급될 수 없으므로 최초 신청 시, 정부지원사업비 2억원, 자기부담사업비 0.88억원 기준으로 작성 ※ [고용] '25년 12월 31일 기준 총 임직원 수(대표자 제외), [매출] '25년 12월 31일 기준 국내+해외 매출 총액[누적투자] 설립일로부터 신청일(현재)까지의 누적 투자유치액


신청 분야(택 1)


전략 분야

신산업 분야

주관기관

신청


①

AI

AI

인공지능산업융합사업단
<>
반도체

서울대학교 산학협력단
<>
양자

한국과학기술연구원
<>
보안·네트워크

한국방송통신전파진흥원
<>
로보틱스

한국과학기술원
<>
모빌리티

한국전자기술연구원
<>

②

바이오

생명·신약

국가독성과학연구소
<>
헬스케어

성균관대학교 BTS 센터
<>`

async function main() {
  console.log('=== DIPS 사업계획서 양식 AI 구조 추출 테스트 ===\n')

  console.log('PrvText 길이:', dipsPrvText.length, '자')
  console.log('\n--- AI 구조 추출 시작 ---\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    max_tokens: 4096,
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content: `당신은 정부지원사업 사업계획서 양식 분석 전문가입니다.
사업계획서 양식 문서에서 작성해야 할 항목들을 구조화된 형태로 추출합니다.

중요 규칙:
1. 공고문 요약이 아니라, 신청자가 작성해야 하는 사업계획서 항목을 추출
2. 각 섹션의 제목, 작성 가이드, 글자 수 제한 등을 정확히 파악
3. 평가항목과 배점도 추출
4. 문서에 명시적으로 없어도, 해당 사업의 표준 양식 구조를 참고하여 보완

이 문서는 DIPS(초격차 스타트업 프로젝트) 사업계획서입니다.
DIPS 사업계획서의 표준 구조:
1. 신청현황 (정부지원사업비 2억원, 자기부담사업비 0.88억원+)
2. 신청 분야 (AI/반도체/양자/보안·네트워크/로보틱스/모빌리티/바이오/콘텐츠/방위/에너지)
3. 기업 일반현황 (대표자 정보, 기업 정보)
4. 창업아이템 개요 (아이템명, 핵심 내용)
5. 기술성 (핵심기술, 기술개발 내용, 기술 차별성, 지식재산권)
6. 시장성 (목표시장, 시장규모, 경쟁사 분석, 시장 진입 전략)
7. 사업성 (비즈니스 모델, 수익구조, 마케팅 전략)
8. 대표자 및 팀 역량 (경력, 전문성, 핵심인력)
9. 사업비 계획 (정부지원금 + 자기부담금 상세 내역)
10. 추진일정 (분기별/월별 마일스톤)

이 표준 구조를 기반으로 문서의 실제 내용을 분석하세요.`
      },
      {
        role: 'user',
        content: `다음은 "2026년 초격차 스타트업 프로젝트(DIPS) 창업기업" 사업의 사업계획서 양식입니다.

이 문서에서 사업계획서 작성 항목들을 추출해주세요.
문서에 일부 내용만 있더라도, 해당 사업의 표준 양식 구조를 참고하여 완전한 구조를 제공하세요.

문서 내용:
${dipsPrvText}

다음 JSON 형식으로 응답해주세요:
{
  "sections": [
    {
      "section_id": "1",
      "title": "섹션 제목",
      "required": true,
      "max_chars": 3000,
      "guidelines": "작성 가이드라인 또는 유의사항",
      "order": 1,
      "evaluation_weight": 20,
      "subsections": [
        {"id": "1-1", "title": "세부항목", "description": "작성 내용 설명"}
      ]
    }
  ],
  "evaluation_criteria": [
    {"category": "평가항목", "weight": 30, "description": "평가 기준"}
  ],
  "writing_guidelines": ["작성 시 유의사항1", "유의사항2"],
  "total_pages": 30,
  "funding_info": {
    "government_support": "2억원",
    "self_funding": "0.88억원 (30% 이상)"
  }
}`
      }
    ]
  })

  const content = response.choices[0]?.message?.content || ''

  console.log('AI 응답:')
  console.log(content)

  // JSON 파싱 시도
  let jsonStr = content.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '')
  }

  try {
    const structure = JSON.parse(jsonStr)
    console.log('\n\n=== 파싱된 구조 ===\n')
    console.log(`섹션 수: ${structure.sections?.length}`)
    console.log(`페이지 제한: ${structure.total_pages}`)
    console.log(`정부지원금: ${structure.funding_info?.government_support}`)
    console.log(`자기부담금: ${structure.funding_info?.self_funding}`)

    console.log('\n섹션 목록:')
    for (const section of structure.sections || []) {
      console.log(`  ${section.section_id}. ${section.title} (배점: ${section.evaluation_weight}%)`)
      console.log(`     가이드: ${section.guidelines?.substring(0, 50)}...`)
      if (section.subsections) {
        for (const sub of section.subsections) {
          console.log(`      - ${sub.title}`)
        }
      }
    }

    if (structure.evaluation_criteria?.length) {
      console.log('\n평가 기준:')
      for (const criterion of structure.evaluation_criteria) {
        console.log(`  - ${criterion.category}: ${criterion.weight}%`)
      }
    }

    if (structure.writing_guidelines?.length) {
      console.log('\n작성 가이드라인:')
      for (const guideline of structure.writing_guidelines) {
        console.log(`  - ${guideline.substring(0, 60)}...`)
      }
    }
  } catch (e) {
    console.error('\nJSON 파싱 실패:', e)
  }
}

main().catch(console.error)
