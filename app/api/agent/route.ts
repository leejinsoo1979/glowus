import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getModelConfig, getApiModelId, SYSTEM_PROMPTS } from '@/lib/ai/models'
import { getToolsForProvider, AGENT_TOOLS } from '@/lib/ai/tools'
import { ToolExecutor } from '@/lib/ai/tool-executor'

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
): Promise<{ content: string; toolCalls: string[] }> {
  const client = new OpenAI({ apiKey, baseURL })
  const toolCallLog: string[] = []
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
        toolCalls: toolCallLog
      }
    }

    // 도구 호출 처리
    currentMessages.push({
      role: 'assistant',
      content: assistantMessage.content || '',
      tool_calls: assistantMessage.tool_calls
    })

    for (const toolCall of assistantMessage.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments)
      toolCallLog.push(`${toolCall.function.name}(${JSON.stringify(args)})`)

      const result = await executor.execute({
        name: toolCall.function.name,
        arguments: args
      })

      currentMessages.push({
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: toolCall.id
      })
    }
  }

  return { content: '최대 반복 횟수에 도달했습니다.', toolCalls: toolCallLog }
}

async function runAnthropicAgent(
  messages: ChatMessage[],
  apiModel: string,
  tools: any[],
  executor: ToolExecutor,
  apiKey: string
): Promise<{ content: string; toolCalls: string[] }> {
  const toolCallLog: string[] = []

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
        toolCalls: toolCallLog
      }
    }

    // 도구 호출 처리
    currentMessages.push({ role: 'assistant', content: JSON.stringify(content) })

    for (const toolUse of toolUses) {
      toolCallLog.push(`${toolUse.name}(${JSON.stringify(toolUse.input)})`)

      const result = await executor.execute({
        name: toolUse.name,
        arguments: toolUse.input
      })

      currentMessages.push({
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: toolUse.id
      })
    }
  }

  return { content: '최대 반복 횟수에 도달했습니다.', toolCalls: toolCallLog }
}

async function runGoogleAgent(
  messages: ChatMessage[],
  apiModel: string,
  tools: any[],
  executor: ToolExecutor,
  apiKey: string
): Promise<{ content: string; toolCalls: string[] }> {
  const toolCallLog: string[] = []

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
        toolCalls: toolCallLog
      }
    }

    // 함수 호출 처리
    chatMessages.push({
      role: 'assistant',
      content: textParts.map((p: any) => p.text).join('\n')
    })

    for (const fc of functionCalls) {
      const { name, args } = fc.functionCall
      toolCallLog.push(`${name}(${JSON.stringify(args)})`)

      const result = await executor.execute({ name, arguments: args })

      chatMessages.push({
        role: 'user',
        content: `[Tool Result for ${name}]: ${JSON.stringify(result)}`
      })
    }
  }

  return { content: '최대 반복 횟수에 도달했습니다.', toolCalls: toolCallLog }
}

// ============================================
// Main Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const { messages, model = 'gemini-3-flash', context } = await request.json() as {
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

    // 시스템 프롬프트 + 에이전트 지시
    const agentSystemPrompt = `${SYSTEM_PROMPTS.coding}

당신은 코드를 분석하고 질문에 답하는 AI 에이전트입니다.
사용 가능한 도구:
${AGENT_TOOLS.map(t => `- ${t.name}: ${t.description}`).join('\n')}

사용자가 파일이나 코드에 대해 질문하면, 도구를 사용해 정확한 정보를 찾아 답변하세요.
추측하지 말고, 도구를 사용해서 실제 데이터를 확인하세요.`

    // 메시지 구성
    const systemMessages = messages.filter(m => m.role === 'system')
    const nonSystemMessages = messages.filter(m => m.role !== 'system')

    const finalMessages: ChatMessage[] = [
      { role: 'system', content: agentSystemPrompt + '\n\n' + systemMessages.map(m => m.content).join('\n') },
      ...nonSystemMessages
    ]

    // Provider별 에이전트 실행
    let result: { content: string; toolCalls: string[] }

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
        result = await runAnthropicAgent(
          finalMessages,
          apiModel,
          tools,
          executor,
          process.env.ANTHROPIC_API_KEY!
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
