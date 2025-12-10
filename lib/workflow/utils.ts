import type { Node, XYPosition } from "reactflow"
import type { NodeData, NodeType, NodeTypeConfig } from "./types"

let nodeIdCounter = 0

export const generateNodeId = (type: string): string => {
  nodeIdCounter++
  return `${type}-${Date.now()}-${nodeIdCounter}`
}

export const resetNodeIdCounter = (): void => {
  nodeIdCounter = 0
}

export const NODE_CONFIGS: NodeTypeConfig[] = [
  // Input nodes
  {
    type: "trigger",
    label: "트리거",
    description: "워크플로우 시작점",
    icon: "Zap",
    color: "#22c55e",
    category: "input",
  },
  {
    type: "input",
    label: "데이터 입력",
    description: "외부 데이터 소스 연결",
    icon: "Database",
    color: "var(--accent-color)",
    category: "input",
  },
  // Process nodes
  {
    type: "process",
    label: "데이터 처리",
    description: "데이터 변환 및 처리",
    icon: "Settings",
    color: "#8b5cf6",
    category: "process",
  },
  {
    type: "conditional",
    label: "조건 분기",
    description: "조건에 따른 흐름 분기",
    icon: "GitBranch",
    color: "#f59e0b",
    category: "control",
  },
  {
    type: "code",
    label: "커스텀 코드",
    description: "사용자 정의 코드 실행",
    icon: "Code",
    color: "#6b7280",
    category: "process",
  },
  {
    type: "ai",
    label: "AI 처리",
    description: "AI 모델로 데이터 처리",
    icon: "Brain",
    color: "#ec4899",
    category: "process",
  },
  {
    type: "delay",
    label: "딜레이",
    description: "지정 시간 대기",
    icon: "Clock",
    color: "#64748b",
    category: "control",
  },
  // Integration nodes
  {
    type: "http",
    label: "HTTP 요청",
    description: "외부 API 호출",
    icon: "Globe",
    color: "#06b6d4",
    category: "integration",
  },
  {
    type: "notification",
    label: "알림",
    description: "이메일/슬랙 알림 전송",
    icon: "Bell",
    color: "#f97316",
    category: "integration",
  },
  // Output nodes
  {
    type: "output",
    label: "결과 출력",
    description: "워크플로우 결과 출력",
    icon: "FileOutput",
    color: "#10b981",
    category: "output",
  },
]

export const getNodeConfig = (type: NodeType): NodeTypeConfig | undefined => {
  return NODE_CONFIGS.find((config) => config.type === type)
}

export const createNode = ({
  type,
  position,
  id,
}: {
  type: string
  position: XYPosition
  id?: string
}): Node<NodeData> => {
  const nodeId = id || generateNodeId(type)
  const config = getNodeConfig(type as NodeType)

  const baseNode: Node<NodeData> = {
    id: nodeId,
    type,
    position,
    data: {
      label: config?.label || getDefaultLabel(type),
      description: config?.description || getDefaultDescription(type),
    },
  }

  // Add type-specific default data
  switch (type) {
    case "trigger":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          dataSource: "webhook",
        },
      }
    case "input":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          dataSource: "manual",
          sampleData: '{\n  "example": "data"\n}',
        },
      }
    case "output":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          outputType: "console",
          outputFormat: "json",
        },
      }
    case "process":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          processType: "transform",
          processConfig: '{\n  "operation": "map"\n}',
        },
      }
    case "conditional":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          condition: "data.value > 0",
          trueLabel: "Yes",
          falseLabel: "No",
        },
      }
    case "code":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          codeLanguage: "javascript",
          code: "// 데이터 처리 코드\nfunction process(data) {\n  // 데이터 변환\n  return data;\n}",
        },
      }
    case "ai":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          aiModel: "gpt-4",
          aiPrompt: "다음 데이터를 분석해주세요:\n{{input}}",
          aiTemperature: 0.7,
        },
      }
    case "delay":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          delayMs: 1000,
          delayUnit: "ms",
        },
      }
    case "http":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          httpMethod: "GET",
          httpUrl: "https://api.example.com/data",
          httpHeaders: '{\n  "Content-Type": "application/json"\n}',
        },
      }
    case "notification":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          notificationType: "slack",
          notificationMessage: "워크플로우가 완료되었습니다.",
        },
      }
    default:
      return baseNode
  }
}

const getDefaultLabel = (type: string): string => {
  const labels: Record<string, string> = {
    trigger: "트리거",
    input: "입력",
    output: "출력",
    process: "처리",
    conditional: "조건",
    code: "코드",
    ai: "AI",
    delay: "딜레이",
    http: "HTTP",
    notification: "알림",
  }
  return labels[type] || "노드"
}

const getDefaultDescription = (type: string): string => {
  const descriptions: Record<string, string> = {
    trigger: "워크플로우 시작점",
    input: "데이터 입력 노드",
    output: "데이터 출력 노드",
    process: "데이터 처리 노드",
    conditional: "조건 분기 노드",
    code: "커스텀 코드 실행",
    ai: "AI 모델 처리",
    delay: "시간 지연",
    http: "HTTP 요청",
    notification: "알림 전송",
  }
  return descriptions[type] || "워크플로우 노드"
}

export const validateWorkflow = (
  nodes: Node<NodeData>[],
  edges: { source: string; target: string }[]
): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  // Check if there's at least one trigger or input node
  const hasStartNode = nodes.some(
    (n) => n.type === "trigger" || n.type === "input"
  )
  if (!hasStartNode) {
    errors.push("워크플로우에 시작 노드(트리거 또는 입력)가 필요합니다.")
  }

  // Check if there's at least one output node
  const hasEndNode = nodes.some((n) => n.type === "output")
  if (!hasEndNode) {
    errors.push("워크플로우에 출력 노드가 필요합니다.")
  }

  // Check for orphan nodes (nodes with no connections)
  const connectedNodeIds = new Set<string>()
  edges.forEach((edge) => {
    connectedNodeIds.add(edge.source)
    connectedNodeIds.add(edge.target)
  })

  if (nodes.length > 1) {
    nodes.forEach((node) => {
      if (!connectedNodeIds.has(node.id)) {
        errors.push(`노드 "${node.data.label}"이(가) 연결되지 않았습니다.`)
      }
    })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export const exportWorkflowToJson = (
  nodes: Node<NodeData>[],
  edges: { id: string; source: string; target: string }[]
): string => {
  return JSON.stringify(
    {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      nodes,
      edges,
    },
    null,
    2
  )
}

export const importWorkflowFromJson = (
  jsonString: string
): { nodes: Node<NodeData>[]; edges: { id: string; source: string; target: string }[] } | null => {
  try {
    const data = JSON.parse(jsonString)
    if (data.nodes && data.edges) {
      return {
        nodes: data.nodes,
        edges: data.edges,
      }
    }
    return null
  } catch {
    return null
  }
}
