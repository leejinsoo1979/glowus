/**
 * LLM Node: llm
 * Generate text with LLM
 */

export interface LLMInput {
  prompt: string
  systemPrompt?: string
  context?: Record<string, unknown>
}

export interface LLMOutput {
  response: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export const config = {
  model: 'gpt-4-turbo',
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: `You are a helpful assistant.`,
}

export async function execute(input: LLMInput): Promise<LLMOutput> {
  const { prompt, systemPrompt, context } = input

  // TODO: 실제 LLM API 호출 구현
  // 현재는 플레이스홀더
  console.log('[llm] LLM 호출:', { prompt, model: config.model })

  const response = await callLLM({
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    messages: [
      { role: 'system', content: systemPrompt || config.systemPrompt },
      { role: 'user', content: prompt },
    ],
  })

  return {
    response: response.content,
    model: config.model,
    usage: response.usage,
  }
}

async function callLLM(params: any): Promise<any> {
  // 실제 구현에서는 OpenAI, Anthropic 등의 API를 호출
  return {
    content: '[LLM Response Placeholder]',
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  }
}

export const nodeConfig = {
  type: 'llm',
  label: 'llm',
  description: 'Generate text with LLM',
}
