"use client"

import { useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAgentNotification, AgentInfo } from '@/lib/contexts/AgentNotificationContext'

interface NotificationQueueItem {
  id: string
  user_id: string
  notification_type: string
  program_id: string | null
  payload: {
    generatedTitle: string
    generatedMessage: string
    notificationType: 'info' | 'alert' | 'task' | 'greeting'
    agentId: string
    title: string
    score?: number
    deadline?: string
    organization?: string
    url?: string
  }
  status: string
  priority: number
  scheduled_at: string
  created_at: string
}

/**
 * 정부지원사업 알림 구독 훅
 * - Supabase Realtime으로 notification_queue 구독
 * - 새 알림 도착 시 AgentNotificationPopup으로 표시
 */
export function useGovernmentProgramNotifications() {
  const supabase = createClient()
  const { showAgentNotification } = useAgentNotification()
  const processedIdsRef = useRef<Set<string>>(new Set())
  const agentCacheRef = useRef<Map<string, AgentInfo>>(new Map())

  // 에이전트 정보 조회 (캐시 사용)
  const getAgentInfo = useCallback(async (agentId: string): Promise<AgentInfo | null> => {
    // 캐시 확인
    if (agentCacheRef.current.has(agentId)) {
      return agentCacheRef.current.get(agentId)!
    }

    try {
      const { data } = await supabase
        .from('deployed_agents')
        .select('id, name, avatar_url, emotion_avatars, voice_settings')
        .eq('id', agentId)
        .single() as { data: { id: string; name: string; avatar_url: string | null; emotion_avatars: any; voice_settings: any } | null }

      if (data) {
        const agentInfo: AgentInfo = {
          id: data.id,
          name: data.name,
          avatar_url: data.avatar_url,
          emotion_avatars: data.emotion_avatars,
          voice_settings: data.voice_settings
        }
        agentCacheRef.current.set(agentId, agentInfo)
        return agentInfo
      }
    } catch (error) {
      console.error('[NotificationHook] 에이전트 조회 실패:', error)
    }

    return null
  }, [supabase])

  // 알림 처리
  const handleNotification = useCallback(async (item: NotificationQueueItem) => {
    // 중복 방지
    if (processedIdsRef.current.has(item.id)) {
      return
    }
    processedIdsRef.current.add(item.id)

    const { payload } = item

    // 에이전트 정보 조회
    const agent = await getAgentInfo(payload.agentId)
    if (!agent) {
      console.warn('[NotificationHook] 에이전트를 찾을 수 없음:', payload.agentId)
      return
    }

    // 알림 표시
    showAgentNotification(agent, payload.generatedMessage, {
      type: payload.notificationType,
      actions: payload.url ? [
        {
          label: '자세히 보기',
          onClick: () => {
            window.open(payload.url, '_blank')
          }
        }
      ] : undefined
    })

    // 큐 상태 업데이트 (processed)
    try {
      await (supabase as any)
        .from('notification_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('id', item.id)
    } catch (error) {
      console.error('[NotificationHook] 큐 상태 업데이트 실패:', error)
    }
  }, [getAgentInfo, showAgentNotification, supabase])

  // 초기 미처리 알림 로드
  const loadPendingNotifications = useCallback(async (userId: string) => {
    try {
      const { data: pendingItems } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(5) // 한번에 5개까지만

      if (pendingItems && pendingItems.length > 0) {
        console.log(`[NotificationHook] 미처리 알림 ${pendingItems.length}개 발견`)
        for (const item of pendingItems) {
          await handleNotification(item as NotificationQueueItem)
          // 연속 알림 방지를 위한 딜레이
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    } catch (error) {
      console.error('[NotificationHook] 미처리 알림 로드 실패:', error)
    }
  }, [handleNotification, supabase])

  // Realtime 구독
  useEffect(() => {
    let channel: any = null

    const setupSubscription = async () => {
      // 현재 사용자 확인
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('[NotificationHook] 로그인되지 않음, 구독 스킵')
        return
      }

      // 미처리 알림 로드
      await loadPendingNotifications(user.id)

      // Realtime 채널 설정
      channel = supabase
        .channel('government-program-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notification_queue',
            filter: `user_id=eq.${user.id}`
          },
          async (payload: any) => {
            console.log('[NotificationHook] 새 알림 수신:', payload.new)
            await handleNotification(payload.new as NotificationQueueItem)
          }
        )
        .subscribe((status: string) => {
          console.log('[NotificationHook] 구독 상태:', status)
        })
    }

    setupSubscription()

    // 정리
    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [handleNotification, loadPendingNotifications, supabase])

  return null
}

export default useGovernmentProgramNotifications
