/**
 * Agent Action System
 * Agent API → 액션 반환 → 프론트엔드에서 Electron IPC로 실행
 * 🔥 슈퍼에이전트 도구 지원
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
  const webOnlyActions = ['web_search', 'create_project', 'create_task']

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

      default:
        lines.push(`${status} ${r.action.type}`)
    }

    if (r.error) {
      lines.push(`   오류: ${r.error}`)
    }
  }

  return lines.join('\n')
}

// NOTE: window.electron 타입은 types/electron.d.ts에 정의되어 있습니다
