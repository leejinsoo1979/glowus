export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'

// Google AI 클라이언트 생성
const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY,
})

const YOUTUBE_API_KEY = process.env.GOOGLE_API_KEY
const SUPADATA_API_KEY = process.env.SUPADATA_API_KEY

// 타임스탬프 포맷팅
function formatTimestamp(seconds: number): string {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    if (hrs > 0) {
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// YouTube Data API로 영상 정보 가져오기
async function getVideoInfo(videoId: string) {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`
        )
        const data = await response.json()

        if (data.items && data.items.length > 0) {
            const item = data.items[0]
            const snippet = item.snippet
            const stats = item.statistics

            return {
                id: videoId,
                title: snippet.title,
                channel: snippet.channelTitle,
                thumbnail: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                date: new Date(snippet.publishedAt).toLocaleDateString('ko-KR'),
                views: parseInt(stats.viewCount).toLocaleString() + '회',
                likes: stats.likeCount ? parseInt(stats.likeCount).toLocaleString() : '',
                description: snippet.description || '',
            }
        }
    } catch (error) {
        console.error('Failed to fetch video info:', error)
    }

    return {
        id: videoId,
        title: '영상 제목을 불러올 수 없습니다',
        channel: '',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        date: '',
        views: '',
        likes: '',
        description: '',
    }
}

// YouTube Data API로 댓글 가져오기
async function getComments(videoId: string, maxResults: number = 20) {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=${maxResults}&order=relevance&key=${YOUTUBE_API_KEY}`
        )
        const data = await response.json()

        // API 오류 체크
        if (data.error) {
            console.error('YouTube Comments API Error:', data.error.message)
            // 댓글이 비활성화된 영상이거나 API 제한
            if (data.error.code === 403) {
                console.log('Comments API disabled or quota exceeded')
            }
            return []
        }

        if (data.items && data.items.length > 0) {
            return data.items.map((item: any) => {
                const comment = item.snippet.topLevelComment.snippet
                return {
                    id: item.id,
                    author: comment.authorDisplayName,
                    authorImage: comment.authorProfileImageUrl,
                    text: comment.textDisplay,
                    likes: comment.likeCount,
                    date: new Date(comment.publishedAt).toLocaleDateString('ko-KR'),
                }
            })
        }
    } catch (error) {
        console.error('Failed to fetch comments:', error)
    }
    return []
}

// YouTube Data API로 자막 목록 가져오기
async function getCaptionsList(videoId: string) {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}`
        )
        const data = await response.json()
        return data.items || []
    } catch (error) {
        console.error('Failed to fetch captions list:', error)
        return []
    }
}

// 자막 XML 파싱
function parseTranscriptXml(xml: string): { start: number; text: string }[] {
    const results: { start: number; text: string }[] = []
    const regex = /<text start="([^"]+)"[^>]*>([^<]*)<\/text>/g
    let match

    while ((match = regex.exec(xml)) !== null) {
        const start = parseFloat(match[1])
        let text = match[2]
        // HTML 엔티티 디코딩
        text = text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n/g, ' ')
            .trim()

        if (text) {
            results.push({ start, text })
        }
    }

    return results
}

// JSON 객체를 괄호 매칭으로 추출
function extractJsonObject(str: string, startIndex: number): string | null {
    let depth = 0
    let start = -1

    for (let i = startIndex; i < str.length; i++) {
        if (str[i] === '{') {
            if (depth === 0) start = i
            depth++
        } else if (str[i] === '}') {
            depth--
            if (depth === 0 && start !== -1) {
                return str.slice(start, i + 1)
            }
        }
    }
    return null
}

// Supadata API로 자막 가져오기 (프록시 서비스 - Vercel에서 작동)
async function fetchTranscriptWithSupadata(videoId: string): Promise<{ start: number; text: string }[]> {
    if (!SUPADATA_API_KEY) {
        console.log('SUPADATA_API_KEY not set, skipping Supadata')
        return []
    }

    try {
        console.log('Trying Supadata API...')
        const url = `https://api.supadata.ai/v1/youtube/transcript?url=https://www.youtube.com/watch?v=${videoId}&lang=ko`

        const response = await fetch(url, {
            headers: {
                'x-api-key': SUPADATA_API_KEY,
            },
        })

        if (response.status === 401) {
            console.error('Supadata API key is invalid')
            return []
        }

        if (!response.ok) {
            console.error('Supadata API error:', response.status)
            return []
        }

        const data = await response.json()

        if (!data.content || data.content.length === 0) {
            console.log('No transcript content from Supadata')
            return []
        }

        const results: { start: number; text: string }[] = []

        for (const item of data.content) {
            const start = (item.offset || 0) / 1000 // ms to seconds
            const text = (item.text || '').trim()

            if (text) {
                results.push({ start, text })
            }
        }

        console.log(`✓ Supadata API returned ${results.length} transcript items`)
        return results

    } catch (error) {
        console.error('Supadata API error:', error)
        return []
    }
}

// YouTube 페이지에서 자막 URL 추출 (로컬용 - Vercel에서는 차단됨)
async function fetchTranscript(videoId: string): Promise<{ start: number; text: string }[]> {
    try {
        // 1. 영상 페이지 가져오기
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
        const response = await fetch(watchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            }
        })

        if (!response.ok) {
            console.error('Failed to fetch video page:', response.status)
            return []
        }

        const html = await response.text()

        // 2. ytInitialPlayerResponse에서 자막 정보 추출 (괄호 매칭 사용)
        const playerResponseIndex = html.indexOf('ytInitialPlayerResponse')
        if (playerResponseIndex === -1) {
            console.error('Could not find ytInitialPlayerResponse')
            return []
        }

        const equalIndex = html.indexOf('=', playerResponseIndex)
        if (equalIndex === -1) {
            console.error('Could not find = after ytInitialPlayerResponse')
            return []
        }

        const jsonStr = extractJsonObject(html, equalIndex + 1)
        if (!jsonStr) {
            console.error('Could not extract JSON object')
            return []
        }

        let playerResponse
        try {
            playerResponse = JSON.parse(jsonStr)
        } catch (e) {
            console.error('Failed to parse player response:', e)
            return []
        }

        // 3. 자막 트랙 찾기
        const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks
        if (!captions || captions.length === 0) {
            console.log('No captions available for this video')
            console.log('Available keys:', Object.keys(playerResponse || {}))
            return []
        }

        console.log(`Found ${captions.length} caption tracks`)

        // 4. 한국어 > 영어 > 첫번째 자막 순으로 선택
        let selectedCaption = captions.find((c: any) => c.languageCode === 'ko')
        if (!selectedCaption) {
            selectedCaption = captions.find((c: any) => c.languageCode === 'en')
        }
        if (!selectedCaption) {
            selectedCaption = captions[0]
        }

        console.log(`Selected caption: ${selectedCaption.languageCode} - ${selectedCaption.name?.simpleText || 'auto'}`)

        // 5. 자막 데이터 가져오기 (XML 형식)
        let captionUrl = selectedCaption.baseUrl
        console.log('Caption URL:', captionUrl.slice(0, 300))

        const captionResponse = await fetch(captionUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
            }
        })

        if (!captionResponse.ok) {
            console.error('Failed to fetch caption data:', captionResponse.status, captionResponse.statusText)
            return []
        }

        const captionData = await captionResponse.text()
        console.log('Caption data length:', captionData.length)
        console.log('Caption data sample:', captionData.slice(0, 500))

        // 6. 데이터 파싱
        const results: { start: number; text: string }[] = []

        // XML 형식: <text start="..." dur="...">내용</text>
        if (captionData.includes('<text')) {
            const regex = /<text[^>]*start="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g
            let match

            while ((match = regex.exec(captionData)) !== null) {
                const start = parseFloat(match[1])
                let text = match[2]
                text = text
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&nbsp;/g, ' ')
                    .replace(/<[^>]+>/g, '')
                    .replace(/\n/g, ' ')
                    .trim()

                if (text) {
                    results.push({ start, text })
                }
            }
        }

        // JSON3 형식
        if (results.length === 0 && captionData.trim().startsWith('{')) {
            try {
                const jsonData = JSON.parse(captionData)
                if (jsonData.events) {
                    for (const event of jsonData.events) {
                        if (event.segs) {
                            const text = event.segs.map((s: any) => s.utf8 || '').join('').trim()
                            if (text) {
                                results.push({
                                    start: (event.tStartMs || 0) / 1000,
                                    text
                                })
                            }
                        }
                    }
                }
            } catch (e) {
                console.log('Not JSON format:', e)
            }
        }

        console.log(`✓ Transcript fetched: ${results.length} items`)
        return results

    } catch (error) {
        console.error('Error fetching transcript:', error)
        return []
    }
}

// AI로 요약 생성
async function generateSummary(transcript: string, videoTitle: string) {
    const prompt = `당신은 유튜브 영상 분석 전문가입니다. 스크립트를 꼼꼼히 읽고 상세한 타임라인과 요약을 작성하세요.

영상 제목: ${videoTitle}

스크립트:
${transcript.slice(0, 20000)}

다음 JSON 형식으로 응답하세요 (마크다운 코드블록 없이 순수 JSON만):

{
    "threeLine": [
        "핵심 메시지 1: 영상에서 가장 중요한 주장이나 정보를 구체적으로 (예: 특정 수치, 사례, 인용문 포함)",
        "핵심 메시지 2: 두 번째로 중요한 내용을 구체적으로",
        "핵심 메시지 3: 세 번째로 중요한 내용을 구체적으로"
    ],
    "keyPoints": [
        "💡 [주제] 구체적인 인사이트 (예시나 수치 포함)",
        "💡 [주제] 구체적인 인사이트",
        "💡 [주제] 구체적인 인사이트",
        "💡 [주제] 구체적인 인사이트",
        "💡 [주제] 구체적인 인사이트",
        "💡 [주제] 구체적인 인사이트",
        "💡 [주제] 구체적인 인사이트"
    ],
    "tableOfContents": [
        "1. 첫 번째 대주제",
        "2. 두 번째 대주제",
        "3. 세 번째 대주제",
        "4. 네 번째 대주제",
        "5. 다섯 번째 대주제"
    ],
    "timeline": [
        {
            "title": "🎬 인트로: [구체적인 도입부 내용]",
            "timestamp": "00:00",
            "content": "이 섹션에서 다루는 내용을 3-5문장으로 상세히 설명. 발화자가 말한 핵심 내용, 예시, 주장을 구체적으로 포함.",
            "details": [
                "• 첫 번째 세부 포인트: 구체적인 내용이나 예시",
                "• 두 번째 세부 포인트: 언급된 수치나 사례",
                "• 세 번째 세부 포인트: 핵심 인용이나 주장",
                "• 네 번째 세부 포인트: 추가 정보"
            ]
        }
    ],
    "blogPost": "영상 내용을 바탕으로 한 상세 블로그 글 (2000자 이상). 독자가 영상을 안 봐도 될 정도로 상세히 작성."
}

⚠️ 타임라인 작성 규칙:
1. 최소 6-10개 섹션으로 나누세요
2. title은 이모지 + 구체적인 제목
3. content는 3-5문장으로 해당 구간의 핵심 내용을 상세히 설명
4. details는 4-6개의 구체적인 포인트

📝 전체 작성 규칙:
- 모든 내용은 한국어로 작성
- 추상적인 표현 금지, 구체적인 정보만 작성
- keyPoints는 7-10개의 핵심 인사이트
- blogPost는 2000자 이상, 독자가 영상을 안 봐도 될 정도로 상세히`

    try {
        const { text } = await generateText({
            model: google('gemini-2.0-flash-exp'),
            prompt,
        })

        // JSON 추출
        let jsonStr = text.trim()
        // 코드 블록 제거
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```(?:json)?\n?/g, '').trim()
        }

        const summary = JSON.parse(jsonStr)
        return summary
    } catch (error) {
        console.error('Failed to generate summary:', error)
        return {
            threeLine: [
                '영상 요약을 생성하는 중 오류가 발생했습니다.',
                '잠시 후 다시 시도해주세요.',
                '',
            ],
            keyPoints: [],
            tableOfContents: ['요약 생성 실패'],
            timeline: [{
                title: '요약 생성 실패',
                timestamp: '00:00',
                content: 'AI 요약 생성 중 오류가 발생했습니다.',
                details: [],
            }],
            blogPost: '',
        }
    }
}

// Python 백엔드 호출
async function callPythonBackend(videoId: string) {
    try {
        const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8002'
        const response = await fetch(`${pythonBackendUrl}/api/youtube/transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: videoId, generate_summary: true }),
        })

        if (!response.ok) {
            return null
        }

        const data = await response.json()
        if (data.success) {
            return {
                videoInfo: data.videoInfo,
                transcript: data.transcript?.map((t: any) => ({
                    timestamp: t.timestamp,
                    text: t.text,
                })) || [],
                summary: data.summary,
            }
        }
        return null
    } catch (error) {
        console.log('Python backend not available, falling back to direct fetch')
        return null
    }
}

// MCP YouTube Transcript 도구 사용 (가장 신뢰할 수 있는 방법)
async function fetchTranscriptWithMCP(videoId: string): Promise<{ start: number; text: string }[]> {
    try {
        console.log('Trying MCP youtube-transcript...')
        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

        // 내부 스킬 API 호출
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const response = await fetch(`${baseUrl}/api/skills/youtube-transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: youtubeUrl, lang: 'ko' }),
        })

        if (!response.ok) {
            console.log('MCP skill API failed:', response.status)
            return []
        }

        const data = await response.json()

        if (data.success && data.transcript) {
            // 텍스트를 문장 단위로 분할하여 타임스탬프 추정
            const sentences = data.transcript.split(/[.!?]\s+/).filter((s: string) => s.trim())
            const results: { start: number; text: string }[] = []

            // 간단한 시간 추정 (문장당 약 5초)
            sentences.forEach((sentence: string, index: number) => {
                results.push({
                    start: index * 5,
                    text: sentence.trim(),
                })
            })

            console.log(`✓ MCP transcript fetched: ${results.length} items`)
            return results
        }

        return []
    } catch (error) {
        console.error('MCP transcript error:', error)
        return []
    }
}

export async function POST(request: Request) {
    try {
        const { videoId } = await request.json()

        if (!videoId) {
            return NextResponse.json(
                { error: '유효한 유튜브 링크를 입력해주세요' },
                { status: 400 }
            )
        }

        console.log(`Processing video: ${videoId}`)

        // 영상 정보와 댓글은 항상 YouTube Data API로 가져오기
        const [videoInfo, comments] = await Promise.all([
            getVideoInfo(videoId),
            getComments(videoId, 10)
        ])
        console.log(`Video info: ${videoInfo.title}, Comments: ${comments.length}`)

        // 1. Python 백엔드 시도 (yt-dlp 사용)
        const pythonResult = await callPythonBackend(videoId)
        if (pythonResult) {
            console.log('✓ Got result from Python backend')
            return NextResponse.json({
                ...pythonResult,
                videoInfo,  // YouTube Data API에서 가져온 정보로 덮어쓰기
                comments,
            })
        }

        // 2. MCP YouTube Transcript 시도 (가장 신뢰할 수 있음)
        console.log('Trying MCP youtube-transcript...')
        let transcriptItems = await fetchTranscriptWithMCP(videoId)

        // 3. Supadata API 시도 (Vercel에서 작동하는 프록시 서비스)
        if (transcriptItems.length === 0) {
            console.log('MCP failed, trying Supadata API...')
            transcriptItems = await fetchTranscriptWithSupadata(videoId)
        }

        // 4. Supadata 실패 시 직접 추출 시도 (로컬에서만 작동)
        if (transcriptItems.length === 0) {
            console.log('Supadata failed, falling back to direct extraction...')
            transcriptItems = await fetchTranscript(videoId)
        }

        if (transcriptItems.length === 0) {
            const errorMsg = SUPADATA_API_KEY
                ? '이 영상에서 자막을 가져올 수 없습니다. 자막이 없거나 비공개 영상입니다.'
                : '자막을 가져올 수 없습니다. SUPADATA_API_KEY를 설정하거나 로컬에서 실행하세요. (https://supadata.ai 무료 가입)'
            return NextResponse.json(
                { error: errorMsg },
                { status: 400 }
            )
        }

        // 스크립트 포맷팅
        const transcript = transcriptItems.map((item) => ({
            timestamp: formatTimestamp(item.start),
            text: item.text,
        }))

        const fullTranscript = transcriptItems.map((item) => item.text).join(' ')
        console.log(`Transcript length: ${fullTranscript.length} chars`)

        // AI 요약 생성
        const summary = await generateSummary(fullTranscript, videoInfo.title)

        return NextResponse.json({
            videoInfo,
            transcript,
            summary,
            comments,
        })
    } catch (error) {
        console.error('YouTube summarize error:', error)
        return NextResponse.json(
            { error: '요약 생성 중 오류가 발생했습니다' },
            { status: 500 }
        )
    }
}
