/**
 * Agent Profile API
 *
 * GET /api/agents/:id/profile
 * 에이전트 프로필 정보 조회 (통합 데이터)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

interface Params {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agentId = params.id

    // 에이전트 기본 정보 조회
    const { data: agent, error: agentError } = await supabase
      .from('deployed_agents')
      .select('*')
      .eq('id', agentId)
      .single() as { data: {
        id: string
        name: string
        role?: string
        description?: string
        system_prompt?: string
        avatar_url?: string
        status?: string
        created_at: string
        owner_id: string
      } | null; error: any }

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // 에이전트 스탯 조회 (6종 능력치)
    const { data: stats } = await supabase
      .from('agent_stats')
      .select('*')
      .eq('agent_id', agentId)
      .single() as { data: {
        trust_score?: number
        level?: number
        experience_points?: number
        analysis?: number
        communication?: number
        creativity?: number
        leadership?: number
        execution?: number
        adaptability?: number
      } | null }

    // 최근 성과 조회 (agent_learnings에서)
    const { data: learnings } = await supabase
      .from('agent_learnings')
      .select('id, category, subject, confidence, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(10) as { data: Array<{
        id: string
        category: string
        subject: string
        confidence: number
        created_at: string
      }> | null }

    // 실행 로그에서 통계 계산
    const { data: executionStats } = await supabase
      .from('agent_execution_logs')
      .select('success, execution_time_ms, total_cost')
      .eq('agent_id', agentId) as { data: Array<{
        success: boolean
        execution_time_ms: number
        total_cost: number
      }> | null }

    // 대화 수 계산
    const { count: conversationCount } = await supabase
      .from('agent_memories')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('memory_type', 'private')

    // 회의 참여 수 계산
    const { count: meetingCount } = await supabase
      .from('agent_memories')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('memory_type', 'meeting')

    // 통계 계산
    const executions = executionStats || []
    const successfulExecutions = executions.filter((e: any) => e.success)
    const totalCost = executions.reduce((sum: number, e: any) => sum + (e.total_cost || 0), 0)
    const avgResponseTime = executions.length > 0
      ? executions.reduce((sum: number, e: any) => sum + (e.execution_time_ms || 0), 0) / executions.length / 1000
      : 0

    // Day 계산
    const createdAt = new Date(agent.created_at)
    const now = new Date()
    const daysSinceCreation = Math.ceil((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

    // 성과 변환
    const recentAchievements = (learnings || []).map((l: any) => ({
      id: l.id,
      type: mapCategoryToAchievementType(l.category),
      title: l.subject,
      description: `${l.category} 관련 학습`,
      date: l.created_at,
      value: l.confidence,
    }))

    const profile = {
      id: agent.id,
      name: agent.name,
      role: agent.role || '일반 에이전트',
      description: agent.description || agent.system_prompt?.slice(0, 200) || '설명이 없습니다.',
      avatar_url: agent.avatar_url,
      status: agent.status || 'ACTIVE',
      created_at: agent.created_at,

      stats: {
        daysSinceCreation,
        trustScore: stats?.trust_score || 80,
        successRate: executions.length > 0
          ? Math.round((successfulExecutions.length / executions.length) * 100)
          : 100,
        avgResponseTime,
        totalCost,
        totalConversations: conversationCount || 0,
        totalTasksCompleted: successfulExecutions.length,
        totalMeetings: meetingCount || 0,
      },

      abilities: {
        level: stats?.level || 1,
        experience_points: stats?.experience_points || 0,
        analysis: stats?.analysis || 50,
        communication: stats?.communication || 50,
        creativity: stats?.creativity || 50,
        leadership: stats?.leadership || 50,
        execution: stats?.execution || 50,
        adaptability: stats?.adaptability || 50,
      },

      recentAchievements,
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('[API] Profile error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

function mapCategoryToAchievementType(category: string): string {
  const mapping: Record<string, string> = {
    person: 'feedback',
    project: 'task_complete',
    domain: 'milestone',
    workflow: 'streak',
    preference: 'feedback',
    decision_rule: 'milestone',
    lesson: 'level_up',
  }
  return mapping[category] || 'task_complete'
}
