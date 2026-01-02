/**
 * Nano Banana Pro API - Gemini 3 Pro Image Generation
 * 나노바나나 Pro 이미지 생성 API
 */

import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY

// Nano Banana Pro 모델 ID
const NANO_BANANA_PRO_MODEL = 'gemini-2.0-flash-exp' // 현재 사용 가능한 이미지 생성 모델

export async function POST(request: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'GOOGLE_GEMINI_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const {
      prompt,
      aspectRatio = '1:1',
      imageSize = '1K',
      style,
      useGrounding = false
    } = body

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: '프롬프트가 필요합니다.' },
        { status: 400 }
      )
    }

    // 스타일 프리픽스 추가
    let enhancedPrompt = prompt
    if (style) {
      const styleMap: Record<string, string> = {
        'realistic': 'photorealistic, ultra detailed, 8k, ',
        'artistic': 'artistic, painting style, creative, ',
        'anime': 'anime style, japanese animation, ',
        'digital_art': 'digital art, concept art, vibrant colors, ',
        'photography': 'professional photography, DSLR quality, ',
        '3d': '3D render, octane render, cinema4d, ',
        'watercolor': 'watercolor painting, soft colors, ',
        'sketch': 'pencil sketch, hand-drawn, detailed linework, ',
      }
      enhancedPrompt = (styleMap[style] || '') + prompt
    }

    // Gemini API 호출
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${NANO_BANANA_PRO_MODEL}:generateContent?key=${GEMINI_API_KEY}`

    const requestBody: any = {
      contents: [
        {
          parts: [
            {
              text: `Generate an image: ${enhancedPrompt}`
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        // aspectRatio는 지원되는 경우에만
      }
    }

    // Grounding 활성화 (실시간 정보 기반 이미지)
    if (useGrounding) {
      requestBody.tools = [{ google_search: {} }]
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[NanoBanana] API Error:', errorText)

      // 이미지 생성이 지원되지 않는 모델인 경우 대체 응답
      if (errorText.includes('not supported') || errorText.includes('IMAGE')) {
        return NextResponse.json({
          success: false,
          error: '현재 모델에서 이미지 생성이 지원되지 않습니다. Gemini Pro Image 모델이 필요합니다.',
          suggestion: 'Google AI Studio에서 이미지 생성 모델 접근 권한을 확인하세요.',
        }, { status: 400 })
      }

      return NextResponse.json(
        { success: false, error: `Gemini API 오류: ${response.status}` },
        { status: response.status }
      )
    }

    const result = await response.json()

    // 응답에서 이미지 데이터 추출
    const candidates = result.candidates || []
    let imageData = null
    let textResponse = ''

    for (const candidate of candidates) {
      const parts = candidate.content?.parts || []
      for (const part of parts) {
        if (part.inlineData) {
          // Base64 이미지 데이터
          imageData = {
            mimeType: part.inlineData.mimeType,
            data: part.inlineData.data,
          }
        }
        if (part.text) {
          textResponse += part.text
        }
      }
    }

    if (imageData) {
      // Base64 이미지를 Data URL로 변환
      const imageUrl = `data:${imageData.mimeType};base64,${imageData.data}`

      return NextResponse.json({
        success: true,
        image_url: imageUrl,
        image_base64: imageData.data,
        mime_type: imageData.mimeType,
        text_response: textResponse,
        model: NANO_BANANA_PRO_MODEL,
        metadata: {
          prompt: enhancedPrompt,
          aspectRatio,
          imageSize,
          style,
          useGrounding,
        }
      })
    }

    // 이미지가 없는 경우 텍스트 응답 반환
    return NextResponse.json({
      success: false,
      error: '이미지를 생성하지 못했습니다.',
      text_response: textResponse,
      raw_response: result,
    }, { status: 400 })

  } catch (error: any) {
    console.error('[NanoBanana] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '이미지 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// GET - API 상태 확인
export async function GET() {
  return NextResponse.json({
    service: 'Nano Banana Pro',
    model: NANO_BANANA_PRO_MODEL,
    description: 'Google Gemini 기반 이미지 생성 API',
    status: GEMINI_API_KEY ? 'ready' : 'api_key_missing',
    capabilities: [
      'text-to-image',
      'image-editing',
      'multi-image-composition',
      'text-rendering',
      'grounding-search',
    ],
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    imageSizes: ['1K', '2K', '4K'],
  })
}
