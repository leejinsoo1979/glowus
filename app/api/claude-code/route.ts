/**
 * Claude Code API - Unified Agent Execution for Apps
 *
 * Provides access to AI-powered task execution with tools
 * for web search, YouTube transcript, and content generation.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2 minutes max

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// ============================================
// Types
// ============================================

interface ClaudeCodeRequest {
  task: string
  context?: string
  agentRole?: 'jeremy' | 'rachel' | 'amy' | 'antigravity'
  model?: 'gpt-4o' | 'gpt-4o-mini' | 'claude-3-5-sonnet' | 'gemini-1.5-pro'
  tools?: string[]
  systemPrompt?: string
  maxIterations?: number
}

interface ClaudeCodeResponse {
  success: boolean
  output?: string
  toolsUsed?: string[]
  iterations?: number
  error?: string
}

// ============================================
// OpenAI Client
// ============================================

const getOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

// ============================================
// Tool Definitions for OpenAI Function Calling
// ============================================

// Define as explicit function tools to avoid type union issues
interface FunctionTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, { type: string; description: string; default?: string }>
      required: string[]
    }
  }
}

const TOOL_DEFINITIONS: FunctionTool[] = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: '웹에서 정보를 검색합니다. 최신 정보, 뉴스, 문서 등을 찾을 때 사용하세요.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '검색할 키워드나 질문' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'youtube_transcript',
      description: 'YouTube 동영상의 자막을 가져옵니다.',
      parameters: {
        type: 'object',
        properties: {
          videoUrl: { type: 'string', description: 'YouTube URL' },
          lang: { type: 'string', description: '자막 언어 (ko, en 등)', default: 'ko' },
        },
        required: ['videoUrl'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'image_search',
      description: '이미지나 GIF를 검색합니다.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '검색할 이미지 키워드' },
        },
        required: ['query'],
      },
    },
  },
]

// ============================================
// Tool Execution
// ============================================

async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  try {
    // Dynamic import to avoid issues with server-side rendering
    const { webSearchTool, youtubeTranscriptTool, imageSearchTool } = await import('@/lib/agent/tools')

    switch (name) {
      case 'web_search':
        return await webSearchTool.invoke({ query: args.query, maxResults: 5 })

      case 'youtube_transcript':
        return await youtubeTranscriptTool.invoke({
          videoUrl: args.videoUrl,
          lang: args.lang || 'ko'
        })

      case 'image_search':
        return await imageSearchTool.invoke({ query: args.query, maxResults: 5 })

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (error: any) {
    return JSON.stringify({ error: error.message || 'Tool execution failed' })
  }
}

// ============================================
// System Prompt
// ============================================

const AGENT_SYSTEM_PROMPT = `당신은 GlowUS의 AI 에이전트입니다. 사용자의 요청을 도구를 활용하여 수행합니다.

## 핵심 원칙
1. 사용자의 요청을 정확히 이해하고 적절한 도구를 선택합니다
2. 도구 사용 결과를 바탕으로 최종 응답을 생성합니다
3. 필요시 여러 도구를 조합하여 복잡한 작업을 수행합니다
4. 한국어로 자연스럽게 응답합니다

## 사용 가능한 도구
- web_search: 웹에서 최신 정보 검색
- youtube_transcript: YouTube 영상 자막 추출
- image_search: 이미지 검색

## 응답 형식
- 마크다운 형식으로 구조화된 응답을 제공합니다
- 코드는 언어를 명시한 코드 블록으로 감싸줍니다
- 목록과 표를 적절히 활용합니다`

// ============================================
// API Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body: ClaudeCodeRequest = await request.json()

    const {
      task,
      context,
      model = 'gpt-4o-mini',
      tools: requestedTools = ['web_search', 'youtube_transcript', 'image_search'],
      systemPrompt,
      maxIterations = 5,
    } = body

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Task is required' },
        { status: 400 }
      )
    }

    const openai = getOpenAI()
    const toolsUsed: string[] = []

    // Build messages
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt || AGENT_SYSTEM_PROMPT },
    ]

    if (context) {
      messages.push({ role: 'user', content: `컨텍스트:\n${context}` })
    }

    messages.push({ role: 'user', content: task })

    // Filter tools based on request
    const availableTools = TOOL_DEFINITIONS.filter(tool =>
      requestedTools.includes(tool.function.name)
    )

    // Agent loop
    let iterations = 0
    let finalOutput = ''

    while (iterations < maxIterations) {
      iterations++

      const completion = await openai.chat.completions.create({
        model: model === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini',
        messages,
        tools: availableTools.length > 0 ? availableTools : undefined,
        tool_choice: availableTools.length > 0 ? 'auto' : undefined,
        temperature: 0.7,
        max_tokens: 4000,
      })

      const choice = completion.choices[0]
      const message = choice.message

      // Add assistant message to history
      messages.push(message)

      // Check if done (no tool calls)
      if (!message.tool_calls || message.tool_calls.length === 0) {
        finalOutput = message.content || ''
        break
      }

      // Execute tool calls
      for (const toolCall of message.tool_calls) {
        // Skip non-function tool calls
        if (toolCall.type !== 'function') continue

        const toolName = toolCall.function.name
        const toolArgs = JSON.parse(toolCall.function.arguments)

        console.log(`[Claude Code API] Calling tool: ${toolName}`)
        toolsUsed.push(toolName)

        const toolResult = await executeTool(toolName, toolArgs)

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        })
      }
    }

    const response: ClaudeCodeResponse = {
      success: true,
      output: finalOutput,
      toolsUsed: [...new Set(toolsUsed)],
      iterations,
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('[Claude Code API] Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Execution failed'
      },
      { status: 500 }
    )
  }
}

// ============================================
// GET - Health Check & Available Tools
// ============================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    availableTools: ['web_search', 'youtube_transcript', 'image_search'],
    models: ['gpt-4o', 'gpt-4o-mini'],
    agentRoles: ['jeremy', 'rachel', 'amy', 'antigravity'],
  })
}
