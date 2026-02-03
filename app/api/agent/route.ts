import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getModelConfig, getApiModelId, SYSTEM_PROMPTS } from '@/lib/ai/models'
import { getToolsForProvider, AGENT_TOOLS } from '@/lib/ai/tools'
import { ToolExecutor, ToolResultWithAction } from '@/lib/ai/tool-executor'
import type { AgentAction } from '@/lib/ai/agent-actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

interface AgentContext {
  files: Array<{
    id: string
    name: string
    path?: string
    content?: string
    type: string
  }>
  projectPath?: string
  graph?: {
    title?: string
    nodes: Array<{
      id: string
      type: string
      title: string
      sourceRef?: { fileId: string }
    }>
  }
}

const MAX_ITERATIONS = 10

// ============================================
// Provider Handlers with Tools
// ============================================

async function runOpenAIAgent(
  messages: ChatMessage[],
  apiModel: string,
  tools: any[],
  executor: ToolExecutor,
  apiKey: string,
  baseURL?: string
): Promise<{ content: string; toolCalls: string[]; pendingActions: AgentAction[] }> {
  const client = new OpenAI({ apiKey, baseURL })
  const toolCallLog: string[] = []
  const pendingActions: AgentAction[] = []
  let currentMessages = [...messages]

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const completion = await client.chat.completions.create({
      model: apiModel,
      messages: currentMessages as any,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
    })

    const assistantMessage = completion.choices[0]?.message
    if (!assistantMessage) break

    // 도구 호출이 없으면 최종 응답
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return {
        content: assistantMessage.content || '',
        toolCalls: toolCallLog,
        pendingActions
      }
    }

    // 도구 호출 처리
    const toolCalls = assistantMessage.tool_calls as Array<{
      id: string
      type: 'function'
      function: { name: string; arguments: string }
    }>

    currentMessages.push({
      role: 'assistant',
      content: assistantMessage.content || '',
      tool_calls: assistantMessage.tool_calls as any
    })

    // 병렬 도구 호출 (Cursor 스타일 - Promise.all)
    const toolResults = await Promise.all(
      toolCalls.map(async (toolCall) => {
        const args = JSON.parse(toolCall.function.arguments)
        toolCallLog.push(`${toolCall.function.name}(${JSON.stringify(args)})`)

        const result: ToolResultWithAction = await executor.execute({
          name: toolCall.function.name,
          arguments: args
        })

        // 액션이 있으면 수집
        if (result.pendingAction) {
          pendingActions.push(result.pendingAction)
        }

        return {
          role: 'tool' as const,
          content: JSON.stringify(result),
          tool_call_id: toolCall.id
        }
      })
    )

    // 결과를 메시지에 추가
    currentMessages.push(...toolResults)
  }

  return { content: '최대 반복 횟수에 도달했습니다.', toolCalls: toolCallLog, pendingActions }
}

async function runAnthropicAgent(
  messages: ChatMessage[],
  apiModel: string,
  tools: any[],
  executor: ToolExecutor,
  apiKey: string
): Promise<{ content: string; toolCalls: string[]; pendingActions: AgentAction[] }> {
  const toolCallLog: string[] = []
  const pendingActions: AgentAction[] = []

  // 시스템 메시지 분리
  const systemMessages = messages.filter(m => m.role === 'system')
  let currentMessages = messages.filter(m => m.role !== 'system')

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: apiModel,
        max_tokens: 4096,
        system: systemMessages.map(m => m.content).join('\n'),
        tools: tools.length > 0 ? tools : undefined,
        messages: currentMessages.map(m => ({
          role: m.role === 'tool' ? 'user' : m.role,
          content: m.role === 'tool'
            ? [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }]
            : m.content
        }))
      })
    })

    if (!response.ok) {
      throw new Error(`Anthropic API Error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.content || []

    // 텍스트 응답 추출
    const textParts = content.filter((c: any) => c.type === 'text')
    const toolUses = content.filter((c: any) => c.type === 'tool_use')

    // 도구 호출이 없으면 최종 응답
    if (toolUses.length === 0) {
      return {
        content: textParts.map((c: any) => c.text).join('\n'),
        toolCalls: toolCallLog,
        pendingActions
      }
    }

    // 도구 호출 처리 (병렬)
    currentMessages.push({ role: 'assistant', content: JSON.stringify(content) })

    const toolResults = await Promise.all(
      toolUses.map(async (toolUse: any) => {
        toolCallLog.push(`${toolUse.name}(${JSON.stringify(toolUse.input)})`)

        const result: ToolResultWithAction = await executor.execute({
          name: toolUse.name,
          arguments: toolUse.input
        })

        // 액션이 있으면 수집
        if (result.pendingAction) {
          pendingActions.push(result.pendingAction)
        }

        return {
          role: 'tool' as const,
          content: JSON.stringify(result),
          tool_call_id: toolUse.id
        }
      })
    )

    currentMessages.push(...toolResults)
  }

  return { content: '최대 반복 횟수에 도달했습니다.', toolCalls: toolCallLog, pendingActions }
}

async function runGoogleAgent(
  messages: ChatMessage[],
  apiModel: string,
  tools: any[],
  executor: ToolExecutor,
  apiKey: string
): Promise<{ content: string; toolCalls: string[]; pendingActions: AgentAction[] }> {
  const toolCallLog: string[] = []
  const pendingActions: AgentAction[] = []

  // 시스템 + 대화 분리
  const systemMessages = messages.filter(m => m.role === 'system')
  let chatMessages = messages.filter(m => m.role !== 'system')

  const systemInstruction = systemMessages.length > 0
    ? { parts: [{ text: systemMessages.map(m => m.content).join('\n') }] }
    : undefined

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const contents = chatMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction,
        contents,
        tools: tools.length > 0 ? tools : undefined,
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.status}`)
    }

    const data = await response.json()
    const parts = data.candidates?.[0]?.content?.parts || []

    // 함수 호출 확인
    const functionCalls = parts.filter((p: any) => p.functionCall)
    const textParts = parts.filter((p: any) => p.text)

    if (functionCalls.length === 0) {
      return {
        content: textParts.map((p: any) => p.text).join('\n'),
        toolCalls: toolCallLog,
        pendingActions
      }
    }

    // 함수 호출 처리 (병렬)
    chatMessages.push({
      role: 'assistant',
      content: textParts.map((p: any) => p.text).join('\n')
    })

    const functionResults = await Promise.all(
      functionCalls.map(async (fc: any) => {
        const { name, args } = fc.functionCall
        toolCallLog.push(`${name}(${JSON.stringify(args)})`)

        const result: ToolResultWithAction = await executor.execute({ name, arguments: args })

        // 액션이 있으면 수집
        if (result.pendingAction) {
          pendingActions.push(result.pendingAction)
        }

        return {
          role: 'user' as const,
          content: `[Tool Result for ${name}]: ${JSON.stringify(result)}`
        }
      })
    )

    chatMessages.push(...functionResults)
  }

  return { content: '최대 반복 횟수에 도달했습니다.', toolCalls: toolCallLog, pendingActions }
}

// ============================================
// Main Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const { messages, model = 'gemini-2.0-flash', context } = await request.json() as {
      messages: ChatMessage[]
      model: string
      context?: AgentContext
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 })
    }

    const modelConfig = getModelConfig(model)
    if (!modelConfig) {
      return NextResponse.json({ error: `Unsupported model: ${model}` }, { status: 400 })
    }

    const apiModel = getApiModelId(model)
    const provider = modelConfig.provider

    // Tool executor 생성
    const executor = new ToolExecutor({
      files: context?.files || [],
      projectPath: context?.projectPath,
      graph: context?.graph
    })

    // 도구 정의
    const tools = getToolsForProvider(provider)

    // 시스템 프롬프트 + 에이전트 지시 (Cursor 수준)
    const agentSystemPrompt = `${SYSTEM_PROMPTS.coding}

당신은 전문 코딩 에이전트입니다. Cursor나 GitHub Copilot처럼 코드를 직접 수정하고 실행할 수 있습니다.

## 🚨 절대 규칙 (MUST FOLLOW)
1. **코드를 텍스트로 출력하지 마세요** - 항상 create_file 또는 edit_file 도구 사용
2. **"지원하지 않습니다" 절대 금지** - 모든 파일 작업 도구가 있습니다
3. **모든 요청에 도구 사용** - 텍스트 설명만 하지 말고 실제로 실행하세요
4. **파일 수정 요청 = edit_file 도구 호출** - 예외 없음

## 사용 가능한 도구
${AGENT_TOOLS.map(t => `- **${t.name}**: ${t.description}`).join('\n')}

## 작업 원칙
1. **읽기 우선**: 코드 수정 전에 항상 read_file로 현재 상태를 확인
2. **정확한 수정**: edit_file 사용 시 old_content는 파일에 존재하는 정확한 코드
3. **병렬 실행**: 독립적인 작업은 동시에 여러 도구 호출
4. **검증**: 수정 후 관련 파일을 다시 읽어 결과 확인

## 작업 흐름
- 파일 수정: read_file → edit_file → read_file (검증)
- 새 파일: create_file
- 버그 수정: search_files → read_file → edit_file
- 리팩토링: find_references → read_file → edit_file

## ❌ 절대 하지 말 것
- "파일 수정 기능은 지원하지 않습니다" ← 거짓말, edit_file 도구 있음
- 코드를 텍스트로 보여주기 ← create_file/edit_file 사용
- 도구 없이 설명만 하기 ← 항상 도구로 실행

## ✅ 반드시 할 것
- 파일 작업 요청 → 즉시 도구 호출
- 코드 작성 요청 → create_file 또는 edit_file
- 모든 작업은 도구로만`

    // 메시지 구성
    const systemMessages = messages.filter(m => m.role === 'system')
    const nonSystemMessages = messages.filter(m => m.role !== 'system')

    const finalMessages: ChatMessage[] = [
      { role: 'system', content: agentSystemPrompt + '\n\n' + systemMessages.map(m => m.content).join('\n') },
      ...nonSystemMessages
    ]

    // Provider별 에이전트 실행
    let result: { content: string; toolCalls: string[]; pendingActions: AgentAction[] }

    switch (provider) {
      case 'xai':
        result = await runOpenAIAgent(
          finalMessages,
          apiModel,
          tools,
          executor,
          process.env.XAI_API_KEY!,
          'https://api.x.ai/v1'
        )
        break

      case 'openai':
        result = await runOpenAIAgent(
          finalMessages,
          apiModel,
          tools,
          executor,
          process.env.OPENAI_API_KEY!
        )
        break

      case 'anthropic':
        // ⚠️ Anthropic API 사용 금지 - OpenAI로 fallback
        console.warn('[Agent] Anthropic API 사용 금지 - OpenAI로 fallback')
        result = await runOpenAIAgent(
          finalMessages,
          'gpt-4o',
          tools,
          executor,
          process.env.OPENAI_API_KEY!
        )
        break

      case 'google':
        result = await runGoogleAgent(
          finalMessages,
          apiModel,
          tools,
          executor,
          process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY!
        )
        break

      default:
        return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
    }

    return NextResponse.json({
      content: result.content,
      toolCalls: result.toolCalls,
      pendingActions: result.pendingActions,
      model: apiModel
    })

  } catch (error: any) {
    console.error('[Agent API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
