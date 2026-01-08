/**
 * DIPS 사업계획서 HWP 직접 파싱 테스트
 * 이전 테스트에서 확인된 URL 사용
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

/**
 * HWP에서 텍스트 추출
 */
async function extractTextFromHWP(buffer: Buffer): Promise<string> {
  const cfb = await import('cfb')
  const container = cfb.read(buffer, { type: 'buffer' })

  // PrvText 추출
  const prvTextEntry = cfb.find(container, '/PrvText')
  if (prvTextEntry && prvTextEntry.content) {
    const decoder = new TextDecoder('utf-16le')
    const text = decoder.decode(prvTextEntry.content as any)

    if (text.length > 100) {
      return text
        .replace(/<([^>]+)>/g, '\n$1\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }
  }

  // hwp.js 본문 파싱
  const HWP = await import('hwp.js')
  const doc = HWP.parse(buffer, { type: 'buffer' } as any)

  let text = ''
  if (doc.sections) {
    for (const section of doc.sections) {
      if (section.content) {
        for (const paragraph of section.content) {
          if (paragraph.content && Array.isArray(paragraph.content)) {
            for (const charInfo of paragraph.content) {
              if (charInfo.type === 0 && typeof charInfo.value === 'number') {
                if (charInfo.value >= 32 && charInfo.value < 0xFFFF) {
                  text += String.fromCharCode(charInfo.value)
                }
              } else if (charInfo.type === 2) {
                if (typeof charInfo.value === 'number' && [2, 10, 13].includes(charInfo.value)) text += '\n'
              }
            }
          }
          text += '\n'
        }
      }
    }
  }

  return text.replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * 파일 다운로드
 */
async function downloadFile(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })
  if (!response.ok) throw new Error(`Download failed: ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

async function main() {
  console.log('=== DIPS 사업계획서 HWP 직접 파싱 테스트 ===\n')

  // 이전 테스트에서 확인된 사업계획서 양식 URL
  // 별첨1) 2026년 초격차 스타트업 프로젝트(DIPS) 창업기업 사업계획서.hwp
  const hwpUrl = 'https://www.k-startup.go.kr/afile/fileDownload/SqiLn'

  console.log('1. HWP 파일 다운로드...')
  console.log(`   URL: ${hwpUrl}`)

  const buffer = await downloadFile(hwpUrl)
  console.log(`   다운로드 완료: ${buffer.length} bytes`)

  console.log('\n2. HWP 파싱...')
  const text = await extractTextFromHWP(buffer)
  console.log(`   파싱 완료: ${text.length}자`)

  console.log('\n=== 사업계획서 양식 전체 내용 ===\n')
  console.log(text)
  console.log('\n=== 끝 ===')

  // 섹션 분석
  console.log('\n\n=== 섹션 분석 ===')
  const sections = text.split(/\n(?=□|■|[0-9]+\.|[가-힣]\.|[IVX]+\.)/).filter(s => s.trim())
  console.log(`발견된 섹션: ${sections.length}개\n`)

  for (let i = 0; i < Math.min(10, sections.length); i++) {
    const section = sections[i]
    const title = section.split('\n')[0].substring(0, 60)
    console.log(`${i + 1}. ${title}`)
  }
}

main().catch(console.error)
