/**
 * Node Executors Registry
 * 워크플로우 노드별 실행기 등록 및 관리
 */

import { executeAINode, type AINodeConfig } from './ai-executor'
import { executeHTTPNode, type HTTPNodeConfig } from './http-executor'
import { executeCodeNode, type CodeNodeConfig } from './code-executor'
import { executeNotificationNode, type NotificationNodeConfig } from './notification-executor'

export type { AINodeConfig } from './ai-executor'
export type { HTTPNodeConfig } from './http-executor'
export type { CodeNodeConfig } from './code-executor'
export type { NotificationNodeConfig } from './notification-executor'

export interface NodeExecutionContext {
  executionId: string
  workflowId: string
  stepId: string
  inputs: Record<string, unknown>
  previousResults: Record<string, unknown>
  companyId?: string
  userId?: string
}

export interface NodeExecutionResult {
  success: boolean
  result?: unknown
  error?: string
  logs?: string[]
  duration?: number
}

export type NodeExecutor<T = unknown> = (
  config: T,
  context: NodeExecutionContext
) => Promise<NodeExecutionResult>

// 노드 실행기 레지스트리
const executors: Record<string, NodeExecutor<unknown>> = {
  ai: executeAINode as NodeExecutor<unknown>,
  http: executeHTTPNode as NodeExecutor<unknown>,
  code: executeCodeNode as NodeExecutor<unknown>,
  notification: executeNotificationNode as NodeExecutor<unknown>,
}

/**
 * 노드 타입에 해당하는 실행기 조회
 */
export function getNodeExecutor(nodeType: string): NodeExecutor<unknown> | undefined {
  return executors[nodeType]
}

/**
 * 새 노드 실행기 등록
 */
export function registerNodeExecutor<T>(
  nodeType: string,
  executor: NodeExecutor<T>
): void {
  executors[nodeType] = executor as NodeExecutor<unknown>
}

/**
 * 노드 실행 (타입에 따라 적절한 실행기 선택)
 */
export async function executeNode(
  nodeType: string,
  config: unknown,
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const executor = getNodeExecutor(nodeType)

  if (!executor) {
    return {
      success: false,
      error: `지원하지 않는 노드 타입: ${nodeType}`,
    }
  }

  const startTime = Date.now()

  try {
    const result = await executor(config, context)
    return {
      ...result,
      duration: Date.now() - startTime,
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime,
    }
  }
}

// Re-export individual executors
export { executeAINode } from './ai-executor'
export { executeHTTPNode } from './http-executor'
export { executeCodeNode } from './code-executor'
export { executeNotificationNode } from './notification-executor'
