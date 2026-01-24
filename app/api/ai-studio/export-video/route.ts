import { NextResponse } from 'next/server'

/**
 * 비디오 내보내기 API
 *
 * 실제 MP4 생성은 클라이언트 사이드에서 Canvas + MediaRecorder를 사용해야 합니다.
 * 이 API는 내보내기 메타데이터와 설정을 처리합니다.
 *
 * 클라이언트에서:
 * 1. Canvas에 슬라이드 이미지 렌더링
 * 2. AudioContext로 TTS 오디오 스트림 생성
 * 3. MediaRecorder로 Canvas + Audio 합성
 * 4. WebM/MP4 Blob 생성
 */

export interface ExportVideoRequest {
  slides: {
    number: number
    title: string
    imageUrl?: string
    audioUrl?: string
    duration?: number // ms
  }[]
  options?: {
    resolution?: '720p' | '1080p' | '4k'
    fps?: 24 | 30 | 60
    format?: 'webm' | 'mp4'
  }
}

export interface ExportVideoResponse {
  success: boolean
  config: {
    width: number
    height: number
    fps: number
    format: string
    totalDuration: number
    slideCount: number
  }
  error?: string
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as ExportVideoRequest

    if (!body.slides || body.slides.length === 0) {
      return NextResponse.json(
        { success: false, error: '슬라이드가 필요합니다' },
        { status: 400 }
      )
    }

    const options = body.options || {}
    const resolution = options.resolution || '1080p'
    const fps = options.fps || 30
    const format = options.format || 'webm'

    // 해상도 설정
    const resolutions = {
      '720p': { width: 1280, height: 720 },
      '1080p': { width: 1920, height: 1080 },
      '4k': { width: 3840, height: 2160 }
    }

    const { width, height } = resolutions[resolution]

    // 총 재생 시간 계산 (각 슬라이드 기본 5초)
    const totalDuration = body.slides.reduce((sum, slide) => {
      return sum + (slide.duration || 5000)
    }, 0)

    console.log(`[ExportVideo] Preparing export: ${body.slides.length} slides, ${resolution}, ${fps}fps, ${format}`)

    return NextResponse.json({
      success: true,
      config: {
        width,
        height,
        fps,
        format,
        totalDuration,
        slideCount: body.slides.length
      }
    } as ExportVideoResponse)

  } catch (error) {
    console.error('[ExportVideo] Error:', error)
    return NextResponse.json(
      { success: false, error: '내보내기 설정 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
