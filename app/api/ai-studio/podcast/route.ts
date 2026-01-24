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

    const scriptPrompt = `당신은 인기 팟캐스트 "딥다이브"의 대본 작가입니다. 진짜 사람들이 대화하는 것처럼 생동감 넘치는 대본을 작성하세요.

## 자료
${sourceContext}

## 화자 캐릭터
- **Host**: 열정적인 진행자. 주제에 대한 애정이 넘침. 설명할 때 신나서 말이 빨라지기도 하고, 중요한 부분에서는 천천히 강조함
- **Guest**: 호기심 많은 청취자 대변인. 놀라움, 궁금증, 공감을 적극적으로 표현. 때로는 살짝 엉뚱한 질문도 던짐

## 자연스러운 대화를 위한 필수 요소

### 1. 호흡과 망설임 (매 대사에 1-2개 필수)
- "음..." "어..." "그러니까..." "뭐랄까..." "있잖아요,"
- "아, 맞다!" "어어, 잠깐만요," "그게요,"
- 문장 중간에 "," 로 호흡 표시

### 2. 감정 표현 (과장되게!)
- 놀람: "헐, 진짜요?!" "와, 대박..." "에이, 설마요!" "오오오!"
- 공감: "아~ 그렇죠그렇죠!" "맞아요맞아요!" "완전 그거예요!"
- 감탄: "우와..." "미쳤다..." "이게 진짜 되는 거예요?"
- 궁금: "근데요, 근데요!" "잠깐, 그러면요?" "아 그래서요?!"

### 3. 구어체 필수
- "~거든요" "~잖아요" "~인 거죠" "~라고요?"
- 문장 끝 늘이기: "그렇죠~" "맞아요~" "신기하네요~"
- 끊어 말하기: "이게, 진짜, 엄청난 건데요,"

### 4. 상호작용
- 끼어들기: "(아!) 그 얘기 들었어요!" "잠깐만요, 그게 뭐예요?"
- 맞장구: "응응" "네네" "아아~"
- 웃음: "ㅎㅎ" "하하" "(웃음)"

### 5. 리듬감 있는 진행
- 짧은 문장과 긴 문장 섞기
- 질문 후 바로 대답 말고, "음..." 하고 생각하는 척
- 가끔 말 겹치는 느낌: "그러니까-" "아 네네, 그러니까요!"

## 형식
[Host] 대사
[Guest] 대사

## 예시
[Host] 자, 오늘은요, 음... 진짜 재밌는 주제를 가져왔는데요,
[Guest] 오 뭔데요뭔데요? 되게 신나 보이시는데요? ㅎㅎ
[Host] 아 맞아요, 이거 진짜... 와, 어디서부터 얘기해야 될지 모르겠는데,
[Guest] 에이~ 그렇게 말씀하시면 더 궁금하잖아요!
[Host] 그쵸그쵸? 자, 일단요, 핵심만 먼저 말씀드리면요...

약 ${process.env.NODE_ENV === 'development' ? '8-10턴 (테스트용 짧은 버전)' : '20-30턴'}의 대화를 작성하세요. 정보 전달도 중요하지만, 듣는 사람이 "아 이 사람들 진짜 대화하고 있구나" 느낄 수 있게 해주세요!`

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
