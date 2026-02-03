/**
 * Document Generation API
 *
 * Enhanced with Claude Code agent support for web search,
 * YouTube transcript analysis, and more intelligent document generation.
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

interface GenerateRequest {
    prompt: string
    format: 'richtext' | 'markdown'
    context?: string
    useAgent?: boolean // Enable Claude Code agent mode
    webSearch?: boolean // Enable web search for latest info
    youtubeUrl?: string // Analyze YouTube video for content
}

// Tool definitions for OpenAI function calling
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
    {
        type: 'function',
        function: {
            name: 'youtube_transcript',
            description: 'YouTube 영상의 자막을 가져옵니다.',
            parameters: {
                type: 'object',
                properties: {
                    videoUrl: { type: 'string', description: 'YouTube URL' },
                },
                required: ['videoUrl'],
            },
        },
    },
]

// Execute tools
async function executeTool(name: string, args: Record<string, any>): Promise<string> {
    try {
        const { webSearchTool, youtubeTranscriptTool } = await import('@/lib/agent/tools')

        switch (name) {
            case 'web_search':
                return await webSearchTool.invoke({ query: args.query, maxResults: 5 })
            case 'youtube_transcript':
                return await youtubeTranscriptTool.invoke({ videoUrl: args.videoUrl, lang: 'ko' })
            default:
                return JSON.stringify({ error: `Unknown tool: ${name}` })
        }
    } catch (error: any) {
        return JSON.stringify({ error: error.message })
    }
}

// Simple generation using OpenAI
async function generateSimple(prompt: string, format: string, context?: string) {
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

    return completion.choices[0]?.message?.content || ''
}

// Agent-based generation with tools
async function generateWithAgent(
    prompt: string,
    format: string,
    context?: string,
    webSearch?: boolean,
    youtubeUrl?: string
) {
    const openai = getOpenAI()

    const systemPrompt = format === 'markdown'
        ? `당신은 전문 문서 작성 AI 에이전트입니다. 도구를 활용하여 최신 정보를 수집하고 고품질의 마크다운 문서를 작성합니다.

규칙:
- 필요시 web_search 도구로 최신 정보 검색
- YouTube URL이 제공되면 youtube_transcript 도구로 영상 내용 분석
- 깔끔하고 구조화된 마크다운 문법 사용
- 적절한 헤딩(#, ##, ###) 사용
- 한국어로 작성
- 출처가 있는 경우 문서 끝에 참고자료 섹션 추가`
        : `당신은 전문 문서 작성 AI 에이전트입니다. 도구를 활용하여 최신 정보를 수집하고 고품질의 문서를 작성합니다.

규칙:
- 필요시 web_search 도구로 최신 정보 검색
- YouTube URL이 제공되면 youtube_transcript 도구로 영상 내용 분석
- 깔끔하고 구조화된 문서 작성
- 한국어로 작성
- HTML 태그 사용 가능 (리치 텍스트 에디터용)`

    const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
    ]

    // Build user message
    let userContent = prompt
    if (context) {
        userContent = `참고 컨텍스트:\n${context}\n\n요청: ${prompt}`
    }
    if (youtubeUrl) {
        userContent += `\n\nYouTube 영상 URL: ${youtubeUrl}\n이 영상의 자막을 분석하여 문서에 반영해주세요.`
    }
    if (webSearch) {
        userContent += `\n\n최신 정보가 필요한 경우 웹 검색을 활용해주세요.`
    }

    messages.push({ role: 'user', content: userContent })

    // Determine which tools to use
    const toolsToUse = TOOLS.filter(t => {
        if (t.function.name === 'web_search' && webSearch) return true
        if (t.function.name === 'youtube_transcript' && youtubeUrl) return true
        return false
    })

    // If no tools needed, fall back to simple generation
    if (toolsToUse.length === 0) {
        return generateSimple(prompt, format, context)
    }

    // Agent loop
    for (let i = 0; i < 5; i++) {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            tools: toolsToUse,
            tool_choice: 'auto',
            temperature: 0.7,
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
            prompt,
            format,
            context,
            useAgent = false,
            webSearch = false,
            youtubeUrl,
        }: GenerateRequest = await request.json()

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
        }

        let content: string

        // Use agent mode if explicitly enabled or if special features requested
        if (useAgent || webSearch || youtubeUrl) {
            console.log('[Docs Generate API] Using Claude Code agent mode')
            content = await generateWithAgent(prompt, format, context, webSearch, youtubeUrl)
        } else {
            content = await generateSimple(prompt, format, context)
        }

        return NextResponse.json({
            success: true,
            content,
            format,
            agentMode: useAgent || webSearch || !!youtubeUrl,
        })
    } catch (error) {
        console.error('[Docs Generate API] Error:', error)
        return NextResponse.json(
            { error: 'Failed to generate document' },
            { status: 500 }
        )
    }
}
