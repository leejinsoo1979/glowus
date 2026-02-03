/**
 * Document Edit API
 *
 * Enhanced with Claude Code agent support for intelligent
 * document editing with web search and content analysis.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

interface EditRequest {
    content: string
    instruction: string
    format: 'richtext' | 'markdown'
    selection?: {
        start: number
        end: number
        text: string
    }
    useAgent?: boolean
    webSearch?: boolean
}

// Tool definitions
interface FunctionTool {
    type: 'function'
    function: {
        name: string
        description: string
        parameters: {
            type: 'object'
            properties: Record<string, { type: string; description: string }>
            required: string[]
        }
    }
}

const TOOLS: FunctionTool[] = [
    {
        type: 'function',
        function: {
            name: 'web_search',
            description: '웹에서 최신 정보를 검색합니다.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: '검색 쿼리' },
                },
                required: ['query'],
            },
        },
    },
]

// Execute tools
async function executeTool(name: string, args: Record<string, any>): Promise<string> {
    try {
        const { webSearchTool } = await import('@/lib/agent/tools')

        switch (name) {
            case 'web_search':
                return await webSearchTool.invoke({ query: args.query, maxResults: 5 })
            default:
                return JSON.stringify({ error: `Unknown tool: ${name}` })
        }
    } catch (error: any) {
        return JSON.stringify({ error: error.message })
    }
}

// Simple edit using OpenAI
async function editSimple(
    content: string,
    instruction: string,
    format: string,
    selection?: { text: string }
) {
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

    const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
    })

    return completion.choices[0]?.message?.content || ''
}

// Agent-based edit with tools
async function editWithAgent(
    content: string,
    instruction: string,
    format: string,
    selection?: { text: string },
    webSearch?: boolean
) {
    // If no web search needed, fall back to simple edit
    if (!webSearch) {
        return editSimple(content, instruction, format, selection)
    }

    const openai = getOpenAI()

    const systemPrompt = format === 'markdown'
        ? `당신은 문서 편집 AI 에이전트입니다. 도구를 활용하여 최신 정보를 수집하고 문서를 수정합니다.

규칙:
- 지시사항에 따라 정확하게 수정
- 필요시 web_search 도구로 최신 정보 검색
- 원본 문서의 스타일과 톤 유지
- 마크다운 문법 유지
- 수정된 전체 문서만 반환 (설명 없이)
- 한국어 사용`
        : `당신은 문서 편집 AI 에이전트입니다. 도구를 활용하여 최신 정보를 수집하고 문서를 수정합니다.

규칙:
- 지시사항에 따라 정확하게 수정
- 필요시 web_search 도구로 최신 정보 검색
- 원본 문서의 스타일과 톤 유지
- 필요시 HTML 태그 사용 가능
- 수정된 전체 문서만 반환 (설명 없이)
- 한국어 사용`

    const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
    ]

    let userContent = `현재 문서:\n\`\`\`\n${content}\n\`\`\`\n\n`

    if (selection && selection.text) {
        userContent += `선택된 부분: "${selection.text}"\n\n`
    }

    userContent += `수정 지시: ${instruction}\n\n`
    userContent += `필요한 경우 웹 검색을 통해 최신 정보를 반영해주세요.\n\n`
    userContent += `수정된 전체 문서만 반환해주세요.`

    messages.push({ role: 'user', content: userContent })

    // Agent loop
    for (let i = 0; i < 3; i++) {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            tools: TOOLS,
            tool_choice: 'auto',
            temperature: 0.3,
            max_tokens: 4000,
        })

        const message = completion.choices[0].message
        messages.push(message)

        if (!message.tool_calls || message.tool_calls.length === 0) {
            return message.content || ''
        }

        // Execute tools
        for (const toolCall of message.tool_calls) {
            // Skip non-function tool calls
            if (toolCall.type !== 'function') continue

            const result = await executeTool(
                toolCall.function.name,
                JSON.parse(toolCall.function.arguments)
            )
            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: result,
            })
        }
    }

    // Return last assistant message
    const lastAssistant = messages.filter(m => m.role === 'assistant').pop()
    return (lastAssistant as any)?.content || ''
}

export async function POST(request: NextRequest) {
    try {
        const {
            content,
            instruction,
            format,
            selection,
            useAgent = false,
            webSearch = false,
        }: EditRequest = await request.json()

        if (!content || !instruction) {
            return NextResponse.json(
                { error: 'Content and instruction are required' },
                { status: 400 }
            )
        }

        let editedContent: string

        // Use agent mode if explicitly enabled or if web search requested
        if (useAgent || webSearch) {
            console.log('[Docs Edit API] Using Claude Code agent mode')
            editedContent = await editWithAgent(content, instruction, format, selection, webSearch)
        } else {
            editedContent = await editSimple(content, instruction, format, selection)
        }

        // 마크다운 코드블록 제거 (AI가 종종 ```로 감싸서 반환함)
        const cleanedContent = editedContent
            .replace(/^```(?:markdown|html)?\n?/i, '')
            .replace(/\n?```$/i, '')
            .trim()

        return NextResponse.json({
            success: true,
            content: cleanedContent,
            format,
            agentMode: useAgent || webSearch,
        })
    } catch (error) {
        console.error('[Docs Edit API] Error:', error)
        return NextResponse.json(
            { error: 'Failed to edit document' },
            { status: 500 }
        )
    }
}
