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
    const { url } = await req.json()

    if (!url) {
      return NextResponse.json({ error: 'URL이 필요합니다' }, { status: 400 })
    }

    // Fetch webpage content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    if (!response.ok) {
      return NextResponse.json({ error: '웹페이지를 가져올 수 없습니다' }, { status: 400 })
    }

    const html = await response.text()

    // Extract text content from HTML using regex (simple approach)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : url

    // Remove script, style, and extract text
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50000)

    // Use Gemini to summarize the content
    const client = getGeminiClient()
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const result = await model.generateContent(`
다음 웹페이지 내용을 분석하고 요약해주세요:

URL: ${url}
제목: ${title}

내용:
${content.slice(0, 30000)}

다음 형식으로 응답해주세요:
1. 핵심 요약 (2-3문장)
2. 주요 포인트 (3-5개)
`)

    const responseText = await result.response.text()

    return NextResponse.json({
      success: true,
      title,
      url,
      content,
      summary: responseText.slice(0, 500)
    })
  } catch (error) {
    console.error('Web crawl error:', error)
    return NextResponse.json(
      { error: '웹페이지 분석 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
