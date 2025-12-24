"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mic, MicOff, Phone, PhoneOff, Volume2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"

interface GrokVoiceChatProps {
  agentName?: string
  agentInstructions?: string
  voice?: "sol" | "tara" | "cove" | "puck" | "charon" | "vale"
  avatarUrl?: string
  onTranscript?: (text: string, role: "user" | "assistant") => void
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error"

export function GrokVoiceChat({
  agentName = "에이미",
  agentInstructions = "You are Amy (에이미), a friendly Korean AI assistant. Speak naturally in Korean with a warm, cheerful tone. Keep responses concise and helpful.",
  voice = "tara",
  avatarUrl,
  onTranscript,
}: GrokVoiceChatProps) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const [isMuted, setIsMuted] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState<string>("")
  const [response, setResponse] = useState<string>("")

  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const audioQueueRef = useRef<Float32Array[]>([])
  const isPlayingRef = useRef(false)

  // 연결 사운드 재생
  const playConnectionSound = useCallback(() => {
    try {
      const ctx = new AudioContext()
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      // 상승하는 2음 멜로디 (연결 성공 느낌)
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
      oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15) // E5

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.4)

      // 정리
      setTimeout(() => ctx.close(), 500)
    } catch (e) {
      console.log('[GrokVoice] Connection sound skipped')
    }
  }, [])

  // 오디오 재생
  const playAudioChunk = useCallback((base64Audio: string) => {
    if (!audioContextRef.current) return

    try {
      // Base64 디코딩
      const binaryString = atob(base64Audio)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // PCM 16-bit to Float32
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
      console.error("[GrokVoice] Audio decode error:", e)
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

  // WebSocket 연결
  const connect = useCallback(async () => {
    if (status === "connecting" || status === "connected") return

    setStatus("connecting")
    setTranscript("")
    setResponse("")

    try {
      // Ephemeral token 발급
      const tokenRes = await fetch("/api/grok-voice/token", { method: "POST" })

      if (!tokenRes.ok) {
        throw new Error("Failed to get token")
      }

      const tokenData = await tokenRes.json()
      const token = tokenData.client_secret

      if (!token) {
        console.error("[GrokVoice] No ephemeral token received")
        setStatus("error")
        return
      }

      console.log("[GrokVoice] Token received:", token.substring(0, 30) + "...")

      // AudioContext 생성
      audioContextRef.current = new AudioContext({ sampleRate: 24000 })

      // WebSocket 연결 - OpenAI 호환 형식으로 토큰 전달
      const ws = new WebSocket(
        "wss://api.x.ai/v1/realtime?model=grok-3-fast-realtime",
        ["realtime", `openai-insecure-api-key.${token}`, "openai-beta.realtime-v1"]
      )
      wsRef.current = ws

      ws.onopen = () => {
        console.log("[GrokVoice] Connected")

        // 세션 설정
        ws.send(JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: agentInstructions,
            voice: voice.toLowerCase(),
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: {
              model: "whisper-1"
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
          },
        }))

        setStatus("connected")
        playConnectionSound()

        // 🔥 에이전트가 먼저 인사
        setTimeout(() => {
          console.log("[GrokVoice] Requesting agent greeting...")
          ws.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: "(통화가 연결되었습니다. 자연스럽게 인사해주세요.)" }]
            }
          }))
          ws.send(JSON.stringify({
            type: "response.create",
            response: { modalities: ["text", "audio"] }
          }))
          // 인사 후 마이크 시작
          setTimeout(() => startMicrophone(), 500)
        }, 300)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleServerEvent(data)
        } catch (e) {
          console.error("[GrokVoice] Parse error:", e)
        }
      }

      ws.onerror = (error) => {
        console.error("[GrokVoice] WebSocket error:", error)
        setStatus("error")
      }

      ws.onclose = () => {
        console.log("[GrokVoice] Disconnected")
        setStatus("disconnected")
        stopMicrophone()
      }

    } catch (error) {
      console.error("[GrokVoice] Connection error:", error)
      setStatus("error")
    }
  }, [status, agentInstructions, voice, playConnectionSound])

  // 서버 이벤트 처리
  const handleServerEvent = useCallback((data: any) => {
    switch (data.type) {
      case "session.created":
        console.log("[GrokVoice] Session created:", data.session?.id)
        break

      case "input_audio_buffer.speech_started":
        setIsListening(true)
        break

      case "input_audio_buffer.speech_stopped":
        setIsListening(false)
        break

      case "conversation.item.input_audio_transcription.completed":
        const userText = data.transcript || ""
        setTranscript(userText)
        onTranscript?.(userText, "user")
        break

      // xAI API: response.output_audio.delta 형식
      case "response.output_audio.delta":
        if (data.delta) {
          playAudioChunk(data.delta)
        }
        break

      case "response.output_audio_transcript.delta":
        setResponse(prev => prev + (data.delta || ""))
        break

      case "response.output_audio_transcript.done":
        const fullText = data.transcript || response
        onTranscript?.(fullText, "assistant")
        setResponse("")
        break

      case "response.done":
        console.log("[GrokVoice] Response complete")
        break

      case "error":
        console.error("[GrokVoice] Server error:", data.error)
        break
    }
  }, [response, onTranscript, playAudioChunk])

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
        if (isMuted || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

        const inputData = e.inputBuffer.getChannelData(0)

        // Float32 to PCM16
        const pcm16 = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }

        // Base64 인코딩
        const bytes = new Uint8Array(pcm16.buffer)
        let binary = ""
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        const base64 = btoa(binary)

        // 전송
        wsRef.current.send(JSON.stringify({
          type: "input_audio_buffer.append",
          audio: base64,
        }))
      }

      source.connect(processor)
      processor.connect(audioContextRef.current.destination)

      console.log("[GrokVoice] Microphone started")
    } catch (error) {
      console.error("[GrokVoice] Microphone error:", error)
    }
  }, [isMuted])

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

    console.log("[GrokVoice] Microphone stopped")
  }, [])

  // 연결 해제
  const disconnect = useCallback(() => {
    stopMicrophone()

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    audioQueueRef.current = []
    isPlayingRef.current = false
    setStatus("disconnected")
  }, [stopMicrophone])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  const statusColors: Record<ConnectionStatus, string> = {
    disconnected: "bg-zinc-600",
    connecting: "bg-cyan-500 animate-pulse",
    connected: "bg-emerald-500",
    error: "bg-red-500",
  }

  const statusLabels: Record<ConnectionStatus, string> = {
    disconnected: "대기",
    connecting: "연결 중...",
    connected: "통화 중",
    error: "오류",
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Agent Avatar with Voice Waves */}
        <div className="relative mb-8">
          {/* Animated rings when connected */}
          {status === "connected" && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-emerald-500/30"
                animate={{ scale: [1, 1.5, 1.5], opacity: [0.5, 0, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                style={{ width: 160, height: 160, top: -20, left: -20 }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-emerald-500/20"
                animate={{ scale: [1, 1.8, 1.8], opacity: [0.3, 0, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                style={{ width: 160, height: 160, top: -20, left: -20 }}
              />
            </>
          )}

          {/* Avatar */}
          <div className="relative w-[120px] h-[120px]">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={agentName}
                className={`w-full h-full rounded-full object-cover shadow-2xl shadow-purple-500/25 ${status === "connected" ? "ring-4 ring-emerald-500/50" : ""}`}
              />
            ) : (
              <div className={`w-full h-full rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-4xl shadow-2xl shadow-purple-500/25 ${status === "connected" ? "ring-4 ring-emerald-500/50" : ""}`}>
                {agentName.charAt(0)}
              </div>
            )}

            {/* Status indicator */}
            <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-zinc-900 ${statusColors[status]}`} />
          </div>
        </div>

        {/* Agent Name & Status */}
        <h2 className="text-2xl font-bold text-white mb-1">{agentName}</h2>
        <p className={`text-sm mb-8 ${status === "connected" ? "text-emerald-400" : "text-zinc-500"}`}>
          {statusLabels[status]}
        </p>

        {/* Voice Activity Visualization */}
        {status === "connected" && (
          <div className="flex items-center gap-1 mb-8 h-12">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className={`w-1.5 rounded-full ${isListening ? "bg-emerald-500" : "bg-zinc-700"}`}
                animate={isListening ? {
                  height: [12, 32, 12],
                } : { height: 12 }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
        )}

        {/* Transcript Area */}
        <div className="w-full max-w-md min-h-[80px] mb-4">
          <AnimatePresence mode="wait">
            {transcript && (
              <motion.div
                key="transcript"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-right mb-3"
              >
                <span className="inline-block px-4 py-2 bg-blue-600 rounded-2xl rounded-br-sm text-white text-sm">
                  {transcript}
                </span>
              </motion.div>
            )}

            {response && (
              <motion.div
                key="response"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-left"
              >
                <span className="inline-block px-4 py-2 bg-zinc-800 rounded-2xl rounded-bl-sm text-zinc-200 text-sm">
                  {response}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {status === "connected" && !transcript && !response && (
            <p className="text-center text-zinc-600 text-sm">말씀해 주세요...</p>
          )}

          {status === "disconnected" && (
            <p className="text-center text-zinc-600 text-sm">
              아래 버튼을 눌러 음성 대화를 시작하세요
            </p>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="p-6 bg-zinc-900/80 backdrop-blur-lg border-t border-zinc-800">
        <div className="flex items-center justify-center gap-6">
          {/* Mute button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            disabled={status !== "connected"}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              status !== "connected"
                ? "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"
                : isMuted
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "bg-zinc-800 text-white hover:bg-zinc-700"
            }`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* Call button */}
          {status === "disconnected" || status === "error" ? (
            <button
              onClick={connect}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            >
              <Phone className="w-8 h-8" />
            </button>
          ) : status === "connecting" ? (
            <button
              disabled
              className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30 flex items-center justify-center"
            >
              <Loader2 className="w-8 h-8 animate-spin" />
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white shadow-lg shadow-red-500/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            >
              <PhoneOff className="w-8 h-8" />
            </button>
          )}

          {/* Speaker/Volume button */}
          <button
            disabled={status !== "connected"}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              status !== "connected"
                ? "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"
                : "bg-zinc-800 text-white hover:bg-zinc-700"
            }`}
          >
            <Volume2 className="w-6 h-6" />
          </button>
        </div>

        {/* Status text */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
          <span className="text-xs text-zinc-500">
            {status === "connected" ? "음성 통화 중 • $0.05/분" : "Grok Voice API"}
          </span>
        </div>
      </div>
    </div>
  )
}
