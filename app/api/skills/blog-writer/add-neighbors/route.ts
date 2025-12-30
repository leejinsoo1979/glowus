import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

/**
 * 서로이웃 자동 추가 API (SSE)
 *
 * 키워드로 블로그를 검색하여 서로이웃 신청
 * ⚠️ 네이버 블로그 서로이웃 신청은 공식 API가 없어
 *    실제로는 Playwright/Puppeteer 등 브라우저 자동화 필요
 *    현재는 블로그 목록 수집 + 시뮬레이션으로 구현
 */

interface AddNeighborsRequest {
  keyword: string
  message: string
  count: number
  credentials?: {
    username?: string
    password?: string
    blogId?: string
    sessionCookie?: string
  }
}

interface NeighborBlog {
  blogId: string
  blogName: string
  lastPost: string
  addedAt?: Date
  status: 'pending' | 'added' | 'failed'
}

// 네이버 블로그 검색으로 블로거 목록 수집
async function findBloggers(
  keyword: string,
  count: number,
  clientId: string,
  clientSecret: string
): Promise<Array<{ blogId: string; blogName: string; lastPost: string }>> {
  const bloggers: Array<{ blogId: string; blogName: string; lastPost: string }> = []

  try {
    // 여러 번 검색해서 블로거 수집
    const pageCount = Math.ceil(count / 10)

    for (let page = 1; page <= pageCount && bloggers.length < count; page++) {
      const response = await fetch(
        `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=10&start=${(page - 1) * 10 + 1}&sort=date`,
        {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret,
          },
        }
      )

      if (!response.ok) break

      const data = await response.json()

      for (const item of data.items || []) {
        // 블로그 URL에서 블로거 ID 추출
        const blogUrlMatch = item.bloggerlink?.match(/blog\.naver\.com\/([^\/\?]+)/)
        if (blogUrlMatch) {
          const blogId = blogUrlMatch[1]

          // 중복 제거
          if (!bloggers.find(b => b.blogId === blogId)) {
            bloggers.push({
              blogId,
              blogName: item.bloggername?.replace(/<[^>]*>/g, '') || blogId,
              lastPost: item.title?.replace(/<[^>]*>/g, '') || '최근 글',
            })
          }
        }

        if (bloggers.length >= count) break
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  } catch (error) {
    console.error('[BlogWriter] Error finding bloggers:', error)
  }

  return bloggers
}

// 실제 이웃 추가는 브라우저 자동화가 필요
// 여기서는 시뮬레이션으로 처리
async function simulateAddNeighbor(
  blogId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  // 실제 구현 시 Playwright로 처리:
  // 1. 네이버 로그인
  // 2. 해당 블로그 방문
  // 3. 서로이웃 신청 버튼 클릭
  // 4. 메시지 입력 및 전송

  // 시뮬레이션: 80% 성공, 20% 실패
  const success = Math.random() > 0.2
  return {
    success,
    error: success ? undefined : '일일 한도 초과 또는 이미 이웃',
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

  const body: AddNeighborsRequest = await request.json()
  const { keyword, message, count = 100, credentials } = body

  if (!keyword?.trim()) {
    return new Response(JSON.stringify({ error: '키워드가 필요합니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // API 키 확인
  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: '네이버 API 설정이 필요합니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  console.log('[BlogWriter] Adding neighbors:', { keyword, count })

  // SSE 스트림 생성
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 블로거 목록 수집
        const bloggers = await findBloggers(keyword.trim(), count, clientId, clientSecret)

        if (bloggers.length === 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: '블로거를 찾을 수 없습니다.' })}\n\n`)
          )
          controller.close()
          return
        }

        let dailyCount = 0

        for (let i = 0; i < bloggers.length; i++) {
          const blogger = bloggers[i]

          // 일일 한도 체크 (100명)
          if (dailyCount >= 100) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                progress: Math.round(((i + 1) / bloggers.length) * 100),
                dailyCount,
                limitReached: true,
              })}\n\n`)
            )
            break
          }

          // 이웃 추가 시도
          const result = await simulateAddNeighbor(blogger.blogId, message)

          const neighbor: NeighborBlog = {
            blogId: blogger.blogId,
            blogName: blogger.blogName,
            lastPost: blogger.lastPost,
            status: result.success ? 'added' : 'failed',
            addedAt: result.success ? new Date() : undefined,
          }

          if (result.success) {
            dailyCount++
          }

          // 진행률 전송
          const progress = Math.round(((i + 1) / bloggers.length) * 100)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              progress,
              dailyCount,
              neighbor,
            })}\n\n`)
          )

          // Rate limiting (네이버 제한 방지)
          await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000))
        }

        // 완료 이벤트
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            complete: true,
            total: bloggers.length,
            added: dailyCount,
          })}\n\n`)
        )

        controller.close()
      } catch (error: any) {
        console.error('[BlogWriter] Neighbor automation error:', error)
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
