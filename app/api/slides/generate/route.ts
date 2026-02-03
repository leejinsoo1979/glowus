export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { generateSlideStructure, type GeneratedPresentation } from '@/lib/slide-engine/content-service'

/**
 * 슬라이드 생성 API
 *
 * Claude Code 터미널을 통해 슬라이드 콘텐츠를 생성합니다.
 * 실패 시 OpenAI로 폴백합니다.
 */

interface GenerateRequest {
    prompt: string
    slideCount?: number
    businessType?: string
    purpose?: string
    theme?: string
    language?: string
}

// 슬라이드 타입별 템플릿 (fallback용)
const SLIDE_TEMPLATES = {
    cover: { type: 'cover', promptKey: '표지' },
    problem: { type: 'problem', promptKey: '문제 정의' },
    solution: { type: 'solution', promptKey: '솔루션' },
    market: { type: 'market', promptKey: '시장 기회' },
    'business-model': { type: 'business-model', promptKey: '비즈니스 모델' },
    product: { type: 'product', promptKey: '제품/서비스' },
    competition: { type: 'competition', promptKey: '경쟁 분석' },
    gtm: { type: 'gtm', promptKey: '시장 진입 전략' },
    marketing: { type: 'marketing', promptKey: '마케팅 전략' },
    team: { type: 'team', promptKey: '팀 소개' },
    roadmap: { type: 'roadmap', promptKey: '로드맵' },
    revenue: { type: 'revenue', promptKey: '매출 전망' },
    financials: { type: 'financials', promptKey: '재무 계획' },
    investment: { type: 'investment', promptKey: '투자 제안' },
    contact: { type: 'contact', promptKey: '연락처' }
}

export async function POST(request: NextRequest) {
    try {
        const body: GenerateRequest = await request.json()
        const {
            prompt,
            slideCount = 15,
            businessType = 'IT 스타트업',
            purpose = '투자 유치',
            theme = 'modern',
            language = 'ko'
        } = body

        console.log('[Slides API] 🚀 Generating slides via Claude Code Terminal...')
        console.log(`  - Prompt: ${prompt.substring(0, 100)}...`)
        console.log(`  - Slide count: ${slideCount}`)
        console.log(`  - Theme: ${theme}`)

        // 프롬프트에 비즈니스 컨텍스트 추가
        const enrichedPrompt = `${prompt}

사업 분야: ${businessType}
목적: ${purpose}

다음 슬라이드 타입들을 적절히 활용하세요:
- cover (표지)
- problem (문제 정의)
- solution (솔루션)
- market (시장 기회 - TAM/SAM/SOM)
- business-model (비즈니스 모델)
- product (제품/서비스)
- competition (경쟁 분석)
- team (팀 소개)
- roadmap (로드맵)
- financials (재무 계획)
- investment (투자 제안)
- contact (연락처)

각 슬라이드는 전문적이고 구체적인 내용으로 작성해주세요.
아이콘은 이모지를 사용하세요.`

        // 🔥 Claude Code 터미널로 슬라이드 생성 (content-service.ts)
        const presentation = await generateSlideStructure(
            enrichedPrompt,
            slideCount,
            theme,
            language
        )

        // 슬라이드 형식 변환 (프론트엔드 호환)
        const formattedSlides = presentation.slides.map((slide, index) => ({
            id: String(index + 1),
            type: slide.layout === 'title' ? 'cover' :
                  slide.layout === 'conclusion' ? 'contact' :
                  slide.layout || 'content',
            title: slide.title,
            subtitle: slide.subtitle,
            content: {
                ...(slide.content && { points: slide.content }),
                ...(slide.points && { points: slide.points }),
                ...(slide.notes && { notes: slide.notes }),
                ...(slide.imagePrompt && { imagePrompt: slide.imagePrompt }),
            }
        }))

        console.log(`[Slides API] ✅ Generated ${formattedSlides.length} slides via Claude Code`)

        return NextResponse.json({
            success: true,
            slides: formattedSlides,
            totalSlides: formattedSlides.length,
            presentationTitle: presentation.title,
            presentationSubtitle: presentation.subtitle,
            theme: presentation.theme,
            generatedBy: 'claude-code-terminal'
        })

    } catch (error) {
        console.error('[Slides API] ❌ Error:', error)

        // 완전 실패 시 기본 슬라이드 반환
        const body = await request.clone().json().catch(() => ({}))
        const { businessType = 'IT 스타트업', purpose = '투자 유치', slideCount = 15 } = body as GenerateRequest

        return NextResponse.json({
            success: true,
            slides: generateFallbackSlides(businessType, purpose, slideCount),
            totalSlides: slideCount,
            fallback: true,
            error: error instanceof Error ? error.message : 'Unknown error'
        })
    }
}

// Fallback 슬라이드 생성기
function generateFallbackSlides(businessType: string, purpose: string, count: number) {
    const slides = [
        {
            id: '1',
            type: 'cover',
            title: '[회사명]',
            subtitle: `${businessType} - ${purpose}용 사업계획서`,
            content: {
                tagline: '혁신적인 솔루션으로 시장을 선도합니다',
                presenter: '대표이사 | CEO',
                date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })
            }
        },
        {
            id: '2',
            type: 'problem',
            title: '문제 정의',
            subtitle: '시장이 직면한 핵심 과제',
            content: {
                issues: [
                    { icon: '📊', title: '비효율적인 프로세스', desc: '기존 방식의 한계로 인한 시간과 비용 낭비' },
                    { icon: '💰', title: '높은 운영 비용', desc: '레거시 시스템 유지보수에 따른 과도한 지출' },
                    { icon: '🔗', title: '데이터 단절', desc: '부서 간 정보 공유의 어려움' }
                ],
                targetCustomer: '중견기업 및 스타트업',
                opportunity: '문제 해결 시 30% 이상 효율성 향상 기대'
            }
        },
        {
            id: '3',
            type: 'solution',
            title: '솔루션 개요',
            subtitle: '혁신적인 접근 방식',
            content: {
                mainDesc: '최신 기술을 활용한 통합 솔루션으로 고객의 핵심 문제를 해결합니다.',
                features: [
                    { icon: '⚡', title: '자동화', desc: '반복 업무의 90% 자동화' },
                    { icon: '🔄', title: '실시간 연동', desc: '모든 시스템 통합' },
                    { icon: '📈', title: '분석 인사이트', desc: 'AI 기반 예측 분석' }
                ]
            }
        },
        {
            id: '4',
            type: 'market',
            title: '시장 기회',
            subtitle: 'TAM · SAM · SOM',
            content: {
                tam: { value: '100조원', label: 'Total Addressable Market', desc: '글로벌 시장 규모' },
                sam: { value: '10조원', label: 'Serviceable Addressable Market', desc: '국내 목표 시장' },
                som: { value: '1,000억원', label: 'Serviceable Obtainable Market', desc: '3년 내 목표' },
                cagr: '연평균 성장률 20%'
            }
        },
        {
            id: '5',
            type: 'business-model',
            title: '비즈니스 모델',
            subtitle: '수익 창출 구조',
            content: {
                model: 'SaaS 구독 모델',
                pricing: [
                    { tier: 'Basic', price: '월 50만원', features: ['기본 기능', '5명 사용자'] },
                    { tier: 'Pro', price: '월 150만원', features: ['고급 기능', '무제한 사용자'] },
                    { tier: 'Enterprise', price: '맞춤 견적', features: ['전용 지원', '커스터마이징'] }
                ],
                metrics: { arpu: '월 100만원', ltv: '1,200만원', cac: '200만원' }
            }
        }
    ]

    // 추가 슬라이드
    const additionalTypes = ['product', 'competition', 'gtm', 'marketing', 'team', 'roadmap', 'revenue', 'financials', 'investment', 'contact']

    for (let i = slides.length; i < Math.min(count, slides.length + additionalTypes.length); i++) {
        const type = additionalTypes[i - slides.length]
        slides.push({
            id: String(i + 1),
            type,
            title: SLIDE_TEMPLATES[type as keyof typeof SLIDE_TEMPLATES]?.promptKey || type,
            subtitle: '',
            content: {}
        })
    }

    return slides
}
