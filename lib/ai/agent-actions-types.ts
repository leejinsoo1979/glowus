/**
 * Agent Action Types
 * Types only - no runtime dependencies for better tree-shaking
 */

// 액션 타입 정의
export type AgentAction =
  | WriteFileAction
  | CreateFileAction
  | EditFileAction
  | ReadFileAction
  | TerminalAction
  | WebSearchAction
  | CreateProjectAction
  | CreateTaskAction
  | GenerateImageAction
  | SendEmailAction
  | ReadEmailsAction
  | ReplyEmailAction
  | GetCalendarEventsAction
  | CreateCalendarEventAction
  | GenerateReportAction
  | SummarizeScheduleAction
  // 🔥 Neural Editor 액션
  | CreateNodeAction
  | UpdateNodeAction
  | DeleteNodeAction
  | CreateEdgeAction
  | DeleteEdgeAction
  | GetGraphAction
  | CreateFileWithNodeAction
  // 🔥 Orchestrator 에이전트 호출 액션
  | CallAgentAction
  | GetAgentStatusAction
  // 🔥 Flowchart 제어 액션
  | FlowchartCreateNodeAction
  | FlowchartUpdateNodeAction
  | FlowchartDeleteNodeAction
  | FlowchartCreateEdgeAction
  | FlowchartDeleteEdgeAction
  | FlowchartGetGraphAction
  // 🔥 Blueprint 제어 액션
  | BlueprintCreateTaskAction
  | BlueprintUpdateTaskAction
  | BlueprintDeleteTaskAction
  | BlueprintGetTasksAction
  // 🔥 Agent Builder 워크플로우 액션
  | AgentBuilderCreateNodeAction
  | AgentBuilderConnectNodesAction
  | AgentBuilderDeleteNodeAction
  | AgentBuilderUpdateNodeAction
  | AgentBuilderGenerateWorkflowAction
  | AgentBuilderGetWorkflowAction
  | AgentBuilderDeployAction
  | AgentBuilderClearAction
  // 🔥 페이지 네비게이션 액션
  | NavigateAction
  | ChangeViewTabAction

export interface WriteFileAction {
  type: 'write_file'
  path: string
  content: string
  originalContent?: string
}

export interface CreateFileAction {
  type: 'create_file'
  path: string
  content: string
}

export interface EditFileAction {
  type: 'edit_file'
  path: string
  old_content: string
  new_content: string
}

export interface ReadFileAction {
  type: 'read_file'
  path: string
}

export interface TerminalAction {
  type: 'terminal_cmd'
  command: string
  cwd?: string
  waitForOutput?: boolean
}

export interface WebSearchAction {
  type: 'web_search'
  query: string
}

export interface CreateProjectAction {
  type: 'create_project'
  name: string
  description?: string
  priority?: string
  deadline?: string
  folderPath?: string
}

export interface CreateTaskAction {
  type: 'create_task'
  title: string
  description?: string
  projectId?: string
  priority?: string
  assigneeId?: string
}

export interface GenerateImageAction {
  type: 'generate_image'
  prompt: string
  image_url?: string
  width?: number
  height?: number
  metadata?: {
    prompt: string
    width: number
    height: number
    model: string
    generation_time_ms: number
  }
}

export interface SendEmailAction {
  type: 'send_email'
  to: string
  subject: string
  body: string
  cc?: string
}

export interface ReadEmailsAction {
  type: 'read_emails'
  filter: 'unread' | 'recent' | 'all' | 'important'
  count?: number
  from?: string
}

export interface ReplyEmailAction {
  type: 'reply_email'
  emailId: string
  body: string
  replyAll?: boolean
}

export interface GetCalendarEventsAction {
  type: 'get_calendar_events'
  period: 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'custom'
  startDate?: string
  endDate?: string
}

export interface CreateCalendarEventAction {
  type: 'create_calendar_event'
  title: string
  startTime: string
  endTime: string
  description?: string
  location?: string
  attendees?: string[]
}

export interface GenerateReportAction {
  type: 'create_report'
  reportType: 'daily' | 'weekly' | 'project' | 'custom'
  title: string
  content: string
  projectId?: string
}

export interface SummarizeScheduleAction {
  type: 'summarize_schedule'
  period: 'today' | 'tomorrow' | 'this_week'
}

// NodeType from neural-map/types.ts
type AgentNodeType = 'concept' | 'project' | 'doc' | 'idea' | 'decision' | 'memory' | 'task' | 'person' | 'insight' | 'folder' | 'file'
// EdgeType from neural-map/types.ts
type AgentEdgeType = 'parent_child' | 'references' | 'imports' | 'supports' | 'contradicts' | 'causes' | 'same_topic' | 'sequence' | 'semantic'

export interface CreateNodeAction {
  type: 'create_node'
  nodeType: AgentNodeType
  title: string
  content?: string
  position?: { x: number; y: number; z?: number }
  metadata?: Record<string, unknown>
}

export interface UpdateNodeAction {
  type: 'update_node'
  nodeId: string
  title?: string
  content?: string
  metadata?: Record<string, unknown>
}

export interface DeleteNodeAction {
  type: 'delete_node'
  nodeId: string
  deleteConnectedEdges?: boolean
}

export interface CreateEdgeAction {
  type: 'create_edge'
  sourceNodeId: string
  targetNodeId: string
  label?: string
  edgeType?: AgentEdgeType
}

export interface DeleteEdgeAction {
  type: 'delete_edge'
  edgeId?: string
  sourceNodeId?: string
  targetNodeId?: string
}

export interface GetGraphAction {
  type: 'get_graph'
  includeContent?: boolean
  nodeTypes?: string[]
}

export interface CreateFileWithNodeAction {
  type: 'create_file_with_node'
  path: string
  content: string
  nodeType: 'file' | 'doc'
  title: string
  position?: { x: number; y: number; z?: number }
}

export interface CallAgentAction {
  type: 'call_agent'
  targetAgent: 'planner' | 'implementer' | 'tester' | 'reviewer'
  task: string
  context?: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  waitForResult?: boolean
}

export interface GetAgentStatusAction {
  type: 'get_agent_status'
  targetAgent?: 'planner' | 'implementer' | 'tester' | 'reviewer' | 'all'
}

export interface FlowchartCreateNodeAction {
  type: 'flowchart_create_node'
  nodeId: string
  label: string
  shape?: 'rectangle' | 'round' | 'diamond' | 'circle' | 'stadium'
  style?: string | Record<string, string>
  position?: { x: number; y: number }
}

export interface FlowchartUpdateNodeAction {
  type: 'flowchart_update_node'
  id: string
  label?: string
  shape?: string
  style?: string | Record<string, string>
  position?: { x: number; y: number }
}

export interface FlowchartDeleteNodeAction {
  type: 'flowchart_delete_node'
  nodeId: string
}

export interface FlowchartCreateEdgeAction {
  type: 'flowchart_create_edge'
  sourceId: string
  targetId: string
  label?: string
  edgeType?: 'arrow' | 'line' | 'dotted' | 'thick'
}

export interface FlowchartDeleteEdgeAction {
  type: 'flowchart_delete_edge'
  sourceId: string
  targetId: string
}

export interface FlowchartGetGraphAction {
  type: 'flowchart_get_graph'
  includeStyles?: boolean
}

export interface BlueprintCreateTaskAction {
  type: 'blueprint_create_task'
  title: string
  description?: string
  status?: 'todo' | 'in_progress' | 'review' | 'done'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  assignee?: string
  dueDate?: string
  parentId?: string
  dependencies?: string[]
}

export interface BlueprintUpdateTaskAction {
  type: 'blueprint_update_task'
  taskId: string
  title?: string
  description?: string
  status?: 'todo' | 'in_progress' | 'review' | 'done'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  assignee?: string
  progress?: number
}

export interface BlueprintDeleteTaskAction {
  type: 'blueprint_delete_task'
  taskId: string
  deleteChildren?: boolean
}

export interface BlueprintGetTasksAction {
  type: 'blueprint_get_tasks'
  status?: 'todo' | 'in_progress' | 'review' | 'done' | 'all'
  assignee?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
}

// Agent Builder 노드 타입
type AgentBuilderNodeType = 'start' | 'end' | 'llm' | 'prompt' | 'router' | 'memory' | 'tool' | 'rag' | 'javascript' | 'function' | 'input' | 'output' | 'image_generation' | 'embedding' | 'evaluator' | 'chain'

export interface AgentBuilderCreateNodeAction {
  type: 'agent_create_node'
  nodeType: AgentBuilderNodeType
  label: string
  config?: Record<string, unknown>
  position?: { x: number; y: number }
}

export interface AgentBuilderConnectNodesAction {
  type: 'agent_connect_nodes'
  sourceNodeId: string
  targetNodeId: string
  sourceHandle?: string
  label?: string
}

export interface AgentBuilderDeleteNodeAction {
  type: 'agent_delete_node'
  nodeId: string
}

export interface AgentBuilderUpdateNodeAction {
  type: 'agent_update_node'
  nodeId: string
  label?: string
  config?: Record<string, unknown>
}

export interface AgentBuilderGenerateWorkflowAction {
  type: 'agent_generate_workflow'
  name: string
  description: string
  nodes: Array<{
    id: string
    type: string
    label: string
    config?: Record<string, unknown>
    position: { x: number; y: number }
  }>
  edges: Array<{
    source: string
    target: string
    sourceHandle?: string
    label?: string
  }>
}

export interface AgentBuilderGetWorkflowAction {
  type: 'agent_get_workflow'
  includeConfig?: boolean
}

export interface AgentBuilderDeployAction {
  type: 'agent_deploy'
  name: string
  description?: string
  llmProvider?: 'openai' | 'anthropic' | 'google' | 'xai'
  llmModel?: string
}

export interface AgentBuilderClearAction {
  type: 'agent_clear'
}

export interface NavigateAction {
  type: 'navigate'
  path: string
}

export interface ChangeViewTabAction {
  type: 'change_view_tab'
  tab: 'map' | 'cosmic' | 'mermaid' | 'architecture' | 'life-stream' | 'agent-builder' | 'data' | 'logic' | 'test' | 'browser'
  mermaidType?: 'flowchart' | 'sequence' | 'class' | 'er' | 'pie' | 'state' | 'gitgraph'
}

// 액션 실행 결과
export interface ActionResult {
  action: AgentAction
  success: boolean
  result?: unknown
  error?: string
}

// 슈퍼에이전트 ToolAction
export interface ToolAction {
  type: string
  data: Record<string, unknown>
  requiresElectron?: boolean
}
