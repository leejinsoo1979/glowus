/**
 * AI 요약 스킬 API
 * 긴 텍스트를 핵심 내용으로 요약합니다
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
  try {
    const { text, maxLength = 500, language = 'ko', format = 'bullet' } = await request.json()

    if (!text) {
      return NextResponse.json(
        { success: false, error: '요약할 텍스트가 필요합니다' },
        { status: 400 }
      )
    }

    console.log(`[Summarize] Summarizing text (${text.length} chars)`)

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    const formatInstructions = format === 'bullet'
      ? '- 핵심 포인트를 불릿 포인트로 정리\n- 각 포인트는 한 문장으로'
      : '- 자연스러운 문단 형식으로 작성'

    const prompt = `다음 텍스트를 ${language === 'ko' ? '한국어로' : '영어로'} 요약해주세요.

요약 규칙:
- 최대 ${maxLength}자 이내
${formatInstructions}
- 핵심 정보만 포함
- 원문의 의미를 왜곡하지 않기

텍스트:
"""
${text.substring(0, 10000)}
"""

요약:`

    const result = await model.generateContent(prompt)
    const summary = result.response.text()

    return NextResponse.json({
      success: true,
      summary,
      originalLength: text.length,
      summaryLength: summary.length,
      compressionRatio: Math.round((1 - summary.length / text.length) * 100),
    })
  } catch (error: any) {
    console.error('[Summarize] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '요약 생성 실패' },
      { status: 500 }
    )
  }
}

// GET - 스킬 정보 조회
export async function GET() {
  return NextResponse.json({
    id: 'summarize',
    name: 'AI 요약',
    description: '긴 텍스트를 핵심 내용으로 요약합니다',
    parameters: {
      text: { type: 'string', description: '요약할 텍스트', required: true },
      maxLength: { type: 'number', description: '최대 요약 길이 (기본: 500)', required: false },
      language: { type: 'string', description: '출력 언어 (ko/en)', required: false },
      format: { type: 'string', description: '출력 형식 (bullet/paragraph)', required: false },
    },
  })
}
