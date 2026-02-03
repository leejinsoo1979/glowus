import type { Node } from "reactflow"

export interface NodeData {
  label: string
  description?: string
  required?: boolean

  // Input node properties
  dataSource?: "manual" | "api" | "database" | "file" | "webhook"
  sampleData?: string

  // Output node properties
  outputType?: "console" | "api" | "database" | "file" | "notification"
  outputFormat?: "json" | "csv" | "xml" | "text"

  // Process node properties
  processType?: "transform" | "filter" | "aggregate" | "sort" | "merge" | "split" | "dedupe" | "limit"
  processConfig?: string

  // Conditional node properties
  condition?: string
  trueLabel?: string
  falseLabel?: string

  // Code node properties
  codeLanguage?: "javascript" | "typescript" | "python"
  code?: string

  // AI node properties
  aiModel?: "gpt-4" | "gpt-4o" | "gpt-4o-mini" | "gpt-3.5" | "claude" | "gemini"
  aiPrompt?: string
  aiSystemPrompt?: string
  aiTemperature?: number
  aiMaxTokens?: number

  // Delay node properties
  delayMs?: number
  delayUnit?: "ms" | "s" | "m" | "h"

  // HTTP node properties
  httpMethod?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  httpUrl?: string
  httpHeaders?: string
  httpBody?: string
  httpAuth?: "none" | "bearer" | "basic" | "apiKey"
  httpAuthValue?: string

  // Notification node properties
  notificationType?: "email" | "slack" | "webhook" | "discord" | "telegram"
  notificationTarget?: string
  notificationMessage?: string

  // Loop node properties
  loopType?: "forEach" | "while" | "times"
  loopConfig?: string
  loopCount?: number

  // Switch node properties
  switchField?: string
  switchCases?: string

  // Schedule node properties
  scheduleType?: "cron" | "interval" | "once"
  scheduleCron?: string
  scheduleInterval?: number

  // Database node properties
  dbOperation?: "select" | "insert" | "update" | "delete" | "query"
  dbTable?: string
  dbQuery?: string
  dbConnection?: string

  // File node properties
  fileOperation?: "read" | "write" | "append" | "delete" | "list" | "move" | "copy"
  filePath?: string
  fileContent?: string

  // JSON node properties
  jsonOperation?: "parse" | "stringify" | "get" | "set" | "merge" | "filter"
  jsonPath?: string
  jsonValue?: string

  // Text node properties
  textOperation?: "replace" | "split" | "join" | "trim" | "uppercase" | "lowercase" | "regex"
  textPattern?: string
  textReplacement?: string

  // Math node properties
  mathOperation?: "add" | "subtract" | "multiply" | "divide" | "round" | "abs" | "min" | "max" | "sum" | "average"
  mathValues?: string

  // Date node properties
  dateOperation?: "format" | "parse" | "add" | "subtract" | "diff" | "now"
  dateFormat?: string
  dateValue?: string

  // Array node properties
  arrayOperation?: "map" | "filter" | "reduce" | "sort" | "reverse" | "slice" | "concat" | "unique" | "flatten"
  arrayConfig?: string

  // Error node properties
  errorType?: "throw" | "catch" | "retry"
  errorMessage?: string
  retryCount?: number
  retryDelay?: number

  // Wait node properties
  waitType?: "time" | "webhook" | "approval"
  waitTimeout?: number

  // Merge node properties
  mergeType?: "append" | "combine" | "byKey" | "byPosition"
  mergeKey?: string

  // Split node properties
  splitType?: "items" | "batches" | "field"
  splitSize?: number
  splitField?: string

  // Set node properties
  setFields?: string
  setMode?: "manual" | "expression"

  // Google Sheets properties
  sheetsOperation?: "read" | "append" | "update" | "clear"
  sheetsId?: string
  sheetsRange?: string

  // Supabase properties
  supabaseOperation?: "select" | "insert" | "update" | "delete" | "rpc"
  supabaseTable?: string
  supabaseFilters?: string

  // OpenAI specific properties
  openaiOperation?: "chat" | "image" | "embedding" | "whisper" | "tts"
  openaiImageSize?: "256x256" | "512x512" | "1024x1024"

  // Webhook response properties
  webhookResponse?: string
  webhookStatusCode?: number
}

export type WorkflowNode = Node<NodeData>

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type?: string
  label?: string
  data?: Record<string, unknown>
}

export interface Workflow {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  createdAt: Date
  updatedAt: Date
  status: "draft" | "active" | "paused" | "error"
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  status: "pending" | "running" | "completed" | "failed"
  startedAt: Date
  completedAt?: Date
  logs: ExecutionLog[]
  result?: unknown
  error?: string
}

export interface ExecutionLog {
  nodeId: string
  timestamp: Date
  level: "info" | "warn" | "error" | "debug"
  message: string
  data?: unknown
}

export type NodeType =
  // Input
  | "trigger"
  | "input"
  | "webhook"
  | "schedule"
  // Process
  | "process"
  | "code"
  | "ai"
  | "json"
  | "text"
  | "math"
  | "date"
  | "array"
  | "set"
  // Control
  | "conditional"
  | "switch"
  | "loop"
  | "delay"
  | "wait"
  | "error"
  | "merge"
  | "split"
  // Integration
  | "http"
  | "notification"
  | "database"
  | "file"
  | "googleSheets"
  | "supabase"
  | "slack"
  | "discord"
  | "telegram"
  | "email"
  | "openai"
  // Output
  | "output"
  | "webhookResponse"

export interface NodeTypeConfig {
  type: NodeType
  label: string
  description: string
  icon: string
  color: string
  category: "input" | "process" | "output" | "control" | "integration" | "ai" | "data"
  disabled?: boolean
  beta?: boolean
}
