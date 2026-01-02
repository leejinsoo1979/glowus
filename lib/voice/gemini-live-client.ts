/**
 * Gemini Live Voice Client
 *
 * 브라우저에서 실시간 음성 통화를 처리하는 클라이언트
 * - 마이크 입력 캡처
 * - 실시간 음성 스트리밍
 * - Web Speech API를 통한 TTS
 */

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

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
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition
  new(): SpeechRecognition
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onerror: ((this: SpeechRecognition, ev: Event) => void) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  onend: ((this: SpeechRecognition, ev: Event) => void) | null
}

export interface VoiceSession {
  id: string
  voice: string
  status: 'idle' | 'connecting' | 'active' | 'processing' | 'error'
}

export interface VoiceMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  audioUrl?: string
}

export interface VoiceClientConfig {
  voice?: string
  systemPrompt?: string
  onStatusChange?: (status: VoiceSession['status']) => void
  onMessage?: (message: VoiceMessage) => void
  onTranscription?: (text: string) => void
  onError?: (error: Error) => void
}

export class GeminiLiveClient {
  private sessionId: string | null = null
  private mediaRecorder: MediaRecorder | null = null
  private audioContext: AudioContext | null = null
  private audioChunks: Blob[] = []
  private config: VoiceClientConfig
  private status: VoiceSession['status'] = 'idle'
  private speechSynthesis: SpeechSynthesis | null = null
  private recognition: SpeechRecognition | null = null

  constructor(config: VoiceClientConfig = {}) {
    this.config = config
    if (typeof window !== 'undefined') {
      this.speechSynthesis = window.speechSynthesis
      this.initSpeechRecognition()
    }
  }

  /**
   * 음성 인식 초기화 (Web Speech API)
   */
  private initSpeechRecognition() {
    if (typeof window === 'undefined') return

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported')
      return
    }

    const recognition = new SpeechRecognition()
    this.recognition = recognition
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'ko-KR'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1]
      const transcript = result[0].transcript

      if (result.isFinal) {
        this.config.onTranscription?.(transcript)
        this.sendText(transcript)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      if (event.error !== 'no-speech') {
        this.config.onError?.(new Error(`음성 인식 오류: ${event.error}`))
      }
    }
  }

  /**
   * 세션 시작
   */
  async startSession(): Promise<string> {
    this.setStatus('connecting')

    try {
      const response = await fetch('/api/voice/gemini-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          voice: this.config.voice || 'Kore',
          systemPrompt: this.config.systemPrompt,
        }),
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error)
      }

      this.sessionId = data.sessionId
      this.setStatus('active')

      return data.sessionId
    } catch (error: any) {
      this.setStatus('error')
      this.config.onError?.(error)
      throw error
    }
  }

  /**
   * 마이크 녹음 시작
   */
  async startRecording(): Promise<void> {
    if (!this.sessionId) {
      await this.startSession()
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      this.audioContext = new AudioContext({ sampleRate: 16000 })
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      this.audioChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = async () => {
        await this.processRecording()
      }

      this.mediaRecorder.start(100) // 100ms chunks
      this.setStatus('active')
    } catch (error: any) {
      this.config.onError?.(error)
      throw error
    }
  }

  /**
   * 음성 인식 시작 (Web Speech API 사용)
   */
  startListening(): void {
    if (!this.sessionId) {
      this.startSession().then(() => {
        this.recognition?.start()
      })
    } else {
      this.recognition?.start()
    }
    this.setStatus('active')
  }

  /**
   * 음성 인식 중지
   */
  stopListening(): void {
    this.recognition?.stop()
    if (this.status === 'active') {
      this.setStatus('idle')
    }
  }

  /**
   * 녹음 중지
   */
  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
      this.mediaRecorder.stream.getTracks().forEach((track) => track.stop())
    }
  }

  /**
   * 녹음된 오디오 처리
   */
  private async processRecording(): Promise<void> {
    if (this.audioChunks.length === 0) return

    this.setStatus('processing')

    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
    const base64Audio = await this.blobToBase64(audioBlob)

    try {
      const response = await fetch('/api/voice/gemini-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_audio',
          sessionId: this.sessionId,
          audioData: base64Audio,
        }),
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error)
      }

      // 사용자 메시지 전달
      if (data.response.transcription) {
        this.config.onMessage?.({
          role: 'user',
          content: data.response.transcription,
          timestamp: new Date(),
        })
      }

      // AI 응답 전달 및 TTS 재생
      if (data.response.text) {
        this.config.onMessage?.({
          role: 'assistant',
          content: data.response.text,
          timestamp: new Date(),
        })
        await this.speak(data.response.text)
      }

      this.setStatus('active')
    } catch (error: any) {
      this.setStatus('error')
      this.config.onError?.(error)
    }
  }

  /**
   * 텍스트 전송
   */
  async sendText(text: string): Promise<void> {
    if (!this.sessionId) {
      await this.startSession()
    }

    this.setStatus('processing')

    // 사용자 메시지 전달
    this.config.onMessage?.({
      role: 'user',
      content: text,
      timestamp: new Date(),
    })

    try {
      const response = await fetch('/api/voice/gemini-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_audio',
          sessionId: this.sessionId,
          text,
        }),
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error)
      }

      // AI 응답 전달 및 TTS 재생
      if (data.response.text) {
        this.config.onMessage?.({
          role: 'assistant',
          content: data.response.text,
          timestamp: new Date(),
        })
        await this.speak(data.response.text)
      }

      this.setStatus('active')
    } catch (error: any) {
      this.setStatus('error')
      this.config.onError?.(error)
    }
  }

  /**
   * TTS로 텍스트 읽기
   */
  async speak(text: string): Promise<void> {
    if (!this.speechSynthesis) return

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ko-KR'
      utterance.rate = 1.0
      utterance.pitch = 1.0

      // 한국어 음성 찾기
      const voices = this.speechSynthesis!.getVoices()
      const koreanVoice = voices.find(
        (v) => v.lang.startsWith('ko') && v.name.includes('Google')
      ) || voices.find((v) => v.lang.startsWith('ko'))

      if (koreanVoice) {
        utterance.voice = koreanVoice
      }

      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()

      this.speechSynthesis!.speak(utterance)
    })
  }

  /**
   * TTS 중지
   */
  stopSpeaking(): void {
    this.speechSynthesis?.cancel()
  }

  /**
   * 세션 종료
   */
  async endSession(): Promise<void> {
    this.stopRecording()
    this.stopListening()
    this.stopSpeaking()

    if (this.sessionId) {
      try {
        await fetch('/api/voice/gemini-live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'end',
            sessionId: this.sessionId,
          }),
        })
      } catch (error) {
        console.error('Error ending session:', error)
      }
    }

    this.sessionId = null
    this.setStatus('idle')
  }

  /**
   * 상태 변경
   */
  private setStatus(status: VoiceSession['status']): void {
    this.status = status
    this.config.onStatusChange?.(status)
  }

  /**
   * Blob을 Base64로 변환
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  /**
   * 현재 상태 반환
   */
  getStatus(): VoiceSession['status'] {
    return this.status
  }

  /**
   * 세션 ID 반환
   */
  getSessionId(): string | null {
    return this.sessionId
  }
}

// 싱글톤 인스턴스 (선택적 사용)
let clientInstance: GeminiLiveClient | null = null

export function getGeminiLiveClient(config?: VoiceClientConfig): GeminiLiveClient {
  if (!clientInstance) {
    clientInstance = new GeminiLiveClient(config)
  }
  return clientInstance
}
