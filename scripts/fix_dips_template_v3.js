const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: process.cwd() + '/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 원본 HWP 템플릿에서 추출한 DIPS 사업계획서 양식 (표 템플릿 포함)
const DIPS_SECTIONS = [
  // 1. 기업 구성
  {
    key: '1-1',
    title: '1-1. 대표자 현황 및 보유역량',
    required: true,
    max_chars: 3000,
    order: 1,
    description: '대표자가 보유하고 있는 역량(경영 능력, 경력·학력, 창업 경험 등)',
    table_template: `| 구분 | 내용 |
|------|------|
| 성명 | |
| 학력 | |
| 경력 | |
| 창업경험 | |
| 보유역량 | |`
  },
  {
    key: '1-2',
    title: '1-2. 기업 현황 및 팀 보유역량',
    required: true,
    max_chars: 4000,
    order: 2,
    description: '재직 인력 고용현황, 추가 인력 고용계획, 고용 관련 지원사업 수혜 여부, 업무파트너 현황 및 역량',
    table_template: `**[재직 인력 현황]**
| 순번 | 성명 | 직위 | 담당업무 | 입사일 | 고용형태 |
|------|------|------|----------|--------|----------|
| 1 | | | | | 정규직/계약직 |
| 2 | | | | | |

**[추가 고용 계획]**
| 순번 | 직위 | 담당업무 | 채용시기 | 고용형태 |
|------|------|----------|----------|----------|
| 1 | | | | |`
  },

  // 2. 아이템(기술) 개요
  {
    key: '2-1',
    title: '2-1. 창업아이템의 개발 동기 및 목적',
    required: true,
    max_chars: 3000,
    order: 3,
    description: '외적 동기, 내적 동기, 목적 및 기대효과'
  },
  {
    key: '2-2',
    title: '2-2. 창업아이템(제품, 서비스 혹은 기술) 차별성',
    required: true,
    max_chars: 4000,
    order: 4,
    description: '기업별 아이템을 소개하고, 경쟁사 대비 차별점을 작성',
    table_template: `**[경쟁사 대비 차별점]**
| 구분 | 자사 | 경쟁사A | 경쟁사B |
|------|------|---------|---------|
| 핵심기술 | | | |
| 가격경쟁력 | | | |
| 차별화요소 | | | |`
  },
  {
    key: '2-3',
    title: '2-3. 창업아이템 비즈니스 모델(BM)',
    required: true,
    max_chars: 3000,
    order: 5,
    description: '수익 모델, 가격 전략, 고객 획득 전략',
    table_template: `**[수익 모델]**
| 수익원 | 내용 | 예상 매출비중 |
|--------|------|--------------|
| | | |

**[가격 전략]**
| 제품/서비스 | 단가 | 경쟁사 대비 |
|-------------|------|-------------|
| | | |`
  },
  {
    key: '2-4',
    title: '2-4. 창업아이템의 개선과제 및 기술 고도화계획',
    required: true,
    max_chars: 3000,
    order: 6,
    description: '본 사업 참여를 통해 고도화하고자 하는 개선과제 및 기술 고도화계획',
    table_template: `**[기술 고도화 계획]**
| 순번 | 개선과제 | 현재수준 | 목표수준 | 완료시기 |
|------|----------|----------|----------|----------|
| 1 | | | | |
| 2 | | | | |`
  },

  // 3. 사업화 전략
  {
    key: '3-1',
    title: '3-1. 국내(내수) 시장 진출 현황 및 계획',
    required: true,
    max_chars: 2000,
    order: 7,
    description: '내수시장 진출 현황 개요'
  },
  {
    key: '3-1-1',
    title: '3-1-1. 내수시장 진출 현황',
    required: true,
    max_chars: 2000,
    order: 8,
    description: '국내 시장 진출 현황 (거래처, 아이템, 기간, 금액)',
    table_template: `| 순번 | 유통 채널명 | 판매 내용 | 진출 시기 | 판매 금액 |
|------|-------------|-----------|-----------|-----------|
| 1 | | | | 백만원 |
| 2 | | | | 백만원 |
| 3 | | | | 백만원 |`
  },
  {
    key: '3-1-2',
    title: '3-1-2. 내수시장 (추가)진출 계획',
    required: true,
    max_chars: 2000,
    order: 9,
    description: '국내 시장 추가 진출 계획'
  },
  {
    key: '3-2',
    title: '3-2. 해외시장 진출 현황 및 계획',
    required: true,
    max_chars: 2000,
    order: 10,
    description: '해외시장 진출 현황 및 계획 개요'
  },
  {
    key: '3-2-1',
    title: '3-2-1. 해외진출 목표 시장 분석',
    required: true,
    max_chars: 2000,
    order: 11,
    description: '해외 목표 시장 분석',
    table_template: `| 목표국가 | 시장규모 | 성장률 | 진출전략 |
|----------|----------|--------|----------|
| | | | |`
  },
  {
    key: '3-2-2',
    title: '3-2-2. 해외시장 진출 현황',
    required: true,
    max_chars: 2000,
    order: 12,
    description: '해외 시장 진출 현황 (국가, 거래처, 아이템, 기간, 금액)',
    table_template: `| 순번 | 국가명 | 유통 채널명 | 판매 내용 | 진출 시기 | 판매 금액 |
|------|--------|-------------|-----------|-----------|-----------|
| 1 | | | | | 백만원 |
| 2 | | | | | 백만원 |`
  },
  {
    key: '3-2-3',
    title: '3-2-3. 해외시장 (추가)진출 계획',
    required: true,
    max_chars: 2000,
    order: 13,
    description: '해외 시장 추가 진출 계획'
  },
  {
    key: '3-3',
    title: '3-3. 사업 추진 일정',
    required: true,
    max_chars: 3000,
    order: 14,
    description: '사업 전체 로드맵'
  },
  {
    key: '3-3-1',
    title: '3-3-1. 사업 전체 로드맵',
    required: true,
    max_chars: 3000,
    order: 15,
    description: '1년차, 2년차, 3년차 추진 일정',
    table_template: `| 구분 | 1년차 | 2년차 | 3년차 |
|------|-------|-------|-------|
| 제품개발 | | | |
| 시장진출 | | | |
| 매출목표 | | | |
| 인력확충 | | | |`
  },
  {
    key: '3-4',
    title: '3-4. 사업비 집행 계획',
    required: true,
    max_chars: 2500,
    order: 16,
    description: '정부지원사업비는 총 사업비의 70% 미만, 자기부담사업비는 30% 초과',
    table_template: `**[사업비 집행계획]** (단위: 백만원)
| 비목 | 정부지원금 | 자기부담금 | 합계 | 비고 |
|------|------------|------------|------|------|
| 인건비 | | | | |
| 재료비 | | | | |
| 외주용역비 | | | | |
| 기자재구입비 | | | | |
| 마케팅비 | | | | |
| **합계** | | | | |

※ 정부지원사업비는 총 사업비의 70% 미만, 자기부담사업비는 30% 초과`
  },

  // 4. 개방형 혁신 계획
  {
    key: '4-1',
    title: '4-1. 국내외 대·중견기업과의 협력 현황 및 계획',
    required: true,
    max_chars: 2000,
    order: 17,
    description: '대·중견기업 협력 현황 및 계획 개요'
  },
  {
    key: '4-1-1',
    title: '4-1-1. 국내외 대·중견기업과의 협력 이력(예정 포함)',
    required: true,
    max_chars: 2000,
    order: 18,
    description: '국내외 대·중견기업과의 협력 이력',
    table_template: `| 순번 | 협력기업명 | 협력내용 | 협력기간 | 협력성과 |
|------|------------|----------|----------|----------|
| 1 | | | | |
| 2 | | | | |`
  },
  {
    key: '4-1-2',
    title: '4-1-2. 국내외 대·중견기업 협력 확대 계획',
    required: true,
    max_chars: 2000,
    order: 19,
    description: '대·중견기업 협력 확대 계획'
  },

  // 5. 투자유치 계획
  {
    key: '5-1',
    title: '5-1. 외부 투자유치 현황 및 계획',
    required: true,
    max_chars: 2000,
    order: 20,
    description: '외부 투자유치 현황 및 계획 개요'
  },
  {
    key: '5-1-1',
    title: '5-1-1. 외부 투자유치 현황(예정 포함)',
    required: true,
    max_chars: 2000,
    order: 21,
    description: '설립일로부터 누적 외부 투자유치규모',
    table_template: `| 순번 | 투자일 | 투자사 | 투자형태 | 투자금액 | 비고 |
|------|--------|--------|----------|----------|------|
| 1 | | | Seed/Pre-A/Series A 등 | 억원 | |
| 2 | | | | | |
| **합계** | | | | 억원 | |`
  },
  {
    key: '5-1-2',
    title: '5-1-2. 외부 투자 신규 유치 계획',
    required: true,
    max_chars: 2000,
    order: 22,
    description: '투자유치 이력 외 신규 투자 유치 계획',
    table_template: `| 목표시기 | 투자형태 | 목표금액 | 용도 |
|----------|----------|----------|------|
| | | 억원 | |`
  },

  // 6. 출구전략
  {
    key: '6-1',
    title: '6-1. 출구(EXIT) 목표 및 방안',
    required: true,
    max_chars: 2000,
    order: 23,
    description: '출구 목표 및 방안 개요'
  },
  {
    key: '6-1-1',
    title: '6-1-1. 투자유치',
    required: true,
    max_chars: 1500,
    order: 24,
    description: '투자유치를 통한 출구 전략'
  },
  {
    key: '6-1-2',
    title: '6-1-2. 인수‧합병(M&A)',
    required: true,
    max_chars: 1500,
    order: 25,
    description: '인수합병(M&A)를 통한 사업확장 또는 출구전략'
  },
  {
    key: '6-1-3',
    title: '6-1-3. 기업공개(IPO)',
    required: true,
    max_chars: 1500,
    order: 26,
    description: '기업공개(IPO) 계획'
  },
  {
    key: '6-1-4',
    title: '6-1-4. 정부지원사업비',
    required: true,
    max_chars: 1500,
    order: 27,
    description: 'R&D, 정책자금 등 정부지원사업비를 통한 자금 확보 계획'
  },
]

async function main() {
  console.log('=== DIPS 템플릿 수정 (표 템플릿 포함) ===\n')

  const { data: templates, error: findError } = await supabase
    .from('business_plan_templates')
    .select('id, name, template_name, program_id')
    .or('name.ilike.%DIPS%,name.ilike.%초격차%')

  if (findError) {
    console.log('Error finding templates:', findError.message)
    return
  }

  console.log('Found templates:', templates?.length || 0)

  for (const t of templates || []) {
    console.log(`\nUpdating: ${t.name || t.template_name}`)
    console.log(`  ID: ${t.id}`)

    const { error: updateError } = await supabase
      .from('business_plan_templates')
      .update({
        section_structure: DIPS_SECTIONS,
        sections: DIPS_SECTIONS,
        updated_at: new Date().toISOString()
      })
      .eq('id', t.id)

    if (updateError) {
      console.log(`  ✗ Error: ${updateError.message}`)
    } else {
      console.log(`  ✓ Updated with ${DIPS_SECTIONS.length} sections (with table templates)`)
    }
  }

  // 섹션별 표 템플릿 현황
  console.log('\n=== 표 템플릿 포함 섹션 ===')
  DIPS_SECTIONS.forEach(s => {
    if (s.table_template) {
      console.log(`  ✓ ${s.key}: ${s.title}`)
    }
  })
}

main()
