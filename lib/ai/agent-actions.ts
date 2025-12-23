/**
 * Agent Action System
 * Agent API → 액션 반환 → 프론트엔드에서 Electron IPC로 실행
 */

// 액션 타입 정의
export type AgentAction =
  | WriteFileAction
  | CreateFileAction
  | TerminalAction
  | WebSearchAction

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

// 액션 실행 결과
export interface ActionResult {
  action: AgentAction
  success: boolean
  result?: unknown
  error?: string
}

// 프론트엔드에서 사용할 액션 실행기
export async function executeAction(action: AgentAction): Promise<ActionResult> {
  // window.electron이 없으면 (웹 모드) 시뮬레이션
  if (typeof window === 'undefined' || !window.electron) {
    return {
      action,
      success: false,
      error: 'Electron 환경에서만 실행 가능합니다'
    }
  }

  try {
    switch (action.type) {
      case 'write_file': {
        await window.electron.fs.writeFile(action.path, action.content)
        return {
          action,
          success: true,
          result: { path: action.path, bytesWritten: action.content.length }
        }
      }

      case 'create_file': {
        await window.electron.fs.writeFile(action.path, action.content)
        return {
          action,
          success: true,
          result: { path: action.path, created: true }
        }
      }

      case 'terminal_cmd': {
        // 터미널 ID 생성
        const terminalId = `agent-${Date.now()}`

        // 터미널 생성
        await window.electron.terminal.create(terminalId, action.cwd)

        // 명령어 실행
        await window.electron.terminal.write(terminalId, action.command + '\n')

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
        // 웹 검색은 API로 처리해야 함
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

// window.electron 타입 정의
declare global {
  interface Window {
    electron?: {
      invoke: (channel: string, ...args: any[]) => Promise<any>
      fs: {
        readFile: (path: string) => Promise<string>
        writeFile: (path: string, content: string) => Promise<void>
        readDirectory: (path: string, options?: any) => Promise<any>
        selectDirectory: () => Promise<{ kind: string; name: string; path: string } | null>
        getCwd: () => Promise<string>
        scanTree: (rootPath: string, options?: any) => Promise<any>
        fileStats: (dirPath: string) => Promise<Array<{ extension: string; count: number; size: number }>>
        scanApiRoutes: (dirPath: string) => Promise<Array<{ path: string; method: string; file: string }>>
        scanTypes: (dirPath: string, options?: { extensions?: string[] }) => Promise<any[]>
        scanSchema: (dirPath: string) => Promise<any[]>
        isEmpty: (dirPath: string) => Promise<{
          isEmpty: boolean
          folderName: string
          path: string
          existingFiles: string[]
          fileCount: number
          error?: string
        }>
      }
      project: {
        scaffold: (params: {
          dirPath: string
          template: string
          options?: { typescript?: boolean; tailwind?: boolean; eslint?: boolean }
        }) => Promise<{
          success: boolean
          template?: string
          projectName?: string
          path?: string
          message?: string
          error?: string
        }>
        onScaffolded: (callback: (data: {
          template: string
          projectName: string
          path: string
          results?: string[]
        }) => void) => () => void
      }
      git: {
        log: (dirPath: string, options?: { maxCommits?: number }) => Promise<string>
        branches: (dirPath: string) => Promise<string>
      }
      viewfinder: {
        captureWebview: (webContentsId: number, rect?: { x: number; y: number; width: number; height: number }) => Promise<{
          success: boolean
          dataUrl?: string
          width?: number
          height?: number
          timestamp?: number
          error?: string
        }>
        captureWindow: (rect?: { x: number; y: number; width: number; height: number }) => Promise<{
          success: boolean
          dataUrl?: string
          width?: number
          height?: number
          timestamp?: number
          error?: string
        }>
      }
      terminal: {
        create: (id: string, cwd?: string) => Promise<{ success: boolean; shell?: string; cwd?: string; pid?: number; error?: string }>
        write: (id: string, data: string) => Promise<{ success: boolean; error?: string }>
        resize: (id: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>
        kill: (id: string) => Promise<{ success: boolean; error?: string }>
        onData: (callback: (id: string, data: string) => void) => () => void
        onExit: (callback: (id: string, exitCode: number, signal?: number) => void) => () => void
      }
      openWebviewDevTools: (id?: number) => Promise<{ success: boolean; message: string }>
      onMenuEvent: (event: string, callback: () => void) => () => void
      agent: {
        execute: (params: {
          messages: Array<{ role: string; content: string }>
          model: string
          context: {
            files: Array<{ id: string; name: string; path?: string; content?: string; type: string }>
            projectPath?: string
          }
        }) => Promise<{
          success: boolean
          content?: string
          toolCalls?: string[]
          error?: string
        }>
        onDesign: (callback: (data: {
          type: 'flowchart' | 'schema' | 'logic'
          title: string
          mermaidCode?: string
          schema?: string
          pseudocode?: string
          functions?: string[]
          filePath: string
        }) => void) => () => void
        onSwitchTab: (callback: (data: { tab: string }) => void) => () => void
      }
    }
  }
}
