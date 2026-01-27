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

// Raw PCM을 WAV로 변환
function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000, channels: number = 1, bitsPerSample: number = 16): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8)
  const blockAlign = channels * (bitsPerSample / 8)
  const dataSize = pcmBuffer.length
  const headerSize = 44
  const fileSize = headerSize + dataSize - 8

  const wavBuffer = Buffer.alloc(headerSize + dataSize)

  wavBuffer.write('RIFF', 0)
  wavBuffer.writeUInt32LE(fileSize, 4)
  wavBuffer.write('WAVE', 8)
  wavBuffer.write('fmt ', 12)
  wavBuffer.writeUInt32LE(16, 16)
  wavBuffer.writeUInt16LE(1, 20)
  wavBuffer.writeUInt16LE(channels, 22)
  wavBuffer.writeUInt32LE(sampleRate, 24)
  wavBuffer.writeUInt32LE(byteRate, 28)
  wavBuffer.writeUInt16LE(blockAlign, 32)
  wavBuffer.writeUInt16LE(bitsPerSample, 34)
  wavBuffer.write('data', 36)
  wavBuffer.writeUInt32LE(dataSize, 40)
  pcmBuffer.copy(wavBuffer, 44)

  return wavBuffer
}

// 텍스트 정규화 함수
function normalizeTextForTTS(text: string): string {
  let result = text

  // 마크다운 기호 제거
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1')
  result = result.replace(/\*([^*]+)\*/g, '$1')
  result = result.replace(/__([^_]+)__/g, '$1')
  result = result.replace(/_([^_]+)_/g, '$1')
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  result = result.replace(/^#{1,6}\s*/gm, '')
  result = result.replace(/^\s*[-*+]\s+/gm, '')
  result = result.replace(/^\s*\d+\.\s+/gm, '')
  result = result.replace(/```[^`]*```/g, '')
  result = result.replace(/`([^`]+)`/g, '$1')
  result = result.replace(/[#*_~`|]/g, '')

  // URL 제거
  result = result.replace(/https?:\/\/[^\s]+/g, '')

  // 특수 기호 변환
  result = result.replace(/→/g, ' 에서 ')
  result = result.replace(/←/g, ' 로부터 ')
  result = result.replace(/↔/g, ' 양방향 ')
  result = result.replace(/\.\.\./g, ' ')
  result = result.replace(/…/g, ' ')

  // 연속 공백 정리
  result = result.replace(/\s+/g, ' ')
  result = result.trim()

  return result
}

export async function POST(req: Request) {
  try {
    const { text, voice } = await req.json() as {
      text: string
      voice?: 'male' | 'female'
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: '텍스트가 필요합니다' }, { status: 400 })
    }

    const normalizedText = normalizeTextForTTS(text)
    const voiceName = voice === 'male' ? 'Puck' : 'Kore'

    console.log(`[TTS] Gemini 2.5 TTS 요청: ${normalizedText.slice(0, 50)}... (voice: ${voiceName})`)

    const client = getGeminiClient()
    const ttsModel = client.getGenerativeModel({
      model: 'gemini-2.5-flash-preview-tts',
    })

    const response = await ttsModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: normalizedText }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      } as any
    })

    const audioData = response.response.candidates?.[0]?.content?.parts?.[0]
    if (audioData && 'inlineData' in audioData && audioData.inlineData?.data) {
      const pcmBuffer = Buffer.from(audioData.inlineData.data, 'base64')
      const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16)
      const audioUrl = `data:audio/wav;base64,${wavBuffer.toString('base64')}`

      console.log(`[TTS] Gemini TTS 완료, WAV 크기: ${wavBuffer.length} bytes`)

      return NextResponse.json({
        success: true,
        audioUrl
      })
    }

    return NextResponse.json({ error: 'TTS 생성 실패: 오디오 데이터 없음' }, { status: 500 })
  } catch (error) {
    console.error('TTS generation error:', error)
    return NextResponse.json(
      { error: 'TTS 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

// 헬스 체크
export async function GET() {
  const hasApiKey = !!process.env.GOOGLE_API_KEY

  return NextResponse.json({
    status: hasApiKey ? 'healthy' : 'unhealthy',
    provider: 'gemini-2.5-flash-tts',
    hasApiKey
  })
}
