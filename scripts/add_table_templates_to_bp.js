const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: process.cwd() + '/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 표 템플릿 매핑
const TABLE_TEMPLATES = {
  '1-1': `| 구분 | 내용 |
|------|------|
| 성명 | |
| 학력 | |
| 경력 | |
| 창업경험 | |
| 보유역량 | |`,

  '1-2': `**[재직 인력 현황]**
| 순번 | 성명 | 직위 | 담당업무 | 입사일 | 고용형태 |
|------|------|------|----------|--------|----------|
| 1 | | | | | 정규직/계약직 |
| 2 | | | | | |

**[추가 고용 계획]**
| 순번 | 직위 | 담당업무 | 채용시기 | 고용형태 |
|------|------|----------|----------|----------|
| 1 | | | | |`,

  '2-2': `**[경쟁사 대비 차별점]**
| 구분 | 자사 | 경쟁사A | 경쟁사B |
|------|------|---------|---------|
| 핵심기술 | | | |
| 가격경쟁력 | | | |
| 차별화요소 | | | |`,

  '2-3': `**[수익 모델]**
| 수익원 | 내용 | 예상 매출비중 |
|--------|------|--------------|
| | | |

**[가격 전략]**
| 제품/서비스 | 단가 | 경쟁사 대비 |
|-------------|------|-------------|
| | | |`,

  '2-4': `**[기술 고도화 계획]**
| 순번 | 개선과제 | 현재수준 | 목표수준 | 완료시기 |
|------|----------|----------|----------|----------|
| 1 | | | | |
| 2 | | | | |`,

  '3-1-1': `| 순번 | 유통 채널명 | 판매 내용 | 진출 시기 | 판매 금액 |
|------|-------------|-----------|-----------|-----------|
| 1 | | | | 백만원 |
| 2 | | | | 백만원 |
| 3 | | | | 백만원 |`,

  '3-2-1': `| 목표국가 | 시장규모 | 성장률 | 진출전략 |
|----------|----------|--------|----------|
| | | | |`,

  '3-2-2': `| 순번 | 국가명 | 유통 채널명 | 판매 내용 | 진출 시기 | 판매 금액 |
|------|--------|-------------|-----------|-----------|-----------|
| 1 | | | | | 백만원 |
| 2 | | | | | 백만원 |`,

  '3-3-1': `| 구분 | 1년차 | 2년차 | 3년차 |
|------|-------|-------|-------|
| 제품개발 | | | |
| 시장진출 | | | |
| 매출목표 | | | |
| 인력확충 | | | |`,

  '3-4': `**[사업비 집행계획]** (단위: 백만원)
| 비목 | 정부지원금 | 자기부담금 | 합계 | 비고 |
|------|------------|------------|------|------|
| 인건비 | | | | |
| 재료비 | | | | |
| 외주용역비 | | | | |
| 기자재구입비 | | | | |
| 마케팅비 | | | | |
| **합계** | | | | |

※ 정부지원사업비는 총 사업비의 70% 미만, 자기부담사업비는 30% 초과`,

  '4-1-1': `| 순번 | 협력기업명 | 협력내용 | 협력기간 | 협력성과 |
|------|------------|----------|----------|----------|
| 1 | | | | |
| 2 | | | | |`,

  '5-1-1': `| 순번 | 투자일 | 투자사 | 투자형태 | 투자금액 | 비고 |
|------|--------|--------|----------|----------|------|
| 1 | | | Seed/Pre-A/Series A 등 | 억원 | |
| 2 | | | | | |
| **합계** | | | | 억원 | |`,

  '5-1-2': `| 목표시기 | 투자형태 | 목표금액 | 용도 |
|----------|----------|----------|------|
| | | 억원 | |`
}

async function main() {
  console.log('=== 기존 사업계획서에 표 템플릿 추가 ===\n')

  // DIPS 프로그램 ID들
  const dipsTemplates = await supabase
    .from('business_plan_templates')
    .select('program_id')
    .or('name.ilike.%DIPS%,name.ilike.%초격차%')

  const dipsProgramIds = dipsTemplates.data?.map(t => t.program_id).filter(Boolean) || []

  // 해당 프로그램의 사업계획서들 찾기
  const { data: plans, error } = await supabase
    .from('business_plans')
    .select('id, title, sections')
    .in('program_id', dipsProgramIds)

  if (error) {
    console.log('Error:', error.message)
    return
  }

  console.log('Found business plans:', plans?.length || 0)

  for (const plan of plans || []) {
    const sections = plan.sections || {}
    let updated = false

    for (const key of Object.keys(sections)) {
      if (TABLE_TEMPLATES[key] && !sections[key].table_template) {
        sections[key].table_template = TABLE_TEMPLATES[key]
        updated = true
      }
    }

    if (updated) {
      const { error: updateError } = await supabase
        .from('business_plans')
        .update({ sections })
        .eq('id', plan.id)

      if (updateError) {
        console.log('  ✗ Error updating', plan.id, updateError.message)
      } else {
        console.log('  ✓ Updated:', plan.title?.substring(0, 40))
      }
    }
  }

  console.log('\n=== 완료 ===')
}

main()
