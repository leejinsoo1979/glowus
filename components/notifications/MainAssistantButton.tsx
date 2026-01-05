"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bot, Loader2, X, Send, Mic, MicOff, Sparkles } from "lucide-react"
import { useAgentNotification, AgentInfo } from "@/lib/contexts/AgentNotificationContext"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export function MainAssistantButton() {
  const { showAgentNotification } = useAgentNotification()
  const { accentColor } = useThemeStore()
  const [assistantInfo, setAssistantInfo] = useState<AgentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 테마 색상
  const themeColorData = accentColors.find(c => c.id === accentColor)
  const themeColor = themeColorData?.color || "#06b6d4"

  // 에이전트 정보 가져오기
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

  // 메시지 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 패널 열릴 때 인사 메시지
  useEffect(() => {
    if (isOpen && messages.length === 0 && assistantInfo) {
      const greetings = [
        "안녕하세요 대표님! 무엇을 도와드릴까요?",
        "네, 대표님! 오늘도 화이팅이에요! 무엇을 도와드릴까요?",
        "대표님, 반갑습니다! 궁금한 것이 있으시면 말씀해주세요.",
      ]
      const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)]

      setTimeout(() => {
        setMessages([{
          id: Date.now().toString(),
          role: "assistant",
          content: randomGreeting,
          timestamp: new Date(),
        }])
      }, 300)
    }
  }, [isOpen, assistantInfo])

  // 토글 핸들러
  const handleToggle = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }

  // 메시지 전송
  const handleSend = async () => {
    if (!input.trim() || !assistantInfo) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    try {
      // 에이전트 채팅 API 호출
      const res = await fetch(`/api/agents/${assistantInfo.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response || data.message || "응답을 가져올 수 없습니다.",
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error("Failed to get response")
      }
    } catch (err) {
      console.error("Chat error:", err)
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "죄송해요, 일시적인 오류가 발생했어요. 다시 시도해주세요!",
        timestamp: new Date(),
      }])
    } finally {
      setIsTyping(false)
    }
  }

  // Enter 키 핸들러
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 음성 입력 토글
  const toggleVoice = () => {
    setIsListening(!isListening)
    // TODO: 음성 인식 구현
  }

  if (loading) {
    return (
      <div className="fixed bottom-5 right-5 z-50">
        <div className="w-11 h-11 rounded-full bg-zinc-800/80 backdrop-blur-sm flex items-center justify-center animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
        </div>
      </div>
    )
  }

  if (!assistantInfo) return null

  const avatarUrl = assistantInfo.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${assistantInfo.name}-female`

  return (
    <>
      {/* 채팅 패널 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-5 z-50 w-[360px] h-[480px] bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-800 flex flex-col overflow-hidden"
            style={{
              boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px ${themeColor}20`,
            }}
          >
            {/* 헤더 */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-zinc-800"
              style={{ background: `linear-gradient(135deg, ${themeColor}20, transparent)` }}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={avatarUrl}
                    alt={assistantInfo.name}
                    className="w-10 h-10 rounded-full border-2"
                    style={{ borderColor: themeColor }}
                  />
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900"
                    style={{ backgroundColor: themeColor }}
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">{assistantInfo.name}</h3>
                  <p className="text-xs text-zinc-400">AI 에이전트 비서</p>
                </div>
              </div>
              <button
                onClick={handleToggle}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  {msg.role === "assistant" && (
                    <img
                      src={avatarUrl}
                      alt={assistantInfo.name}
                      className="w-8 h-8 rounded-full flex-shrink-0"
                    />
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] px-4 py-2.5 rounded-2xl text-sm",
                      msg.role === "user"
                        ? "bg-zinc-700 text-white rounded-br-md"
                        : "bg-zinc-800 text-zinc-100 rounded-bl-md"
                    )}
                    style={msg.role === "user" ? { backgroundColor: themeColor } : {}}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3">
                  <img
                    src={avatarUrl}
                    alt={assistantInfo.name}
                    className="w-8 h-8 rounded-full flex-shrink-0"
                  />
                  <div className="bg-zinc-800 px-4 py-3 rounded-2xl rounded-bl-md">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <div className="p-4 border-t border-zinc-800">
              <div className="flex items-center gap-2 bg-zinc-800 rounded-xl px-4 py-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 bg-transparent text-white text-sm placeholder:text-zinc-500 focus:outline-none"
                />
                <button
                  onClick={toggleVoice}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    isListening ? "text-red-500 bg-red-500/20" : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700"
                  )}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="p-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: input.trim() ? themeColor : "transparent", color: input.trim() ? "white" : "#71717a" }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 미니멀 플로팅 버튼 - hover 시 확장 */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleToggle}
        className={cn(
          "fixed bottom-5 right-5 z-50 group",
          "flex items-center justify-center rounded-full text-white",
          "transition-all duration-300 ease-out",
          isOpen
            ? "w-11 h-11"
            : "w-11 h-11 hover:w-auto hover:px-4 hover:gap-2.5"
        )}
        style={{
          background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`,
          boxShadow: `0 4px 20px ${themeColor}40`,
        }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center"
            >
              <div className="w-6 h-6 rounded-full overflow-hidden border border-white/30 flex-shrink-0">
                <img src={avatarUrl} alt={assistantInfo.name} className="w-full h-full object-cover" />
              </div>
              <span className="font-medium text-xs whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-[100px] transition-all duration-300 ease-out opacity-0 group-hover:opacity-100">
                AI 비서
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  )
}
