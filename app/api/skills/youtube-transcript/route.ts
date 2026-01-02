/**
 * YouTube Transcript 스킬 API
 * YouTube 영상의 자막/스크립트를 가져옵니다
 * youtube-transcript npm 패키지 사용
 */

import { NextRequest, NextResponse } from 'next/server'
import { YoutubeTranscript } from 'youtube-transcript'

// YouTube URL에서 비디오 ID 추출
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

// YouTube transcript 가져오기 (youtube-transcript 패키지 사용)
async function fetchTranscript(videoId: string, lang: string = 'ko'): Promise<{
  success: boolean
  transcript?: string
  transcriptItems?: Array<{ offset: number; duration: number; text: string }>
  error?: string
}> {
  try {
    console.log(`[YouTubeTranscript] Fetching with youtube-transcript package for: ${videoId}`)

    // youtube-transcript 패키지로 자막 가져오기
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: lang,
    })

    if (transcriptItems && transcriptItems.length > 0) {
      // 전체 텍스트 결합
      const fullTranscript = transcriptItems
        .map(item => item.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      console.log(`[YouTubeTranscript] Successfully fetched ${transcriptItems.length} items`)

      return {
        success: true,
        transcript: fullTranscript,
        transcriptItems: transcriptItems.map(item => ({
          offset: item.offset,
          duration: item.duration,
          text: item.text,
        })),
      }
    }

    return {
      success: false,
      error: '자막을 찾을 수 없습니다',
    }
  } catch (error: any) {
    console.error('[YouTubeTranscript] Error:', error.message)

    // 영어로 다시 시도
    if (lang !== 'en') {
      try {
        console.log('[YouTubeTranscript] Trying English...')
        // 언어 옵션 없이 시도 (자동 선택)
        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId)

        if (transcriptItems && transcriptItems.length > 0) {
          const fullTranscript = transcriptItems
            .map(item => item.text)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()

          console.log(`[YouTubeTranscript] Got ${transcriptItems.length} items with auto-lang`)

          return {
            success: true,
            transcript: fullTranscript,
            transcriptItems: transcriptItems.map(item => ({
              offset: item.offset,
              duration: item.duration,
              text: item.text,
            })),
          }
        }
      } catch (enError: any) {
        console.error('[YouTubeTranscript] Auto-lang also failed:', enError.message)
      }
    }

    return {
      success: false,
      error: error.message || '트랜스크립트를 가져올 수 없습니다',
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url, videoId: providedVideoId, lang = 'ko' } = await request.json()

    // URL 또는 비디오 ID 필요
    const videoId = providedVideoId || (url ? extractVideoId(url) : null)

    if (!videoId) {
      return NextResponse.json(
        { success: false, error: 'YouTube URL 또는 비디오 ID가 필요합니다' },
        { status: 400 }
      )
    }

    console.log(`[YouTubeTranscript] Fetching transcript for: ${videoId}`)

    const result = await fetchTranscript(videoId, lang)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      videoId,
      transcript: result.transcript,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    })
  } catch (error: any) {
    console.error('[YouTubeTranscript] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '트랜스크립트 가져오기 실패' },
      { status: 500 }
    )
  }
}

// GET - 스킬 정보 조회
export async function GET() {
  return NextResponse.json({
    id: 'youtube-transcript',
    name: 'YouTube 트랜스크립트',
    description: 'YouTube 영상의 자막/스크립트를 가져옵니다',
    parameters: {
      url: { type: 'string', description: 'YouTube 영상 URL', required: false },
      videoId: { type: 'string', description: 'YouTube 비디오 ID', required: false },
      lang: { type: 'string', description: '언어 코드 (기본: ko)', required: false },
    },
  })
}
