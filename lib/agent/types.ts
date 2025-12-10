import type { Node } from "reactflow"

export interface AgentNodeData {
  label: string
  description?: string

  // Agent properties
  agentType?: AgentType
  agentName?: string
  agentRole?: string
  agentPersonality?: string

  // LLM properties
  model?: "gpt-4" | "gpt-4-turbo" | "gpt-3.5-turbo" | "claude-3-opus" | "claude-3-sonnet" | "dall-e-3"
  temperature?: number
  maxTokens?: number
  systemPrompt?: string

  // Memory properties
  memoryType?: "buffer" | "summary" | "vector" | "none"
  memoryLimit?: number

  // Tool properties
  tools?: AgentTool[]

  // Input properties
  inputType?: "text" | "file" | "api" | "webhook" | "schedule"
  inputConfig?: Record<string, unknown>

  // Output properties
  outputType?: "text" | "json" | "stream" | "file"
  outputFormat?: string

  // Router properties
  routes?: AgentRoute[]
  routingLogic?: "sequential" | "parallel" | "conditional"

  // RAG properties
  vectorStore?: "pinecone" | "weaviate" | "chroma" | "supabase"
  embeddingModel?: string
  retrievalCount?: number

  // Function call properties
  functionName?: string
  functionArgs?: string

  // UI Display properties
  url?: string
  condition?: string

  // Evaluation properties
  evaluationType?: "quality" | "relevance" | "accuracy" | "safety"
  threshold?: number
  // Code properties
  code?: string

  // Prompt properties
  prompt?: string
}

export type AgentNode = Node<AgentNodeData>

export type AgentType =
  | "llm"           // Text Model
  | "router"        // Conditional
  | "memory"        // Memory
  | "tool"          // HTTP Request (legacy name kept for compatibility, label changed)
  | "rag"           // RAG
  | "input"         // Input
  | "output"        // Output
  | "chain"         // Chain
  | "evaluator"     // Evaluator
  | "function"      // Function
  | "start"         // Start
  | "prompt"        // Prompt
  | "image_generation" // Image Generation
  | "end"           // End
  | "javascript"    // JavaScript
  | "embedding"     // Embedding Model
  | "custom_tool"   // Custom Tool

export interface AgentTool {
  id: string
  name: string
  description: string
  type: "api" | "function" | "code" | "search"
  config?: Record<string, unknown>
}

export interface AgentRoute {
  id: string
  condition: string
  targetNodeId: string
  label?: string
}

export interface AgentEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  type?: string
  label?: React.ReactNode
  data?: Record<string, unknown>
}

export interface Agent {
  id: string
  name: string
  description?: string
  category?: "chatbot" | "assistant" | "analyzer" | "generator" | "custom"
  nodes: AgentNode[]
  edges: AgentEdge[]
  createdAt: Date
  updatedAt: Date
  status: "draft" | "active" | "testing" | "paused"
  version?: string
}

export interface AgentExecution {
  id: string
  agentId: string
  status: "pending" | "running" | "completed" | "failed"
  startedAt: Date
  completedAt?: Date
  input?: unknown
  output?: unknown
  logs: AgentExecutionLog[]
  metrics?: {
    totalTokens: number
    promptTokens: number
    completionTokens: number
    latencyMs: number
    cost: number
  }
  error?: string
}

export interface AgentExecutionLog {
  nodeId: string
  nodeName: string
  timestamp: Date
  level: "info" | "warn" | "error" | "debug"
  message: string
  data?: unknown
  duration?: number
}

export interface AgentNodeTypeConfig {
  type: AgentType
  label: string
  labelKo: string
  description: string
  descriptionKo: string
  icon: string
  color: string
  bgColor: string
  borderColor: string
  category: "core" | "memory" | "tools" | "io" | "control"
  handles?: {
    inputs?: number
    outputs?: number
  }
}

export interface AgentTemplate {
  id: string
  name: string
  nameKo: string
  description: string
  descriptionKo: string
  category: "chatbot" | "assistant" | "analyzer" | "generator" | "custom"
  nodes: AgentNode[]
  edges: AgentEdge[]
  thumbnail?: string
}
