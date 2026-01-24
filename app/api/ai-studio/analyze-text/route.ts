import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Lazy initialization
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

export async function POST(req: Request) {
  try {
    const { text } = await req.json()

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: '텍스트가 필요합니다' }, { status: 400 })
    }

    // Use Gemini to analyze and summarize the text
    const client = getGeminiClient()
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const result = await model.generateContent(`
다음 텍스트를 분석하고 요약해주세요:

${text.slice(0, 30000)}

다음 형식으로 응답해주세요:
1. 핵심 요약 (2-3문장)
2. 주요 포인트 (3-5개)
3. 텍스트의 주제/목적
`)

    const summary = await result.response.text()

    return NextResponse.json({
      success: true,
      summary: summary.slice(0, 500)
    })
  } catch (error) {
    console.error('Text analysis error:', error)
    return NextResponse.json(
      { error: '텍스트 분석 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
