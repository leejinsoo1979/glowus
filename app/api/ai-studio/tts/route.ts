import { NextResponse } from 'next/server'

function getTTSApiKey(): string {
  const key = process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_API_KEY
  if (!key) {
    throw new Error('GOOGLE_TTS_API_KEY is not configured')
  }
  return key
}

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

  // 약어 변환 (TTS 발음 최적화)
  const abbreviations: Record<string, string> = {
    'AI': '에이아이',
    'API': '에이피아이',
    'LLM': '엘엘엠',
    'GPT': '지피티',
    'IR': '아이알',
    'CEO': '씨이오',
    'CTO': '씨티오',
    'B2B': '비투비',
    'B2C': '비투씨',
    'MVP': '엠브이피',
    'KPI': '케이피아이',
    'ROI': '알오아이',
    'VC': '브이씨',
    'IPO': '아이피오',
    'SaaS': '사스',
    'ESG': '이에스지',
    'R&D': '알앤디',
  }

  for (const [abbr, reading] of Object.entries(abbreviations)) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'g')
    result = result.replace(regex, reading)
  }

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

    const ttsApiKey = getTTSApiKey()

    // 텍스트 정규화
    const normalizedText = normalizeTextForTTS(text)

    // 음성 선택 (기본: 남성) - Neural2가 가장 자연스러움
    const voiceConfig = voice === 'female'
      ? { name: 'ko-KR-Neural2-A', languageCode: 'ko-KR' }  // 여성: Neural2-A (가장 자연스러움)
      : { name: 'ko-KR-Neural2-C', languageCode: 'ko-KR' }  // 남성: Neural2-C (가장 자연스러움)

    // SSML 개선: 자연스러운 쉼과 억양 추가
    let ssmlText = normalizedText
    // 쉼표에서 짧은 쉼 추가
    ssmlText = ssmlText.replace(/,\s*/g, ', <break time="200ms"/>')
    // 물음표 후 쉼
    ssmlText = ssmlText.replace(/\?\s*/g, '? <break time="400ms"/>')
    // 느낌표 후 쉼
    ssmlText = ssmlText.replace(/!\s*/g, '! <break time="300ms"/>')
    // 마침표 후 쉼
    ssmlText = ssmlText.replace(/\.\s*/g, '. <break time="350ms"/>')

    const ssml = `<speak>${ssmlText}</speak>`

    console.log(`[TTS] Generating audio for: ${normalizedText.slice(0, 50)}...`)

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${ttsApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: { ssml },
          voice: {
            languageCode: voiceConfig.languageCode,
            name: voiceConfig.name
          },
          audioConfig: {
            audioEncoding: 'MP3',
            pitch: 0,
            speakingRate: 1.0,
            effectsProfileId: ['large-home-entertainment-class-device']
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('TTS API error:', error)
      return NextResponse.json({ error: 'TTS API 오류가 발생했습니다' }, { status: 500 })
    }

    const data = await response.json()
    const audioContent = data.audioContent

    // Base64 오디오를 data URL로 반환
    const audioUrl = `data:audio/mp3;base64,${audioContent}`

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
