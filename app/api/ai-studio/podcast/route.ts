import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Lazy initialization
let genAI: GoogleGenerativeAI | null = null

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is not configured')
    }
    genAI = new GoogleGenerativeAI(apiKey)
  }
  return genAI
}

interface Source {
  id: string
  type: 'pdf' | 'web' | 'youtube' | 'text'
  title: string
  content?: string
  summary?: string
}

// Raw PCM을 WAV로 변환 (Gemini TTS는 audio/L16 PCM을 반환)
function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000, channels: number = 1, bitsPerSample: number = 16): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8)
  const blockAlign = channels * (bitsPerSample / 8)
  const dataSize = pcmBuffer.length
  const headerSize = 44
  const fileSize = headerSize + dataSize - 8

  const wavBuffer = Buffer.alloc(headerSize + dataSize)

  // RIFF header
  wavBuffer.write('RIFF', 0)
  wavBuffer.writeUInt32LE(fileSize, 4)
  wavBuffer.write('WAVE', 8)

  // fmt chunk
  wavBuffer.write('fmt ', 12)
  wavBuffer.writeUInt32LE(16, 16) // fmt chunk size
  wavBuffer.writeUInt16LE(1, 20) // PCM format
  wavBuffer.writeUInt16LE(channels, 22)
  wavBuffer.writeUInt32LE(sampleRate, 24)
  wavBuffer.writeUInt32LE(byteRate, 28)
  wavBuffer.writeUInt16LE(blockAlign, 32)
  wavBuffer.writeUInt16LE(bitsPerSample, 34)

  // data chunk
  wavBuffer.write('data', 36)
  wavBuffer.writeUInt32LE(dataSize, 40)
  pcmBuffer.copy(wavBuffer, 44)

  return wavBuffer
}

// WAV 파일에서 재생 시간 계산
function getWavDuration(buffer: Buffer): number {
  try {
    const byteRate = buffer.readUInt32LE(28)
    const dataSize = buffer.length - 44
    return Math.round(dataSize / byteRate)
  } catch {
    return Math.round((buffer.length - 44) / (24000 * 2))
  }
}

// Gemini 2.5 TTS Multi-Speaker
async function synthesizeWithGeminiTTS(
  script: string,
  client: GoogleGenerativeAI
): Promise<Buffer> {
  console.log('[TTS] Using Gemini 2.5 Flash TTS Multi-Speaker')

  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash-preview-tts',
  })

  const response = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: script }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            {
              speaker: 'Host',
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' }
              }
            },
            {
              speaker: 'Guest',
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Puck' }
              }
            }
          ]
        }
      }
    } as any
  })

  const audioData = response.response.candidates?.[0]?.content?.parts?.[0]
  if (audioData && 'inlineData' in audioData && audioData.inlineData?.data) {
    console.log('[TTS] Gemini TTS success')
    return Buffer.from(audioData.inlineData.data, 'base64')
  }

  throw new Error('No audio data in response')
}

export async function POST(req: Request) {
  try {
    const { sources } = await req.json() as { sources: Source[] }

    if (!sources || sources.length === 0) {
      return NextResponse.json({ error: '소스가 필요합니다' }, { status: 400 })
    }

    const client = getGeminiClient()

    // Build context from sources
    const sourceContext = sources.map((s, i) => {
      const content = s.content || s.summary || ''
      return `[소스 ${i + 1}: ${s.title}]\n${content.slice(0, 5000)}`
    }).join('\n\n---\n\n')

    // Generate podcast script
    console.log('[Podcast] Generating script...')
    const scriptModel = client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 8192
      }
    })

    const scriptPrompt = `당신은 팟캐스트 대본 작가입니다. 다음 자료를 바탕으로 Host와 Guest 두 사람이 대화하는 팟캐스트 대본을 작성하세요.

## 자료
${sourceContext}

## 화자 설정
- **Host (진행자)**: 전문적이고 차분한 진행, 핵심 내용 설명
- **Guest (게스트)**: 청취자 입장에서 질문하고 리액션

## 말투 규칙
- 존댓말 사용: "~요", "~죠", "~네요"
- 자연스러운 추임새: "음...", "아~", "그러니까"
- 리액션: "정말요?", "오 그렇군요!", "흥미롭네요"

## 형식
[Host] 대사
[Guest] 대사

약 20-30턴의 자연스러운 대화를 작성하세요.`

    const scriptResult = await scriptModel.generateContent(scriptPrompt)
    const script = scriptResult.response.text()

    console.log('[Podcast] Script generated, length:', script.length)

    // Generate audio with Gemini 2.5 TTS
    console.log('[Podcast] Generating audio with Gemini 2.5 TTS...')

    let pcmBuffer: Buffer
    try {
      pcmBuffer = await synthesizeWithGeminiTTS(script, client)
    } catch (ttsError) {
      console.error('[Podcast] TTS failed:', ttsError)
      return NextResponse.json({
        success: true,
        title: '소스 기반 팟캐스트',
        transcript: script,
        audioUrl: null,
        message: '오디오 생성에 실패했지만 대본은 생성되었습니다.'
      })
    }

    // Gemini TTS는 raw PCM (audio/L16;codec=pcm;rate=24000)을 반환
    // 브라우저에서 재생하려면 WAV로 변환 필요
    console.log('[Podcast] Converting PCM to WAV, PCM size:', pcmBuffer.length)
    const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16)
    console.log('[Podcast] WAV size:', wavBuffer.length)

    const base64Audio = wavBuffer.toString('base64')
    const audioUrl = `data:audio/wav;base64,${base64Audio}`

    // WAV에서 정확한 재생 시간 계산
    const durationSeconds = getWavDuration(wavBuffer)
    const minutes = Math.floor(durationSeconds / 60)
    const seconds = durationSeconds % 60
    const duration = minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`

    console.log('[Podcast] Complete! Duration:', duration)

    return NextResponse.json({
      success: true,
      title: '소스 기반 팟캐스트',
      audioUrl,
      duration,
      transcript: script,
      audioSizeKB: Math.round(wavBuffer.length / 1024)
    })
  } catch (error) {
    console.error('Podcast generation error:', error)
    return NextResponse.json(
      { error: '팟캐스트 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
