/**
 * Blueprint Execution API
 *
 * "Coding Navigator" - AI가 Blueprint를 읽고 실행
 *
 * POST: Blueprint 기반으로 Agent 실행 시작
 * GET: 현재 실행 상태 조회
 *
 * DB 테이블: neural_blueprint_executions
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import {
  neuralNodeToBlueprintNode,
  type BlueprintNode,
} from '@/lib/neural-map/blueprint-sync'
import type { NeuralNode } from '@/lib/neural-map/types'

const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true'
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

interface RouteParams {
  params: Promise<{ mapId: string }>
}

interface ExecutionState {
  id: string
  map_id: string
  user_id: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'error'
  current_node_id: string | null
  total_nodes: number
  completed_nodes: number
  logs: Array<{ timestamp: number; message: string; type: 'info' | 'success' | 'error' }>
  error_message: string | null
  started_at: string | null
  completed_at: string | null
}

// GET /api/neural-map/[mapId]/execute - 실행 상태 조회
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { mapId } = await params
    const adminSupabase = createAdminClient()

    // DB에서 최신 실행 상태 조회
    const { data: execution, error } = await (adminSupabase
      .from('neural_blueprint_executions') as any)
      .select('*')
      .eq('map_id', mapId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !execution) {
      return NextResponse.json({
        status: 'idle',
        currentNodeId: null,
        startedAt: 0,
        logs: [],
        totalNodes: 0,
        completedNodes: 0,
      })
    }

    const exec = execution as ExecutionState
    return NextResponse.json({
      id: exec.id,
      status: exec.status,
      currentNodeId: exec.current_node_id,
      startedAt: exec.started_at ? new Date(exec.started_at).getTime() : 0,
      logs: exec.logs || [],
      totalNodes: exec.total_nodes,
      completedNodes: exec.completed_nodes,
      errorMessage: exec.error_message,
    })
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
      action: 'start' | 'pause' | 'resume' | 'complete-node' | 'reset'
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

    // 현재 실행 상태 조회
    const { data: currentExecution } = await (adminSupabase
      .from('neural_blueprint_executions') as any)
      .select('*')
      .eq('map_id', mapId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as { data: ExecutionState | null }

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

        // 새 실행 세션 생성 or 기존 세션 업데이트
        let executionId: string
        const newLog = {
          timestamp: Date.now(),
          message: `Starting task: ${nextNode.title}`,
          type: 'info' as const,
        }

        if (action === 'start' || !currentExecution) {
          // 새 실행 세션 생성
          const { data: newExecution, error: insertError } = await (adminSupabase
            .from('neural_blueprint_executions') as any)
            .insert({
              map_id: mapId,
              user_id: userId,
              status: 'running',
              current_node_id: nextNode.id,
              total_nodes: nodes.length,
              completed_nodes: nodes.filter(n => n.status === 'done').length,
              logs: [newLog],
              started_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (insertError) {
            console.error('Failed to create execution:', insertError)
            return NextResponse.json({ error: 'Failed to create execution' }, { status: 500 })
          }
          executionId = newExecution.id
        } else {
          // 기존 세션 업데이트
          const updatedLogs = [...(currentExecution.logs || []), newLog]
          await (adminSupabase
            .from('neural_blueprint_executions') as any)
            .update({
              status: 'running',
              current_node_id: nextNode.id,
              logs: updatedLogs,
            })
            .eq('id', currentExecution.id)
          executionId = currentExecution.id
        }

        // 노드 상태를 "doing"으로 업데이트
        await updateNodeStatus(adminSupabase, mapId, nextNode.id, 'doing')

        // AI 실행 (비동기 - 백그라운드)
        executeTaskWithTools(
          executionId,
          mapId,
          nextNode,
          neuralMap.title,
          adminSupabase
        ).catch(console.error)

        return NextResponse.json({
          success: true,
          status: 'running',
          executionId,
          currentNode: nextNode,
        })
      }

      case 'pause': {
        if (currentExecution) {
          const pauseLog = {
            timestamp: Date.now(),
            message: 'Execution paused by user',
            type: 'info' as const,
          }
          await (adminSupabase
            .from('neural_blueprint_executions') as any)
            .update({
              status: 'paused',
              logs: [...(currentExecution.logs || []), pauseLog],
            })
            .eq('id', currentExecution.id)
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

        const completedNode = nodes.find(n => n.id === nodeId)
        const completedCount = nodes.filter(n => n.id === nodeId || n.status === 'done').length

        if (currentExecution) {
          const completeLog = {
            timestamp: Date.now(),
            message: `Task completed: ${completedNode?.title || nodeId}`,
            type: 'success' as const,
          }

          const isAllDone = completedCount >= nodes.length
          await (adminSupabase
            .from('neural_blueprint_executions') as any)
            .update({
              status: isAllDone ? 'completed' : currentExecution.status,
              current_node_id: isAllDone ? null : currentExecution.current_node_id,
              completed_nodes: completedCount,
              completed_at: isAllDone ? new Date().toISOString() : null,
              logs: [...(currentExecution.logs || []), completeLog],
            })
            .eq('id', currentExecution.id)
        }

        return NextResponse.json({
          success: true,
          status: completedCount >= nodes.length ? 'completed' : 'running',
          completedNodes: completedCount,
          totalNodes: nodes.length,
        })
      }

      case 'reset': {
        // 모든 실행 기록 삭제 및 노드 상태 초기화
        await (adminSupabase
          .from('neural_blueprint_executions') as any)
          .delete()
          .eq('map_id', mapId)

        // 모든 pipeline 노드를 todo로 초기화
        for (const node of nodes) {
          await updateNodeStatus(adminSupabase, mapId, node.id, 'todo')
        }

        return NextResponse.json({
          success: true,
          status: 'idle',
          message: 'Execution reset',
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

// DB에 로그 추가 헬퍼
async function addExecutionLog(
  adminSupabase: ReturnType<typeof createAdminClient>,
  executionId: string,
  message: string,
  type: 'info' | 'success' | 'error'
) {
  const { data: execution } = await (adminSupabase
    .from('neural_blueprint_executions') as any)
    .select('logs')
    .eq('id', executionId)
    .single()

  const logs = execution?.logs || []
  logs.push({ timestamp: Date.now(), message, type })

  await (adminSupabase
    .from('neural_blueprint_executions') as any)
    .update({ logs })
    .eq('id', executionId)
}

// OpenAI 클라이언트
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Tool 정의 (OpenAI function calling format)
const blueprintTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'analyze_task',
      description: '작업 분석 및 계획 수립',
      parameters: {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            items: { type: 'string' },
            description: '수행할 단계들',
          },
          estimated_time: {
            type: 'string',
            description: '예상 소요 시간',
          },
        },
        required: ['steps'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: '작업 완료 보고',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: '작업 완료 요약',
          },
          changes_made: {
            type: 'array',
            items: { type: 'string' },
            description: '변경 사항 목록',
          },
          next_steps: {
            type: 'array',
            items: { type: 'string' },
            description: '권장 후속 작업',
          },
        },
        required: ['summary'],
      },
    },
  },
]

// AI Task 실행 (OpenAI API 직접 사용)
async function executeTaskWithTools(
  executionId: string,
  mapId: string,
  node: BlueprintNode,
  projectName: string,
  adminSupabase: ReturnType<typeof createAdminClient>
) {
  try {
    // 실행 시작 로그
    await addExecutionLog(
      adminSupabase,
      executionId,
      `🤖 AI Agent 시작: "${node.title}"`,
      'info'
    )

    const systemPrompt = `당신은 "${projectName}" 프로젝트의 개발을 수행하는 AI Coding Agent입니다.

## 현재 작업
- 제목: ${node.title}
- 설명: ${node.description || '없음'}
${node.files?.length ? `- 관련 파일: ${node.files.join(', ')}` : ''}

## 지침
1. 먼저 analyze_task를 호출하여 작업 계획을 수립하세요
2. 계획에 따라 작업을 수행하세요
3. 완료되면 complete_task를 호출하여 결과를 보고하세요

## 주의사항
- 실제 파일 변경은 사용자의 별도 승인이 필요합니다
- 위험한 작업은 권장하지 마세요
- 구체적이고 실행 가능한 계획을 제시하세요`

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `"${node.title}" 작업을 분석하고 수행 계획을 수립하세요. ${node.description || ''}` },
    ]

    // AI 호출 (최대 3회 반복)
    let iterations = 0
    const maxIterations = 3
    let taskCompleted = false
    let finalResult = ''

    while (iterations < maxIterations && !taskCompleted) {
      iterations++

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: blueprintTools,
        tool_choice: iterations === 1 ? { type: 'function', function: { name: 'analyze_task' } } : 'auto',
        temperature: 0.2,
      })

      const choice = response.choices[0]

      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        // Tool 호출 처리
        for (const toolCall of choice.message.tool_calls) {
          // Type guard for function tool calls
          if (toolCall.type !== 'function') continue

          const funcCall = toolCall as any
          const args = JSON.parse(funcCall.function.arguments)
          const funcName = funcCall.function.name

          if (funcName === 'analyze_task') {
            await addExecutionLog(
              adminSupabase,
              executionId,
              `📋 작업 분석 완료: ${args.steps?.length || 0}개 단계`,
              'info'
            )

            // 분석 결과를 메시지에 추가
            messages.push(choice.message)
            messages.push({
              role: 'tool',
              tool_call_id: funcCall.id,
              content: JSON.stringify({ success: true, message: '분석 완료. 이제 complete_task를 호출하세요.' }),
            })
          } else if (funcName === 'complete_task') {
            taskCompleted = true
            finalResult = args.summary || '작업 완료'

            await addExecutionLog(
              adminSupabase,
              executionId,
              `✅ 작업 완료: ${finalResult}`,
              'success'
            )

            if (args.changes_made && args.changes_made.length > 0) {
              await addExecutionLog(
                adminSupabase,
                executionId,
                `📝 변경 사항: ${args.changes_made.join(', ')}`,
                'info'
              )
            }
          }
        }
      } else if (choice.message.content) {
        // 일반 응답
        finalResult = choice.message.content
        taskCompleted = true
      }
    }

    // 노드 완료 처리
    await updateNodeStatus(adminSupabase, mapId, node.id, 'done')

    // 실행 상태 업데이트
    const { data: execution } = await (adminSupabase
      .from('neural_blueprint_executions') as any)
      .select('completed_nodes, total_nodes, logs')
      .eq('id', executionId)
      .single()

    if (execution) {
      const newCompletedCount = (execution.completed_nodes || 0) + 1
      const isAllDone = newCompletedCount >= (execution.total_nodes || 0)

      await (adminSupabase
        .from('neural_blueprint_executions') as any)
        .update({
          current_node_id: null,
          completed_nodes: newCompletedCount,
          status: isAllDone ? 'completed' : 'paused',
          completed_at: isAllDone ? new Date().toISOString() : null,
        })
        .eq('id', executionId)
    }

  } catch (error) {
    console.error('Task execution error:', error)

    await addExecutionLog(
      adminSupabase,
      executionId,
      `❌ 오류: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    )

    await (adminSupabase
      .from('neural_blueprint_executions') as any)
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', executionId)
  }
}
