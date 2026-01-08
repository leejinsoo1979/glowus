const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: process.cwd() + '/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 원본 HWP 템플릿 구조 (27개 섹션)
const DIPS_SECTIONS = [
  { key: '1-1', title: '1-1. 대표자 현황 및 보유역량', required: true, max_chars: 3000, order: 1, description: '대표자가 보유하고 있는 역량(경영 능력, 경력·학력, 창업 경험 등)' },
  { key: '1-2', title: '1-2. 기업 현황 및 팀 보유역량', required: true, max_chars: 4000, order: 2, description: '재직 인력 고용현황, 추가 인력 고용계획, 고용 관련 지원사업 수혜 여부, 업무파트너(협력기업 등) 현황 및 역량' },
  { key: '2-1', title: '2-1. 창업아이템의 개발 동기 및 목적', required: true, max_chars: 3000, order: 3, description: '외적 동기, 내적 동기, 목적 및 기대효과' },
  { key: '2-2', title: '2-2. 창업아이템(제품, 서비스 혹은 기술) 차별성', required: true, max_chars: 4000, order: 4, description: '기업별 아이템(제품, 서비스 혹은 기술)을 소개하고, 경쟁사 대비 차별점을 작성' },
  { key: '2-3', title: '2-3. 창업아이템 비즈니스 모델(BM)', required: true, max_chars: 3000, order: 5, description: '수익 모델, 가격 전략, 고객 획득 전략' },
  { key: '2-4', title: '2-4. 창업아이템의 개선과제 및 기술 고도화계획', required: true, max_chars: 3000, order: 6, description: '자사가 개발(보유) 중인 아이템에 대해 본 사업 참여를 통해 고도화하고자 하는 개선과제 및 기술 고도화계획' },
  { key: '3-1', title: '3-1. 국내(내수) 시장 진출 현황 및 계획', required: true, max_chars: 2000, order: 7, description: '내수시장 진출 현황' },
  { key: '3-1-1', title: '3-1-1. 내수시장 진출 현황', required: true, max_chars: 2000, order: 8, description: '국내 시장 진출 현황 (거래처, 아이템, 기간, 금액)' },
  { key: '3-1-2', title: '3-1-2. 내수시장 (추가)진출 계획', required: true, max_chars: 2000, order: 9, description: '국내 시장 추가 진출 계획' },
  { key: '3-2', title: '3-2. 해외시장 진출 현황 및 계획', required: true, max_chars: 2000, order: 10, description: '해외시장 진출 현황 및 계획' },
  { key: '3-2-1', title: '3-2-1. 해외진출 목표 시장 분석', required: true, max_chars: 2000, order: 11, description: '해외 목표 시장 분석' },
  { key: '3-2-2', title: '3-2-2. 해외시장 진출 현황', required: true, max_chars: 2000, order: 12, description: '해외 시장 진출 현황 (국가, 거래처, 아이템, 기간, 금액)' },
  { key: '3-2-3', title: '3-2-3. 해외시장 (추가)진출 계획', required: true, max_chars: 2000, order: 13, description: '해외 시장 추가 진출 계획' },
  { key: '3-3', title: '3-3. 사업 추진 일정', required: true, max_chars: 3000, order: 14, description: '사업 전체 로드맵' },
  { key: '3-3-1', title: '3-3-1. 사업 전체 로드맵', required: true, max_chars: 3000, order: 15, description: '1년차, 2년차, 3년차 추진 일정' },
  { key: '3-4', title: '3-4. 사업비 집행 계획', required: true, max_chars: 2500, order: 16, description: '정부지원사업비는 총 사업비의 70% 미만, 자기부담사업비는 30% 초과' },
  { key: '4-1', title: '4-1. 국내외 대·중견기업과의 협력 현황 및 계획', required: true, max_chars: 2000, order: 17, description: '대·중견기업 협력 현황 및 계획' },
  { key: '4-1-1', title: '4-1-1. 국내외 대·중견기업과의 협력 이력(예정 포함)', required: true, max_chars: 2000, order: 18, description: '국내외 대·중견기업과의 협력 이력' },
  { key: '4-1-2', title: '4-1-2. 국내외 대·중견기업 협력 확대 계획', required: true, max_chars: 2000, order: 19, description: '대·중견기업 협력 확대 계획' },
  { key: '5-1', title: '5-1. 외부 투자유치 현황 및 계획', required: true, max_chars: 2000, order: 20, description: '외부 투자유치 현황 및 계획' },
  { key: '5-1-1', title: '5-1-1. 외부 투자유치 현황(예정 포함)', required: true, max_chars: 2000, order: 21, description: '설립일로부터 누적 외부 투자유치규모' },
  { key: '5-1-2', title: '5-1-2. 외부 투자 신규 유치 계획', required: true, max_chars: 2000, order: 22, description: '투자유치 이력 외 신규 투자 유치 계획' },
  { key: '6-1', title: '6-1. 출구(EXIT) 목표 및 방안', required: true, max_chars: 2000, order: 23, description: '출구 목표 및 방안' },
  { key: '6-1-1', title: '6-1-1. 투자유치', required: true, max_chars: 1500, order: 24, description: '투자유치를 통한 출구 전략' },
  { key: '6-1-2', title: '6-1-2. 인수‧합병(M&A)', required: true, max_chars: 1500, order: 25, description: '인수합병(M&A)를 통한 사업확장 또는 출구전략' },
  { key: '6-1-3', title: '6-1-3. 기업공개(IPO)', required: true, max_chars: 1500, order: 26, description: '기업공개(IPO) 계획' },
  { key: '6-1-4', title: '6-1-4. 정부지원사업비', required: true, max_chars: 1500, order: 27, description: 'R&D, 정책자금 등 정부지원사업비를 통한 자금 확보 계획' },
]

// 기존 섹션 -> 새 섹션 매핑
const SECTION_MAPPING = {
  'executive_summary': '2-1',    // 사업 요약 -> 창업아이템 개발 동기
  'company_overview': '1-2',     // 회사 개요 -> 기업 현황 및 팀 보유역량
  'problem_statement': '2-1',    // 문제 정의 -> 개발 동기 (머지)
  'solution': '2-2',             // 해결책 -> 창업아이템 차별성
  'market_research': '3-1',      // 시장 분석 -> 국내시장 진출
  'business_model': '2-3',       // 비즈니스 모델 -> BM
  'team_introduction': '1-1',    // 팀 소개 -> 대표자 현황
  'financial_plan': '3-4',       // 재무 계획 -> 사업비 집행
  'fund_usage': '3-4',           // 자금 사용 -> 사업비 집행 (머지)
  'expected_outcomes': '6-1',    // 기대 효과 -> 출구 전략
}

async function main() {
  console.log('=== DIPS 사업계획서 섹션 마이그레이션 ===\n')

  // DIPS 프로그램 ID들
  const dipsTemplates = await supabase
    .from('business_plan_templates')
    .select('program_id')
    .or('name.ilike.%DIPS%,name.ilike.%초격차%')

  const dipsProgramIds = dipsTemplates.data?.map(t => t.program_id).filter(Boolean) || []
  console.log('DIPS program_ids:', dipsProgramIds)

  // 해당 프로그램의 사업계획서들 찾기
  const { data: plans, error } = await supabase
    .from('business_plans')
    .select('id, title, sections, program_id')
    .in('program_id', dipsProgramIds)

  if (error) {
    console.log('Error:', error.message)
    return
  }

  console.log('Found business plans:', plans?.length || 0)

  for (const plan of plans || []) {
    console.log('\n---')
    console.log('Migrating:', plan.title)
    console.log('ID:', plan.id)

    const oldSections = plan.sections || {}
    const oldKeys = Object.keys(oldSections)
    console.log('Old sections:', oldKeys.join(', '))

    // 새 섹션 구조 생성
    const newSections = {}

    // DIPS 27개 섹션 초기화
    for (const section of DIPS_SECTIONS) {
      newSections[section.key] = {
        order: section.order,
        title: section.title,
        content: '',
        edited: false,
        required: section.required,
        max_chars: section.max_chars,
        description: section.description
      }
    }

    // 기존 컨텐츠 매핑
    for (const oldKey of oldKeys) {
      const newKey = SECTION_MAPPING[oldKey]
      if (newKey && newSections[newKey]) {
        const oldContent = oldSections[oldKey].content || ''
        if (oldContent) {
          // 기존 컨텐츠가 있으면 추가
          if (newSections[newKey].content) {
            newSections[newKey].content += '\n\n---\n\n' + oldContent
          } else {
            newSections[newKey].content = oldContent
          }
          newSections[newKey].edited = oldSections[oldKey].edited || false
        }
      }
    }

    // DB 업데이트
    const { error: updateError } = await supabase
      .from('business_plans')
      .update({
        sections: newSections,
        updated_at: new Date().toISOString()
      })
      .eq('id', plan.id)

    if (updateError) {
      console.log('  ✗ Error:', updateError.message)
    } else {
      const newKeys = Object.keys(newSections)
      console.log('  ✓ Migrated to', newKeys.length, 'sections')
      console.log('  New keys:', newKeys.slice(0, 5).join(', '), '...')
    }
  }

  console.log('\n=== 마이그레이션 완료 ===')
}

main()
