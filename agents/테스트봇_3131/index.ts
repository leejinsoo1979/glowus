/**
 * 테스트봇_3131 - Agent Entry Point
 * 자동 생성된 에이전트 실행 파일
 */

import * as 시작 from './시작'
import * as 프롬프트 from './프롬프트'
import * as llm from './llm'
import * as 종료 from './종료'
import agentConfig from './agent.json'

// 노드 맵
export const nodes = {
  'start': 시작,
  'prompt': 프롬프트,
  'llm': llm,
  'end': 종료,
}

// 에이전트 설정
export const config = agentConfig

// 에이전트 실행
export async function execute(input: unknown): Promise<unknown> {
  console.log('[테스트봇_3131] 에이전트 실행 시작')

  // 시작 노드 찾기
  const startNode = agentConfig.nodes.find(n => n.type === 'start')
  if (!startNode) {
    throw new Error('시작 노드를 찾을 수 없습니다')
  }

  // 워크플로우 실행
  let currentNodeId = startNode.id
  let currentData = input

  while (currentNodeId) {
    const nodeModule = nodes[currentNodeId as keyof typeof nodes]
    if (!nodeModule) break

    // 노드 실행
    currentData = await nodeModule.execute(currentData as any)

    // 다음 노드 찾기
    const outgoingEdge = agentConfig.edges.find(e => e.source === currentNodeId)
    currentNodeId = outgoingEdge?.target || ''

    // 종료 노드 확인
    const currentNode = agentConfig.nodes.find(n => n.id === currentNodeId)
    if (currentNode?.type === 'end') {
      const endModule = nodes[currentNodeId as keyof typeof nodes]
      if (endModule) {
        return endModule.execute(currentData as any)
      }
      break
    }
  }

  return currentData
}

export default { execute, nodes, config }
