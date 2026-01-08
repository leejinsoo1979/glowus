/**
 * DIPS 공고 첨부파일 전체 파싱 테스트
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

console.log('Supabase URL:', supabaseUrl?.substring(0, 30) + '...')

const supabase = createClient(supabaseUrl, supabaseKey)

interface Attachment {
  url: string
  name: string
}

/**
 * PDF에서 텍스트 추출
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const data = new Uint8Array(buffer)
  const pdf = await getDocumentProxy(data)
  const result = await extractText(pdf, { mergePages: true })
  return result.text
}

/**
 * HWP에서 텍스트 추출
 */
async function extractTextFromHWP(buffer: Buffer): Promise<string> {
  const cfb = await import('cfb')
  const container = cfb.read(buffer, { type: 'buffer' })

  // 1. PrvText 추출
  const prvTextEntry = cfb.find(container, '/PrvText')
  if (prvTextEntry && prvTextEntry.content) {
    const decoder = new TextDecoder('utf-16le')
    const text = decoder.decode(prvTextEntry.content as any)

    if (text.length > 100) {
      const cleanText = text
        .replace(/<([^>]+)>/g, '\n$1\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      return cleanText
    }
  }

  // 2. hwp.js 본문 파싱
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
  console.log('=== DIPS 공고 첨부파일 전체 파싱 테스트 ===\n')

  // DIPS 2026 프로그램 조회 (저장한 프로그램)
  const { data: programs, error } = await supabase
    .from('government_programs')
    .select('id, title, attachments_primary, attachments_extra')
    .eq('id', 'b5ba0abf-8fb6-47ee-ab0c-d450207be9c3')
    .limit(1)

  const program = programs?.[0]

  if (error || !program) {
    console.error('DIPS 프로그램을 찾을 수 없습니다:', error)
    return
  }

  console.log(`프로그램: ${program.title}`)
  console.log(`ID: ${program.id}\n`)

  const allAttachments: Attachment[] = [
    ...(program.attachments_primary || []),
    ...(program.attachments_extra || [])
  ]

  console.log(`총 ${allAttachments.length}개 첨부파일:\n`)

  for (const att of allAttachments) {
    console.log(`- ${att.name}`)
  }

  console.log('\n--- 파싱 시작 ---\n')

  const results: { name: string; type: string; chars: number; text: string }[] = []

  for (const att of allAttachments) {
    const name = att.name.toLowerCase()

    // PDF 또는 HWP만 파싱
    if (!name.endsWith('.pdf') && !name.match(/\.hwpx?$/)) {
      console.log(`⏭️  [SKIP] ${att.name} (지원 안 함)`)
      continue
    }

    console.log(`📄 파싱 중: ${att.name}`)

    try {
      const buffer = await downloadFile(att.url)
      console.log(`   다운로드: ${buffer.length} bytes`)

      let text = ''

      if (name.endsWith('.pdf')) {
        text = await extractTextFromPDF(buffer)
      } else if (name.match(/\.hwpx?$/)) {
        text = await extractTextFromHWP(buffer)
      }

      // 파일 타입 분류
      let type = 'reference'
      if (att.name.includes('공고') || att.name.includes('모집')) {
        type = 'announcement'
      } else if (att.name.includes('사업계획서') || att.name.includes('신청서') || att.name.includes('별첨1')) {
        type = 'template'
      }

      results.push({
        name: att.name,
        type,
        chars: text.length,
        text
      })

      console.log(`   ✅ 성공: ${text.length}자 추출 (${type})`)
      console.log(`   미리보기: ${text.substring(0, 100).replace(/\n/g, ' ')}...\n`)

    } catch (err: any) {
      console.log(`   ❌ 실패: ${err.message}\n`)
    }
  }

  console.log('\n=== 결과 요약 ===\n')
  console.log(`성공: ${results.length}개 파일\n`)

  for (const r of results) {
    console.log(`[${r.type.toUpperCase()}] ${r.name}`)
    console.log(`  - ${r.chars.toLocaleString()}자`)
    console.log(`  - ${r.text.substring(0, 80).replace(/\n/g, ' ')}...`)
    console.log()
  }

  // 사업계획서 양식 파일 상세 출력
  const templateFile = results.find(r => r.type === 'template')
  if (templateFile) {
    console.log('\n=== 사업계획서 양식 상세 (1500자) ===\n')
    console.log(`파일명: ${templateFile.name}`)
    console.log(`텍스트 길이: ${templateFile.chars.toLocaleString()}자`)
    console.log('\n--- 내용 ---\n')
    console.log(templateFile.text.substring(0, 1500))
    console.log('\n--- 끝 ---')
  }
}

main().catch(console.error)
