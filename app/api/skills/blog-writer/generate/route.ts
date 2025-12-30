import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

/**
 * AI 블로그 글 생성 API
 *
 * 1. 키워드로 네이버/구글에서 상위 3개 글 수집
 * 2. AI가 분석하여 SEO 최적화된 글 작성
 */

interface GenerateRequest {
  keyword: string
  platform: 'tistory' | 'naver'
  collectTop3?: boolean
}

// 네이버 블로그 검색 (상위 3개 글 수집)
async function collectTopPosts(keyword: string): Promise<string[]> {
  const naverClientId = process.env.NAVER_CLIENT_ID
  const naverClientSecret = process.env.NAVER_CLIENT_SECRET

  if (!naverClientId || !naverClientSecret) {
    console.warn('[BlogWriter] Naver API credentials not found, skipping collection')
    return []
  }

  try {
    const response = await fetch(
      `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=3&sort=sim`,
      {
        headers: {
          'X-Naver-Client-Id': naverClientId,
          'X-Naver-Client-Secret': naverClientSecret,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Naver API error: ${response.status}`)
    }

    const data = await response.json()
    const posts: string[] = []

    for (const item of data.items || []) {
      // HTML 태그 제거
      const title = item.title?.replace(/<[^>]*>/g, '') || ''
      const description = item.description?.replace(/<[^>]*>/g, '') || ''
      posts.push(`제목: ${title}\n내용: ${description}`)
    }

    return posts
  } catch (error) {
    console.error('[BlogWriter] Error collecting top posts:', error)
    return []
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: GenerateRequest = await request.json()
    const { keyword, platform, collectTop3 = true } = body

    if (!keyword?.trim()) {
      return NextResponse.json(
        { error: '키워드가 필요합니다.' },
        { status: 400 }
      )
    }

    console.log('[BlogWriter] Generating blog post:', { keyword, platform, collectTop3 })

    // 상위 글 수집
    let topPostsContext = ''
    if (collectTop3) {
      const topPosts = await collectTopPosts(keyword)
      if (topPosts.length > 0) {
        topPostsContext = `
아래는 "${keyword}" 키워드로 상위 노출된 블로그 글들입니다. 이 글들의 구조와 내용을 참고하되, 완전히 새로운 글을 작성해주세요:

---
${topPosts.join('\n\n---\n\n')}
---
`
      }
    }

    // AI로 글 생성
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const systemPrompt = platform === 'naver'
      ? `당신은 네이버 블로그 SEO 전문가입니다.
네이버 검색 알고리즘에 최적화된 블로그 글을 작성합니다.
- 자연스러운 키워드 배치 (첫 문단, 중간, 끝)
- 소제목 활용 (##)
- 이모지 적절히 사용
- 개인적인 경험담 스타일로 작성
- 3000자 이상 분량`
      : `당신은 티스토리 블로그 SEO 전문가입니다.
구글 검색 알고리즘에 최적화된 블로그 글을 작성합니다.
- H2, H3 태그 활용
- 키워드 밀도 2-3% 유지
- 메타 설명용 첫 문단 작성
- 정보성 위주로 작성
- 3000자 이상 분량`

    const userPrompt = `"${keyword}" 키워드로 블로그 글을 작성해주세요.

${topPostsContext}

다음 형식으로 응답해주세요:
TITLE: (클릭율 높은 매력적인 제목)
TAGS: (쉼표로 구분된 관련 태그 5-10개)
CONTENT:
(본문 내용 - 마크다운 형식)`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 4000,
      temperature: 0.8,
    })

    const content = response.choices[0]?.message?.content || ''

    // 응답 파싱
    const titleMatch = content.match(/TITLE:\s*(.+?)(?=\nTAGS:|$)/s)
    const tagsMatch = content.match(/TAGS:\s*(.+?)(?=\nCONTENT:|$)/s)
    const contentMatch = content.match(/CONTENT:\s*([\s\S]+)$/)

    const title = titleMatch?.[1]?.trim() || `${keyword} 완벽 가이드`
    const tags = tagsMatch?.[1]?.split(',').map(t => t.trim()).filter(Boolean) || [keyword]
    const blogContent = contentMatch?.[1]?.trim() || content

    console.log('[BlogWriter] Generated successfully:', {
      titleLength: title.length,
      tagsCount: tags.length,
      contentLength: blogContent.length
    })

    return NextResponse.json({
      success: true,
      title,
      tags,
      content: blogContent,
      platform,
      keyword,
    })

  } catch (error: any) {
    console.error('[BlogWriter] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate blog post' },
      { status: 500 }
    )
  }
}
