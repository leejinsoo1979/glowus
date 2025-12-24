"use client"

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react"

// 알림 사운드 재생 함수
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

    // 첫 번째 톤 (높은 음)
    const oscillator1 = audioContext.createOscillator()
    const gainNode1 = audioContext.createGain()
    oscillator1.connect(gainNode1)
    gainNode1.connect(audioContext.destination)
    oscillator1.frequency.value = 880 // A5
    oscillator1.type = "sine"
    gainNode1.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
    oscillator1.start(audioContext.currentTime)
    oscillator1.stop(audioContext.currentTime + 0.3)

    // 두 번째 톤 (더 높은 음) - 0.15초 후
    const oscillator2 = audioContext.createOscillator()
    const gainNode2 = audioContext.createGain()
    oscillator2.connect(gainNode2)
    gainNode2.connect(audioContext.destination)
    oscillator2.frequency.value = 1108.73 // C#6
    oscillator2.type = "sine"
    gainNode2.gain.setValueAtTime(0, audioContext.currentTime + 0.15)
    gainNode2.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.16)
    gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.45)
    oscillator2.start(audioContext.currentTime + 0.15)
    oscillator2.stop(audioContext.currentTime + 0.45)
  } catch (e) {
    console.warn("Could not play notification sound:", e)
  }
}

export interface AgentVoiceSettings {
  voice?: "sol" | "tara" | "cove" | "puck" | "charon" | "vale"
  conversation_style?: "professional" | "friendly" | "casual" | "empathetic" | "concise"
  vad_sensitivity?: "low" | "medium" | "high"
}

export interface AgentInfo {
  id: string
  name: string
  avatar_url?: string | null
  emotion_avatars?: Record<string, string> | null
  accentColor?: string
  voice_settings?: AgentVoiceSettings
}

export interface AgentNotification {
  id: string
  agent: AgentInfo
  message: string
  type: "info" | "alert" | "task" | "greeting"
  emotion?: string
  createdAt: Date
  actions?: {
    label: string
    onClick: () => void
  }[]
}

interface AgentNotificationContextType {
  notifications: AgentNotification[]
  showAgentNotification: (
    agent: AgentInfo,
    message: string,
    options?: {
      type?: AgentNotification["type"]
      emotion?: string
      actions?: AgentNotification["actions"]
      duration?: number
    }
  ) => string
  dismissNotification: (id: string) => void
  clearAllNotifications: () => void
  // 🔥 음성통화 상태 - 통화 중일 때 알림 TTS 비활성화
  isVoiceCallActive: boolean
  setVoiceCallActive: (active: boolean) => void
}

const AgentNotificationContext = createContext<AgentNotificationContextType | null>(null)

const MAX_NOTIFICATIONS = 3
const DEFAULT_DURATION = 0 // 0 = 자동 닫힘 없음 (사용자가 직접 닫아야 함)

// 에이전트별 액센트 컬러
const agentColors: Record<string, string> = {
  amy: "#06b6d4",      // cyan
  rachel: "#a855f7",   // purple
  jeremy: "#22c55e",   // green
  antigravity: "#f59e0b", // amber
  default: "#3b82f6",  // blue
}

export function AgentNotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AgentNotification[]>([])
  const [isVoiceCallActive, setVoiceCallActive] = useState(false)  // 🔥 음성통화 상태
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const dismissNotification = useCallback((id: string) => {
    // 타이머 정리
    const timeout = timeoutRefs.current.get(id)
    if (timeout) {
      clearTimeout(timeout)
      timeoutRefs.current.delete(id)
    }

    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const showAgentNotification = useCallback((
    agent: AgentInfo,
    message: string,
    options?: {
      type?: AgentNotification["type"]
      emotion?: string
      actions?: AgentNotification["actions"]
      duration?: number
    }
  ) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // 액센트 컬러 설정
    const agentNameLower = agent.name.toLowerCase()
    const accentColor = agent.accentColor || agentColors[agentNameLower] || agentColors.default

    const notification: AgentNotification = {
      id,
      agent: { ...agent, accentColor },
      message,
      type: options?.type || "info",
      emotion: options?.emotion,
      createdAt: new Date(),
      actions: options?.actions,
    }

    // 알림 사운드 재생
    playNotificationSound()

    setNotifications(prev => {
      // 최대 개수 초과 시 가장 오래된 것 제거
      const newNotifications = [...prev, notification]
      if (newNotifications.length > MAX_NOTIFICATIONS) {
        const removed = newNotifications.shift()
        if (removed) {
          const timeout = timeoutRefs.current.get(removed.id)
          if (timeout) {
            clearTimeout(timeout)
            timeoutRefs.current.delete(removed.id)
          }
        }
      }
      return newNotifications
    })

    // 자동 제거 타이머
    const duration = options?.duration ?? DEFAULT_DURATION
    if (duration > 0) {
      const timeout = setTimeout(() => {
        dismissNotification(id)
      }, duration)
      timeoutRefs.current.set(id, timeout)
    }

    return id
  }, [dismissNotification])

  const clearAllNotifications = useCallback(() => {
    // 모든 타이머 정리
    timeoutRefs.current.forEach(timeout => clearTimeout(timeout))
    timeoutRefs.current.clear()
    setNotifications([])
  }, [])

  return (
    <AgentNotificationContext.Provider
      value={{
        notifications,
        showAgentNotification,
        dismissNotification,
        clearAllNotifications,
        isVoiceCallActive,
        setVoiceCallActive,
      }}
    >
      {children}
    </AgentNotificationContext.Provider>
  )
}

export function useAgentNotification() {
  const context = useContext(AgentNotificationContext)
  if (!context) {
    throw new Error("useAgentNotification must be used within AgentNotificationProvider")
  }
  return context
}

// 편의 함수: 에이전트 정보 없이 간단히 호출
export function createAgentNotifier(agent: AgentInfo) {
  return {
    info: (message: string, options?: { emotion?: string; actions?: AgentNotification["actions"] }) =>
      ({ agent, message, type: "info" as const, ...options }),
    alert: (message: string, options?: { emotion?: string; actions?: AgentNotification["actions"] }) =>
      ({ agent, message, type: "alert" as const, ...options }),
    task: (message: string, options?: { emotion?: string; actions?: AgentNotification["actions"] }) =>
      ({ agent, message, type: "task" as const, ...options }),
    greeting: (message: string, options?: { emotion?: string; actions?: AgentNotification["actions"] }) =>
      ({ agent, message, type: "greeting" as const, ...options }),
  }
}
