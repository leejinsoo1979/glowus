"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Bell, AlertTriangle, CheckCircle, Sparkles, Send, Loader2, Mic, MicOff, Volume2, VolumeX } from "lucide-react"
import { useAgentNotification, AgentNotification } from "@/lib/contexts/AgentNotificationContext"
import { useThemeStore, accentColors } from "@/stores/themeStore"

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

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

const typeIcons = {
  info: Bell,
  alert: AlertTriangle,
  task: CheckCircle,
  greeting: Sparkles,
}

function NotificationItem({ notification, index }: { notification: AgentNotification; index: number }) {
  const { dismissNotification, showAgentNotification } = useAgentNotification()
  const { accentColor: themeAccent } = useThemeStore()
  const { agent, message, type, emotion } = notification

  // 채팅 상태
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [agentResponse, setAgentResponse] = useState<string | null>(null)

  // 음성 인식 상태 (STT)
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isListeningRef = useRef(false) // 재시작 로직용
  const restartCountRef = useRef(0) // 재시작 횟수 추적
  const maxRestarts = 50 // 최대 재시작 횟수

  // TTS 상태
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speakingText, setSpeakingText] = useState("") // 실시간 말하는 텍스트
  const [ttsMode, setTtsMode] = useState<"native" | "grok">("grok") // 기본: AI 음성 (Grok)
  const ttsPlayedRef = useRef(false) // ref로 변경하여 리렌더링 방지
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioQueueRef = useRef<Float32Array[]>([])
  const isPlayingRef = useRef(false)
  const wsRef = useRef<WebSocket | null>(null)
  const speakMessageRef = useRef<((text: string) => Promise<void>) | null>(null)
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null)

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
  const playAudioChunk = useCallback(async (base64Audio: string) => {
    if (!audioContextRef.current) {
      console.warn("[TTS] No audio context")
      return
    }

    // AudioContext가 suspended 상태면 resume
    if (audioContextRef.current.state === "suspended") {
      console.log("[TTS] Resuming audio context...")
      await audioContextRef.current.resume()
    }

    try {
      const binaryString = atob(base64Audio)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const pcm16 = new Int16Array(bytes.buffer)
      const float32 = new Float32Array(pcm16.length)
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0
      }

      audioQueueRef.current.push(float32)
      console.log("[TTS] Audio chunk queued, queue size:", audioQueueRef.current.length)

      if (!isPlayingRef.current) {
        playNextChunk()
      }
    } catch (e) {
      console.error("[TTS] Audio decode error:", e)
    }
  }, [])

  const playNextChunk = useCallback(() => {
    if (!audioContextRef.current) {
      console.warn("[TTS] No audio context in playNextChunk")
      isPlayingRef.current = false
      return
    }

    if (audioQueueRef.current.length === 0) {
      console.log("[TTS] Queue empty, waiting for more chunks...")
      isPlayingRef.current = false
      return
    }

    isPlayingRef.current = true
    const chunk = audioQueueRef.current.shift()!
    console.log("[TTS] Playing chunk, remaining:", audioQueueRef.current.length)

    try {
      const buffer = audioContextRef.current.createBuffer(1, chunk.length, 24000)
      buffer.getChannelData(0).set(chunk)

      const source = audioContextRef.current.createBufferSource()
      source.buffer = buffer
      source.connect(audioContextRef.current.destination)
      source.onended = () => {
        // 다음 청크 재생
        playNextChunk()
      }
      source.start()
    } catch (e) {
      console.error("[TTS] Playback error:", e)
      isPlayingRef.current = false
    }
  }, [])

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
      setSpeakingText(text) // 전체 텍스트 표시
      setIsSpeaking(false)
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

  // Grok TTS (자연스러운 음성, 불안정할 수 있음)
  const speakGrok = useCallback(async (text: string) => {
    console.log("[TTS Grok] Starting...")

    try {
      const tokenRes = await fetch("/api/grok-voice/token", { method: "POST" })
      if (!tokenRes.ok) throw new Error("Failed to get token")
      const tokenData = await tokenRes.json()

      audioContextRef.current = new AudioContext({ sampleRate: 24000 })

      const ws = new WebSocket(
        "wss://api.x.ai/v1/realtime?model=grok-3-fast-realtime",
        ["realtime", `openai-insecure-api-key.${tokenData.client_secret}`, "openai-beta.realtime-v1"]
      )
      wsRef.current = ws

      ws.onopen = () => {
        const voiceSettings = agent.voice_settings || {}
        const selectedVoice = voiceSettings.voice || "sol"
        const conversationStyle = voiceSettings.conversation_style || "friendly"

        const toneMap: Record<string, string> = {
          professional: '차분하고 전문적인 어조로',
          friendly: '밝고 친근한 어조로',
          casual: '편안하고 자연스러운 어조로',
          empathetic: '따뜻하고 공감하는 어조로',
          concise: '명확하고 또박또박',
        }
        const tone = toneMap[conversationStyle] || toneMap.friendly

        console.log(`[TTS Grok] Using voice: ${selectedVoice}, style: ${conversationStyle}`)

        ws.send(JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: `You are a text-to-speech engine. Read the following Korean text exactly as written, character by character, word by word. Do not add, remove, or change any words. Speak in a ${tone} tone. Just read: "${text}"`,
            voice: selectedVoice,
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
          },
        }))

        setTimeout(() => {
          ws.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: `Read this exactly: ${text}` }]
            }
          }))
          ws.send(JSON.stringify({
            type: "response.create",
            response: { modalities: ["text", "audio"] }
          }))
        }, 200)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if ((data.type === "response.output_audio.delta" || data.type === "response.audio.delta") && data.delta) {
            playAudioChunk(data.delta)
          }

          if (data.type === "response.output_audio_transcript.delta" && data.delta) {
            setSpeakingText(prev => prev + data.delta)
          }
          if (data.type === "response.audio_transcript.delta" && data.delta) {
            setSpeakingText(prev => prev + data.delta)
          }
          if (data.type === "response.text.delta" && data.delta) {
            setSpeakingText(prev => prev + data.delta)
          }

          if (data.type === "response.done") {
            console.log("[TTS Grok] Response done, waiting for audio...")
            const checkAudioDone = () => {
              if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
                setTimeout(() => ws.close(), 500)
              } else {
                setTimeout(checkAudioDone, 200)
              }
            }
            setTimeout(checkAudioDone, 2000)
          }
        } catch (e) {
          console.error("[TTS Grok] Parse error:", e)
        }
      }

      ws.onerror = (err) => {
        console.error("[TTS Grok] WebSocket error:", err)
        setIsSpeaking(false)
        setSpeakingText("")
      }

      ws.onclose = () => {
        console.log("[TTS Grok] WebSocket closed")
        const waitForAudio = () => {
          if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
            setIsSpeaking(false)
            if (audioContextRef.current) {
              setTimeout(() => {
                audioContextRef.current?.close()
                audioContextRef.current = null
              }, 1000)
            }
          } else {
            setTimeout(waitForAudio, 200)
          }
        }
        setTimeout(waitForAudio, 500)
      }
    } catch (error) {
      console.error("[TTS Grok] Error:", error)
      setIsSpeaking(false)
      setSpeakingText("")
    }
  }, [agent.voice_settings, playAudioChunk])

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
    // 이모지 제거
    const cleanText = removeEmojis(text)
    console.log("[TTS] speakMessage called with:", cleanText, "mode:", ttsMode, "isSpeaking:", isSpeaking)

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
  }, [isSpeaking, ttsMode, speakNative, speakGrok])

  // speakMessage를 ref에 저장
  useEffect(() => {
    speakMessageRef.current = speakMessage
  }, [speakMessage])

  // 팝업이 열리면 자동으로 TTS 재생 (한 번만 실행)
  useEffect(() => {
    if (!ttsPlayedRef.current && message) {
      ttsPlayedRef.current = true
      console.log("[TTS] Auto-triggering TTS for message:", message)
      // 약간의 딜레이 후 재생
      const timer = setTimeout(() => {
        console.log("[TTS] Calling speakMessage now...")
        if (speakMessageRef.current) {
          speakMessageRef.current(message)
        }
      }, 1200)
      // cleanup 하지 않음 - 타이머가 실행되도록 함
    }
  }, [message]) // speakMessage를 의존성에서 제거

  // 정리
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      // 네이티브 TTS도 취소
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // ========== STT: 음성 인식 ==========
  // 음성 인식 시작 함수
  const startRecognition = useCallback(() => {
    if (typeof window === "undefined") return

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      console.error("[STT] Speech Recognition not supported")
      return
    }

    // 기존 인식 정리
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch (e) {}
      recognitionRef.current = null
    }

    // 재시작 횟수 리셋 (새로 시작할 때)
    restartCountRef.current = 0

    const createAndStartRecognition = () => {
      const recognition = new SpeechRecognitionAPI()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "ko-KR"
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        console.log("[STT] Recognition started successfully")
        restartCountRef.current = 0 // 성공적으로 시작하면 카운터 리셋
      }

      recognition.onaudiostart = () => {
        console.log("[STT] Audio capture started - microphone active")
      }

      recognition.onspeechstart = () => {
        console.log("[STT] Speech detected")
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = ""
        let interimTranscript = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript
          } else {
            interimTranscript += result[0].transcript
          }
        }

        if (finalTranscript) {
          console.log("[STT] Final transcript:", finalTranscript)
          setReplyText(prev => prev + finalTranscript + " ")
        }
        if (interimTranscript) {
          console.log("[STT] Interim:", interimTranscript)
        }
      }

      recognition.onend = () => {
        console.log("[STT] Recognition ended, should continue:", isListeningRef.current, "restart count:", restartCountRef.current)

        // 사용자가 멈추지 않았고 재시작 한도 내면 재시작
        if (isListeningRef.current && restartCountRef.current < maxRestarts) {
          restartCountRef.current++
          console.log("[STT] Scheduling restart #", restartCountRef.current)

          // 새 recognition 객체 생성하여 재시작
          setTimeout(() => {
            if (isListeningRef.current) {
              console.log("[STT] Restarting with new recognition object...")
              createAndStartRecognition()
            }
          }, 300) // 더 긴 딜레이
        } else {
          if (restartCountRef.current >= maxRestarts) {
            console.warn("[STT] Max restarts reached, stopping")
          }
          setIsListening(false)
        }
      }

      recognition.onerror = (event: any) => {
        console.error("[STT] Error:", event.error, event.message)

        // 무시해도 되는 에러들
        if (event.error === 'no-speech') {
          console.log("[STT] No speech detected, will auto-restart via onend")
          return
        }
        if (event.error === 'aborted') {
          console.log("[STT] Recognition aborted")
          return
        }

        // 권한 에러
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          alert("마이크 권한을 허용해주세요. 브라우저 설정에서 마이크 권한을 확인하세요.")
          isListeningRef.current = false
          setIsListening(false)
          return
        }

        // 네트워크 에러 - 재시도
        if (event.error === 'network') {
          console.warn("[STT] Network error, will retry via onend")
          return
        }

        // audio-capture 에러 - 마이크 사용 중
        if (event.error === 'audio-capture') {
          console.warn("[STT] Audio capture error - mic may be in use")
          return
        }
      }

      recognitionRef.current = recognition

      try {
        recognition.start()
        console.log("[STT] Recognition.start() called")
      } catch (e: any) {
        console.error("[STT] Start error:", e.message)
        // 이미 시작된 경우 재시도
        if (e.message?.includes('already started')) {
          console.log("[STT] Already started, ignoring")
        } else {
          isListeningRef.current = false
          setIsListening(false)
        }
      }
    }

    // 첫 시작
    createAndStartRecognition()
  }, [])

  // 음성 인식 중지 함수
  const stopRecognition = useCallback(() => {
    console.log("[STT] Stopping recognition...")
    isListeningRef.current = false
    restartCountRef.current = 0
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort() // stop() 대신 abort() 사용 - 즉시 중단
      } catch (e) {}
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  // 초기화: speechSupported 체크
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
      setSpeechSupported(!!SpeechRecognitionAPI)
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch (e) {}
      }
    }
  }, [])

  // 음성 인식 토글
  const toggleListening = () => {
    if (isListening) {
      stopRecognition()
    } else {
      isListeningRef.current = true
      setIsListening(true)
      startRecognition()
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
        setAgentResponse(agentReply)
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
                        if (wsRef.current) wsRef.current.close()
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
                            if (wsRef.current) wsRef.current.close()
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
                {/* 마이크 버튼 (STT) */}
                {speechSupported && (
                  <button
                    onClick={toggleListening}
                    disabled={isProcessing}
                    className={`px-4 py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] ${
                      isListening
                        ? "text-white"
                        : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                    style={isListening ? {
                      background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                      boxShadow: `0 0 20px ${themeColor}50`,
                    } : {}}
                  >
                    {isListening ? (
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 0.5 }}
                      >
                        <MicOff className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </button>
                )}

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
