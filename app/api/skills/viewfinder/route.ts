import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

/**
 * 🔭 뷰파인더 (Viewfinder) API
 *
 * AI 에이전트가 이미지/문서를 "눈으로 보고" 분석할 수 있는 도구
 * - 이미지 URL 또는 base64 지원
 * - 멀티모달 모델 사용 (GPT-4o, Gemini, Claude)
 * - 회의에서 공유된 자료 분석용
 */

interface ViewfinderRequest {
  imageUrl?: string           // 이미지 URL
  imageBase64?: string        // Base64 인코딩된 이미지
  mimeType?: string           // image/png, image/jpeg, application/pdf 등
  prompt?: string             // 분석 요청 (예: "이 차트를 분석해줘")
  provider?: 'openai' | 'gemini' | 'anthropic'  // 어떤 비전 모델 사용
  agentName?: string          // 누가 보고 있는지 (회의 컨텍스트용)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: ViewfinderRequest = await request.json()
    const {
      imageUrl,
      imageBase64,
      mimeType = 'image/png',
      prompt = '이 이미지/문서를 분석해서 주요 내용을 설명해줘.',
      provider = 'openai',  // GPT-4o가 가장 안정적
      agentName,
    } = body

    if (!imageUrl && !imageBase64) {
      return NextResponse.json(
        { error: 'imageUrl 또는 imageBase64가 필요합니다.' },
        { status: 400 }
      )
    }

    console.log('[Viewfinder] 🔭 Vision analysis request:', {
      provider,
      hasUrl: !!imageUrl,
      hasBase64: !!imageBase64,
      mimeType,
      agentName,
    })

    let analysis = ''

    // 🔥 OpenAI GPT-4o Vision
    if (provider === 'openai') {
      const OpenAI = (await import('openai')).default
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

      const imageContent = imageUrl
        ? { type: 'image_url' as const, image_url: { url: imageUrl } }
        : { type: 'image_url' as const, image_url: { url: `data:${mimeType};base64,${imageBase64}` } }

      const systemPrompt = agentName
        ? `너는 ${agentName}야. 회의 중 공유된 자료를 분석하고 있어. 팀원들이 이해할 수 있도록 명확하게 설명해줘.`
        : '이미지/문서를 분석해서 핵심 내용을 설명해주세요.'

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              imageContent,
            ],
          },
        ],
        max_tokens: 1000,
      })

      analysis = response.choices[0]?.message?.content || '분석 결과를 가져오지 못했습니다.'
    }

    // 🔥 Google Gemini Vision
    else if (provider === 'gemini') {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

      const systemPrompt = agentName
        ? `너는 ${agentName}야. 회의 중 공유된 자료를 분석하고 있어.`
        : ''

      let imageParts: any[] = []

      if (imageBase64) {
        imageParts = [{
          inlineData: {
            data: imageBase64,
            mimeType: mimeType,
          },
        }]
      } else if (imageUrl) {
        // URL인 경우 fetch해서 base64로 변환
        const imageResponse = await fetch(imageUrl)
        const buffer = await imageResponse.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const contentType = imageResponse.headers.get('content-type') || mimeType

        imageParts = [{
          inlineData: {
            data: base64,
            mimeType: contentType,
          },
        }]
      }

      const result = await model.generateContent([
        `${systemPrompt}\n\n${prompt}`,
        ...imageParts,
      ])

      analysis = result.response.text() || '분석 결과를 가져오지 못했습니다.'
    }

    // ⚠️ Anthropic API 사용 금지 - OpenAI로 fallback
    else if (provider === 'anthropic') {
      console.warn('[Viewfinder] Anthropic API 사용 금지 - OpenAI로 fallback')

      const OpenAI = (await import('openai')).default
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

      const systemPrompt = agentName
        ? `너는 ${agentName}야. 회의 중 공유된 자료를 분석하고 있어.`
        : '이미지/문서를 분석해서 핵심 내용을 설명해주세요.'

      let imageUrlForOpenAI: string

      if (imageBase64) {
        imageUrlForOpenAI = `data:${mimeType};base64,${imageBase64}`
      } else if (imageUrl) {
        imageUrlForOpenAI = imageUrl
      } else {
        throw new Error('이미지 데이터가 없습니다')
      }

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1000,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrlForOpenAI } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      })

      analysis = response.choices[0]?.message?.content || '분석 결과를 가져오지 못했습니다.'
    }

    console.log('[Viewfinder] ✅ Analysis complete:', {
      provider,
      agentName,
      analysisLength: analysis.length,
    })

    return NextResponse.json({
      success: true,
      analysis,
      provider,
      agentName,
    })

  } catch (error: any) {
    console.error('[Viewfinder] ❌ Error:', error)
    return NextResponse.json(
      { error: error.message || 'Vision analysis failed' },
      { status: 500 }
    )
  }
}
