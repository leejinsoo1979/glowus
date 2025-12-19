export const dynamic = 'force-dynamic'

/**
 * Brain Map - Clusters API
 * GET /api/agents/:agentId/brain/clusters
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { BrainCluster, BrainNode, NodeType } from '@/types/brain-map'

// Mock cluster data
function generateMockClusters(): BrainCluster[] {
  const clusterData = [
    { name: '프로젝트 관리', keywords: ['일정', '마일스톤', '진행률', '리소스'] },
    { name: '기술 문서', keywords: ['API', '아키텍처', '설계', '스펙'] },
    { name: '팀 커뮤니케이션', keywords: ['회의', '슬랙', '피드백', '협업'] },
    { name: '제품 개발', keywords: ['기능', '릴리즈', 'MVP', '스프린트'] },
    { name: '사용자 피드백', keywords: ['리뷰', '설문', 'NPS', '개선'] },
    { name: '비즈니스 전략', keywords: ['목표', 'KPI', '시장', '경쟁사'] },
  ]

  return clusterData.map((data, idx) => {
    const nodeCount = Math.floor(Math.random() * 20) + 5
    const centralNodes = Array.from({ length: 3 }, (_, i) => `cluster-${idx}-node-${i}`)

    return {
      clusterId: `cluster-${idx}`,
      label: data.name,
      topKeywords: data.keywords,
      nodeCount,
      cohesionScore: 0.5 + Math.random() * 0.5,
      centralNodeIds: centralNodes,
    }
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const { searchParams } = new URL(request.url)

    const minCoherence = parseFloat(searchParams.get('minCoherence') || '0')
    const limit = parseInt(searchParams.get('limit') || '10')

    const supabase = await createClient()
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // TODO: 실제 클러스터링 로직 구현
    // 현재는 Mock 데이터 반환
    let clusters = generateMockClusters()

    // Filter by cohesion score
    if (minCoherence > 0) {
      clusters = clusters.filter(c => c.cohesionScore >= minCoherence)
    }

    // Apply limit
    clusters = clusters.slice(0, limit)

    return NextResponse.json({
      clusters,
      meta: {
        totalClusters: clusters.length,
        avgCohesion: clusters.reduce((sum, c) => sum + c.cohesionScore, 0) / clusters.length,
      },
    })
  } catch (error) {
    console.error('[Brain Clusters API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Clusters 조회 실패' },
      { status: 500 }
    )
  }
}
