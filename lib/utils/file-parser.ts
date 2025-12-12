// File Content Parser for Agent Chat
// 에이전트가 파일 내용을 읽을 수 있도록 파싱

import * as XLSX from 'xlsx'

export interface ParsedFileContent {
  success: boolean
  content: string
  fileType: string
  fileName: string
  summary?: string
  error?: string
}

// 지원하는 파일 타입
export const SUPPORTED_FILE_TYPES = {
  text: ['text/plain', 'text/csv', 'text/markdown'],
  pdf: ['application/pdf'],
  excel: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  word: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
}

/**
 * URL에서 파일 다운로드
 */
async function fetchFileBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * 텍스트 파일 파싱 (txt, csv, md 등)
 */
async function parseTextFile(buffer: Buffer, fileName: string): Promise<ParsedFileContent> {
  try {
    const content = buffer.toString('utf-8')
    const lines = content.split('\n')
    const preview = lines.slice(0, 100).join('\n')

    return {
      success: true,
      content: preview,
      fileType: 'text',
      fileName,
      summary: `텍스트 파일 (${lines.length}줄)`,
    }
  } catch (error) {
    return {
      success: false,
      content: '',
      fileType: 'text',
      fileName,
      error: `텍스트 파싱 실패: ${error}`,
    }
  }
}

/**
 * CSV 파일 파싱
 */
async function parseCSVFile(buffer: Buffer, fileName: string): Promise<ParsedFileContent> {
  try {
    const content = buffer.toString('utf-8')
    const lines = content.split('\n').filter(line => line.trim())
    const headers = lines[0]?.split(',').map(h => h.trim()) || []
    const rows = lines.slice(1, 21) // 최대 20행

    let tableContent = `📊 CSV 파일: ${fileName}\n`
    tableContent += `컬럼: ${headers.join(', ')}\n`
    tableContent += `총 행: ${lines.length - 1}개\n\n`
    tableContent += `데이터 미리보기 (최대 20행):\n`

    rows.forEach((row, idx) => {
      tableContent += `${idx + 1}. ${row}\n`
    })

    return {
      success: true,
      content: tableContent,
      fileType: 'csv',
      fileName,
      summary: `CSV 파일 (${headers.length}컬럼, ${lines.length - 1}행)`,
    }
  } catch (error) {
    return {
      success: false,
      content: '',
      fileType: 'csv',
      fileName,
      error: `CSV 파싱 실패: ${error}`,
    }
  }
}

/**
 * PDF 파일 파싱
 */
async function parsePDFFile(buffer: Buffer, fileName: string): Promise<ParsedFileContent> {
  try {
    // pdf-parse는 CommonJS 모듈이므로 require 사용
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)

    const content = (data.text || '').slice(0, 5000) // 최대 5000자
    const pages = data.numpages || 0

    return {
      success: true,
      content: `📄 PDF 문서: ${fileName}\n페이지: ${pages}페이지\n\n내용:\n${content}`,
      fileType: 'pdf',
      fileName,
      summary: `PDF 문서 (${pages}페이지)`,
    }
  } catch (error) {
    return {
      success: false,
      content: '',
      fileType: 'pdf',
      fileName,
      error: `PDF 파싱 실패: ${error}`,
    }
  }
}

/**
 * Excel 파일 파싱
 */
async function parseExcelFile(buffer: Buffer, fileName: string): Promise<ParsedFileContent> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetNames = workbook.SheetNames

    let content = `📊 엑셀 파일: ${fileName}\n`
    content += `시트: ${sheetNames.join(', ')}\n\n`

    // 첫 번째 시트 파싱
    const firstSheet = workbook.Sheets[sheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][]

    if (jsonData.length > 0) {
      const headers = jsonData[0] || []
      const rows = jsonData.slice(1, 21) // 최대 20행

      content += `[${sheetNames[0]}] 시트 (${jsonData.length - 1}행)\n`
      content += `컬럼: ${headers.join(' | ')}\n\n`

      rows.forEach((row, idx) => {
        content += `${idx + 1}. ${row.join(' | ')}\n`
      })
    }

    return {
      success: true,
      content,
      fileType: 'excel',
      fileName,
      summary: `엑셀 파일 (${sheetNames.length}시트)`,
    }
  } catch (error) {
    return {
      success: false,
      content: '',
      fileType: 'excel',
      fileName,
      error: `엑셀 파싱 실패: ${error}`,
    }
  }
}

/**
 * 이미지 파일 분석 (GPT-4o Vision 사용)
 */
async function parseImageFile(buffer: Buffer, fileName: string, fileType: string, imageUrl?: string): Promise<ParsedFileContent> {
  const sizeKB = Math.round(buffer.length / 1024)

  // OpenAI API 키가 없으면 기본 정보만 반환
  if (!process.env.OPENAI_API_KEY) {
    return {
      success: true,
      content: `🖼️ 이미지 파일: ${fileName}\n크기: ${sizeKB}KB\n타입: ${fileType}\n\n(이미지 분석을 위해 OPENAI_API_KEY 필요)`,
      fileType: 'image',
      fileName,
      summary: `이미지 (${sizeKB}KB)`,
    }
  }

  try {
    // Base64로 인코딩
    const base64Image = buffer.toString('base64')
    const dataUrl = `data:${fileType};base64,${base64Image}`

    // GPT-4o Vision으로 이미지 분석
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',  // 비용 효율적인 gpt-4o-mini 사용
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '이 이미지를 한국어로 상세하게 설명해주세요. 다음을 포함해주세요:\n1. 이미지에 보이는 주요 내용\n2. 텍스트가 있다면 읽어주세요\n3. 차트/그래프라면 데이터 해석\n4. 문서라면 핵심 내용 요약'
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
                detail: 'auto'
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
    })

    const analysis = response.choices[0]?.message?.content || '이미지 분석 결과를 가져올 수 없습니다.'

    return {
      success: true,
      content: `🖼️ 이미지 파일: ${fileName}\n크기: ${sizeKB}KB\n\n📝 AI 분석 결과:\n${analysis}`,
      fileType: 'image',
      fileName,
      summary: `이미지 분석 완료 (${sizeKB}KB)`,
    }
  } catch (error) {
    console.error('[ImageParser] Vision API error:', error)
    return {
      success: true,
      content: `🖼️ 이미지 파일: ${fileName}\n크기: ${sizeKB}KB\n타입: ${fileType}\n\n(이미지 분석 실패: ${error})`,
      fileType: 'image',
      fileName,
      summary: `이미지 (${sizeKB}KB)`,
    }
  }
}

/**
 * 파일 URL에서 내용 추출
 */
export async function parseFileFromUrl(
  url: string,
  fileName: string,
  mimeType: string
): Promise<ParsedFileContent> {
  try {
    console.log(`[FileParser] Parsing file: ${fileName} (${mimeType})`)

    const buffer = await fetchFileBuffer(url)

    // 파일 타입별 파싱
    if (SUPPORTED_FILE_TYPES.text.includes(mimeType)) {
      if (mimeType === 'text/csv' || fileName.endsWith('.csv')) {
        return await parseCSVFile(buffer, fileName)
      }
      return await parseTextFile(buffer, fileName)
    }

    if (SUPPORTED_FILE_TYPES.pdf.includes(mimeType)) {
      return await parsePDFFile(buffer, fileName)
    }

    if (SUPPORTED_FILE_TYPES.excel.includes(mimeType)) {
      return await parseExcelFile(buffer, fileName)
    }

    if (SUPPORTED_FILE_TYPES.image.includes(mimeType)) {
      return await parseImageFile(buffer, fileName, mimeType)
    }

    // 지원하지 않는 타입
    return {
      success: false,
      content: '',
      fileType: 'unknown',
      fileName,
      error: `지원하지 않는 파일 형식: ${mimeType}`,
    }
  } catch (error) {
    console.error('[FileParser] Error:', error)
    return {
      success: false,
      content: '',
      fileType: 'unknown',
      fileName,
      error: `파일 파싱 오류: ${error}`,
    }
  }
}

/**
 * 채팅 메시지에서 파일 정보 추출하여 파싱
 */
export async function parseMessageFiles(
  messages: Array<{
    message_type: string
    content: string
    metadata?: {
      url?: string
      fileName?: string
      fileType?: string
    }
  }>
): Promise<ParsedFileContent[]> {
  const fileMessages = messages.filter(
    m => (m.message_type === 'file' || m.message_type === 'image') && m.metadata?.url
  )

  const results: ParsedFileContent[] = []

  for (const msg of fileMessages) {
    const { url, fileName, fileType } = msg.metadata || {}
    if (url && fileName && fileType) {
      const parsed = await parseFileFromUrl(url, fileName, fileType)
      results.push(parsed)
    }
  }

  return results
}

/**
 * 파일 내용을 에이전트 컨텍스트용 문자열로 변환
 */
export function formatFilesForContext(files: ParsedFileContent[]): string {
  if (files.length === 0) return ''

  const successfulFiles = files.filter(f => f.success)
  if (successfulFiles.length === 0) return ''

  let context = '\n\n📎 공유된 파일 내용:\n'
  context += '─'.repeat(40) + '\n'

  for (const file of successfulFiles) {
    context += `\n${file.content}\n`
    context += '─'.repeat(40) + '\n'
  }

  return context
}
