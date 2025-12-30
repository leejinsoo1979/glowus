import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

/**
 * AI 자동 댓글 API (SSE)
 *
 * 서로이웃의 최근 글을 방문하여 AI가 댓글 작성
 * ⚠️ 실제 댓글 작성은 브라우저 자동화 필요
 *    현재는 블로그 수집 + AI 댓글 생성 + 시뮬레이션으로 구현
 */

interface AutoCommentRequest {
  count: number
  credentials?: {
    username?: string
    password?: string
    blogId?: string
    sessionCookie?: string
  }
}

interface CommentTask {
  blogId: string
  blogName: string
  postTitle: string
  postUrl: string
  comment: string
  status: 'pending' | 'completed' | 'failed'
  completedAt?: Date
}

// 최근 블로그 글 수집 (네이버 블로그 RSS 또는 검색 API 사용)
async function getRecentBlogPosts(
  clientId: string,
  clientSecret: string,
  count: number
): Promise<Array<{ blogId: string; blogName: string; title: string; link: string; description: string }>> {
  const posts: Array<{ blogId: string; blogName: string; title: string; link: string; description: string }> = []

  // 인기 키워드로 최근 글 검색
  const popularKeywords = ['일상', '맛집', '여행', '육아', '요리', '독서', '운동', '취미']

  try {
    for (const keyword of popularKeywords) {
      if (posts.length >= count) break

      const response = await fetch(
        `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=5&sort=date`,
        {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret,
          },
        }
      )

      if (!response.ok) continue

      const data = await response.json()

      for (const item of data.items || []) {
        const blogUrlMatch = item.bloggerlink?.match(/blog\.naver\.com\/([^\/\?]+)/)
        if (blogUrlMatch) {
          posts.push({
            blogId: blogUrlMatch[1],
            blogName: item.bloggername?.replace(/<[^>]*>/g, '') || blogUrlMatch[1],
            title: item.title?.replace(/<[^>]*>/g, '') || '제목 없음',
            link: item.link || '',
            description: item.description?.replace(/<[^>]*>/g, '') || '',
          })
        }

        if (posts.length >= count) break
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  } catch (error) {
    console.error('[BlogWriter] Error getting recent posts:', error)
  }

  return posts
}

// AI 댓글 생성
async function generateComment(postTitle: string, postDescription: string): Promise<string> {
  try {
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 친근하고 진심어린 블로그 댓글을 작성하는 전문가입니다.
다음 규칙을 따르세요:
- 글 내용과 관련된 진심어린 공감 표현
- 자연스럽고 친근한 말투 (반말 또는 존댓말 적절히)
- 과하지 않은 이모티콘 사용 (1-2개)
- 50-100자 내외로 간결하게
- 스팸처럼 보이지 않게
- 질문이나 공감으로 마무리`,
        },
        {
          role: 'user',
          content: `다음 블로그 글에 달 댓글을 작성해주세요:

제목: ${postTitle}
내용 요약: ${postDescription}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.9,
    })

    return response.choices[0]?.message?.content || '좋은 글 잘 봤습니다! :)'
  } catch (error) {
    console.error('[BlogWriter] Error generating comment:', error)
    // 폴백 댓글
    const fallbackComments = [
      '좋은 글 잘 봤어요! 공감하고 갑니다 :)',
      '오늘도 좋은 글 감사합니다! 구독하고 가요~',
      '유익한 정보네요! 잘 읽었습니다 ^^',
      '공감되는 글이에요! 저도 비슷한 경험이 있어서 더 와닿네요',
      '좋은 하루 되세요! 글 잘 보고 갑니다 :D',
    ]
    return fallbackComments[Math.floor(Math.random() * fallbackComments.length)]
  }
}

// 실제 댓글 작성은 브라우저 자동화 필요
async function simulatePostComment(
  postUrl: string,
  comment: string
): Promise<{ success: boolean; error?: string }> {
  // 실제 구현 시 Playwright로 처리:
  // 1. 네이버 로그인
  // 2. 해당 포스트 방문
  // 3. 댓글 입력창 찾기
  // 4. 댓글 입력 및 전송

  // 시뮬레이션: 85% 성공
  const success = Math.random() > 0.15
  return {
    success,
    error: success ? undefined : '댓글 작성 실패 (비공개 글 또는 댓글 불가)',
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // 인증 확인
  let user: any = isDevMode() ? DEV_USER : null
  if (!user) {
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body: AutoCommentRequest = await request.json()
  const { count = 30, credentials } = body

  // API 키 확인
  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: '네이버 API 설정이 필요합니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  console.log('[BlogWriter] Starting auto comment:', { count })

  // SSE 스트림 생성
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 최근 블로그 글 수집
        const posts = await getRecentBlogPosts(clientId, clientSecret, count)

        if (posts.length === 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: '블로그 글을 찾을 수 없습니다.' })}\n\n`)
          )
          controller.close()
          return
        }

        let completedCount = 0

        for (let i = 0; i < posts.length; i++) {
          const post = posts[i]

          // AI 댓글 생성
          const comment = await generateComment(post.title, post.description)

          // 댓글 작성 시도
          const result = await simulatePostComment(post.link, comment)

          const task: CommentTask = {
            blogId: post.blogId,
            blogName: post.blogName,
            postTitle: post.title,
            postUrl: post.link,
            comment,
            status: result.success ? 'completed' : 'failed',
            completedAt: result.success ? new Date() : undefined,
          }

          if (result.success) {
            completedCount++
          }

          // 진행률 전송
          const progress = Math.round(((i + 1) / posts.length) * 100)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              progress,
              completed: completedCount,
              task,
            })}\n\n`)
          )

          // Rate limiting (스팸 방지)
          await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 5000))
        }

        // 완료 이벤트
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            complete: true,
            total: posts.length,
            completed: completedCount,
          })}\n\n`)
        )

        controller.close()
      } catch (error: any) {
        console.error('[BlogWriter] Auto comment error:', error)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
