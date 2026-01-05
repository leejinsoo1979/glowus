/**
 * 정부지원사업 알림 시스템
 * 앱 내 에이전트 알림 + 선택적 외부 채널 (Discord, Telegram 등) 지원
 */

import { createAdminClient } from '@/lib/supabase/server'

// 알림 타입
export type NotificationType = 'new_program' | 'high_match' | 'ending_soon' | 'daily_digest'

// 알림 페이로드
export interface NotificationPayload {
  type: NotificationType
  programId?: string
  title: string
  score?: number
  deadline?: string
  organization?: string
  reason?: string
  url?: string
  daysLeft?: number
  extra?: Record<string, any>
}

// 알림 결과
export interface NotificationResult {
  success: boolean
  channel: 'in_app' | 'discord' | 'telegram' | 'slack' | 'email'
  messageId?: string
  error?: string
}

// 에이전트 알림 데이터 (클라이언트에서 사용)
export interface AgentNotificationData {
  agentId: string
  agentName: string
  message: string
  type: 'info' | 'alert' | 'task' | 'greeting'
  payload: NotificationPayload
}

/**
 * 알림 타입별 메시지 생성
 */
export function generateNotificationMessage(payload: NotificationPayload): {
  title: string
  message: string
  type: 'info' | 'alert' | 'task' | 'greeting'
} {
  switch (payload.type) {
    case 'new_program':
      return {
        title: '새로운 정부지원사업',
        message: `🆕 새로운 지원사업이 등록되었어요!\n\n「${payload.title}」\n\n${payload.organization ? `주관: ${payload.organization}` : ''}${payload.deadline ? `\n마감: ${payload.deadline}` : ''}`,
        type: 'info'
      }

    case 'high_match':
      return {
        title: '맞춤 지원사업 발견',
        message: `⭐ 대표님, 딱 맞는 지원사업을 찾았어요!\n\n「${payload.title}」\n\n🎯 적합도: ${payload.score}점\n${payload.reason ? `\n💡 ${payload.reason}` : ''}${payload.deadline ? `\n📅 마감: ${payload.deadline}` : ''}`,
        type: 'alert'
      }

    case 'ending_soon':
      return {
        title: '마감 임박 알림',
        message: `⏰ 마감이 ${payload.daysLeft}일 남았어요!\n\n「${payload.title}」\n\n${payload.score ? `적합도: ${payload.score}점` : ''}${payload.organization ? `\n주관: ${payload.organization}` : ''}\n\n서둘러 확인해보세요!`,
        type: 'alert'
      }

    case 'daily_digest':
      return {
        title: '오늘의 지원사업 요약',
        message: `📋 오늘의 정부지원사업 요약이에요!\n\n${payload.title}\n\n${payload.extra?.summary || '새로운 공고들을 확인해보세요.'}`,
        type: 'info'
      }

    default:
      return {
        title: '정부지원사업 알림',
        message: payload.title,
        type: 'info'
      }
  }
}

/**
 * 앱 내 알림 큐에 추가 (SSE/WebSocket으로 클라이언트에 전달)
 */
export async function queueInAppNotification(
  userId: string,
  agentId: string,
  payload: NotificationPayload
): Promise<NotificationResult> {
  const supabase = createAdminClient()

  try {
    const { title, message, type } = generateNotificationMessage(payload)

    // 사용자의 in_app 채널 ID 조회 (없으면 생성)
    let channelId: string | null = null
    const { data: channel } = await (supabase as any)
      .from('notification_channels')
      .select('id')
      .eq('user_id', userId)
      .eq('channel_type', 'in_app')
      .single()

    if (channel) {
      channelId = channel.id
    } else {
      // in_app 채널 자동 생성
      const { data: newChannel } = await (supabase as any)
        .from('notification_channels')
        .insert({
          user_id: userId,
          channel_type: 'in_app',
          is_active: true,
          is_verified: true
        })
        .select('id')
        .single()
      channelId = newChannel?.id
    }

    // 알림 큐에 저장 (Realtime으로 클라이언트에서 구독)
    const { data, error } = await (supabase as any)
      .from('notification_queue')
      .insert({
        user_id: userId,
        channel_id: channelId,
        notification_type: payload.type,
        program_id: payload.programId || null,
        payload: {
          ...payload,
          generatedTitle: title,
          generatedMessage: message,
          notificationType: type,
          agentId
        },
        status: 'pending',
        priority: payload.type === 'high_match' ? 10 : payload.type === 'ending_soon' ? 5 : 0,
        scheduled_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (error) throw error

    // 알림 이력 저장
    await (supabase as any)
      .from('notification_history')
      .insert({
        channel_id: channelId,
        user_id: userId,
        notification_type: payload.type,
        program_id: payload.programId || null,
        title,
        message,
        payload,
        status: 'sent',
        sent_at: new Date().toISOString()
      })

    return {
      success: true,
      channel: 'in_app',
      messageId: data?.id
    }

  } catch (error: any) {
    console.error('[InApp Notification] 알림 큐 추가 실패:', error)
    return {
      success: false,
      channel: 'in_app',
      error: error.message
    }
  }
}

/**
 * 사용자의 알림 설정 조회
 */
export async function getUserNotificationSettings(userId: string): Promise<{
  enabled: boolean
  minScore: number
  categories: string[]
  keywords: string[]
  notifyNewPrograms: boolean
  notifyEndingSoon: boolean
  notifyHighMatch: boolean
  quietHours: { start: string; end: string } | null
  preferredAgentId: string | null
}> {
  const supabase = createAdminClient()

  const { data } = await (supabase as any)
    .from('notification_channels')
    .select('notification_settings')
    .eq('user_id', userId)
    .eq('channel_type', 'in_app')
    .eq('is_active', true)
    .single()

  const settings = data?.notification_settings as any || {}

  return {
    enabled: settings.enabled ?? true,
    minScore: settings.min_score ?? 50,
    categories: settings.categories ?? [],
    keywords: settings.keywords ?? [],
    notifyNewPrograms: settings.notify_new_programs ?? true,
    notifyEndingSoon: settings.notify_ending_soon ?? true,
    notifyHighMatch: settings.notify_high_match ?? true,
    quietHours: settings.quiet_hours ?? null,
    preferredAgentId: settings.preferred_agent_id ?? null
  }
}

/**
 * 사용자의 기본 에이전트 ID 조회
 */
export async function getDefaultAgentForUser(userId: string): Promise<string | null> {
  const supabase = createAdminClient()

  // 1. 알림 설정에서 선호 에이전트 확인
  const settings = await getUserNotificationSettings(userId)
  if (settings.preferredAgentId) {
    return settings.preferredAgentId
  }

  // 2. 사용자의 첫 번째 에이전트 반환
  const { data: agents } = await (supabase as any)
    .from('deployed_agents')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (agents && agents.length > 0) {
    return agents[0].id
  }

  // 3. 시스템 기본 에이전트 (에이미)
  const { data: defaultAgent } = await (supabase as any)
    .from('deployed_agents')
    .select('id')
    .ilike('name', '%에이미%')
    .limit(1)

  return defaultAgent?.[0]?.id || null
}

/**
 * 사용자에게 정부지원사업 알림 발송
 */
export async function sendProgramNotification(
  userId: string,
  payload: NotificationPayload
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = []

  try {
    // 1. 알림 설정 확인
    const settings = await getUserNotificationSettings(userId)

    if (!settings.enabled) {
      return [{
        success: false,
        channel: 'in_app',
        error: 'Notifications disabled'
      }]
    }

    // 2. 알림 조건 확인
    if (settings.minScore && payload.score && payload.score < settings.minScore) {
      return [{
        success: false,
        channel: 'in_app',
        error: `Score ${payload.score} below minimum ${settings.minScore}`
      }]
    }

    // 3. 알림 타입 확인
    if (payload.type === 'new_program' && !settings.notifyNewPrograms) {
      return [{ success: false, channel: 'in_app', error: 'New program notifications disabled' }]
    }
    if (payload.type === 'ending_soon' && !settings.notifyEndingSoon) {
      return [{ success: false, channel: 'in_app', error: 'Ending soon notifications disabled' }]
    }
    if (payload.type === 'high_match' && !settings.notifyHighMatch) {
      return [{ success: false, channel: 'in_app', error: 'High match notifications disabled' }]
    }

    // 4. 기본 에이전트 조회
    const agentId = await getDefaultAgentForUser(userId)
    if (!agentId) {
      return [{
        success: false,
        channel: 'in_app',
        error: 'No agent found for user'
      }]
    }

    // 5. 앱 내 알림 큐에 추가
    const result = await queueInAppNotification(userId, agentId, payload)
    results.push(result)

  } catch (error: any) {
    console.error('[Notification] 알림 발송 실패:', error)
    results.push({
      success: false,
      channel: 'in_app',
      error: error.message
    })
  }

  return results
}

/**
 * 매칭된 사용자들에게 공고 알림 발송
 */
export async function notifyMatchedUsers(
  programId: string,
  minScore: number = 70
): Promise<{
  notified: number
  failed: number
  skipped: number
}> {
  const supabase = createAdminClient()
  let notified = 0
  let failed = 0
  let skipped = 0

  try {
    // 1. 공고 정보 조회
    const { data: program } = await (supabase as any)
      .from('government_programs')
      .select('*')
      .eq('id', programId)
      .single()

    if (!program) {
      return { notified: 0, failed: 0, skipped: 1 }
    }

    // 2. 알림 설정이 활성화된 사용자 조회
    const { data: channels } = await (supabase as any)
      .from('notification_channels')
      .select('user_id, notification_settings')
      .eq('is_active', true)
      .not('user_id', 'is', null)

    if (!channels || channels.length === 0) {
      return { notified: 0, failed: 0, skipped: 0 }
    }

    // 중복 제거
    const userIds = Array.from(new Set(channels.map((c: any) => c.user_id as string))) as string[]

    for (const userId of userIds) {
      try {
        // 사용자 프로필 조회 및 매칭 점수 계산
        const { data: profile } = await (supabase as any)
          .from('company_support_profiles')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (!profile) {
          skipped++
          continue
        }

        // 간단한 매칭 점수 계산
        let score = 50

        // 카테고리 매칭
        if (profile.interested_categories?.includes(program.category)) {
          score += 20
        }

        // 지역 매칭
        if (profile.region && program.target_regions?.includes(profile.region)) {
          score += 15
        }

        // 업종 매칭
        if (profile.industry_category && program.target_industries?.includes(profile.industry_category)) {
          score += 15
        }

        // 최소 점수 미만이면 스킵
        if (score < minScore) {
          skipped++
          continue
        }

        // 알림 발송
        const payload: NotificationPayload = {
          type: score >= 80 ? 'high_match' : 'new_program',
          programId,
          title: program.title,
          score,
          deadline: program.apply_end_date,
          organization: program.organization,
          reason: `카테고리: ${program.category}${profile.region && program.target_regions?.includes(profile.region) ? ', 지역 일치' : ''}`,
          url: program.detail_url || undefined
        }

        const results = await sendProgramNotification(userId, payload)
        const success = results.some(r => r.success)

        if (success) {
          notified++
        } else {
          failed++
        }

      } catch (error) {
        console.error(`[Notification] User ${userId} 알림 실패:`, error)
        failed++
      }
    }

  } catch (error) {
    console.error('[Notification] notifyMatchedUsers 오류:', error)
  }

  return { notified, failed, skipped }
}

/**
 * 마감 임박 공고 알림 발송 (Cron용)
 */
export async function sendEndingSoonNotifications(
  daysThreshold: number = 7
): Promise<{
  programsChecked: number
  notificationsSent: number
}> {
  const supabase = createAdminClient()
  let programsChecked = 0
  let notificationsSent = 0

  try {
    // 마감일이 threshold 이내인 공고 조회
    const thresholdDate = new Date()
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold)

    const { data: programs } = await (supabase as any)
      .from('government_programs')
      .select('*')
      .eq('status', 'active')
      .lte('apply_end_date', thresholdDate.toISOString().split('T')[0])
      .gte('apply_end_date', new Date().toISOString().split('T')[0])

    if (!programs) return { programsChecked: 0, notificationsSent: 0 }

    programsChecked = programs.length

    for (const program of programs) {
      const endDate = new Date(program.apply_end_date)
      const today = new Date()
      const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      const result = await notifyMatchedUsers(program.id, 60)
      notificationsSent += result.notified
    }

  } catch (error) {
    console.error('[Notification] sendEndingSoonNotifications 오류:', error)
  }

  return { programsChecked, notificationsSent }
}

/**
 * 일일 요약 알림 생성
 */
export async function sendDailyDigest(userId: string): Promise<NotificationResult> {
  const supabase = createAdminClient()

  try {
    // 오늘 수집된 공고 통계
    const today = new Date().toISOString().split('T')[0]

    const { count: newPrograms } = await (supabase as any)
      .from('government_programs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00`)

    const { count: endingSoon } = await (supabase as any)
      .from('government_programs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .lte('apply_end_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

    const payload: NotificationPayload = {
      type: 'daily_digest',
      title: '오늘의 정부지원사업 요약',
      extra: {
        summary: `📊 오늘 새로 등록된 공고: ${newPrograms || 0}건\n⏰ 7일 내 마감 예정: ${endingSoon || 0}건`
      }
    }

    const results = await sendProgramNotification(userId, payload)
    return results[0] || { success: false, channel: 'in_app', error: 'No result' }

  } catch (error: any) {
    console.error('[Notification] Daily digest 오류:', error)
    return { success: false, channel: 'in_app', error: error.message }
  }
}
