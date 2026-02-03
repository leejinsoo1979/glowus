import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getModelConfig, getApiModelId, SYSTEM_PROMPTS } from '@/lib/ai/models'

export const dynamic = 'force-dynamic'

// ============================================
// Message Types
// ============================================

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// ============================================
// Provider Handlers
// ============================================

async function handleXAI(messages: ChatMessage[], apiModel: string) {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    throw new Error('XAI_API_KEY is missing')
  }

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.x.ai/v1',
  })

  const completion = await client.chat.completions.create({
    model: apiModel,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    stream: false,
  })

  return completion.choices[0]?.message?.content || ''
}

async function handleGoogle(messages: ChatMessage[], apiModel: string) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is missing')
  }

  // Gemini: system prompt → systemInstruction, 나머지 → contents
  const systemMessages = messages.filter(m => m.role === 'system')
  const chatMessages = messages.filter(m => m.role !== 'system')

  const systemInstruction = systemMessages.length > 0
    ? { parts: [{ text: systemMessages.map(m => m.content).join('\n') }] }
    : undefined

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
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API Error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function handleOpenAI(messages: ChatMessage[], apiModel: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing')
  }

  const client = new OpenAI({ apiKey })

  const completion = await client.chat.completions.create({
    model: apiModel,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    stream: false,
  })

  return completion.choices[0]?.message?.content || ''
}

// ⚠️ Anthropic API 사용 금지 - Claude Code CLI (Max 플랜 OAuth)로만 사용
// anthropic 요청 시 OpenAI로 fallback
async function handleAnthropic(messages: ChatMessage[], _apiModel: string) {
  console.warn('[handleAnthropic] Anthropic API 사용 금지 - OpenAI로 fallback')
  return handleOpenAI(messages, 'gpt-4o')
}

// ============================================
// Main Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const { messages, model = 'claude-3.5-sonnet' } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 })
    }

    // Get model config
    const modelConfig = getModelConfig(model)
    if (!modelConfig) {
      return NextResponse.json({ error: `Unsupported model: ${model}` }, { status: 400 })
    }

    const apiModel = getApiModelId(model)

    // 시스템 프롬프트 처리: 기본 프롬프트 + 프로젝트 컨텍스트 병합
    const systemMessages = messages.filter((m: ChatMessage) => m.role === 'system')
    const nonSystemMessages = messages.filter((m: ChatMessage) => m.role !== 'system')

    // 기본 시스템 프롬프트 + 프로젝트 컨텍스트 합치기
    const combinedSystemPrompt = [
      SYSTEM_PROMPTS.coding,
      ...systemMessages.map(m => m.content)
    ].join('\n\n')

    const finalMessages: ChatMessage[] = [
      { role: 'system', content: combinedSystemPrompt },
      ...nonSystemMessages
    ]

    // Route to provider
    let content: string

    switch (modelConfig.provider) {
      case 'xai':
        content = await handleXAI(finalMessages, apiModel)
        break
      case 'google':
        content = await handleGoogle(finalMessages, apiModel)
        break
      case 'openai':
        content = await handleOpenAI(finalMessages, apiModel)
        break
      case 'anthropic':
        content = await handleAnthropic(finalMessages, apiModel)
        break
      default:
        return NextResponse.json({ error: `Unknown provider: ${modelConfig.provider}` }, { status: 400 })
    }

    return NextResponse.json({ content, model: apiModel })

  } catch (error: any) {
    console.error('[Chat API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
