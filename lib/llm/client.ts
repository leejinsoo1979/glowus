// Multi-LLM Client - OpenAI + Qwen3 (DashScope) + Ollama
import OpenAI from 'openai'

export type LLMProvider = 'openai' | 'qwen' | 'llama'

export interface LLMConfig {
  provider: LLMProvider
  model: string
  temperature?: number
  maxTokens?: number
}

// OpenAI 클라이언트
export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Qwen 클라이언트 (DashScope - OpenAI 호환 API)
export const qwenClient = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY || '',
  baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
})

// Ollama 클라이언트 (로컬 LLM - OpenAI 호환 API)
export const ollamaClient = new OpenAI({
  apiKey: 'ollama',  // Ollama는 API key가 필요 없지만 OpenAI 클라이언트가 요구함
  baseURL: 'http://localhost:11434/v1',
})

// 사용 가능한 모델 목록
export const AVAILABLE_MODELS = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: '가장 강력한 모델', costTier: 'high' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '빠르고 저렴한 GPT-4', costTier: 'medium' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '빠르고 저렴', costTier: 'low' },
  ],
  qwen: [
    { id: 'qwen-max', name: 'Qwen Max', description: '최고 성능 Qwen', costTier: 'free' },
    { id: 'qwen-plus', name: 'Qwen Plus', description: '균형 잡힌 성능', costTier: 'free' },
    { id: 'qwen-turbo', name: 'Qwen Turbo', description: '빠른 응답', costTier: 'free' },
  ],
} as const

// 클라이언트 선택
export function getClient(provider: LLMProvider): OpenAI {
  switch (provider) {
    case 'openai':
      return openaiClient
    case 'qwen':
      return qwenClient
    case 'llama':
      return ollamaClient
    default:
      return ollamaClient  // 기본값: Ollama 로컬 LLM
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
    return { provider: 'openai', model: 'gpt-4o-mini' }
  }

  // 비용 우선 (Qwen 무료)
  if (priority === 'cost') {
    return { provider: 'qwen', model: 'qwen-max' }
  }

  // 균형: 상황에 따라 선택
  if (isFirstResponse || isFinalSummary) {
    return { provider: 'openai', model: 'gpt-4o-mini' }
  }

  // 긴 컨텍스트는 Qwen (256K 지원)
  if (contextLength && contextLength > 32000) {
    return { provider: 'qwen', model: 'qwen-max' }
  }

  // 기본: Qwen (무료)
  return { provider: 'qwen', model: 'qwen-max' }
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

    // Fallback: 다른 provider로 시도
    const fallbackProvider: LLMProvider = config.provider === 'openai' ? 'qwen' : 'openai'
    const fallbackModel = fallbackProvider === 'openai' ? 'gpt-3.5-turbo' : 'qwen-turbo'

    const response = await chat(messages, {
      provider: fallbackProvider,
      model: fallbackModel
    })

    return { response, provider: fallbackProvider }
  }
}
