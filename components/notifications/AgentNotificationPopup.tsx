"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, Bell, AlertTriangle, CheckCircle, MessageCircle, Sparkles } from "lucide-react"
import { useAgentNotification, AgentNotification } from "@/lib/contexts/AgentNotificationContext"

const typeIcons = {
  info: Bell,
  alert: AlertTriangle,
  task: CheckCircle,
  greeting: Sparkles,
}

function NotificationItem({ notification, index }: { notification: AgentNotification; index: number }) {
  const { dismissNotification } = useAgentNotification()
  const { agent, message, type, emotion, actions } = notification

  // 아바타 URL 결정
  const avatarUrl = emotion && agent.emotion_avatars?.[emotion]
    ? agent.emotion_avatars[emotion]
    : agent.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${agent.name}`

  const Icon = typeIcons[type]
  const accentColor = agent.accentColor || "#06b6d4"

  return (
    <>
      {/* 배경 오버레이 + 중앙 정렬 컨테이너 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center"
        onClick={() => dismissNotification(notification.id)}
        style={{ zIndex: 100 + index }}
      >
        {/* 팝업 카드 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 400 }}
          className="w-[360px]"
          onClick={(e) => e.stopPropagation()}
        >
        {/* 메인 카드 */}
        <div
          className="relative bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-3xl overflow-hidden"
          style={{
            boxShadow: `0 0 80px ${accentColor}30, 0 0 120px ${accentColor}10, 0 25px 50px -12px rgba(0, 0, 0, 0.8)`,
          }}
        >
          {/* 상단 글로우 효과 */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full blur-3xl opacity-30"
            style={{ background: accentColor }}
          />

          {/* 닫기 버튼 */}
          <button
            onClick={() => dismissNotification(notification.id)}
            className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800/50 hover:bg-zinc-700/50 transition-all z-20 group"
          >
            <X className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
          </button>

          {/* 프로필 섹션 - 중앙 상단 */}
          <div className="relative pt-8 pb-4 flex flex-col items-center">
            {/* 아바타 링 애니메이션 */}
            <div className="relative">
              {/* 외부 글로우 링 */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-2 rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, ${accentColor}, transparent, ${accentColor})`,
                  opacity: 0.5,
                }}
              />
              {/* 아바타 컨테이너 */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
                className="relative w-24 h-24 rounded-full p-1"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}, ${accentColor}60)`,
                }}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-zinc-900">
                  <img
                    src={avatarUrl}
                    alt={agent.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </motion.div>
              {/* 타입 배지 */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-zinc-900"
                style={{ backgroundColor: accentColor }}
              >
                <Icon className="w-4 h-4 text-white" />
              </motion.div>
            </div>

            {/* 에이전트 이름 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-4 text-center"
            >
              <h3
                className="text-xl font-bold"
                style={{ color: accentColor }}
              >
                {agent.name}
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                {type === "greeting" ? "인사" : type === "alert" ? "알림" : type === "task" ? "태스크" : "정보"}
              </p>
            </motion.div>
          </div>

          {/* 메시지 섹션 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="px-6 pb-4"
          >
            <div className="bg-zinc-800/50 rounded-2xl p-4 border border-zinc-700/50">
              <p className="text-sm text-zinc-200 leading-relaxed text-center">
                {message}
              </p>
            </div>
          </motion.div>

          {/* 액션 버튼 섹션 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="px-6 pb-6"
          >
            {actions && actions.length > 0 ? (
              <div className="flex gap-3">
                {actions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      action.onClick()
                      dismissNotification(notification.id)
                    }}
                    className={`flex-1 py-3 px-4 text-sm font-semibold rounded-xl transition-all ${
                      idx === 0
                        ? "text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                        : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                    }`}
                    style={idx === 0 ? {
                      background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                      boxShadow: `0 4px 20px ${accentColor}40`,
                    } : {}}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : (
              <button
                onClick={() => dismissNotification(notification.id)}
                className="w-full py-3 px-4 text-sm font-semibold rounded-xl text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                  boxShadow: `0 4px 20px ${accentColor}40`,
                }}
              >
                확인
              </button>
            )}
          </motion.div>

          {/* 하단 진행 바 */}
          <div className="h-1 bg-zinc-800">
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 8, ease: "linear" }}
              className="h-full origin-left"
              style={{ backgroundColor: accentColor }}
            />
          </div>
        </div>
        </motion.div>
      </motion.div>
    </>
  )
}

export function AgentNotificationPopup() {
  const { notifications } = useAgentNotification()

  return (
    <AnimatePresence mode="wait">
      {notifications.length > 0 && (
        <NotificationItem
          key={notifications[notifications.length - 1].id}
          notification={notifications[notifications.length - 1]}
          index={0}
        />
      )}
    </AnimatePresence>
  )
}
