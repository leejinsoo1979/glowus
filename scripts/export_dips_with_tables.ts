/**
 * DIPS 사업계획서 - 실제 양식 표 구조로 Word 생성
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, VerticalAlign,
  HeadingLevel, PageBreak, Header, Footer, PageNumber,
  TableLayoutType, convertInchesToTwip
} from 'docx'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const PLAN_ID = 'cb2b2230-3495-4616-b330-f5a3a37e4b2a'

// 테이블 스타일
const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  right: { style: BorderStyle.SINGLE, size: 1, color: '000000' }
}

const headerCell = (text: string, width?: number) => new TableCell({
  children: [new Paragraph({
    children: [new TextRun({ text, bold: true, size: 20 })],
    alignment: AlignmentType.CENTER
  })],
  shading: { fill: 'E7E6E6' },
  verticalAlign: VerticalAlign.CENTER,
  width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
  borders: tableBorders
})

const dataCell = (text: string, width?: number, options?: { bold?: boolean, align?: typeof AlignmentType[keyof typeof AlignmentType] }) => new TableCell({
  children: [new Paragraph({
    children: [new TextRun({ text, bold: options?.bold, size: 20 })],
    alignment: options?.align || AlignmentType.LEFT
  })],
  verticalAlign: VerticalAlign.CENTER,
  width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
  borders: tableBorders
})

const emptyCell = (width?: number) => dataCell('', width)

async function main() {
  console.log('=== DIPS 사업계획서 (표 양식) 생성 ===\n')

  // 사업계획서 조회
  const { data: plan } = await supabase
    .from('business_plans')
    .select('*')
    .eq('id', PLAN_ID)
    .single()

  if (!plan) {
    console.error('사업계획서를 찾을 수 없습니다')
    return
  }

  // 회사 정보 조회
  const { data: company } = await supabase
    .from('company_support_profiles')
    .select('*')
    .eq('company_id', plan.company_id)
    .single()

  const sections = plan.sections || []
  console.log(`📄 ${plan.title}`)
  console.log(`📊 ${sections.length}개 섹션`)

  // Word 문서 생성
  const doc = new Document({
    creator: '유에이블 코퍼레이션',
    title: plan.title,
    styles: {
      default: {
        document: {
          run: { font: 'Malgun Gothic', size: 22 }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } // 2cm margins
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [new TextRun({ text: '2026년 초격차 스타트업 프로젝트(DIPS) 창업기업 사업계획서', size: 18, color: '666666' })],
            alignment: AlignmentType.CENTER
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [
              new TextRun({ text: '- ' }),
              new TextRun({ children: [PageNumber.CURRENT] }),
              new TextRun({ text: ' -' })
            ],
            alignment: AlignmentType.CENTER
          })]
        })
      },
      children: [
        // ========== 표지 ==========
        new Paragraph({ text: '', spacing: { before: 1000 } }),
        new Paragraph({
          children: [new TextRun({ text: '2026년 초격차 스타트업 프로젝트', size: 40, bold: true })],
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          children: [new TextRun({ text: '창업기업 사업계획서 (DIPS)', size: 40, bold: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 }
        }),

        // 표지 정보 테이블
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [headerCell('기 업 명', 30), dataCell('유에이블 코퍼레이션', 70)] }),
            new TableRow({ children: [headerCell('아이템명', 30), dataCell('GlowUS - AI Agent OS', 70)] }),
            new TableRow({ children: [headerCell('신청분야', 30), dataCell('AI (인공지능산업융합사업단)', 70)] }),
            new TableRow({ children: [headerCell('대 표 자', 30), dataCell(company?.ceo_name || '이진수', 70)] }),
            new TableRow({ children: [
              headerCell('사 업 비', 30),
              dataCell('정부지원 200,000천원 / 자부담 88,000천원 / 총 288,000천원', 70)
            ]}),
          ]
        }),

        new Paragraph({ text: '', spacing: { before: 800 } }),
        new Paragraph({
          children: [new TextRun({ text: '2026년 1월', size: 28 })],
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          children: [new TextRun({ text: '유에이블 코퍼레이션', size: 32, bold: true })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 }
        }),

        new Paragraph({ children: [new PageBreak()] }),

        // ========== 1. 신청현황 ==========
        new Paragraph({
          children: [new TextRun({ text: '□ 신청현황', size: 28, bold: true })],
          spacing: { before: 400, after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({
            text: '※ 정부지원사업비는 총 사업비의 70% 미만, 자기부담사업비(현금 또는 현물)은 30% 이상으로 작성',
            size: 16, color: '0000FF', italics: true
          })],
          spacing: { after: 200 }
        }),

        // 신청현황 테이블
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              headerCell('구분', 20), headerCell('정부지원사업비', 25),
              headerCell('자기부담사업비', 25), headerCell('총 사업비', 30)
            ]}),
            new TableRow({ children: [
              headerCell('금액(천원)', 20),
              dataCell('200,000', 25, { align: AlignmentType.RIGHT }),
              dataCell('88,000', 25, { align: AlignmentType.RIGHT }),
              dataCell('288,000', 30, { align: AlignmentType.RIGHT })
            ]}),
            new TableRow({ children: [
              headerCell('비율(%)', 20),
              dataCell('69.4%', 25, { align: AlignmentType.CENTER }),
              dataCell('30.6%', 25, { align: AlignmentType.CENTER }),
              dataCell('100%', 30, { align: AlignmentType.CENTER })
            ]}),
          ]
        }),

        new Paragraph({ text: '', spacing: { after: 300 } }),

        // 기업현황 테이블
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              headerCell('고용(명)', 25), dataCell(String(company?.employee_count || 3), 25, { align: AlignmentType.CENTER }),
              headerCell('매출(백만원)', 25), dataCell(String((company?.annual_revenue || 300000000) / 1000000), 25, { align: AlignmentType.CENTER })
            ]}),
            new TableRow({ children: [
              headerCell('누적투자(백만원)', 25), dataCell('150', 25, { align: AlignmentType.CENTER }),
              headerCell('업력(년)', 25), dataCell(String(company?.business_years || 5), 25, { align: AlignmentType.CENTER })
            ]}),
          ]
        }),

        new Paragraph({ children: [new PageBreak()] }),

        // ========== 2. 신청 분야 ==========
        new Paragraph({
          children: [new TextRun({ text: '□ 신청 분야', size: 28, bold: true })],
          spacing: { before: 400, after: 200 }
        }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              headerCell('구분', 10), headerCell('전략 분야', 20),
              headerCell('신산업 분야', 25), headerCell('주관기관', 30), headerCell('신청', 15)
            ]}),
            new TableRow({ children: [
              dataCell('①', 10, { align: AlignmentType.CENTER, bold: true }),
              dataCell('AI', 20, { align: AlignmentType.CENTER }),
              dataCell('AI', 25, { align: AlignmentType.CENTER }),
              dataCell('인공지능산업융합사업단', 30),
              dataCell('✓', 15, { align: AlignmentType.CENTER, bold: true })
            ]}),
            new TableRow({ children: [
              dataCell('②', 10, { align: AlignmentType.CENTER }),
              dataCell('바이오', 20, { align: AlignmentType.CENTER }),
              dataCell('헬스케어', 25, { align: AlignmentType.CENTER }),
              dataCell('성균관대학교 BTS 센터', 30),
              emptyCell(15)
            ]}),
          ]
        }),

        new Paragraph({ children: [new PageBreak()] }),

        // ========== 3. 기업 일반현황 ==========
        new Paragraph({
          children: [new TextRun({ text: '□ 기업 일반현황', size: 28, bold: true })],
          spacing: { before: 400, after: 200 }
        }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              headerCell('기업명', 20), dataCell('유에이블 코퍼레이션', 30),
              headerCell('대표자', 20), dataCell(company?.ceo_name || '이진수', 30)
            ]}),
            new TableRow({ children: [
              headerCell('설립일', 20), dataCell('2021.07.28', 30),
              headerCell('사업자등록번호', 20), dataCell('473-86-02122', 30)
            ]}),
            new TableRow({ children: [
              headerCell('업종', 20), dataCell(company?.industry_category || '정보통신업', 30),
              headerCell('업태', 20), dataCell(company?.industry_subcategory || '응용소프트웨어개발', 30)
            ]}),
            new TableRow({ children: [
              headerCell('소재지', 20),
              new TableCell({
                children: [new Paragraph({ text: '경기도 고양시 일산동구 중앙로1275번길 60-30, 401-2호' })],
                columnSpan: 3, borders: tableBorders
              })
            ]}),
            new TableRow({ children: [
              headerCell('연락처', 20), dataCell('010-8983-6637', 30),
              headerCell('이메일', 20), dataCell('admin@uable.co.kr', 30)
            ]}),
          ]
        }),

        new Paragraph({ text: '', spacing: { after: 300 } }),

        // 대표자 정보 테이블
        new Paragraph({
          children: [new TextRun({ text: '▶ 대표자 정보', size: 22, bold: true })],
          spacing: { after: 100 }
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              headerCell('학력', 20), dataCell('○○대학교 컴퓨터공학 석사', 80)
            ]}),
            new TableRow({ children: [
              headerCell('경력', 20), dataCell('IT/AI 분야 10년+ 경력, 스타트업 창업 및 운영 경험', 80)
            ]}),
          ]
        }),

        new Paragraph({ children: [new PageBreak()] }),

        // ========== 4. 창업아이템 개요 ==========
        new Paragraph({
          children: [new TextRun({ text: '□ 창업아이템 개요', size: 28, bold: true })],
          spacing: { before: 400, after: 200 }
        }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              headerCell('아이템명', 20), dataCell('GlowUS - AI Agent OS', 80)
            ]}),
            new TableRow({ children: [
              headerCell('아이템 개요', 20),
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({
                    text: sections.find((s: any) => s.section_id === '4')?.content?.substring(0, 500) ||
                      'AI 기반 업무 자동화 솔루션으로, 멀티에이전트, 워크플로우 자동화, RAG/지식베이스, LLM 기술을 통합한 플랫폼',
                    size: 20
                  })]
                })],
                borders: tableBorders
              })
            ]}),
          ]
        }),

        new Paragraph({ children: [new PageBreak()] }),

        // ========== 5. 기술성 ==========
        new Paragraph({
          children: [new TextRun({ text: '□ 기술성', size: 28, bold: true })],
          spacing: { before: 400, after: 200 }
        }),

        createContentTable('핵심기술', sections.find((s: any) => s.section_id === '5')?.content || ''),

        new Paragraph({ children: [new PageBreak()] }),

        // ========== 6. 시장성 ==========
        new Paragraph({
          children: [new TextRun({ text: '□ 시장성', size: 28, bold: true })],
          spacing: { before: 400, after: 200 }
        }),

        createContentTable('시장분석', sections.find((s: any) => s.section_id === '6')?.content || ''),

        new Paragraph({ children: [new PageBreak()] }),

        // ========== 7. 사업성 ==========
        new Paragraph({
          children: [new TextRun({ text: '□ 사업성', size: 28, bold: true })],
          spacing: { before: 400, after: 200 }
        }),

        createContentTable('사업모델', sections.find((s: any) => s.section_id === '7')?.content || ''),

        new Paragraph({ children: [new PageBreak()] }),

        // ========== 8. 팀 역량 ==========
        new Paragraph({
          children: [new TextRun({ text: '□ 대표자 및 팀 역량', size: 28, bold: true })],
          spacing: { before: 400, after: 200 }
        }),

        createContentTable('팀 역량', sections.find((s: any) => s.section_id === '8')?.content || ''),

        new Paragraph({ children: [new PageBreak()] }),

        // ========== 9. 사업비 계획 ==========
        new Paragraph({
          children: [new TextRun({ text: '□ 사업비 계획', size: 28, bold: true })],
          spacing: { before: 400, after: 200 }
        }),

        // 사업비 테이블
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              headerCell('비목', 25), headerCell('정부지원금(천원)', 25),
              headerCell('자부담금(천원)', 25), headerCell('계(천원)', 25)
            ]}),
            new TableRow({ children: [
              dataCell('인건비', 25), dataCell('100,000', 25, { align: AlignmentType.RIGHT }),
              dataCell('20,000', 25, { align: AlignmentType.RIGHT }), dataCell('120,000', 25, { align: AlignmentType.RIGHT })
            ]}),
            new TableRow({ children: [
              dataCell('연구개발비', 25), dataCell('50,000', 25, { align: AlignmentType.RIGHT }),
              dataCell('30,000', 25, { align: AlignmentType.RIGHT }), dataCell('80,000', 25, { align: AlignmentType.RIGHT })
            ]}),
            new TableRow({ children: [
              dataCell('위탁비', 25), dataCell('30,000', 25, { align: AlignmentType.RIGHT }),
              dataCell('0', 25, { align: AlignmentType.RIGHT }), dataCell('30,000', 25, { align: AlignmentType.RIGHT })
            ]}),
            new TableRow({ children: [
              dataCell('마케팅비', 25), dataCell('20,000', 25, { align: AlignmentType.RIGHT }),
              dataCell('0', 25, { align: AlignmentType.RIGHT }), dataCell('20,000', 25, { align: AlignmentType.RIGHT })
            ]}),
            new TableRow({ children: [
              dataCell('운영비', 25), dataCell('0', 25, { align: AlignmentType.RIGHT }),
              dataCell('38,000', 25, { align: AlignmentType.RIGHT }), dataCell('38,000', 25, { align: AlignmentType.RIGHT })
            ]}),
            new TableRow({ children: [
              headerCell('합계', 25), dataCell('200,000', 25, { align: AlignmentType.RIGHT, bold: true }),
              dataCell('88,000', 25, { align: AlignmentType.RIGHT, bold: true }), dataCell('288,000', 25, { align: AlignmentType.RIGHT, bold: true })
            ]}),
          ]
        }),

        new Paragraph({ children: [new PageBreak()] }),

        // ========== 10. 추진일정 ==========
        new Paragraph({
          children: [new TextRun({ text: '□ 추진일정', size: 28, bold: true })],
          spacing: { before: 400, after: 200 }
        }),

        // 일정 테이블
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              headerCell('분기', 15), headerCell('주요 목표', 40), headerCell('마일스톤', 45)
            ]}),
            new TableRow({ children: [
              dataCell('1분기', 15, { align: AlignmentType.CENTER }),
              dataCell('기획 및 시장조사', 40),
              dataCell('시장조사 보고서, 기능정의서 완료', 45)
            ]}),
            new TableRow({ children: [
              dataCell('2분기', 15, { align: AlignmentType.CENTER }),
              dataCell('프로토타입 개발', 40),
              dataCell('프로토타입 개발 완료, 내부 테스트', 45)
            ]}),
            new TableRow({ children: [
              dataCell('3분기', 15, { align: AlignmentType.CENTER }),
              dataCell('베타 출시 및 피드백', 40),
              dataCell('베타버전 배포, 사용자 피드백 수집', 45)
            ]}),
            new TableRow({ children: [
              dataCell('4분기', 15, { align: AlignmentType.CENTER }),
              dataCell('정식 출시 및 마케팅', 40),
              dataCell('정식버전 출시, 마케팅 캠페인 실행', 45)
            ]}),
          ]
        }),

        new Paragraph({ text: '', spacing: { after: 400 } }),
        new Paragraph({
          children: [new TextRun({ text: '- 끝 -', size: 24 })],
          alignment: AlignmentType.CENTER
        }),
      ]
    }]
  })

  // 파일 저장
  const outputDir = path.join(process.cwd(), 'exports')
  const timestamp = new Date().toISOString().slice(0, 10)
  const filename = `DIPS_사업계획서_표양식_${timestamp}.docx`
  const filepath = path.join(outputDir, filename)

  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(filepath, buffer)

  console.log(`\n✅ Word 문서 생성 완료!`)
  console.log(`   📁 ${filepath}`)
  console.log(`   📊 파일 크기: ${(buffer.length / 1024).toFixed(1)} KB`)

  // 열기
  const { exec } = await import('child_process')
  exec(`open "${filepath}"`)

  console.log('\n=== 완료 ===')
}

function createContentTable(title: string, content: string): Table {
  // 내용을 적절한 길이로 자르기
  const paragraphs = content.split('\n\n').filter(p => p.trim())
  const formattedContent = paragraphs.slice(0, 5).map(p =>
    p.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()
  ).join('\n\n')

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: formattedContent || '(내용 작성 필요)', size: 20 })]
              })
            ],
            borders: tableBorders
          })
        ]
      })
    ]
  })
}

main().catch(console.error)
