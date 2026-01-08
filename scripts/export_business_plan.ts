/**
 * DIPS 사업계획서 Word/PDF 내보내기
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  TableCell,
  TableRow,
  Table,
  WidthType,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  NumberFormat
} from 'docx'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const PLAN_ID = 'cb2b2230-3495-4616-b330-f5a3a37e4b2a'

async function main() {
  console.log('=== DIPS 사업계획서 내보내기 ===\n')

  // 1. 사업계획서 조회
  const { data: plan, error } = await supabase
    .from('business_plans')
    .select('*, program:government_programs(title, organization)')
    .eq('id', PLAN_ID)
    .single()

  if (error || !plan) {
    console.error('사업계획서 조회 실패:', error)
    return
  }

  console.log(`📄 사업계획서: ${plan.title}`)
  console.log(`   섹션 수: ${plan.sections?.length || 0}`)

  // 2. Word 문서 생성
  const doc = new Document({
    creator: '유에이블 코퍼레이션',
    title: plan.title,
    description: 'DIPS 2026 사업계획서',
    styles: {
      default: {
        document: {
          run: {
            font: 'Malgun Gothic',
            size: 22 // 11pt
          }
        }
      },
      paragraphStyles: [
        {
          id: 'Title',
          name: 'Title',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 44, // 22pt
            bold: true,
            font: 'Malgun Gothic'
          },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: { after: 400, before: 200 }
          }
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 32, // 16pt
            bold: true,
            font: 'Malgun Gothic'
          },
          paragraph: {
            spacing: { before: 400, after: 200 },
            border: {
              bottom: {
                color: '000000',
                space: 1,
                style: BorderStyle.SINGLE,
                size: 12
              }
            }
          }
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 26, // 13pt
            bold: true,
            font: 'Malgun Gothic'
          },
          paragraph: {
            spacing: { before: 300, after: 150 }
          }
        }
      ]
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: '2026년 초격차 스타트업 프로젝트(DIPS) 창업기업 사업계획서',
                    size: 18,
                    color: '666666'
                  })
                ],
                alignment: AlignmentType.CENTER
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT]
                  }),
                  new TextRun({
                    text: ' / '
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES]
                  })
                ],
                alignment: AlignmentType.CENTER
              })
            ]
          })
        },
        children: [
          // 표지
          new Paragraph({
            children: [new TextRun({ text: '' })],
            spacing: { before: 2000 }
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '2026년 초격차 스타트업 프로젝트',
                size: 36,
                bold: true
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '(DIPS) 창업기업',
                size: 36,
                bold: true
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 }
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '사 업 계 획 서',
                size: 56,
                bold: true
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 1200 }
          }),

          // 기본 정보 테이블
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '기업명', bold: true })] })],
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    shading: { fill: 'E6E6E6' }
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: '유에이블 코퍼레이션' })],
                    width: { size: 75, type: WidthType.PERCENTAGE }
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '아이템명', bold: true })] })],
                    shading: { fill: 'E6E6E6' }
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'GlowUS - AI Agent OS' })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '신청분야', bold: true })] })],
                    shading: { fill: 'E6E6E6' }
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'AI (인공지능산업융합사업단)' })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '대표자', bold: true })] })],
                    shading: { fill: 'E6E6E6' }
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: '이진수' })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '사업비', bold: true })] })],
                    shading: { fill: 'E6E6E6' }
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: '총 2.88억원 (정부지원 2억원 + 자부담 0.88억원)' })]
                  })
                ]
              })
            ]
          }),

          new Paragraph({
            children: [new TextRun({ text: '' })],
            spacing: { after: 1000 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: '2026년 1월',
                size: 28
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '유에이블 코퍼레이션',
                size: 32,
                bold: true
              })
            ],
            alignment: AlignmentType.CENTER
          }),

          // 페이지 구분
          new Paragraph({
            children: [new PageBreak()]
          }),

          // 목차
          new Paragraph({
            text: '목 차',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),

          ...generateTOC(plan.sections),

          new Paragraph({
            children: [new PageBreak()]
          }),

          // 본문 섹션들
          ...generateSections(plan.sections)
        ]
      }
    ]
  })

  // 3. 파일 저장
  const outputDir = path.join(process.cwd(), 'exports')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().slice(0, 10)
  const filename = `DIPS_사업계획서_유에이블_${timestamp}`

  // Word 파일 저장
  const docxPath = path.join(outputDir, `${filename}.docx`)
  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(docxPath, buffer)

  console.log(`\n✅ Word 문서 생성 완료!`)
  console.log(`   📁 ${docxPath}`)
  console.log(`   📊 파일 크기: ${(buffer.length / 1024).toFixed(1)} KB`)

  // PDF 생성 (puppeteer 사용)
  console.log('\n--- PDF 변환 시도 ---')

  try {
    await generatePDF(plan, outputDir, filename)
  } catch (pdfError: any) {
    console.log(`   ⚠️ PDF 생성 스킵 (puppeteer 미설치): ${pdfError.message}`)
    console.log('   💡 Word 파일을 열어서 PDF로 저장하세요.')
  }

  console.log('\n=== 내보내기 완료 ===')
}

function generateTOC(sections: any[]): Paragraph[] {
  const items: Paragraph[] = []

  for (const section of sections || []) {
    items.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${section.section_id}. ${section.title}`, size: 24 }),
          new TextRun({ text: ' '.repeat(50) }),
          new TextRun({ text: `${parseInt(section.section_id) + 2}`, size: 24 })
        ],
        spacing: { after: 150 }
      })
    )
  }

  return items
}

function generateSections(sections: any[]): Paragraph[] {
  const paragraphs: Paragraph[] = []

  for (const section of sections || []) {
    // 섹션 제목
    paragraphs.push(
      new Paragraph({
        text: `${section.section_id}. ${section.title}`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 300 }
      })
    )

    // 섹션 내용
    const content = section.content || ''
    const contentParagraphs = content.split('\n\n')

    for (const para of contentParagraphs) {
      if (!para.trim()) continue

      // 소제목 처리 (### 또는 **로 시작하는 경우)
      if (para.startsWith('###') || para.startsWith('**')) {
        const cleanTitle = para.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()
        paragraphs.push(
          new Paragraph({
            text: cleanTitle,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 250, after: 150 }
          })
        )
      } else if (para.startsWith('-') || para.startsWith('•')) {
        // 불릿 포인트 처리
        const lines = para.split('\n')
        for (const line of lines) {
          const cleanLine = line.replace(/^[-•]\s*/, '').trim()
          if (cleanLine) {
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({ text: '• ' }),
                  new TextRun({ text: cleanLine })
                ],
                indent: { left: 400 },
                spacing: { after: 100 }
              })
            )
          }
        }
      } else if (/^\d+\./.test(para)) {
        // 번호 목록 처리
        const lines = para.split('\n')
        for (const line of lines) {
          if (line.trim()) {
            paragraphs.push(
              new Paragraph({
                text: line.trim(),
                indent: { left: 400 },
                spacing: { after: 100 }
              })
            )
          }
        }
      } else {
        // 일반 문단
        paragraphs.push(
          new Paragraph({
            text: para.trim(),
            spacing: { after: 200 },
            alignment: AlignmentType.JUSTIFIED
          })
        )
      }
    }

    // 섹션 간 여백
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: '' })],
        spacing: { after: 300 }
      })
    )
  }

  return paragraphs
}

async function generatePDF(plan: any, outputDir: string, filename: string) {
  // HTML 생성
  const html = generateHTML(plan)
  const htmlPath = path.join(outputDir, `${filename}.html`)
  fs.writeFileSync(htmlPath, html)
  console.log(`   📄 HTML 생성: ${htmlPath}`)

  // Puppeteer로 PDF 생성 시도
  try {
    const puppeteer = await import('puppeteer-core')

    // Chrome 경로 찾기
    const chromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    ]

    let executablePath = ''
    for (const p of chromePaths) {
      if (fs.existsSync(p)) {
        executablePath = p
        break
      }
    }

    if (!executablePath) {
      throw new Error('Chrome을 찾을 수 없습니다')
    }

    const browser = await puppeteer.default.launch({
      executablePath,
      headless: true
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdfPath = path.join(outputDir, `${filename}.pdf`)
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
      printBackground: true
    })

    await browser.close()

    const pdfSize = fs.statSync(pdfPath).size
    console.log(`   ✅ PDF 생성: ${pdfPath}`)
    console.log(`   📊 파일 크기: ${(pdfSize / 1024).toFixed(1)} KB`)
  } catch (e) {
    throw e
  }
}

function generateHTML(plan: any): string {
  const sections = plan.sections || []

  const sectionHTML = sections.map((s: any) => `
    <div class="section">
      <h2>${s.section_id}. ${s.title}</h2>
      <div class="content">
        ${(s.content || '').split('\n\n').map((p: string) => {
          if (p.startsWith('###') || p.startsWith('**')) {
            return `<h3>${p.replace(/^#+\s*/, '').replace(/\*\*/g, '')}</h3>`
          } else if (p.startsWith('-') || p.startsWith('•')) {
            const items = p.split('\n').filter((l: string) => l.trim()).map((l: string) =>
              `<li>${l.replace(/^[-•]\s*/, '')}</li>`
            ).join('')
            return `<ul>${items}</ul>`
          } else {
            return `<p>${p}</p>`
          }
        }).join('\n')}
      </div>
    </div>
  `).join('\n')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${plan.title}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body {
      font-family: 'Malgun Gothic', sans-serif;
      font-size: 11pt;
      line-height: 1.8;
      color: #333;
    }
    .cover {
      text-align: center;
      padding-top: 100px;
      page-break-after: always;
    }
    .cover h1 { font-size: 28pt; margin-bottom: 10px; }
    .cover h2 { font-size: 18pt; color: #666; margin-bottom: 50px; }
    .cover .title { font-size: 36pt; font-weight: bold; margin: 40px 0; }
    .cover table {
      margin: 40px auto;
      border-collapse: collapse;
      width: 80%;
    }
    .cover th {
      background: #e6e6e6;
      padding: 10px;
      border: 1px solid #999;
      width: 25%;
    }
    .cover td {
      padding: 10px;
      border: 1px solid #999;
    }
    .toc { page-break-after: always; }
    .toc h2 { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .toc ul { list-style: none; padding: 0; }
    .toc li { padding: 8px 0; border-bottom: 1px dotted #ccc; }
    .section { margin-bottom: 30px; }
    .section h2 {
      font-size: 16pt;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-top: 30px;
    }
    .section h3 { font-size: 13pt; margin-top: 20px; }
    .section p { text-align: justify; margin: 10px 0; }
    .section ul { margin-left: 20px; }
    .section li { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="cover">
    <h1>2026년 초격차 스타트업 프로젝트</h1>
    <h2>(DIPS) 창업기업</h2>
    <div class="title">사 업 계 획 서</div>
    <table>
      <tr><th>기업명</th><td>유에이블 코퍼레이션</td></tr>
      <tr><th>아이템명</th><td>GlowUS - AI Agent OS</td></tr>
      <tr><th>신청분야</th><td>AI (인공지능산업융합사업단)</td></tr>
      <tr><th>대표자</th><td>이진수</td></tr>
      <tr><th>사업비</th><td>총 2.88억원 (정부지원 2억원 + 자부담 0.88억원)</td></tr>
    </table>
    <p style="margin-top: 50px; font-size: 14pt;">2026년 1월</p>
    <p style="font-size: 16pt; font-weight: bold;">유에이블 코퍼레이션</p>
  </div>

  <div class="toc">
    <h2>목 차</h2>
    <ul>
      ${sections.map((s: any) => `<li>${s.section_id}. ${s.title}</li>`).join('\n')}
    </ul>
  </div>

  ${sectionHTML}
</body>
</html>`
}

main().catch(console.error)
