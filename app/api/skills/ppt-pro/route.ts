/**
 * PPT Pro - 젠스파크 수준의 AI 프레젠테이션 생성기
 *
 * Features:
 * - AI 기반 슬라이드 구조 생성
 * - 각 슬라이드에 맞는 AI 이미지 자동 생성
 * - 세련된 디자인 템플릿
 * - 실제 PPTX 파일 다운로드
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import PptxGenJS from 'pptxgenjs'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')

// 디자인 테마 정의
const THEMES = {
  modern: {
    name: 'Modern',
    background: '1a1a2e',
    primary: '4361ee',
    secondary: '7209b7',
    accent: 'f72585',
    text: 'ffffff',
    textSecondary: 'b8b8d1',
  },
  corporate: {
    name: 'Corporate',
    background: 'ffffff',
    primary: '2563eb',
    secondary: '1e40af',
    accent: '3b82f6',
    text: '1f2937',
    textSecondary: '6b7280',
  },
  creative: {
    name: 'Creative',
    background: '0f0e17',
    primary: 'ff8906',
    secondary: 'f25f4c',
    accent: 'e53170',
    text: 'fffffe',
    textSecondary: 'a7a9be',
  },
  minimal: {
    name: 'Minimal',
    background: 'fafafa',
    primary: '18181b',
    secondary: '3f3f46',
    accent: '2563eb',
    text: '18181b',
    textSecondary: '71717a',
  },
  gradient: {
    name: 'Gradient',
    background: '0c0c0c',
    primary: '6366f1',
    secondary: 'a855f7',
    accent: 'ec4899',
    text: 'ffffff',
    textSecondary: 'a1a1aa',
  },
}

interface SlideContent {
  slideNumber: number
  title: string
  subtitle?: string
  content: string[]
  imagePrompt?: string
  layout: 'title' | 'content' | 'image-left' | 'image-right' | 'full-image' | 'two-column' | 'conclusion'
  notes?: string
}

interface GeneratedPresentation {
  title: string
  subtitle?: string
  slides: SlideContent[]
  theme: string
}

// AI로 슬라이드 구조 생성
async function generateSlideStructure(
  content: string,
  slideCount: number,
  theme: string,
  language: string
): Promise<GeneratedPresentation> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

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

// Z-Image로 이미지 생성
async function generateImage(prompt: string): Promise<string | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/skills/z-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `${prompt}, professional presentation slide background, clean, modern, high quality`,
        width: 1920,
        height: 1080,
        num_inference_steps: 8,
      }),
    })

    const result = await response.json()
    return result.success ? result.image_url : null
  } catch (error) {
    console.error('[PPT-Pro] Image generation failed:', error)
    return null
  }
}

// PPTX 파일 생성
async function createPptxFile(
  presentation: GeneratedPresentation,
  images: Map<number, string>
): Promise<Buffer> {
  const pptx = new PptxGenJS()
  const theme = THEMES[presentation.theme as keyof typeof THEMES] || THEMES.modern

  // 프레젠테이션 설정
  pptx.author = 'GlowUS AI'
  pptx.title = presentation.title
  pptx.subject = presentation.subtitle || ''
  pptx.company = 'GlowUS'

  // 마스터 슬라이드 설정
  pptx.defineSlideMaster({
    title: 'MASTER_SLIDE',
    background: { color: theme.background },
  })

  for (const slideData of presentation.slides) {
    const slide = pptx.addSlide({ masterName: 'MASTER_SLIDE' })
    const imageUrl = images.get(slideData.slideNumber)

    // 배경 이미지가 있으면 추가 (반투명 오버레이)
    if (imageUrl && slideData.layout !== 'title') {
      try {
        // 이미지 배경 (어둡게 처리)
        slide.addImage({
          path: imageUrl,
          x: 0,
          y: 0,
          w: '100%',
          h: '100%',
        })
        // 오버레이
        slide.addShape('rect', {
          x: 0,
          y: 0,
          w: '100%',
          h: '100%',
          fill: { color: theme.background, transparency: 30 },
        })
      } catch (e) {
        // 이미지 로드 실패 시 무시
      }
    }

    switch (slideData.layout) {
      case 'title':
        // 제목 슬라이드
        slide.addText(slideData.title, {
          x: 0.5,
          y: 2.5,
          w: 9,
          h: 1.5,
          fontSize: 54,
          fontFace: 'Arial',
          color: theme.text,
          bold: true,
          align: 'center',
        })
        if (slideData.subtitle || presentation.subtitle) {
          slide.addText(slideData.subtitle || presentation.subtitle || '', {
            x: 0.5,
            y: 4,
            w: 9,
            h: 0.8,
            fontSize: 24,
            fontFace: 'Arial',
            color: theme.textSecondary,
            align: 'center',
          })
        }
        // 장식 라인
        slide.addShape('rect', {
          x: 3.5,
          y: 3.8,
          w: 3,
          h: 0.05,
          fill: { color: theme.primary },
        })
        break

      case 'content':
      case 'two-column':
        // 제목
        slide.addText(slideData.title, {
          x: 0.5,
          y: 0.3,
          w: 9,
          h: 0.8,
          fontSize: 36,
          fontFace: 'Arial',
          color: theme.text,
          bold: true,
        })
        // 구분선
        slide.addShape('rect', {
          x: 0.5,
          y: 1.1,
          w: 2,
          h: 0.04,
          fill: { color: theme.primary },
        })
        // 내용
        slideData.content.forEach((point, idx) => {
          slide.addText(`• ${point}`, {
            x: 0.7,
            y: 1.5 + idx * 0.8,
            w: 8.5,
            h: 0.7,
            fontSize: 20,
            fontFace: 'Arial',
            color: theme.text,
          })
        })
        break

      case 'image-left':
      case 'image-right':
        const isLeft = slideData.layout === 'image-left'
        // 제목
        slide.addText(slideData.title, {
          x: isLeft ? 5.2 : 0.5,
          y: 0.5,
          w: 4.3,
          h: 0.8,
          fontSize: 28,
          fontFace: 'Arial',
          color: theme.text,
          bold: true,
        })
        // 내용
        slideData.content.forEach((point, idx) => {
          slide.addText(`• ${point}`, {
            x: isLeft ? 5.2 : 0.5,
            y: 1.5 + idx * 0.7,
            w: 4.3,
            h: 0.6,
            fontSize: 16,
            fontFace: 'Arial',
            color: theme.text,
          })
        })
        // 이미지 영역
        if (imageUrl) {
          try {
            slide.addImage({
              path: imageUrl,
              x: isLeft ? 0.3 : 5.2,
              y: 0.5,
              w: 4.5,
              h: 4.5,
              rounding: true,
            })
          } catch (e) {
            // 이미지 placeholder
            slide.addShape('rect', {
              x: isLeft ? 0.3 : 5.2,
              y: 0.5,
              w: 4.5,
              h: 4.5,
              fill: { color: theme.secondary, transparency: 50 },
            })
          }
        }
        break

      case 'conclusion':
        // 결론 슬라이드
        slide.addText(slideData.title, {
          x: 0.5,
          y: 1.5,
          w: 9,
          h: 1,
          fontSize: 40,
          fontFace: 'Arial',
          color: theme.text,
          bold: true,
          align: 'center',
        })
        // 핵심 메시지
        slideData.content.forEach((point, idx) => {
          slide.addText(`✓ ${point}`, {
            x: 1.5,
            y: 2.8 + idx * 0.6,
            w: 7,
            h: 0.5,
            fontSize: 18,
            fontFace: 'Arial',
            color: theme.textSecondary,
            align: 'center',
          })
        })
        // 감사 메시지
        slide.addText('Thank You', {
          x: 0.5,
          y: 4.8,
          w: 9,
          h: 0.6,
          fontSize: 28,
          fontFace: 'Arial',
          color: theme.primary,
          align: 'center',
          italic: true,
        })
        break

      default:
        // 기본 레이아웃
        slide.addText(slideData.title, {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 0.8,
          fontSize: 32,
          fontFace: 'Arial',
          color: theme.text,
          bold: true,
        })
        slideData.content.forEach((point, idx) => {
          slide.addText(`• ${point}`, {
            x: 0.7,
            y: 1.5 + idx * 0.7,
            w: 8.5,
            h: 0.6,
            fontSize: 18,
            fontFace: 'Arial',
            color: theme.text,
          })
        })
    }

    // 슬라이드 번호
    if (slideData.layout !== 'title') {
      slide.addText(String(slideData.slideNumber), {
        x: 9,
        y: 5.2,
        w: 0.5,
        h: 0.3,
        fontSize: 12,
        color: theme.textSecondary,
        align: 'right',
      })
    }
  }

  // 버퍼로 변환
  const data = await pptx.write({ outputType: 'nodebuffer' }) as Buffer
  return data
}

export async function POST(request: NextRequest) {
  try {
    const {
      content,
      title,
      slideCount = 5,
      theme = 'modern',
      language = 'ko',
      generateImages = true,
    } = await request.json()

    if (!content) {
      return NextResponse.json(
        { success: false, error: '내용이 필요합니다' },
        { status: 400 }
      )
    }

    console.log(`[PPT-Pro] Generating ${slideCount} slides with theme: ${theme}`)

    // 1. AI로 슬라이드 구조 생성
    const presentation = await generateSlideStructure(content, slideCount, theme, language)
    console.log(`[PPT-Pro] Generated structure: ${presentation.slides.length} slides`)

    // 2. 이미지 생성 (병렬 처리)
    const images = new Map<number, string>()

    if (generateImages) {
      console.log('[PPT-Pro] Generating images...')
      const imagePromises = presentation.slides
        .filter(s => s.imagePrompt && s.layout !== 'title')
        .slice(0, 3) // 최대 3개 이미지 (비용 절약)
        .map(async (slide) => {
          const imageUrl = await generateImage(slide.imagePrompt!)
          if (imageUrl) {
            images.set(slide.slideNumber, imageUrl)
          }
          return { slideNumber: slide.slideNumber, imageUrl }
        })

      await Promise.all(imagePromises)
      console.log(`[PPT-Pro] Generated ${images.size} images`)
    }

    // 3. PPTX 파일 생성
    const pptxBuffer = await createPptxFile(presentation, images)

    // 4. 파일 저장
    const publicDir = path.join(process.cwd(), 'public', 'generated', 'ppt')
    if (!existsSync(publicDir)) {
      await mkdir(publicDir, { recursive: true })
    }

    const filename = `presentation-${Date.now()}.pptx`
    const filePath = path.join(publicDir, filename)
    await writeFile(filePath, pptxBuffer)

    const downloadUrl = `/generated/ppt/${filename}`
    console.log(`[PPT-Pro] Saved: ${downloadUrl}`)

    return NextResponse.json({
      success: true,
      presentation: {
        title: presentation.title,
        subtitle: presentation.subtitle,
        slideCount: presentation.slides.length,
        theme: presentation.theme,
        slides: presentation.slides,
      },
      downloadUrl,
      images: Array.from(images.entries()).map(([num, url]) => ({ slideNumber: num, imageUrl: url })),
      metadata: {
        generatedAt: new Date().toISOString(),
        generator: 'GlowUS PPT Pro',
      },
    })
  } catch (error: any) {
    console.error('[PPT-Pro] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'PPT 생성 실패' },
      { status: 500 }
    )
  }
}

// GET - API 정보
export async function GET() {
  return NextResponse.json({
    service: 'PPT Pro',
    description: '젠스파크 수준의 AI 프레젠테이션 생성기',
    features: [
      'AI 기반 슬라이드 구조 자동 생성',
      '각 슬라이드에 맞는 AI 이미지 자동 생성',
      '5가지 프로페셔널 디자인 테마',
      '실제 PPTX 파일 다운로드',
      '다양한 레이아웃 지원',
    ],
    themes: Object.keys(THEMES),
    parameters: {
      content: { type: 'string', required: true, description: '프레젠테이션 내용' },
      title: { type: 'string', required: false, description: '프레젠테이션 제목' },
      slideCount: { type: 'number', default: 5, description: '슬라이드 수' },
      theme: { type: 'string', default: 'modern', description: '디자인 테마', options: Object.keys(THEMES) },
      language: { type: 'string', default: 'ko', description: '언어' },
      generateImages: { type: 'boolean', default: true, description: 'AI 이미지 생성 여부' },
    },
  })
}
