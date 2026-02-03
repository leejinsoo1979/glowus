'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { VAD_SENSITIVITY_OPTIONS } from '@/components/agent-detail/constants'
import { detectEmotion } from '@/components/agent-detail/utils'
import type { EmotionType, CustomEmotion } from '@/components/agent-detail/utils'

// Types
interface VoiceSettings {
  provider?: string
  voice?: string
  conversation_style?: string
  vad_sensitivity?: string
}

interface Agent {
  id: string
  name: string
  description?: string
  system_prompt?: string
  voice_settings?: VoiceSettings
}

interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
  emotion?: EmotionType
  isVoice?: boolean
  image?: string
}

interface UseGrokVoiceCallOptions {
  agent: Agent | null
  allEmotions: CustomEmotion[]
  onMessageAdd: (message: ChatMessage) => void
  onEmotionChange: (emotion: EmotionType) => void
  saveMessageToHistory: (role: 'user' | 'agent', content: string) => void
  setVoiceCallActive?: (active: boolean) => void
}

interface UseGrokVoiceCallReturn {
  // States
  isVoiceCallActive: boolean
  isVoiceConnecting: boolean
  useGeminiVoice: boolean
  isMuted: boolean
  isListening: boolean
  isAgentSpeaking: boolean
  previewingVoice: string | null
  // Actions
  startVoiceCall: () => Promise<void>
  endVoiceCall: () => void
  toggleMute: () => void
  setMuted: (muted: boolean) => void
  previewVoice: (voiceId: string) => Promise<void>
  stopVoicePreview: () => void
  sendTextDuringCall: (text: string) => boolean  // Returns true if sent successfully
}

const STYLE_INSTRUCTIONS: Record<string, string> = {
  professional: '격식 있지만 딱딱하지 않게. 전문적이면서도 인간미 있게 대화하세요. 적절한 유머도 OK.',
  friendly: '친한 친구처럼 편하게! 웃음, 감탄, 공감 표현 자유롭게. "아~ 그렇구나!", "대박!", "진짜?" 같은 추임새도 OK.',
  casual: '완전 편하게 반말도 OK. 이모티콘 느낌으로 "ㅋㅋ", "헐", "오~" 같은 표현도 자연스럽게.',
  empathetic: '상대방 말에 진심으로 공감하고 반응해주세요. "그랬구나...", "많이 힘들었겠다", "이해해" 같은 표현으로.',
  concise: '짧지만 임팩트 있게! 단답이어도 감정은 담아서. 무미건조하게 말하지 마세요.',
}

export function useGrokVoiceCall(options: UseGrokVoiceCallOptions): UseGrokVoiceCallReturn {
  const { agent, allEmotions, onMessageAdd, onEmotionChange, saveMessageToHistory, setVoiceCallActive: setGlobalVoiceActive } = options

  // Voice call states
  const [isVoiceCallActive, setIsVoiceCallActive] = useState(false)
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false)
  const [useGeminiVoice, setUseGeminiVoice] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false)

  // Voice preview state
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null)

  // Refs for WebSocket and audio
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const audioQueueRef = useRef<Int16Array[]>([])
  const isPlayingRef = useRef(false)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)

  // Voice preview refs
  const previewWsRef = useRef<WebSocket | null>(null)
  const previewAudioContextRef = useRef<AudioContext | null>(null)
  const previewAudioQueueRef = useRef<Int16Array[]>([])
  const previewIsPlayingRef = useRef(false)

  // Voice-chat integration refs
  const voiceTranscriptRef = useRef<string>('')
  const isAgentSpeakingRef = useRef(false)

  // Play audio chunk from queue
  const playAudioChunk = useCallback((pcm16Data: Int16Array) => {
    if (!wsRef.current) {
      audioQueueRef.current = []
      isPlayingRef.current = false
      return
    }

    if (!audioContextRef.current) {
      console.warn('[VoiceAudio] ❌ No AudioContext!')
      return
    }

    const ctx = audioContextRef.current
    console.log('[VoiceAudio] 🔊 Playing chunk, size:', pcm16Data.length, 'state:', ctx.state)
    const float32Data = new Float32Array(pcm16Data.length)
    for (let i = 0; i < pcm16Data.length; i++) {
      float32Data[i] = pcm16Data[i] / 32768.0
    }

    const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000)
    audioBuffer.getChannelData(0).set(float32Data)

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)
    source.onended = () => {
      playNextChunk()
    }
    sourceNodeRef.current = source
    source.start()
  }, [])

  // Play next chunk in queue
  const playNextChunk = useCallback(() => {
    if (!wsRef.current) {
      audioQueueRef.current = []
      isPlayingRef.current = false
      return
    }

    if (audioQueueRef.current.length > 0) {
      const nextChunk = audioQueueRef.current.shift()!
      playAudioChunk(nextChunk)
    } else {
      isPlayingRef.current = false
    }
  }, [playAudioChunk])

  // Handle voice server events
  const handleVoiceServerEvent = useCallback((event: any) => {
    if (!wsRef.current) return

    const eventType = event.type || 'unknown'
    console.log('[VoiceEvent]', eventType, JSON.stringify(event).substring(0, 500))

    if (eventType.includes('audio') || eventType.includes('transcript') || eventType.includes('text')) {
      console.log('[VoiceEvent] 🎯 Audio/Transcript event:', eventType)
    }

    switch (event.type) {
      case 'session.created':
        console.log('Voice session created')
        break

      case 'input_audio_buffer.speech_started':
        setIsListening(true)
        break

      case 'input_audio_buffer.speech_stopped':
        setIsListening(false)
        break

      case 'response.created':
        voiceTranscriptRef.current = ''
        setIsAgentSpeaking(true)
        isAgentSpeakingRef.current = true
        console.log('[VoiceEvent] 🎤 Agent started speaking, mic blocked')
        break

      case 'response.audio.delta':
        console.log('[VoiceEvent] ⚠️ OpenAI format audio.delta ignored (using xAI format)')
        break

      case 'response.audio_transcript.delta':
        if (event.delta) {
          voiceTranscriptRef.current += event.delta
        }
        break

      case 'response.text.delta':
        if (event.delta && !voiceTranscriptRef.current) {
          voiceTranscriptRef.current += event.delta
        }
        break

      case 'response.content_part.added':
        console.log('[VoiceEvent] 🎵 Content part added:', event.part?.type, event.part)
        break

      case 'response.content_part.delta':
        console.log('[VoiceEvent] ⚠️ content_part.delta ignored (using xAI output_audio format)')
        break

      case 'response.content_part.done':
        console.log('[VoiceEvent] 🎵 Content part done:', event.part?.type, event.part?.transcript?.substring(0, 50))
        if (event.part?.type === 'audio' && event.part?.transcript) {
          voiceTranscriptRef.current = event.part.transcript
        }
        if (event.part?.type === 'text' && event.part?.text) {
          voiceTranscriptRef.current = event.part.text
        }
        break

      case 'response.done':
        setIsAgentSpeaking(false)
        setTimeout(() => {
          const waitForAudio = () => {
            if (isPlayingRef.current) {
              setTimeout(waitForAudio, 200)
            } else {
              setTimeout(() => {
                isAgentSpeakingRef.current = false
                console.log('[VoiceEvent] 🎤 Agent stopped speaking, mic resumed')
              }, 500)
            }
          }
          waitForAudio()
        }, 300)

        let finalTranscript = voiceTranscriptRef.current.trim()
        if (!finalTranscript && event.response?.output) {
          for (const output of event.response.output) {
            if (output.content) {
              for (const content of output.content) {
                if (content.transcript) finalTranscript = content.transcript
                else if (content.text) finalTranscript = content.text
              }
            }
          }
        }

        if (finalTranscript) {
          const transcript = finalTranscript
          const responseEmotion = detectEmotion(transcript, allEmotions)

          const aiMessage: ChatMessage = {
            id: `voice-ai-${Date.now()}`,
            role: 'agent',
            content: transcript,
            timestamp: new Date(),
            emotion: responseEmotion,
            isVoice: true,
          }
          onMessageAdd(aiMessage)

          if (responseEmotion !== 'neutral') {
            onEmotionChange(responseEmotion)
          }

          saveMessageToHistory('agent', transcript)
          voiceTranscriptRef.current = ''
        }
        break

      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) {
          const userTranscript = event.transcript.trim()
          if (userTranscript) {
            const userMessage: ChatMessage = {
              id: `voice-user-${Date.now()}`,
              role: 'user',
              content: userTranscript,
              timestamp: new Date(),
              isVoice: true,
            }
            onMessageAdd(userMessage)
            saveMessageToHistory('user', userTranscript)

            const userEmotion = detectEmotion(userTranscript, allEmotions)
            if (userEmotion !== 'neutral') {
              onEmotionChange(userEmotion)
            }
          }
        }
        break

      case 'error':
        console.error('Voice error:', event.error)
        setIsAgentSpeaking(false)
        isAgentSpeakingRef.current = false
        break

      case 'response.output_audio.delta':
        if (event.delta) {
          console.log('[VoiceEvent] 🔊 xAI Audio delta received, length:', event.delta.length)
          try {
            const binaryString = atob(event.delta)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            const pcm16Data = new Int16Array(bytes.buffer)

            if (isPlayingRef.current) {
              audioQueueRef.current.push(pcm16Data)
            } else {
              isPlayingRef.current = true
              playAudioChunk(pcm16Data)
            }
          } catch (e) {
            console.error('[VoiceEvent] xAI Audio decode error:', e)
          }
        }
        break

      case 'response.output_audio.done':
        console.log('[VoiceEvent] 🔊 xAI Audio done (already played via delta)')
        break

      case 'response.output_audio_transcript.delta':
        if (event.delta) {
          voiceTranscriptRef.current += event.delta
          console.log('[VoiceEvent] 📝 xAI Transcript delta:', event.delta)
        }
        break

      case 'response.output_audio_transcript.done':
        if (event.transcript) {
          voiceTranscriptRef.current = event.transcript
          console.log('[VoiceEvent] 📝 xAI Transcript done:', event.transcript.substring(0, 50) + '...')
        }
        break

      case 'response.output_item.added':
      case 'response.output_item.done':
      case 'conversation.item.created':
        console.log('[VoiceEvent] Item event:', event.type)
        break

      case 'input_audio_buffer.committed':
      case 'input_audio_buffer.cleared':
        console.log('[VoiceEvent] Audio buffer event:', event.type)
        break

      default:
        if (event.type && !event.type.startsWith('session.')) {
          console.log('[VoiceEvent] ⚠️ Unhandled event:', event.type)
        }
    }
  }, [allEmotions, onMessageAdd, onEmotionChange, saveMessageToHistory, playAudioChunk])

  // Start microphone
  const startMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 24000, channelCount: 1 }
      })
      streamRef.current = stream

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 })
      }

      const ctx = audioContextRef.current
      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(4096, 1, 1)

      processor.onaudioprocess = (e) => {
        if (isMuted || isAgentSpeakingRef.current || isPlayingRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

        const inputData = e.inputBuffer.getChannelData(0)
        const pcm16 = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          pcm16[i] = Math.max(-32768, Math.min(32767, Math.floor(inputData[i] * 32768)))
        }

        const bytes = new Uint8Array(pcm16.buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        const base64 = btoa(binary)

        wsRef.current.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64
        }))
      }

      source.connect(processor)
      processor.connect(ctx.destination)
      processorRef.current = processor
    } catch (err) {
      console.error('Microphone error:', err)
      alert('마이크 접근 권한이 필요합니다.')
    }
  }, [isMuted])

  // Stop microphone
  const stopMicrophone = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [])

  // Start voice call
  const startVoiceCall = useCallback(async () => {
    if (!agent) return

    const voiceSettings = agent.voice_settings || {}
    if (voiceSettings.provider === 'gemini') {
      console.log('[VoiceCall] 🌟 Using Gemini Live for:', agent.name)
      setUseGeminiVoice(true)
      setIsVoiceCallActive(true)
      setGlobalVoiceActive?.(true)
      return
    }

    setIsVoiceConnecting(true)

    try {
      const selectedVoice = voiceSettings.voice || 'sol'
      const conversationStyle = voiceSettings.conversation_style || 'friendly'
      const vadSensitivity = voiceSettings.vad_sensitivity || 'medium'
      const vadThreshold = VAD_SENSITIVITY_OPTIONS.find(v => v.id === vadSensitivity)?.threshold || 0.5

      let fullInstructions = ''
      try {
        console.log('[VoiceCall] 🔥 Loading voice context for agent:', agent.id)
        const contextRes = await fetch(`/api/grok-voice/context?agentId=${agent.id}`)
        if (contextRes.ok) {
          const contextData = await contextRes.json()
          fullInstructions = contextData.systemPrompt
          console.log('[VoiceCall] ✅ Context loaded:', {
            hasIdentity: contextData.hasIdentity,
            hasWorkContext: contextData.hasWorkContext,
            hasChatHistory: contextData.hasChatHistory,
            userName: contextData.userName,
            promptLength: fullInstructions?.length || 0,
          })
        } else {
          console.error('[VoiceCall] ❌ Context API error:', contextRes.status, await contextRes.text())
        }
      } catch (contextError) {
        console.error('[VoiceCall] ❌ Failed to load context:', contextError)
      }

      if (!fullInstructions) {
        const baseInstructions = agent.system_prompt || `You are ${agent.name}. ${agent.description || ''}`
        const styleInstruction = STYLE_INSTRUCTIONS[conversationStyle] || STYLE_INSTRUCTIONS.friendly
        fullInstructions = `${baseInstructions}\n\n대화 스타일: ${styleInstruction}`
      } else {
        const styleInstruction = STYLE_INSTRUCTIONS[conversationStyle] || STYLE_INSTRUCTIONS.friendly
        fullInstructions += `\n\n대화 스타일: ${styleInstruction}`
      }

      const tokenRes = await fetch('/api/grok-voice/token', { method: 'POST' })
      if (!tokenRes.ok) {
        throw new Error('Failed to get voice token')
      }
      const tokenData = await tokenRes.json()

      const ws = new WebSocket('wss://api.x.ai/v1/realtime?model=grok-3-fast-realtime', [
        'realtime',
        `openai-insecure-api-key.${tokenData.client_secret}`,
        'openai-beta.realtime-v1'
      ])

      ws.onopen = () => {
        console.log('Voice WebSocket connected')

        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext({ sampleRate: 24000 })
          console.log('[VoiceCall] AudioContext created for playback')
        }
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().then(() => {
            console.log('[VoiceCall] AudioContext resumed')
          })
        }

        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: fullInstructions,
            voice: selectedVoice,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: { model: 'grok-2-public' },
            turn_detection: {
              type: 'server_vad',
              threshold: vadThreshold,
              prefix_padding_ms: 200,
              silence_duration_ms: 300
            }
          }
        }))

        setIsVoiceCallActive(true)
        setGlobalVoiceActive?.(true)
        setIsVoiceConnecting(false)

        setTimeout(() => {
          console.log('[VoiceCall] Starting microphone, waiting for user to speak...')
          startMicrophone()
        }, 300)
      }

      ws.onmessage = (event) => {
        if (!wsRef.current) {
          console.log('[VoiceCall] Ignoring message - call ended')
          return
        }
        try {
          const data = JSON.parse(event.data)
          handleVoiceServerEvent(data)
        } catch (err) {
          console.error('Failed to parse voice message:', err)
        }
      }

      ws.onerror = (error) => {
        console.error('Voice WebSocket error:', error)
        setIsVoiceConnecting(false)
      }

      ws.onclose = () => {
        console.log('Voice WebSocket closed')
        setIsVoiceCallActive(false)
        setGlobalVoiceActive?.(false)
        setIsVoiceConnecting(false)
        stopMicrophone()
      }

      wsRef.current = ws
    } catch (err) {
      console.error('Voice call error:', err)
      alert('음성 통화 연결에 실패했습니다.')
      setIsVoiceConnecting(false)
    }
  }, [agent, handleVoiceServerEvent, startMicrophone, stopMicrophone, setGlobalVoiceActive])

  // End voice call
  const endVoiceCall = useCallback(() => {
    console.log('[VoiceCall] Ending voice call...')

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    stopMicrophone()

    audioQueueRef.current = []
    isPlayingRef.current = false

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop()
      } catch (e) {
        // Already stopped
      }
      sourceNodeRef.current = null
    }

    setIsAgentSpeaking(false)
    isAgentSpeakingRef.current = false
    voiceTranscriptRef.current = ''

    setIsVoiceCallActive(false)
    setGlobalVoiceActive?.(false)
    setIsVoiceConnecting(false)
    setIsListening(false)
    setUseGeminiVoice(false)

    console.log('[VoiceCall] Voice call ended completely')
  }, [stopMicrophone, setGlobalVoiceActive])

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev)
  }, [])

  // Play preview audio chunk
  const playPreviewAudioChunk = useCallback(async (pcm16Data: Int16Array) => {
    if (!previewAudioContextRef.current) return

    const ctx = previewAudioContextRef.current

    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    const float32Data = new Float32Array(pcm16Data.length)
    for (let i = 0; i < pcm16Data.length; i++) {
      float32Data[i] = pcm16Data[i] / 32768.0
    }

    const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000)
    audioBuffer.getChannelData(0).set(float32Data)

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)
    source.onended = () => {
      playNextPreviewChunk()
    }
    source.start()
  }, [])

  // Play next preview chunk in queue
  const playNextPreviewChunk = useCallback(() => {
    if (previewAudioQueueRef.current.length > 0) {
      const nextChunk = previewAudioQueueRef.current.shift()!
      playPreviewAudioChunk(nextChunk)
    } else {
      previewIsPlayingRef.current = false
    }
  }, [playPreviewAudioChunk])

  // Stop voice preview
  const stopVoicePreview = useCallback(() => {
    if (previewWsRef.current) {
      previewWsRef.current.close()
      previewWsRef.current = null
    }
    previewAudioQueueRef.current = []
    previewIsPlayingRef.current = false
    setPreviewingVoice(null)
  }, [])

  // Preview voice
  const previewVoice = useCallback(async (voiceId: string) => {
    if (previewingVoice === voiceId) {
      stopVoicePreview()
      return
    }

    stopVoicePreview()
    setPreviewingVoice(voiceId)

    try {
      console.log('[VoicePreview] Fetching token for voice:', voiceId)
      const res = await fetch('/api/grok-voice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: voiceId, text: '반갑습니다. 주인님' }),
      })

      const data = await res.json()
      console.log('[VoicePreview] API response:', res.status, data)

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get preview session')
      }

      if (!data.client_secret) {
        throw new Error('No client_secret in response')
      }

      if (!previewAudioContextRef.current) {
        previewAudioContextRef.current = new AudioContext({ sampleRate: 24000 })
      }

      const wsUrl = 'wss://api.x.ai/v1/realtime?model=grok-3-fast-realtime'
      const protocols = ['realtime', `openai-insecure-api-key.${data.client_secret}`, 'openai-beta.realtime-v1']
      console.log('[VoicePreview] Connecting to WebSocket:', wsUrl)
      const ws = new WebSocket(wsUrl, protocols)

      ws.onopen = () => {
        console.log('[VoicePreview] WebSocket connected')

        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: '당신은 음성 미리듣기 도우미입니다. 사용자가 요청하면 정확히 그 문장만 말하세요.',
            voice: voiceId,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            turn_detection: null,
          }
        }))

        setTimeout(() => {
          console.log('[VoicePreview] Sending text-to-speech request')
          ws.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [{ type: 'input_text', text: '다음 문장을 따라 말해주세요: "반갑습니다. 주인님."' }]
            }
          }))
          ws.send(JSON.stringify({
            type: 'response.create',
            response: {
              modalities: ['text', 'audio']
            }
          }))
        }, 300)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          console.log('[VoicePreview] Message:', msg.type, JSON.stringify(msg).substring(0, 300))

          if (msg.type === 'error') {
            console.error('[VoicePreview] API Error:', msg)
            setPreviewingVoice(null)
            return
          }

          if ((msg.type === 'response.audio.delta' || msg.type === 'response.output_audio.delta') && msg.delta) {
            console.log('[VoicePreview] 🔊 Audio chunk received, type:', msg.type, 'size:', msg.delta.length)
            const binaryString = atob(msg.delta)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            const pcm16Data = new Int16Array(bytes.buffer)

            if (previewIsPlayingRef.current) {
              previewAudioQueueRef.current.push(pcm16Data)
            } else {
              previewIsPlayingRef.current = true
              playPreviewAudioChunk(pcm16Data)
            }
          }

          if (msg.type === 'response.done') {
            console.log('[VoicePreview] Response complete')
            setTimeout(() => {
              ws.close()
            }, 500)
          }
        } catch (err) {
          console.error('[VoicePreview] Message parse error:', err)
        }
      }

      ws.onerror = (error) => {
        console.error('[VoicePreview] WebSocket error:', error)
        setPreviewingVoice(null)
      }

      ws.onclose = (event) => {
        console.log('[VoicePreview] WebSocket closed:', event.code, event.reason)
        setTimeout(() => {
          if (!previewIsPlayingRef.current) {
            setPreviewingVoice(null)
          }
        }, 1000)
      }

      previewWsRef.current = ws
    } catch (err) {
      console.error('Voice preview error:', err)
      setPreviewingVoice(null)
    }
  }, [previewingVoice, stopVoicePreview, playPreviewAudioChunk])

  // Set muted state directly
  const setMuted = useCallback((muted: boolean) => {
    setIsMuted(muted)
  }, [])

  // Send text message during active voice call
  const sendTextDuringCall = useCallback((text: string): boolean => {
    if (!isVoiceCallActive || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false
    }

    // Send text message via WebSocket
    wsRef.current.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }]
      }
    }))
    // Request voice response
    wsRef.current.send(JSON.stringify({
      type: 'response.create',
      response: { modalities: ['text', 'audio'] }
    }))
    return true
  }, [isVoiceCallActive])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (previewWsRef.current) {
        previewWsRef.current.close()
      }
      stopMicrophone()
    }
  }, [stopMicrophone])

  return {
    isVoiceCallActive,
    isVoiceConnecting,
    useGeminiVoice,
    isMuted,
    isListening,
    isAgentSpeaking,
    previewingVoice,
    startVoiceCall,
    endVoiceCall,
    toggleMute,
    setMuted,
    previewVoice,
    stopVoicePreview,
    sendTextDuringCall,
  }
}
