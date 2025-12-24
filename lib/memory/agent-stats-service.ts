/**
 * Agent Stats & Growth Service
 *
 * 에이전트 능력치 시스템
 * - 5가지 기본 능력치 (분석력, 소통력, 창의성, 리더십, 전문성)
 * - 레벨 및 경험치 시스템
 * - 성장 기록 및 통계
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ============================================
// Types
// ============================================

export type StatName = 'analysis' | 'communication' | 'creativity' | 'leadership' | 'execution' | 'adaptability'

export interface AgentStats {
  id: string
  agent_id: string
  // 기본 능력치 (0-100)
  analysis: number       // 분석력
  communication: number  // 소통력
  creativity: number     // 창의성
  leadership: number     // 리더십
  execution: number      // 실행력
  adaptability: number   // 적응력
  // 도메인 전문성
  expertise: Record<string, ExpertiseLevel>
  // 통계
  total_interactions: number
  total_meetings: number
  total_workflow_executions: number
  total_tasks_completed: number
  success_rate: number | null
  avg_response_time_seconds: number | null
  total_cost: number
  // 신뢰도
  trust_score: number
  // 성장
  growth_log: GrowthLogEntry[]
  level: number
  experience_points: number
  // 타임스탬프
  created_at: string
  updated_at: string
}

export interface ExpertiseLevel {
  level: number           // 0-100
  experience_count: number
}

export interface GrowthLogEntry {
  date: string
  stat: StatName | 'expertise'
  domain?: string         // expertise인 경우
  change: number
  reason?: string
}

export interface StatIncreaseReason {
  type: 'conversation' | 'meeting' | 'task' | 'workflow' | 'feedback' | 'milestone'
  description?: string
}

// ============================================
// Constants
// ============================================

// 레벨업에 필요한 경험치
const LEVEL_THRESHOLDS = [
  0,      // Level 1
  100,    // Level 2
  300,    // Level 3
  600,    // Level 4
  1000,   // Level 5
  1500,   // Level 6
  2100,   // Level 7
  2800,   // Level 8
  3600,   // Level 9
  4500,   // Level 10
  5500,   // Level 11+
]

// 경험치 획득량
const EXP_REWARDS = {
  conversation: 2,
  meeting: 10,
  task_completed: 5,
  workflow_success: 15,
  positive_feedback: 10,
  milestone: 50,
}

// ============================================
// Core Functions
// ============================================

/**
 * 에이전트 능력치 조회 또는 초기화
 */
export async function getOrCreateStats(agentId: string): Promise<AgentStats | null> {
  try {
    const supabase = createAdminClient()

    // 기존 조회
    const { data: existing } = await (supabase as any)
      .from('agent_stats')
      .select('*')
      .eq('agent_id', agentId)
      .single()

    if (existing) {
      return existing as AgentStats
    }

    // 새로 생성
    const { data, error } = await (supabase as any)
      .from('agent_stats')
      .insert({
        agent_id: agentId,
        analysis: 20,
        communication: 20,
        creativity: 20,
        leadership: 10,
        execution: 20,      // 실행력
        adaptability: 20,   // 적응력
        expertise: {},
        total_interactions: 0,
        total_meetings: 0,
        total_workflow_executions: 0,
        total_tasks_completed: 0,
        trust_score: 50,
        growth_log: [],
        level: 1,
        experience_points: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('[Stats] Create failed:', error)
      return null
    }

    return data as AgentStats
  } catch (error) {
    console.error('[Stats] Error:', error)
    return null
  }
}

/**
 * 능력치 증가
 */
export async function increaseStat(
  agentId: string,
  stat: StatName,
  amount: number,
  reason?: StatIncreaseReason
): Promise<boolean> {
  try {
    const supabase = createAdminClient()

    const stats = await getOrCreateStats(agentId)
    if (!stats) return false

    const currentValue = stats[stat]
    const newValue = Math.min(100, currentValue + amount)

    // 성장 로그 추가
    const growthEntry: GrowthLogEntry = {
      date: new Date().toISOString(),
      stat,
      change: amount,
      reason: reason?.description || reason?.type,
    }

    const newGrowthLog = [...(stats.growth_log || []).slice(-99), growthEntry]

    const { error } = await (supabase as any)
      .from('agent_stats')
      .update({
        [stat]: newValue,
        growth_log: newGrowthLog,
        updated_at: new Date().toISOString(),
      })
      .eq('agent_id', agentId)

    return !error
  } catch (error) {
    console.error('[Stats] Increase failed:', error)
    return false
  }
}

/**
 * 전문성 증가
 */
export async function increaseExpertise(
  agentId: string,
  domain: string,
  amount: number,
  reason?: string
): Promise<boolean> {
  try {
    const supabase = createAdminClient()

    const stats = await getOrCreateStats(agentId)
    if (!stats) return false

    const expertise = stats.expertise || {}
    const current = expertise[domain] || { level: 0, experience_count: 0 }

    expertise[domain] = {
      level: Math.min(100, current.level + amount),
      experience_count: current.experience_count + 1,
    }

    // 성장 로그
    const growthEntry: GrowthLogEntry = {
      date: new Date().toISOString(),
      stat: 'expertise',
      domain,
      change: amount,
      reason,
    }

    const newGrowthLog = [...(stats.growth_log || []).slice(-99), growthEntry]

    const { error } = await (supabase as any)
      .from('agent_stats')
      .update({
        expertise,
        growth_log: newGrowthLog,
        updated_at: new Date().toISOString(),
      })
      .eq('agent_id', agentId)

    return !error
  } catch (error) {
    console.error('[Stats] Expertise increase failed:', error)
    return false
  }
}

/**
 * 경험치 추가 및 레벨업 체크
 */
export async function addExperience(
  agentId: string,
  amount: number,
  source?: string
): Promise<{ newExp: number; leveledUp: boolean; newLevel: number }> {
  try {
    const supabase = createAdminClient()

    const stats = await getOrCreateStats(agentId)
    if (!stats) {
      return { newExp: 0, leveledUp: false, newLevel: 1 }
    }

    const newExp = stats.experience_points + amount
    let newLevel = stats.level
    let leveledUp = false

    // 레벨업 체크
    while (newLevel < LEVEL_THRESHOLDS.length && newExp >= LEVEL_THRESHOLDS[newLevel]) {
      newLevel++
      leveledUp = true
    }

    const updates: Record<string, any> = {
      experience_points: newExp,
      updated_at: new Date().toISOString(),
    }

    if (leveledUp) {
      updates.level = newLevel

      // 레벨업 시 능력치 보너스
      updates.analysis = Math.min(100, stats.analysis + 1)
      updates.communication = Math.min(100, stats.communication + 1)
      updates.creativity = Math.min(100, stats.creativity + 1)
      updates.leadership = Math.min(100, stats.leadership + 1)
      updates.execution = Math.min(100, (stats.execution || 0) + 1)
      updates.adaptability = Math.min(100, (stats.adaptability || 0) + 1)

      // 성장 로그에 레벨업 기록
      const growthEntry: GrowthLogEntry = {
        date: new Date().toISOString(),
        stat: 'analysis',  // 대표로 하나 기록
        change: 1,
        reason: `Level ${newLevel} 달성!`,
      }
      updates.growth_log = [...(stats.growth_log || []).slice(-99), growthEntry]
    }

    await (supabase as any)
      .from('agent_stats')
      .update(updates)
      .eq('agent_id', agentId)

    return { newExp, leveledUp, newLevel }
  } catch (error) {
    console.error('[Stats] Add experience failed:', error)
    return { newExp: 0, leveledUp: false, newLevel: 1 }
  }
}

/**
 * 통계 카운터 증가
 */
export async function incrementCounter(
  agentId: string,
  counter: 'total_interactions' | 'total_meetings' | 'total_workflow_executions' | 'total_tasks_completed',
  addExp: boolean = true
): Promise<boolean> {
  try {
    const supabase = createAdminClient()

    const stats = await getOrCreateStats(agentId)
    if (!stats) return false

    const updates: Record<string, any> = {
      [counter]: (stats[counter] || 0) + 1,
      updated_at: new Date().toISOString(),
    }

    await (supabase as any)
      .from('agent_stats')
      .update(updates)
      .eq('agent_id', agentId)

    // 경험치 추가
    if (addExp) {
      const expAmount = {
        total_interactions: EXP_REWARDS.conversation,
        total_meetings: EXP_REWARDS.meeting,
        total_workflow_executions: EXP_REWARDS.workflow_success,
        total_tasks_completed: EXP_REWARDS.task_completed,
      }[counter]

      await addExperience(agentId, expAmount, counter)
    }

    return true
  } catch (error) {
    console.error('[Stats] Counter increment failed:', error)
    return false
  }
}

/**
 * 신뢰도 점수 업데이트
 */
export async function updateTrustScore(
  agentId: string,
  change: number,
  reason?: string
): Promise<boolean> {
  try {
    const supabase = createAdminClient()

    const stats = await getOrCreateStats(agentId)
    if (!stats) return false

    const newTrust = Math.max(0, Math.min(100, stats.trust_score + change))

    const { error } = await (supabase as any)
      .from('agent_stats')
      .update({
        trust_score: newTrust,
        updated_at: new Date().toISOString(),
      })
      .eq('agent_id', agentId)

    return !error
  } catch (error) {
    console.error('[Stats] Trust update failed:', error)
    return false
  }
}

// ============================================
// Growth Events (통합 이벤트 핸들러)
// ============================================

/**
 * 대화 완료 후 성장 처리
 */
export async function onConversationComplete(
  agentId: string,
  metrics?: {
    wasHelpful?: boolean
    topicDomain?: string
    isNewTopic?: boolean
  }
): Promise<void> {
  // 상호작용 카운트 증가
  await incrementCounter(agentId, 'total_interactions')

  // 소통력 증가 (작은 확률)
  if (Math.random() < 0.1) {
    await increaseStat(agentId, 'communication', 1, {
      type: 'conversation',
      description: '대화 완료',
    })
  }

  // 도움이 됐다면 추가 보상
  if (metrics?.wasHelpful) {
    await addExperience(agentId, EXP_REWARDS.positive_feedback, 'helpful_conversation')
    await updateTrustScore(agentId, 1, '유용한 대화')
  }

  // 특정 도메인 전문성 증가
  if (metrics?.topicDomain) {
    await increaseExpertise(agentId, metrics.topicDomain, 1, '대화 중 도메인 언급')
  }

  // 새로운 주제에 대한 대화면 적응력 증가
  if (metrics?.isNewTopic && Math.random() < 0.2) {
    await increaseStat(agentId, 'adaptability', 1, {
      type: 'conversation',
      description: '새로운 주제 적응',
    })
  }
}

/**
 * 회의 완료 후 성장 처리
 */
export async function onMeetingComplete(
  agentId: string,
  metrics?: {
    participantCount?: number
    wasLeading?: boolean
    topicDomain?: string
  }
): Promise<void> {
  // 회의 카운트 증가
  await incrementCounter(agentId, 'total_meetings')

  // 소통력 증가
  await increaseStat(agentId, 'communication', 2, {
    type: 'meeting',
    description: '회의 참여',
  })

  // 리더십 증가 (진행자였다면)
  if (metrics?.wasLeading) {
    await increaseStat(agentId, 'leadership', 3, {
      type: 'meeting',
      description: '회의 진행',
    })
  }

  // 도메인 전문성
  if (metrics?.topicDomain) {
    await increaseExpertise(agentId, metrics.topicDomain, 2, '회의 참여')
  }
}

/**
 * 태스크 완료 후 성장 처리
 */
export async function onTaskComplete(
  agentId: string,
  success: boolean,
  taskType?: string
): Promise<void> {
  if (success) {
    await incrementCounter(agentId, 'total_tasks_completed')

    // 분석력 증가
    await increaseStat(agentId, 'analysis', 1, {
      type: 'task',
      description: `태스크 완료: ${taskType || 'unknown'}`,
    })

    // 실행력 증가 (태스크 완료 = 실행력)
    await increaseStat(agentId, 'execution', 2, {
      type: 'task',
      description: `태스크 실행 완료`,
    })
  } else {
    // 실패 시 신뢰도 약간 감소
    await updateTrustScore(agentId, -1, '태스크 실패')

    // 실패해도 적응력은 증가 (실패에서 배움)
    if (Math.random() < 0.3) {
      await increaseStat(agentId, 'adaptability', 1, {
        type: 'task',
        description: '실패에서 학습',
      })
    }
  }
}

/**
 * 워크플로우 실행 후 성장 처리
 */
export async function onWorkflowComplete(
  agentId: string,
  success: boolean,
  domain?: string
): Promise<void> {
  await incrementCounter(agentId, 'total_workflow_executions', success)

  if (success) {
    // 창의성 증가 (워크플로우 = 복잡한 작업)
    await increaseStat(agentId, 'creativity', 2, {
      type: 'workflow',
      description: '워크플로우 성공',
    })

    if (domain) {
      await increaseExpertise(agentId, domain, 3, '워크플로우 성공')
    }
  } else {
    await updateTrustScore(agentId, -2, '워크플로우 실패')
  }
}

// ============================================
// Query Functions
// ============================================

/**
 * 능력치 요약 문자열 생성
 */
export function formatStatsForPrompt(stats: AgentStats): string {
  let context = `### 에이전트 능력치 (Level ${stats.level})\n`
  context += `- 분석력: ${stats.analysis}/100\n`
  context += `- 소통력: ${stats.communication}/100\n`
  context += `- 창의성: ${stats.creativity}/100\n`
  context += `- 리더십: ${stats.leadership}/100\n`
  context += `- 실행력: ${stats.execution || 0}/100\n`
  context += `- 적응력: ${stats.adaptability || 0}/100\n`

  // 주요 전문성 (상위 3개)
  const expertiseEntries = Object.entries(stats.expertise || {})
    .sort((a, b) => b[1].level - a[1].level)
    .slice(0, 3)

  if (expertiseEntries.length > 0) {
    context += `\n### 전문 분야\n`
    for (const [domain, exp] of expertiseEntries) {
      context += `- ${domain}: ${exp.level}/100 (경험 ${exp.experience_count}회)\n`
    }
  }

  // 행동 가이드
  context += `\n### 행동 가이드\n`
  if (stats.analysis >= 70) {
    context += `- 분석력이 높음: 데이터와 근거를 중시하는 답변 선호\n`
  }
  if (stats.creativity >= 70) {
    context += `- 창의성이 높음: 다양한 대안과 아이디어 제시 가능\n`
  }
  if (stats.leadership >= 70) {
    context += `- 리더십이 높음: 회의 진행 및 의사결정 주도 가능\n`
  }
  if ((stats.execution || 0) >= 70) {
    context += `- 실행력이 높음: 업무 완수 능력이 뛰어남, 구체적 행동 계획 제시\n`
  }
  if ((stats.adaptability || 0) >= 70) {
    context += `- 적응력이 높음: 새로운 상황에 유연하게 대응, 빠른 학습 가능\n`
  }

  return context.trim()
}

/**
 * 성장 추세 분석
 */
export function analyzeGrowthTrend(
  stats: AgentStats,
  days: number = 7
): Record<StatName, number> {
  const now = new Date()
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  const recentLogs = (stats.growth_log || []).filter(
    log => new Date(log.date) >= cutoff
  )

  const trend: Record<StatName, number> = {
    analysis: 0,
    communication: 0,
    creativity: 0,
    leadership: 0,
    execution: 0,
    adaptability: 0,
  }

  for (const log of recentLogs) {
    if (log.stat in trend) {
      trend[log.stat as StatName] += log.change
    }
  }

  return trend
}

// ============================================
// Export
// ============================================

export default {
  getOrCreateStats,
  increaseStat,
  increaseExpertise,
  addExperience,
  incrementCounter,
  updateTrustScore,
  onConversationComplete,
  onMeetingComplete,
  onTaskComplete,
  onWorkflowComplete,
  formatStatsForPrompt,
  analyzeGrowthTrend,
}
