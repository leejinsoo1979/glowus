/**
 * State Builder - Brain State Generator
 *
 * 뉴럴맵의 핵심 엔진
 * "아카이브"가 아니라 "상태 생성기"
 *
 * 입력: StateQuery (project, role, task, stage, constraints)
 * 출력: ContextPack (지금의 뇌 상태)
 *
 * 6단계 프로세스:
 * 1. 상황 해석 - StateQuery 파싱
 * 2. 후보 뉴런 수집 - 시냅스 기반 탐색
 * 3. 우선순위 산정 - 가중치 기반 랭킹
 * 4. 충돌 해결 - contradicts 엣지 감지 및 해결
 * 5. 상태 패키징 - ContextPack 생성
 * 6. 피드백 강화 - 결과 기반 학습
 */

import {
  DEFAULT_STATE_BUILDER_WEIGHTS,
  type NeuralNode,
  type NeuralEdge,
  type NeuralGraph,
  type NodeType,
  type NeuronScope,
  type StateQuery,
  type ContextPack,
  type ContextPackNeuron,
  type ContextPackReference,
  type ContextPackOptions,
  type ConflictResolution,
  type StateBuilderWeights,
  type ExecutionFeedback,
} from './types'

// ============================================
// State Builder Class
// ============================================

export class StateBuilder {
  private graph: NeuralGraph
  private weights: StateBuilderWeights

  constructor(graph: NeuralGraph, weights?: Partial<StateBuilderWeights>) {
    this.graph = graph
    this.weights = {
      ...DEFAULT_STATE_BUILDER_WEIGHTS,
      ...weights,
    }
  }

  /**
   * 메인 함수: Context Pack 생성
   */
  buildContextPack(query: StateQuery, options?: ContextPackOptions): ContextPack {
    const maxNeurons = options?.maxNeurons || 50
    const minRelevanceScore = options?.minRelevanceScore || 0.3

    // 1. 후보 뉴런 수집
    const candidates = this.collectCandidates(query, options)

    // 2. 우선순위 산정 (랭킹)
    const rankedNeurons = this.rankNeurons(candidates, query)

    // 3. 충돌 해결
    const { resolved, conflicts } = this.resolveConflicts(rankedNeurons)

    // 4. 필터링 (최소 점수, 최대 개수)
    const filtered = resolved
      .filter(n => n.relevanceScore >= minRelevanceScore)
      .slice(0, maxNeurons)

    // 5. 상태 패키징
    const contextPack = this.packageState(query, filtered, conflicts)

    return contextPack
  }

  // ============================================
  // Step 1: 후보 뉴런 수집
  // ============================================

  private collectCandidates(
    query: StateQuery,
    options?: ContextPackOptions
  ): NeuralNode[] {
    const { nodes } = this.graph
    const includeTypes = options?.includeTypes
    const excludeTypes = options?.excludeTypes || ['folder', 'file']

    // Brain Core 타입 우선
    const brainCoreTypes: NodeType[] = [
      'rule', 'identity', 'decision', 'preference', 'playbook'
    ]

    let candidates = nodes.filter(node => {
      // 타입 필터
      if (includeTypes && !includeTypes.includes(node.type)) return false
      if (excludeTypes.includes(node.type)) return false

      // deprecated 제외 (옵션)
      if (node.neuronStatus === 'deprecated') return false

      // Scope 기반 필터링
      if (!this.matchesScope(node, query)) return false

      return true
    })

    // 시냅스 기반 확장: 연결된 뉴런들도 수집
    if (query.projectId) {
      const connectedIds = this.getConnectedNeurons(query.projectId, 2) // depth 2
      const connectedNodes = nodes.filter(n =>
        connectedIds.has(n.id) && !excludeTypes.includes(n.type)
      )
      // 중복 제거
      const allCandidates = [...candidates, ...connectedNodes]
      const seenIds = new Set<string>()
      candidates = allCandidates.filter(n => {
        if (seenIds.has(n.id)) return false
        seenIds.add(n.id)
        return true
      })
    }

    // Brain Core 타입 우선 정렬
    candidates.sort((a, b) => {
      const aIsBrain = brainCoreTypes.includes(a.type) ? 1 : 0
      const bIsBrain = brainCoreTypes.includes(b.type) ? 1 : 0
      return bIsBrain - aIsBrain
    })

    return candidates
  }

  /**
   * Scope 매칭 체크
   */
  private matchesScope(node: NeuralNode, query: StateQuery): boolean {
    const nodeScope = node.scope || 'global'

    // global은 항상 포함
    if (nodeScope === 'global') return true

    // project scope
    if (nodeScope === 'project') {
      if (!query.projectId) return false
      return node.projectId === query.projectId || !node.projectId
    }

    // role scope
    if (nodeScope === 'role') {
      if (!query.role) return false
      return node.roleId === query.role || !node.roleId
    }

    // task scope
    if (nodeScope === 'task') {
      if (!query.taskId) return false
      // task scope는 해당 task와 연결된 것만
      return this.isConnectedTo(node.id, query.taskId)
    }

    return true
  }

  /**
   * 시냅스를 따라 연결된 뉴런 ID들 수집 (BFS)
   */
  private getConnectedNeurons(startId: string, maxDepth: number): Set<string> {
    const visited = new Set<string>()
    const queue: { id: string; depth: number }[] = [{ id: startId, depth: 0 }]

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!
      if (visited.has(id) || depth > maxDepth) continue
      visited.add(id)

      // 연결된 엣지 찾기
      const edges = this.graph.edges.filter(
        e => e.source === id || e.target === id
      )

      for (const edge of edges) {
        const nextId = edge.source === id ? edge.target : edge.source
        if (!visited.has(nextId)) {
          queue.push({ id: nextId, depth: depth + 1 })
        }
      }
    }

    return visited
  }

  /**
   * 두 노드가 연결되어 있는지 확인
   */
  private isConnectedTo(nodeId: string, targetId: string): boolean {
    return this.graph.edges.some(
      e =>
        (e.source === nodeId && e.target === targetId) ||
        (e.target === nodeId && e.source === targetId)
    )
  }

  // ============================================
  // Step 2: 우선순위 산정 (랭킹)
  // ============================================

  private rankNeurons(
    candidates: NeuralNode[],
    query: StateQuery
  ): (NeuralNode & { relevanceScore: number })[] {
    const now = Date.now()

    return candidates.map(node => {
      let score = 0

      // 1. Scope 일치도 (global < project < role < task)
      const scopeScore = this.calculateScopeScore(node, query)
      score += scopeScore * this.weights.scopeMatch

      // 2. 최신성 (Recency)
      const recencyScore = this.calculateRecencyScore(node, now)
      score += recencyScore * this.weights.recency

      // 3. 권위 (Authority) - active > draft, 확신도 높은 것 우선
      const authorityScore = this.calculateAuthorityScore(node)
      score += authorityScore * this.weights.authority

      // 4. 확신도 (Confidence)
      const confidenceScore = (node.confidence || 70) / 100
      score += confidenceScore * this.weights.confidence

      // 5. 리스크 관련성 (긴급할수록 risk 높은 것 우선)
      if (query.constraints?.time === 'urgent') {
        const riskScore = this.calculateRiskScore(node)
        score += riskScore * this.weights.riskRelevance
      }

      // 6. 키워드 매칭 보너스
      if (query.keywords?.length) {
        const keywordScore = this.calculateKeywordScore(node, query.keywords)
        score += keywordScore * 0.1
      }

      // 7. Brain Core 타입 보너스
      if (['rule', 'identity', 'decision', 'preference', 'playbook'].includes(node.type)) {
        score += 0.1
      }

      return {
        ...node,
        relevanceScore: Math.min(1, Math.max(0, score)),
      }
    }).sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  private calculateScopeScore(node: NeuralNode, query: StateQuery): number {
    const nodeScope = node.scope || 'global'

    // task > role > project > global
    if (nodeScope === 'task' && query.taskId) return 1.0
    if (nodeScope === 'role' && query.role) return 0.8
    if (nodeScope === 'project' && query.projectId) return 0.6
    if (nodeScope === 'global') return 0.4

    return 0.3
  }

  private calculateRecencyScore(node: NeuralNode, now: number): number {
    const updatedAt = new Date(node.updatedAt).getTime()
    const daysSinceUpdate = (now - updatedAt) / (1000 * 60 * 60 * 24)

    // 7일 이내 = 1.0, 30일 = 0.7, 90일 = 0.4, 그 이상 = 0.2
    if (daysSinceUpdate <= 7) return 1.0
    if (daysSinceUpdate <= 30) return 0.7
    if (daysSinceUpdate <= 90) return 0.4
    return 0.2
  }

  private calculateAuthorityScore(node: NeuralNode): number {
    let score = 0.5

    // Status 기반
    if (node.neuronStatus === 'active') score += 0.3
    if (node.neuronStatus === 'draft') score += 0.1

    // Rule의 enforcement 기반
    if (node.type === 'rule') {
      if (node.enforcement === 'must') score += 0.2
      if (node.enforcement === 'should') score += 0.1
    }

    return Math.min(1, score)
  }

  private calculateRiskScore(node: NeuralNode): number {
    // Identity의 taboo는 높은 리스크
    if (node.type === 'identity' && node.identityCategory === 'taboo') return 1.0

    // Rule의 must는 높은 리스크
    if (node.type === 'rule' && node.enforcement === 'must') return 0.8

    // 중요도 기반
    return (node.importance || 5) / 10
  }

  private calculateKeywordScore(node: NeuralNode, keywords: string[]): number {
    const text = `${node.statement || ''} ${node.title} ${node.why || ''} ${node.tags?.join(' ') || ''}`.toLowerCase()

    let matches = 0
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matches++
      }
    }

    return matches / keywords.length
  }

  // ============================================
  // Step 3: 충돌 해결
  // ============================================

  private resolveConflicts(
    rankedNeurons: (NeuralNode & { relevanceScore: number })[]
  ): {
    resolved: (NeuralNode & { relevanceScore: number })[]
    conflicts: ConflictResolution[]
  } {
    const conflicts: ConflictResolution[] = []
    const deprecated = new Set<string>()

    // contradicts 엣지 찾기
    const contradictEdges = this.graph.edges.filter(e => e.type === 'contradicts')

    for (const edge of contradictEdges) {
      const nodeA = rankedNeurons.find(n => n.id === edge.source)
      const nodeB = rankedNeurons.find(n => n.id === edge.target)

      if (!nodeA || !nodeB) continue
      if (deprecated.has(nodeA.id) || deprecated.has(nodeB.id)) continue

      // 충돌 해결: 더 높은 점수를 가진 것이 승리
      const winner = nodeA.relevanceScore >= nodeB.relevanceScore ? nodeA : nodeB
      const loser = winner === nodeA ? nodeB : nodeA

      // 해결 이유 결정
      let reason: ConflictResolution['reason'] = 'confidence'
      if (winner.scope !== loser.scope) reason = 'scope'
      else if (winner.updatedAt > loser.updatedAt) reason = 'recency'
      else if (winner.neuronStatus === 'active' && loser.neuronStatus !== 'active') reason = 'authority'

      deprecated.add(loser.id)

      conflicts.push({
        conflictingNeurons: [nodeA.id, nodeB.id],
        selectedNeuron: winner.id,
        reason,
        deprecatedNeurons: [loser.id],
      })
    }

    // supersedes 엣지도 처리 (새 결정이 이전 결정을 대체)
    const supersedesEdges = this.graph.edges.filter(e => e.type === 'supersedes')

    for (const edge of supersedesEdges) {
      // source가 target을 대체
      deprecated.add(edge.target)
    }

    const resolved = rankedNeurons.filter(n => !deprecated.has(n.id))

    return { resolved, conflicts }
  }

  // ============================================
  // Step 4: 상태 패키징
  // ============================================

  private packageState(
    query: StateQuery,
    neurons: (NeuralNode & { relevanceScore: number })[],
    conflicts: ConflictResolution[]
  ): ContextPack {
    // Mission 생성
    const mission = this.generateMission(query)

    // 카테고리별 분류
    const policies = neurons
      .filter(n => ['rule', 'identity'].includes(n.type))
      .map(n => this.toContextPackNeuron(n))

    const decisions = neurons
      .filter(n => n.type === 'decision')
      .map(n => this.toContextPackNeuron(n))

    const playbooks = neurons
      .filter(n => n.type === 'playbook')
      .map(n => this.toContextPackNeuron(n))

    // 🔥 constraints: 반드시 지켜야 하는 규칙들
    // - rule 타입 중 enforcement='must'
    // - identity 타입 중 identityCategory='taboo'
    // - decision 타입 중 tags에 'must' 또는 'rule'이 포함된 것 (DB 호환)
    const constraints = neurons
      .filter(n =>
        (n.type === 'rule' && n.enforcement === 'must') ||
        (n.type === 'identity' && n.identityCategory === 'taboo') ||
        (n.type === 'decision' && n.tags?.some(tag =>
          ['must', 'rule', 'constraint', 'mandatory', '필수', '규칙'].includes(tag.toLowerCase())
        ))
      )
      .map(n => this.toContextPackNeuron(n))

    const references = neurons
      .filter(n => ['doc', 'memory', 'insight'].includes(n.type))
      .map(n => this.toContextPackReference(n))

    return {
      id: `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      query,
      mission,
      policies,
      decisions,
      playbooks,
      constraints,
      references,
      totalNeurons: neurons.length,
      conflictResolutions: conflicts.length > 0 ? conflicts : undefined,
      excludedNeurons: conflicts.flatMap(c => c.deprecatedNeurons),
    }
  }

  private generateMission(query: StateQuery): string {
    const parts: string[] = []

    if (query.taskId) {
      const task = this.graph.nodes.find(n => n.id === query.taskId)
      if (task) parts.push(task.statement || task.title)
    }

    if (query.projectId && !parts.length) {
      const project = this.graph.nodes.find(n => n.id === query.projectId)
      if (project) parts.push(`${project.title} 프로젝트 작업`)
    }

    if (query.role) {
      parts.push(`${query.role} 역할로`)
    }

    if (query.stage) {
      const stageLabels = {
        planning: '계획',
        implementing: '구현',
        reviewing: '검토',
        deploying: '배포',
      }
      parts.push(`${stageLabels[query.stage]} 단계`)
    }

    return parts.join(' - ') || '작업 수행'
  }

  private toContextPackNeuron(
    node: NeuralNode & { relevanceScore: number }
  ): ContextPackNeuron {
    return {
      id: node.id,
      type: node.type,
      statement: node.statement || node.title,
      why: node.why,
      scope: node.scope || 'global',
      confidence: node.confidence || 70,
      enforcement: node.enforcement,
      relevanceScore: node.relevanceScore,
    }
  }

  private toContextPackReference(node: NeuralNode): ContextPackReference {
    return {
      id: node.id,
      title: node.title,
      type: node.type as 'doc' | 'memory' | 'insight',
      summary: node.summary || node.statement,
    }
  }

  // ============================================
  // Context Pack → String (AI 주입용)
  // ============================================

  static formatForAI(pack: ContextPack): string {
    const lines: string[] = []

    lines.push(`# Mission`)
    lines.push(pack.mission)
    lines.push('')

    if (pack.policies.length > 0) {
      lines.push(`## Identity & Policies (${pack.policies.length})`)
      pack.policies.forEach((n, i) => {
        const enforcement = n.enforcement ? ` [${n.enforcement}]` : ''
        lines.push(`${i + 1}. ${n.statement}${enforcement}`)
        if (n.why) lines.push(`   - Why: ${n.why}`)
      })
      lines.push('')
    }

    if (pack.decisions.length > 0) {
      lines.push(`## 🚨 필수 결정사항 - 반드시 따르세요! (${pack.decisions.length})`)
      pack.decisions.forEach((n, i) => {
        lines.push(`${i + 1}. ⚠️ ${n.statement}`)
        if (n.why) lines.push(`   - 이유: ${n.why}`)
      })
      lines.push('')
    }

    if (pack.playbooks.length > 0) {
      lines.push(`## Playbooks (${pack.playbooks.length})`)
      pack.playbooks.forEach((n, i) => {
        lines.push(`${i + 1}. ${n.statement}`)
      })
      lines.push('')
    }

    if (pack.constraints.length > 0) {
      lines.push(`## Constraints & Do-Not`)
      pack.constraints.forEach((n, i) => {
        lines.push(`- ${n.statement}`)
      })
      lines.push('')
    }

    if (pack.references.length > 0) {
      lines.push(`## References`)
      pack.references.forEach((r) => {
        lines.push(`- [${r.type}] ${r.title}`)
      })
    }

    return lines.join('\n')
  }

  // ============================================
  // Step 5: 피드백 강화 (Consolidation)
  // ============================================

  /**
   * 실행 결과를 바탕으로 뉴런 가중치 조정
   */
  applyFeedback(feedback: ExecutionFeedback): void {
    const { success, score, reinforceNeurons, weakenNeurons } = feedback

    // 강화할 뉴런들: confidence 상승
    if (reinforceNeurons) {
      for (const id of reinforceNeurons) {
        const node = this.graph.nodes.find(n => n.id === id)
        if (node) {
          node.confidence = Math.min(100, (node.confidence || 70) + 5)
        }
      }
    }

    // 약화할 뉴런들: confidence 하락
    if (weakenNeurons) {
      for (const id of weakenNeurons) {
        const node = this.graph.nodes.find(n => n.id === id)
        if (node) {
          node.confidence = Math.max(0, (node.confidence || 70) - 5)
        }
      }
    }

    // 전체 성공/실패에 따른 조정
    if (success && score >= 80) {
      // 높은 성공: 사용된 모든 뉴런 약간 강화
      // (이건 별도의 Context Pack ID로 추적 필요)
    }
  }
}

// ============================================
// Convenience Functions
// ============================================

/**
 * 간단한 Context Pack 생성
 */
export function createContextPack(
  graph: NeuralGraph,
  query: StateQuery,
  options?: ContextPackOptions
): ContextPack {
  const builder = new StateBuilder(graph)
  return builder.buildContextPack(query, options)
}

/**
 * Context Pack을 AI 주입용 문자열로 변환
 */
export function formatContextPackForAI(pack: ContextPack): string {
  return StateBuilder.formatForAI(pack)
}

// ============================================
// Hooks for React
// ============================================

/**
 * React에서 사용하기 위한 State Builder Hook 타입
 */
export interface UseStateBuilderResult {
  buildPack: (query: StateQuery, options?: ContextPackOptions) => ContextPack | null
  formatForAI: (pack: ContextPack) => string
}
