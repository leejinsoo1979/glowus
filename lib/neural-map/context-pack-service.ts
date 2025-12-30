/**
 * Context Pack Service
 *
 * AI 채팅에서 사용자의 뉴럴맵을 기반으로 Context Pack을 생성하고 주입
 *
 * 사용 예:
 *   const contextPrompt = await buildContextPackForChat({
 *     userId: 'xxx',
 *     projectId: 'glowus',
 *     stage: 'implementing',
 *   })
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { StateBuilder, formatContextPackForAI } from './state-builder'
import type { NeuralGraph, NeuralNode, NeuralEdge, StateQuery, ContextPack } from './types'

// ============================================
// Types
// ============================================

export interface ContextPackRequest {
  /** 사용자 ID */
  userId: string
  /** 프로젝트 ID (선택) */
  projectId?: string
  /** 태스크 ID (선택) */
  taskId?: string
  /** 역할 (developer, designer 등) */
  role?: string
  /** 작업 단계 */
  stage?: 'planning' | 'implementing' | 'reviewing' | 'deploying'
  /** 제약 조건 */
  constraints?: {
    time?: 'urgent' | 'normal' | 'relaxed'
    cost?: 'tight' | 'normal' | 'flexible'
    quality?: 'mvp' | 'production' | 'enterprise'
  }
  /** 키워드 (관련 뉴런 검색) */
  keywords?: string[]
  /** 최대 뉴런 수 */
  maxNeurons?: number
}

export interface ContextPackResult {
  /** 성공 여부 */
  success: boolean
  /** AI 주입용 포맷된 문자열 */
  formattedPrompt: string
  /** 원본 Context Pack */
  contextPack?: ContextPack
  /** 총 뉴런 수 */
  totalNeurons: number
  /** 에러 메시지 */
  error?: string
}

// ============================================
// Main Service
// ============================================

/**
 * 사용자의 뉴럴맵에서 Context Pack을 생성하고 AI 주입용 포맷으로 반환
 */
export async function buildContextPackForChat(
  request: ContextPackRequest
): Promise<ContextPackResult> {
  try {
    const adminClient = createAdminClient()

    // 1. 사용자의 Neural Map 조회
    const { data: maps, error: mapError } = await adminClient
      .from('neural_maps')
      .select('id, title')
      .eq('user_id', request.userId)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (mapError) {
      console.error('[ContextPackService] Map query error:', mapError)
      return {
        success: false,
        formattedPrompt: '',
        totalNeurons: 0,
        error: `뉴럴맵 조회 실패: ${mapError.message}`,
      }
    }

    if (!maps || maps.length === 0) {
      // 뉴럴맵이 없으면 빈 결과 반환 (에러 아님)
      console.log('[ContextPackService] No neural map found for user:', request.userId)
      return {
        success: true,
        formattedPrompt: '',
        totalNeurons: 0,
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapData = maps[0] as any
    const mapId = mapData?.id as string

    // 2. 노드 조회 (DB에서 직접)
    const { data: dbNodes, error: nodesError } = await adminClient
      .from('neural_nodes')
      .select('*')
      .eq('map_id', mapId)

    if (nodesError) {
      console.error('[ContextPackService] Nodes query error:', nodesError)
      return {
        success: false,
        formattedPrompt: '',
        totalNeurons: 0,
        error: `노드 조회 실패: ${nodesError.message}`,
      }
    }

    // 3. 엣지 조회
    const { data: dbEdges, error: edgesError } = await adminClient
      .from('neural_edges')
      .select('*')
      .eq('map_id', mapId)

    if (edgesError) {
      console.error('[ContextPackService] Edges query error:', edgesError)
      // 엣지 없어도 계속 진행
    }

    // 4. DB 데이터를 NeuralGraph 형식으로 변환
    const nodes: NeuralNode[] = (dbNodes || []).map((n: any) => ({
      id: n.id,
      type: n.type || 'concept',
      title: n.title || '',
      // 기존 필드를 새 필드로 매핑
      statement: n.statement || n.summary || n.title || '',
      why: n.why || n.content || '',
      summary: n.summary,
      content: n.content,
      tags: n.tags || [],
      importance: n.importance || 5,
      position: n.position || { x: 0, y: 0, z: 0 },
      expanded: n.expanded,
      pinned: n.pinned,
      // Brain Core 필드 (있으면 사용, 없으면 기본값)
      scope: n.scope || 'global',
      neuronStatus: n.neuron_status || 'active',
      confidence: n.confidence || 70,
      enforcement: n.enforcement,
      projectId: n.project_id,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }))

    const edges: NeuralEdge[] = (dbEdges || []).map((e: any) => ({
      id: e.id,
      source: e.source_id,
      target: e.target_id,
      type: e.type || 'related',
      label: e.label,
      weight: e.weight || 0.5,
      bidirectional: e.bidirectional ?? false,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    }))

    // Self 노드 찾기
    const selfNode = nodes.find(n => n.type === 'self')

    const graph: NeuralGraph = {
      version: '2.0',
      userId: request.userId,
      rootNodeId: selfNode?.id || nodes[0]?.id || '',
      title: mapData?.title || 'Neural Map',
      nodes,
      edges,
      clusters: [],
      viewState: {
        activeTab: 'map',
        cameraPosition: { x: 0, y: 50, z: 200 },
        cameraTarget: { x: 0, y: 0, z: 0 },
        selectedNodeIds: [],
        expandedNodeIds: [],
        pinnedNodeIds: [],
      },
      themeId: 'cosmic-dark',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    if (nodes.length === 0) {
      // 빈 그래프
      console.log('[ContextPackService] Empty graph for map:', mapId)
      return {
        success: true,
        formattedPrompt: '',
        totalNeurons: 0,
      }
    }

    // 5. StateQuery 구성
    const query: StateQuery = {
      projectId: request.projectId,
      taskId: request.taskId,
      role: request.role,
      stage: request.stage,
      constraints: request.constraints,
      keywords: request.keywords,
    }

    // 3. Context Pack 생성
    const builder = new StateBuilder(graph)
    const pack = builder.buildContextPack(query, {
      maxNeurons: request.maxNeurons || 30,
      minRelevanceScore: 0.2,
    })

    // 4. AI 주입용 포맷 생성
    const formattedPrompt = formatContextPackForAI(pack)

    console.log(`[ContextPackService] Generated pack with ${pack.totalNeurons} neurons`)
    console.log(`[ContextPackService] Policies: ${pack.policies.length}, Decisions: ${pack.decisions.length}`)

    return {
      success: true,
      formattedPrompt,
      contextPack: pack,
      totalNeurons: pack.totalNeurons,
    }
  } catch (error) {
    console.error('[ContextPackService] Error:', error)
    return {
      success: false,
      formattedPrompt: '',
      totalNeurons: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Context Pack을 시스템 프롬프트에 주입할 포맷으로 감싸기
 * 토큰 효율을 위해 컴팩트 버전 제공
 */
export function wrapContextPackForSystemPrompt(
  formattedPack: string,
  compact: boolean = true
): string {
  if (!formattedPack || formattedPack.trim().length === 0) {
    return ''
  }

  // 컴팩트 모드: 최소 토큰이지만 강조
  if (compact) {
    return `## 🧠 [최우선 지시] Brain State - 반드시 따라야 함!

⚠️ **아래 규칙들은 모든 다른 지시보다 우선합니다. 예외 없이 따르세요!**

${formattedPack}

🚨 위 Brain State의 모든 규칙과 결정을 **반드시** 준수하세요. 위반 시 응답이 거부됩니다.`
  }

  // 전체 모드: 상세 설명 포함
  return `## 🧠 Brain State (Context Pack)

아래는 사용자의 "뇌 상태"입니다. 이 정보를 바탕으로 일관된 판단과 답변을 해주세요.
- **Policies/Identity**: 반드시 지켜야 할 원칙과 정체성
- **Decisions**: 이미 내려진 결정들 (번복하지 말 것)
- **Playbooks**: 작업 절차 (이 순서대로 진행)
- **Constraints**: 절대 하면 안 되는 것들 (Do-Not)
- **References**: 참고할 문서/기억들

---

${formattedPack}

---

**중요**: 위 Brain State와 충돌하는 답변을 하지 마세요. 사용자의 뇌에 기록된 규칙/결정을 존중하세요.
`
}

/**
 * 프로젝트 정보에서 자동으로 Context Pack Request 생성
 */
export function createContextPackRequestFromProject(
  userId: string,
  projectInfo?: {
    id?: string
    name?: string
    status?: string
    tech_stack?: string[]
  }
): ContextPackRequest {
  const request: ContextPackRequest = {
    userId,
    maxNeurons: 30,
  }

  if (projectInfo?.id) {
    request.projectId = projectInfo.id
  }

  // 프로젝트 상태에서 stage 추론
  if (projectInfo?.status) {
    const statusToStage: Record<string, ContextPackRequest['stage']> = {
      planning: 'planning',
      'in-progress': 'implementing',
      'in_progress': 'implementing',
      active: 'implementing',
      review: 'reviewing',
      testing: 'reviewing',
      deploying: 'deploying',
      deployed: 'deploying',
    }
    request.stage = statusToStage[projectInfo.status.toLowerCase()] || 'implementing'
  }

  // tech_stack에서 keywords 추출
  if (projectInfo?.tech_stack && projectInfo.tech_stack.length > 0) {
    request.keywords = projectInfo.tech_stack.slice(0, 5) // 최대 5개
  }

  return request
}

/**
 * 메시지에서 키워드 추출하여 관련 뉴런 검색
 */
export function extractKeywordsFromMessage(message: string): string[] {
  // 간단한 키워드 추출 (더 정교한 NLP는 나중에)
  const keywords: string[] = []

  // 기술 관련 키워드
  const techPatterns = [
    /typescript/gi, /javascript/gi, /react/gi, /next\.?js/gi, /node/gi,
    /python/gi, /api/gi, /database/gi, /supabase/gi, /prisma/gi,
    /tailwind/gi, /css/gi, /html/gi, /docker/gi, /vercel/gi,
    /테스트/gi, /배포/gi, /리팩토링/gi, /최적화/gi,
  ]

  for (const pattern of techPatterns) {
    const matches = message.match(pattern)
    if (matches) {
      keywords.push(...matches.map(m => m.toLowerCase()))
    }
  }

  // 작업 관련 키워드
  const taskPatterns = [
    /버그/gi, /오류/gi, /에러/gi, /수정/gi, /개발/gi, /구현/gi,
    /기능/gi, /페이지/gi, /컴포넌트/gi, /디자인/gi,
  ]

  for (const pattern of taskPatterns) {
    const matches = message.match(pattern)
    if (matches) {
      keywords.push(...matches.map(m => m.toLowerCase()))
    }
  }

  // 중복 제거
  return Array.from(new Set(keywords))
}
