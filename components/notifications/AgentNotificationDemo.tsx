"use client"

import { useAgentNotification, AgentInfo } from "@/lib/contexts/AgentNotificationContext"
import { Button } from "@/components/ui/Button"
import { Bot, Sparkles } from "lucide-react"

// 프리셋 에이전트들
const presetAgents: Record<string, AgentInfo> = {
  amy: {
    id: "amy-001",
    name: "Amy",
    avatar_url: "/agent_image.jpg",
    accentColor: "#06b6d4",
  },
  rachel: {
    id: "rachel-001",
    name: "Rachel",
    avatar_url: "https://api.dicebear.com/7.x/lorelei/svg?seed=Rachel&backgroundColor=a855f7",
    accentColor: "#a855f7",
  },
  jeremy: {
    id: "jeremy-001",
    name: "Jeremy",
    avatar_url: "https://api.dicebear.com/7.x/lorelei/svg?seed=Jeremy&backgroundColor=22c55e",
    accentColor: "#22c55e",
  },
  antigravity: {
    id: "antigravity-001",
    name: "Antigravity",
    avatar_url: "https://api.dicebear.com/7.x/lorelei/svg?seed=Antigravity&backgroundColor=f59e0b",
    accentColor: "#f59e0b",
  },
}

// 샘플 메시지들
const sampleMessages = {
  amy: [
    { message: "안녕하세요! 오늘 오후 3시에 팀 미팅이 예정되어 있어요.", type: "info" as const },
    { message: "긴급: 투자자 미팅이 내일로 앞당겨졌습니다!", type: "alert" as const },
    { message: "주간 리포트 작성이 완료되었습니다. 확인해주세요.", type: "task" as const },
  ],
  rachel: [
    { message: "시장 분석 결과가 준비되었습니다. 흥미로운 인사이트가 있어요.", type: "info" as const },
    { message: "경쟁사 동향에 주목할 필요가 있습니다.", type: "alert" as const },
  ],
  jeremy: [
    { message: "새로운 기능 구현이 완료되었습니다. 테스트 부탁드려요!", type: "task" as const },
    { message: "코드 리뷰 요청이 3건 대기 중입니다.", type: "info" as const },
  ],
  antigravity: [
    { message: "시스템 상태가 정상입니다. 모든 서비스가 원활하게 운영 중이에요.", type: "info" as const },
    { message: "새로운 업데이트가 준비되었습니다.", type: "task" as const },
  ],
}

export function AgentNotificationDemo() {
  const { showAgentNotification } = useAgentNotification()

  const triggerRandomNotification = () => {
    const agentNames = Object.keys(presetAgents)
    const randomAgentName = agentNames[Math.floor(Math.random() * agentNames.length)]
    const agent = presetAgents[randomAgentName]
    const messages = sampleMessages[randomAgentName as keyof typeof sampleMessages]
    const randomMessage = messages[Math.floor(Math.random() * messages.length)]

    showAgentNotification(agent, randomMessage.message, {
      type: randomMessage.type,
      actions: [
        { label: "확인", onClick: () => console.log("확인 클릭") },
        { label: "나중에", onClick: () => console.log("나중에 클릭") },
      ],
    })
  }

  const triggerAmyGreeting = () => {
    showAgentNotification(presetAgents.amy, "반가워요! 오늘 하루도 화이팅이에요! 무엇을 도와드릴까요?", {
      type: "greeting",
      actions: [
        { label: "일정 확인", onClick: () => console.log("일정 확인") },
        { label: "할 일 보기", onClick: () => console.log("할 일 보기") },
      ],
    })
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-3">
      <Button
        onClick={triggerAmyGreeting}
        size="sm"
        className="bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white shadow-lg shadow-cyan-500/25 rounded-full px-5"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        Amy 인사
      </Button>
      <Button
        onClick={triggerRandomNotification}
        size="sm"
        variant="outline"
        className="bg-zinc-900/90 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white shadow-lg rounded-full px-5"
      >
        <Bot className="w-4 h-4 mr-2" />
        랜덤 알림
      </Button>
    </div>
  )
}

// 편의 훅: 앱 어디서든 에이전트 알림 보내기
export function useAmyNotification() {
  const { showAgentNotification } = useAgentNotification()

  return {
    greet: (message?: string) => {
      showAgentNotification(
        presetAgents.amy,
        message || "안녕하세요! 무엇을 도와드릴까요?",
        { type: "greeting" }
      )
    },
    info: (message: string) => {
      showAgentNotification(presetAgents.amy, message, { type: "info" })
    },
    alert: (message: string) => {
      showAgentNotification(presetAgents.amy, message, { type: "alert" })
    },
    task: (message: string, actions?: { label: string; onClick: () => void }[]) => {
      showAgentNotification(presetAgents.amy, message, { type: "task", actions })
    },
  }
}
