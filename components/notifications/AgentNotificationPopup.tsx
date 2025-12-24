"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Bell, AlertTriangle, CheckCircle, Sparkles, Send, Loader2, Mic, MicOff, MessageSquare, Phone, PhoneOff, Volume2 } from "lucide-react"
import { useAgentNotification, AgentNotification } from "@/lib/contexts/AgentNotificationContext"
import { useThemeStore, accentColors } from "@/stores/themeStore"

// 여성 에이전트 이름 목록
const FEMALE_AGENTS = ['레이첼', 'rachel', '애니', '에니', 'ani', 'annie', '소피아', 'sophia', '엠마', 'emma', '올리비아', 'olivia']

type ReplyMode = "none" | "chat" | "voice"

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
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
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
  const { agent, message, type, emotion, actions } = notification

  // 답장 모드 상태
  const [replyMode, setReplyMode] = useState<ReplyMode>("none")
  const [replyText, setReplyText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [agentResponse, setAgentResponse] = useState<string | null>(null)

  // 음성 인식 상태 (채팅 모드용 STT)
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // 실시간 음성 대화 상태 (보이스 모드용)
  const [voiceStatus, setVoiceStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected")
  const [voiceTranscript, setVoiceTranscript] = useState("")
  const [voiceResponse, setVoiceResponse] = useState("")
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const audioQueueRef = useRef<Float32Array[]>([])
  const isPlayingRef = useRef(false)

  // 음성 인식 초기화
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognitionAPI) {
        setSpeechSupported(true)
        const recognition = new SpeechRecognitionAPI()
        recognition.continuous = false
        recognition.interimResults = true
        recognition.lang = "ko-KR"

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = ""
          let interimTranscript = ""

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              finalTranscript += transcript
            } else {
              interimTranscript += transcript
            }
          }

          if (finalTranscript) {
            setReplyText(prev => prev + finalTranscript)
          } else if (interimTranscript) {
            // 실시간 미리보기 (선택적)
          }
        }

        recognition.onend = () => {
          setIsListening(false)
        }

        recognition.onerror = () => {
          setIsListening(false)
        }

        recognitionRef.current = recognition
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  // 음성 인식 토글 (채팅 모드용)
  const toggleListening = () => {
    if (!recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setReplyText("") // 새로 시작할 때 초기화
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  // ========== 보이스 모드 기능 ==========

  // 오디오 재생
  const playAudioChunk = useCallback((base64Audio: string) => {
    if (!audioContextRef.current) return

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

      if (!isPlayingRef.current) {
        playNextChunk()
      }
    } catch (e) {
      console.error("[Voice] Audio decode error:", e)
    }
  }, [])

  const playNextChunk = useCallback(() => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false
      return
    }

    isPlayingRef.current = true
    const chunk = audioQueueRef.current.shift()!

    const buffer = audioContextRef.current.createBuffer(1, chunk.length, 24000)
    buffer.getChannelData(0).set(chunk)

    const source = audioContextRef.current.createBufferSource()
    source.buffer = buffer
    source.connect(audioContextRef.current.destination)
    source.onended = () => playNextChunk()
    source.start()
  }, [])

  // 서버 이벤트 처리
  const handleServerEvent = useCallback((data: any) => {
    switch (data.type) {
      case "input_audio_buffer.speech_started":
        setVoiceTranscript("듣는 중...")
        break

      case "conversation.item.input_audio_transcription.completed":
        setVoiceTranscript(data.transcript || "")
        break

      case "response.audio.delta":
        if (data.delta) {
          playAudioChunk(data.delta)
        }
        break

      case "response.audio_transcript.delta":
        setVoiceResponse(prev => prev + (data.delta || ""))
        break

      case "response.audio_transcript.done":
        setVoiceResponse("")
        break

      case "error":
        console.error("[Voice] Server error:", data.error)
        break
    }
  }, [playAudioChunk])

  // 마이크 시작
  const startMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      mediaStreamRef.current = stream

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 })
      }

      const source = audioContextRef.current.createMediaStreamSource(stream)
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

        const inputData = e.inputBuffer.getChannelData(0)
        const pcm16 = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }

        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)))
        wsRef.current.send(JSON.stringify({
          type: "input_audio_buffer.append",
          audio: base64,
        }))
      }

      source.connect(processor)
      processor.connect(audioContextRef.current.destination)
    } catch (error) {
      console.error("[Voice] Microphone error:", error)
    }
  }, [])

  // 마이크 중지
  const stopMicrophone = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }
  }, [])

  // 보이스 모드 시작
  const startVoiceMode = useCallback(async () => {
    if (voiceStatus === "connecting" || voiceStatus === "connected") return

    setVoiceStatus("connecting")
    setVoiceTranscript("")
    setVoiceResponse("")

    try {
      // 토큰 발급
      const tokenRes = await fetch("/api/grok-voice/token", { method: "POST" })
      if (!tokenRes.ok) throw new Error("Failed to get token")

      const tokenData = await tokenRes.json()

      // AudioContext 생성
      audioContextRef.current = new AudioContext({ sampleRate: 24000 })

      // WebSocket 연결
      const ws = new WebSocket("wss://api.x.ai/v1/realtime")
      wsRef.current = ws

      ws.onopen = () => {
        // 세션 설정 - 에이전트 정보 사용
        ws.send(JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: `You are ${agent.name}, a friendly Korean AI assistant. The user just received this notification: "${message}". Respond naturally in Korean and help them with any follow-up questions or tasks.`,
            voice: "sage",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: { model: "whisper-1" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
          },
        }))

        setVoiceStatus("connected")
        startMicrophone()
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleServerEvent(data)
        } catch (e) {
          console.error("[Voice] Parse error:", e)
        }
      }

      ws.onerror = () => {
        setVoiceStatus("disconnected")
      }

      ws.onclose = () => {
        setVoiceStatus("disconnected")
        stopMicrophone()
      }

    } catch (error) {
      console.error("[Voice] Connection error:", error)
      setVoiceStatus("disconnected")
    }
  }, [voiceStatus, agent.name, message, handleServerEvent, startMicrophone, stopMicrophone])

  // 보이스 모드 종료
  const stopVoiceMode = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    stopMicrophone()
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setVoiceStatus("disconnected")
    setReplyMode("chat") // 채팅 모드로 전환
  }, [stopMicrophone])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      stopMicrophone()
    }
  }, [stopMicrophone])

  // 테마 색상 가져오기
  const themeColorData = accentColors.find(c => c.id === themeAccent)
  const themeColor = themeColorData?.color || "#3b82f6"

  // 아바타 URL 결정 (여성 에이전트 감지)
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
  // 테마 색상 사용 (에이전트 색상 대신)
  const accentColor = themeColor

  // 답장 전송 처리
  const handleSendReply = async () => {
    if (!replyText.trim() || isProcessing) return

    setIsProcessing(true)
    try {
      // 에이전트에게 메시지 전송
      const response = await fetch(`/api/agents/${agent.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: replyText,
          context: `사용자가 "${message}"에 대해 답장했습니다: "${replyText}"`,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const agentReply = data.response || data.message || "알겠습니다. 처리하겠습니다."
        setAgentResponse(agentReply)

        // 2초 후 닫고 에이전트 응답 알림 표시
        setTimeout(() => {
          dismissNotification(notification.id)
          showAgentNotification(agent, agentReply, {
            type: "info",
            actions: [
              { label: "확인", onClick: () => {} },
            ],
          })
        }, 1500)
      } else {
        setAgentResponse("죄송합니다. 응답을 처리하는 중 오류가 발생했습니다.")
      }
    } catch (error) {
      console.error("Reply error:", error)
      setAgentResponse("네트워크 오류가 발생했습니다.")
    } finally {
      setIsProcessing(false)
    }
  }

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

            {/* 에이전트 응답 표시 */}
            <AnimatePresence>
              {agentResponse && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 rounded-2xl p-4 border"
                  style={{
                    backgroundColor: `${accentColor}15`,
                    borderColor: `${accentColor}30`,
                  }}
                >
                  <p className="text-sm leading-relaxed text-center" style={{ color: accentColor }}>
                    {agentResponse}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* 보이스 모드 UI */}
          <AnimatePresence>
            {replyMode === "voice" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-6 pb-4"
              >
                {/* 연결 상태 표시 */}
                <div className="flex flex-col items-center py-6">
                  {voiceStatus === "connecting" && (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
                      <span className="text-sm text-zinc-400">연결 중...</span>
                    </div>
                  )}

                  {voiceStatus === "connected" && (
                    <>
                      {/* 음성 파형 애니메이션 */}
                      <div className="flex items-center gap-1 mb-4">
                        {[...Array(5)].map((_, i) => (
                          <motion.div
                            key={i}
                            animate={{
                              height: [8, 24, 8],
                            }}
                            transition={{
                              repeat: Infinity,
                              duration: 0.8,
                              delay: i * 0.1,
                            }}
                            className="w-1 rounded-full"
                            style={{ backgroundColor: accentColor }}
                          />
                        ))}
                      </div>

                      {/* 사용자 말 */}
                      {voiceTranscript && (
                        <p className="text-sm text-zinc-400 mb-2 text-center">
                          나: {voiceTranscript}
                        </p>
                      )}

                      {/* 에이전트 응답 */}
                      {voiceResponse && (
                        <p className="text-sm text-center" style={{ color: accentColor }}>
                          {agent.name}: {voiceResponse}
                        </p>
                      )}

                      {!voiceTranscript && !voiceResponse && (
                        <p className="text-sm text-zinc-500 text-center">
                          말씀해 주세요...
                        </p>
                      )}
                    </>
                  )}

                  {voiceStatus === "disconnected" && (
                    <div className="flex flex-col items-center gap-3">
                      <Volume2 className="w-8 h-8 text-zinc-500" />
                      <span className="text-sm text-zinc-400">음성 대화를 시작합니다</span>
                    </div>
                  )}
                </div>

                {/* 통화 종료 버튼 */}
                {voiceStatus === "connected" && (
                  <button
                    onClick={stopVoiceMode}
                    className="w-full py-3 px-4 text-sm font-semibold rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    <PhoneOff className="w-4 h-4" />
                    통화 종료
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 채팅 모드 입력 섹션 */}
          <AnimatePresence>
            {replyMode === "chat" && !agentResponse && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-6 pb-4"
              >
                {/* 음성 인식 중 표시 */}
                {isListening && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mb-3 flex items-center justify-center gap-2 py-2"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: accentColor }}
                    />
                    <span className="text-sm" style={{ color: accentColor }}>
                      음성을 듣고 있습니다...
                    </span>
                  </motion.div>
                )}

                <div className="flex gap-2">
                  {/* 음성 모드 전환 버튼 */}
                  <button
                    onClick={() => {
                      setReplyMode("voice")
                      startVoiceMode()
                    }}
                    className="px-4 py-3 rounded-xl bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    title="음성 대화로 전환"
                  >
                    <Phone className="w-4 h-4" />
                  </button>

                  {/* 마이크 버튼 (텍스트 입력용 STT) */}
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
                        background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                        boxShadow: `0 0 20px ${accentColor}50`,
                      } : {}}
                    >
                      {isListening ? (
                        <motion.div
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ repeat: Infinity, duration: 0.5 }}
                        >
                          <MicOff className="w-4 h-4" />
                        </motion.div>
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </button>
                  )}

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
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || isProcessing}
                    className="px-4 py-3 rounded-xl text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                    style={{
                      background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                    }}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 초기 모드 선택 버튼 (채팅 / 보이스) */}
          {replyMode === "none" && !agentResponse && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="px-6 pb-6"
            >
              {/* 대화하기 버튼 */}
              <button
                onClick={() => dismissNotification(notification.id)}
                className="w-full py-3 px-4 text-sm font-semibold rounded-xl text-white transition-all hover:scale-[1.02] active:scale-[0.98] mb-3 flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                  boxShadow: `0 4px 20px ${accentColor}40`,
                }}
              >
                <MessageSquare className="w-4 h-4" />
                확인
              </button>

              {/* 채팅 / 보이스 선택 */}
              <div className="flex gap-3">
                <button
                  onClick={() => setReplyMode("chat")}
                  className="flex-1 py-3 px-4 text-sm font-semibold rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  채팅
                </button>
                <button
                  onClick={() => {
                    setReplyMode("voice")
                    startVoiceMode()
                  }}
                  className="flex-1 py-3 px-4 text-sm font-semibold rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  보이스
                </button>
              </div>
            </motion.div>
          )}

          {/* 채팅/보이스 모드에서 취소 버튼 */}
          {replyMode !== "none" && !agentResponse && voiceStatus !== "connected" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-6 pb-6"
            >
              <button
                onClick={() => {
                  setReplyMode("none")
                  setReplyText("")
                  if (voiceStatus !== "disconnected") {
                    stopVoiceMode()
                  }
                }}
                className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                취소
              </button>
            </motion.div>
          )}

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
