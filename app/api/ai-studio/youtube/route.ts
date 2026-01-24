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

// YouTube transcript fetcher (using youtube-transcript alternative)
async function fetchYoutubeTranscript(videoId: string): Promise<{ text: string; start: number }[]> {
  try {
    // Try to get transcript using public API
    const response = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    )

    const html = await response.text()

    // Extract caption track URL
    const captionMatch = html.match(/"captionTracks":\[.*?"baseUrl":"([^"]+)"/)
    if (!captionMatch) {
      // Try timedtext API
      const timedTextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ko&fmt=json3`
      const ttResponse = await fetch(timedTextUrl)

      if (ttResponse.ok) {
        const data = await ttResponse.json()
        if (data.events) {
          return data.events
            .filter((e: { segs?: { utf8?: string }[] }) => e.segs)
            .map((e: { segs: { utf8: string }[]; tStartMs: number }) => ({
              text: e.segs.map((s: { utf8: string }) => s.utf8).join(''),
              start: e.tStartMs / 1000
            }))
        }
      }

      // Try English if Korean not available
      const timedTextUrlEn = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`
      const ttResponseEn = await fetch(timedTextUrlEn)

      if (ttResponseEn.ok) {
        const data = await ttResponseEn.json()
        if (data.events) {
          return data.events
            .filter((e: { segs?: { utf8?: string }[] }) => e.segs)
            .map((e: { segs: { utf8: string }[]; tStartMs: number }) => ({
              text: e.segs.map((s: { utf8: string }) => s.utf8).join(''),
              start: e.tStartMs / 1000
            }))
        }
      }

      throw new Error('자막을 찾을 수 없습니다')
    }

    const captionUrl = captionMatch[1].replace(/\\u0026/g, '&')
    const captionResponse = await fetch(captionUrl)
    const captionXml = await captionResponse.text()

    // Parse XML transcript
    const textMatches = captionXml.matchAll(/<text start="([^"]+)"[^>]*>([^<]*)<\/text>/g)
    const transcript: { text: string; start: number }[] = []

    for (const match of textMatches) {
      transcript.push({
        start: parseFloat(match[1]),
        text: match[2]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
      })
    }

    return transcript
  } catch (error) {
    console.error('Transcript fetch error:', error)
    throw error
  }
}

// Fetch video info
async function fetchVideoInfo(videoId: string) {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`)
    const html = await response.text()

    const titleMatch = html.match(/<title>([^<]+)<\/title>/)
    const title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : 'YouTube 영상'

    const durationMatch = html.match(/"lengthSeconds":"(\d+)"/)
    const duration = durationMatch ? parseInt(durationMatch[1]) : 0
    const durationStr = duration > 0
      ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`
      : ''

    return { title, duration: durationStr }
  } catch {
    return { title: 'YouTube 영상', duration: '' }
  }
}

export async function POST(req: Request) {
  try {
    const { url, videoId } = await req.json()

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID가 필요합니다' }, { status: 400 })
    }

    // Fetch video info and transcript in parallel
    const [videoInfo, transcript] = await Promise.all([
      fetchVideoInfo(videoId),
      fetchYoutubeTranscript(videoId).catch(() => null)
    ])

    let transcriptText = ''
    if (transcript && transcript.length > 0) {
      transcriptText = transcript.map(t => t.text).join(' ')
    }

    // Use Gemini to summarize if transcript available
    let summary = ''
    if (transcriptText) {
      const client = getGeminiClient()
      const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const result = await model.generateContent(`
다음 YouTube 영상의 자막을 분석하고 요약해주세요:

제목: ${videoInfo.title}
URL: ${url}

자막 내용:
${transcriptText.slice(0, 30000)}

다음 형식으로 응답해주세요:
1. 핵심 요약 (2-3문장)
2. 주요 포인트 (3-5개)
`)
      summary = (await result.response.text()).slice(0, 500)
    } else {
      summary = '자막을 불러올 수 없어 요약을 생성할 수 없습니다. 영상 정보만 저장되었습니다.'
    }

    return NextResponse.json({
      success: true,
      title: videoInfo.title,
      duration: videoInfo.duration,
      transcript: transcriptText,
      summary,
      url
    })
  } catch (error) {
    console.error('YouTube processing error:', error)
    return NextResponse.json(
      { error: 'YouTube 영상 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
