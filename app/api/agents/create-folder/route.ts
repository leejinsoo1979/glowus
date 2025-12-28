import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, folderName, projectPath } = body

    if (!name || !folderName) {
      return NextResponse.json(
        { error: '에이전트 이름이 필요합니다' },
        { status: 400 }
      )
    }

    // agents 폴더 경로 (프로젝트 경로가 있으면 해당 프로젝트 내에 생성)
    const baseDir = projectPath || process.cwd()
    const agentsDir = path.join(baseDir, 'agents')
    const agentDir = path.join(agentsDir, folderName)

    console.log('[API] Creating agent folder:', { baseDir, agentsDir, agentDir })

    // agents 폴더가 없으면 생성
    try {
      await fs.access(agentsDir)
    } catch {
      await fs.mkdir(agentsDir, { recursive: true })
    }

    // 이미 존재하는지 확인
    try {
      await fs.access(agentDir)
      return NextResponse.json(
        { error: `에이전트 폴더가 이미 존재합니다: ${folderName}` },
        { status: 409 }
      )
    } catch {
      // 폴더가 없으면 정상
    }

    // 에이전트 폴더 생성
    await fs.mkdir(agentDir, { recursive: true })

    // agent.json 생성
    const agentConfig = {
      name,
      description: '',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [
        {
          id: 'n1',
          type: 'start',
          file: 'start.ts',
          position: { x: 0, y: 0 },
          config: { label: 'Start' }
        },
        {
          id: 'n2',
          type: 'end',
          file: 'end.ts',
          position: { x: 200, y: 0 },
          config: { label: 'End' }
        }
      ],
      edges: [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2'
        }
      ],
      metadata: {
        nodeCount: 2,
        edgeCount: 1
      }
    }
    await fs.writeFile(
      path.join(agentDir, 'agent.json'),
      JSON.stringify(agentConfig, null, 2)
    )

    // index.ts 생성
    const indexContent = `/**
 * ${name} - Agent Entry Point
 * 자동 생성된 에이전트 실행 파일
 */

import * as start from './start'
import * as end from './end'
import agentConfig from './agent.json'

// 노드 맵
export const nodes = {
  'n1': start,
  'n2': end,
}

// 에이전트 설정
export const config = agentConfig

// 에이전트 실행
export async function execute(input: unknown): Promise<unknown> {
  console.log('[${name}] 에이전트 실행 시작')

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
`
    await fs.writeFile(path.join(agentDir, 'index.ts'), indexContent)

    // start.ts 생성
    const startContent = `/**
 * Start Node
 * 워크플로우 시작점
 */

export interface StartInput {
  message?: string
  [key: string]: unknown
}

export interface StartOutput {
  startedAt: string
  input: StartInput
}

export async function execute(input: StartInput): Promise<StartOutput> {
  console.log('[Start] 워크플로우 시작:', input)

  return {
    startedAt: new Date().toISOString(),
    input,
  }
}
`
    await fs.writeFile(path.join(agentDir, 'start.ts'), startContent)

    // end.ts 생성
    const endContent = `/**
 * End Node
 * 워크플로우 종료점
 */

export interface EndInput {
  [key: string]: unknown
}

export interface EndOutput {
  completedAt: string
  result: EndInput
}

export async function execute(input: EndInput): Promise<EndOutput> {
  console.log('[End] 워크플로우 완료:', input)

  return {
    completedAt: new Date().toISOString(),
    result: input,
  }
}
`
    await fs.writeFile(path.join(agentDir, 'end.ts'), endContent)

    return NextResponse.json({
      success: true,
      path: `agents/${folderName}`,
      name,
      files: ['index.ts', 'agent.json', 'start.ts', 'end.ts'],
      projectPath: baseDir,  // 🔧 FIX: 프론트엔드에서 노드 파일 생성에 필요
      folderName,
    })
  } catch (error: any) {
    console.error('[API] Create agent folder error:', error)
    return NextResponse.json(
      { error: error.message || '에이전트 폴더 생성 실패' },
      { status: 500 }
    )
  }
}
