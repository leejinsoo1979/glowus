/**
 * TTS Adapter
 * 턴 단위 음성 합성 어댑터 - 문장 단위가 아닌 턴 단위로 합성하여 자연스러운 억양 보존
 *
 * 핵심 규칙:
 * 1. 문장 단위가 아닌 턴(turn) 단위로 합성
 * 2. SSML을 활용한 자연스러운 운율 제어
 * 3. 강조 단어, 속도, 휴지 적용
 * 4. 다양한 TTS 제공자 지원 (Google, OpenAI, ElevenLabs)
 */

import type {
  ITTSAdapter,
  TTSSynthesisRequest,
  TTSSynthesisResult,
  VoiceProfile,
  Pace,
  ScriptTurn
} from '../core/types'

// ============================================================================
// SSML Builder
// ============================================================================

interface SSMLOptions {
  text: string
  emphasisWords: string[]
  pace: Pace
  pauseMsBefore: number
  pauseMsAfter: number
  interjection?: {
    text: string
    position: 'start' | 'end'
  }
  laughCue?: boolean  // 웃음 큐는 TTS에서 제외
}

/**
 * SSML 마크업 생성
 */
function buildSSML(options: SSMLOptions, provider: VoiceProfile['provider']): string {
  const { text, emphasisWords, pace, pauseMsBefore, pauseMsAfter, interjection, laughCue } = options

  // 웃음 큐 제거 (오디오로 처리)
  let processedText = text.replace(/\(피식\)|\(웃음\)|\(잠깐 웃음\)|\(웃참 실패\)/g, '')

  // 강조 단어 마크업 추가
  for (const word of emphasisWords) {
    const emphasis = provider === 'google'
      ? `<emphasis level="strong">${word}</emphasis>`
      : word  // 다른 제공자는 단순 텍스트
    processedText = processedText.replace(new RegExp(word, 'g'), emphasis)
  }

  // 속도 설정
  const rateMap: Record<Pace, string> = {
    slow: '0.9',
    normal: '1.0',
    fast: '1.1'
  }
  const rate = rateMap[pace]

  // SSML 구조 생성
  let ssml = '<speak>'

  // 시작 전 휴지
  if (pauseMsBefore > 0) {
    ssml += `<break time="${pauseMsBefore}ms"/>`
  }

  // 감탄사가 시작 위치면 먼저 추가
  if (interjection && interjection.position === 'start') {
    ssml += `${interjection.text} <break time="100ms"/>`
  }

  // 메인 텍스트 (속도 적용)
  if (provider === 'google') {
    ssml += `<prosody rate="${rate}">${processedText}</prosody>`
  } else {
    ssml += processedText
  }

  // 감탄사가 끝 위치면 마지막에 추가
  if (interjection && interjection.position === 'end') {
    ssml += `<break time="100ms"/> ${interjection.text}`
  }

  // 끝 휴지
  if (pauseMsAfter > 0) {
    ssml += `<break time="${pauseMsAfter}ms"/>`
  }

  ssml += '</speak>'

  return ssml
}

// ============================================================================
// Provider Implementations
// ============================================================================

/**
 * Google Cloud Text-to-Speech 어댑터
 * Neural2 보이스 사용 권장
 */
class GoogleTTSProvider {
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_TTS_API_KEY || ''
  }

  async synthesize(request: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const startTime = Date.now()

    // SSML 생성
    const ssml = buildSSML({
      text: request.text,
      emphasisWords: request.emphasisWords,
      pace: request.pace,
      pauseMsBefore: request.pauseMsBefore,
      pauseMsAfter: request.pauseMsAfter
    }, 'google')

    // Google TTS API 호출
    const response = await this.callGoogleTTS(ssml, request.voice)

    return {
      turnId: request.turnId,
      audioBuffer: response.audioContent,
      durationMs: response.durationMs,
      format: request.outputFormat,
      sampleRate: request.sampleRate,
      synthesisLog: {
        provider: 'google',
        voiceId: request.voice.voiceId,
        requestTimeMs: Date.now() - startTime,
        lexiconHits: [],
        retries: 0,
        warnings: []
      }
    }
  }

  private async callGoogleTTS(
    ssml: string,
    voice: VoiceProfile
  ): Promise<{ audioContent: Buffer; durationMs: number }> {
    // Google Cloud TTS API 호출
    // 실제 구현에서는 @google-cloud/text-to-speech 패키지 사용
    const requestBody = {
      input: { ssml },
      voice: {
        languageCode: voice.language,
        name: voice.voiceId,  // e.g., 'ko-KR-Neural2-C'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: voice.speakingRate,
        pitch: voice.pitchOffset,
        sampleRateHertz: 24000
      }
    }

    // 개발 모드: 더미 응답
    if (!this.apiKey || process.env.NODE_ENV === 'development') {
      console.log('[GoogleTTS] Development mode - returning dummy audio')
      const dummyDuration = this.estimateDuration(ssml)
      return {
        audioContent: Buffer.from('dummy-audio-data'),
        durationMs: dummyDuration
      }
    }

    try {
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      )

      if (!response.ok) {
        throw new Error(`Google TTS API error: ${response.status}`)
      }

      const data = await response.json()
      const audioContent = Buffer.from(data.audioContent, 'base64')

      // 대략적인 duration 계산 (실제로는 오디오 분석 필요)
      const durationMs = this.estimateDuration(ssml)

      return { audioContent, durationMs }
    } catch (error) {
      console.error('[GoogleTTS] API call failed:', error)
      throw error
    }
  }

  private estimateDuration(text: string): number {
    // SSML 태그 제거 후 텍스트 길이로 추정
    const plainText = text.replace(/<[^>]+>/g, '')
    const charCount = plainText.replace(/\s/g, '').length
    // 한국어: 분당 약 300자 → 초당 5자
    return (charCount / 5) * 1000
  }
}

/**
 * OpenAI TTS 어댑터
 */
class OpenAITTSProvider {
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || ''
  }

  async synthesize(request: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const startTime = Date.now()

    // OpenAI는 SSML을 지원하지 않으므로 일반 텍스트 사용
    let text = request.text

    // 감탄사 추가 (SSML 없이)
    // OpenAI TTS는 자연스러운 억양을 잘 처리함

    // OpenAI TTS API 호출
    const response = await this.callOpenAITTS(text, request.voice)

    return {
      turnId: request.turnId,
      audioBuffer: response.audioContent,
      durationMs: response.durationMs,
      format: request.outputFormat,
      sampleRate: request.sampleRate,
      synthesisLog: {
        provider: 'openai',
        voiceId: request.voice.voiceId,
        requestTimeMs: Date.now() - startTime,
        lexiconHits: [],
        retries: 0,
        warnings: []
      }
    }
  }

  private async callOpenAITTS(
    text: string,
    voice: VoiceProfile
  ): Promise<{ audioContent: Buffer; durationMs: number }> {
    const voiceMap: Record<string, string> = {
      'male-calm': 'onyx',
      'female-energetic': 'nova',
      'male-neutral': 'echo',
      'female-neutral': 'alloy'
    }

    const openaiVoice = voiceMap[voice.role] || 'alloy'

    // 개발 모드: 더미 응답
    if (!this.apiKey || process.env.NODE_ENV === 'development') {
      console.log('[OpenAI TTS] Development mode - returning dummy audio')
      const dummyDuration = (text.replace(/\s/g, '').length / 5) * 1000
      return {
        audioContent: Buffer.from('dummy-audio-data'),
        durationMs: dummyDuration
      }
    }

    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1-hd',
          input: text,
          voice: openaiVoice,
          response_format: 'mp3',
          speed: voice.speakingRate
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI TTS API error: ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const audioContent = Buffer.from(arrayBuffer)
      const durationMs = (text.replace(/\s/g, '').length / 5) * 1000

      return { audioContent, durationMs }
    } catch (error) {
      console.error('[OpenAI TTS] API call failed:', error)
      throw error
    }
  }
}

/**
 * ElevenLabs TTS 어댑터
 */
class ElevenLabsTTSProvider {
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ELEVENLABS_API_KEY || ''
  }

  async synthesize(request: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const startTime = Date.now()

    const response = await this.callElevenLabsTTS(request.text, request.voice)

    return {
      turnId: request.turnId,
      audioBuffer: response.audioContent,
      durationMs: response.durationMs,
      format: request.outputFormat,
      sampleRate: request.sampleRate,
      synthesisLog: {
        provider: 'elevenlabs',
        voiceId: request.voice.voiceId,
        requestTimeMs: Date.now() - startTime,
        lexiconHits: [],
        retries: 0,
        warnings: []
      }
    }
  }

  private async callElevenLabsTTS(
    text: string,
    voice: VoiceProfile
  ): Promise<{ audioContent: Buffer; durationMs: number }> {
    // 개발 모드: 더미 응답
    if (!this.apiKey || process.env.NODE_ENV === 'development') {
      console.log('[ElevenLabs] Development mode - returning dummy audio')
      const dummyDuration = (text.replace(/\s/g, '').length / 5) * 1000
      return {
        audioContent: Buffer.from('dummy-audio-data'),
        durationMs: dummyDuration
      }
    }

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.3,
              use_speaker_boost: true
            }
          })
        }
      )

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const audioContent = Buffer.from(arrayBuffer)
      const durationMs = (text.replace(/\s/g, '').length / 5) * 1000

      return { audioContent, durationMs }
    } catch (error) {
      console.error('[ElevenLabs] API call failed:', error)
      throw error
    }
  }
}

// ============================================================================
// Main TTS Adapter
// ============================================================================

export class TTSAdapter implements ITTSAdapter {
  private provider: VoiceProfile['provider']
  private googleProvider: GoogleTTSProvider
  private openaiProvider: OpenAITTSProvider
  private elevenLabsProvider: ElevenLabsTTSProvider

  constructor(defaultProvider: VoiceProfile['provider'] = 'google') {
    this.provider = defaultProvider
    this.googleProvider = new GoogleTTSProvider()
    this.openaiProvider = new OpenAITTSProvider()
    this.elevenLabsProvider = new ElevenLabsTTSProvider()
  }

  /**
   * 턴 단위 음성 합성
   */
  async synthesizeTurn(request: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const provider = request.voice.provider

    switch (provider) {
      case 'google':
        return this.googleProvider.synthesize(request)
      case 'openai':
        return this.openaiProvider.synthesize(request)
      case 'elevenlabs':
        return this.elevenLabsProvider.synthesize(request)
      default:
        throw new Error(`Unsupported TTS provider: ${provider}`)
    }
  }

  /**
   * 현재 제공자 이름 반환
   */
  getProviderName(): string {
    return this.provider
  }

  /**
   * 텍스트 길이 기반 duration 추정
   */
  estimateDuration(text: string, pace: Pace): number {
    const charCount = text.replace(/\s/g, '').length
    const charsPerSecond = pace === 'slow' ? 4 : pace === 'fast' ? 6 : 5
    return (charCount / charsPerSecond) * 1000  // milliseconds
  }

  /**
   * ScriptTurn에서 TTSSynthesisRequest 생성
   */
  createRequestFromTurn(
    turn: ScriptTurn,
    voice: VoiceProfile
  ): TTSSynthesisRequest {
    return {
      turnId: turn.id,
      text: turn.normalizedText || turn.rawText,
      ssml: turn.ssml,
      voice,
      pauseMsBefore: turn.pauseMsBefore,
      pauseMsAfter: turn.pauseMsAfter,
      emphasisWords: turn.emphasisWords,
      pace: turn.pace,
      outputFormat: 'mp3',
      sampleRate: 24000
    }
  }

  /**
   * 배치 합성 (여러 턴 동시 처리)
   */
  async synthesizeBatch(
    requests: TTSSynthesisRequest[],
    concurrency: number = 3
  ): Promise<TTSSynthesisResult[]> {
    const results: TTSSynthesisResult[] = []

    // 동시 처리 제한
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency)
      const batchResults = await Promise.all(
        batch.map(req => this.synthesizeTurn(req))
      )
      results.push(...batchResults)
    }

    return results
  }
}

// ============================================================================
// Export
// ============================================================================

export default TTSAdapter
export { buildSSML, GoogleTTSProvider, OpenAITTSProvider, ElevenLabsTTSProvider }
