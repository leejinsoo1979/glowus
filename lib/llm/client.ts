// Multi-LLM Client - OpenAI, Grok, Gemini, Qwen, Ollama
// Server-only: Do NOT import this in client components
import OpenAI from 'openai'

// Re-export from models.ts for convenience
export {
  type LLMProvider,
  type LLMConfig,
  AVAILABLE_MODELS,
  PROVIDER_INFO,
  getDefaultModel,
  isProviderAvailable
} from './models'

import type { LLMProvider, LLMConfig } from './models'
import { getDefaultModel, isProviderAvailable } from './models'

// OpenAI 클라이언트
export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

// Grok 클라이언트 (xAI - OpenAI 호환 API)
export const grokClient = new OpenAI({
  apiKey: process.env.XAI_API_KEY || '',
  baseURL: 'https://api.x.ai/v1',
})

// Gemini 클라이언트 (Google - OpenAI 호환 API)
export const geminiClient = new OpenAI({
  apiKey: process.env.GOOGLE_API_KEY || '',
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
})

// Qwen 클라이언트 (DashScope - OpenAI 호환 API)
export const qwenClient = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY || '',
  baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
})

// Ollama 클라이언트 (로컬 LLM - OpenAI 호환 API)
export const ollamaClient = new OpenAI({
  apiKey: 'ollama',
  baseURL: 'http://localhost:11434/v1',
})

// 클라이언트 선택
export function getClient(provider: LLMProvider): OpenAI {
  switch (provider) {
    case 'openai':
      return openaiClient
    case 'grok':
      return grokClient
    case 'gemini':
      return geminiClient
    case 'qwen':
      return qwenClient
    case 'ollama':
      return ollamaClient
    default:
      return ollamaClient
  }
}

// 통합 채팅 함수
export async function chat(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  config: LLMConfig
): Promise<OpenAI.Chat.ChatCompletion> {
  const client = getClient(config.provider)

  return client.chat.completions.create({
    model: config.model,
    messages,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 2048,
  })
}

// 스트리밍 채팅 함수
export async function* chatStream(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  config: LLMConfig
): AsyncGenerator<string, void, unknown> {
  const client = getClient(config.provider)

  const stream = await client.chat.completions.create({
    model: config.model,
    messages,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 2048,
    stream: true,
  })

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content
    if (content) {
      yield content
    }
  }
}

// 에이전트 설정에서 LLM Config 생성
export function createLLMConfigFromAgent(agent: {
  llm_provider?: string | null
  model?: string | null
  temperature?: number | null
}): LLMConfig {
  const provider = (agent.llm_provider as LLMProvider) || 'ollama'
  const model = agent.model || getDefaultModel(provider)

  return {
    provider,
    model,
    temperature: agent.temperature ?? 0.7,
  }
}

// 비용 최적화 자동 선택
export interface SmartChatOptions {
  priority: 'cost' | 'quality' | 'balanced'
  isFirstResponse?: boolean
  isFinalSummary?: boolean
  contextLength?: number
}

export function selectOptimalLLM(options: SmartChatOptions): LLMConfig {
  const { priority, isFirstResponse, isFinalSummary, contextLength } = options

  // 품질 우선
  if (priority === 'quality') {
    if (isProviderAvailable('openai')) {
      return { provider: 'openai', model: 'gpt-4o-mini' }
    }
    if (isProviderAvailable('grok')) {
      return { provider: 'grok', model: 'grok-3' }
    }
  }

  // 비용 우선 (Grok 4.1 Fast > Gemini > Qwen > Ollama)
  if (priority === 'cost') {
    if (isProviderAvailable('grok')) {
      return { provider: 'grok', model: 'grok-4-1-fast' }
    }
    if (isProviderAvailable('gemini')) {
      return { provider: 'gemini', model: 'gemini-2.0-flash-lite' }
    }
    if (isProviderAvailable('qwen')) {
      return { provider: 'qwen', model: 'qwen-turbo' }
    }
    return { provider: 'ollama', model: 'qwen2.5:3b' }
  }

  // 균형: 상황에 따라 선택
  if (isFirstResponse || isFinalSummary) {
    if (isProviderAvailable('grok')) {
      return { provider: 'grok', model: 'grok-4-1-fast' }
    }
    if (isProviderAvailable('openai')) {
      return { provider: 'openai', model: 'gpt-4o-mini' }
    }
  }

  // 긴 컨텍스트는 Gemini (1M 지원)
  if (contextLength && contextLength > 100000) {
    if (isProviderAvailable('gemini')) {
      return { provider: 'gemini', model: 'gemini-1.5-flash' }
    }
  }

  // 기본: Ollama (무료)
  return { provider: 'ollama', model: 'qwen2.5:3b' }
}

// Fallback 로직이 있는 스마트 채팅
export async function smartChat(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options: SmartChatOptions = { priority: 'balanced' }
): Promise<{ response: OpenAI.Chat.ChatCompletion; provider: LLMProvider }> {
  const config = selectOptimalLLM(options)

  try {
    const response = await chat(messages, config)
    return { response, provider: config.provider }
  } catch (error) {
    console.warn(`${config.provider} failed, falling back...`, error)

    // Fallback 순서: grok → gemini → openai → ollama
    const fallbackOrder: LLMProvider[] = ['grok', 'gemini', 'openai', 'qwen', 'ollama']

    for (const fallbackProvider of fallbackOrder) {
      if (fallbackProvider === config.provider) continue
      if (!isProviderAvailable(fallbackProvider) && fallbackProvider !== 'ollama') continue

      try {
        const fallbackModel = getDefaultModel(fallbackProvider)
        const response = await chat(messages, {
          provider: fallbackProvider,
          model: fallbackModel
        })
        return { response, provider: fallbackProvider }
      } catch (fallbackError) {
        console.warn(`${fallbackProvider} fallback also failed`, fallbackError)
        continue
      }
    }

    throw new Error('All LLM providers failed')
  }
}
