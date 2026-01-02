'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  MessageSquare,
  Send,
  X,
  Loader2,
  User,
  Bot,
} from 'lucide-react'
import {
  GeminiLiveClient,
  VoiceMessage,
  VoiceSession,
} from '@/lib/voice/gemini-live-client'

interface VoiceCallPanelProps {
  isOpen: boolean
  onClose: () => void
  agentName?: string
  agentAvatar?: string
  systemPrompt?: string
  voice?: string
}

export default function VoiceCallPanel({
  isOpen,
  onClose,
  agentName = 'AI 어시스턴트',
  agentAvatar,
  systemPrompt,
  voice = 'Kore',
}: VoiceCallPanelProps) {
  const [status, setStatus] = useState<VoiceSession['status']>('idle')
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [inputText, setInputText] = useState('')
  const [showChat, setShowChat] = useState(false)
  const [callDuration, setCallDuration] = useState(0)

  const clientRef = useRef<GeminiLiveClient | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // 클라이언트 초기화
  useEffect(() => {
    if (isOpen && !clientRef.current) {
      clientRef.current = new GeminiLiveClient({
        voice,
        systemPrompt,
        onStatusChange: setStatus,
        onMessage: (message) => {
          setMessages((prev) => [...prev, message])
        },
        onTranscription: (text) => {
          console.log('Transcription:', text)
        },
        onError: (error) => {
          console.error('Voice error:', error)
        },
      })
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.endSession()
        clientRef.current = null
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isOpen, voice, systemPrompt])

  // 메시지 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 통화 시작
  const handleStartCall = useCallback(async () => {
    if (!clientRef.current) return

    try {
      await clientRef.current.startSession()
      setCallDuration(0)
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)

      // 환영 메시지
      setMessages([
        {
          role: 'assistant',
          content: `안녕하세요! ${agentName}입니다. 무엇을 도와드릴까요?`,
          timestamp: new Date(),
        },
      ])

      // 환영 메시지 읽기
      await clientRef.current.speak(`안녕하세요! ${agentName}입니다. 무엇을 도와드릴까요?`)
    } catch (error) {
      console.error('Failed to start call:', error)
    }
  }, [agentName])

  // 통화 종료
  const handleEndCall = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.endSession()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsListening(false)
    setCallDuration(0)
    setMessages([])
    onClose()
  }, [onClose])

  // 음성 인식 토글
  const toggleListening = useCallback(() => {
    if (!clientRef.current) return

    if (isListening) {
      clientRef.current.stopListening()
      setIsListening(false)
    } else {
      clientRef.current.startListening()
      setIsListening(true)
    }
  }, [isListening])

  // 음소거 토글
  const toggleMute = useCallback(() => {
    if (clientRef.current) {
      if (!isMuted) {
        clientRef.current.stopSpeaking()
      }
    }
    setIsMuted(!isMuted)
  }, [isMuted])

  // 텍스트 전송
  const handleSendText = useCallback(async () => {
    if (!inputText.trim() || !clientRef.current) return

    const text = inputText.trim()
    setInputText('')
    await clientRef.current.sendText(text)
  }, [inputText])

  // 시간 포맷
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-md mx-4 bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* 상단 헤더 */}
          <div className="relative p-6 text-center">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 아바타 */}
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div
                className={`w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ${
                  status === 'active' || status === 'processing'
                    ? 'animate-pulse'
                    : ''
                }`}
              >
                {agentAvatar ? (
                  <img
                    src={agentAvatar}
                    alt={agentName}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <Bot className="w-12 h-12 text-white" />
                )}
              </div>
              {(status === 'active' || status === 'processing') && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-gray-900" />
              )}
            </div>

            <h2 className="text-xl font-semibold text-white">{agentName}</h2>
            <p className="text-sm text-gray-400 mt-1">
              {status === 'idle' && '통화 대기 중'}
              {status === 'connecting' && '연결 중...'}
              {status === 'active' && `통화 중 · ${formatDuration(callDuration)}`}
              {status === 'processing' && '처리 중...'}
              {status === 'error' && '오류 발생'}
            </p>
          </div>

          {/* 대화 내용 (채팅 모드) */}
          {showChat && (
            <div className="h-64 overflow-y-auto px-4 space-y-3">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-100'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <p className="text-xs opacity-50 mt-1">
                      {msg.timestamp.toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* 음성 시각화 */}
          {!showChat && status === 'active' && (
            <div className="h-32 flex items-center justify-center px-8">
              <div className="flex items-end justify-center gap-1 h-16">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 bg-gradient-to-t from-blue-500 to-purple-500 rounded-full"
                    animate={{
                      height: isListening
                        ? [8, Math.random() * 48 + 16, 8]
                        : [8, 16, 8],
                    }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                      delay: i * 0.05,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 텍스트 입력 */}
          {showChat && (
            <div className="px-4 pb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendText()}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-xl border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleSendText}
                  disabled={!inputText.trim() || status === 'processing'}
                  className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* 컨트롤 버튼들 */}
          <div className="p-6 pt-2">
            <div className="flex items-center justify-center gap-4">
              {/* 음소거 */}
              <button
                onClick={toggleMute}
                disabled={status === 'idle'}
                className={`p-4 rounded-full transition-all ${
                  isMuted
                    ? 'bg-yellow-500/20 text-yellow-500'
                    : 'bg-gray-800 text-white hover:bg-gray-700'
                } disabled:opacity-50`}
              >
                {isMuted ? (
                  <VolumeX className="w-6 h-6" />
                ) : (
                  <Volume2 className="w-6 h-6" />
                )}
              </button>

              {/* 통화 시작/종료 */}
              {status === 'idle' ? (
                <button
                  onClick={handleStartCall}
                  className="p-6 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors shadow-lg shadow-green-500/30"
                >
                  <Phone className="w-8 h-8" />
                </button>
              ) : (
                <button
                  onClick={handleEndCall}
                  className="p-6 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30"
                >
                  <PhoneOff className="w-8 h-8" />
                </button>
              )}

              {/* 마이크 */}
              <button
                onClick={toggleListening}
                disabled={status === 'idle'}
                className={`p-4 rounded-full transition-all ${
                  isListening
                    ? 'bg-blue-500 text-white animate-pulse'
                    : 'bg-gray-800 text-white hover:bg-gray-700'
                } disabled:opacity-50`}
              >
                {isListening ? (
                  <Mic className="w-6 h-6" />
                ) : (
                  <MicOff className="w-6 h-6" />
                )}
              </button>
            </div>

            {/* 채팅 모드 토글 */}
            <div className="flex justify-center mt-4">
              <button
                onClick={() => setShowChat(!showChat)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ${
                  showChat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                {showChat ? '음성 모드' : '채팅 모드'}
              </button>
            </div>
          </div>

          {/* 처리 중 오버레이 */}
          {status === 'processing' && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="flex items-center gap-3 px-6 py-3 bg-gray-900 rounded-full">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <span className="text-white">처리 중...</span>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
