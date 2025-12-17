import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const getOpenAI = () => {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not set')
    }
    return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })
}

interface GenerateRequest {
    prompt: string
    format: 'richtext' | 'markdown'
    context?: string
}

export async function POST(request: NextRequest) {
    try {
        const { prompt, format, context }: GenerateRequest = await request.json()

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
        }

        const systemPrompt = format === 'markdown'
            ? `당신은 전문 문서 작성 AI입니다. 사용자의 요청에 따라 고품질의 마크다운 문서를 작성합니다.

규칙:
- 깔끔하고 구조화된 마크다운 문법 사용
- 적절한 헤딩(#, ##, ###) 사용
- 코드 블록, 표, 목록 등 마크다운 기능 활용
- 한국어로 작성
- 전문적이고 명확한 톤 유지`
            : `당신은 전문 문서 작성 AI입니다. 사용자의 요청에 따라 고품질의 문서를 작성합니다.

규칙:
- 깔끔하고 구조화된 문서 작성
- 적절한 섹션과 단락 구분
- 명확한 제목과 부제목 사용
- 한국어로 작성
- 전문적이고 명확한 톤 유지
- HTML 태그 사용 가능 (리치 텍스트 에디터용)`

        const messages: OpenAI.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
        ]

        if (context) {
            messages.push({
                role: 'user',
                content: `참고 컨텍스트:\n${context}`,
            })
        }

        messages.push({
            role: 'user',
            content: prompt,
        })

        const completion = await getOpenAI().chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.7,
            max_tokens: 4000,
        })

        const content = completion.choices[0]?.message?.content || ''

        return NextResponse.json({
            success: true,
            content,
            format,
            usage: completion.usage,
        })
    } catch (error) {
        console.error('[Docs Generate API] Error:', error)
        return NextResponse.json(
            { error: 'Failed to generate document' },
            { status: 500 }
        )
    }
}
