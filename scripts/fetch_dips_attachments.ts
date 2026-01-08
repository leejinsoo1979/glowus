/**
 * DIPS 공고에서 첨부파일 추출 및 파싱 테스트
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface AttachmentInfo {
  name: string
  url: string
}

/**
 * 기업마당 상세 페이지에서 첨부파일 추출
 */
async function extractAttachmentsFromBizinfo(detailUrl: string): Promise<AttachmentInfo[]> {
  const attachments: AttachmentInfo[] = []
  const baseUrl = 'https://www.bizinfo.go.kr'
  const fullUrl = detailUrl.startsWith('http') ? detailUrl : baseUrl + detailUrl

  console.log(`\n📥 페이지 로드 중: ${fullUrl}`)

  const response = await fetch(fullUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml'
    }
  })

  if (!response.ok) {
    console.error(`페이지 로드 실패: ${response.status}`)
    return attachments
  }

  const html = await response.text()
  console.log(`HTML 크기: ${html.length}자`)

  // 첨부파일 패턴 찾기
  const patterns = [
    // 파일 다운로드 링크
    /<a[^>]*href="([^"]*fileDownload[^"]*)"[^>]*>([^<]+)<\/a>/gi,
    /<a[^>]*href="([^"]*\/afile\/[^"]*)"[^>]*>([^<]+)<\/a>/gi,
    // 직접 파일 링크
    /<a[^>]*href="([^"]*\.(pdf|hwp|hwpx|docx?|xlsx?|zip)[^"]*)"[^>]*>([^<]+)<\/a>/gi
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(html)) !== null) {
      let url = match[1]
      let name = match[2] || match[3] || 'unknown'

      // HTML 태그 제거
      name = name.replace(/<[^>]*>/g, '').trim()

      // 상대 경로면 절대 경로로
      if (!url.startsWith('http')) {
        url = baseUrl + url
      }

      // 중복 체크
      if (!attachments.some(a => a.url === url)) {
        attachments.push({ name, url })
      }
    }
  }

  // 추가: 첨부파일 영역 찾기
  const attachmentSectionMatch = html.match(/첨부파일[\s\S]*?<\/div>/gi)
  if (attachmentSectionMatch) {
    for (const section of attachmentSectionMatch) {
      const linkMatches = section.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi)
      for (const m of linkMatches) {
        let url = m[1]
        let name = m[2].replace(/<[^>]*>/g, '').trim()

        if (!url.startsWith('http')) {
          url = baseUrl + url
        }

        if (!attachments.some(a => a.url === url)) {
          attachments.push({ name, url })
        }
      }
    }
  }

  return attachments
}

/**
 * K-Startup에서 첨부파일 추출
 */
async function extractAttachmentsFromKStartup(): Promise<AttachmentInfo[]> {
  const attachments: AttachmentInfo[] = []

  // K-Startup DIPS 공고 페이지
  const kstartupUrl = 'https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=180469'

  console.log(`\n📥 K-Startup 페이지 로드 중...`)

  const response = await fetch(kstartupUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })

  if (!response.ok) {
    console.error(`K-Startup 로드 실패: ${response.status}`)
    return attachments
  }

  const html = await response.text()
  console.log(`HTML 크기: ${html.length}자`)

  // fileDownload 링크 추출
  const linkPattern = /href="([^"]*fileDownload[^"]*)"/gi
  const namePattern = /<td[^>]*>([^<]+\.(pdf|hwp|hwpx|docx?|xlsx?|zip))/gi

  let match
  while ((match = linkPattern.exec(html)) !== null) {
    let url = match[1]
    if (!url.startsWith('http')) {
      url = 'https://www.k-startup.go.kr' + url
    }

    // 파일명은 URL에서 추출 시도
    const nameMatch = url.match(/\/([^\/]+)$/)
    let name = nameMatch ? decodeURIComponent(nameMatch[1]) : 'unknown'

    if (!attachments.some(a => a.url === url)) {
      attachments.push({ name, url })
    }
  }

  // 별도 패턴으로 파일명 추출
  const fileRows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
  for (const row of fileRows) {
    if (row.includes('fileDownload') || row.includes('.hwp') || row.includes('.pdf')) {
      const urlMatch = row.match(/href="([^"]+)"/i)
      const nameMatch = row.match(/>([^<]+\.(pdf|hwp|hwpx|docx?|xlsx?|zip))</i)

      if (urlMatch && nameMatch) {
        let url = urlMatch[1]
        if (!url.startsWith('http')) {
          url = 'https://www.k-startup.go.kr' + url
        }

        const name = nameMatch[1].trim()

        if (!attachments.some(a => a.url === url || a.name === name)) {
          attachments.push({ name, url })
        }
      }
    }
  }

  return attachments
}

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
  console.log('=== DIPS 첨부파일 추출 및 파싱 테스트 ===\n')

  // 1. DIPS 프로그램 조회
  const { data: programs } = await supabase
    .from('government_programs')
    .select('id, title, detail_url')
    .ilike('title', '%초격차%')
    .limit(1)

  const program = programs?.[0]

  if (!program) {
    console.error('DIPS 프로그램을 찾을 수 없습니다')
    return
  }

  console.log(`프로그램: ${program.title}`)
  console.log(`ID: ${program.id}`)
  console.log(`Detail URL: ${program.detail_url}`)

  // 2. 기업마당에서 첨부파일 추출
  console.log('\n=== 1. 기업마당에서 첨부파일 추출 ===')
  const bizinfoAttachments = await extractAttachmentsFromBizinfo(program.detail_url)
  console.log(`발견: ${bizinfoAttachments.length}개`)
  for (const att of bizinfoAttachments) {
    console.log(`  - ${att.name}`)
  }

  // 3. K-Startup에서 첨부파일 추출
  console.log('\n=== 2. K-Startup에서 첨부파일 추출 ===')
  const kstartupAttachments = await extractAttachmentsFromKStartup()
  console.log(`발견: ${kstartupAttachments.length}개`)
  for (const att of kstartupAttachments) {
    console.log(`  - ${att.name}`)
    console.log(`    URL: ${att.url.substring(0, 80)}...`)
  }

  // 4. 사업계획서 양식 파일 파싱
  const templateFile = kstartupAttachments.find(a =>
    a.name.includes('사업계획서') && a.name.includes('.hwp')
  )

  if (templateFile) {
    console.log(`\n=== 3. 사업계획서 양식 파싱 ===`)
    console.log(`파일: ${templateFile.name}`)

    try {
      console.log('다운로드 중...')
      const buffer = await downloadFile(templateFile.url)
      console.log(`다운로드 완료: ${buffer.length} bytes`)

      console.log('HWP 파싱 중...')
      const text = await extractTextFromHWP(buffer)
      console.log(`파싱 완료: ${text.length}자`)

      console.log('\n--- 사업계획서 양식 내용 (2000자) ---\n')
      console.log(text.substring(0, 2000))
      console.log('\n--- 끝 ---')

    } catch (err: any) {
      console.error('파싱 실패:', err.message)
    }
  }

  // 5. 모든 첨부파일 목록 저장
  const allAttachments = [
    ...bizinfoAttachments.map(a => ({ ...a, source: 'bizinfo' })),
    ...kstartupAttachments.map(a => ({ ...a, source: 'kstartup' }))
  ]

  // 중복 제거 (이름 기준)
  const uniqueAttachments = allAttachments.filter((att, idx, arr) =>
    arr.findIndex(a => a.name === att.name) === idx
  )

  console.log(`\n=== 최종 첨부파일 목록 (${uniqueAttachments.length}개) ===`)
  for (const att of uniqueAttachments) {
    console.log(`- [${(att as any).source}] ${att.name}`)
  }
}

main().catch(console.error)
