/**
 * ReactFlow ↔ WorkflowDefinition 변환기
 * UI 노드를 워크플로우 엔진이 이해하는 형식으로 변환
 */

import type { Node, Edge } from 'reactflow'
import type { NodeData } from './types'
import type { WorkflowDefinition, WorkflowStep, WorkflowBranch, WorkflowCondition } from './workflow-types'
import { v4 as uuidv4 } from 'uuid'

/**
 * ReactFlow 노드/엣지를 WorkflowDefinition으로 변환
 */
export function convertReactFlowToWorkflowDefinition(
  nodes: Node<NodeData>[],
  edges: Edge[],
  metadata?: {
    id?: string
    name?: string
    description?: string
  }
): WorkflowDefinition {
  // 1. 시작 노드 찾기 (trigger 타입 또는 진입 엣지가 없는 노드)
  const triggerNode = nodes.find(n => n.type === 'trigger')
  const nodesWithIncomingEdges = new Set(edges.map(e => e.target))
  const startNode = triggerNode || nodes.find(n => !nodesWithIncomingEdges.has(n.id))

  if (!startNode) {
    throw new Error('시작 노드를 찾을 수 없습니다')
  }

  // 2. 엣지 맵 생성 (source -> targets)
  const outgoingEdges = new Map<string, Edge[]>()
  edges.forEach(edge => {
    const existing = outgoingEdges.get(edge.source) || []
    existing.push(edge)
    outgoingEdges.set(edge.source, existing)
  })

  // 3. 노드를 WorkflowStep으로 변환
  const steps: WorkflowStep[] = nodes.map(node => {
    const outEdges = outgoingEdges.get(node.id) || []
    const step = convertNodeToStep(node, outEdges)
    return step
  })

  // 4. WorkflowDefinition 생성
  const workflow: WorkflowDefinition = {
    id: metadata?.id || uuidv4(),
    name: metadata?.name || 'Untitled Workflow',
    description: metadata?.description,
    version: '1.0.0',
    steps,
    startStepId: startNode.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  return workflow
}

/**
 * 개별 노드를 WorkflowStep으로 변환
 */
function convertNodeToStep(node: Node<NodeData>, outEdges: Edge[]): WorkflowStep {
  const data = node.data
  const nodeType = node.type as string

  // 기본 step 구조
  const step: WorkflowStep = {
    id: node.id,
    name: data.label || nodeType,
    description: data.description,
    action: getActionForNodeType(nodeType, data),
    inputs: getInputsForNodeType(nodeType, data),
    onError: 'fail',
  }

  // 다음 단계 연결
  if (outEdges.length === 1) {
    // 단일 출력
    step.nextStepId = outEdges[0].target
  } else if (outEdges.length > 1 && nodeType === 'conditional') {
    // 조건 분기 (conditional 노드)
    step.branches = outEdges.map(edge => {
      const branchLabel = edge.sourceHandle || (typeof edge.label === 'string' ? edge.label : undefined) || 'default'
      return {
        condition: createConditionFromLabel(branchLabel, data.condition),
        nextStepId: edge.target,
      }
    })
    // 기본 분기 (첫 번째 엣지)
    step.nextStepId = outEdges[0].target
  } else if (outEdges.length > 1) {
    // 여러 출력이 있지만 conditional이 아닌 경우, 첫 번째 사용
    step.nextStepId = outEdges[0].target
  } else {
    // 출력 없음 (종료)
    step.nextStepId = null
  }

  return step
}

/**
 * 노드 타입에 따른 action 생성
 */
function getActionForNodeType(
  nodeType: string,
  data: NodeData
): WorkflowStep['action'] {
  switch (nodeType) {
    case 'trigger':
      return {
        type: 'tool',
        tool: 'workflow_trigger',
      }

    case 'input':
      return {
        type: 'tool',
        tool: 'workflow_input',
      }

    case 'output':
      return {
        type: 'tool',
        tool: 'workflow_output',
      }

    case 'process':
      return {
        type: 'tool',
        tool: `process_${data.processType || 'transform'}`,
      }

    case 'conditional':
      return {
        type: 'condition',
      }

    case 'code':
      return {
        type: 'tool',
        tool: 'execute_code',
      }

    case 'ai':
      return {
        type: 'tool',
        tool: 'execute_ai',
      }

    case 'delay':
      return {
        type: 'delay',
        delayMs: convertDelayToMs(data.delayMs, data.delayUnit),
      }

    case 'http':
      return {
        type: 'api',
        endpoint: data.httpUrl,
        method: (data.httpMethod || 'GET') as 'GET' | 'POST' | 'PUT' | 'DELETE',
      }

    case 'notification':
      return {
        type: 'notify',
      }

    default:
      return {
        type: 'tool',
        tool: nodeType,
      }
  }
}

/**
 * 노드 타입에 따른 inputs 생성
 */
function getInputsForNodeType(
  nodeType: string,
  data: NodeData
): Record<string, unknown> {
  switch (nodeType) {
    case 'input':
      return {
        dataSource: data.dataSource,
        sampleData: data.sampleData,
      }

    case 'output':
      return {
        outputType: data.outputType,
        outputFormat: data.outputFormat,
      }

    case 'process':
      return {
        processType: data.processType,
        processConfig: data.processConfig,
      }

    case 'conditional':
      return {
        condition: data.condition,
        trueLabel: data.trueLabel,
        falseLabel: data.falseLabel,
      }

    case 'code':
      return {
        code: data.code,
        language: data.codeLanguage || 'javascript',
      }

    case 'ai':
      return {
        model: data.aiModel || 'gpt-4o-mini',
        prompt: data.aiPrompt,
        temperature: data.aiTemperature ?? 0.7,
      }

    case 'delay':
      return {
        delayMs: convertDelayToMs(data.delayMs, data.delayUnit),
        delayUnit: data.delayUnit,
      }

    case 'http':
      return {
        method: data.httpMethod || 'GET',
        url: data.httpUrl,
        headers: data.httpHeaders,
        body: data.httpBody,
      }

    case 'notification':
      return {
        type: data.notificationType || 'email',
        target: data.notificationTarget,
        message: data.notificationMessage,
      }

    default:
      return {}
  }
}

/**
 * 지연 시간을 밀리초로 변환
 */
function convertDelayToMs(
  value?: number,
  unit?: 'ms' | 's' | 'm' | 'h'
): number {
  const amount = value || 1000

  switch (unit) {
    case 's':
      return amount * 1000
    case 'm':
      return amount * 60 * 1000
    case 'h':
      return amount * 60 * 60 * 1000
    case 'ms':
    default:
      return amount
  }
}

/**
 * 조건 분기 라벨에서 WorkflowCondition 생성
 */
function createConditionFromLabel(
  label: string,
  conditionExpression?: string
): WorkflowCondition {
  // true/false 분기
  if (label.toLowerCase() === 'true' || label === 'yes') {
    return {
      field: conditionExpression || '_result',
      operator: 'equals',
      value: true,
    }
  }

  if (label.toLowerCase() === 'false' || label === 'no') {
    return {
      field: conditionExpression || '_result',
      operator: 'equals',
      value: false,
    }
  }

  // 기본 조건
  return {
    field: '_branch',
    operator: 'equals',
    value: label,
  }
}

/**
 * WorkflowDefinition을 ReactFlow 노드/엣지로 변환 (역변환)
 */
export function convertWorkflowDefinitionToReactFlow(
  workflow: WorkflowDefinition
): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const nodes: Node<NodeData>[] = []
  const edges: Edge[] = []

  // 노드 위치 계산을 위한 레이아웃
  const stepsMap = new Map(workflow.steps.map((s, i) => [s.id, { step: s, index: i }]))

  workflow.steps.forEach((step, index) => {
    // 노드 타입 결정
    const nodeType = getNodeTypeFromAction(step.action)

    // 노드 데이터
    const nodeData: NodeData = {
      label: step.name,
      description: step.description,
      ...getNodeDataFromInputs(nodeType, step.inputs || {}),
    }

    // 노드 위치 (간단한 수직 레이아웃)
    const position = {
      x: 300,
      y: 100 + index * 150,
    }

    nodes.push({
      id: step.id,
      type: nodeType,
      position,
      data: nodeData,
    })

    // 엣지 생성
    if (step.nextStepId) {
      edges.push({
        id: `${step.id}-${step.nextStepId}`,
        source: step.id,
        target: step.nextStepId,
        type: 'smoothstep',
        animated: true,
      })
    }

    // 분기 엣지
    if (step.branches) {
      step.branches.forEach((branch, branchIndex) => {
        edges.push({
          id: `${step.id}-${branch.nextStepId}-${branchIndex}`,
          source: step.id,
          target: branch.nextStepId,
          sourceHandle: branch.condition.value?.toString() || `branch-${branchIndex}`,
          type: 'smoothstep',
          animated: true,
          label: branch.condition.value?.toString(),
        })
      })
    }
  })

  return { nodes, edges }
}

/**
 * action에서 노드 타입 추론
 */
function getNodeTypeFromAction(action: WorkflowStep['action']): string {
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

/**
 * inputs에서 NodeData 필드 추출
 */
function getNodeDataFromInputs(
  nodeType: string,
  inputs: Record<string, unknown>
): Partial<NodeData> {
  switch (nodeType) {
    case 'ai':
      return {
        aiModel: inputs.model as NodeData['aiModel'],
        aiPrompt: inputs.prompt as string,
        aiTemperature: inputs.temperature as number,
      }

    case 'http':
      return {
        httpMethod: inputs.method as NodeData['httpMethod'],
        httpUrl: inputs.url as string,
        httpHeaders: inputs.headers as string,
        httpBody: inputs.body as string,
      }

    case 'code':
      return {
        code: inputs.code as string,
        codeLanguage: inputs.language as NodeData['codeLanguage'],
      }

    case 'notification':
      return {
        notificationType: inputs.type as NodeData['notificationType'],
        notificationTarget: inputs.target as string,
        notificationMessage: inputs.message as string,
      }

    case 'delay':
      return {
        delayMs: inputs.delayMs as number,
        delayUnit: inputs.delayUnit as NodeData['delayUnit'],
      }

    case 'process':
      return {
        processType: inputs.processType as NodeData['processType'],
        processConfig: inputs.processConfig as string,
      }

    case 'conditional':
      return {
        condition: inputs.condition as string,
        trueLabel: inputs.trueLabel as string,
        falseLabel: inputs.falseLabel as string,
      }

    default:
      return {}
  }
}
