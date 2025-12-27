/**
 * Agent Action System
 * Agent API → 액션 반환 → 프론트엔드에서 Electron IPC로 실행
 * 🔥 슈퍼에이전트 도구 지원
 * 🔥 Neural Editor 제어 지원
 */

import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { NeuralNode, NeuralEdge, NeuralFile } from '@/lib/neural-map/types'

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

export interface WriteFileAction {
  type: 'write_file'
  path: string
  content: string
  originalContent?: string  // 롤백용
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

// ============================================
// 이미지 생성 액션 (Z-Image)
// ============================================
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

// ============================================
// 외부 서비스 연동 액션
// ============================================

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

// ============================================
// 🔥 Neural Editor 액션 타입
// ============================================

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
  nodeType: 'file' | 'doc' // file for code, doc for markdown
  title: string
  position?: { x: number; y: number; z?: number }
}

// ============================================
// 🔥 Orchestrator 에이전트 호출 액션
// ============================================

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

// ============================================
// 🔥 Flowchart 제어 액션
// ============================================

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

// ============================================
// 🔥 Blueprint 제어 액션
// ============================================

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

// 액션 실행 결과
export interface ActionResult {
  action: AgentAction
  success: boolean
  result?: unknown
  error?: string
}

// 프론트엔드에서 사용할 액션 실행기
export async function executeAction(action: AgentAction): Promise<ActionResult> {
  // 웹 전용 액션들은 Electron 없이도 실행 가능
  const webOnlyActions = [
    'web_search', 'create_project', 'create_task', 'generate_image',
    // 🔥 새 액션들도 웹 전용
    'call_agent', 'get_agent_status',
    'flowchart_create_node', 'flowchart_update_node', 'flowchart_delete_node',
    'flowchart_create_edge', 'flowchart_delete_edge', 'flowchart_get_graph',
    'blueprint_create_task', 'blueprint_update_task', 'blueprint_delete_task', 'blueprint_get_tasks',
  ]

  // Electron 필요한 액션인데 없으면 에러
  if (!webOnlyActions.includes(action.type)) {
    if (typeof window === 'undefined' || !window.electron) {
      return {
        action,
        success: false,
        error: 'Electron 환경에서만 실행 가능합니다'
      }
    }
  }

  try {
    switch (action.type) {
      case 'write_file': {
        await window.electron?.fs?.writeFile?.(action.path, action.content)
        return {
          action,
          success: true,
          result: { path: action.path, bytesWritten: action.content.length }
        }
      }

      case 'create_file': {
        await window.electron?.fs?.writeFile?.(action.path, action.content)
        return {
          action,
          success: true,
          result: { path: action.path, created: true }
        }
      }

      case 'edit_file': {
        // 파일 읽기 → 수정 → 쓰기
        const content = await window.electron?.fs?.readFile?.(action.path)
        if (!content) {
          throw new Error(`파일을 찾을 수 없습니다: ${action.path}`)
        }

        if (!content.includes(action.old_content)) {
          throw new Error('교체할 코드를 찾을 수 없습니다')
        }

        const newContent = content.replace(action.old_content, action.new_content)
        await window.electron?.fs?.writeFile?.(action.path, newContent)

        return {
          action,
          success: true,
          result: { path: action.path, modified: true }
        }
      }

      case 'read_file': {
        const content = await window.electron?.fs?.readFile?.(action.path)
        return {
          action,
          success: true,
          result: { path: action.path, content }
        }
      }

      case 'terminal_cmd': {
        // 터미널 ID 생성
        const terminalId = `agent-${Date.now()}`

        // 터미널 생성
        await window.electron?.terminal?.create?.(terminalId, action.cwd)

        // 명령어 실행
        await window.electron?.terminal?.write?.(terminalId, action.command + '\n')

        // 출력 대기 (간단한 구현)
        if (action.waitForOutput) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

        return {
          action,
          success: true,
          result: { command: action.command, terminalId }
        }
      }

      case 'web_search': {
        // 웹 검색은 API로 처리
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: action.query })
        })

        if (!response.ok) {
          throw new Error('Search failed')
        }

        const data = await response.json()
        return {
          action,
          success: true,
          result: data
        }
      }

      case 'create_project': {
        // 프로젝트 생성 API 호출
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: action.name,
            description: action.description || null,
            priority: action.priority || 'medium',
            deadline: action.deadline || null,
            folder_path: action.folderPath || null,
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '프로젝트 생성 실패')
        }

        const project = await response.json()
        return {
          action,
          success: true,
          result: { project }
        }
      }

      case 'create_task': {
        // 태스크 생성 API 호출
        const response = await fetch('/api/agent-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: action.title,
            description: action.description || null,
            project_id: action.projectId || null,
            priority: action.priority || 'medium',
            assignee_agent_id: action.assigneeId || null,
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '태스크 생성 실패')
        }

        const task = await response.json()
        return {
          action,
          success: true,
          result: { task }
        }
      }

      // ============================================
      // 이미지 생성 액션 (Z-Image)
      // ============================================
      case 'generate_image': {
        // 이미지가 이미 생성된 경우 (tool에서 API 호출 완료)
        if (action.image_url) {
          return {
            action,
            success: true,
            result: {
              image_url: action.image_url,
              metadata: action.metadata,
              prompt: action.prompt
            }
          }
        }

        // 이미지 생성 API 호출
        const response = await fetch('/api/skills/z-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: action.prompt,
            width: action.width || 1024,
            height: action.height || 1024,
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '이미지 생성 실패')
        }

        const result = await response.json()
        return {
          action,
          success: true,
          result: {
            image_url: result.image_url,
            metadata: result.metadata,
            prompt: action.prompt
          }
        }
      }

      // ============================================
      // 외부 서비스 연동 액션 (OAuth 필요)
      // ============================================

      case 'send_email': {
        // Gmail/Outlook API 호출 (OAuth 필요)
        const response = await fetch('/api/integrations/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: action.to,
            subject: action.subject,
            body: action.body,
            cc: action.cc,
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '이메일 발송 실패')
        }

        return {
          action,
          success: true,
          result: { sent: true }
        }
      }

      case 'read_emails': {
        const response = await fetch(`/api/integrations/email/list?filter=${action.filter}&count=${action.count || 10}`)

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '이메일 조회 실패')
        }

        const emails = await response.json()
        return {
          action,
          success: true,
          result: { emails }
        }
      }

      case 'reply_email': {
        const response = await fetch('/api/integrations/email/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailId: action.emailId,
            body: action.body,
            replyAll: action.replyAll,
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '이메일 답장 실패')
        }

        return {
          action,
          success: true,
          result: { replied: true }
        }
      }

      case 'get_calendar_events': {
        const params = new URLSearchParams({
          period: action.period,
          ...(action.startDate && { startDate: action.startDate }),
          ...(action.endDate && { endDate: action.endDate }),
        })

        const response = await fetch(`/api/integrations/calendar/events?${params}`)

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '일정 조회 실패')
        }

        const events = await response.json()
        return {
          action,
          success: true,
          result: { events }
        }
      }

      case 'create_calendar_event': {
        const response = await fetch('/api/integrations/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: action.title,
            startTime: action.startTime,
            endTime: action.endTime,
            description: action.description,
            location: action.location,
            attendees: action.attendees,
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '일정 생성 실패')
        }

        const event = await response.json()
        return {
          action,
          success: true,
          result: { event }
        }
      }

      case 'create_report': {
        const response = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: action.reportType,
            title: action.title,
            content: action.content,
            projectId: action.projectId,
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '보고서 생성 실패')
        }

        const report = await response.json()
        return {
          action,
          success: true,
          result: { report }
        }
      }

      case 'summarize_schedule': {
        const response = await fetch(`/api/integrations/calendar/summary?period=${action.period}`)

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '스케줄 요약 실패')
        }

        const summary = await response.json()
        return {
          action,
          success: true,
          result: { summary }
        }
      }

      // ============================================
      // 🔥 Neural Editor 액션 실행
      // ============================================

      case 'create_node': {
        const store = useNeuralMapStore.getState()
        const pos = action.position || { x: Math.random() * 500, y: Math.random() * 500 }
        const newNode: NeuralNode = {
          id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: action.nodeType,
          title: action.title,
          content: action.content || '',
          position: { x: pos.x, y: pos.y, z: pos.z ?? 0 },
          tags: [],
          importance: 5,
          expanded: true,
          pinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        store.addNode(newNode)

        return {
          action,
          success: true,
          result: { nodeId: newNode.id, node: newNode }
        }
      }

      case 'update_node': {
        const store = useNeuralMapStore.getState()
        store.updateNode(action.nodeId, {
          ...(action.title && { title: action.title }),
          ...(action.content !== undefined && { content: action.content }),
          ...(action.metadata && { metadata: action.metadata }),
          updatedAt: new Date().toISOString(),
        })

        return {
          action,
          success: true,
          result: { nodeId: action.nodeId }
        }
      }

      case 'delete_node': {
        const store = useNeuralMapStore.getState()
        store.deleteNode(action.nodeId)

        return {
          action,
          success: true,
          result: { nodeId: action.nodeId, deleted: true }
        }
      }

      case 'create_edge': {
        const store = useNeuralMapStore.getState()
        const newEdge: NeuralEdge = {
          id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          source: action.sourceNodeId,
          target: action.targetNodeId,
          type: action.edgeType || 'references',
          weight: 0.5,
          label: action.label,
          bidirectional: false,
          createdAt: new Date().toISOString(),
        }

        store.addEdge(newEdge)

        return {
          action,
          success: true,
          result: { edgeId: newEdge.id, edge: newEdge }
        }
      }

      case 'delete_edge': {
        const store = useNeuralMapStore.getState()
        const graph = store.graph

        if (graph) {
          let edgeToDelete = action.edgeId

          // ID가 없으면 source/target으로 찾기
          if (!edgeToDelete && action.sourceNodeId && action.targetNodeId) {
            const edge = graph.edges.find(
              e => e.source === action.sourceNodeId && e.target === action.targetNodeId
            )
            edgeToDelete = edge?.id
          }

          if (edgeToDelete) {
            store.deleteEdge(edgeToDelete)
            return {
              action,
              success: true,
              result: { edgeId: edgeToDelete, deleted: true }
            }
          }
        }

        return {
          action,
          success: false,
          error: '삭제할 엣지를 찾을 수 없습니다'
        }
      }

      case 'get_graph': {
        const store = useNeuralMapStore.getState()
        const graph = store.graph

        if (!graph) {
          return {
            action,
            success: false,
            error: '그래프가 로드되지 않았습니다'
          }
        }

        let nodes = graph.nodes
        if (action.nodeTypes && action.nodeTypes.length > 0) {
          nodes = nodes.filter(n => action.nodeTypes!.includes(n.type))
        }

        // 내용 제외 옵션
        if (!action.includeContent) {
          nodes = nodes.map(n => ({ ...n, content: undefined }))
        }

        return {
          action,
          success: true,
          result: {
            nodeCount: nodes.length,
            edgeCount: graph.edges.length,
            nodes,
            edges: graph.edges,
          }
        }
      }

      case 'create_file_with_node': {
        const store = useNeuralMapStore.getState()
        const pos = action.position || { x: Math.random() * 500, y: Math.random() * 500 }
        const projectPath = store.projectPath // 🔥 현재 프로젝트 경로

        // 파일 확장자로 sourceRef kind 결정
        const ext = action.path.split('.').pop()?.toLowerCase() || ''
        let kind: 'code' | 'markdown' | 'text' = 'code'
        if (['md', 'mdx'].includes(ext)) kind = 'markdown'
        else if (['txt'].includes(ext)) kind = 'text'

        // 🔥 절대경로 생성 (상대경로 + 프로젝트 경로)
        let absolutePath = action.path
        if (projectPath && !action.path.startsWith('/')) {
          absolutePath = `${projectPath}/${action.path}`
        }

        // 1. 노드 생성
        const newNode: NeuralNode = {
          id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: action.nodeType, // 'file' or 'doc'
          title: action.title,
          content: action.content,
          position: { x: pos.x, y: pos.y, z: pos.z ?? 0 },
          tags: [],
          importance: 5,
          expanded: true,
          pinned: false,
          sourceRef: {
            fileId: absolutePath,
            kind,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        store.addNode(newNode)

        // 2. Electron으로 파일 생성 (있는 경우)
        let fileCreated = false
        if (typeof window !== 'undefined' && window.electron?.fs?.writeFile) {
          try {
            // 🔥 디렉토리 먼저 생성
            const dirPath = absolutePath.substring(0, absolutePath.lastIndexOf('/'))
            if (dirPath && window.electron?.fs?.mkdir) {
              await window.electron.fs.mkdir(dirPath).catch(() => {})
            }
            await window.electron.fs.writeFile(absolutePath, action.content)
            fileCreated = true
            console.log('[CreateFileWithNode] ✅ File created:', absolutePath)
          } catch (err) {
            console.warn('[CreateFileWithNode] Electron file write failed:', err)
            // 파일 쓰기 실패해도 노드는 생성됨
          }
        }

        // 3. 파일 목록에도 추가
        const fileName = action.path.split('/').pop() || action.path
        store.addFile({
          id: newNode.id,
          name: fileName,
          path: absolutePath,
          content: action.content,
          type: kind,
        } as NeuralFile)

        return {
          action,
          success: true,
          result: {
            nodeId: newNode.id,
            filePath: absolutePath,
            fileCreated,
            node: newNode
          }
        }
      }

      // ============================================
      // 🔥 Orchestrator 에이전트 호출 액션
      // ============================================

      case 'call_agent': {
        const callAction = action as CallAgentAction
        const response = await fetch('/api/agents/orchestrator/call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetAgent: callAction.targetAgent,
            task: callAction.task,
            context: callAction.context,
            priority: callAction.priority || 'normal',
            waitForResult: callAction.waitForResult !== false,
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '에이전트 호출 실패')
        }

        const result = await response.json()
        return {
          action,
          success: true,
          result
        }
      }

      case 'get_agent_status': {
        const statusAction = action as GetAgentStatusAction
        const agent = statusAction.targetAgent || 'all'
        const response = await fetch(`/api/agents/orchestrator/call?agent=${agent}`)

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '상태 조회 실패')
        }

        const result = await response.json()
        return {
          action,
          success: true,
          result
        }
      }

      // ============================================
      // 🔥 Flowchart 제어 액션
      // ============================================

      case 'flowchart_create_node': {
        const fcAction = action as FlowchartCreateNodeAction
        const store = useNeuralMapStore.getState()
        const projectPath = store.projectPath

        const response = await fetch('/api/flowchart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectPath,
            action: 'create_node',
            nodeId: fcAction.nodeId,
            label: fcAction.label,
            shape: fcAction.shape,
            style: fcAction.style,
            position: fcAction.position,
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Flowchart 노드 생성 실패')
        }

        const result = await response.json()
        return {
          action,
          success: true,
          result
        }
      }

      case 'flowchart_update_node': {
        const fcAction = action as FlowchartUpdateNodeAction
        const store = useNeuralMapStore.getState()
        const projectPath = store.projectPath

        const response = await fetch('/api/flowchart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectPath,
            action: 'update_node',
            nodeId: fcAction.id,
            label: fcAction.label,
            shape: fcAction.shape,
            style: fcAction.style,
            position: fcAction.position,
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Flowchart 노드 수정 실패')
        }

        const result = await response.json()
        return {
          action,
          success: true,
          result
        }
      }

      case 'flowchart_delete_node': {
        const fcAction = action as FlowchartDeleteNodeAction
        const store = useNeuralMapStore.getState()
        const projectPath = store.projectPath

        const response = await fetch('/api/flowchart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectPath,
            action: 'delete_node',
            nodeId: fcAction.nodeId,
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Flowchart 노드 삭제 실패')
        }

        const result = await response.json()
        return {
          action,
          success: true,
          result
        }
      }

      case 'flowchart_create_edge': {
        const fcAction = action as FlowchartCreateEdgeAction
        const store = useNeuralMapStore.getState()
        const projectPath = store.projectPath

        const response = await fetch('/api/flowchart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectPath,
            action: 'create_edge',
            sourceId: fcAction.sourceId,
            targetId: fcAction.targetId,
            edgeLabel: fcAction.label,
            edgeType: fcAction.edgeType,
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Flowchart 엣지 생성 실패')
        }

        const result = await response.json()
        return {
          action,
          success: true,
          result
        }
      }

      case 'flowchart_delete_edge': {
        const fcAction = action as FlowchartDeleteEdgeAction
        const store = useNeuralMapStore.getState()
        const projectPath = store.projectPath

        const response = await fetch('/api/flowchart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectPath,
            action: 'delete_edge',
            sourceId: fcAction.sourceId,
            targetId: fcAction.targetId,
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Flowchart 엣지 삭제 실패')
        }

        const result = await response.json()
        return {
          action,
          success: true,
          result
        }
      }

      case 'flowchart_get_graph': {
        const store = useNeuralMapStore.getState()
        const projectPath = store.projectPath

        const response = await fetch(`/api/flowchart?projectPath=${encodeURIComponent(projectPath || '')}`)

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Flowchart 조회 실패')
        }

        const result = await response.json()
        return {
          action,
          success: true,
          result
        }
      }

      // ============================================
      // 🔥 Blueprint 제어 액션
      // ============================================

      case 'blueprint_create_task': {
        const bpAction = action as BlueprintCreateTaskAction
        const store = useNeuralMapStore.getState()
        const mapId = store.mapId

        const response = await fetch(`/api/neural-map/${mapId}/blueprint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            task: {
              title: bpAction.title,
              description: bpAction.description,
              status: bpAction.status || 'todo',
              priority: bpAction.priority || 'medium',
              assignee: bpAction.assignee,
              dueDate: bpAction.dueDate,
              parentId: bpAction.parentId,
              dependencies: bpAction.dependencies,
            }
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Blueprint 태스크 생성 실패')
        }

        const result = await response.json()
        return {
          action,
          success: true,
          result
        }
      }

      case 'blueprint_update_task': {
        const bpAction = action as BlueprintUpdateTaskAction
        const store = useNeuralMapStore.getState()
        const mapId = store.mapId

        const response = await fetch(`/api/neural-map/${mapId}/blueprint`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: bpAction.taskId,
            updates: {
              title: bpAction.title,
              description: bpAction.description,
              status: bpAction.status,
              priority: bpAction.priority,
              assignee: bpAction.assignee,
              progress: bpAction.progress,
            }
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Blueprint 태스크 수정 실패')
        }

        const result = await response.json()
        return {
          action,
          success: true,
          result
        }
      }

      case 'blueprint_delete_task': {
        const bpAction = action as BlueprintDeleteTaskAction
        const store = useNeuralMapStore.getState()
        const mapId = store.mapId

        const response = await fetch(`/api/neural-map/${mapId}/blueprint?taskId=${bpAction.taskId}&deleteChildren=${bpAction.deleteChildren || false}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Blueprint 태스크 삭제 실패')
        }

        const result = await response.json()
        return {
          action,
          success: true,
          result
        }
      }

      case 'blueprint_get_tasks': {
        const bpAction = action as BlueprintGetTasksAction
        const store = useNeuralMapStore.getState()
        const mapId = store.mapId

        const params = new URLSearchParams()
        if (bpAction.status && bpAction.status !== 'all') params.set('status', bpAction.status)
        if (bpAction.assignee) params.set('assignee', bpAction.assignee)
        if (bpAction.priority) params.set('priority', bpAction.priority)

        const response = await fetch(`/api/neural-map/${mapId}/blueprint?${params}`)

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Blueprint 태스크 조회 실패')
        }

        const result = await response.json()
        return {
          action,
          success: true,
          result
        }
      }

      default:
        return {
          action,
          success: false,
          error: `Unknown action type: ${(action as any).type}`
        }
    }
  } catch (error: any) {
    return {
      action,
      success: false,
      error: error.message
    }
  }
}

// 여러 액션 병렬 실행
export async function executeActions(actions: AgentAction[]): Promise<ActionResult[]> {
  return Promise.all(actions.map(executeAction))
}

// ============================================
// 슈퍼에이전트 ToolAction → AgentAction 변환
// ============================================
export interface ToolAction {
  type: string
  data: Record<string, unknown>
  requiresElectron?: boolean
}

export function convertToolAction(toolAction: ToolAction): AgentAction | null {
  const { type, data } = toolAction

  switch (type) {
    case 'create_project':
      return {
        type: 'create_project',
        name: data.name as string,
        description: data.description as string | undefined,
        priority: data.priority as string | undefined,
        deadline: data.deadline as string | undefined,
        folderPath: data.folderPath as string | undefined,
      }

    case 'write_file':
      return {
        type: 'write_file',
        path: data.path as string,
        content: data.content as string,
      }

    case 'edit_file':
      return {
        type: 'edit_file',
        path: data.path as string,
        old_content: data.old_content as string,
        new_content: data.new_content as string,
      }

    case 'read_file':
      return {
        type: 'read_file',
        path: data.path as string,
      }

    case 'terminal_cmd':
      return {
        type: 'terminal_cmd',
        command: data.command as string,
        cwd: data.cwd as string | undefined,
        waitForOutput: true,
      }

    case 'web_search':
      return {
        type: 'web_search',
        query: data.query as string,
      }

    case 'create_task':
      return {
        type: 'create_task',
        title: data.title as string,
        description: data.description as string | undefined,
        projectId: data.projectId as string | undefined,
        priority: data.priority as string | undefined,
        assigneeId: data.assigneeId as string | undefined,
      }

    case 'generate_image':
      return {
        type: 'generate_image',
        prompt: data.prompt as string,
        image_url: data.image_url as string | undefined,
        width: data.width as number | undefined,
        height: data.height as number | undefined,
        metadata: data.metadata as GenerateImageAction['metadata'],
      }

    // 🔥 Neural Editor 액션 변환
    case 'create_node':
      return {
        type: 'create_node',
        nodeType: data.nodeType as CreateNodeAction['nodeType'],
        title: data.title as string,
        content: data.content as string | undefined,
        position: data.position as { x: number; y: number } | undefined,
        metadata: data.metadata as Record<string, unknown> | undefined,
      }

    case 'update_node':
      return {
        type: 'update_node',
        nodeId: data.nodeId as string,
        title: data.title as string | undefined,
        content: data.content as string | undefined,
        metadata: data.metadata as Record<string, unknown> | undefined,
      }

    case 'delete_node':
      return {
        type: 'delete_node',
        nodeId: data.nodeId as string,
        deleteConnectedEdges: data.deleteConnectedEdges as boolean | undefined,
      }

    case 'create_edge':
      return {
        type: 'create_edge',
        sourceNodeId: data.sourceNodeId as string,
        targetNodeId: data.targetNodeId as string,
        label: data.label as string | undefined,
        edgeType: data.type as CreateEdgeAction['edgeType'],
      }

    case 'delete_edge':
      return {
        type: 'delete_edge',
        edgeId: data.edgeId as string | undefined,
        sourceNodeId: data.sourceNodeId as string | undefined,
        targetNodeId: data.targetNodeId as string | undefined,
      }

    case 'get_graph':
      return {
        type: 'get_graph',
        includeContent: data.includeContent as boolean | undefined,
        nodeTypes: data.nodeTypes as string[] | undefined,
      }

    case 'create_file_with_node':
      return {
        type: 'create_file_with_node',
        path: data.path as string,
        content: data.content as string,
        nodeType: data.nodeType as CreateFileWithNodeAction['nodeType'],
        title: data.title as string,
        position: data.position as { x: number; y: number } | undefined,
      }

    // 🔥 Orchestrator 에이전트 호출 액션 변환
    case 'call_agent':
      return {
        type: 'call_agent',
        targetAgent: data.targetAgent as CallAgentAction['targetAgent'],
        task: data.task as string,
        context: data.context as string | undefined,
        priority: data.priority as CallAgentAction['priority'],
        waitForResult: data.waitForResult as boolean | undefined,
      }

    case 'get_agent_status':
      return {
        type: 'get_agent_status',
        targetAgent: data.targetAgent as GetAgentStatusAction['targetAgent'],
      }

    // 🔥 Flowchart 제어 액션 변환
    case 'flowchart_create_node':
      return {
        type: 'flowchart_create_node',
        nodeId: data.nodeId as string,
        label: data.label as string,
        shape: data.shape as FlowchartCreateNodeAction['shape'],
        style: data.style as string | Record<string, string> | undefined,
        position: data.position as { x: number; y: number } | undefined,
      }

    case 'flowchart_update_node':
      return {
        type: 'flowchart_update_node',
        id: data.id as string,
        label: data.label as string | undefined,
        shape: data.shape as string | undefined,
        style: data.style as string | Record<string, string> | undefined,
        position: data.position as { x: number; y: number } | undefined,
      }

    case 'flowchart_delete_node':
      return {
        type: 'flowchart_delete_node',
        nodeId: data.nodeId as string,
      }

    case 'flowchart_create_edge':
      return {
        type: 'flowchart_create_edge',
        sourceId: data.sourceId as string,
        targetId: data.targetId as string,
        label: data.label as string | undefined,
        edgeType: data.edgeType as FlowchartCreateEdgeAction['edgeType'],
      }

    case 'flowchart_delete_edge':
      return {
        type: 'flowchart_delete_edge',
        sourceId: data.sourceId as string,
        targetId: data.targetId as string,
      }

    case 'flowchart_get_graph':
      return {
        type: 'flowchart_get_graph',
        includeStyles: data.includeStyles as boolean | undefined,
      }

    // 🔥 Blueprint 제어 액션 변환
    case 'blueprint_create_task':
      return {
        type: 'blueprint_create_task',
        title: data.title as string,
        description: data.description as string | undefined,
        status: data.status as BlueprintCreateTaskAction['status'],
        priority: data.priority as BlueprintCreateTaskAction['priority'],
        assignee: data.assignee as string | undefined,
        dueDate: data.dueDate as string | undefined,
        parentId: data.parentId as string | undefined,
        dependencies: data.dependencies as string[] | undefined,
      }

    case 'blueprint_update_task':
      return {
        type: 'blueprint_update_task',
        taskId: data.taskId as string,
        title: data.title as string | undefined,
        description: data.description as string | undefined,
        status: data.status as BlueprintUpdateTaskAction['status'],
        priority: data.priority as BlueprintUpdateTaskAction['priority'],
        assignee: data.assignee as string | undefined,
        progress: data.progress as number | undefined,
      }

    case 'blueprint_delete_task':
      return {
        type: 'blueprint_delete_task',
        taskId: data.taskId as string,
        deleteChildren: data.deleteChildren as boolean | undefined,
      }

    case 'blueprint_get_tasks':
      return {
        type: 'blueprint_get_tasks',
        status: data.status as BlueprintGetTasksAction['status'],
        assignee: data.assignee as string | undefined,
        priority: data.priority as BlueprintGetTasksAction['priority'],
      }

    default:
      console.warn(`Unknown tool action type: ${type}`)
      return null
  }
}

// 슈퍼에이전트 응답의 액션들 실행
export async function executeSuperAgentActions(toolActions: ToolAction[]): Promise<ActionResult[]> {
  const results: ActionResult[] = []

  for (const toolAction of toolActions) {
    const action = convertToolAction(toolAction)
    if (action) {
      const result = await executeAction(action)
      results.push(result)
    }
  }

  return results
}

// 액션 결과 포맷팅 (채팅에 표시용)
export function formatActionResultsForChat(results: ActionResult[]): string {
  if (results.length === 0) return ''

  const lines: string[] = []

  for (const r of results) {
    const status = r.success ? '✅' : '❌'

    switch (r.action.type) {
      case 'create_project':
        lines.push(`${status} 프로젝트 생성: ${(r.action as CreateProjectAction).name}`)
        break

      case 'write_file':
      case 'create_file':
        lines.push(`${status} 파일 생성: ${(r.action as WriteFileAction).path}`)
        break

      case 'edit_file':
        lines.push(`${status} 파일 수정: ${(r.action as EditFileAction).path}`)
        break

      case 'read_file':
        lines.push(`${status} 파일 읽기: ${(r.action as ReadFileAction).path}`)
        break

      case 'terminal_cmd':
        lines.push(`${status} 명령 실행: ${(r.action as TerminalAction).command}`)
        break

      case 'create_task':
        lines.push(`${status} 태스크 생성: ${(r.action as CreateTaskAction).title}`)
        break

      case 'web_search':
        lines.push(`${status} 웹 검색: ${(r.action as WebSearchAction).query}`)
        break

      case 'generate_image':
        lines.push(`${status} 이미지 생성: ${(r.action as GenerateImageAction).prompt?.slice(0, 50)}...`)
        if (r.success && r.result) {
          const imageResult = r.result as { image_url?: string }
          if (imageResult.image_url) {
            lines.push(`   🖼️ ${imageResult.image_url}`)
          }
        }
        break

      case 'send_email':
        lines.push(`${status} 이메일 발송: ${(r.action as SendEmailAction).to}`)
        break

      case 'read_emails':
        lines.push(`${status} 이메일 조회: ${(r.action as ReadEmailsAction).filter}`)
        break

      case 'reply_email':
        lines.push(`${status} 이메일 답장`)
        break

      case 'get_calendar_events':
        lines.push(`${status} 일정 조회: ${(r.action as GetCalendarEventsAction).period}`)
        break

      case 'create_calendar_event':
        lines.push(`${status} 일정 생성: ${(r.action as CreateCalendarEventAction).title}`)
        break

      case 'create_report':
        lines.push(`${status} 보고서 생성: ${(r.action as GenerateReportAction).title}`)
        break

      case 'summarize_schedule':
        lines.push(`${status} 스케줄 요약: ${(r.action as SummarizeScheduleAction).period}`)
        break

      // 🔥 Neural Editor 액션 포맷팅
      case 'create_node':
        lines.push(`${status} 노드 생성: ${(r.action as CreateNodeAction).title}`)
        if (r.success && r.result) {
          lines.push(`   📍 ID: ${(r.result as { nodeId?: string }).nodeId}`)
        }
        break

      case 'update_node':
        lines.push(`${status} 노드 수정: ${(r.action as UpdateNodeAction).nodeId}`)
        break

      case 'delete_node':
        lines.push(`${status} 노드 삭제: ${(r.action as DeleteNodeAction).nodeId}`)
        break

      case 'create_edge':
        lines.push(`${status} 엣지 생성: ${(r.action as CreateEdgeAction).sourceNodeId} → ${(r.action as CreateEdgeAction).targetNodeId}`)
        break

      case 'delete_edge':
        lines.push(`${status} 엣지 삭제`)
        break

      case 'get_graph':
        if (r.success && r.result) {
          const graphResult = r.result as { nodeCount?: number; edgeCount?: number }
          lines.push(`${status} 그래프 조회: 노드 ${graphResult.nodeCount}개, 엣지 ${graphResult.edgeCount}개`)
        } else {
          lines.push(`${status} 그래프 조회`)
        }
        break

      case 'create_file_with_node':
        lines.push(`${status} 파일+노드 생성: ${(r.action as CreateFileWithNodeAction).path}`)
        if (r.success && r.result) {
          lines.push(`   📍 Node ID: ${(r.result as { nodeId?: string }).nodeId}`)
        }
        break

      // 🔥 Orchestrator 에이전트 호출 액션 포맷팅
      case 'call_agent':
        lines.push(`${status} 에이전트 호출: ${(r.action as CallAgentAction).targetAgent}`)
        if (r.success && r.result) {
          const agentResult = r.result as { response?: { message?: string } }
          if (agentResult.response?.message) {
            lines.push(`   💬 ${agentResult.response.message.slice(0, 100)}...`)
          }
        }
        break

      case 'get_agent_status':
        lines.push(`${status} 에이전트 상태 조회`)
        break

      // 🔥 Flowchart 제어 액션 포맷팅
      case 'flowchart_create_node':
        lines.push(`${status} Flowchart 노드 생성: ${(r.action as FlowchartCreateNodeAction).label}`)
        break

      case 'flowchart_update_node':
        lines.push(`${status} Flowchart 노드 수정: ${(r.action as FlowchartUpdateNodeAction).id}`)
        break

      case 'flowchart_delete_node':
        lines.push(`${status} Flowchart 노드 삭제: ${(r.action as FlowchartDeleteNodeAction).nodeId}`)
        break

      case 'flowchart_create_edge':
        lines.push(`${status} Flowchart 엣지 생성: ${(r.action as FlowchartCreateEdgeAction).sourceId} → ${(r.action as FlowchartCreateEdgeAction).targetId}`)
        break

      case 'flowchart_delete_edge':
        lines.push(`${status} Flowchart 엣지 삭제`)
        break

      case 'flowchart_get_graph':
        if (r.success && r.result) {
          const fcResult = r.result as { nodes?: unknown[]; edges?: unknown[] }
          lines.push(`${status} Flowchart 조회: 노드 ${fcResult.nodes?.length || 0}개, 엣지 ${fcResult.edges?.length || 0}개`)
        } else {
          lines.push(`${status} Flowchart 조회`)
        }
        break

      // 🔥 Blueprint 제어 액션 포맷팅
      case 'blueprint_create_task':
        lines.push(`${status} Blueprint 태스크 생성: ${(r.action as BlueprintCreateTaskAction).title}`)
        break

      case 'blueprint_update_task':
        lines.push(`${status} Blueprint 태스크 수정: ${(r.action as BlueprintUpdateTaskAction).taskId}`)
        break

      case 'blueprint_delete_task':
        lines.push(`${status} Blueprint 태스크 삭제: ${(r.action as BlueprintDeleteTaskAction).taskId}`)
        break

      case 'blueprint_get_tasks':
        if (r.success && r.result) {
          const bpResult = r.result as { tasks?: unknown[] }
          lines.push(`${status} Blueprint 태스크 조회: ${bpResult.tasks?.length || 0}개`)
        } else {
          lines.push(`${status} Blueprint 태스크 조회`)
        }
        break

      default: {
        const unknownAction = r.action as { type: string }
        lines.push(`${status} ${unknownAction.type}`)
      }
    }

    if (r.error) {
      lines.push(`   오류: ${r.error}`)
    }
  }

  return lines.join('\n')
}

// NOTE: window.electron 타입은 types/electron.d.ts에 정의되어 있습니다
