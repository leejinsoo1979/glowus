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

// Raw PCM을 WAV로 변환 (Gemini TTS용)
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

// SSE 진행률 메시지 헬퍼
function createProgressEvent(data: {
  stage: 'script' | 'tts' | 'combining' | 'complete' | 'error'
  progress: number // 0-100
  current?: number
  total?: number
  message: string
  speaker?: string
}) {
  return `data: ${JSON.stringify(data)}\n\n`
}

interface Source {
  id: string
  type: 'pdf' | 'web' | 'youtube' | 'text'
  title: string
  content?: string
  summary?: string
}

interface DialogueLine {
  speaker: 'Host' | 'Guest'
  text: string
  voiceName: 'Puck' | 'Kore'  // Puck=남성(민수), Kore=여성(지은)
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

  // 연속 공백 정리
  result = result.replace(/\s+/g, ' ')
  result = result.trim()

  return result
}

// WAV 오디오 결합 함수 (여러 WAV 파일을 하나로)
function combineWavBuffers(buffers: Buffer[], sampleRate: number = 24000): Buffer {
  // 0.3초 무음 (샘플당 2바이트 * 24000Hz * 0.3초)
  const silenceLength = Math.floor(sampleRate * 0.3) * 2
  const silenceBuffer = Buffer.alloc(silenceLength, 0)

  // 각 WAV에서 PCM 데이터 추출
  const pcmDataList: Buffer[] = []
  for (let i = 0; i < buffers.length; i++) {
    const buf = buffers[i]
    // WAV 헤더 크기는 보통 44바이트
    const pcmData = buf.slice(44)
    pcmDataList.push(pcmData)
    if (i < buffers.length - 1) {
      pcmDataList.push(silenceBuffer)  // 대사 사이에 무음 추가
    }
  }

  // 전체 PCM 데이터 결합
  const totalPcmLength = pcmDataList.reduce((sum, buf) => sum + buf.length, 0)
  const combinedPcm = Buffer.concat(pcmDataList)

  // 새 WAV 헤더 생성
  const headerSize = 44
  const wavBuffer = Buffer.alloc(headerSize + totalPcmLength)

  // RIFF header
  wavBuffer.write('RIFF', 0)
  wavBuffer.writeUInt32LE(headerSize + totalPcmLength - 8, 4)
  wavBuffer.write('WAVE', 8)

  // fmt chunk
  wavBuffer.write('fmt ', 12)
  wavBuffer.writeUInt32LE(16, 16)
  wavBuffer.writeUInt16LE(1, 20)  // PCM
  wavBuffer.writeUInt16LE(1, 22)  // mono
  wavBuffer.writeUInt32LE(sampleRate, 24)
  wavBuffer.writeUInt32LE(sampleRate * 2, 28)  // byte rate
  wavBuffer.writeUInt16LE(2, 32)  // block align
  wavBuffer.writeUInt16LE(16, 34)  // bits per sample

  // data chunk
  wavBuffer.write('data', 36)
  wavBuffer.writeUInt32LE(totalPcmLength, 40)
  combinedPcm.copy(wavBuffer, 44)

  return wavBuffer
}

// Gemini 2.5 Flash TTS로 음성 생성
async function synthesizeWithGeminiTTS(
  text: string,
  voiceName: 'Puck' | 'Kore'
): Promise<Buffer> {
  const normalizedText = normalizeTextForTTS(text)
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
    return pcmToWav(pcmBuffer, 24000, 1, 16)
  }

  throw new Error('Gemini TTS: 오디오 데이터 없음')
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

export async function POST(req: Request) {
  try {
    const { sources } = await req.json() as { sources: Source[] }

    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ error: '소스가 필요합니다' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // SSE 스트림 생성 - ReadableStream 직접 사용
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const client = getGeminiClient()

          // 진행률: 대본 생성 시작 (0-10%)
          controller.enqueue(encoder.encode(createProgressEvent({
            stage: 'script',
            progress: 5,
            message: '대본 생성 중...'
          })))

          // Build context from sources
          const sourceContext = sources.map((s, i) => {
            const content = s.content || s.summary || ''
            return `[소스 ${i + 1}: ${s.title}]\n${content.slice(0, 5000)}`
          }).join('\n\n---\n\n')

          // Generate podcast script with [Host] and [Guest] format
          console.log('[Podcast] Generating script with Gemini...')
          const scriptModel = client.getGenerativeModel({
            model: 'gemini-2.0-flash',
            generationConfig: {
              temperature: 0.85,
              maxOutputTokens: 8192
            }
          })

          const scriptPrompt = `당신은 인기 팟캐스트 "테크 톡톡"의 대본 작가입니다. 진짜 사람들이 대화하는 것처럼 생동감 넘치는 대본을 작성하세요.

## 자료
${sourceContext}

## 화자 캐릭터
- **Host (민수)**: 열정적인 남성 진행자. 주제에 대한 애정이 넘침. 설명할 때 신나서 말이 빨라지기도 하고, 중요한 부분에서는 천천히 강조함
- **Guest (지은)**: 호기심 많은 여성 청취자 대변인. 놀라움, 궁금증, 공감을 적극적으로 표현. 때로는 살짝 엉뚱한 질문도 던짐

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

## 형식 (반드시 준수!)
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

          // 진행률: 대본 생성 완료 (10%)
          controller.enqueue(encoder.encode(createProgressEvent({
            stage: 'script',
            progress: 10,
            message: '대본 생성 완료! 음성 변환 준비 중...'
          })))

          // Parse script into dialogue lines
          const dialogueLines: DialogueLine[] = []
          const lines = script.split('\n')
          for (const line of lines) {
            const hostMatch = line.match(/^\[Host\]\s*(.+)$/i)
            const guestMatch = line.match(/^\[Guest\]\s*(.+)$/i)

            if (hostMatch) {
              dialogueLines.push({
                speaker: 'Host',
                text: hostMatch[1].trim(),
                voiceName: 'Puck'  // 민수 = Puck (남성)
              })
            } else if (guestMatch) {
              dialogueLines.push({
                speaker: 'Guest',
                text: guestMatch[1].trim(),
                voiceName: 'Kore'  // 지은 = Kore (여성)
              })
            }
          }

          console.log(`[Podcast] Parsed ${dialogueLines.length} dialogue lines`)

          if (dialogueLines.length === 0) {
            controller.enqueue(encoder.encode(createProgressEvent({
              stage: 'error',
              progress: 100,
              message: '대사 파싱에 실패했습니다.'
            })))
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              stage: 'complete',
              success: true,
              title: '테크 톡톡',
              transcript: script,
              audioUrl: null,
              message: '대사 파싱에 실패했습니다.'
            })}\n\n`))
            controller.close()
            return
          }

          // Generate audio for each line with Gemini TTS (순차 처리)
          console.log(`[Podcast] Generating audio with Gemini TTS (${dialogueLines.length} lines)...`)

          const audioBuffers: Buffer[] = []
          const totalLines = dialogueLines.length

          for (let i = 0; i < dialogueLines.length; i++) {
            const line = dialogueLines[i]
            const speakerName = line.speaker === 'Host' ? '민수' : '지은'

            // TTS 진행률 (10% ~ 90%)
            const ttsProgress = 10 + Math.round((i / totalLines) * 80)

            controller.enqueue(encoder.encode(createProgressEvent({
              stage: 'tts',
              progress: ttsProgress,
              current: i + 1,
              total: totalLines,
              speaker: speakerName,
              message: `${speakerName} 대사 ${i + 1}/${totalLines} 음성 변환 중...`
            })))

            console.log(`[TTS] (${i + 1}/${dialogueLines.length}) ${line.speaker} [${line.voiceName}]: ${line.text.slice(0, 30)}...`)

            try {
              const audioBuffer = await synthesizeWithGeminiTTS(line.text, line.voiceName)
              audioBuffers.push(audioBuffer)
            } catch (error) {
              console.error(`[TTS] Failed for line ${i + 1}:`, error)
              // 실패해도 계속 진행
            }
          }

          const validBuffers = audioBuffers

          if (validBuffers.length === 0) {
            console.error('[Podcast] No audio generated')
            controller.enqueue(encoder.encode(createProgressEvent({
              stage: 'error',
              progress: 100,
              message: 'TTS 서버에 연결할 수 없습니다.'
            })))
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              stage: 'complete',
              success: true,
              title: '테크 톡톡',
              transcript: script,
              dialogueLines: dialogueLines.map(d => ({
                speaker: d.speaker === 'Host' ? '민수' : '지은',
                text: d.text
              })),
              audioUrl: null,
              message: 'TTS 생성에 실패했습니다. API 키를 확인하세요.'
            })}\n\n`))
            controller.close()
            return
          }

          // 진행률: 오디오 결합 중 (90-95%)
          controller.enqueue(encoder.encode(createProgressEvent({
            stage: 'combining',
            progress: 92,
            message: '오디오 파일 결합 중...'
          })))

          // Combine all audio buffers
          console.log(`[Podcast] Combining ${validBuffers.length} audio segments...`)
          const combinedWav = combineWavBuffers(validBuffers, 24000)

          const base64Audio = combinedWav.toString('base64')
          const audioUrl = `data:audio/wav;base64,${base64Audio}`

          // Calculate duration
          const durationSeconds = getWavDuration(combinedWav)
          const minutes = Math.floor(durationSeconds / 60)
          const seconds = durationSeconds % 60
          const duration = minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`

          console.log(`[Podcast] Complete! Duration: ${duration}, Size: ${Math.round(combinedWav.length / 1024)}KB`)

          // 진행률: 완료 (100%)
          controller.enqueue(encoder.encode(createProgressEvent({
            stage: 'complete',
            progress: 100,
            message: '팟캐스트 생성 완료!'
          })))

          // 최종 결과 전송
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            stage: 'complete',
            success: true,
            title: '테크 톡톡',
            audioUrl,
            duration,
            transcript: script,
            dialogueLines: dialogueLines.map(d => ({
              speaker: d.speaker === 'Host' ? '민수' : '지은',
              text: d.text
            })),
            audioSizeKB: Math.round(combinedWav.length / 1024)
          })}\n\n`))

          controller.close()
        } catch (error) {
          console.error('Podcast generation error:', error)
          controller.enqueue(encoder.encode(createProgressEvent({
            stage: 'error',
            progress: 100,
            message: '팟캐스트 생성 중 오류가 발생했습니다.'
          })))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Podcast generation error:', error)
    return new Response(
      JSON.stringify({ error: '팟캐스트 생성 중 오류가 발생했습니다' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
