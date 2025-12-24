"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bot, Loader2 } from "lucide-react"
import { useAgentNotification, AgentInfo } from "@/lib/contexts/AgentNotificationContext"
import { useThemeStore, accentColors } from "@/stores/themeStore"

export function MainAssistantButton() {
  const { showAgentNotification } = useAgentNotification()
  const { accentColor } = useThemeStore()
  const [assistantInfo, setAssistantInfo] = useState<AgentInfo | null>(null)
  const [loading, setLoading] = useState(true)

  // 테마 색상
  const themeColorData = accentColors.find(c => c.id === accentColor)
  const themeColor = themeColorData?.color || "#06b6d4"

  // 에이미 정보 가져오기
  useEffect(() => {
    const fetchAssistant = async () => {
      try {
        const res = await fetch("/api/agents")
        if (res.ok) {
          const agents = await res.json()
          // "에이미" 또는 "amy"가 포함된 에이전트 찾기
          const amy = agents.find((a: any) =>
            a.name.toLowerCase().includes("에이미") ||
            a.name.toLowerCase().includes("amy")
          )
          if (amy) {
            setAssistantInfo({
              id: amy.id,
              name: amy.name,
              avatar_url: amy.avatar_url,
              emotion_avatars: amy.emotion_avatars,
              voice_settings: amy.voice_settings,
            })
          } else if (agents.length > 0) {
            // 에이미가 없으면 첫 번째 에이전트 사용
            setAssistantInfo({
              id: agents[0].id,
              name: agents[0].name,
              avatar_url: agents[0].avatar_url,
              emotion_avatars: agents[0].emotion_avatars,
              voice_settings: agents[0].voice_settings,
            })
          }
        }
      } catch (err) {
        console.error("Failed to fetch assistant:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchAssistant()
  }, [])

  // 에이미 인사 알림 트리거
  const triggerAssistantGreeting = () => {
    if (!assistantInfo) return

    const greetings = [
      "네~ 대표님",
      "대표님 부르셨어요?",
      "네 무슨일이세요 대표님?",
    ]
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)]

    showAgentNotification(assistantInfo, randomGreeting, {
      type: "greeting",
    })
  }

  if (loading) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      </div>
    )
  }

  if (!assistantInfo) return null

  const avatarUrl = assistantInfo.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${assistantInfo.name}-female`

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={triggerAssistantGreeting}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-full text-white shadow-2xl transition-all"
      style={{
        background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
        boxShadow: `0 8px 32px ${themeColor}50`,
      }}
    >
      <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/30">
        <img src={avatarUrl} alt={assistantInfo.name} className="w-full h-full object-cover" />
      </div>
      <span className="font-semibold text-sm">에이전트 비서</span>
    </motion.button>
  )
}
