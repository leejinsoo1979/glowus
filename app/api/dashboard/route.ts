import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/dashboard - Get dashboard metrics for current user's startup
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const startupId = searchParams.get('startup_id')

    // Get user's startup (first one if not specified)
    let targetStartupId = startupId

    if (!targetStartupId) {
      const { data: startups } = await supabase
        .from('startups')
        .select('id')
        .eq('founder_id', user.id)
        .limit(1)

      if (startups && startups.length > 0) {
        targetStartupId = startups[0].id
      } else {
        // Check team memberships
        const { data: memberships } = await supabase
          .from('team_members')
          .select('startup_id')
          .eq('user_id', user.id)
          .limit(1)

        if (memberships && memberships.length > 0) {
          targetStartupId = memberships[0].startup_id
        }
      }
    }

    if (!targetStartupId) {
      return NextResponse.json({
        data: {
          metrics: {
            sprintProgress: 0,
            tasksCompleted: 0,
            tasksTotal: 0,
            commitCount: 0,
            riskIndex: 0,
            productivityScore: 0,
          },
          recentTasks: [],
          urgentTasks: [],
        }
      })
    }

    // Get task metrics
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, status, priority, created_at')
      .eq('startup_id', targetStartupId)

    const tasksTotal = tasks?.length || 0
    const tasksCompleted = tasks?.filter(t => t.status === 'DONE').length || 0
    const sprintProgress = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0

    // Get this week's tasks (as commits/work logs)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const { data: weekTasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('startup_id', targetStartupId)
      .gte('created_at', weekAgo.toISOString())

    const commitCount = weekTasks?.length || 0

    // Get recent tasks with authors
    const { data: recentTasks } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        impact_score,
        created_at,
        author:users!tasks_author_id_fkey(id, name)
      `)
      .eq('startup_id', targetStartupId)
      .order('created_at', { ascending: false })
      .limit(5)

    // Get urgent/high priority tasks
    const { data: urgentTasks } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        status,
        priority,
        author:users!tasks_author_id_fkey(id, name)
      `)
      .eq('startup_id', targetStartupId)
      .in('priority', ['URGENT', 'HIGH'])
      .neq('status', 'DONE')
      .order('priority', { ascending: false })
      .limit(5)

    // Calculate risk index (based on overdue/blocked tasks)
    const blockedTasks = tasks?.filter(t => t.status === 'BLOCKED').length || 0
    const riskIndex = tasksTotal > 0 ? Math.round((blockedTasks / tasksTotal) * 100) : 0

    // Calculate productivity score
    const productivityScore = Math.min(100, sprintProgress + (commitCount * 2))

    return NextResponse.json({
      data: {
        startupId: targetStartupId,
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
          user_name: task.author?.name || '알 수 없음',
          created_at: task.created_at,
          impact_level: task.impact_score && task.impact_score > 70 ? 'high' :
                       task.impact_score && task.impact_score > 40 ? 'medium' : 'low',
        })) || [],
        urgentTasks: urgentTasks?.map(task => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority.toLowerCase(),
          assignee_name: task.author?.name,
        })) || [],
      }
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
