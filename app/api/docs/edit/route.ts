import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

interface EditRequest {
    content: string
    instruction: string
    format: 'richtext' | 'markdown'
    selection?: {
        start: number
        end: number
        text: string
    }
}

export async function POST(request: NextRequest) {
    try {
        const { content, instruction, format, selection }: EditRequest = await request.json()

        if (!content || !instruction) {
            return NextResponse.json(
                { error: 'Content and instruction are required' },
                { status: 400 }
            )
        }

        const systemPrompt = format === 'markdown'
            ? `당신은 문서 편집 AI입니다. 사용자의 지시에 따라 마크다운 문서를 수정합니다.

규칙:
- 지시사항에 따라 정확하게 수정
- 원본 문서의 스타일과 톤 유지
- 마크다운 문법 유지
- 수정된 전체 문서 반환
- 한국어 사용`
            : `당신은 문서 편집 AI입니다. 사용자의 지시에 따라 문서를 수정합니다.

규칙:
- 지시사항에 따라 정확하게 수정
- 원본 문서의 스타일과 톤 유지
- 필요시 HTML 태그 사용 가능
- 수정된 전체 문서 반환
- 한국어 사용`

        let userPrompt = `현재 문서:\n\`\`\`\n${content}\n\`\`\`\n\n`

        if (selection && selection.text) {
            userPrompt += `선택된 부분: "${selection.text}"\n\n`
        }

        userPrompt += `수정 지시: ${instruction}\n\n수정된 전체 문서를 반환해주세요.`

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 4000,
        })

        const editedContent = completion.choices[0]?.message?.content || ''

        // 마크다운 코드블록 제거 (AI가 종종 ```로 감싸서 반환함)
        const cleanedContent = editedContent
            .replace(/^```(?:markdown|html)?\n?/i, '')
            .replace(/\n?```$/i, '')
            .trim()

        return NextResponse.json({
            success: true,
            content: cleanedContent,
            format,
            usage: completion.usage,
        })
    } catch (error) {
        console.error('[Docs Edit API] Error:', error)
        return NextResponse.json(
            { error: 'Failed to edit document' },
            { status: 500 }
        )
    }
}
