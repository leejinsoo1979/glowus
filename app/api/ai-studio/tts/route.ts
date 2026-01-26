import { NextResponse } from 'next/server'

// Qwen3-TTS 서버 URL (로컬 Python 서버)
const QWEN_TTS_SERVER_URL = process.env.QWEN_TTS_SERVER_URL || 'http://localhost:8100'

// 텍스트 정규화 함수
function normalizeTextForTTS(text: string): string {
  let result = text

  // 마크다운 기호 제거
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1')  // bold
  result = result.replace(/\*([^*]+)\*/g, '$1')      // italic
  result = result.replace(/__([^_]+)__/g, '$1')
  result = result.replace(/_([^_]+)_/g, '$1')
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // links
  result = result.replace(/^#{1,6}\s*/gm, '')        // headers
  result = result.replace(/^\s*[-*+]\s+/gm, '')      // lists
  result = result.replace(/^\s*\d+\.\s+/gm, '')      // numbered lists
  result = result.replace(/```[^`]*```/g, '')        // code blocks
  result = result.replace(/`([^`]+)`/g, '$1')        // inline code
  result = result.replace(/[#*_~`|]/g, '')           // symbols

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

    // 텍스트 정규화
    const normalizedText = normalizeTextForTTS(text)

    // 음성 선택 (기본: 여성 Sohee)
    // Qwen3-TTS 스피커: Sohee(여성), Vivian, Serena, Ryan(남성), Aiden, Ono_Anna
    const speaker = voice === 'male' ? 'Ryan' : 'Sohee'

    console.log(`[TTS] Qwen3-TTS 요청: ${normalizedText.slice(0, 50)}... (speaker: ${speaker})`)

    // Qwen3-TTS 서버로 요청
    const response = await fetch(`${QWEN_TTS_SERVER_URL}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: normalizedText,
        speaker,
        language: 'Korean',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[TTS] Qwen3-TTS 서버 오류:', errorText)
      return NextResponse.json({ error: 'TTS 서버 오류가 발생했습니다' }, { status: 500 })
    }

    // WAV 바이너리 → Base64 data URL
    const audioBuffer = await response.arrayBuffer()
    const base64Audio = Buffer.from(audioBuffer).toString('base64')
    const audioUrl = `data:audio/wav;base64,${base64Audio}`

    console.log(`[TTS] Qwen3-TTS 완료, 크기: ${audioBuffer.byteLength} bytes`)

    return NextResponse.json({
      success: true,
      audioUrl
    })
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
  try {
    const response = await fetch(`${QWEN_TTS_SERVER_URL}/health`)
    const data = await response.json()

    return NextResponse.json({
      status: response.ok ? 'healthy' : 'unhealthy',
      provider: 'qwen3-tts',
      server_url: QWEN_TTS_SERVER_URL,
      ...data
    })
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      provider: 'qwen3-tts',
      server_url: QWEN_TTS_SERVER_URL,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
