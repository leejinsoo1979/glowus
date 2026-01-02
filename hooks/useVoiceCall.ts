'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  GeminiLiveClient,
  VoiceMessage,
  VoiceSession,
  VoiceClientConfig,
} from '@/lib/voice/gemini-live-client'

interface UseVoiceCallOptions {
  voice?: string
  systemPrompt?: string
  autoStart?: boolean
}

interface UseVoiceCallReturn {
  status: VoiceSession['status']
  messages: VoiceMessage[]
  isListening: boolean
  isMuted: boolean
  callDuration: number
  startCall: () => Promise<void>
  endCall: () => Promise<void>
  toggleListening: () => void
  toggleMute: () => void
  sendText: (text: string) => Promise<void>
  speak: (text: string) => Promise<void>
  stopSpeaking: () => void
}

export function useVoiceCall(options: UseVoiceCallOptions = {}): UseVoiceCallReturn {
  const { voice = 'Kore', systemPrompt, autoStart = false } = options

  const [status, setStatus] = useState<VoiceSession['status']>('idle')
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)

  const clientRef = useRef<GeminiLiveClient | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // 클라이언트 초기화
  useEffect(() => {
    const config: VoiceClientConfig = {
      voice,
      systemPrompt,
      onStatusChange: setStatus,
      onMessage: (message) => {
        setMessages((prev) => [...prev, message])
      },
      onError: (error) => {
        console.error('Voice call error:', error)
      },
    }

    clientRef.current = new GeminiLiveClient(config)

    if (autoStart) {
      clientRef.current.startSession()
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.endSession()
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [voice, systemPrompt, autoStart])

  // 통화 시작
  const startCall = useCallback(async () => {
    if (!clientRef.current) return

    await clientRef.current.startSession()
    setCallDuration(0)
    setMessages([])

    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1)
    }, 1000)
  }, [])

  // 통화 종료
  const endCall = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.endSession()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsListening(false)
    setCallDuration(0)
  }, [])

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
    if (clientRef.current && !isMuted) {
      clientRef.current.stopSpeaking()
    }
    setIsMuted(!isMuted)
  }, [isMuted])

  // 텍스트 전송
  const sendText = useCallback(async (text: string) => {
    if (!clientRef.current || !text.trim()) return
    await clientRef.current.sendText(text)
  }, [])

  // TTS
  const speak = useCallback(async (text: string) => {
    if (!clientRef.current || isMuted) return
    await clientRef.current.speak(text)
  }, [isMuted])

  // TTS 중지
  const stopSpeaking = useCallback(() => {
    clientRef.current?.stopSpeaking()
  }, [])

  return {
    status,
    messages,
    isListening,
    isMuted,
    callDuration,
    startCall,
    endCall,
    toggleListening,
    toggleMute,
    sendText,
    speak,
    stopSpeaking,
  }
}
