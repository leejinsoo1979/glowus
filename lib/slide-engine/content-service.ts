/**
 * Content Service - 슬라이드 콘텐츠 생성 서비스
 *
 * LLM을 사용하여 슬라이드 구조와 콘텐츠를 생성
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

// GOOGLE_API_KEY 또는 GOOGLE_GENERATIVE_AI_API_KEY 사용
const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
if (!apiKey) {
  console.warn('[ContentService] ⚠️ Google API Key not found! Set GOOGLE_API_KEY in .env.local')
}
const genAI = new GoogleGenerativeAI(apiKey)

export interface SlideContent {
  slideNumber: number
  title: string
  subtitle?: string
  content: string[]
  points?: string[]
  imagePrompt?: string
  layout: 'title' | 'content' | 'image-left' | 'image-right' | 'full-image' | 'two-column' | 'conclusion'
  notes?: string
}

export interface GeneratedPresentation {
  title: string
  subtitle?: string
  slides: SlideContent[]
  theme: string
}

/**
 * AI로 슬라이드 구조 생성 (서버 사이드 직접 호출)
 */
export async function generateSlideStructure(
  content: string,
  slideCount: number,
  theme: string,
  language: string = 'ko'
): Promise<GeneratedPresentation> {
  if (!apiKey) {
    throw new Error('Google API Key가 설정되지 않았습니다. GOOGLE_API_KEY 환경변수를 확인하세요.')
  }

  console.log('[ContentService] Generating slides with Gemini...')
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

  const prompt = `당신은 세계 최고의 프레젠테이션 디자이너입니다.
다음 내용을 기반으로 ${slideCount}장의 전문적인 프레젠테이션 슬라이드를 설계해주세요.

내용:
"""
${content.substring(0, 5000)}
"""

각 슬라이드에 대해:
1. 제목은 임팩트 있고 간결하게
2. 내용은 3-4개의 핵심 포인트로
3. 각 슬라이드에 어울리는 이미지 프롬프트 생성 (영어로, 상세하게)
4. 레이아웃은 다양하게 (title, content, image-left, image-right, two-column, conclusion)

JSON 형식으로 출력:
{
  "title": "프레젠테이션 제목",
  "subtitle": "부제목",
  "slides": [
    {
      "slideNumber": 1,
      "title": "슬라이드 제목",
      "subtitle": "부제목 (선택)",
      "content": ["포인트1", "포인트2", "포인트3"],
      "imagePrompt": "professional photograph of..., high quality, 4k, modern style",
      "layout": "title",
      "notes": "발표자 노트"
    }
  ]
}

규칙:
- 첫 슬라이드는 반드시 layout: "title"
- 마지막 슬라이드는 layout: "conclusion"
- imagePrompt는 영어로, 슬라이드 내용과 관련된 전문적인 이미지 설명
- JSON만 출력`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('슬라이드 구조 생성 실패')
  }

  const presentation = JSON.parse(jsonMatch[0]) as GeneratedPresentation
  presentation.theme = theme

  return presentation
}

/**
 * 간단한 슬라이드 콘텐츠 생성 (디자이너용 래퍼)
 */
export async function generateSlideContent(
  prompt: string,
  slideCount: number,
  themeName: string,
  language: string
): Promise<SlideContent[]> {
  try {
    console.log(`[ContentService] Generating ${slideCount} slides for theme: ${themeName}`)
    const presentation = await generateSlideStructure(prompt, slideCount, themeName, language)
    console.log(`[ContentService] ✅ Generated ${presentation.slides.length} slides`)
    return presentation.slides
  } catch (error) {
    console.error('[ContentService] ❌ Content generation error:', error)
    // 에러를 상위로 전파하여 사용자에게 명확한 에러 메시지 표시
    throw error
  }
}
