import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

/**
 * 황금 키워드 채굴 API (SSE)
 *
 * 네이버 API를 사용하여 키워드 검색량과 경쟁률 분석
 * - 검색량 데이터: 네이버 검색광고 API (또는 대안)
 * - 문서 수: 네이버 블로그 검색 API
 */

interface MineKeywordsRequest {
  seedKeyword: string
  count: number
  credentials?: {
    apiClientId?: string
    apiClientSecret?: string
  }
}

interface KeywordData {
  keyword: string
  pcSearch: number
  mobileSearch: number
  totalSearch: number
  docCount: number
  competition: number
  isGolden: boolean
}

// 연관 키워드 생성 (시드 키워드 기반)
function generateRelatedKeywords(seed: string, count: number): string[] {
  const prefixes = ['', '추천', '가격', '비교', '후기', '장단점', '꿀팁', '무료', '인기', '순위']
  const suffixes = ['', '추천', '방법', '종류', '가격', '비용', '리뷰', '팁', '정보', '순위']
  const years = ['2024', '2025']

  const keywords: string[] = [seed]

  // 프리픽스 + 시드
  for (const prefix of prefixes) {
    if (prefix) keywords.push(`${prefix} ${seed}`)
  }

  // 시드 + 서픽스
  for (const suffix of suffixes) {
    if (suffix) keywords.push(`${seed} ${suffix}`)
  }

  // 연도 포함
  for (const year of years) {
    keywords.push(`${year} ${seed}`)
    keywords.push(`${seed} ${year}`)
  }

  // 중복 제거 및 개수 맞추기
  const unique = [...new Set(keywords)]
  return unique.slice(0, count)
}

// 네이버 블로그 검색으로 문서 수 조회
async function getDocCount(
  keyword: string,
  clientId: string,
  clientSecret: string
): Promise<number> {
  try {
    const response = await fetch(
      `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=1`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    )

    if (!response.ok) return 0

    const data = await response.json()
    return data.total || 0
  } catch {
    return 0
  }
}

// 검색량 추정 (실제로는 네이버 검색광고 API 필요)
// 여기서는 블로그 문서 수 기반으로 추정
function estimateSearchVolume(docCount: number): { pc: number; mobile: number } {
  // 문서 수 대비 검색량 추정 (대략적인 비율)
  const baseVolume = Math.max(100, Math.min(docCount * 2, 100000))
  const randomFactor = 0.8 + Math.random() * 0.4 // 80% ~ 120%

  const pcVolume = Math.floor(baseVolume * 0.3 * randomFactor)
  const mobileVolume = Math.floor(baseVolume * 0.7 * randomFactor)

  return { pc: pcVolume, mobile: mobileVolume }
}

// 경쟁률 계산 (검색량 대비 문서 수)
function calculateCompetition(totalSearch: number, docCount: number): number {
  if (totalSearch === 0) return 1
  // 문서 수 / 검색량 = 경쟁률 (낮을수록 좋음)
  const ratio = docCount / totalSearch
  return Math.min(1, Math.max(0, ratio))
}

// 황금 키워드 판별
function isGoldenKeyword(
  totalSearch: number,
  competition: number,
  minSearch: number = 100,
  maxCompetition: number = 0.5
): boolean {
  return totalSearch >= minSearch && competition <= maxCompetition
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

  const body: MineKeywordsRequest = await request.json()
  const { seedKeyword, count = 100, credentials } = body

  if (!seedKeyword?.trim()) {
    return new Response(JSON.stringify({ error: '시드 키워드가 필요합니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // API 키 확인
  const clientId = credentials?.apiClientId || process.env.NAVER_CLIENT_ID
  const clientSecret = credentials?.apiClientSecret || process.env.NAVER_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: '네이버 API 설정이 필요합니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  console.log('[BlogWriter] Mining keywords:', { seedKeyword, count })

  // SSE 스트림 생성
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 연관 키워드 생성
        const keywords = generateRelatedKeywords(seedKeyword.trim(), count)

        for (let i = 0; i < keywords.length; i++) {
          const keyword = keywords[i]

          // 문서 수 조회
          const docCount = await getDocCount(keyword, clientId, clientSecret)

          // 검색량 추정
          const { pc, mobile } = estimateSearchVolume(docCount)
          const totalSearch = pc + mobile

          // 경쟁률 계산
          const competition = calculateCompetition(totalSearch, docCount)

          // 황금 키워드 판별
          const isGolden = isGoldenKeyword(totalSearch, competition)

          const keywordData: KeywordData = {
            keyword,
            pcSearch: pc,
            mobileSearch: mobile,
            totalSearch,
            docCount,
            competition,
            isGolden,
          }

          // 진행률 전송
          const progress = Math.round(((i + 1) / keywords.length) * 100)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ progress, keyword: keywordData })}\n\n`)
          )

          // Rate limiting (네이버 API 제한: 초당 10회)
          await new Promise(resolve => setTimeout(resolve, 150))
        }

        // 완료 이벤트
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ complete: true, total: keywords.length })}\n\n`)
        )

        controller.close()
      } catch (error: any) {
        console.error('[BlogWriter] Keyword mining error:', error)
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
