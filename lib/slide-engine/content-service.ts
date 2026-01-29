/**
 * Content Service - 슬라이드 콘텐츠 생성 서비스
 *
 * Claude Code 터미널을 통해 슬라이드 구조와 콘텐츠를 생성
 */

import { repoRun } from '@/lib/neural-map/tools/terminal-tools'
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

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
 * Claude Code CLI를 통한 슬라이드 구조 생성
 */
export async function generateSlideStructure(
  content: string,
  slideCount: number,
  theme: string,
  language: string = 'ko'
): Promise<GeneratedPresentation> {
  console.log('[ContentService] 🚀 Generating slides with Claude Code CLI...')

  const tempId = randomUUID()
  const tempDir = '/tmp'
  const inputFile = join(tempDir, `slide-input-${tempId}.txt`)
  const outputFile = join(tempDir, `slide-output-${tempId}.json`)

  const prompt = `다음 내용을 기반으로 ${slideCount}장의 전문적인 프레젠테이션 슬라이드를 설계해주세요.

내용:
"""
${content.substring(0, 5000)}
"""

각 슬라이드에 대해:
1. 제목은 임팩트 있고 간결하게
2. 내용은 3-4개의 핵심 포인트로
3. 각 슬라이드에 어울리는 이미지 프롬프트 생성 (영어로, 상세하게)
4. 레이아웃은 다양하게 (title, content, image-left, image-right, two-column, conclusion)

다음 JSON 형식으로 ${outputFile} 파일에 저장해주세요:
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
- 반드시 유효한 JSON만 파일에 저장`

  try {
    // 프롬프트를 임시 파일에 저장
    writeFileSync(inputFile, prompt, 'utf-8')
    console.log(`[ContentService] Input file created: ${inputFile}`)

    // Claude Code CLI 실행
    const claudeCommand = `claude --print "${prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" > ${outputFile}`

    console.log('[ContentService] Executing Claude Code CLI...')
    const result = await repoRun({
      command: claudeCommand,
      timeout: 120000, // 2분
      cwd: tempDir,
    })

    // 결과 파일 확인
    if (existsSync(outputFile)) {
      const outputContent = readFileSync(outputFile, 'utf-8')
      console.log(`[ContentService] Output received: ${outputContent.length} chars`)

      // JSON 파싱
      const jsonMatch = outputContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const presentation = JSON.parse(jsonMatch[0]) as GeneratedPresentation
        presentation.theme = theme

        // 정리
        cleanup(inputFile, outputFile)
        console.log(`[ContentService] ✅ Generated ${presentation.slides?.length || 0} slides via Claude Code`)
        return presentation
      }
    }

    // Claude CLI 직접 출력에서 JSON 추출 시도
    if (result.stdout) {
      const jsonMatch = result.stdout.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const presentation = JSON.parse(jsonMatch[0]) as GeneratedPresentation
        presentation.theme = theme
        cleanup(inputFile, outputFile)
        return presentation
      }
    }

    // 실패 시 fallback to OpenAI
    console.log('[ContentService] Claude Code failed, falling back to OpenAI...')
    cleanup(inputFile, outputFile)
    return await generateSlideStructureWithOpenAI(content, slideCount, theme, language)

  } catch (error) {
    console.error('[ContentService] ❌ Claude Code error:', error)
    cleanup(inputFile, outputFile)
    // Fallback to OpenAI
    return await generateSlideStructureWithOpenAI(content, slideCount, theme, language)
  }
}

/**
 * Fallback: OpenAI API로 슬라이드 생성
 */
async function generateSlideStructureWithOpenAI(
  content: string,
  slideCount: number,
  theme: string,
  language: string = 'ko'
): Promise<GeneratedPresentation> {
  const OpenAI = (await import('openai')).default
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.')
  }

  console.log('[ContentService] Generating slides with OpenAI (fallback)...')

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

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a professional presentation designer. Always respond with valid JSON only.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 4000,
  })

  const text = response.choices[0]?.message?.content || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    throw new Error('슬라이드 구조 생성 실패')
  }

  const presentation = JSON.parse(jsonMatch[0]) as GeneratedPresentation
  presentation.theme = theme

  return presentation
}

/**
 * 임시 파일 정리
 */
function cleanup(...files: string[]) {
  for (const file of files) {
    try {
      if (existsSync(file)) {
        unlinkSync(file)
      }
    } catch (e) {
      // ignore
    }
  }
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
    throw error
  }
}
