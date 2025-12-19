export const dynamic = 'force-dynamic'

/**
 * Brain Map - Insights API (AI 분석 인사이트)
 * GET /api/agents/:agentId/brain/insights
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { BrainInsight, InsightCategory } from '@/types/brain-map'

// Mock insights data
function generateMockInsights(): BrainInsight[] {
  const insightTemplates: Array<{
    category: InsightCategory
    title: string
    content: string
  }> = [
    {
      category: 'summary',
      title: '전체 지식 그래프 요약',
      content: '현재 142개 노드와 89개 엣지로 구성된 지식 그래프입니다. 프로젝트 관리와 기술 문서가 가장 밀집된 클러스터입니다.',
    },
    {
      category: 'contradiction',
      title: '상충되는 정보 발견',
      content: '프로젝트 일정에 대해 두 가지 상충되는 정보가 발견되었습니다. 검토가 필요합니다.',
    },
    {
      category: 'opportunity',
      title: '미개척 영역 발견',
      content: '관련 지식이 풍부하지만 아직 탐색되지 않은 영역이 있습니다. 해당 영역에 대한 심층 조사를 고려하세요.',
    },
    {
      category: 'risk',
      title: '지식 격차 경고',
      content: '중요한 개념에 대한 연결이 약하거나 부족합니다. 관련 자료를 추가하여 지식을 보완하세요.',
    },
    {
      category: 'trend',
      title: '성장하는 관심 영역',
      content: '특정 주제에 대한 노드 생성이 급증하고 있습니다. 해당 영역을 클러스터로 정리하세요.',
    },
    {
      category: 'gap',
      title: '누락된 연결 감지',
      content: '관련성이 높은 두 개념 간의 연결이 누락되어 있습니다.',
    },
    {
      category: 'next_action',
      title: '추천 다음 단계',
      content: '최근 활동 기반으로, 기술 문서 클러스터의 정리가 필요합니다.',
    },
  ]

  return insightTemplates.map((template, idx) => ({
    insightId: `insight-${idx}`,
    category: template.category,
    title: template.title,
    content: template.content,
    confidence: 0.6 + Math.random() * 0.4,
    evidenceNodeIds: [`node-${idx * 2}`, `node-${idx * 2 + 1}`],
    evidenceEdgeIds: [`edge-${idx}`],
    createdAt: Date.now() - Math.random() * 7 * 86400000,
  }))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const { searchParams } = new URL(request.url)

    const category = searchParams.get('category') // filter by category
    const limit = parseInt(searchParams.get('limit') || '10')
    const onlyActionable = searchParams.get('onlyActionable') === 'true'

    const supabase = await createClient()
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // TODO: 실제 AI 분석 로직 구현
    // 현재는 Mock 데이터 반환
    let insights = generateMockInsights()

    // Filter by category
    if (category) {
      insights = insights.filter(i => i.category === category)
    }

    // Filter actionable (next_action category) only
    if (onlyActionable) {
      insights = insights.filter(i => i.category === 'next_action')
    }

    // Sort by confidence (higher first)
    insights.sort((a, b) => b.confidence - a.confidence)

    // Apply limit
    insights = insights.slice(0, limit)

    return NextResponse.json({
      insightItems: insights,
      stats: {
        graphStats: {
          totalNodes: 142,
          totalEdges: 89,
          clusters: 6,
          avgDegree: 3.2,
          density: 0.045,
        },
        growthStats: {
          nodesAdded7d: 23,
          edgesAdded7d: 15,
          topGrowingClusters: ['프로젝트 관리', '기술 문서'],
        },
        qualityStats: {
          contradictionsCount: 1,
          orphanNodesCount: 5,
          lowConfidenceCount: 8,
        },
      },
    })
  } catch (error) {
    console.error('[Brain Insights API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Insights 조회 실패' },
      { status: 500 }
    )
  }
}
