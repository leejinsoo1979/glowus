/**
 * Super Agent Tools - 모든 도구를 사용할 수 있는 슈퍼 에이전트 도구
 * Cursor/Claude Code급 에이전트 기능
 */

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

// ============================================
// Tool 타입 정의
// ============================================
export type SuperAgentToolName =
  | 'create_project'
  | 'read_file'
  | 'write_file'
  | 'edit_file'
  | 'search_files'
  | 'get_file_structure'
  | 'run_terminal'
  | 'web_search'
  | 'create_task'
  | 'list_projects'

export interface ToolAction {
  type: 'create_project' | 'write_file' | 'edit_file' | 'terminal_cmd' | 'web_search' | 'create_task' | 'read_file'
  data: Record<string, unknown>
  requiresElectron?: boolean
}

export interface ToolExecutionResult {
  success: boolean
  result?: unknown
  error?: string
  action?: ToolAction  // 프론트엔드에서 실행해야 할 액션
}

// ============================================
// 1. 프로젝트 생성 도구
// ============================================
export const createProjectTool = new DynamicStructuredTool({
  name: 'create_project',
  description: '새 프로젝트를 생성합니다. 프로젝트 이름, 설명, 우선순위 등을 지정할 수 있습니다.',
  schema: z.object({
    name: z.string().describe('프로젝트 이름 (필수)'),
    description: z.string().optional().describe('프로젝트 설명'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('우선순위'),
    deadline: z.string().optional().describe('마감일 (YYYY-MM-DD 형식)'),
    folderPath: z.string().optional().describe('프로젝트 폴더 경로 (Electron에서만)'),
  }),
  func: async (params) => {
    // 실제 생성은 프론트엔드/API에서 처리
    return JSON.stringify({
      success: true,
      message: `프로젝트 "${params.name}" 생성을 준비했습니다.`,
      action: {
        type: 'create_project',
        data: params,
        requiresElectron: !!params.folderPath
      }
    })
  },
})

// ============================================
// 2. 파일 읽기 도구
// ============================================
export const readFileTool = new DynamicStructuredTool({
  name: 'read_file',
  description: '프로젝트의 특정 파일 내용을 읽습니다.',
  schema: z.object({
    path: z.string().describe('읽을 파일 경로 (예: src/App.tsx)'),
  }),
  func: async ({ path }) => {
    return JSON.stringify({
      success: true,
      message: `파일 "${path}" 읽기를 요청했습니다.`,
      action: {
        type: 'read_file',
        data: { path },
        requiresElectron: true
      }
    })
  },
})

// ============================================
// 3. 파일 쓰기 도구
// ============================================
export const writeFileTool = new DynamicStructuredTool({
  name: 'write_file',
  description: '새 파일을 생성하거나 기존 파일을 완전히 덮어씁니다.',
  schema: z.object({
    path: z.string().describe('파일 경로'),
    content: z.string().describe('파일 내용'),
  }),
  func: async ({ path, content }) => {
    return JSON.stringify({
      success: true,
      message: `파일 "${path}" 쓰기를 준비했습니다.`,
      action: {
        type: 'write_file',
        data: { path, content },
        requiresElectron: true
      }
    })
  },
})

// ============================================
// 4. 파일 수정 도구 (부분 교체)
// ============================================
export const editFileTool = new DynamicStructuredTool({
  name: 'edit_file',
  description: '파일의 특정 부분을 수정합니다. old_content를 new_content로 교체합니다.',
  schema: z.object({
    path: z.string().describe('수정할 파일 경로'),
    old_content: z.string().describe('교체할 기존 코드 (정확히 일치해야 함)'),
    new_content: z.string().describe('새로운 코드'),
  }),
  func: async ({ path, old_content, new_content }) => {
    return JSON.stringify({
      success: true,
      message: `파일 "${path}" 수정을 준비했습니다.`,
      action: {
        type: 'edit_file',
        data: { path, old_content, new_content },
        requiresElectron: true
      }
    })
  },
})

// ============================================
// 5. 파일 검색 도구
// ============================================
export const searchFilesTool = new DynamicStructuredTool({
  name: 'search_files',
  description: '프로젝트에서 파일이나 코드를 검색합니다.',
  schema: z.object({
    query: z.string().describe('검색할 키워드'),
    type: z.enum(['filename', 'content', 'all']).optional().describe('검색 타입'),
  }),
  func: async ({ query, type }) => {
    return JSON.stringify({
      success: true,
      message: `"${query}" 검색을 요청했습니다.`,
      action: {
        type: 'read_file',
        data: { query, searchType: type || 'all' },
        requiresElectron: true
      }
    })
  },
})

// ============================================
// 6. 폴더 구조 조회 도구
// ============================================
export const getFileStructureTool = new DynamicStructuredTool({
  name: 'get_file_structure',
  description: '프로젝트의 폴더 및 파일 구조를 가져옵니다.',
  schema: z.object({
    path: z.string().optional().describe('특정 폴더 경로 (없으면 전체)'),
    depth: z.number().optional().describe('탐색 깊이 (기본: 3)'),
  }),
  func: async ({ path, depth }) => {
    return JSON.stringify({
      success: true,
      message: '프로젝트 구조를 조회합니다.',
      action: {
        type: 'read_file',
        data: { path, depth: depth || 3, getStructure: true },
        requiresElectron: true
      }
    })
  },
})

// ============================================
// 7. 터미널 명령 실행 도구
// ============================================
export const runTerminalTool = new DynamicStructuredTool({
  name: 'run_terminal',
  description: '터미널 명령어를 실행합니다. npm, git, 빌드 명령 등을 수행할 수 있습니다.',
  schema: z.object({
    command: z.string().describe('실행할 명령어'),
    cwd: z.string().optional().describe('작업 디렉토리'),
  }),
  func: async ({ command, cwd }) => {
    // 위험한 명령어 체크
    const dangerousPatterns = [
      /rm\s+-rf\s+[\/~]/i,
      /sudo\s+rm/i,
      /mkfs/i,
      /dd\s+if=/i,
      />\s*\/dev\//i,
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return JSON.stringify({
          success: false,
          error: '보안상 위험한 명령어는 실행할 수 없습니다.'
        })
      }
    }

    return JSON.stringify({
      success: true,
      message: `명령어 "${command}" 실행을 준비했습니다.`,
      action: {
        type: 'terminal_cmd',
        data: { command, cwd },
        requiresElectron: true
      }
    })
  },
})

// ============================================
// 8. 웹 검색 도구
// ============================================
export const webSearchTool = new DynamicStructuredTool({
  name: 'web_search',
  description: '웹에서 정보를 검색합니다. 최신 문서, 라이브러리 사용법, 에러 해결책 등을 찾습니다.',
  schema: z.object({
    query: z.string().describe('검색할 쿼리'),
  }),
  func: async ({ query }) => {
    // 실제 검색은 Tavily API로 수행
    try {
      const { tavily } = await import('@tavily/core')
      const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY || '' })

      if (!process.env.TAVILY_API_KEY) {
        return JSON.stringify({
          success: false,
          error: 'TAVILY_API_KEY가 설정되지 않았습니다.'
        })
      }

      const response = await tavilyClient.search(query, {
        maxResults: 5,
        includeAnswer: true,
        searchDepth: 'advanced',
      })

      return JSON.stringify({
        success: true,
        answer: response.answer,
        results: response.results.map((r: any) => ({
          title: r.title,
          url: r.url,
          content: r.content?.slice(0, 300),
        })),
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `검색 실패: ${error}`
      })
    }
  },
})

// ============================================
// 9. 태스크 생성 도구
// ============================================
export const createTaskTool = new DynamicStructuredTool({
  name: 'create_task',
  description: '프로젝트에 새 태스크(할 일)를 생성합니다.',
  schema: z.object({
    title: z.string().describe('태스크 제목'),
    description: z.string().optional().describe('태스크 설명'),
    projectId: z.string().optional().describe('프로젝트 ID'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('우선순위'),
    assigneeId: z.string().optional().describe('담당자 에이전트 ID'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `태스크 "${params.title}" 생성을 준비했습니다.`,
      action: {
        type: 'create_task',
        data: params,
      }
    })
  },
})

// ============================================
// 10. 프로젝트 목록 조회 도구
// ============================================
export const listProjectsTool = new DynamicStructuredTool({
  name: 'list_projects',
  description: '사용자의 프로젝트 목록을 조회합니다.',
  schema: z.object({
    status: z.enum(['all', 'active', 'completed', 'archived']).optional().describe('프로젝트 상태 필터'),
  }),
  func: async ({ status }) => {
    // 실제 조회는 API에서 처리
    return JSON.stringify({
      success: true,
      message: '프로젝트 목록을 조회합니다.',
      action: {
        type: 'read_file',
        data: { listProjects: true, status: status || 'all' },
      }
    })
  },
})

// ============================================
// 모든 도구 내보내기
// ============================================
export const SUPER_AGENT_TOOLS = {
  create_project: createProjectTool,
  read_file: readFileTool,
  write_file: writeFileTool,
  edit_file: editFileTool,
  search_files: searchFilesTool,
  get_file_structure: getFileStructureTool,
  run_terminal: runTerminalTool,
  web_search: webSearchTool,
  create_task: createTaskTool,
  list_projects: listProjectsTool,
}

export function getSuperAgentTools(enabledTools?: SuperAgentToolName[]): DynamicStructuredTool[] {
  if (!enabledTools) {
    return Object.values(SUPER_AGENT_TOOLS)
  }
  return enabledTools
    .map(name => SUPER_AGENT_TOOLS[name])
    .filter(Boolean)
}

export function getAllSuperAgentToolNames(): SuperAgentToolName[] {
  return Object.keys(SUPER_AGENT_TOOLS) as SuperAgentToolName[]
}
