"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { MessageCircle, X, Send, Bot, User, Minimize2, Maximize2, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useThemeStore, accentColors } from "@/stores/themeStore"

interface Message {
  id: string
  content: string
  sender: "user" | "bot"
  timestamp: Date
}

const mockBotResponses = [
  "태스크 관리, 일정 조정, 팀 생산성 분석에 도움을 드릴 수 있어요. 무엇을 도와드릴까요?",
  "현재 진행 중인 태스크를 분석했어요. 마감일이 임박한 태스크 3개가 있습니다. 자세한 내용을 보시겠어요?",
  "이번 주 팀 생산성이 지난주 대비 12% 향상되었어요! 결제 시스템 연동 태스크가 특히 잘 진행되고 있네요.",
  "스프린트 종료까지 3일 남았어요. 현재 진행률 65%입니다. 리스크 분석 결과를 공유해드릴까요?",
  "KPI 데이터를 분석한 결과, MRR이 전월 대비 8% 성장했어요. 더 자세한 분석이 필요하시면 말씀해주세요.",
]

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const { accentColor } = useThemeStore()
  const [mounted, setMounted] = useState(false)
  const currentAccent = accentColors.find(c => c.id === accentColor) || accentColors[0]
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "안녕하세요! GlowUS AI 어시스턴트입니다. 팀 운영에 관해 무엇이든 물어보세요!",
      sender: "bot",
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsTyping(true)

    // Simulate bot response delay
    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: mockBotResponses[Math.floor(Math.random() * mockBotResponses.length)],
        sender: "bot",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, botResponse])
      setIsTyping(false)
    }, 1500)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-shadow"
          style={{
            background: mounted
              ? `linear-gradient(to bottom right, ${currentAccent.color}, #6366f1)`
              : 'linear-gradient(to bottom right, var(--accent-color), #6366f1)',
            boxShadow: mounted
              ? `0 10px 15px -3px ${currentAccent.color}4d, 0 4px 6px -4px ${currentAccent.color}4d`
              : '0 10px 15px -3px var(--accent-color-50)'
          }}
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </motion.button>
      </div>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <Card
          className={`bg-zinc-900 border-zinc-800 shadow-2xl transition-all duration-300 ${
            isMinimized ? "w-80 h-16" : "w-96 h-[500px]"
          }`}
        >
          <CardHeader className="p-4 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-xl"
                  style={{
                    background: mounted
                      ? `linear-gradient(to bottom right, ${currentAccent.color}33, #6366f133)`
                      : 'linear-gradient(to bottom right, var(--accent-color-20), #6366f133)'
                  }}
                >
                  <Sparkles className="h-4 w-4" style={{ color: mounted ? currentAccent.color : 'var(--accent-color)' }} />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-zinc-100">
                    GlowUS AI
                  </CardTitle>
                  <p className="text-xs text-success-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-success-500 rounded-full animate-pulse" />
                    온라인
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
                >
                  {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          {!isMinimized && (
            <>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <div className="h-80 overflow-y-auto p-4 space-y-4">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-start gap-3 ${message.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <div
                        className="p-2 rounded-xl"
                        style={{
                          background: message.sender === "user"
                            ? mounted
                              ? `linear-gradient(to bottom right, ${currentAccent.color}33, #6366f133)`
                              : 'linear-gradient(to bottom right, var(--accent-color-20), #6366f133)'
                            : '#27272a'
                        }}
                      >
                        {message.sender === "user" ? (
                          <User className="h-4 w-4" style={{ color: mounted ? currentAccent.color : 'var(--accent-color)' }} />
                        ) : (
                          <Bot className="h-4 w-4 text-zinc-400" />
                        )}
                      </div>
                      <div className={`max-w-[75%] ${message.sender === "user" ? "text-right" : "text-left"}`}>
                        <div
                          className="p-3 rounded-xl"
                          style={{
                            background: message.sender === "user"
                              ? mounted
                                ? `linear-gradient(to bottom right, ${currentAccent.color}, #6366f1)`
                                : 'linear-gradient(to bottom right, var(--accent-color), #6366f1)'
                              : '#27272a',
                            color: message.sender === "user" ? '#fff' : '#f4f4f5'
                          }}
                        >
                          <p className="text-sm leading-relaxed">{message.content}</p>
                        </div>
                        <p className="text-xs text-zinc-600 mt-1">
                          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </motion.div>
                  ))}

                  {isTyping && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-zinc-800 rounded-xl">
                        <Bot className="h-4 w-4 text-zinc-400" />
                      </div>
                      <div className="bg-zinc-800 p-3 rounded-xl">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </CardContent>

              <div className="p-4 border-t border-zinc-800">
                <div className="flex items-center gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="메시지를 입력하세요..."
                    className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isTyping}
                    className="hover:opacity-90"
                    size="icon"
                    style={{
                      background: mounted
                        ? `linear-gradient(to right, ${currentAccent.color}, #6366f1)`
                        : 'linear-gradient(to right, var(--accent-color), #6366f1)'
                    }}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
