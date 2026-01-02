"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Bell, AlertTriangle, CheckCircle, Sparkles, Send, Loader2, Mic, Volume2, VolumeX } from "lucide-react"
import { useAgentNotification, AgentNotification } from "@/lib/contexts/AgentNotificationContext"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import { executeActions, convertToolAction, formatActionResultsForChat } from "@/lib/ai/agent-actions"

// 여성 에이전트 이름 목록
const FEMALE_AGENTS = ['에이미', 'amy', '레이첼', 'rachel', '애니', 'ani', '소피아', 'sophia']

// Web Speech API 타입
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives?: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  onaudiostart: (() => void) | null
  onaudioend: (() => void) | null
  onspeechstart: (() => void) | null
  onspeechend: (() => void) | null
  onsoundstart: (() => void) | null
  onsoundend: (() => void) | null
}

const typeIcons = {
  info: Bell,
  alert: AlertTriangle,
  task: CheckCircle,
  greeting: Sparkles,
}

function NotificationItem({ notification, index }: { notification: AgentNotification; index: number }) {
  const { dismissNotification, showAgentNotification, isVoiceCallActive } = useAgentNotification()
  const { accentColor: themeAccent } = useThemeStore()
  const { agent, message, type, emotion } = notification

  // 채팅 상태 - 팝업 뜨면 바로 답장 모드
  const [showReply, setShowReply] = useState(true)
  const [replyText, setReplyText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [agentResponse, setAgentResponse] = useState<string | null>(null)

  // 음성 인식 상태 (STT - Whisper API)
  const [isListening, setIsListening] = useState(false)
  const isListeningRef = useRef(false)
  const mediaStreamRef = useRef<MediaStream | null>(null)

  // TTS 상태
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speakingText, setSpeakingText] = useState("") // 실시간 말하는 텍스트
  const [ttsMode, setTtsMode] = useState<"native" | "grok">("grok") // 기본: AI 음성 (Grok)
  const ttsPlayedRef = useRef(false) // ref로 변경하여 리렌더링 방지
  const speakMessageRef = useRef<((text: string) => Promise<void>) | null>(null)
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null)
  const [micReady, setMicReady] = useState(false) // TTS 끝나면 마이크 버튼 강조
  const autoStartSTTRef = useRef(true) // TTS 끝나면 자동 STT 시작
  const startRecognitionRef = useRef<(() => void) | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  // 테마 색상
  const themeColorData = accentColors.find(c => c.id === themeAccent)
  const themeColor = themeColorData?.color || "#3b82f6"

  // 아바타 URL
  const getDefaultAvatarUrl = () => {
    const nameLower = agent.name.toLowerCase()
    const isFemale = FEMALE_AGENTS.some(n => nameLower.includes(n))
    const seed = isFemale ? `${agent.name}-female` : agent.name
    return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`
  }

  const avatarUrl = emotion && agent.emotion_avatars?.[emotion]
    ? agent.emotion_avatars[emotion]
    : agent.avatar_url || getDefaultAvatarUrl()

  const Icon = typeIcons[type]

  // ========== TTS: 메시지 음성 재생 ==========

  // 브라우저 네이티브 TTS (안정적, 끊기지 않음)
  const speakNative = useCallback((text: string) => {
    if (!window.speechSynthesis) {
      console.error("[TTS Native] Speech synthesis not supported")
      return
    }

    // 이전 발화 취소
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "ko-KR"
    utterance.rate = 0.95
    utterance.pitch = 1.1

    // 한국어 음성 찾기
    const voices = window.speechSynthesis.getVoices()
    const koreanVoice = voices.find(v => v.lang.startsWith("ko"))
    if (koreanVoice) {
      utterance.voice = koreanVoice
    }

    // 실시간 텍스트 표시를 위한 단어 단위 업데이트
    let currentIndex = 0
    const words = text.split("")
    const intervalId = setInterval(() => {
      if (currentIndex < words.length) {
        setSpeakingText(prev => prev + words[currentIndex])
        currentIndex++
      } else {
        clearInterval(intervalId)
      }
    }, 80) // 글자당 80ms

    utterance.onend = () => {
      console.log("[TTS Native] Speech ended")
      clearInterval(intervalId)
      setSpeakingText(text)
      setIsSpeaking(false)
      // TTS 끝나면 자동으로 마이크 시작
      if (autoStartSTTRef.current && startRecognitionRef.current) {
        console.log("[TTS->STT] Auto-starting STT...")
        setMicReady(true)
        isListeningRef.current = true
        setIsListening(true)
        setTimeout(() => startRecognitionRef.current?.(), 100)
      }
    }

    utterance.onerror = (e) => {
      console.error("[TTS Native] Error:", e)
      clearInterval(intervalId)
      setIsSpeaking(false)
      setSpeakingText("")
    }

    speechSynthRef.current = utterance
    window.speechSynthesis.speak(utterance)
    console.log("[TTS Native] Speaking:", text)
  }, [])

  // 🔥 Grok TTS (REST API - 안정적)
  const speakGrok = useCallback(async (text: string) => {
    console.log("[TTS Grok] 🚀 Starting with REST API for:", text.substring(0, 30) + "...")

    try {
      const voiceSettings = agent.voice_settings || {}
      const selectedVoice = voiceSettings.voice || "tara"

      console.log(`[TTS Grok] 🎙️ Using voice: ${selectedVoice}, agent:`, agent.name)

      // 🔥 REST API 사용 (WebSocket보다 안정적)
      console.log("[TTS Grok] 📡 Calling /api/voice/grok...")
      const response = await fetch("/api/voice/grok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: selectedVoice }),
      })

      console.log("[TTS Grok] 📥 Response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[TTS Grok] ❌ API Error:", errorText)
        throw new Error(`TTS API failed: ${response.status} - ${errorText}`)
      }

      // 오디오 재생
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      currentAudioRef.current = audio

      // 실시간 텍스트 표시
      let currentIndex = 0
      const chars = text.split("")
      const intervalId = setInterval(() => {
        if (currentIndex < chars.length) {
          setSpeakingText(prev => prev + chars[currentIndex])
          currentIndex++
        } else {
          clearInterval(intervalId)
        }
      }, 50)

      audio.onended = () => {
        console.log("[TTS Grok] Audio playback ended")
        clearInterval(intervalId)
        setSpeakingText(text)
        URL.revokeObjectURL(audioUrl)
        setIsSpeaking(false)

        // TTS 끝나면 자동으로 마이크 시작
        if (autoStartSTTRef.current && startRecognitionRef.current) {
          console.log("[TTS->STT] Auto-starting STT...")
          setMicReady(true)
          isListeningRef.current = true
          setIsListening(true)
          setTimeout(() => startRecognitionRef.current?.(), 100)
        }
      }

      audio.onerror = () => {
        console.error("[TTS Grok] Audio playback error")
        clearInterval(intervalId)
        URL.revokeObjectURL(audioUrl)
        setIsSpeaking(false)
        setSpeakingText("")
      }

      await audio.play()
      console.log("[TTS Grok] Audio playing...")

    } catch (error) {
      console.error("[TTS Grok] Error:", error)
      setIsSpeaking(false)
      setSpeakingText("")
      // 🔥 Grok 실패 시 네이티브 TTS로 폴백
      console.log("[TTS] Falling back to native TTS...")
      speakNative(text)
    }
  }, [agent.voice_settings, speakNative])

  // 이모지 제거 함수
  const removeEmojis = (text: string): string => {
    return text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // 이모티콘
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // 기호 및 픽토그램
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // 교통 및 지도
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // 국기
      .replace(/[\u{2600}-\u{26FF}]/gu, '')   // 기타 기호
      .replace(/[\u{2700}-\u{27BF}]/gu, '')   // 딩뱃
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // 변형 선택자
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // 보충 기호
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // 체스 기호
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // 기호 확장
      .replace(/[\u{231A}-\u{231B}]/gu, '')   // 시계
      .replace(/[\u{23E9}-\u{23F3}]/gu, '')   // 미디어
      .replace(/[\u{23F8}-\u{23FA}]/gu, '')   // 미디어
      .replace(/[\u{25AA}-\u{25AB}]/gu, '')   // 도형
      .replace(/[\u{25B6}]/gu, '')
      .replace(/[\u{25C0}]/gu, '')
      .replace(/[\u{25FB}-\u{25FE}]/gu, '')
      .replace(/[\u{2614}-\u{2615}]/gu, '')
      .replace(/[\u{2648}-\u{2653}]/gu, '')
      .replace(/[\u{267F}]/gu, '')
      .replace(/[\u{2693}]/gu, '')
      .replace(/[\u{26A1}]/gu, '')
      .replace(/[\u{26AA}-\u{26AB}]/gu, '')
      .replace(/[\u{26BD}-\u{26BE}]/gu, '')
      .replace(/[\u{26C4}-\u{26C5}]/gu, '')
      .replace(/[\u{26CE}]/gu, '')
      .replace(/[\u{26D4}]/gu, '')
      .replace(/[\u{26EA}]/gu, '')
      .replace(/[\u{26F2}-\u{26F3}]/gu, '')
      .replace(/[\u{26F5}]/gu, '')
      .replace(/[\u{26FA}]/gu, '')
      .replace(/[\u{26FD}]/gu, '')
      .replace(/\s+/g, ' ')  // 여러 공백을 하나로
      .trim()
  }

  // TTS로 메시지 읽기 (모드에 따라 분기)
  const speakMessage = useCallback(async (text: string) => {
    console.log("[TTS] 🎯 speakMessage called! isVoiceCallActive:", isVoiceCallActive, "isSpeaking:", isSpeaking, "ttsMode:", ttsMode)

    // 🔥 음성통화 중이면 알림 TTS 비활성화 (중복 음성 방지)
    if (isVoiceCallActive) {
      console.log("[TTS] ⚠️ Voice call active, skipping notification TTS")
      return
    }

    // 이모지 제거
    const cleanText = removeEmojis(text)
    console.log("[TTS] 📝 Clean text:", cleanText.substring(0, 50) + "...")

    if (isSpeaking) {
      console.log("[TTS] Already speaking, skipping")
      return
    }

    if (!cleanText) {
      console.log("[TTS] No text to speak after emoji removal")
      return
    }

    setIsSpeaking(true)
    setSpeakingText("")

    if (ttsMode === "native") {
      speakNative(cleanText)
    } else {
      await speakGrok(cleanText)
    }
  }, [isSpeaking, ttsMode, speakNative, speakGrok, isVoiceCallActive])

  // speakMessage를 ref에 저장 (즉시 + useEffect로 업데이트)
  // 🔥 즉시 할당하여 초기 마운트 시에도 ref가 설정되도록 함
  speakMessageRef.current = speakMessage

  useEffect(() => {
    speakMessageRef.current = speakMessage
    console.log("[TTS] speakMessageRef updated")
  }, [speakMessage])

  // 팝업이 열리면 자동으로 TTS 재생 (한 번만 실행)
  useEffect(() => {
    if (!ttsPlayedRef.current && message) {
      ttsPlayedRef.current = true
      console.log("[TTS] 🔊 Auto-triggering TTS for message:", message)

      // 🔥 ref를 사용하여 최신 speakMessage 호출 (의존성 변경으로 인한 타이머 취소 방지)
      const timer = setTimeout(() => {
        console.log("[TTS] 🎤 Calling speakMessage now via ref...")
        if (speakMessageRef.current) {
          speakMessageRef.current(message)
        } else {
          console.error("[TTS] ❌ speakMessageRef.current is null!")
        }
      }, 300) // 300ms로 단축 (빠른 응답)

      return () => clearTimeout(timer)
    }
  }, [message]) // speakMessage 제거하여 타이머 취소 방지

  // 정리
  useEffect(() => {
    return () => {
      // 현재 재생 중인 오디오 중지
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
      // 네이티브 TTS도 취소
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // ========== STT: MediaRecorder + Whisper API ==========
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // 녹음 시작
  const startRecognition = useCallback(async () => {
    console.log("[STT] Starting...")

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      console.log("[STT] Mic OK")

      // mimeType 호환성 확인
      let mimeType = 'audio/webm'
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/mp4'
        if (!MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/ogg'
          if (!MediaRecorder.isTypeSupported('audio/ogg')) {
            mimeType = '' // 기본값 사용
          }
        }
      }
      console.log("[STT] Using mimeType:", mimeType || "default")

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        console.log("[STT] Sending to Whisper...")

        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' })

        if (audioBlob.size < 1000) {
          console.log("[STT] Audio too short")
          return
        }

        try {
          const baseType = audioBlob.type.split(';')[0]
          let ext = 'webm'
          if (baseType.includes('webm')) ext = 'webm'
          else if (baseType.includes('mp4') || baseType.includes('m4a')) ext = 'm4a'
          else if (baseType.includes('ogg')) ext = 'ogg'
          else if (baseType.includes('mpeg') || baseType.includes('mp3')) ext = 'mp3'
          else if (baseType.includes('wav')) ext = 'wav'

          const formData = new FormData()
          formData.append('audio', audioBlob, `audio.${ext}`)

          const res = await fetch('/api/voice/stt', {
            method: 'POST',
            body: formData,
          })

          if (res.ok) {
            const data = await res.json()
            if (data.text) {
              console.log("[STT] ✅", data.text)
              setReplyText(prev => prev + data.text)
            }
          } else {
            console.error("[STT] API error:", await res.text())
          }
        } catch (err) {
          console.error("[STT] Error:", err)
        }
      }

      mediaRecorder.start(1000)
      console.log("[STT] Recording...")

    } catch (error: any) {
      console.error("[STT] Error:", error)
      isListeningRef.current = false
      setIsListening(false)
    }
  }, [])

  // 녹음 중지 및 변환
  const stopRecognition = useCallback(() => {
    console.log("[STT] Stopping...")
    isListeningRef.current = false

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    setIsListening(false)
  }, [])

  // startRecognition을 ref에 저장 (TTS 완료 후 호출용)
  useEffect(() => {
    startRecognitionRef.current = startRecognition
  }, [startRecognition])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      stopRecognition()
    }
  }, [stopRecognition])

  // 음성 인식 토글
  const toggleListening = async () => {
    console.log("[STT Toggle] Current state:", { isListening })

    if (isListening) {
      console.log("[STT Toggle] Stopping...")
      stopRecognition()
    } else {
      console.log("[STT Toggle] Starting Grok STT...")
      isListeningRef.current = true
      setIsListening(true)
      await startRecognition()
    }
  }

  // ========== 답장 전송 ==========
  const handleSendReply = async () => {
    if (!replyText.trim() || isProcessing) return

    setIsProcessing(true)
    try {
      const response = await fetch(`/api/agents/${agent.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: replyText,
          context: `사용자가 "${message}"에 대해 답장했습니다.`,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const agentReply = data.response || data.message || "알겠습니다."

        // 🔥 에이전트가 반환한 액션들 실행 (프로젝트 생성, 파일 작성 등)
        if (data.actions && data.actions.length > 0) {
          console.log("[AgentChat] 🚀 Executing agent actions:", data.actions)
          try {
            // ToolAction → AgentAction 변환 후 실행
            const agentActions = data.actions
              .map((action: any) => convertToolAction(action))
              .filter((a: any) => a !== null)

            if (agentActions.length > 0) {
              const results = await executeActions(agentActions)
              const actionSummary = formatActionResultsForChat(results)

              // 실행 결과를 응답에 추가
              if (actionSummary) {
                setAgentResponse(`${agentReply}\n\n📋 실행 결과:\n${actionSummary}`)
              } else {
                setAgentResponse(agentReply)
              }

              console.log("[AgentChat] ✅ Actions executed:", results)
            } else {
              setAgentResponse(agentReply)
            }
          } catch (actionError) {
            console.error("[AgentChat] ❌ Action execution failed:", actionError)
            setAgentResponse(`${agentReply}\n\n⚠️ 일부 작업 실행 중 오류가 발생했습니다.`)
          }
        } else {
          setAgentResponse(agentReply)
        }

        setReplyText("")

        // 에이전트 응답도 TTS로 읽기
        setTimeout(() => {
          speakMessage(agentReply)
        }, 300)
      } else {
        setAgentResponse("죄송합니다. 오류가 발생했습니다.")
      }
    } catch (error) {
      console.error("Reply error:", error)
      setAgentResponse("네트워크 오류가 발생했습니다.")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
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
        className="w-[380px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-3xl overflow-hidden"
          style={{
            boxShadow: `0 0 80px ${themeColor}30, 0 0 120px ${themeColor}10, 0 25px 50px -12px rgba(0, 0, 0, 0.8)`,
          }}
        >
          {/* 상단 글로우 효과 */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full blur-3xl opacity-30"
            style={{ background: themeColor }}
          />

          {/* 닫기 버튼 */}
          <button
            onClick={() => dismissNotification(notification.id)}
            className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800/50 hover:bg-zinc-700/50 transition-all z-20 group"
          >
            <X className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
          </button>

          {/* 음성 상태 표시 */}
          {isSpeaking && (
            <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/80 z-20">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: themeColor }}
              />
              <span className="text-xs text-zinc-400">말하는 중...</span>
            </div>
          )}

          {/* 프로필 섹션 */}
          <div className="relative pt-8 pb-4 flex flex-col items-center">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-2 rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, ${themeColor}, transparent, ${themeColor})`,
                  opacity: 0.5,
                }}
              />
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
                className="relative w-24 h-24 rounded-full p-1"
                style={{
                  background: `linear-gradient(135deg, ${themeColor}, ${themeColor}60)`,
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
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-zinc-900"
                style={{ backgroundColor: themeColor }}
              >
                <Icon className="w-4 h-4 text-white" />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-4 text-center"
            >
              <h3 className="text-xl font-bold" style={{ color: themeColor }}>
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
              {/* 음성 재생 버튼 + 파형 */}
              <div className="flex items-center justify-center gap-3 mb-3">
                {isSpeaking ? (
                  // 말하는 중: 파형 애니메이션
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <motion.div
                          key={i}
                          animate={{ height: [4, 16, 4] }}
                          transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                          className="w-1 rounded-full"
                          style={{ backgroundColor: themeColor }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        if (currentAudioRef.current) {
                          currentAudioRef.current.pause()
                          currentAudioRef.current = null
                        }
                        if (window.speechSynthesis) window.speechSynthesis.cancel()
                        setIsSpeaking(false)
                        setSpeakingText("")
                      }}
                      className="p-2 rounded-full bg-zinc-700/50 hover:bg-zinc-600/50 transition-colors"
                    >
                      <VolumeX className="w-4 h-4 text-zinc-300" />
                    </button>
                  </div>
                ) : (
                  // 음성 재생 버튼 + 모드 토글
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        console.log("[TTS] Manual trigger for message:", message)
                        speakMessage(message)
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-full transition-all hover:scale-105"
                      style={{
                        background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)`,
                        border: `1px solid ${themeColor}50`,
                      }}
                    >
                      <Volume2 className="w-4 h-4" style={{ color: themeColor }} />
                      <span className="text-xs font-medium" style={{ color: themeColor }}>
                        음성으로 듣기
                      </span>
                    </button>
                    {/* TTS 모드 토글 */}
                    <button
                      onClick={() => setTtsMode(prev => prev === "native" ? "grok" : "native")}
                      className="px-2 py-1 rounded-full text-[10px] transition-all"
                      style={{
                        background: ttsMode === "grok" ? `${themeColor}30` : "rgba(100,100,100,0.3)",
                        border: `1px solid ${ttsMode === "grok" ? themeColor : "rgba(100,100,100,0.5)"}`,
                        color: ttsMode === "grok" ? themeColor : "#888",
                      }}
                      title={ttsMode === "native" ? "기본 음성 (안정적)" : "AI 음성 (자연스러움)"}
                    >
                      {ttsMode === "native" ? "기본" : "AI"}
                    </button>
                  </div>
                )}
              </div>

              {/* 메시지 텍스트 - 말하는 중이면 실시간 텍스트 + 원본 표시 */}
              {isSpeaking ? (
                <div className="space-y-2">
                  {/* 실시간 텍스트 (있으면 표시) */}
                  {speakingText && (
                    <p className="text-sm leading-relaxed text-center font-medium" style={{ color: themeColor }}>
                      {speakingText}
                    </p>
                  )}
                  {/* 원본 메시지는 항상 표시 (실시간 텍스트가 없을 때 더 밝게) */}
                  <p className={`text-sm leading-relaxed text-center ${speakingText ? "text-zinc-400" : "text-zinc-200"}`}>
                    {message}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-zinc-200 leading-relaxed text-center">
                  {message}
                </p>
              )}
            </div>

            {/* 에이전트 응답 */}
            <AnimatePresence>
              {agentResponse && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 rounded-2xl p-4 border"
                  style={{
                    backgroundColor: `${themeColor}15`,
                    borderColor: `${themeColor}30`,
                  }}
                >
                  {/* 응답 음성 재생 버튼 + 파형 */}
                  <div className="flex items-center justify-center gap-2 mb-3">
                    {isSpeaking ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <motion.div
                              key={i}
                              animate={{ height: [4, 16, 4] }}
                              transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                              className="w-1 rounded-full"
                              style={{ backgroundColor: themeColor }}
                            />
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            if (currentAudioRef.current) {
                              currentAudioRef.current.pause()
                              currentAudioRef.current = null
                            }
                            if (window.speechSynthesis) window.speechSynthesis.cancel()
                            setIsSpeaking(false)
                            setSpeakingText("")
                          }}
                          className="p-1.5 rounded-full bg-zinc-700/50 hover:bg-zinc-600/50"
                        >
                          <VolumeX className="w-3 h-3 text-zinc-300" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => speakMessage(agentResponse || "")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:scale-105"
                        style={{
                          background: `${themeColor}20`,
                          border: `1px solid ${themeColor}40`,
                        }}
                      >
                        <Volume2 className="w-3 h-3" style={{ color: themeColor }} />
                        <span className="text-xs" style={{ color: themeColor }}>듣기</span>
                      </button>
                    )}
                  </div>
                  {/* 응답 텍스트 - 말하는 중이면 실시간 + 원본 */}
                  {isSpeaking ? (
                    <div className="space-y-2">
                      {speakingText && (
                        <p className="text-sm leading-relaxed text-center font-medium text-white">
                          {speakingText}
                        </p>
                      )}
                      <p className={`text-sm leading-relaxed text-center ${speakingText ? "opacity-60" : ""}`} style={{ color: themeColor }}>
                        {agentResponse}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed text-center" style={{ color: themeColor }}>
                      {agentResponse}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* 답장 입력 섹션 */}
          {!showReply && !agentResponse && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="px-6 pb-6"
            >
              <div className="flex gap-3">
                <button
                  onClick={() => dismissNotification(notification.id)}
                  className="flex-1 py-3 px-4 text-sm font-semibold rounded-xl text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                    boxShadow: `0 4px 20px ${themeColor}40`,
                  }}
                >
                  확인
                </button>
                <button
                  onClick={() => setShowReply(true)}
                  className="flex-1 py-3 px-4 text-sm font-semibold rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all"
                >
                  답장
                </button>
              </div>
            </motion.div>
          )}

          {/* 채팅 입력 */}
          {showReply && !agentResponse && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="px-6 pb-6"
            >
              {/* 음성 인식 중 표시 */}
              {isListening && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mb-3 flex items-center justify-center gap-2 py-2"
                >
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: themeColor }}
                  />
                  <span className="text-sm" style={{ color: themeColor }}>
                    말씀하세요...
                  </span>
                </motion.div>
              )}

              <div className="flex gap-2">
                {/* 마이크 버튼 (STT - Grok) */}
                <motion.button
                  onClick={() => {
                    setMicReady(false)
                    toggleListening()
                  }}
                    disabled={isProcessing}
                    animate={micReady && !isListening ? {
                      scale: [1, 1.1, 1],
                      boxShadow: [`0 0 0px ${themeColor}`, `0 0 25px ${themeColor}`, `0 0 0px ${themeColor}`]
                    } : {}}
                    transition={micReady && !isListening ? { repeat: Infinity, duration: 1 } : {}}
                    className={`px-4 py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] ${
                      isListening
                        ? "text-white"
                        : micReady
                          ? "text-white"
                          : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                    style={isListening || micReady ? {
                      background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                      boxShadow: isListening ? `0 0 20px ${themeColor}50` : undefined,
                    } : {}}
                  >
                    {isListening ? (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                      >
                        <Mic className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                </motion.button>

                {/* 텍스트 입력 */}
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendReply()}
                  placeholder={isListening ? "말씀하세요..." : `${agent.name}에게 답장...`}
                  className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                  autoFocus={!isListening}
                  disabled={isProcessing || isListening}
                />

                {/* 전송 버튼 */}
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || isProcessing}
                  className="px-4 py-3 rounded-xl text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                  style={{
                    background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                  }}
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* 취소 버튼 */}
              <button
                onClick={() => {
                  setShowReply(false)
                  setReplyText("")
                  if (isListening) {
                    stopRecognition()
                  }
                }}
                className="w-full mt-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                취소
              </button>
            </motion.div>
          )}

          {/* 응답 후 닫기 버튼 */}
          {agentResponse && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-6 pb-6"
            >
              <button
                onClick={() => dismissNotification(notification.id)}
                className="w-full py-3 px-4 text-sm font-semibold rounded-xl text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                  boxShadow: `0 4px 20px ${themeColor}40`,
                }}
              >
                확인
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
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
