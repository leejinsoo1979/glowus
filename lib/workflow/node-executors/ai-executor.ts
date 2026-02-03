/**
 * AI Node Executor
 * LLM을 사용하여 텍스트 생성, 분석, 변환 수행
 */

import { getClient, type LLMProvider } from '@/lib/llm/client'
import { getDefaultModel, isProviderAvailable } from '@/lib/llm/models'
import type { NodeExecutionContext, NodeExecutionResult } from './index'

export interface AINodeConfig {
  // 모델 설정
  model?: string
  provider?: LLMProvider

  // 프롬프트
  prompt: string
  systemPrompt?: string

  // 파라미터
  temperature?: number
  maxTokens?: number

  // 입력 변수 (프롬프트 템플릿에서 사용)
  variables?: Record<string, unknown>
}

// 프롬프트 템플릿 변수 치환
function interpolateTemplate(
  template: string,
  variables: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key]
    if (value === undefined || value === null) {
      return match // 변수가 없으면 원본 유지
    }
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    return String(value)
  })
}

// 사용 가능한 Provider 자동 선택
function selectProvider(preferredProvider?: LLMProvider): {
  provider: LLMProvider
  model: string
} {
  // 선호 provider가 사용 가능하면 사용
  if (preferredProvider && isProviderAvailable(preferredProvider)) {
    return {
      provider: preferredProvider,
      model: getDefaultModel(preferredProvider),
    }
  }

  // Fallback 순서: openai > grok > gemini > qwen > ollama
  const fallbackOrder: LLMProvider[] = ['openai', 'grok', 'gemini', 'qwen', 'ollama']

  for (const provider of fallbackOrder) {
    if (isProviderAvailable(provider) || provider === 'ollama') {
      return {
        provider,
        model: getDefaultModel(provider),
      }
    }
  }

  // 기본: Ollama (로컬)
  return {
    provider: 'ollama',
    model: 'qwen2.5:3b',
  }
}

export async function executeAINode(
  config: AINodeConfig,
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const logs: string[] = []

  try {
    // 1. Provider 및 모델 선택
    const { provider, model } = config.provider && config.model
      ? { provider: config.provider, model: config.model }
      : selectProvider(config.provider)

    logs.push(`[AI] Provider: ${provider}, Model: ${model}`)

    // 2. 변수 병합 (config.variables + context.inputs + previousResults)
    const allVariables: Record<string, unknown> = {
      ...context.previousResults,
      ...context.inputs,
      ...config.variables,
    }

    // 3. 프롬프트 템플릿 처리
    const userPrompt = interpolateTemplate(config.prompt, allVariables)
    const systemPrompt = config.systemPrompt
      ? interpolateTemplate(config.systemPrompt, allVariables)
      : undefined

    logs.push(`[AI] Prompt length: ${userPrompt.length} chars`)

    // 4. 메시지 구성
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }

    messages.push({ role: 'user', content: userPrompt })

    // 5. LLM 호출
    const client = getClient(provider)

    const completion = await client.chat.completions.create({
      model: config.model || model,
      messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 2048,
    })

    const responseContent = completion.choices[0]?.message?.content || ''

    logs.push(`[AI] Response length: ${responseContent.length} chars`)
    logs.push(`[AI] Tokens used: ${completion.usage?.total_tokens || 'unknown'}`)

    // 6. 결과 파싱 시도 (JSON인 경우)
    let parsedResult: unknown = responseContent

    if (responseContent.trim().startsWith('{') || responseContent.trim().startsWith('[')) {
      try {
        parsedResult = JSON.parse(responseContent)
        logs.push('[AI] Response parsed as JSON')
      } catch {
        // JSON 파싱 실패 시 원본 텍스트 유지
      }
    }

    return {
      success: true,
      result: {
        content: responseContent,
        parsed: parsedResult,
        model: config.model || model,
        provider,
        usage: completion.usage,
      },
      logs,
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logs.push(`[AI] Error: ${errorMessage}`)

    return {
      success: false,
      error: `AI 노드 실행 실패: ${errorMessage}`,
      logs,
    }
  }
}
