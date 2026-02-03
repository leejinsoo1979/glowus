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
  // ========== INPUT NODES ==========
  {
    type: "trigger",
    label: "트리거",
    description: "워크플로우 시작점",
    icon: "Zap",
    color: "#22c55e",
    category: "input",
  },
  {
    type: "webhook",
    label: "웹훅",
    description: "HTTP 웹훅으로 트리거",
    icon: "Webhook",
    color: "#8b5cf6",
    category: "input",
  },
  {
    type: "schedule",
    label: "스케줄",
    description: "예약된 시간에 실행",
    icon: "Calendar",
    color: "#f59e0b",
    category: "input",
  },
  {
    type: "input",
    label: "데이터 입력",
    description: "수동 데이터 입력",
    icon: "Database",
    color: "#3b82f6",
    category: "input",
  },

  // ========== AI NODES ==========
  {
    type: "ai",
    label: "AI 채팅",
    description: "LLM으로 텍스트 생성",
    icon: "Brain",
    color: "#ec4899",
    category: "ai",
  },
  {
    type: "openai",
    label: "OpenAI",
    description: "GPT, DALL-E, Whisper",
    icon: "Sparkles",
    color: "#10b981",
    category: "ai",
  },

  // ========== DATA TRANSFORM NODES ==========
  {
    type: "json",
    label: "JSON",
    description: "JSON 파싱 및 변환",
    icon: "Braces",
    color: "#f97316",
    category: "data",
  },
  {
    type: "text",
    label: "텍스트",
    description: "문자열 처리",
    icon: "Type",
    color: "#06b6d4",
    category: "data",
  },
  {
    type: "math",
    label: "수학",
    description: "수학 연산",
    icon: "Calculator",
    color: "#8b5cf6",
    category: "data",
  },
  {
    type: "date",
    label: "날짜/시간",
    description: "날짜 포맷 및 계산",
    icon: "CalendarDays",
    color: "#14b8a6",
    category: "data",
  },
  {
    type: "array",
    label: "배열",
    description: "배열 조작",
    icon: "List",
    color: "#a855f7",
    category: "data",
  },
  {
    type: "set",
    label: "Set",
    description: "필드 값 설정",
    icon: "PenLine",
    color: "#6366f1",
    category: "data",
  },

  // ========== PROCESS NODES ==========
  {
    type: "process",
    label: "데이터 처리",
    description: "필터, 정렬, 집계",
    icon: "Settings",
    color: "#8b5cf6",
    category: "process",
  },
  {
    type: "code",
    label: "코드",
    description: "JavaScript 실행",
    icon: "Code",
    color: "#6b7280",
    category: "process",
  },

  // ========== CONTROL NODES ==========
  {
    type: "conditional",
    label: "IF 조건",
    description: "조건 분기",
    icon: "GitBranch",
    color: "#f59e0b",
    category: "control",
  },
  {
    type: "switch",
    label: "Switch",
    description: "다중 조건 분기",
    icon: "GitFork",
    color: "#ef4444",
    category: "control",
  },
  {
    type: "loop",
    label: "루프",
    description: "반복 실행",
    icon: "Repeat",
    color: "#22c55e",
    category: "control",
  },
  {
    type: "delay",
    label: "딜레이",
    description: "시간 대기",
    icon: "Clock",
    color: "#64748b",
    category: "control",
  },
  {
    type: "wait",
    label: "Wait",
    description: "이벤트 대기",
    icon: "Hourglass",
    color: "#78716c",
    category: "control",
  },
  {
    type: "error",
    label: "에러 처리",
    description: "에러 캐치 및 재시도",
    icon: "AlertTriangle",
    color: "#dc2626",
    category: "control",
  },
  {
    type: "merge",
    label: "Merge",
    description: "데이터 병합",
    icon: "Merge",
    color: "#0ea5e9",
    category: "control",
  },
  {
    type: "split",
    label: "Split",
    description: "데이터 분할",
    icon: "Split",
    color: "#f43f5e",
    category: "control",
  },

  // ========== INTEGRATION NODES ==========
  {
    type: "http",
    label: "HTTP",
    description: "REST API 호출",
    icon: "Globe",
    color: "#06b6d4",
    category: "integration",
  },
  {
    type: "database",
    label: "데이터베이스",
    description: "DB 쿼리 실행",
    icon: "Database",
    color: "#0284c7",
    category: "integration",
  },
  {
    type: "supabase",
    label: "Supabase",
    description: "Supabase 연동",
    icon: "Layers",
    color: "#22c55e",
    category: "integration",
  },
  {
    type: "googleSheets",
    label: "Google Sheets",
    description: "스프레드시트 연동",
    icon: "Sheet",
    color: "#34a853",
    category: "integration",
  },
  {
    type: "file",
    label: "파일",
    description: "파일 읽기/쓰기",
    icon: "File",
    color: "#78716c",
    category: "integration",
  },
  {
    type: "slack",
    label: "Slack",
    description: "Slack 메시지 전송",
    icon: "MessageSquare",
    color: "#4a154b",
    category: "integration",
  },
  {
    type: "discord",
    label: "Discord",
    description: "Discord 웹훅",
    icon: "MessageCircle",
    color: "#5865f2",
    category: "integration",
  },
  {
    type: "telegram",
    label: "Telegram",
    description: "텔레그램 봇 메시지",
    icon: "Send",
    color: "#0088cc",
    category: "integration",
  },
  {
    type: "email",
    label: "이메일",
    description: "이메일 전송",
    icon: "Mail",
    color: "#ea580c",
    category: "integration",
  },
  {
    type: "notification",
    label: "알림",
    description: "멀티채널 알림",
    icon: "Bell",
    color: "#f97316",
    category: "integration",
  },

  // ========== OUTPUT NODES ==========
  {
    type: "output",
    label: "결과 출력",
    description: "워크플로우 결과",
    icon: "FileOutput",
    color: "#10b981",
    category: "output",
  },
  {
    type: "webhookResponse",
    label: "웹훅 응답",
    description: "HTTP 응답 반환",
    icon: "Reply",
    color: "#8b5cf6",
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
  data: customData,
}: {
  type: string
  position: XYPosition
  id?: string
  data?: Partial<NodeData>
}): Node<NodeData> => {
  const nodeId = id || generateNodeId(type)
  const config = getNodeConfig(type as NodeType)

  const baseNode: Node<NodeData> = {
    id: nodeId,
    type,
    position,
    data: {
      label: customData?.label || config?.label || getDefaultLabel(type),
      description: customData?.description || config?.description || getDefaultDescription(type),
      ...customData,
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
    case "webhook":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          httpMethod: "POST",
        },
      }
    case "schedule":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          scheduleType: "cron",
          scheduleCron: "0 9 * * *",
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
    case "webhookResponse":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          webhookStatusCode: 200,
          webhookResponse: '{"success": true}',
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
    case "switch":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          switchField: "status",
          switchCases: '["pending", "active", "completed"]',
        },
      }
    case "loop":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          loopType: "forEach",
          loopConfig: "items",
        },
      }
    case "code":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          codeLanguage: "javascript",
          code: "// 입력: input 변수\n// 유틸리티: sum, average, first, last, unique\n\nconst result = input;\nreturn result;",
        },
      }
    case "ai":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          aiModel: "gpt-4o-mini",
          aiPrompt: "다음 데이터를 분석해주세요:\n{{input}}",
          aiTemperature: 0.7,
        },
      }
    case "openai":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          openaiOperation: "chat",
          aiModel: "gpt-4o",
          aiPrompt: "{{input}}",
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
    case "wait":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          waitType: "time",
          waitTimeout: 60000,
        },
      }
    case "error":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          errorType: "catch",
          retryCount: 3,
          retryDelay: 1000,
        },
      }
    case "merge":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          mergeType: "append",
        },
      }
    case "split":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          splitType: "items",
          splitSize: 10,
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
          httpAuth: "none",
        },
      }
    case "database":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          dbOperation: "select",
          dbTable: "users",
          dbQuery: "SELECT * FROM users WHERE active = true",
        },
      }
    case "supabase":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          supabaseOperation: "select",
          supabaseTable: "items",
          supabaseFilters: '{"column": "status", "value": "active"}',
        },
      }
    case "googleSheets":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          sheetsOperation: "read",
          sheetsRange: "Sheet1!A1:Z100",
        },
      }
    case "file":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          fileOperation: "read",
          filePath: "/data/input.json",
        },
      }
    case "json":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          jsonOperation: "parse",
          jsonPath: "$.data",
        },
      }
    case "text":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          textOperation: "replace",
          textPattern: "find",
          textReplacement: "replace",
        },
      }
    case "math":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          mathOperation: "sum",
          mathValues: "[1, 2, 3, 4, 5]",
        },
      }
    case "date":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          dateOperation: "format",
          dateFormat: "YYYY-MM-DD HH:mm:ss",
        },
      }
    case "array":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          arrayOperation: "filter",
          arrayConfig: "item.active === true",
        },
      }
    case "set":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          setMode: "manual",
          setFields: '{\n  "newField": "value"\n}',
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
    case "slack":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          notificationTarget: "#general",
          notificationMessage: "알림 메시지",
        },
      }
    case "discord":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          notificationMessage: "Discord 알림",
        },
      }
    case "telegram":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          notificationMessage: "텔레그램 메시지",
        },
      }
    case "email":
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          notificationTarget: "user@example.com",
          notificationMessage: "이메일 내용",
        },
      }
    default:
      return baseNode
  }
}

const getDefaultLabel = (type: string): string => {
  const labels: Record<string, string> = {
    trigger: "트리거",
    webhook: "웹훅",
    schedule: "스케줄",
    input: "입력",
    output: "출력",
    webhookResponse: "웹훅 응답",
    process: "처리",
    conditional: "조건",
    switch: "Switch",
    loop: "루프",
    code: "코드",
    ai: "AI",
    openai: "OpenAI",
    delay: "딜레이",
    wait: "Wait",
    error: "에러",
    merge: "Merge",
    split: "Split",
    http: "HTTP",
    database: "DB",
    supabase: "Supabase",
    googleSheets: "Sheets",
    file: "파일",
    json: "JSON",
    text: "텍스트",
    math: "수학",
    date: "날짜",
    array: "배열",
    set: "Set",
    notification: "알림",
    slack: "Slack",
    discord: "Discord",
    telegram: "Telegram",
    email: "이메일",
  }
  return labels[type] || "노드"
}

const getDefaultDescription = (type: string): string => {
  const descriptions: Record<string, string> = {
    trigger: "워크플로우 시작점",
    webhook: "HTTP 웹훅 트리거",
    schedule: "예약 실행",
    input: "데이터 입력 노드",
    output: "데이터 출력 노드",
    webhookResponse: "HTTP 응답 반환",
    process: "데이터 처리 노드",
    conditional: "조건 분기 노드",
    switch: "다중 분기",
    loop: "반복 실행",
    code: "커스텀 코드 실행",
    ai: "AI 모델 처리",
    openai: "OpenAI API",
    delay: "시간 지연",
    wait: "이벤트 대기",
    error: "에러 처리",
    merge: "데이터 병합",
    split: "데이터 분할",
    http: "HTTP 요청",
    database: "데이터베이스 쿼리",
    supabase: "Supabase 연동",
    googleSheets: "Google Sheets",
    file: "파일 작업",
    json: "JSON 처리",
    text: "텍스트 처리",
    math: "수학 연산",
    date: "날짜 처리",
    array: "배열 조작",
    set: "필드 설정",
    notification: "알림 전송",
    slack: "Slack 메시지",
    discord: "Discord 메시지",
    telegram: "텔레그램 메시지",
    email: "이메일 전송",
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
    (n) => n.type === "trigger" || n.type === "input" || n.type === "webhook" || n.type === "schedule"
  )
  if (!hasStartNode) {
    errors.push("워크플로우에 시작 노드가 필요합니다.")
  }

  // Check if there's at least one output node
  const hasEndNode = nodes.some((n) => n.type === "output" || n.type === "webhookResponse")
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
