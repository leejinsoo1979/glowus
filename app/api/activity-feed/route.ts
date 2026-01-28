export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Activity Feed API - GitHub 스타일 활동 피드
 * 텔레그램, 웹 등 모든 채널의 작업 기록 통합
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증 필요' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const projectId = searchParams.get('project_id')

    // 1. Telegram 작업 기록 조회
    let telegramQuery = (supabase as any)
      .from('telegram_work_history')
      .select(`
        id,
        work_type,
        project_name,
        project_path,
        instruction,
        status,
        result,
        error_message,
        files_created,
        files_modified,
        git_info,
        duration_ms,
        created_at,
        completed_at
      `)
      .order('created_at', { ascending: false })

    // 사용자의 Telegram ID로 필터링
    const { data: telegramUser } = await (supabase as any)
      .from('telegram_users')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (telegramUser) {
      telegramQuery = telegramQuery.eq('telegram_user_id', telegramUser.id)
    }

    if (projectId) {
      // project_path에서 projectId 매칭
      telegramQuery = telegramQuery.ilike('project_path', `%${projectId}%`)
    }

    const { data: telegramHistory, error: telegramError } = await telegramQuery
      .range(offset, offset + limit - 1)

    if (telegramError) {
      console.warn('[Activity Feed] Telegram history error:', telegramError.message)
    }

    // 2. GlowUS 프로젝트 활동 조회 (최근 생성/수정된 프로젝트)
    const { data: projectActivity } = await (supabase as any)
      .from('projects')
      .select('id, name, status, updated_at, created_at, metadata')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(10)

    // 3. GitHub 스타일 활동 피드로 변환
    const activities = []

    // Telegram 작업 기록 → 활동으로 변환
    for (const work of (telegramHistory || [])) {
      activities.push({
        id: work.id,
        type: getActivityType(work.work_type),
        icon: getActivityIcon(work.work_type, work.status),
        title: getActivityTitle(work),
        description: work.instruction,
        project: work.project_name,
        projectPath: work.project_path,
        status: work.status,
        statusColor: getStatusColor(work.status),
        duration: formatDuration(work.duration_ms),
        filesChanged: (work.files_created?.length || 0) + (work.files_modified?.length || 0),
        gitInfo: work.git_info,
        timestamp: work.created_at,
        completedAt: work.completed_at,
        source: 'telegram',
        details: {
          filesCreated: work.files_created,
          filesModified: work.files_modified,
          result: work.result?.substring(0, 500),
          error: work.error_message
        }
      })
    }

    // 정렬 (최신순)
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // 날짜별 그룹화
    const groupedActivities = groupByDate(activities)

    return NextResponse.json({
      activities: activities.slice(0, limit),
      grouped: groupedActivities,
      total: activities.length,
      hasMore: activities.length > limit
    })
  } catch (error) {
    console.error('[Activity Feed] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// 활동 타입 변환
function getActivityType(workType: string): string {
  const types: Record<string, string> = {
    'project_create': 'project',
    'project_modify': 'commit',
    'coding_task': 'code',
    'file_create': 'file',
    'file_modify': 'edit',
    'file_delete': 'delete',
    'git_commit': 'commit',
    'git_push': 'push',
    'terminal_command': 'terminal',
    'browser_action': 'browser'
  }
  return types[workType] || 'task'
}

// 활동 아이콘
function getActivityIcon(workType: string, status: string): string {
  if (status === 'failed') return '❌'
  if (status === 'in_progress') return '🔄'

  const icons: Record<string, string> = {
    'project_create': '🎉',
    'project_modify': '✏️',
    'coding_task': '💻',
    'file_create': '📄',
    'file_modify': '📝',
    'file_delete': '🗑️',
    'git_commit': '📦',
    'git_push': '🚀',
    'terminal_command': '⌨️',
    'browser_action': '🌐'
  }
  return icons[workType] || '📋'
}

// 활동 제목
function getActivityTitle(work: any): string {
  const titles: Record<string, string> = {
    'project_create': `새 프로젝트 생성: ${work.project_name}`,
    'project_modify': `프로젝트 수정: ${work.project_name}`,
    'coding_task': `코딩 작업`,
    'file_create': `파일 생성`,
    'file_modify': `파일 수정`,
    'git_commit': `커밋`,
    'git_push': `푸시`
  }
  return titles[work.work_type] || work.work_type
}

// 상태 색상
function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'completed': 'green',
    'in_progress': 'yellow',
    'pending': 'gray',
    'failed': 'red'
  }
  return colors[status] || 'gray'
}

// 소요시간 포맷
function formatDuration(ms: number | null): string {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}초`
  return `${Math.floor(ms / 60000)}분 ${Math.floor((ms % 60000) / 1000)}초`
}

// 날짜별 그룹화
function groupByDate(activities: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {}

  for (const activity of activities) {
    const date = new Date(activity.timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    let dateKey: string
    if (date.toDateString() === today.toDateString()) {
      dateKey = '오늘'
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateKey = '어제'
    } else {
      dateKey = date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    }

    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(activity)
  }

  return groups
}
