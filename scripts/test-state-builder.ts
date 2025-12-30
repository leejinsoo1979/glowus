// @ts-nocheck
/**
 * State Builder 테스트 스크립트
 *
 * 실행: npx ts-node --skip-project scripts/test-state-builder.ts
 */

import { StateBuilder, formatContextPackForAI } from '../lib/neural-map/state-builder'
import type { NeuralGraph, NeuralNode, NeuralEdge, StateQuery } from '../lib/neural-map/types'

// ============================================
// 테스트 데이터: 뇌 상태 시뮬레이션
// ============================================

const testNodes: NeuralNode[] = [
  // === Identity Core ===
  {
    id: 'identity-1',
    type: 'identity',
    title: '코드 품질 최우선',
    statement: '모든 코드는 테스트 가능하고 읽기 쉬워야 한다',
    why: '장기적 유지보수성과 팀 생산성을 위해',
    scope: 'global',
    neuronStatus: 'active',
    confidence: 95,
    identityCategory: 'value',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-12-01T00:00:00Z',
    position: { x: 0, y: 0, z: 0 },
  },
  {
    id: 'identity-2',
    type: 'identity',
    title: '하드코딩 금지',
    statement: '환경변수나 설정은 절대 하드코딩하지 않는다',
    why: '보안 사고 방지 및 환경별 배포 용이성',
    scope: 'global',
    neuronStatus: 'active',
    confidence: 100,
    identityCategory: 'taboo',
    enforcement: 'must',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-12-01T00:00:00Z',
    position: { x: 10, y: 0, z: 0 },
  },

  // === Rules ===
  {
    id: 'rule-1',
    type: 'rule',
    title: 'PR 리뷰 필수',
    statement: '모든 PR은 최소 1명의 리뷰를 받아야 머지할 수 있다',
    why: '코드 품질 유지 및 지식 공유',
    scope: 'global',
    neuronStatus: 'active',
    confidence: 90,
    enforcement: 'must',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-11-01T00:00:00Z',
    position: { x: 20, y: 0, z: 0 },
  },
  {
    id: 'rule-2',
    type: 'rule',
    title: 'TypeScript strict 모드',
    statement: 'TypeScript strict 모드를 항상 활성화한다',
    why: '타입 안정성 확보',
    scope: 'project',
    projectId: 'glowus',
    neuronStatus: 'active',
    confidence: 85,
    enforcement: 'should',
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2024-12-15T00:00:00Z',
    position: { x: 30, y: 0, z: 0 },
  },

  // === Decisions ===
  {
    id: 'decision-1',
    type: 'decision',
    title: 'Next.js App Router 채택',
    statement: 'GlowUS 프로젝트는 Next.js App Router를 사용한다',
    why: '서버 컴포넌트, 스트리밍, 레이아웃 시스템의 이점',
    scope: 'project',
    projectId: 'glowus',
    neuronStatus: 'active',
    confidence: 95,
    decisionOutcome: 'approved',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-01T00:00:00Z',
    position: { x: 40, y: 0, z: 0 },
  },
  {
    id: 'decision-2',
    type: 'decision',
    title: 'Supabase 사용',
    statement: 'Backend는 Supabase를 사용한다 (PostgreSQL + Auth + Storage)',
    why: '빠른 개발 속도와 실시간 기능',
    scope: 'project',
    projectId: 'glowus',
    neuronStatus: 'active',
    confidence: 90,
    decisionOutcome: 'approved',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-01T00:00:00Z',
    position: { x: 50, y: 0, z: 0 },
  },

  // === Playbooks ===
  {
    id: 'playbook-1',
    type: 'playbook',
    title: '새 기능 개발 플로우',
    statement: '1. Issue 생성 → 2. 브랜치 생성 → 3. 구현 → 4. 테스트 → 5. PR → 6. 리뷰 → 7. 머지',
    why: '일관된 개발 프로세스 유지',
    scope: 'global',
    neuronStatus: 'active',
    confidence: 80,
    steps: [
      'GitHub Issue 생성 및 할당',
      'feature/ 브랜치 생성',
      '코드 구현',
      '로컬 테스트 실행',
      'PR 생성 및 설명 작성',
      '리뷰어 지정 및 리뷰 대기',
      '승인 후 squash merge',
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-10-01T00:00:00Z',
    position: { x: 60, y: 0, z: 0 },
  },

  // === Preferences ===
  {
    id: 'preference-1',
    type: 'preference',
    title: 'Tailwind CSS 선호',
    statement: '스타일링은 Tailwind CSS를 우선 사용한다',
    why: '일관된 디자인 시스템과 빠른 개발',
    scope: 'project',
    projectId: 'glowus',
    neuronStatus: 'active',
    confidence: 75,
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-12-01T00:00:00Z',
    position: { x: 70, y: 0, z: 0 },
  },

  // === Concepts ===
  {
    id: 'concept-1',
    type: 'concept',
    title: 'State Builder',
    statement: '뇌 상태를 Context Pack으로 변환하는 엔진',
    scope: 'project',
    projectId: 'glowus',
    neuronStatus: 'active',
    createdAt: '2024-12-01T00:00:00Z',
    updatedAt: '2024-12-31T00:00:00Z',
    position: { x: 80, y: 0, z: 0 },
  },

  // === Memory ===
  {
    id: 'memory-1',
    type: 'memory',
    title: '12월 대규모 리팩토링',
    statement: 'Neural Map을 State Builder 개념으로 리팩토링함',
    scope: 'project',
    projectId: 'glowus',
    neuronStatus: 'active',
    createdAt: '2024-12-20T00:00:00Z',
    updatedAt: '2024-12-31T00:00:00Z',
    position: { x: 90, y: 0, z: 0 },
  },

  // === Contradicting rule (for conflict test) ===
  {
    id: 'rule-old',
    type: 'rule',
    title: '(구) 리뷰 없이 머지 가능',
    statement: '긴급한 경우 리뷰 없이 머지할 수 있다',
    why: '빠른 핫픽스',
    scope: 'global',
    neuronStatus: 'active',
    confidence: 40,
    enforcement: 'may',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-06-01T00:00:00Z',
    position: { x: 100, y: 0, z: 0 },
  },
]

const testEdges: NeuralEdge[] = [
  // Identity supports Rule
  {
    id: 'edge-1',
    source: 'identity-1',
    target: 'rule-1',
    type: 'supports',
    weight: 0.9,
    createdAt: '2024-01-01T00:00:00Z',
  },
  // Decision implements Identity
  {
    id: 'edge-2',
    source: 'decision-1',
    target: 'identity-1',
    type: 'implements',
    weight: 0.8,
    createdAt: '2024-03-01T00:00:00Z',
  },
  // Rule contradicts old rule (충돌 테스트)
  {
    id: 'edge-3',
    source: 'rule-1',
    target: 'rule-old',
    type: 'contradicts',
    weight: 1.0,
    createdAt: '2024-01-01T00:00:00Z',
  },
  // Concept connected to Decision
  {
    id: 'edge-4',
    source: 'concept-1',
    target: 'decision-1',
    type: 'related',
    weight: 0.7,
    createdAt: '2024-12-01T00:00:00Z',
  },
  // Playbook defines workflow
  {
    id: 'edge-5',
    source: 'playbook-1',
    target: 'rule-1',
    type: 'defines',
    weight: 0.85,
    createdAt: '2024-01-01T00:00:00Z',
  },
]

const testGraph: NeuralGraph = {
  nodes: testNodes,
  edges: testEdges,
  clusters: [],
}

// ============================================
// 테스트 실행
// ============================================

console.log('========================================')
console.log('🧠 State Builder 테스트')
console.log('========================================\n')

// Test 1: 프로젝트 기반 Context Pack 생성
console.log('📦 Test 1: GlowUS 프로젝트 Context Pack\n')

const query1: StateQuery = {
  projectId: 'glowus',
  stage: 'implementing',
  role: 'developer',
}

const builder = new StateBuilder(testGraph)
const pack1 = builder.buildContextPack(query1, { maxNeurons: 20 })

console.log('Query:', JSON.stringify(query1, null, 2))
console.log('\n--- Context Pack (JSON) ---')
console.log(`Mission: ${pack1.mission}`)
console.log(`Total Neurons: ${pack1.totalNeurons}`)
console.log(`Policies: ${pack1.policies.length}`)
console.log(`Decisions: ${pack1.decisions.length}`)
console.log(`Playbooks: ${pack1.playbooks.length}`)
console.log(`Constraints: ${pack1.constraints.length}`)
console.log(`References: ${pack1.references.length}`)
console.log(`Conflicts Resolved: ${pack1.conflictResolutions?.length || 0}`)

if (pack1.conflictResolutions && pack1.conflictResolutions.length > 0) {
  console.log('\n⚔️ 충돌 해결:')
  pack1.conflictResolutions.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.conflictingNeurons.join(' vs ')} → ${c.selectedNeuron} (${c.reason})`)
  })
}

console.log('\n--- AI 주입용 포맷 ---')
const aiPrompt = formatContextPackForAI(pack1)
console.log(aiPrompt)

// Test 2: 긴급 상황 Context Pack
console.log('\n========================================')
console.log('📦 Test 2: 긴급 상황 Context Pack\n')

const query2: StateQuery = {
  projectId: 'glowus',
  stage: 'deploying',
  constraints: {
    time: 'urgent',
    quality: 'production',
  },
}

const pack2 = builder.buildContextPack(query2, { maxNeurons: 10 })

console.log('Query:', JSON.stringify(query2, null, 2))
console.log('\n--- AI 주입용 포맷 ---')
console.log(formatContextPackForAI(pack2))

// Test 3: 키워드 기반 검색
console.log('\n========================================')
console.log('📦 Test 3: 키워드 기반 Context Pack\n')

const query3: StateQuery = {
  keywords: ['TypeScript', 'strict', '테스트'],
}

const pack3 = builder.buildContextPack(query3, { maxNeurons: 5 })

console.log('Query:', JSON.stringify(query3, null, 2))
console.log(`Found ${pack3.totalNeurons} relevant neurons`)
console.log('\n--- AI 주입용 포맷 ---')
console.log(formatContextPackForAI(pack3))

console.log('\n========================================')
console.log('✅ State Builder 테스트 완료!')
console.log('========================================')
