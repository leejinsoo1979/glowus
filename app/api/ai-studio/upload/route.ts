import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Lazy initialization to avoid issues
let genAI: GoogleGenerativeAI | null = null

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is not configured')
    }
    genAI = new GoogleGenerativeAI(apiKey)
  }
  return genAI
}

// 지원되는 파일 형식
const SUPPORTED_MIME_TYPES: Record<string, string> = {
  // Documents
  'application/pdf': 'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword': 'application/msword', // doc
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'application/vnd.ms-powerpoint': 'application/vnd.ms-powerpoint', // ppt
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel': 'application/vnd.ms-excel', // xls
  'text/plain': 'text/plain', // txt
  'text/csv': 'text/csv', // csv
  'text/html': 'text/html', // html
  'application/rtf': 'application/rtf', // rtf
  // Images
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
  // HWP는 Gemini가 직접 지원하지 않음 - 텍스트 추출 필요
}

// 파일 확장자로 MIME 타입 추론 (브라우저가 잘못 보낼 경우 대비)
function getMimeTypeFromExtension(filename: string): string | null {
  const ext = filename.toLowerCase().split('.').pop()
  const extMap: Record<string, string> = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'ppt': 'application/vnd.ms-powerpoint',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls': 'application/vnd.ms-excel',
    'txt': 'text/plain',
    'csv': 'text/csv',
    'html': 'text/html',
    'rtf': 'application/rtf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'gif': 'image/gif',
  }
  return ext ? extMap[ext] || null : null
}

export async function POST(req: Request) {
  try {
    console.log('[AI Studio Upload] Starting file upload...')

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      console.log('[AI Studio Upload] No file provided')
      return NextResponse.json({ error: '파일이 제공되지 않았습니다' }, { status: 400 })
    }

    console.log('[AI Studio Upload] File received:', file.name, file.type, file.size)

    // MIME 타입 결정 (파일에서 제공된 것 또는 확장자에서 추론)
    let mimeType = file.type
    if (!SUPPORTED_MIME_TYPES[mimeType]) {
      const inferredType = getMimeTypeFromExtension(file.name)
      if (inferredType && SUPPORTED_MIME_TYPES[inferredType]) {
        mimeType = inferredType
      }
    }

    if (!SUPPORTED_MIME_TYPES[mimeType]) {
      return NextResponse.json({
        error: `지원하지 않는 파일 형식입니다. 지원 형식: PDF, DOCX, PPTX, XLSX, TXT, CSV, PNG, JPG`
      }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    console.log('[AI Studio Upload] File converted to base64, length:', base64.length)

    // Use Gemini to extract and summarize content
    const client = getGeminiClient()
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' })

    // 파일 타입에 따른 프롬프트 조정
    const isImage = mimeType.startsWith('image/')
    const prompt = isImage
      ? `이 이미지를 분석해주세요. 다음 형식으로 응답해주세요:

## 요약
이미지에서 보이는 핵심 내용을 3-5문장으로 설명

## 주요 내용
이미지의 주요 정보를 bullet point로 정리

## 상세 설명
이미지에 포함된 모든 텍스트와 시각적 요소를 상세히 설명`
      : `이 문서를 분석해주세요. 다음 형식으로 응답해주세요:

## 요약
문서의 핵심 내용을 3-5문장으로 요약

## 주요 내용
문서의 주요 포인트를 bullet point로 정리

## 전체 텍스트
문서의 전체 텍스트 내용을 추출 (최대 50000자)`

    console.log('[AI Studio Upload] Sending to Gemini with mimeType:', mimeType)
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64
        }
      },
      { text: prompt }
    ])

    const response = await result.response
    const text = response.text()
    console.log('[AI Studio Upload] Gemini response received, length:', text.length)

    // Parse the response to extract summary and content
    const summaryMatch = text.match(/## 요약\n([\s\S]*?)(?=## 주요 내용|$)/)
    const summary = summaryMatch ? summaryMatch[1].trim() : text.slice(0, 500)

    return NextResponse.json({
      success: true,
      content: text,
      summary: summary.slice(0, 300),
      metadata: {
        filename: file.name,
        size: file.size,
        type: file.type
      }
    })
  } catch (error) {
    console.error('[AI Studio Upload] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `파일 처리 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}
