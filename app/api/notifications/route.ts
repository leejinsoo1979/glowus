import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient, getAuthUser } from '@/lib/supabase/server'
import {
  sendProgramNotification,
  sendDailyDigest,
  getUserNotificationSettings,
  NotificationPayload
} from '@/lib/notifications'

// DEV 모드 체크
const DEV_BYPASS_AUTH = process.env.DEV_BYPASS_AUTH === 'true'
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

/**
 * GET /api/notifications
 * 알림 이력 조회
 *
 * Query params:
 * - limit: 조회 개수 (기본 20)
 * - offset: 오프셋
 * - type: 알림 타입 필터
 */
export async function GET(request: NextRequest) {
  try {
    let userId: string

    if (DEV_BYPASS_AUTH) {
      userId = DEV_USER_ID
    } else {
      const supabaseClient = await createClient()
      const { user } = await getAuthUser(supabaseClient)
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type')

    const supabase = createAdminClient()

    let query = supabase
      .from('notification_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq('notification_type', type)
    }

    const { data: notifications, error, count } = await query

    if (error) throw error

    // 알림 설정도 함께 반환
    const settings = await getUserNotificationSettings(userId)

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      settings,
      count
    })

  } catch (error: any) {
    console.error('[Notifications API] 조회 오류:', error)
    return NextResponse.json(
      { error: error.message || '알림 조회 실패' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/notifications
 * 알림 발송 (테스트/수동)
 *
 * Body:
 * - type: 알림 타입 (new_program, high_match, ending_soon, daily_digest)
 * - programId: 프로그램 ID (optional)
 * - title: 알림 제목
 * - score: 적합도 점수 (optional)
 * - deadline: 마감일 (optional)
 */
export async function POST(request: NextRequest) {
  try {
    let userId: string

    if (DEV_BYPASS_AUTH) {
      userId = DEV_USER_ID
    } else {
      const supabaseClient = await createClient()
      const { user } = await getAuthUser(supabaseClient)
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    }

    const body = await request.json()
    const { type, programId, title, score, deadline, organization, reason, url } = body

    if (!type || !title) {
      return NextResponse.json(
        { error: 'type과 title은 필수입니다.' },
        { status: 400 }
      )
    }

    // 일일 요약 알림
    if (type === 'daily_digest') {
      const result = await sendDailyDigest(userId)
      return NextResponse.json({
        success: result.success,
        channel: result.channel,
        error: result.error
      })
    }

    // 일반 알림
    const payload: NotificationPayload = {
      type,
      programId,
      title,
      score,
      deadline,
      organization,
      reason,
      url
    }

    const results = await sendProgramNotification(userId, payload)

    return NextResponse.json({
      success: results.some(r => r.success),
      results
    })

  } catch (error: any) {
    console.error('[Notifications API] 발송 오류:', error)
    return NextResponse.json(
      { error: error.message || '알림 발송 실패' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/notifications
 * 알림 설정 업데이트
 *
 * Body:
 * - enabled: 알림 활성화
 * - minScore: 최소 적합도 점수
 * - notifyNewPrograms: 신규 공고 알림
 * - notifyEndingSoon: 마감 임박 알림
 * - notifyHighMatch: 높은 적합도 알림
 * - preferredAgentId: 선호 에이전트 ID
 */
export async function PUT(request: NextRequest) {
  try {
    let userId: string

    if (DEV_BYPASS_AUTH) {
      userId = DEV_USER_ID
    } else {
      const supabaseClient = await createClient()
      const { user } = await getAuthUser(supabaseClient)
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    }

    const body = await request.json()
    const supabase = createAdminClient()

    // 현재 설정 조회
    const { data: channel } = await supabase
      .from('notification_channels')
      .select('id, notification_settings')
      .eq('user_id', userId)
      .eq('channel_type', 'in_app')
      .single() as { data: { id: string; notification_settings: any } | null }

    const currentSettings = channel?.notification_settings || {}

    // 설정 병합
    const newSettings = {
      ...currentSettings,
      enabled: body.enabled ?? currentSettings.enabled ?? true,
      min_score: body.minScore ?? currentSettings.min_score ?? 50,
      categories: body.categories ?? currentSettings.categories ?? [],
      keywords: body.keywords ?? currentSettings.keywords ?? [],
      notify_new_programs: body.notifyNewPrograms ?? currentSettings.notify_new_programs ?? true,
      notify_ending_soon: body.notifyEndingSoon ?? currentSettings.notify_ending_soon ?? true,
      notify_high_match: body.notifyHighMatch ?? currentSettings.notify_high_match ?? true,
      quiet_hours: body.quietHours ?? currentSettings.quiet_hours,
      preferred_agent_id: body.preferredAgentId ?? currentSettings.preferred_agent_id
    }

    if (channel) {
      // 기존 채널 업데이트
      const { error } = await (supabase as any)
        .from('notification_channels')
        .update({
          notification_settings: newSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', channel.id)

      if (error) throw error
    } else {
      // 새 채널 생성
      const { error } = await (supabase as any)
        .from('notification_channels')
        .insert({
          user_id: userId,
          channel_type: 'in_app',
          notification_settings: newSettings,
          is_active: true,
          is_verified: true
        })

      if (error) throw error
    }

    return NextResponse.json({
      success: true,
      settings: {
        enabled: newSettings.enabled,
        minScore: newSettings.min_score,
        categories: newSettings.categories,
        keywords: newSettings.keywords,
        notifyNewPrograms: newSettings.notify_new_programs,
        notifyEndingSoon: newSettings.notify_ending_soon,
        notifyHighMatch: newSettings.notify_high_match,
        quietHours: newSettings.quiet_hours,
        preferredAgentId: newSettings.preferred_agent_id
      }
    })

  } catch (error: any) {
    console.error('[Notifications API] 설정 업데이트 오류:', error)
    return NextResponse.json(
      { error: error.message || '설정 업데이트 실패' },
      { status: 500 }
    )
  }
}
