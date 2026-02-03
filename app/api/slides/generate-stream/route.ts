export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { getBusinessPlanGenerator, type GenerationProgress } from '@/lib/slide-engine/business-plan-generator'

/**
 * 사업계획서 생성 스트리밍 API
 *
 * SSE로 실시간 진행 상황 전송
 * BusinessPlanGenerator의 AsyncGenerator를 사용하여 진짜 실시간 스트리밍
 */

interface GenerateRequest {
  prompt: string
  slideCount?: number
  purpose?: 'investment' | 'loan' | 'introduction'
  language?: 'ko' | 'en'
}

export async function POST(request: NextRequest) {
  const body: GenerateRequest = await request.json()
  const {
    prompt,
    slideCount = 12,
    purpose = 'investment',
    language = 'ko',
  } = body

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const generator = getBusinessPlanGenerator()

        // AsyncGenerator로부터 실시간으로 진행 상황 수신
        for await (const progress of generator.generate(prompt, {
          slideCount,
          purpose,
          language,
        })) {
          // 각 단계별 이벤트 전송
          switch (progress.stage) {
            case 'analysis':
              send('progress', {
                step: 'analysis',
                message: progress.message,
                percent: progress.percent,
              })
              if (progress.data) {
                send('analysis', progress.data)
              }
              break

            case 'research':
              send('progress', {
                step: 'research',
                message: progress.message,
                percent: progress.percent,
              })
              if (progress.data) {
                send('research', progress.data)
              }
              break

            case 'outline':
              send('progress', {
                step: 'outline',
                message: progress.message,
                percent: progress.percent,
              })
              if (progress.data) {
                send('outline', {
                  title: progress.data.title,
                  subtitle: progress.data.subtitle,
                  sections: progress.data.sections,
                })
              }
              break

            case 'slides':
              send('progress', {
                step: 'slides',
                message: progress.message,
                percent: progress.percent,
              })
              if (progress.data?.slide) {
                const slide = progress.data.slide
                send('slide', {
                  slideNumber: progress.data.slideIndex + 1,
                  totalSlides: slideCount,
                  data: {
                    id: slide.id,
                    type: slide.type,
                    title: slide.title,
                    subtitle: slide.subtitle,
                    content: {
                      points: slide.content.points || slide.content.items?.map((i: any) => i.title) || [],
                      metrics: slide.content.metrics,
                      items: slide.content.items,
                      timeline: slide.content.timeline,
                      team: slide.content.team,
                      notes: slide.speakerNotes,
                    },
                    layout: getLayoutForType(slide.type),
                    imagePrompt: slide.imagePrompt,
                  },
                })
              }
              break

            case 'complete':
              send('progress', {
                step: 'complete',
                message: progress.message,
                percent: 100,
              })
              send('complete', {
                success: true,
                totalSlides: progress.data?.slides?.length || slideCount,
                presentationTitle: progress.data?.outline?.title || '사업계획서',
                generatedBy: 'business-plan-generator',
              })
              break
          }
        }

      } catch (error) {
        console.error('[Slides Stream API] Error:', error)
        send('error', {
          message: error instanceof Error ? error.message : '생성 중 오류 발생',
        })
      } finally {
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

/**
 * 슬라이드 타입에 맞는 레이아웃 반환
 */
function getLayoutForType(type: string): string {
  const layoutMap: Record<string, string> = {
    'cover': 'title',
    'problem': 'content',
    'solution': 'content',
    'product': 'image-right',
    'market': 'data-grid',
    'business-model': 'two-column',
    'competition': 'two-column',
    'traction': 'data-grid',
    'team': 'content',
    'roadmap': 'content',
    'financials': 'data-grid',
    'investment': 'conclusion',
    'contact': 'conclusion',
  }
  return layoutMap[type] || 'content'
}
