/**
 * Workflow Execution Engine - 다단계 루프 워크플로우 실행 엔진
 */

import { v4 as uuidv4 } from 'uuid'
import {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowExecution,
  WorkflowStatus,
  StepStatus,
  StepExecutionResult,
  WorkflowCondition,
  InputMapping,
  ExecuteWorkflowRequest,
  ExecuteWorkflowResponse,
  WorkflowEvent,
} from './workflow-types'

// 도구 실행 함수 타입
type ToolExecutor = (toolName: string, params: Record<string, any>) => Promise<any>

// 이벤트 핸들러 타입
type EventHandler = (event: WorkflowEvent) => void

export class WorkflowEngine {
  private toolExecutor: ToolExecutor
  private eventHandlers: EventHandler[] = []
  private executions: Map<string, WorkflowExecution> = new Map()

  constructor(toolExecutor: ToolExecutor) {
    this.toolExecutor = toolExecutor
  }

  /**
   * 이벤트 핸들러 등록
   */
  onEvent(handler: EventHandler) {
    this.eventHandlers.push(handler)
  }

  /**
   * 이벤트 발생
   */
  private emitEvent(event: WorkflowEvent) {
    this.eventHandlers.forEach(handler => handler(event))
  }

  /**
   * 워크플로우 실행
   */
  async execute(
    workflow: WorkflowDefinition,
    request: ExecuteWorkflowRequest
  ): Promise<ExecuteWorkflowResponse> {
    // 실행 인스턴스 생성
    const execution: WorkflowExecution = {
      id: uuidv4(),
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      status: 'running',
      currentStepId: workflow.startStepId,
      inputs: request.inputs || {},
      stepResults: {},
      startedAt: new Date().toISOString(),
      context: request.context,
    }

    this.executions.set(execution.id, execution)

    // 시작 이벤트
    this.emitEvent({
      type: 'started',
      executionId: execution.id,
      timestamp: execution.startedAt,
      data: { workflowId: workflow.id, inputs: execution.inputs },
    })

    try {
      // 입력 유효성 검사
      this.validateInputs(workflow, execution.inputs)

      // 워크플로우 실행
      await this.runWorkflow(workflow, execution)

      // 완료 처리
      execution.status = 'completed'
      execution.completedAt = new Date().toISOString()
      execution.outputs = this.extractOutputs(execution)

      this.emitEvent({
        type: 'completed',
        executionId: execution.id,
        timestamp: execution.completedAt,
        data: { outputs: execution.outputs },
      })

      return {
        executionId: execution.id,
        status: execution.status,
        outputs: execution.outputs,
        stepResults: execution.stepResults,
      }
    } catch (error: any) {
      // 실패 처리
      execution.status = 'failed'
      execution.error = error.message
      execution.completedAt = new Date().toISOString()

      this.emitEvent({
        type: 'failed',
        executionId: execution.id,
        timestamp: execution.completedAt,
        data: { error: error.message },
      })

      return {
        executionId: execution.id,
        status: execution.status,
        error: execution.error,
        stepResults: execution.stepResults,
      }
    }
  }

  /**
   * 입력 유효성 검사
   */
  private validateInputs(workflow: WorkflowDefinition, inputs: Record<string, any>) {
    if (!workflow.inputSchema) return

    const required = workflow.inputSchema.required || []
    for (const field of required) {
      if (!(field in inputs)) {
        throw new Error(`필수 입력 필드가 없습니다: ${field}`)
      }
    }
  }

  /**
   * 워크플로우 실행 루프
   */
  private async runWorkflow(workflow: WorkflowDefinition, execution: WorkflowExecution) {
    const stepsMap = new Map(workflow.steps.map(s => [s.id, s]))
    let currentStepId: string | null | undefined = workflow.startStepId
    let iteration = 0
    const maxIterations = 1000 // 무한 루프 방지

    while (currentStepId && iteration < maxIterations) {
      iteration++
      execution.currentStepId = currentStepId

      const step = stepsMap.get(currentStepId)
      if (!step) {
        throw new Error(`단계를 찾을 수 없습니다: ${currentStepId}`)
      }

      // 루프 처리
      if (step.loop) {
        currentStepId = await this.executeLoop(step, workflow, execution, stepsMap)
      } else {
        // 일반 단계 실행
        const result = await this.executeStep(step, execution)
        currentStepId = this.determineNextStep(step, result, execution)
      }
    }

    if (iteration >= maxIterations) {
      throw new Error('워크플로우가 최대 반복 횟수를 초과했습니다')
    }
  }

  /**
   * 루프 실행
   */
  private async executeLoop(
    step: WorkflowStep,
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    stepsMap: Map<string, WorkflowStep>
  ): Promise<string | null | undefined> {
    const loop = step.loop!
    const maxIterations = loop.maxIterations || 100
    let loopResults: any[] = []

    if (loop.type === 'for_each' && loop.source) {
      // 배열 순회
      const sourceData = this.resolveValue(loop.source, execution)
      if (!Array.isArray(sourceData)) {
        throw new Error(`루프 소스가 배열이 아닙니다: ${loop.source}`)
      }

      for (let i = 0; i < Math.min(sourceData.length, maxIterations); i++) {
        // 현재 아이템을 컨텍스트에 추가
        const loopContext = { ...execution.inputs, _loopItem: sourceData[i], _loopIndex: i }
        const tempInputs = execution.inputs
        execution.inputs = loopContext

        const result = await this.executeStep(step, execution, i, sourceData.length)
        loopResults.push(result.result)

        execution.inputs = tempInputs
      }
    } else if (loop.type === 'count' && loop.count) {
      // 횟수 반복
      for (let i = 0; i < Math.min(loop.count, maxIterations); i++) {
        const loopContext = { ...execution.inputs, _loopIndex: i }
        const tempInputs = execution.inputs
        execution.inputs = loopContext

        const result = await this.executeStep(step, execution, i, loop.count)
        loopResults.push(result.result)

        execution.inputs = tempInputs
      }
    } else if (loop.type === 'while' && loop.condition) {
      // 조건 반복
      let i = 0
      while (this.evaluateCondition(loop.condition, execution) && i < maxIterations) {
        const result = await this.executeStep(step, execution, i)
        loopResults.push(result.result)
        i++
      }
    }

    // 루프 결과 저장
    execution.stepResults[step.id].result = loopResults

    return step.nextStepId
  }

  /**
   * 단계 실행
   */
  private async executeStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    loopIteration?: number,
    loopTotal?: number
  ): Promise<StepExecutionResult> {
    const resultKey = loopIteration !== undefined ? `${step.id}_${loopIteration}` : step.id

    const stepResult: StepExecutionResult = {
      stepId: step.id,
      status: 'running',
      startedAt: new Date().toISOString(),
      loopIteration,
      loopTotal,
    }

    execution.stepResults[resultKey] = stepResult

    this.emitEvent({
      type: 'step_started',
      executionId: execution.id,
      stepId: step.id,
      timestamp: stepResult.startedAt,
      data: { loopIteration, loopTotal },
    })

    try {
      // 입력 준비
      const inputs = this.prepareInputs(step, execution)

      // 액션 실행
      let result: any

      switch (step.action.type) {
        case 'tool':
          result = await this.executeToolAction(step, inputs, execution)
          break
        case 'api':
          result = await this.executeApiAction(step, inputs)
          break
        case 'condition':
          result = this.executeConditionAction(step, execution)
          break
        case 'delay':
          await this.sleep(step.action.delayMs || 1000)
          result = { delayed: step.action.delayMs }
          break
        case 'notify':
          result = await this.executeNotifyAction(step, inputs, execution)
          break
        default:
          throw new Error(`지원하지 않는 액션 타입: ${step.action.type}`)
      }

      // 성공 처리
      stepResult.status = 'completed'
      stepResult.result = result
      stepResult.completedAt = new Date().toISOString()

      this.emitEvent({
        type: 'step_completed',
        executionId: execution.id,
        stepId: step.id,
        timestamp: stepResult.completedAt,
        data: { result },
      })

      return stepResult
    } catch (error: any) {
      // 에러 처리
      stepResult.error = error.message

      if (step.onError === 'retry' && step.retryCount) {
        // 재시도
        for (let i = 0; i < step.retryCount; i++) {
          await this.sleep(step.retryDelayMs || 1000)
          try {
            const inputs = this.prepareInputs(step, execution)
            const result = await this.executeToolAction(step, inputs, execution)
            stepResult.status = 'completed'
            stepResult.result = result
            stepResult.completedAt = new Date().toISOString()
            return stepResult
          } catch (retryError) {
            // 재시도 실패
          }
        }
      }

      if (step.onError === 'skip') {
        stepResult.status = 'skipped'
        stepResult.completedAt = new Date().toISOString()
        return stepResult
      }

      if (step.onError === 'continue') {
        stepResult.status = 'failed'
        stepResult.completedAt = new Date().toISOString()
        return stepResult
      }

      // 기본: 실패로 처리 (onError가 'fail' 또는 undefined인 경우)
      stepResult.status = 'failed'
      stepResult.completedAt = new Date().toISOString()

      this.emitEvent({
        type: 'step_failed',
        executionId: execution.id,
        stepId: step.id,
        timestamp: stepResult.completedAt,
        data: { error: error.message },
      })

      // 'retry', 'skip', 'continue'는 위에서 처리됨. 여기는 'fail' 또는 undefined
      throw error
    }
  }

  /**
   * 입력 준비
   */
  private prepareInputs(step: WorkflowStep, execution: WorkflowExecution): Record<string, any> {
    const inputs: Record<string, any> = { ...step.inputs }

    // 입력 매핑 적용
    if (step.inputMappings) {
      for (const mapping of step.inputMappings) {
        let value = this.resolveValue(mapping.from, execution)

        // 변환 적용
        if (mapping.transform) {
          value = this.applyTransform(value, mapping.transform)
        }

        inputs[mapping.to] = value
      }
    }

    return inputs
  }

  /**
   * 값 해석 (경로에서 값 추출)
   */
  private resolveValue(path: string, execution: WorkflowExecution): any {
    const parts = path.split('.')

    // 특수 접두사 처리
    if (parts[0] === 'inputs') {
      return this.getNestedValue(execution.inputs, parts.slice(1))
    }

    if (parts[0] === 'context') {
      return this.getNestedValue(execution.context || {}, parts.slice(1))
    }

    // 단계 결과 참조 (step_id.result.field)
    const stepId = parts[0]
    const stepResult = execution.stepResults[stepId]
    if (stepResult) {
      return this.getNestedValue(stepResult, parts.slice(1))
    }

    // 현재 입력에서 찾기
    return this.getNestedValue(execution.inputs, parts)
  }

  /**
   * 중첩 객체에서 값 가져오기
   */
  private getNestedValue(obj: any, path: string[]): any {
    let current = obj
    for (const key of path) {
      if (current === null || current === undefined) return undefined
      current = current[key]
    }
    return current
  }

  /**
   * 변환 적용
   */
  private applyTransform(value: any, transform: string): any {
    if (!Array.isArray(value)) return value

    switch (transform) {
      case 'first':
        return value[0]
      case 'last':
        return value[value.length - 1]
      case 'count':
        return value.length
      case 'sum':
        return value.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0)
      case 'join':
        return value.join(', ')
      case 'json':
        return JSON.stringify(value)
      default:
        return value
    }
  }

  /**
   * 조건 평가
   */
  private evaluateCondition(condition: WorkflowCondition, execution: WorkflowExecution): boolean {
    const fieldValue = this.resolveValue(condition.field, execution)

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value
      case 'not_equals':
        return fieldValue !== condition.value
      case 'contains':
        return String(fieldValue).includes(String(condition.value))
      case 'greater_than':
        return fieldValue > condition.value
      case 'less_than':
        return fieldValue < condition.value
      case 'is_empty':
        return !fieldValue || (Array.isArray(fieldValue) && fieldValue.length === 0)
      case 'is_not_empty':
        return !!fieldValue && (!Array.isArray(fieldValue) || fieldValue.length > 0)
      case 'regex_match':
        return new RegExp(condition.value).test(String(fieldValue))
      default:
        return false
    }
  }

  /**
   * 다음 단계 결정
   */
  private determineNextStep(
    step: WorkflowStep,
    result: StepExecutionResult,
    execution: WorkflowExecution
  ): string | null | undefined {
    // 분기 조건 평가
    if (step.branches) {
      for (const branch of step.branches) {
        if (this.evaluateCondition(branch.condition, execution)) {
          return branch.nextStepId
        }
      }
    }

    // 기본 다음 단계
    return step.nextStepId
  }

  /**
   * 도구 액션 실행
   */
  private async executeToolAction(
    step: WorkflowStep,
    inputs: Record<string, any>,
    execution: WorkflowExecution
  ): Promise<any> {
    const toolName = step.action.tool
    if (!toolName) {
      throw new Error('도구 이름이 지정되지 않았습니다')
    }

    // 컨텍스트 정보 추가
    const params = {
      ...inputs,
      _context: execution.context,
    }

    return await this.toolExecutor(toolName, params)
  }

  /**
   * API 액션 실행
   */
  private async executeApiAction(step: WorkflowStep, inputs: Record<string, any>): Promise<any> {
    const endpoint = step.action.endpoint
    const method = step.action.method || 'POST'

    if (!endpoint) {
      throw new Error('API 엔드포인트가 지정되지 않았습니다')
    }

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: method !== 'GET' ? JSON.stringify(inputs) : undefined,
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    return await response.json()
  }

  /**
   * 조건 액션 실행 (분기점)
   */
  private executeConditionAction(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): { matched: boolean; branch?: string } {
    if (!step.branches) {
      return { matched: false }
    }

    for (const branch of step.branches) {
      if (this.evaluateCondition(branch.condition, execution)) {
        return { matched: true, branch: branch.nextStepId }
      }
    }

    return { matched: false }
  }

  /**
   * 알림 액션 실행
   */
  private async executeNotifyAction(
    step: WorkflowStep,
    inputs: Record<string, any>,
    execution: WorkflowExecution
  ): Promise<any> {
    // 알림 로직 (확장 가능)
    console.log(`[Workflow Notify] ${execution.id}:`, inputs)
    return { notified: true, ...inputs }
  }

  /**
   * 출력 추출
   */
  private extractOutputs(execution: WorkflowExecution): Record<string, any> {
    const outputs: Record<string, any> = {}

    // 모든 완료된 단계의 결과 수집
    for (const [stepId, result] of Object.entries(execution.stepResults)) {
      if (result.status === 'completed' && result.result !== undefined) {
        outputs[stepId] = result.result
      }
    }

    return outputs
  }

  /**
   * 실행 상태 조회
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId)
  }

  /**
   * 실행 일시 중지
   */
  pauseExecution(executionId: string): boolean {
    const execution = this.executions.get(executionId)
    if (execution && execution.status === 'running') {
      execution.status = 'paused'
      return true
    }
    return false
  }

  /**
   * 실행 취소
   */
  cancelExecution(executionId: string): boolean {
    const execution = this.executions.get(executionId)
    if (execution && ['running', 'paused'].includes(execution.status)) {
      execution.status = 'cancelled'
      execution.completedAt = new Date().toISOString()
      return true
    }
    return false
  }

  /**
   * sleep 유틸리티
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// 싱글톤 인스턴스 생성 헬퍼
export function createWorkflowEngine(toolExecutor: ToolExecutor): WorkflowEngine {
  return new WorkflowEngine(toolExecutor)
}
