import { v4 as uuidv4 } from "uuid"
import type {
  AgentNode,
  AgentNodeData,
  AgentEdge,
  AgentType,
  AgentNodeTypeConfig,
  AgentTemplate,
} from "./types"
import type { DeployedAgent, AgentStatus } from "@/types/database"

// Generate unique node ID
export function generateAgentNodeId(type: AgentType): string {
  return `${type}-${uuidv4().slice(0, 8)}`
}

// Node type configurations
// Node type configurations
export const AGENT_NODE_CONFIGS: Record<AgentType, AgentNodeTypeConfig> = {
  start: {
    type: "start",
    label: "Start",
    labelKo: "Start",
    description: "Workflow entry point",
    descriptionKo: "Workflow entry point",
    icon: "Play",
    color: "#22c55e", // Green
    bgColor: "#22c55e20",
    borderColor: "#22c55e",
    category: "core",
    handles: { inputs: 0, outputs: 1 },
  },
  prompt: {
    type: "prompt",
    label: "Prompt",
    labelKo: "Prompt",
    description: "Input text or prompt",
    descriptionKo: "Input text or prompt",
    icon: "FileText",
    color: "#d946ef", // Fuchsia/Pink
    bgColor: "#d946ef20",
    borderColor: "#d946ef",
    category: "core",
    handles: { inputs: 1, outputs: 1 },
  },
  llm: {
    type: "llm",
    label: "Text Model",
    labelKo: "Text Model",
    description: "Generate text with LLM",
    descriptionKo: "Generate text with LLM",
    icon: "Brain",
    color: "#8b5cf6", // Violet
    bgColor: "#8b5cf620",
    borderColor: "#8b5cf6",
    category: "core",
    handles: { inputs: 1, outputs: 1 },
  },
  image_generation: {
    type: "image_generation",
    label: "Image Generation",
    labelKo: "Image Generation",
    description: "Generate images",
    descriptionKo: "Generate images",
    icon: "Image",
    color: "#6366f1", // Indigo
    bgColor: "#6366f120",
    borderColor: "#6366f1",
    category: "tools",
    handles: { inputs: 1, outputs: 1 },
  },
  tool: { // Renamed from "tool" to indicate HTTP Request in UI
    type: "tool",
    label: "HTTP Request",
    labelKo: "HTTP Request",
    description: "Call external APIs",
    descriptionKo: "Call external APIs",
    icon: "Globe", // Or Activity/Globe
    color: "#ec4899", // Pink
    bgColor: "#ec489920",
    borderColor: "#ec4899",
    category: "tools",
    handles: { inputs: 1, outputs: 1 },
  },
  router: { // Conditional
    type: "router",
    label: "Conditional",
    labelKo: "Conditional",
    description: "Branch based on condition",
    descriptionKo: "Branch based on condition",
    icon: "GitBranch", // Or ArrowRight? Reference has a specific branching icon. GitBranch is close.
    color: "#a855f7", // Purple
    bgColor: "#a855f720",
    borderColor: "#a855f7",
    category: "control",
    handles: { inputs: 1, outputs: 2 }, // Usually 2 outputs (True/False)
  },
  javascript: {
    type: "javascript",
    label: "JavaScript",
    labelKo: "JavaScript",
    description: "Execute custom JS code",
    descriptionKo: "Execute custom JS code",
    icon: "Code",
    color: "#f59e0b", // Amber/Yellow
    bgColor: "#f59e0b20",
    borderColor: "#f59e0b",
    category: "tools",
    handles: { inputs: 1, outputs: 1 },
  },
  embedding: {
    type: "embedding",
    label: "Embedding Model",
    labelKo: "Embedding Model",
    description: "Convert text to embeddings",
    descriptionKo: "Convert text to embeddings",
    icon: "Layers",
    color: "#06b6d4", // Cyan
    bgColor: "#06b6d420",
    borderColor: "#06b6d4",
    category: "memory",
    handles: { inputs: 1, outputs: 1 },
  },
  custom_tool: {
    type: "custom_tool",
    label: "Tool",
    labelKo: "Tool",
    description: "Custom function tool",
    descriptionKo: "Custom function tool",
    icon: "Wrench",
    color: "#f97316", // Orange
    bgColor: "#f9731620",
    borderColor: "#f97316",
    category: "tools",
    handles: { inputs: 1, outputs: 1 },
  },
  end: {
    type: "end",
    label: "End",
    labelKo: "End",
    description: "Workflow output",
    descriptionKo: "Workflow output",
    icon: "Flag",
    color: "#ef4444", // Red
    bgColor: "#ef444420", // Red
    borderColor: "#ef4444",
    category: "core",
    handles: { inputs: 1, outputs: 0 },
  },
  // Legacy or unused types kept for internal logic/safety, or mapped to basic styles
  memory: {
    type: "memory",
    label: "Memory",
    labelKo: "Memory",
    description: "Store context",
    descriptionKo: "Store context",
    icon: "Database",
    color: "#71717a",
    bgColor: "#71717a20",
    borderColor: "#71717a",
    category: "memory",
    handles: { inputs: 1, outputs: 1 },
  },
  rag: {
    type: "rag",
    label: "RAG",
    labelKo: "RAG",
    description: "Retrieval",
    descriptionKo: "Retrieval",
    icon: "Search",
    color: "#10b981",
    bgColor: "#10b98120",
    borderColor: "#10b981",
    category: "memory",
    handles: { inputs: 1, outputs: 1 },
  },
  input: {
    type: "input",
    label: "Input",
    labelKo: "Input",
    description: "Input",
    descriptionKo: "Input",
    icon: "MessageSquare",
    color: "var(--accent-color)",
    bgColor: "var(--accent-color-20)",
    borderColor: "var(--accent-color)",
    category: "io",
    handles: { inputs: 0, outputs: 1 },
  },
  output: {
    type: "output",
    label: "Output",
    labelKo: "Output",
    description: "Output",
    descriptionKo: "Output",
    icon: "Send",
    color: "#22c55e",
    bgColor: "#22c55e20",
    borderColor: "#22c55e",
    category: "io",
    handles: { inputs: 1, outputs: 0 },
  },
  chain: {
    type: "chain",
    label: "Chain",
    labelKo: "Chain",
    description: "Chain",
    descriptionKo: "Chain",
    icon: "Link",
    color: "#6366f1",
    bgColor: "#6366f120",
    borderColor: "#6366f1",
    category: "control",
    handles: { inputs: 1, outputs: 1 },
  },
  evaluator: {
    type: "evaluator",
    label: "Evaluator",
    labelKo: "Evaluator",
    description: "Evaluate",
    descriptionKo: "Evaluate",
    icon: "CheckCircle",
    color: "#f97316",
    bgColor: "#f9731620",
    borderColor: "#f97316",
    category: "control",
    handles: { inputs: 1, outputs: 2 },
  },
  function: {
    type: "function",
    label: "Function",
    labelKo: "Function",
    description: "Function",
    descriptionKo: "Function",
    icon: "Code",
    color: "#64748b",
    bgColor: "#64748b20",
    borderColor: "#64748b",
    category: "tools",
    handles: { inputs: 1, outputs: 1 },
  },
  activepieces: {
    type: "activepieces",
    label: "Activepieces",
    labelKo: "Activepieces",
    description: "Automation flows (200+ apps)",
    descriptionKo: "200+ 앱 연동 자동화",
    icon: "Zap",
    color: "#6366f1", // Indigo
    bgColor: "#6366f120",
    borderColor: "#6366f1",
    category: "tools",
    handles: { inputs: 1, outputs: 1 },
  },
}

// Default node data by type
function getDefaultAgentNodeData(type: AgentType): Partial<AgentNodeData> {
  const config = AGENT_NODE_CONFIGS[type]

  const baseData: Partial<AgentNodeData> = {
    label: config.labelKo,
    description: config.descriptionKo,
    agentType: type,
  }

  switch (type) {
    case "llm":
      return {
        ...baseData,
        model: "gpt-4-turbo",
        temperature: 0.7,
        maxTokens: 2048,
        systemPrompt: "You are a helpful assistant.",
      }
    case "router":
      return {
        ...baseData,
        routingLogic: "conditional",
        routes: [],
      }
    case "memory":
      return {
        ...baseData,
        memoryType: "buffer",
        memoryLimit: 10,
      }
    case "tool":
      return {
        ...baseData,
        tools: [],
      }
    case "rag":
      return {
        ...baseData,
        vectorStore: "supabase",
        embeddingModel: "text-embedding-3-small",
        retrievalCount: 5,
      }
    case "input":
      return {
        ...baseData,
        inputType: "text",
      }
    case "output":
      return {
        ...baseData,
        outputType: "text",
      }
    case "chain":
      return baseData
    case "evaluator":
      return {
        ...baseData,
        evaluationType: "quality",
        threshold: 0.8,
      }
    case "function":
      return {
        ...baseData,
        functionName: "",
        functionArgs: "{}",
      }
    case "start":
      return baseData
    case "end":
      return baseData
    case "prompt":
      return {
        ...baseData,
        systemPrompt: "",
      }
    case "image_generation":
      return {
        ...baseData,
        model: "dall-e-3",
      }
    case "javascript":
      return {
        ...baseData,
        // No specific data needed for now, handled in component
      }
    case "embedding":
      return {
        ...baseData,
        embeddingModel: "text-embedding-3-small",
      }
    case "custom_tool":
      return {
        ...baseData,
        // Default tool config?
      }
    case "activepieces":
      return {
        ...baseData,
        activepiecesTriggerType: "manual",
        activepiecesWaitForCompletion: true,
        activepiecesInputs: {},
      }
    default:
      return baseData
  }
}

// Create new agent node
export function createAgentNode({
  type,
  position,
  id,
}: {
  type: AgentType
  position: { x: number; y: number }
  id?: string
}): AgentNode {
  const nodeId = id || generateAgentNodeId(type)
  const config = AGENT_NODE_CONFIGS[type]
  const data = getDefaultAgentNodeData(type)

  return {
    id: nodeId,
    type,
    position,
    data: {
      label: data.label || config.labelKo,
      ...data,
    },
  }
}

// Validate agent configuration
export function validateAgent(
  nodes: AgentNode[],
  edges: AgentEdge[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check for input node
  const inputNodes = nodes.filter((n) => n.type === "input")
  if (inputNodes.length === 0) {
    errors.push("입력 노드가 필요합니다.")
  }

  // Check for output node
  const outputNodes = nodes.filter((n) => n.type === "output")
  if (outputNodes.length === 0) {
    errors.push("출력 노드가 필요합니다.")
  }

  // Check for at least one LLM node
  const llmNodes = nodes.filter((n) => n.type === "llm")
  if (llmNodes.length === 0) {
    errors.push("최소 하나의 LLM 노드가 필요합니다.")
  }

  // Check connectivity
  const connectedNodeIds = new Set<string>()
  edges.forEach((edge) => {
    connectedNodeIds.add(edge.source)
    connectedNodeIds.add(edge.target)
  })

  const disconnectedNodes = nodes.filter(
    (n) => n.type !== "input" && !connectedNodeIds.has(n.id)
  )
  if (disconnectedNodes.length > 0) {
    errors.push(`연결되지 않은 노드가 있습니다: ${disconnectedNodes.map((n) => n.data.label).join(", ")}`)
  }

  // Check LLM configurations
  llmNodes.forEach((node) => {
    if (!node.data.model) {
      errors.push(`LLM 노드 "${node.data.label}"에 모델이 설정되지 않았습니다.`)
    }
  })

  return { valid: errors.length === 0, errors }
}

// Export agent to JSON
export function exportAgentToJson(
  nodes: AgentNode[],
  edges: AgentEdge[],
  metadata?: { name?: string; description?: string }
): string {
  return JSON.stringify(
    {
      version: "1.0",
      type: "agent",
      metadata: {
        name: metadata?.name || "Untitled Agent",
        description: metadata?.description || "",
        exportedAt: new Date().toISOString(),
      },
      nodes,
      edges,
    },
    null,
    2
  )
}

// Import agent from JSON
export function importAgentFromJson(json: string): {
  nodes: AgentNode[]
  edges: AgentEdge[]
  metadata?: { name?: string; description?: string }
} | null {
  try {
    const data = JSON.parse(json)
    if (data.type !== "agent" || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      return null
    }
    return {
      nodes: data.nodes,
      edges: data.edges,
      metadata: data.metadata,
    }
  } catch {
    return null
  }
}

// Agent templates
export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "business-plan-loop",
    name: "Business Plan Generator",
    nameKo: "사업계획서 작성 루프",
    description: "Generate comprehensive business plan with AI loop",
    descriptionKo: "AI 루프로 사업계획서 섹션별 자동 작성",
    category: "assistant",
    nodes: [
      createAgentNode({ type: "start", position: { x: 50, y: 250 }, id: "start-bp" }),
      createAgentNode({ type: "prompt", position: { x: 250, y: 250 }, id: "prompt-info" }),
      createAgentNode({ type: "llm", position: { x: 450, y: 100 }, id: "llm-summary" }),
      createAgentNode({ type: "llm", position: { x: 450, y: 250 }, id: "llm-market" }),
      createAgentNode({ type: "llm", position: { x: 450, y: 400 }, id: "llm-model" }),
      createAgentNode({ type: "llm", position: { x: 700, y: 100 }, id: "llm-marketing" }),
      createAgentNode({ type: "llm", position: { x: 700, y: 250 }, id: "llm-finance" }),
      createAgentNode({ type: "llm", position: { x: 700, y: 400 }, id: "llm-team" }),
      createAgentNode({ type: "llm", position: { x: 950, y: 250 }, id: "llm-compile" }),
      createAgentNode({ type: "end", position: { x: 1150, y: 250 }, id: "end-bp" }),
    ],
    edges: [
      { id: "e-bp-1", source: "start-bp", target: "prompt-info" },
      { id: "e-bp-2", source: "prompt-info", target: "llm-summary" },
      { id: "e-bp-3", source: "prompt-info", target: "llm-market" },
      { id: "e-bp-4", source: "prompt-info", target: "llm-model" },
      { id: "e-bp-5", source: "llm-summary", target: "llm-marketing" },
      { id: "e-bp-6", source: "llm-market", target: "llm-finance" },
      { id: "e-bp-7", source: "llm-model", target: "llm-team" },
      { id: "e-bp-8", source: "llm-marketing", target: "llm-compile" },
      { id: "e-bp-9", source: "llm-finance", target: "llm-compile" },
      { id: "e-bp-10", source: "llm-team", target: "llm-compile" },
      { id: "e-bp-11", source: "llm-compile", target: "end-bp" },
    ],
    nodeConfigs: {
      "prompt-info": {
        label: "사업 정보 입력",
        systemPrompt: `다음 정보를 입력하세요:
- 회사명/서비스명
- 사업 아이템 설명
- 타겟 시장
- 경쟁사
- 예상 투자 규모`,
      },
      "llm-summary": {
        label: "1. 요약문 작성",
        systemPrompt: `당신은 사업계획서 전문가입니다.
주어진 사업 정보를 바탕으로 '요약문(Executive Summary)' 섹션을 작성하세요.
포함 내용: 사업 개요, 핵심 가치 제안, 목표 시장, 경쟁 우위, 재무 하이라이트`,
        model: "gpt-4o",
        temperature: 0.7,
      },
      "llm-market": {
        label: "2. 시장 분석",
        systemPrompt: `당신은 시장 분석 전문가입니다.
주어진 사업 정보를 바탕으로 '시장 분석' 섹션을 작성하세요.
포함 내용: TAM/SAM/SOM, 시장 트렌드, 고객 세그먼트, 경쟁 분석`,
        model: "gpt-4o",
        temperature: 0.7,
      },
      "llm-model": {
        label: "3. 비즈니스 모델",
        systemPrompt: `당신은 비즈니스 전략 전문가입니다.
주어진 사업 정보를 바탕으로 '비즈니스 모델' 섹션을 작성하세요.
포함 내용: 수익 모델, 가격 전략, 핵심 파트너, 핵심 활동, 핵심 자원`,
        model: "gpt-4o",
        temperature: 0.7,
      },
      "llm-marketing": {
        label: "4. 마케팅 전략",
        systemPrompt: `당신은 마케팅 전략 전문가입니다.
주어진 사업 정보와 시장 분석을 바탕으로 '마케팅 전략' 섹션을 작성하세요.
포함 내용: Go-to-Market 전략, 고객 획득 전략, 브랜딩, 채널 전략`,
        model: "gpt-4o",
        temperature: 0.7,
      },
      "llm-finance": {
        label: "5. 재무 계획",
        systemPrompt: `당신은 재무 분석 전문가입니다.
주어진 사업 정보를 바탕으로 '재무 계획' 섹션을 작성하세요.
포함 내용: 초기 투자 비용, 운영 비용, 매출 예측(3년), 손익분기점, 자금 조달 계획`,
        model: "gpt-4o",
        temperature: 0.7,
      },
      "llm-team": {
        label: "6. 팀 구성",
        systemPrompt: `당신은 조직 전문가입니다.
주어진 사업 정보를 바탕으로 '팀 구성' 섹션을 작성하세요.
포함 내용: 핵심 팀 역할, 조직 구조, 채용 계획, 자문단`,
        model: "gpt-4o",
        temperature: 0.7,
      },
      "llm-compile": {
        label: "7. 최종 통합",
        systemPrompt: `당신은 사업계획서 편집 전문가입니다.
앞서 작성된 모든 섹션을 통합하여 완성된 사업계획서를 만드세요.
형식: 목차 포함, 일관된 톤앤매너, 전문적인 문서 형식`,
        model: "gpt-4o",
        temperature: 0.5,
      },
    },
  },
  {
    id: "chatbot-basic",
    name: "Basic Chatbot",
    nameKo: "기본 챗봇",
    description: "Simple conversational chatbot with memory",
    descriptionKo: "메모리가 있는 간단한 대화형 챗봇",
    category: "chatbot",
    nodes: [
      createAgentNode({ type: "input", position: { x: 100, y: 200 } }),
      createAgentNode({ type: "memory", position: { x: 300, y: 100 } }),
      createAgentNode({ type: "llm", position: { x: 300, y: 200 } }),
      createAgentNode({ type: "output", position: { x: 500, y: 200 } }),
    ],
    edges: [
      { id: "e1", source: "input-1", target: "memory-1" },
      { id: "e2", source: "memory-1", target: "llm-1" },
      { id: "e3", source: "llm-1", target: "output-1" },
    ],
  },
  {
    id: "rag-assistant",
    name: "RAG Assistant",
    nameKo: "RAG 어시스턴트",
    description: "Knowledge-augmented assistant with vector search",
    descriptionKo: "벡터 검색이 포함된 지식 증강 어시스턴트",
    category: "assistant",
    nodes: [
      createAgentNode({ type: "input", position: { x: 100, y: 200 } }),
      createAgentNode({ type: "rag", position: { x: 300, y: 100 } }),
      createAgentNode({ type: "llm", position: { x: 300, y: 250 } }),
      createAgentNode({ type: "output", position: { x: 500, y: 200 } }),
    ],
    edges: [
      { id: "e1", source: "input-1", target: "rag-1" },
      { id: "e2", source: "rag-1", target: "llm-1" },
      { id: "e3", source: "llm-1", target: "output-1" },
    ],
  },
  {
    id: "tool-agent",
    name: "Tool-Augmented Agent",
    nameKo: "도구 활용 에이전트",
    description: "Agent with external tool capabilities",
    descriptionKo: "외부 도구 활용 기능이 있는 에이전트",
    category: "assistant",
    nodes: [
      createAgentNode({ type: "input", position: { x: 100, y: 200 } }),
      createAgentNode({ type: "router", position: { x: 300, y: 200 } }),
      createAgentNode({ type: "tool", position: { x: 500, y: 100 } }),
      createAgentNode({ type: "llm", position: { x: 500, y: 300 } }),
      createAgentNode({ type: "output", position: { x: 700, y: 200 } }),
    ],
    edges: [
      { id: "e1", source: "input-1", target: "router-1" },
      { id: "e2", source: "router-1", target: "tool-1", sourceHandle: "a" },
      { id: "e3", source: "router-1", target: "llm-1", sourceHandle: "b" },
      { id: "e4", source: "tool-1", target: "output-1" },
      { id: "e5", source: "llm-1", target: "output-1" },
    ],
  },
  {
    id: "multi-agent",
    name: "Multi-Agent System",
    nameKo: "멀티 에이전트 시스템",
    description: "Multiple specialized agents working together",
    descriptionKo: "여러 전문 에이전트가 협업하는 시스템",
    category: "custom",
    nodes: [
      createAgentNode({ type: "input", position: { x: 100, y: 250 } }),
      createAgentNode({ type: "router", position: { x: 300, y: 250 } }),
      createAgentNode({ type: "llm", position: { x: 500, y: 100 } }),
      createAgentNode({ type: "llm", position: { x: 500, y: 250 } }),
      createAgentNode({ type: "llm", position: { x: 500, y: 400 } }),
      createAgentNode({ type: "evaluator", position: { x: 700, y: 250 } }),
      createAgentNode({ type: "output", position: { x: 900, y: 250 } }),
    ],
    edges: [
      { id: "e1", source: "input-1", target: "router-1" },
      { id: "e2", source: "router-1", target: "llm-1", sourceHandle: "a" },
      { id: "e3", source: "router-1", target: "llm-2", sourceHandle: "b" },
      { id: "e4", source: "router-1", target: "llm-3", sourceHandle: "c" },
      { id: "e5", source: "llm-1", target: "evaluator-1" },
      { id: "e6", source: "llm-2", target: "evaluator-1" },
      { id: "e7", source: "llm-3", target: "evaluator-1" },
      { id: "e8", source: "evaluator-1", target: "output-1" },
    ],
  },
]

// Get category label
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    core: "코어",
    memory: "메모리",
    tools: "도구",
    io: "입출력",
    control: "제어",
  }
  return labels[category] || category
}


// --- Agent Card / UI Helpers ---

export const AGENT_STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; bgColor: string }> = {
  ACTIVE: { label: "활성", color: "#22c55e", bgColor: "#22c55e20" },
  INACTIVE: { label: "비활성", color: "#64748b", bgColor: "#64748b20" },
  BUSY: { label: "작업 중", color: "#f59e0b", bgColor: "#f59e0b20" },
  ERROR: { label: "오류", color: "#ef4444", bgColor: "#ef444420" },
}

export function getCategoryId(capabilities: string[]): string {
  if (capabilities.includes("대화 기억") || capabilities.includes("프롬프트 처리")) return "chatbot"
  if (capabilities.includes("문서 검색")) return "analyzer"
  if (capabilities.includes("이미지 생성") || capabilities.includes("텍스트 생성")) return "generator"
  return "assistant"
}

export function generateRobotAvatar(name: string): string {
  const seed = encodeURIComponent(name)
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=3B82F6,10B981,F59E0B,EF4444,8B5CF6,EC4899`
}

export function getAvatarUrl(agent: DeployedAgent): string {
  if (!agent.avatar_url || agent.avatar_url.includes('ui-avatars.com')) {
    return generateRobotAvatar(agent.name)
  }
  return agent.avatar_url
}

export function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "사용 기록 없음"
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "방금 사용"
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  return `${diffDay}일 전`
}
