/**
 * PPT 슬라이드 생성 스킬 API
 * 텍스트 내용을 기반으로 프레젠테이션 슬라이드를 생성합니다
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '')

interface Slide {
  slideNumber: number
  title: string
  content: string[]
  notes?: string
  layout: 'title' | 'content' | 'two-column' | 'image' | 'conclusion'
}

export async function POST(request: NextRequest) {
  try {
    const {
      content,
      title,
      slideCount = 5,
      language = 'ko',
      style = 'professional'
    } = await request.json()

    if (!content) {
      return NextResponse.json(
        { success: false, error: '슬라이드 내용이 필요합니다' },
        { status: 400 }
      )
    }

    console.log(`[PPTGenerator] Generating ${slideCount} slides`)

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    const prompt = `당신은 프레젠테이션 전문가입니다. 다음 내용을 기반으로 ${slideCount}장의 PPT 슬라이드를 만들어주세요.

스타일: ${style}
언어: ${language === 'ko' ? '한국어' : '영어'}

내용:
"""
${content.substring(0, 5000)}
"""

다음 JSON 형식으로 슬라이드를 생성하세요:
{
  "presentation": {
    "title": "프레젠테이션 제목",
    "slides": [
      {
        "slideNumber": 1,
        "title": "슬라이드 제목",
        "content": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"],
        "notes": "발표자 노트 (선택)",
        "layout": "title 또는 content 또는 conclusion"
      }
    ]
  }
}

규칙:
1. 첫 슬라이드는 제목 슬라이드 (layout: "title")
2. 마지막 슬라이드는 결론/요약 (layout: "conclusion")
3. 각 슬라이드의 content는 3-5개의 핵심 포인트
4. 간결하고 명확한 문구 사용
5. JSON만 출력, 다른 텍스트 없이`

    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('슬라이드 생성 실패: JSON 형식 오류')
    }

    const presentation = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      success: true,
      presentation: presentation.presentation || presentation,
      slideCount: (presentation.presentation?.slides || presentation.slides)?.length || 0,
      generatedTitle: title || presentation.presentation?.title || '프레젠테이션',
    })
  } catch (error: any) {
    console.error('[PPTGenerator] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'PPT 생성 실패' },
      { status: 500 }
    )
  }
}

// GET - 스킬 정보 조회
export async function GET() {
  return NextResponse.json({
    id: 'ppt-generator',
    name: 'PPT 슬라이드 생성',
    description: '텍스트 내용을 기반으로 프레젠테이션 슬라이드를 생성합니다',
    parameters: {
      content: { type: 'string', description: '슬라이드로 만들 내용', required: true },
      title: { type: 'string', description: '프레젠테이션 제목', required: false },
      slideCount: { type: 'number', description: '슬라이드 수 (기본: 5)', required: false },
      language: { type: 'string', description: '언어 (ko/en)', required: false },
      style: { type: 'string', description: '스타일 (professional/casual/creative)', required: false },
    },
  })
}
