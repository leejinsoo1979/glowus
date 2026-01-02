export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Type helpers
interface TaskBasic {
  id: string
  status: string
  priority: string
  created_at: string
}

interface TaskWithProject {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  created_at: string
  project_id: string
}

// GET /api/dashboard - Get dashboard metrics (project_tasks 사용)
export async function GET(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient()

    // project_tasks에서 전체 태스크 조회
    const { data: tasks } = await adminSupabase
      .from('project_tasks')
      .select('id, status, priority, created_at') as { data: TaskBasic[] | null }

    const tasksTotal = tasks?.length || 0
    const tasksCompleted = tasks?.filter(t => t.status === 'DONE').length || 0
    const inProgressCount = tasks?.filter(t => t.status === 'IN_PROGRESS' || t.status === 'REVIEW').length || 0
    const sprintProgress = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0

    // 이번 주 생성된 태스크
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const { data: weekTasks } = await adminSupabase
      .from('project_tasks')
      .select('id')
      .gte('created_at', weekAgo.toISOString()) as { data: { id: string }[] | null }

    const commitCount = weekTasks?.length || 0

    // 최근 태스크 조회
    const { data: recentTasks } = await adminSupabase
      .from('project_tasks')
      .select('id, title, description, status, priority, created_at, project_id')
      .order('created_at', { ascending: false })
      .limit(5) as { data: TaskWithProject[] | null }

    // 긴급/높은 우선순위 태스크
    const { data: urgentTasks } = await adminSupabase
      .from('project_tasks')
      .select('id, title, status, priority')
      .in('priority', ['URGENT', 'HIGH'])
      .neq('status', 'DONE')
      .order('priority', { ascending: false })
      .limit(5)

    // 위험 지수 계산 (BLOCKED 또는 오래된 TODO)
    const blockedTasks = tasks?.filter(t => t.status === 'BLOCKED').length || 0
    const riskIndex = tasksTotal > 0 ? Math.round((blockedTasks / tasksTotal) * 100) : 0

    // 생산성 점수 계산
    const productivityScore = Math.min(100, sprintProgress + (commitCount * 3) + (inProgressCount * 2))

    return NextResponse.json({
      data: {
        metrics: {
          sprintProgress,
          tasksCompleted,
          tasksTotal,
          commitCount,
          riskIndex,
          productivityScore,
        },
        recentTasks: recentTasks?.map(task => ({
          id: task.id,
          description: task.title,
          user_name: '시스템',
          created_at: task.created_at,
          impact_level: task.priority === 'URGENT' || task.priority === 'HIGH' ? 'high' :
                       task.priority === 'MEDIUM' ? 'medium' : 'low',
        })) || [],
        urgentTasks: urgentTasks?.map(task => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority?.toLowerCase() || 'medium',
        })) || [],
      }
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
