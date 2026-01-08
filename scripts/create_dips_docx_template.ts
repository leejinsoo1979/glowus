/**
 * DIPS 사업계획서 DOCX 템플릿 생성
 * - 원본 HWP 양식을 DOCX로 재현
 * - 표 구조 포함
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  PageBreak,
  VerticalAlign,
  ShadingType
} from 'docx'
import * as fs from 'fs'
import * as path from 'path'

// 표 스타일 헬퍼
const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
}

// 헤더 셀 (회색 배경)
function headerCell(text: string, width?: number): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 20 })],
      alignment: AlignmentType.CENTER
    })],
    shading: { fill: 'E7E6E6', type: ShadingType.SOLID },
    verticalAlign: VerticalAlign.CENTER,
    width: width ? { size: width, type: WidthType.DXA } : undefined
  })
}

// 일반 셀
function cell(text: string, width?: number): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, size: 20 })],
    })],
    verticalAlign: VerticalAlign.CENTER,
    width: width ? { size: width, type: WidthType.DXA } : undefined
  })
}

// 입력 셀 (플레이스홀더)
function inputCell(placeholder: string, width?: number): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: `{{${placeholder}}}`, size: 20, color: '0066CC' })],
    })],
    verticalAlign: VerticalAlign.CENTER,
    width: width ? { size: width, type: WidthType.DXA } : undefined
  })
}

// 섹션 제목
function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `□ ${text}`, bold: true, size: 24 })],
    spacing: { before: 400, after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' }
    }
  })
}

// 서브섹션 제목
function subSectionTitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22 })],
    spacing: { before: 300, after: 150 }
  })
}

// 내용 문단
function contentParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 20 })],
    spacing: { before: 100, after: 100 }
  })
}

// 플레이스홀더 문단
function placeholderParagraph(key: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `{{${key}}}`, size: 20, color: '0066CC' })],
    spacing: { before: 100, after: 100 }
  })
}

async function createDipsTemplate() {
  console.log('=== DIPS DOCX 템플릿 생성 ===\n')

  const children: any[] = []

  // ========================================
  // 표지
  // ========================================
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '2026년 초격차 스타트업 1000+ 프로젝트(DIPS)', bold: true, size: 36 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 400 }
    }),
    new Paragraph({
      children: [new TextRun({ text: '창업 사업계획서', bold: true, size: 48 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 1000 }
    }),
    new Paragraph({
      children: [new TextRun({ text: '{{company_name}}', size: 28 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 500 }
    }),
    new Paragraph({
      children: [new TextRun({ text: '{{submission_date}}', size: 24 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 1000 }
    }),
    new Paragraph({ children: [new PageBreak()] })
  )

  // ========================================
  // 1. 신청현황
  // ========================================
  children.push(sectionTitle('신청현황'))

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        children: [
          headerCell('신청분야'),
          inputCell('application_field', 3000),
          headerCell('기업명'),
          inputCell('company_name', 3000),
        ]
      }),
      new TableRow({
        children: [
          headerCell('정부지원사업비'),
          inputCell('gov_support_amount'),
          headerCell('자기부담사업비'),
          inputCell('self_funding_amount'),
        ]
      }),
      new TableRow({
        children: [
          headerCell('총 사업비'),
          inputCell('total_project_cost'),
          headerCell('사업기간'),
          inputCell('project_period'),
        ]
      }),
    ]
  }))

  children.push(new Paragraph({ spacing: { after: 200 } }))

  // ========================================
  // 2. 일반현황
  // ========================================
  children.push(sectionTitle('일반현황'))

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        children: [
          headerCell('기업명'),
          inputCell('company_name'),
          headerCell('대표자'),
          inputCell('ceo_name'),
        ]
      }),
      new TableRow({
        children: [
          headerCell('설립일'),
          inputCell('establishment_date'),
          headerCell('사업자등록번호'),
          inputCell('business_registration_no'),
        ]
      }),
      new TableRow({
        children: [
          headerCell('업종'),
          inputCell('industry'),
          headerCell('주요제품'),
          inputCell('main_products'),
        ]
      }),
      new TableRow({
        children: [
          headerCell('소재지'),
          inputCell('address'),
          headerCell('연락처'),
          inputCell('contact'),
        ]
      }),
      new TableRow({
        children: [
          headerCell('직원수'),
          inputCell('employee_count'),
          headerCell('연매출'),
          inputCell('annual_revenue'),
        ]
      }),
    ]
  }))

  children.push(new Paragraph({ children: [new PageBreak()] }))

  // ========================================
  // 3. 자가진단
  // ========================================
  children.push(sectionTitle('자가진단'))

  children.push(contentParagraph(
    '※ 본 내용은 사업 신청 자격과 관련한 사항을 신청자 본인이 직접 확인하기 위한 절차입니다.'
  ))

  children.push(subSectionTitle('1. 신청 제외 대상 해당 여부'))
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        children: [
          headerCell('항목'),
          headerCell('해당여부'),
        ]
      }),
      new TableRow({
        children: [
          cell('국세·지방세 체납 여부'),
          inputCell('tax_delinquency'),
        ]
      }),
      new TableRow({
        children: [
          cell('휴·폐업 여부'),
          inputCell('business_closure'),
        ]
      }),
    ]
  }))

  children.push(subSectionTitle('2. 타 창업지원사업 신청·수행 여부'))
  children.push(placeholderParagraph('other_support_programs'))

  children.push(subSectionTitle('3. 지식재산권 보유 여부'))
  children.push(placeholderParagraph('ip_ownership'))

  children.push(new Paragraph({ children: [new PageBreak()] }))

  // ========================================
  // 4. 창업아이템 개요
  // ========================================
  children.push(sectionTitle('창업아이템(원천기술, 제품, 서비스 등) 개요'))
  children.push(contentParagraph('(요약, 2페이지 이내 작성)'))

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        children: [
          headerCell('아이템명'),
          inputCell('item_name'),
        ]
      }),
      new TableRow({
        children: [
          headerCell('핵심 기술'),
          inputCell('core_technology'),
        ]
      }),
      new TableRow({
        children: [
          headerCell('제품/서비스 개요'),
          inputCell('item_overview'),
        ]
      }),
    ]
  }))

  children.push(placeholderParagraph('item_summary'))

  children.push(new Paragraph({ children: [new PageBreak()] }))

  // ========================================
  // 1-1. 대표자 현황 및 보유역량
  // ========================================
  children.push(subSectionTitle('1-1. 대표자 현황 및 보유역량'))

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        children: [
          headerCell('성명'),
          inputCell('ceo_name'),
          headerCell('생년월일'),
          inputCell('ceo_birth'),
        ]
      }),
      new TableRow({
        children: [
          headerCell('학력'),
          inputCell('ceo_education'),
          headerCell('전공'),
          inputCell('ceo_major'),
        ]
      }),
      new TableRow({
        children: [
          headerCell('경력사항'),
          inputCell('ceo_career'),
        ]
      }),
    ]
  }))

  children.push(placeholderParagraph('ceo_capabilities'))

  // ========================================
  // 1-2. 기업 현황 및 팀 보유역량
  // ========================================
  children.push(subSectionTitle('1-2. 기업 현황 및 팀 보유역량'))

  children.push(placeholderParagraph('team_capabilities'))

  children.push(contentParagraph('◦ 재직 인력 고용현황'))
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        children: [
          headerCell('구분'),
          headerCell('인원'),
          headerCell('주요역할'),
        ]
      }),
      new TableRow({
        children: [
          cell('정규직'),
          inputCell('fulltime_count'),
          inputCell('fulltime_roles'),
        ]
      }),
      new TableRow({
        children: [
          cell('계약직'),
          inputCell('contract_count'),
          inputCell('contract_roles'),
        ]
      }),
    ]
  }))

  children.push(contentParagraph('◦ 추가 인력 고용계획'))
  children.push(placeholderParagraph('hiring_plan'))

  children.push(new Paragraph({ children: [new PageBreak()] }))

  // ========================================
  // 2-1. 창업아이템의 개발 동기 및 목적
  // ========================================
  children.push(subSectionTitle('2-1. 창업아이템의 개발 동기 및 목적'))
  children.push(placeholderParagraph('development_motivation'))

  // ========================================
  // 2-2. 창업아이템 차별성
  // ========================================
  children.push(subSectionTitle('2-2. 창업아이템(제품, 서비스 혹은 기술) 차별성'))
  children.push(placeholderParagraph('item_differentiation'))

  // ========================================
  // 2-3. 창업아이템 비즈니스 모델
  // ========================================
  children.push(subSectionTitle('2-3. 창업아이템 비즈니스 모델(BM)'))
  children.push(placeholderParagraph('business_model'))

  // ========================================
  // 2-4. 개선과제 및 기술 고도화계획
  // ========================================
  children.push(subSectionTitle('2-4. 창업아이템의 개선과제 및 기술 고도화계획'))
  children.push(placeholderParagraph('improvement_plan'))

  children.push(new Paragraph({ children: [new PageBreak()] }))

  // ========================================
  // 3-1. 국내시장 진출 현황 및 계획
  // ========================================
  children.push(subSectionTitle('3-1. 국내(내수) 시장 진출 현황 및 계획'))

  children.push(contentParagraph('3-1-1. 내수시장 진출 현황'))
  children.push(placeholderParagraph('domestic_market_status'))

  children.push(contentParagraph('3-1-2. 내수시장 (추가)진출 계획'))
  children.push(placeholderParagraph('domestic_market_plan'))

  // ========================================
  // 3-2. 해외시장 진출 현황 및 계획
  // ========================================
  children.push(subSectionTitle('3-2. 해외시장 진출 현황 및 계획'))

  children.push(contentParagraph('3-2-1. 해외진출 목표 시장 분석'))
  children.push(placeholderParagraph('overseas_market_analysis'))

  children.push(contentParagraph('3-2-2. 해외시장 진출 현황'))
  children.push(placeholderParagraph('overseas_market_status'))

  children.push(contentParagraph('3-2-3. 해외시장 (추가)진출 계획'))
  children.push(placeholderParagraph('overseas_market_plan'))

  children.push(new Paragraph({ children: [new PageBreak()] }))

  // ========================================
  // 3-3. 사업 추진 일정
  // ========================================
  children.push(subSectionTitle('3-3. 사업 추진 일정'))

  children.push(contentParagraph('3-3-1. 사업 전체 로드맵'))
  children.push(placeholderParagraph('project_roadmap'))

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        children: [
          headerCell('구분'),
          headerCell('1년차'),
          headerCell('2년차'),
          headerCell('3년차'),
        ]
      }),
      new TableRow({
        children: [
          cell('주요 목표'),
          inputCell('year1_goal'),
          inputCell('year2_goal'),
          inputCell('year3_goal'),
        ]
      }),
      new TableRow({
        children: [
          cell('세부 과제'),
          inputCell('year1_tasks'),
          inputCell('year2_tasks'),
          inputCell('year3_tasks'),
        ]
      }),
    ]
  }))

  // ========================================
  // 3-4. 사업비 집행 계획
  // ========================================
  children.push(subSectionTitle('3-4. 사업비 집행 계획'))
  children.push(placeholderParagraph('budget_plan'))

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        children: [
          headerCell('비목'),
          headerCell('정부지원금'),
          headerCell('자기부담금'),
          headerCell('합계'),
        ]
      }),
      new TableRow({
        children: [
          cell('인건비'),
          inputCell('labor_gov'),
          inputCell('labor_self'),
          inputCell('labor_total'),
        ]
      }),
      new TableRow({
        children: [
          cell('재료비'),
          inputCell('material_gov'),
          inputCell('material_self'),
          inputCell('material_total'),
        ]
      }),
      new TableRow({
        children: [
          cell('외주용역비'),
          inputCell('outsourcing_gov'),
          inputCell('outsourcing_self'),
          inputCell('outsourcing_total'),
        ]
      }),
      new TableRow({
        children: [
          cell('기타'),
          inputCell('other_gov'),
          inputCell('other_self'),
          inputCell('other_total'),
        ]
      }),
      new TableRow({
        children: [
          headerCell('합계'),
          inputCell('total_gov'),
          inputCell('total_self'),
          inputCell('grand_total'),
        ]
      }),
    ]
  }))

  children.push(new Paragraph({ children: [new PageBreak()] }))

  // ========================================
  // 4-1. 대기업 협력
  // ========================================
  children.push(subSectionTitle('4-1. 국내외 대·중견기업과의 협력 현황 및 계획'))

  children.push(contentParagraph('4-1-1. 국내외 대·중견기업과의 협력 이력(예정 포함)'))
  children.push(placeholderParagraph('enterprise_cooperation_history'))

  children.push(contentParagraph('4-1-2. 국내외 대·중견기업 협력 확대 계획'))
  children.push(placeholderParagraph('enterprise_cooperation_plan'))

  // ========================================
  // 5-1. 외부 투자유치
  // ========================================
  children.push(subSectionTitle('5-1. 외부 투자유치 현황 및 계획'))

  children.push(contentParagraph('5-1-1. 외부 투자유치 현황(예정 포함)'))
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        children: [
          headerCell('투자사'),
          headerCell('투자금액'),
          headerCell('투자일'),
          headerCell('비고'),
        ]
      }),
      new TableRow({
        children: [
          inputCell('investor1'),
          inputCell('invest_amount1'),
          inputCell('invest_date1'),
          inputCell('invest_note1'),
        ]
      }),
    ]
  }))

  children.push(contentParagraph('5-1-2. 외부 투자 신규 유치 계획'))
  children.push(placeholderParagraph('investment_plan'))

  children.push(new Paragraph({ children: [new PageBreak()] }))

  // ========================================
  // 6-1. EXIT 목표
  // ========================================
  children.push(subSectionTitle('6-1. 출구(EXIT) 목표 및 방안'))

  children.push(contentParagraph('6-1-1. 투자유치'))
  children.push(placeholderParagraph('exit_investment'))

  children.push(contentParagraph('6-1-2. 인수·합병(M&A)'))
  children.push(placeholderParagraph('exit_ma'))

  children.push(contentParagraph('6-1-3. 기업공개(IPO)'))
  children.push(placeholderParagraph('exit_ipo'))

  children.push(contentParagraph('6-1-4. 정부지원사업비'))
  children.push(placeholderParagraph('exit_gov_support'))

  // ========================================
  // 문서 생성
  // ========================================
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,   // 1 inch
            right: 1440,
            bottom: 1440,
            left: 1440,
          }
        }
      },
      children
    }]
  })

  const buffer = await Packer.toBuffer(doc)

  // 저장
  const outputDir = path.resolve(process.cwd(), 'templates')
  const outputPath = path.join(outputDir, 'DIPS_template.docx')

  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(outputPath, buffer)

  console.log(`✅ DIPS DOCX 템플릿 생성 완료!`)
  console.log(`   경로: ${outputPath}`)
  console.log(`   크기: ${buffer.length} bytes`)

  // 플레이스홀더 목록 출력
  console.log('\n📝 플레이스홀더 목록:')
  const placeholders = [
    'company_name', 'submission_date', 'application_field',
    'gov_support_amount', 'self_funding_amount', 'total_project_cost', 'project_period',
    'ceo_name', 'establishment_date', 'business_registration_no',
    'industry', 'main_products', 'address', 'contact', 'employee_count', 'annual_revenue',
    'item_name', 'core_technology', 'item_overview', 'item_summary',
    'ceo_capabilities', 'team_capabilities', 'hiring_plan',
    'development_motivation', 'item_differentiation', 'business_model', 'improvement_plan',
    'domestic_market_status', 'domestic_market_plan',
    'overseas_market_analysis', 'overseas_market_status', 'overseas_market_plan',
    'project_roadmap', 'budget_plan',
    'enterprise_cooperation_history', 'enterprise_cooperation_plan',
    'investment_plan', 'exit_investment', 'exit_ma', 'exit_ipo', 'exit_gov_support'
  ]
  placeholders.forEach(p => console.log(`   - {{${p}}}`))
}

createDipsTemplate().catch(console.error)
