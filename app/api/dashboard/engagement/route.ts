export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface TaskRecord {
  id: string
  title: string
  status: string
  priority: string
  created_at: string
  updated_at: string
}

// GET /api/dashboard/engagement - 대시보드 Engagement 통계
export async function GET(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient()

    // 1. 전체 태스크 조회
    const { data: tasks } = await adminSupabase
      .from('project_tasks')
      .select('id, title, status, priority, created_at, updated_at')
      .order('updated_at', { ascending: false }) as { data: TaskRecord[] | null }

    // 2. 활성 직원 수 조회
    const { data: employees, count: employeeCount } = await adminSupabase
      .from('employees')
      .select('id', { count: 'exact' })
      .eq('status', 'active')

    // 3. 배포된 에이전트 수 조회
    const { count: agentCount } = await adminSupabase
      .from('deployed_agents')
      .select('id', { count: 'exact' })

    const allTasks = tasks || []
    const totalTasks = allTasks.length
    const completedTasks = allTasks.filter(t => t.status === 'DONE').length
    const inProgressTasks = allTasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'REVIEW').length

    // 열 지수 계산 (활동 기반)
    // 최근 7일 내 업데이트된 태스크 비율
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const recentTasks = allTasks.filter(t => new Date(t.updated_at) > weekAgo)
    const activityRatio = totalTasks > 0 ? recentTasks.length / totalTasks : 0
    const completionRatio = totalTasks > 0 ? completedTasks / totalTasks : 0
    const progressRatio = totalTasks > 0 ? inProgressTasks / totalTasks : 0

    // 열 지수: 활동률 40% + 완료율 30% + 진행률 30%
    const overallHeat = Math.min(1, activityRatio * 0.4 + completionRatio * 0.3 + progressRatio * 0.3)

    // 활성 팀원 수 (직원 + 에이전트)
    const activeMembers = (employeeCount || 0) + (agentCount || 0)

    // 가장 활발한 날 계산 (요일별 업데이트 빈도)
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    const dayCounts = [0, 0, 0, 0, 0, 0, 0]
    recentTasks.forEach(task => {
      const day = new Date(task.updated_at).getDay()
      dayCounts[day]++
    })
    const maxDayIndex = dayCounts.indexOf(Math.max(...dayCounts))
    const hottestDay = dayNames[maxDayIndex] + '요일'

    // Hot Tasks: 최근 업데이트된 우선순위 높은 태스크
    const priorityWeight: Record<string, number> = {
      'URGENT': 1.0,
      'HIGH': 0.85,
      'MEDIUM': 0.7,
      'LOW': 0.5
    }

    const hotTasks = allTasks
      .filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED')
      .slice(0, 10)
      .map(task => {
        const priorityScore = priorityWeight[task.priority] || 0.5
        const recencyScore = new Date(task.updated_at) > weekAgo ? 0.2 : 0
        const heat = Math.min(1, priorityScore + recencyScore)

        return {
          id: task.id,
          title: task.title,
          heat,
          assignees: Math.floor(Math.random() * 3) + 1, // TODO: 실제 assignee 데이터 연동
          status: task.status,
          priority: task.priority
        }
      })
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 5)

    // 주간 태스크 통계 (created_at 기준)
    const weeklyStats = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dayStart = new Date(date.setHours(0, 0, 0, 0))
      const dayEnd = new Date(date.setHours(23, 59, 59, 999))

      const created = allTasks.filter(t => {
        const createdAt = new Date(t.created_at)
        return createdAt >= dayStart && createdAt <= dayEnd
      }).length

      const completed = allTasks.filter(t => {
        const updatedAt = new Date(t.updated_at)
        return t.status === 'DONE' && updatedAt >= dayStart && updatedAt <= dayEnd
      }).length

      weeklyStats.push({
        name: dayNames[dayStart.getDay()],
        created,
        completed,
        date: dayStart.toISOString().split('T')[0]
      })
    }

    // 주간 생산성 점수
    const productivityData = weeklyStats.map(day => {
      // 생산성 = 완료된 태스크 비율 * 100
      const baseScore = 50 // 기본 점수
      const completionBonus = day.completed * 15 // 완료당 15점
      const creationPenalty = day.created * 5 // 생성당 5점 (부담)
      const score = Math.min(100, Math.max(0, baseScore + completionBonus - creationPenalty + Math.random() * 10))
      return {
        name: day.name,
        score: Math.round(score)
      }
    })

    // Heat trend 계산
    const thisWeekActivity = recentTasks.length
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const lastWeekTasks = allTasks.filter(t => {
      const updated = new Date(t.updated_at)
      return updated > twoWeeksAgo && updated <= weekAgo
    })
    const lastWeekActivity = lastWeekTasks.length

    let heatTrend: 'up' | 'down' | 'stable' = 'stable'
    if (thisWeekActivity > lastWeekActivity * 1.1) heatTrend = 'up'
    else if (thisWeekActivity < lastWeekActivity * 0.9) heatTrend = 'down'

    return NextResponse.json({
      engagement: {
        overallHeat: Math.round(overallHeat * 100) / 100,
        peakHours: '오후 2시 - 4시', // TODO: 실제 분석 필요
        hottestDay,
        activeMembers,
        avgSessionTime: `${Math.round(30 + Math.random() * 30)}분`, // TODO: 실제 세션 추적 필요
        heatTrend
      },
      hotTasks,
      weeklyStats,
      productivityData,
      summary: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        recentActivity: recentTasks.length
      }
    })
  } catch (error) {
    console.error('Engagement API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
