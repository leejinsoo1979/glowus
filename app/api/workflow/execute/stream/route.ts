/**
 * Workflow Execute Stream API
 * SSE를 통한 실시간 워크플로우 실행 스트리밍
 */

import { NextRequest } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { convertReactFlowToWorkflowDefinition } from '@/lib/workflow/converter'
import { executeNode, type NodeExecutionContext } from '@/lib/workflow/node-executors'
import type { Node, Edge } from 'reactflow'
import type { NodeData } from '@/lib/workflow/types'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5분

interface ExecuteStreamRequest {
  // ReactFlow 형식 (UI에서 직접 전송)
  nodes?: Node<NodeData>[]
  edges?: Edge[]

  // 또는 WorkflowDefinition ID
  workflowId?: string

  // 입력 데이터
  inputs?: Record<string, unknown>

  // 컨텍스트
  context?: {
    userId?: string
    companyId?: string
  }
}

interface SSEEvent {
  type: 'workflow_started' | 'node_started' | 'node_progress' | 'node_completed' | 'node_failed' | 'workflow_completed' | 'workflow_failed' | 'log'
  executionId: string
  nodeId?: string
  data?: unknown
  timestamp: string
}

export async function POST(request: NextRequest) {
  const body: ExecuteStreamRequest = await request.json()
  const encoder = new TextEncoder()

  // SSE 스트림 생성
  const stream = new ReadableStream({
    async start(controller) {
      const executionId = uuidv4()
      const previousResults: Record<string, unknown> = {}

      // SSE 이벤트 전송 헬퍼
      const sendEvent = (event: SSEEvent) => {
        const data = JSON.stringify(event)
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      try {
        // 1. 워크플로우 정의 변환/조회
        if (!body.nodes || !body.edges) {
          throw new Error('nodes와 edges가 필요합니다')
        }

        const workflow = convertReactFlowToWorkflowDefinition(
          body.nodes,
          body.edges,
          { name: 'Streaming Workflow' }
        )

        // 2. 시작 이벤트
        sendEvent({
          type: 'workflow_started',
          executionId,
          timestamp: new Date().toISOString(),
          data: {
            workflowId: workflow.id,
            stepCount: workflow.steps.length,
            startStepId: workflow.startStepId,
          },
        })

        // 3. 단계별 실행
        const stepsMap = new Map(workflow.steps.map(s => [s.id, s]))
        let currentStepId: string | null | undefined = workflow.startStepId
        let iteration = 0
        const maxIterations = 100

        while (currentStepId && iteration < maxIterations) {
          iteration++
          const step = stepsMap.get(currentStepId)

          if (!step) {
            throw new Error(`단계를 찾을 수 없습니다: ${currentStepId}`)
          }

          // 노드 시작 이벤트
          sendEvent({
            type: 'node_started',
            executionId,
            nodeId: step.id,
            timestamp: new Date().toISOString(),
            data: {
              name: step.name,
              actionType: step.action.type,
            },
          })

          // 노드 타입에 따른 실행
          const nodeType = getNodeTypeFromAction(step.action)
          const inputs = step.inputs || {}

          // 실행 컨텍스트
          const nodeContext: NodeExecutionContext = {
            executionId,
            workflowId: workflow.id,
            stepId: step.id,
            inputs: { ...body.inputs, ...inputs },
            previousResults,
            companyId: body.context?.companyId,
            userId: body.context?.userId,
          }

          // 특수 노드 처리
          let result: { success: boolean; result?: unknown; error?: string; logs?: string[]; duration?: number }

          if (nodeType === 'trigger' || nodeType === 'input') {
            // Trigger/Input 노드는 입력 데이터를 전달
            result = {
              success: true,
              result: body.inputs || {},
              logs: ['[Trigger/Input] Passing through input data'],
            }
          } else if (nodeType === 'output') {
            // Output 노드는 이전 결과를 수집 (복사본 생성)
            const outputData = { ...previousResults }
            result = {
              success: true,
              result: outputData,
              logs: ['[Output] Collecting all previous results'],
            }
          } else if (nodeType === 'delay') {
            // Delay 노드
            const delayMs = step.action.delayMs || inputs.delayMs || 1000
            await new Promise(resolve => setTimeout(resolve, delayMs as number))
            result = {
              success: true,
              result: { delayed: delayMs },
              logs: [`[Delay] Waited ${delayMs}ms`],
            }
          } else if (nodeType === 'conditional') {
            // Conditional 노드 - 조건 평가
            const condition = inputs.condition as string || ''
            const conditionResult = evaluateCondition(condition, previousResults, body.inputs || {})
            result = {
              success: true,
              result: { conditionResult, condition },
              logs: [`[Conditional] Evaluated: ${conditionResult}`],
            }

            // 분기 처리
            if (step.branches && step.branches.length > 0) {
              // 조건에 따라 다음 단계 선택
              const trueBranch = step.branches.find(b =>
                b.condition.value === true || b.condition.value === 'true'
              )
              const falseBranch = step.branches.find(b =>
                b.condition.value === false || b.condition.value === 'false'
              )

              currentStepId = conditionResult
                ? (trueBranch?.nextStepId || step.nextStepId)
                : (falseBranch?.nextStepId || step.nextStepId)
            }
          } else if (nodeType === 'process') {
            // Process 노드 - 데이터 변환
            const processType = inputs.processType as string || 'transform'
            const processConfig = inputs.processConfig as string || ''
            result = executeProcess(processType, processConfig, previousResults, body.inputs || {})
          } else {
            // AI, HTTP, Code, Notification 등 - 노드 실행기 사용
            const nodeConfig = buildNodeConfig(nodeType, inputs, previousResults)
            result = await executeNode(nodeType, nodeConfig, nodeContext)
          }

          // 로그 이벤트
          if (result.logs) {
            result.logs.forEach(log => {
              sendEvent({
                type: 'log',
                executionId,
                nodeId: step.id,
                timestamp: new Date().toISOString(),
                data: { message: log },
              })
            })
          }

          if (result.success) {
            // 결과 저장 (output 노드는 저장하지 않음 - 순환 참조 방지)
            if (nodeType !== 'output') {
              previousResults[step.id] = result.result
            }

            // 완료 이벤트
            sendEvent({
              type: 'node_completed',
              executionId,
              nodeId: step.id,
              timestamp: new Date().toISOString(),
              data: {
                result: result.result,
                duration: result.duration,
              },
            })

            // 다음 단계 (conditional에서 이미 처리된 경우 스킵)
            if (nodeType !== 'conditional') {
              currentStepId = step.nextStepId
            }
          } else {
            // 실패 이벤트
            sendEvent({
              type: 'node_failed',
              executionId,
              nodeId: step.id,
              timestamp: new Date().toISOString(),
              data: {
                error: result.error,
              },
            })

            // 에러 처리 전략
            if (step.onError === 'skip') {
              currentStepId = step.nextStepId
            } else if (step.onError === 'continue') {
              previousResults[step.id] = { error: result.error }
              currentStepId = step.nextStepId
            } else {
              // fail - 워크플로우 종료
              throw new Error(result.error)
            }
          }
        }

        // 4. 완료 이벤트
        sendEvent({
          type: 'workflow_completed',
          executionId,
          timestamp: new Date().toISOString(),
          data: {
            outputs: previousResults,
            stepsExecuted: iteration,
          },
        })
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        // 실패 이벤트
        sendEvent({
          type: 'workflow_failed',
          executionId,
          timestamp: new Date().toISOString(),
          data: { error: errorMessage },
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

// 액션에서 노드 타입 추론
function getNodeTypeFromAction(action: { type: string; tool?: string }): string {
  switch (action.type) {
    case 'delay':
      return 'delay'
    case 'condition':
      return 'conditional'
    case 'notify':
      return 'notification'
    case 'api':
      return 'http'
    case 'tool':
      if (action.tool === 'execute_ai') return 'ai'
      if (action.tool === 'execute_code') return 'code'
      if (action.tool === 'workflow_trigger') return 'trigger'
      if (action.tool === 'workflow_input') return 'input'
      if (action.tool === 'workflow_output') return 'output'
      if (action.tool?.startsWith('process_')) return 'process'
      return 'process'
    default:
      return 'process'
  }
}

// 노드 설정 빌드
function buildNodeConfig(
  nodeType: string,
  inputs: Record<string, unknown>,
  previousResults: Record<string, unknown>
): unknown {
  switch (nodeType) {
    case 'ai':
      return {
        model: inputs.model || 'gpt-4o-mini',
        provider: inputs.provider || 'openai',
        prompt: inputs.prompt as string || '',
        systemPrompt: inputs.systemPrompt as string,
        temperature: inputs.temperature as number ?? 0.7,
        maxTokens: inputs.maxTokens as number,
        variables: previousResults,
      }

    case 'http':
      return {
        method: inputs.method || 'GET',
        url: inputs.url as string || '',
        headers: inputs.headers,
        body: inputs.body,
        timeout: inputs.timeout as number,
        auth: inputs.auth,
      }

    case 'code':
      return {
        code: inputs.code as string || '',
        language: inputs.language || 'javascript',
        timeout: inputs.timeout as number,
      }

    case 'notification':
      return {
        type: inputs.type || 'webhook',
        message: inputs.message as string || '',
        title: inputs.title as string,
        email: inputs.email,
        slack: inputs.slack,
        webhook: inputs.webhook || (inputs.target ? { url: inputs.target } : undefined),
      }

    default:
      return inputs
  }
}

// 조건 평가
function evaluateCondition(
  condition: string,
  previousResults: Record<string, unknown>,
  inputs: Record<string, unknown>
): boolean {
  if (!condition) return true

  try {
    // 간단한 조건 평가 (보안을 위해 제한적)
    const context = { ...previousResults, ...inputs }

    // "field == value" 형식
    const equalsMatch = condition.match(/^(\w+)\s*==\s*(.+)$/)
    if (equalsMatch) {
      const [, field, value] = equalsMatch
      const fieldValue = context[field]
      return String(fieldValue) === value.trim().replace(/['"]/g, '')
    }

    // "field > value" 형식
    const gtMatch = condition.match(/^(\w+)\s*>\s*(\d+)$/)
    if (gtMatch) {
      const [, field, value] = gtMatch
      const fieldValue = context[field]
      return Number(fieldValue) > Number(value)
    }

    // "field < value" 형식
    const ltMatch = condition.match(/^(\w+)\s*<\s*(\d+)$/)
    if (ltMatch) {
      const [, field, value] = ltMatch
      const fieldValue = context[field]
      return Number(fieldValue) < Number(value)
    }

    // "field" (truthy 체크)
    if (/^\w+$/.test(condition)) {
      return !!context[condition]
    }

    return true
  } catch {
    return true
  }
}

// Process 노드 실행
function executeProcess(
  processType: string,
  config: string,
  previousResults: Record<string, unknown>,
  inputs: Record<string, unknown>
): { success: boolean; result?: unknown; error?: string; logs?: string[] } {
  const logs: string[] = []
  const data = { ...previousResults, ...inputs }

  try {
    logs.push(`[Process] Type: ${processType}`)

    switch (processType) {
      case 'transform':
        // config에서 변환 규칙 파싱
        if (config) {
          try {
            const rules = JSON.parse(config)
            // 간단한 필드 매핑
            const result: Record<string, unknown> = {}
            Object.entries(rules).forEach(([key, path]) => {
              const value = getNestedValue(data, path as string)
              result[key] = value
            })
            return { success: true, result, logs }
          } catch {
            return { success: true, result: data, logs }
          }
        }
        return { success: true, result: data, logs }

      case 'filter':
        // 배열 필터링
        const lastResult = Object.values(previousResults).pop()
        if (Array.isArray(lastResult)) {
          logs.push(`[Process] Filtering array of ${lastResult.length} items`)
          // config가 있으면 조건으로 사용
          return { success: true, result: lastResult, logs }
        }
        return { success: true, result: data, logs }

      case 'aggregate':
        // 집계
        const arrayResult = Object.values(previousResults).find(v => Array.isArray(v))
        if (Array.isArray(arrayResult)) {
          logs.push(`[Process] Aggregating ${arrayResult.length} items`)
          return {
            success: true,
            result: {
              count: arrayResult.length,
              items: arrayResult,
            },
            logs,
          }
        }
        return { success: true, result: data, logs }

      case 'sort':
        // 정렬
        const sortableResult = Object.values(previousResults).find(v => Array.isArray(v))
        if (Array.isArray(sortableResult)) {
          logs.push(`[Process] Sorting ${sortableResult.length} items`)
          return {
            success: true,
            result: [...sortableResult].sort(),
            logs,
          }
        }
        return { success: true, result: data, logs }

      case 'merge':
        // 병합
        logs.push('[Process] Merging all results')
        return { success: true, result: data, logs }

      default:
        return { success: true, result: data, logs }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logs.push(`[Process] Error: ${errorMessage}`)
    return { success: false, error: errorMessage, logs }
  }
}

// 중첩 객체에서 값 추출
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[part]
  }

  return current
}
