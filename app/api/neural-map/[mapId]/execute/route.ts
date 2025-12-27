/**
 * Blueprint Execution API
 *
 * "Coding Navigator" - AI가 Blueprint를 읽고 실행
 *
 * POST: Blueprint 기반으로 Agent 실행 시작
 * GET: 현재 실행 상태 조회
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import {
  neuralNodeToBlueprintNode,
  blueprintNodesToAgentPlan,
  taskStatusToBlueprintStatus,
  type BlueprintNode,
} from '@/lib/neural-map/blueprint-sync'
import type { NeuralNode, AgentPlan } from '@/lib/neural-map/types'

const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true'
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

// 실행 상태 저장 (메모리 - 추후 Redis로 전환 가능)
const executionStates = new Map<string, {
  status: 'running' | 'paused' | 'completed' | 'error'
  currentNodeId: string | null
  startedAt: number
  logs: Array<{ timestamp: number; message: string; type: 'info' | 'success' | 'error' }>
}>()

interface RouteParams {
  params: Promise<{ mapId: string }>
}

// GET /api/neural-map/[mapId]/execute - 실행 상태 조회
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { mapId } = await params

    const state = executionStates.get(mapId) || {
      status: 'paused',
      currentNodeId: null,
      startedAt: 0,
      logs: [],
    }

    return NextResponse.json(state)
  } catch (err) {
    console.error('Execute GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/neural-map/[mapId]/execute - Blueprint 실행
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { mapId } = await params
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    let userId: string
    if (DEV_MODE) {
      userId = DEV_USER_ID
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    }

    const body = await request.json()
    const { action, nodeId } = body as {
      action: 'start' | 'pause' | 'resume' | 'complete-node'
      nodeId?: string
    }

    // 맵 소유권 확인
    const { data: neuralMap } = await adminSupabase
      .from('neural_maps')
      .select('id, title')
      .eq('id', mapId)
      .eq('user_id', userId)
      .single() as { data: { id: string; title: string } | null }

    if (!neuralMap) {
      return NextResponse.json({ error: 'Neural map not found' }, { status: 404 })
    }

    // Blueprint 노드들 조회
    const { data: nodesData } = await adminSupabase
      .from('neural_nodes')
      .select('*')
      .eq('map_id', mapId)
      .contains('tags', ['pipeline'])
      .order('created_at', { ascending: true })

    const nodes = ((nodesData || []) as unknown as NeuralNode[]).map((n, i) =>
      neuralNodeToBlueprintNode(n, i)
    )

    let state = executionStates.get(mapId)

    switch (action) {
      case 'start':
      case 'resume': {
        // 다음 실행할 노드 찾기
        const nextNode = nodes.find(n => n.status === 'doing') ||
                        nodes.find(n => n.status === 'todo')

        if (!nextNode) {
          return NextResponse.json({
            success: true,
            message: 'All tasks completed',
            status: 'completed',
          })
        }

        // 상태 업데이트
        state = {
          status: 'running',
          currentNodeId: nextNode.id,
          startedAt: Date.now(),
          logs: [
            ...(state?.logs || []),
            {
              timestamp: Date.now(),
              message: `Starting task: ${nextNode.title}`,
              type: 'info',
            },
          ],
        }
        executionStates.set(mapId, state)

        // 노드 상태를 "doing"으로 업데이트
        await updateNodeStatus(adminSupabase, mapId, nextNode.id, 'doing')

        // AI 실행 (비동기 - 백그라운드)
        executeTask(mapId, nextNode, neuralMap.title, adminSupabase).catch(console.error)

        return NextResponse.json({
          success: true,
          status: 'running',
          currentNode: nextNode,
        })
      }

      case 'pause': {
        if (state) {
          state.status = 'paused'
          state.logs.push({
            timestamp: Date.now(),
            message: 'Execution paused by user',
            type: 'info',
          })
          executionStates.set(mapId, state)
        }

        return NextResponse.json({
          success: true,
          status: 'paused',
        })
      }

      case 'complete-node': {
        if (!nodeId) {
          return NextResponse.json({ error: 'nodeId required' }, { status: 400 })
        }

        // 노드 완료 처리
        await updateNodeStatus(adminSupabase, mapId, nodeId, 'done')

        if (state) {
          state.logs.push({
            timestamp: Date.now(),
            message: `Task completed: ${nodes.find(n => n.id === nodeId)?.title}`,
            type: 'success',
          })

          // 다음 노드 확인
          const remainingTodos = nodes.filter(n => n.id !== nodeId && n.status === 'todo')
          if (remainingTodos.length === 0) {
            state.status = 'completed'
            state.currentNodeId = null
          }

          executionStates.set(mapId, state)
        }

        return NextResponse.json({
          success: true,
          status: state?.status || 'completed',
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (err) {
    console.error('Execute POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 노드 상태 업데이트 헬퍼
async function updateNodeStatus(
  adminSupabase: ReturnType<typeof createAdminClient>,
  mapId: string,
  nodeId: string,
  status: 'done' | 'doing' | 'todo'
) {
  // 현재 노드 가져오기
  const { data: currentNode } = await adminSupabase
    .from('neural_nodes')
    .select('tags')
    .eq('id', nodeId)
    .eq('map_id', mapId)
    .single()

  if (!currentNode) return

  // 태그 업데이트
  let tags = ((currentNode as any).tags || []).filter(
    (t: string) => !['done', 'doing', 'todo'].includes(t)
  )
  tags.push(status)

  await adminSupabase
    .from('neural_nodes')
    .update({ tags } as never)
    .eq('id', nodeId)
    .eq('map_id', mapId)
}

// AI Task 실행 (비동기)
async function executeTask(
  mapId: string,
  node: BlueprintNode,
  projectName: string,
  adminSupabase: ReturnType<typeof createAdminClient>
) {
  const state = executionStates.get(mapId)
  if (!state) return

  try {
    // AI 모델 초기화
    const llm = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.3,
    })

    // Blueprint 기반 시스템 프롬프트
    const systemPrompt = `당신은 "${projectName}" 프로젝트의 개발을 도와주는 AI Assistant입니다.

## 현재 작업
- 제목: ${node.title}
- 설명: ${node.description || '없음'}
${node.files?.length ? `- 관련 파일: ${node.files.join(', ')}` : ''}

## 지침
1. Blueprint의 작업 지시에 따라 단계별로 실행하세요
2. 각 단계가 완료되면 상태를 업데이트합니다
3. 코드 변경이 필요하면 명확히 설명하세요
4. 에러가 발생하면 즉시 보고하세요

## 응답 형식
작업 결과를 다음 형식으로 보고하세요:
- 실행한 작업
- 변경된 파일 (있는 경우)
- 다음 단계 제안`

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(`"${node.title}" 작업을 시작합니다. 이 작업을 어떻게 수행할지 계획을 세우고 실행해주세요.`),
    ]

    // AI 응답 생성
    const response = await llm.invoke(messages)

    // 로그 업데이트
    state.logs.push({
      timestamp: Date.now(),
      message: `AI Response: ${String(response.content).slice(0, 200)}...`,
      type: 'info',
    })

    // 작업 완료 처리 (실제로는 사용자 승인 필요)
    // 여기서는 데모용으로 자동 완료
    state.logs.push({
      timestamp: Date.now(),
      message: `Task "${node.title}" execution completed`,
      type: 'success',
    })

    executionStates.set(mapId, state)

  } catch (error) {
    state.logs.push({
      timestamp: Date.now(),
      message: `Error executing task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'error',
    })
    state.status = 'error'
    executionStates.set(mapId, state)
  }
}
