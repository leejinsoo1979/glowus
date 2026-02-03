export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
// ⚠️ Anthropic API 사용 금지 - Claude Code CLI (Max 플랜 OAuth)로만 사용
// import Anthropic from '@anthropic-ai/sdk'

/**
 * AI Vision Analysis API
 *
 * 뷰파인더로 캡처한 이미지를 AI가 실시간으로 분석합니다.
 * GPT-4o 또는 Claude Vision을 사용하여 이미지 + 텍스트를 분석합니다.
 */

interface AnalyzeRequest {
  imageDataUrl: string
  extractedText?: string
  prompt?: string
  model?: 'gpt-4o' | 'claude-3-5-sonnet-20241022'
  stream?: boolean
}

// 기본 분석 프롬프트
const DEFAULT_PROMPT = `당신은 화면 분석 전문가입니다. 사용자가 지정한 화면 영역의 내용을 분석해주세요.

분석 항목:
1. **시각적 요소**: 이미지, 아이콘, 그래프, 차트 등을 식별합니다.
2. **텍스트 내용**: 보이는 텍스트의 내용과 의미를 파악합니다.
3. **UI/UX 요소**: 버튼, 폼, 메뉴 등 인터페이스 요소를 식별합니다.
4. **컨텍스트 추론**: 전체적인 화면의 목적과 사용자 의도를 추론합니다.

간결하고 명확하게 핵심 정보를 전달해주세요. 한국어로 답변해주세요.`

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json()
    const { imageDataUrl, extractedText, prompt, model = 'gpt-4o', stream = true } = body

    if (!imageDataUrl) {
      return NextResponse.json(
        { error: '이미지 데이터가 필요합니다' },
        { status: 400 }
      )
    }

    // 이미지 URL 검증
    if (!imageDataUrl.startsWith('data:image/')) {
      return NextResponse.json(
        { error: '유효하지 않은 이미지 형식입니다' },
        { status: 400 }
      )
    }

    // 프롬프트 구성
    const analysisPrompt = prompt || DEFAULT_PROMPT
    const fullPrompt = extractedText
      ? `${analysisPrompt}\n\n[OCR로 추출된 텍스트]\n${extractedText}`
      : analysisPrompt

    // 스트리밍 응답
    if (stream) {
      const encoder = new TextEncoder()

      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            if (model.startsWith('gpt')) {
              // OpenAI GPT-4o Vision
              const openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
              })

              const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                  {
                    role: 'user',
                    content: [
                      { type: 'text', text: fullPrompt },
                      {
                        type: 'image_url',
                        image_url: {
                          url: imageDataUrl,
                          detail: 'high'
                        }
                      }
                    ]
                  }
                ],
                max_tokens: 2048,
                stream: true
              })

              for await (const chunk of response) {
                const content = chunk.choices[0]?.delta?.content
                if (content) {
                  controller.enqueue(encoder.encode(content))
                }
              }
            } else if (model.startsWith('claude')) {
              // ⚠️ Anthropic API 사용 금지 - GPT-4o로 fallback
              console.warn('[Vision] Anthropic API 사용 금지 - GPT-4o로 fallback')

              const stream = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'image_url',
                        image_url: { url: imageDataUrl }
                      },
                      {
                        type: 'text',
                        text: fullPrompt
                      }
                    ]
                  }
                ],
                max_tokens: 2048,
                stream: true,
              })

              for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content
                if (content) {
                  controller.enqueue(encoder.encode(content))
                }
              }
            }

            controller.close()
          } catch (error) {
            console.error('Vision analysis stream error:', error)
            controller.enqueue(encoder.encode(`\n\n[오류] 분석 중 문제가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`))
            controller.close()
          }
        }
      })

      return new Response(streamResponse, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Transfer-Encoding': 'chunked'
        }
      })
    }

    // 비스트리밍 응답
    let analysisResult = ''

    if (model.startsWith('gpt')) {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      })

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: fullPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: imageDataUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 2048
      })

      analysisResult = response.choices[0]?.message?.content || ''
    } else if (model.startsWith('claude')) {
      // ⚠️ Anthropic API 사용 금지 - GPT-4o로 fallback
      console.warn('[Vision] Anthropic API 사용 금지 - GPT-4o로 fallback')

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageDataUrl }
              },
              {
                type: 'text',
                text: fullPrompt
              }
            ]
          }
        ],
        max_tokens: 2048,
      })

      analysisResult = completion.choices[0]?.message?.content || ''
    }

    return NextResponse.json({
      analysis: analysisResult,
      model,
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Vision analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '분석 실패' },
      { status: 500 }
    )
  }
}
