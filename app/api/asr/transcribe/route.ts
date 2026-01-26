import { NextRequest, NextResponse } from 'next/server'

// VibeVoice-ASR Gradio API URL
const GRADIO_API_URL = process.env.VIBEVOICE_GRADIO_URL || 'https://dd66e23bd8ab778987.gradio.live'

interface TranscriptionSegment {
  speaker: string
  start: number
  end: number
  text: string
}

interface TranscriptionResult {
  raw_text: string
  segments: TranscriptionSegment[]
  srt_content: string
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    const customTerms = formData.get('customTerms') as string | null

    if (!audioFile) {
      return NextResponse.json(
        { error: '오디오 파일이 필요합니다' },
        { status: 400 }
      )
    }

    // 파일 크기 체크 (50MB 제한)
    if (audioFile.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: '파일 크기는 50MB를 초과할 수 없습니다' },
        { status: 400 }
      )
    }

    // Gradio API로 전송할 FormData 생성
    const gradioFormData = new FormData()
    gradioFormData.append('files', audioFile)

    // 1단계: 파일 업로드
    const uploadResponse = await fetch(`${GRADIO_API_URL}/upload`, {
      method: 'POST',
      body: gradioFormData,
    })

    if (!uploadResponse.ok) {
      throw new Error('파일 업로드 실패')
    }

    const uploadResult = await uploadResponse.json()
    const filePath = uploadResult[0] // 업로드된 파일 경로

    // 2단계: 트랜스크립션 요청
    const predictPayload = {
      data: [
        { path: filePath }, // 오디오 파일
        customTerms || '', // Custom terms
        false, // Enable sampling
        0.7, // Temperature
        0.9, // Top-p
        8192, // Max new tokens
      ],
      fn_index: 0,
      session_hash: generateSessionHash(),
    }

    const predictResponse = await fetch(`${GRADIO_API_URL}/api/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(predictPayload),
    })

    if (!predictResponse.ok) {
      const errorText = await predictResponse.text()
      console.error('Gradio API error:', errorText)
      throw new Error('트랜스크립션 처리 실패')
    }

    const result = await predictResponse.json()

    // 결과 파싱
    const transcriptionResult = parseGradioResult(result)

    return NextResponse.json({
      success: true,
      ...transcriptionResult,
    })

  } catch (error) {
    console.error('ASR transcription error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '트랜스크립션 처리 중 오류가 발생했습니다',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

function generateSessionHash(): string {
  return Math.random().toString(36).substring(2, 15)
}

function parseGradioResult(result: any): TranscriptionResult {
  // Gradio 응답 형식에 따라 파싱
  // result.data는 [raw_output, audio_segments, video_with_subtitles, srt_file] 형태
  const data = result.data || []

  const rawText = data[0] || ''

  // 세그먼트 파싱 (화자 분리 포함)
  const segments: TranscriptionSegment[] = []

  // Raw text에서 화자 정보와 타임스탬프 추출
  // 형식: [Speaker X] (00:00:00 - 00:00:10): 텍스트
  const segmentPattern = /\[([^\]]+)\]\s*\((\d{2}:\d{2}:\d{2})\s*-\s*(\d{2}:\d{2}:\d{2})\):\s*(.+)/g
  let match

  while ((match = segmentPattern.exec(rawText)) !== null) {
    const [, speaker, startTime, endTime, text] = match
    segments.push({
      speaker: speaker.trim(),
      start: timeToSeconds(startTime),
      end: timeToSeconds(endTime),
      text: text.trim(),
    })
  }

  // SRT 파일 내용 생성
  const srtContent = generateSRT(segments)

  return {
    raw_text: rawText,
    segments,
    srt_content: srtContent,
  }
}

function timeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number)
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return 0
}

function secondsToSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

function generateSRT(segments: TranscriptionSegment[]): string {
  return segments.map((segment, index) => {
    return `${index + 1}
${secondsToSRTTime(segment.start)} --> ${secondsToSRTTime(segment.end)}
[${segment.speaker}] ${segment.text}
`
  }).join('\n')
}

// 헬스 체크 엔드포인트
export async function GET() {
  try {
    const response = await fetch(`${GRADIO_API_URL}/api/predict`, {
      method: 'GET',
    })

    return NextResponse.json({
      status: 'healthy',
      gradio_url: GRADIO_API_URL,
      gradio_available: response.ok,
    })
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      gradio_url: GRADIO_API_URL,
      gradio_available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
