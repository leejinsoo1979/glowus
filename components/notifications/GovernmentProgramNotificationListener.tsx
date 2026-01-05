"use client"

import { useGovernmentProgramNotifications } from '@/hooks/useGovernmentProgramNotifications'

/**
 * 정부지원사업 알림 리스너 컴포넌트
 * - Supabase Realtime으로 notification_queue 구독
 * - 새 알림 도착 시 AgentNotificationPopup으로 표시
 */
export function GovernmentProgramNotificationListener() {
  // 훅 호출 - 자동으로 구독 설정됨
  useGovernmentProgramNotifications()

  // 렌더링 없음 (이벤트 리스너만 동작)
  return null
}

export default GovernmentProgramNotificationListener
