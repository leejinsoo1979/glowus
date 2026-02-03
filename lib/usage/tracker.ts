/**
 * API 사용량 추적 모듈
 * 모든 LLM API 호출 시 사용량 및 비용 기록
 */

import { createAdminClient } from '@/lib/supabase/admin'

// 모델별 가격 (USD per 1M tokens)
// 2024년 기준, 정기적으로 업데이트 필요
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },

  // Google
  'gemini-2.0-flash-exp': { input: 0, output: 0 }, // 무료 프리뷰
  'gemini-1.5-pro': { input: 1.25, output: 5 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },

  // xAI (Grok)
  'grok-4-1': { input: 3, output: 15 },
  'grok-4-1-fast': { input: 1, output: 5 },
  'grok-2-latest': { input: 2, output: 10 },

  // Mistral
  'mistral-large-latest': { input: 2, output: 6 },
  'mistral-medium-latest': { input: 2.7, output: 8.1 },
  'mistral-small-latest': { input: 0.2, output: 0.6 },

  // Groq (매우 저렴)
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'mixtral-8x7b-32768': { input: 0.24, output: 0.24 },
}

// 제공자별 기본 가격 (알 수 없는 모델용)
const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
  openai: { input: 2.5, output: 10 },
  google: { input: 1.25, output: 5 },
  xai: { input: 2, output: 10 },
  mistral: { input: 2, output: 6 },
  groq: { input: 0.5, output: 0.5 },
}

export interface UsageLog {
  userId: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  requestType?: string
  agentId?: string
  metadata?: Record<string, any>
}

/**
 * 비용 계산 (USD)
 */
export function calculateCost(
  model: string,
  provider: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING[provider] || { input: 2, output: 6 }

  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output

  return inputCost + outputCost
}

/**
 * API 사용량 기록
 */
export async function logApiUsage(log: UsageLog): Promise<void> {
  try {
    const adminClient = createAdminClient()

    const costUsd = calculateCost(log.model, log.provider, log.inputTokens, log.outputTokens)

    await (adminClient as any).from('api_usage_logs').insert({
      user_id: log.userId,
      provider: log.provider,
      model: log.model,
      input_tokens: log.inputTokens,
      output_tokens: log.outputTokens,
      cost_usd: costUsd,
      request_type: log.requestType || 'chat',
      agent_id: log.agentId || null,
      metadata: log.metadata || {},
    })
  } catch (error) {
    // 사용량 로깅 실패해도 메인 기능은 계속 동작
    console.error('[UsageTracker] Failed to log usage:', error)
  }
}

/**
 * 사용자의 일별 사용량 조회
 */
export async function getDailyUsage(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  date: string
  provider: string
  model: string
  totalTokens: number
  costUsd: number
  requestCount: number
}[]> {
  const adminClient = createAdminClient()

  const { data, error } = await (adminClient as any)
    .from('api_usage_logs')
    .select('provider, model, created_at, total_tokens, cost_usd')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[UsageTracker] Failed to get daily usage:', error)
    return []
  }

  // 날짜 + 모델별로 집계
  const grouped: Record<string, Record<string, { provider: string; totalTokens: number; costUsd: number; count: number }>> = {}

  for (const row of data || []) {
    const date = new Date(row.created_at).toISOString().split('T')[0]
    if (!grouped[date]) grouped[date] = {}
    if (!grouped[date][row.model]) {
      grouped[date][row.model] = { provider: row.provider, totalTokens: 0, costUsd: 0, count: 0 }
    }
    grouped[date][row.model].totalTokens += row.total_tokens
    grouped[date][row.model].costUsd += parseFloat(row.cost_usd)
    grouped[date][row.model].count += 1
  }

  const result: any[] = []
  for (const [date, models] of Object.entries(grouped)) {
    for (const [model, stats] of Object.entries(models)) {
      result.push({
        date,
        provider: stats.provider,
        model,
        totalTokens: stats.totalTokens,
        costUsd: stats.costUsd,
        requestCount: stats.count,
      })
    }
  }

  return result
}

/**
 * 사용자의 이번 달 총 사용량 조회
 */
export async function getMonthlyTotal(userId: string): Promise<{
  totalTokens: number
  totalCostUsd: number
  requestCount: number
  byProvider: Record<string, { tokens: number; cost: number; requests: number }>
  byModel: Record<string, { tokens: number; cost: number; requests: number; provider: string }>
}> {
  const adminClient = createAdminClient()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const { data, error } = await (adminClient as any)
    .from('api_usage_logs')
    .select('provider, model, total_tokens, cost_usd')
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())

  if (error) {
    console.error('[UsageTracker] Failed to get monthly total:', error)
    return {
      totalTokens: 0,
      totalCostUsd: 0,
      requestCount: 0,
      byProvider: {},
    }
  }

  let totalTokens = 0
  let totalCostUsd = 0
  const byProvider: Record<string, { tokens: number; cost: number; requests: number }> = {}
  const byModel: Record<string, { tokens: number; cost: number; requests: number; provider: string }> = {}

  for (const row of data || []) {
    totalTokens += row.total_tokens
    totalCostUsd += parseFloat(row.cost_usd)

    // Provider별 집계
    if (!byProvider[row.provider]) {
      byProvider[row.provider] = { tokens: 0, cost: 0, requests: 0 }
    }
    byProvider[row.provider].tokens += row.total_tokens
    byProvider[row.provider].cost += parseFloat(row.cost_usd)
    byProvider[row.provider].requests += 1

    // Model별 집계
    if (!byModel[row.model]) {
      byModel[row.model] = { tokens: 0, cost: 0, requests: 0, provider: row.provider }
    }
    byModel[row.model].tokens += row.total_tokens
    byModel[row.model].cost += parseFloat(row.cost_usd)
    byModel[row.model].requests += 1
  }

  return {
    totalTokens,
    totalCostUsd,
    requestCount: data?.length || 0,
    byProvider,
    byModel,
  }
}
