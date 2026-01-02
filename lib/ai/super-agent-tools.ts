/**
 * Super Agent Tools - 모든 도구를 사용할 수 있는 슈퍼 에이전트 도구
 * Cursor/Claude Code급 에이전트 기능
 */

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

// 워크플로우 도구 임포트
import {
  createWorkflowTool,
  executeWorkflowTool,
  listWorkflowsTool,
  getWorkflowHistoryTool,
  useWorkflowTemplateTool,
  scheduleWorkflowTool,
} from './workflow-tools'

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
  | 'generate_image'
  | 'create_task'
  | 'list_projects'
  // 🔥 앱 내비게이션 및 스킬 도구
  | 'navigate_to'
  | 'use_skill'
  | 'get_emails'
  | 'send_email'
  | 'get_calendar_events'
  | 'create_calendar_event'
  // 🔥 Neural Editor 제어 도구
  | 'create_node'
  | 'update_node'
  | 'delete_node'
  | 'create_edge'
  | 'delete_edge'
  | 'get_graph'
  | 'create_file_with_node'
  // 🔥 Orchestrator 에이전트 호출 도구
  | 'call_agent'
  | 'get_agent_status'
  // 🔥 Flowchart 제어 도구
  | 'flowchart_create_node'
  | 'flowchart_update_node'
  | 'flowchart_delete_node'
  | 'flowchart_create_edge'
  | 'flowchart_delete_edge'
  | 'flowchart_get_graph'
  // 🔥 Blueprint 제어 도구
  | 'blueprint_create_task'
  | 'blueprint_update_task'
  | 'blueprint_delete_task'
  | 'blueprint_get_tasks'
  // 🔥 Agent Builder 워크플로우 제어 도구
  | 'agent_create_node'
  | 'agent_connect_nodes'
  | 'agent_delete_node'
  | 'agent_update_node'
  | 'agent_generate_workflow'
  | 'agent_get_workflow'
  | 'agent_deploy'
  | 'agent_clear'
  // 🔥 다단계 루프 워크플로우 도구
  | 'create_workflow'
  | 'execute_workflow'
  | 'list_workflows'
  | 'get_workflow_history'
  | 'use_workflow_template'
  | 'schedule_workflow'
  // 🔥 브라우저 자동화 도구
  | 'browser_automation'

export interface ToolAction {
  type:
    | 'create_project' | 'write_file' | 'edit_file' | 'terminal_cmd'
    | 'web_search' | 'create_task' | 'read_file' | 'generate_image'
    // 🔥 앱 내비게이션 및 스킬 액션
    | 'navigate_to' | 'use_skill' | 'get_emails' | 'send_email' | 'get_calendar_events' | 'create_calendar_event'
    // 🔥 Neural Editor 액션 타입
    | 'create_node' | 'update_node' | 'delete_node'
    | 'create_edge' | 'delete_edge' | 'get_graph' | 'create_file_with_node'
    // 🔥 Orchestrator 에이전트 호출
    | 'call_agent' | 'get_agent_status'
    // 🔥 Flowchart 액션 타입
    | 'flowchart_create_node' | 'flowchart_update_node' | 'flowchart_delete_node'
    | 'flowchart_create_edge' | 'flowchart_delete_edge' | 'flowchart_get_graph'
    // 🔥 Blueprint 액션 타입
    | 'blueprint_create_task' | 'blueprint_update_task' | 'blueprint_delete_task' | 'blueprint_get_tasks'
    // 🔥 Agent Builder 액션 타입
    | 'agent_create_node' | 'agent_connect_nodes' | 'agent_delete_node' | 'agent_update_node'
    | 'agent_generate_workflow' | 'agent_get_workflow' | 'agent_deploy' | 'agent_clear'
    // 🔥 브라우저 자동화 액션
    | 'browser_automation'
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
// 9. 이미지 생성 도구 (Nano Banana Pro - Gemini 3 Pro Image)
// ============================================
export const generateImageTool = new DynamicStructuredTool({
  name: 'generate_image',
  description: `🎨 Nano Banana Pro (나노바나나 프로) - Google Gemini 3 Pro 기반 최고급 AI 이미지 생성

기능:
- 텍스트 → 이미지 생성 (1K/2K/4K 해상도)
- 이미지 내 텍스트 렌더링 (메뉴, 인포그래픽)
- 실시간 검색 기반 이미지 (날씨, 주가 등)
- 다양한 스타일 지원

예시: "귀여운 고양이가 책을 읽는 모습", "현대적인 카페 로고 디자인"`,
  schema: z.object({
    prompt: z.string().describe('생성할 이미지에 대한 상세한 설명 (한글/영어 모두 가능)'),
    aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).optional().describe('이미지 비율 (기본: 1:1)'),
    imageSize: z.enum(['1K', '2K', '4K']).optional().describe('해상도 (기본: 1K)'),
    style: z.enum(['realistic', 'artistic', 'anime', 'digital_art', 'photography', '3d', 'watercolor', 'sketch']).optional().describe('이미지 스타일'),
    useGrounding: z.boolean().optional().describe('실시간 검색 기반 이미지 생성 (날씨, 뉴스 등)'),
  }),
  func: async (params) => {
    try {
      // Nano Banana Pro API 호출 (서버사이드 호출을 위한 절대 경로)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/skills/nano-banana`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          aspectRatio: params.aspectRatio || '1:1',
          imageSize: params.imageSize || '1K',
          style: params.style,
          useGrounding: params.useGrounding || false,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        return JSON.stringify({
          success: false,
          error: result.error || '이미지 생성 실패',
          suggestion: result.suggestion,
        })
      }

      return JSON.stringify({
        success: true,
        message: `🎨 나노바나나 Pro로 이미지가 생성되었습니다!`,
        image_url: result.image_url,
        model: result.model,
        action: {
          type: 'generate_image',
          data: {
            prompt: params.prompt,
            image_url: result.image_url,
            image_base64: result.image_base64,
            mime_type: result.mime_type,
            metadata: result.metadata,
          }
        }
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `이미지 생성 중 오류: ${error}`
      })
    }
  },
})

// ============================================
// 10. 태스크 생성 도구
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
// 🔥 앱 내비게이션 및 스킬 도구
// ============================================

// 11. 앱 내 페이지 이동 도구
export const navigateToTool = new DynamicStructuredTool({
  name: 'navigate_to',
  description: `앱 내 특정 페이지로 이동합니다. 사용자에게 해당 페이지를 보여줍니다.

사용 가능한 페이지:
- dashboard: 대시보드
- calendar: 캘린더 (일정 관리)
- email: 이메일 (메일 확인/발송)
- messenger: 메신저
- projects: 프로젝트 목록
- workflows: 워크플로우
- agents: AI 에이전트
- neural-map: 뉴럴맵
- kpis: KPI 대시보드
- commits: 커밋 기록
- apps/ai-slides: AI 슬라이드

예시: "캘린더 가서 오늘 일정 확인해줘" → navigate_to("calendar")`,
  schema: z.object({
    page: z.string().describe('이동할 페이지 (calendar, email, projects, workflows 등)'),
    projectId: z.string().optional().describe('프로젝트 ID (projects 페이지에서 사용)'),
    agentId: z.string().optional().describe('에이전트 ID (agents 페이지에서 사용)'),
  }),
  func: async (params) => {
    const pageRoutes: Record<string, string> = {
      dashboard: '/dashboard-group',
      calendar: '/dashboard-group/calendar',
      email: '/dashboard-group/email',
      messenger: '/dashboard-group/messenger',
      projects: '/dashboard-group/project',
      workflows: '/dashboard-group/workflows',
      agents: '/dashboard-group/agents',
      'neural-map': '/dashboard-group/neural-map',
      kpis: '/dashboard-group/kpis',
      commits: '/dashboard-group/commits',
      'ai-slides': '/dashboard-group/apps/ai-slides',
    }
    const route = pageRoutes[params.page] || `/dashboard-group/${params.page}`
    const navParams: Record<string, string> = {}
    if (params.projectId) navParams.projectId = params.projectId
    if (params.agentId) navParams.agentId = params.agentId
    return JSON.stringify({
      success: true,
      message: `${params.page} 페이지로 이동합니다.`,
      action: {
        type: 'navigate_to',
        data: { route, params: Object.keys(navParams).length > 0 ? navParams : undefined },
      }
    })
  },
})

// 12. 스킬(API) 호출 도구
export const useSkillTool = new DynamicStructuredTool({
  name: 'use_skill',
  description: `앱 내 스킬(API)을 호출합니다. YouTube 요약, PPT 생성, 이미지 생성 등 다양한 스킬을 사용할 수 있습니다.

사용 가능한 스킬:
- youtube-transcript: YouTube 영상 자막 추출 (url 필요)
- summarize: AI 요약 (text 필요)
- ppt-pro: PPT 슬라이드 생성 (topic, slides 필요)
- nano-banana: 이미지 생성 (prompt 필요)
- ppt-generator: 기본 PPT 생성 (topic 필요)

예시: "이 YouTube 영상 요약해줘" → use_skill("youtube-transcript", url="https://...")`,
  schema: z.object({
    skillId: z.string().describe('스킬 ID (youtube-transcript, summarize, ppt-pro 등)'),
    url: z.string().optional().describe('URL (youtube-transcript 스킬용)'),
    text: z.string().optional().describe('텍스트 (summarize 스킬용)'),
    topic: z.string().optional().describe('주제 (ppt-pro, ppt-generator 스킬용)'),
    prompt: z.string().optional().describe('프롬프트 (nano-banana 이미지 생성용)'),
    slides: z.number().optional().describe('슬라이드 수 (ppt-pro용)'),
  }),
  func: async (params) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      // 입력 파라미터 구성
      const inputs: Record<string, any> = {}
      if (params.url) inputs.url = params.url
      if (params.text) inputs.text = params.text
      if (params.topic) inputs.topic = params.topic
      if (params.prompt) inputs.prompt = params.prompt
      if (params.slides) inputs.slides = params.slides

      const response = await fetch(`${baseUrl}/api/skills/${params.skillId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs),
      })
      const result = await response.json()
      return JSON.stringify({
        success: result.success !== false,
        result,
        action: {
          type: 'use_skill',
          data: { skillId: params.skillId, inputs, result },
        }
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `스킬 호출 실패: ${error}`,
      })
    }
  },
})

// 13. 이메일 조회 도구
export const getEmailsTool = new DynamicStructuredTool({
  name: 'get_emails',
  description: `이메일 목록을 조회합니다. 받은편지함, 보낸편지함, 중요 메일 등을 확인할 수 있습니다.

예시: "최근 이메일 확인해줘" → get_emails({folder: "inbox", limit: 10})`,
  schema: z.object({
    folder: z.enum(['inbox', 'sent', 'starred', 'drafts', 'trash', 'all']).optional().describe('폴더 (기본: inbox)'),
    limit: z.number().optional().describe('조회할 메일 수 (기본: 20)'),
    unreadOnly: z.boolean().optional().describe('읽지 않은 메일만'),
    search: z.string().optional().describe('검색어'),
  }),
  func: async (params) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/tools/get-emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder: params.folder || 'inbox',
          limit: params.limit || 20,
        }),
      })
      const result = await response.json()
      const emails = result.emails || []

      // LLM이 이해하기 쉬운 형태로 이메일 요약 생성
      let emailSummary = ''
      if (emails.length > 0) {
        emailSummary = emails.map((e: any, i: number) =>
          `${i + 1}. [${e.isRead ? '읽음' : '안읽음'}] ${e.from} - "${e.subject}" (${e.date})`
        ).join('\n')
      }

      return JSON.stringify({
        success: true,
        completed: true, // 작업 완료 플래그
        total_emails: emails.length,
        folder: params.folder || 'inbox',
        summary: emailSummary || '받은편지함에 이메일이 없습니다.',
        instruction: '위 이메일 목록을 사용자에게 자연스럽게 알려주세요. 추가 도구 호출이 필요없습니다.',
        emails: emails,
        action: {
          type: 'get_emails',
          data: { folder: params.folder || 'inbox', emails },
        }
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        completed: true,
        error: `이메일 조회 실패: ${error}`,
      })
    }
  },
})

// 14. 이메일 발송 도구
export const sendEmailTool = new DynamicStructuredTool({
  name: 'send_email',
  description: `이메일을 발송합니다.

예시: "팀원에게 회의 일정 메일 보내줘"`,
  schema: z.object({
    to: z.string().describe('받는 사람 이메일'),
    subject: z.string().describe('제목'),
    body: z.string().describe('본문 내용'),
    cc: z.string().optional().describe('참조'),
    attachments: z.array(z.string()).optional().describe('첨부파일 URL'),
  }),
  func: async (params) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const result = await response.json()
      return JSON.stringify({
        success: result.success,
        message: result.success ? `${params.to}에게 메일을 발송했습니다.` : result.error,
        action: {
          type: 'send_email',
          data: params,
        }
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `이메일 발송 실패: ${error}`,
      })
    }
  },
})

// 15. 캘린더 일정 조회 도구
export const getCalendarEventsTool = new DynamicStructuredTool({
  name: 'get_calendar_events',
  description: `캘린더 일정을 조회합니다. 오늘, 이번 주, 특정 날짜의 일정을 확인할 수 있습니다.

예시: "오늘 일정 뭐 있어?" → get_calendar_events({range: "today"})`,
  schema: z.object({
    range: z.enum(['today', 'week', 'month', 'custom']).optional().describe('조회 범위'),
    startDate: z.string().optional().describe('시작 날짜 (YYYY-MM-DD)'),
    endDate: z.string().optional().describe('종료 날짜 (YYYY-MM-DD)'),
  }),
  func: async (params) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const today = new Date()
      let start: Date, end: Date

      switch (params.range) {
        case 'today':
          start = new Date(today.setHours(0, 0, 0, 0))
          end = new Date(today.setHours(23, 59, 59, 999))
          break
        case 'week':
          start = new Date(today)
          start.setDate(today.getDate() - today.getDay())
          end = new Date(start)
          end.setDate(start.getDate() + 6)
          break
        case 'month':
          start = new Date(today.getFullYear(), today.getMonth(), 1)
          end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
          break
        default:
          start = params.startDate ? new Date(params.startDate) : new Date()
          end = params.endDate ? new Date(params.endDate) : new Date()
      }

      const response = await fetch(`${baseUrl}/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}`)
      const result = await response.json()
      return JSON.stringify({
        success: true,
        events: result.events || [],
        range: { start: start.toISOString(), end: end.toISOString() },
        action: {
          type: 'get_calendar_events',
          data: { range: params.range, events: result.events },
        }
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `캘린더 조회 실패: ${error}`,
      })
    }
  },
})

// 16. 캘린더 일정 생성 도구
export const createCalendarEventTool = new DynamicStructuredTool({
  name: 'create_calendar_event',
  description: `캘린더에 새 일정을 생성합니다.

예시: "내일 오후 2시에 팀 미팅 일정 잡아줘"`,
  schema: z.object({
    title: z.string().describe('일정 제목'),
    startTime: z.string().describe('시작 시간 (ISO 형식 또는 자연어)'),
    endTime: z.string().optional().describe('종료 시간'),
    description: z.string().optional().describe('설명'),
    location: z.string().optional().describe('장소'),
    attendees: z.array(z.string()).optional().describe('참석자 이메일'),
  }),
  func: async (params) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/calendar/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const result = await response.json()
      return JSON.stringify({
        success: result.success,
        event: result.event,
        message: result.success ? `"${params.title}" 일정이 생성되었습니다.` : result.error,
        action: {
          type: 'create_calendar_event',
          data: params,
        }
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `일정 생성 실패: ${error}`,
      })
    }
  },
})

// ============================================
// 🔥 Neural Editor 제어 도구들
// ============================================

// 17. 노드 생성 도구
export const createNodeTool = new DynamicStructuredTool({
  name: 'create_node',
  description: `뉴런 에디터에 새 노드를 생성합니다. 노트, 아이디어, 프로젝트, 태스크 등 다양한 타입의 노드를 만들 수 있습니다.

사용 예시:
- 새 노트/문서: type="doc", title="회의록", content="..."
- 아이디어: type="idea", title="새 기능", content="..."
- 프로젝트: type="project", title="MyApp"
- 태스크: type="task", title="버그 수정"
- 파일 노드: type="file", title="App.tsx"`,
  schema: z.object({
    type: z.enum(['concept', 'project', 'doc', 'idea', 'decision', 'memory', 'task', 'person', 'insight', 'folder', 'file']).describe('노드 타입'),
    title: z.string().describe('노드 제목'),
    content: z.string().optional().describe('노드 내용 (마크다운 지원)'),
    position: z.object({
      x: z.number().optional(),
      y: z.number().optional(),
      z: z.number().optional(),
    }).optional().describe('노드 위치 (없으면 자동 배치)'),
  }),
  func: async (params) => {
    const pos = params.position || { x: Math.random() * 500, y: Math.random() * 500, z: 0 }
    return JSON.stringify({
      success: true,
      message: `노드 "${params.title}" 생성을 준비했습니다.`,
      action: {
        type: 'create_node',
        data: {
          nodeType: params.type,
          title: params.title,
          content: params.content || '',
          position: { x: pos.x || 0, y: pos.y || 0, z: pos.z || 0 },
          metadata: {},
        },
      }
    })
  },
})

// 12. 노드 수정 도구
export const updateNodeTool = new DynamicStructuredTool({
  name: 'update_node',
  description: '기존 노드의 내용, 제목을 수정합니다.',
  schema: z.object({
    nodeId: z.string().describe('수정할 노드 ID'),
    title: z.string().optional().describe('새 제목'),
    content: z.string().optional().describe('새 내용'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `노드 "${params.nodeId}" 수정을 준비했습니다.`,
      action: {
        type: 'update_node',
        data: params,
      }
    })
  },
})

// 13. 노드 삭제 도구
export const deleteNodeTool = new DynamicStructuredTool({
  name: 'delete_node',
  description: '노드를 삭제합니다. 연결된 엣지도 함께 삭제됩니다.',
  schema: z.object({
    nodeId: z.string().describe('삭제할 노드 ID'),
    deleteConnectedEdges: z.boolean().optional().describe('연결된 엣지도 삭제 (기본: true)'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `노드 "${params.nodeId}" 삭제를 준비했습니다.`,
      action: {
        type: 'delete_node',
        data: params,
      }
    })
  },
})

// 14. 엣지(연결) 생성 도구
export const createEdgeTool = new DynamicStructuredTool({
  name: 'create_edge',
  description: `두 노드 사이에 연결(엣지)을 생성합니다. 의존관계, 참조, 흐름 등을 표현합니다.

사용 예시:
- 부모-자식: type="parent_child" (폴더 구조, 상속)
- 참조: type="references" (파일 참조, 링크)
- 임포트: type="imports" (코드 import)
- 인과: type="causes" (원인-결과)`,
  schema: z.object({
    sourceNodeId: z.string().describe('시작 노드 ID'),
    targetNodeId: z.string().describe('대상 노드 ID'),
    label: z.string().optional().describe('엣지 라벨 (예: "depends on", "calls", "imports")'),
    type: z.enum(['parent_child', 'references', 'imports', 'supports', 'contradicts', 'causes', 'same_topic', 'sequence', 'semantic']).optional().describe('엣지 타입'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `엣지 생성: ${params.sourceNodeId} → ${params.targetNodeId}`,
      action: {
        type: 'create_edge',
        data: {
          sourceNodeId: params.sourceNodeId,
          targetNodeId: params.targetNodeId,
          label: params.label,
          edgeType: params.type || 'references',
        },
      }
    })
  },
})

// 15. 엣지 삭제 도구
export const deleteEdgeTool = new DynamicStructuredTool({
  name: 'delete_edge',
  description: '노드 간의 연결(엣지)을 삭제합니다.',
  schema: z.object({
    edgeId: z.string().optional().describe('엣지 ID (직접 지정)'),
    sourceNodeId: z.string().optional().describe('시작 노드 ID'),
    targetNodeId: z.string().optional().describe('대상 노드 ID'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: '엣지 삭제를 준비했습니다.',
      action: {
        type: 'delete_edge',
        data: params,
      }
    })
  },
})

// 16. 그래프 조회 도구
export const getGraphTool = new DynamicStructuredTool({
  name: 'get_graph',
  description: '현재 뉴런 에디터의 그래프 상태를 조회합니다. 모든 노드와 엣지 정보를 가져옵니다.',
  schema: z.object({
    includeContent: z.boolean().optional().describe('노드 내용 포함 여부 (기본: false, 대용량 주의)'),
    nodeTypes: z.array(z.string()).optional().describe('특정 타입의 노드만 조회'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: '그래프 조회를 요청합니다.',
      action: {
        type: 'get_graph',
        data: params,
      }
    })
  },
})

// 17. 파일 + 노드 동시 생성 도구 (가장 중요!)
export const createFileWithNodeTool = new DynamicStructuredTool({
  name: 'create_file_with_node',
  description: `파일을 생성하고 동시에 뉴런 에디터에 해당 노드를 추가합니다.
코드 작성, 문서 작성 등 실제 파일이 필요한 작업에 사용합니다.

⭐ 코드를 작성할 때는 반드시 이 도구를 사용하세요!

사용 예시:
- React 컴포넌트: path="src/components/Button.tsx", content="..."
- 마크다운 문서: path="docs/README.md", content="..."
- 설정 파일: path="config.json", content="..."
- Python 코드: path="main.py", content="..."`,
  schema: z.object({
    path: z.string().describe('파일 경로 (예: src/components/Button.tsx)'),
    content: z.string().describe('파일 내용'),
    position: z.object({
      x: z.number().optional(),
      y: z.number().optional(),
    }).optional().describe('노드 위치'),
  }),
  func: async (params) => {
    // 파일 확장자로 노드 타입 추론 (file 또는 doc)
    const ext = params.path.split('.').pop()?.toLowerCase()
    // 마크다운 파일이면 doc, 나머지는 file
    const nodeType: 'file' | 'doc' = ['md', 'mdx'].includes(ext || '') ? 'doc' : 'file'

    return JSON.stringify({
      success: true,
      message: `파일 "${params.path}" 생성 및 노드 추가를 준비했습니다.`,
      action: {
        type: 'create_file_with_node',
        data: {
          path: params.path,
          content: params.content,
          nodeType,
          position: params.position || { x: Math.random() * 500, y: Math.random() * 500 },
          title: params.path.split('/').pop() || params.path,
        },
      }
    })
  },
})

// ============================================
// 🔥 Orchestrator 에이전트 호출 도구
// ============================================

// 18. 다른 에이전트 호출 도구
export const callAgentTool = new DynamicStructuredTool({
  name: 'call_agent',
  description: `다른 AI 에이전트를 호출하여 특정 작업을 수행하게 합니다.
Orchestrator가 다른 에이전트(Planner, Implementer, Tester, Reviewer)에게 작업을 위임할 때 사용합니다.

사용 예시:
- 설계 요청: agent="planner", task="API 엔드포인트 설계"
- 구현 요청: agent="implementer", task="로그인 기능 구현"
- 테스트 요청: agent="tester", task="단위 테스트 작성"
- 리뷰 요청: agent="reviewer", task="코드 품질 검토"`,
  schema: z.object({
    agent: z.enum(['planner', 'implementer', 'tester', 'reviewer']).describe('호출할 에이전트'),
    task: z.string().describe('에이전트에게 전달할 작업 내용'),
    context: z.string().optional().describe('추가 컨텍스트 정보'),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().describe('작업 우선순위'),
    waitForResult: z.boolean().optional().describe('결과를 기다릴지 여부 (기본: true)'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `${params.agent} 에이전트에게 작업을 전달합니다: "${params.task}"`,
      action: {
        type: 'call_agent',
        data: {
          targetAgent: params.agent,
          task: params.task,
          context: params.context,
          priority: params.priority || 'normal',
          waitForResult: params.waitForResult !== false,
        },
      }
    })
  },
})

// 19. 에이전트 상태 조회 도구
export const getAgentStatusTool = new DynamicStructuredTool({
  name: 'get_agent_status',
  description: '특정 에이전트 또는 모든 에이전트의 현재 상태를 조회합니다.',
  schema: z.object({
    agent: z.enum(['planner', 'implementer', 'tester', 'reviewer', 'all']).optional().describe('조회할 에이전트 (기본: all)'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: '에이전트 상태를 조회합니다.',
      action: {
        type: 'get_agent_status',
        data: {
          targetAgent: params.agent || 'all',
        },
      }
    })
  },
})

// ============================================
// 🔥 Flowchart 제어 도구
// ============================================

// 20. Flowchart 노드 생성
export const flowchartCreateNodeTool = new DynamicStructuredTool({
  name: 'flowchart_create_node',
  description: `Flowchart(Mermaid 다이어그램)에 새 노드를 생성합니다.
워크플로우, 프로세스, 시퀀스 다이어그램의 노드를 추가합니다.

노드 모양:
- rectangle: 기본 사각형 []
- round: 둥근 모서리 ()
- diamond: 다이아몬드/조건 {}
- circle: 원형 (())
- stadium: 스타디움 ([])`,
  schema: z.object({
    id: z.string().describe('노드 ID (고유값)'),
    label: z.string().describe('노드에 표시될 텍스트'),
    shape: z.enum(['rectangle', 'round', 'diamond', 'circle', 'stadium']).optional().describe('노드 모양'),
    style: z.string().optional().describe('CSS 스타일 (예: "fill:#f9f,stroke:#333")'),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }).optional().describe('노드 위치'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `Flowchart 노드 "${params.label}" 생성을 준비했습니다.`,
      action: {
        type: 'flowchart_create_node',
        data: {
          nodeId: params.id,
          label: params.label,
          shape: params.shape || 'rectangle',
          style: params.style,
          position: params.position,
        },
      }
    })
  },
})

// 21. Flowchart 노드 수정
export const flowchartUpdateNodeTool = new DynamicStructuredTool({
  name: 'flowchart_update_node',
  description: 'Flowchart의 기존 노드를 수정합니다.',
  schema: z.object({
    id: z.string().describe('수정할 노드 ID'),
    label: z.string().optional().describe('새 라벨'),
    shape: z.enum(['rectangle', 'round', 'diamond', 'circle', 'stadium']).optional().describe('새 모양'),
    style: z.string().optional().describe('새 스타일'),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }).optional().describe('새 위치'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `Flowchart 노드 "${params.id}" 수정을 준비했습니다.`,
      action: {
        type: 'flowchart_update_node',
        data: params,
      }
    })
  },
})

// 22. Flowchart 노드 삭제
export const flowchartDeleteNodeTool = new DynamicStructuredTool({
  name: 'flowchart_delete_node',
  description: 'Flowchart에서 노드를 삭제합니다. 연결된 엣지도 함께 삭제됩니다.',
  schema: z.object({
    id: z.string().describe('삭제할 노드 ID'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `Flowchart 노드 "${params.id}" 삭제를 준비했습니다.`,
      action: {
        type: 'flowchart_delete_node',
        data: {
          nodeId: params.id,
        },
      }
    })
  },
})

// 23. Flowchart 엣지 생성
export const flowchartCreateEdgeTool = new DynamicStructuredTool({
  name: 'flowchart_create_edge',
  description: `Flowchart에서 두 노드를 연결하는 엣지를 생성합니다.

엣지 타입:
- arrow: 화살표 -->
- line: 직선 ---
- dotted: 점선 -.->
- thick: 두꺼운 선 ==>`,
  schema: z.object({
    source: z.string().describe('시작 노드 ID'),
    target: z.string().describe('대상 노드 ID'),
    label: z.string().optional().describe('엣지 라벨'),
    type: z.enum(['arrow', 'line', 'dotted', 'thick']).optional().describe('엣지 타입'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `Flowchart 엣지 생성: ${params.source} → ${params.target}`,
      action: {
        type: 'flowchart_create_edge',
        data: {
          sourceId: params.source,
          targetId: params.target,
          label: params.label,
          edgeType: params.type || 'arrow',
        },
      }
    })
  },
})

// 24. Flowchart 엣지 삭제
export const flowchartDeleteEdgeTool = new DynamicStructuredTool({
  name: 'flowchart_delete_edge',
  description: 'Flowchart에서 엣지를 삭제합니다.',
  schema: z.object({
    source: z.string().describe('시작 노드 ID'),
    target: z.string().describe('대상 노드 ID'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `Flowchart 엣지 삭제: ${params.source} → ${params.target}`,
      action: {
        type: 'flowchart_delete_edge',
        data: {
          sourceId: params.source,
          targetId: params.target,
        },
      }
    })
  },
})

// 25. Flowchart 그래프 조회
export const flowchartGetGraphTool = new DynamicStructuredTool({
  name: 'flowchart_get_graph',
  description: '현재 Flowchart의 전체 구조(노드와 엣지)를 조회합니다.',
  schema: z.object({
    includeStyles: z.boolean().optional().describe('스타일 정보 포함 여부'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: 'Flowchart 그래프를 조회합니다.',
      action: {
        type: 'flowchart_get_graph',
        data: {
          includeStyles: params.includeStyles || false,
        },
      }
    })
  },
})

// ============================================
// 🔥 Blueprint 제어 도구
// ============================================

// 26. Blueprint 태스크 생성
export const blueprintCreateTaskTool = new DynamicStructuredTool({
  name: 'blueprint_create_task',
  description: `Blueprint(프로젝트 계획)에 새 태스크를 생성합니다.
프로젝트 마일스톤, 스프린트 태스크, 할 일 등을 관리합니다.`,
  schema: z.object({
    title: z.string().describe('태스크 제목'),
    description: z.string().optional().describe('태스크 설명'),
    status: z.enum(['todo', 'in_progress', 'review', 'done']).optional().describe('상태'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('우선순위'),
    assignee: z.string().optional().describe('담당 에이전트'),
    dueDate: z.string().optional().describe('마감일 (YYYY-MM-DD)'),
    parentId: z.string().optional().describe('상위 태스크 ID'),
    dependencies: z.array(z.string()).optional().describe('의존 태스크 ID들'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `Blueprint 태스크 "${params.title}" 생성을 준비했습니다.`,
      action: {
        type: 'blueprint_create_task',
        data: {
          title: params.title,
          description: params.description,
          status: params.status || 'todo',
          priority: params.priority || 'medium',
          assignee: params.assignee,
          dueDate: params.dueDate,
          parentId: params.parentId,
          dependencies: params.dependencies || [],
        },
      }
    })
  },
})

// 27. Blueprint 태스크 수정
export const blueprintUpdateTaskTool = new DynamicStructuredTool({
  name: 'blueprint_update_task',
  description: 'Blueprint의 기존 태스크를 수정합니다.',
  schema: z.object({
    taskId: z.string().describe('수정할 태스크 ID'),
    title: z.string().optional().describe('새 제목'),
    description: z.string().optional().describe('새 설명'),
    status: z.enum(['todo', 'in_progress', 'review', 'done']).optional().describe('새 상태'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('새 우선순위'),
    assignee: z.string().optional().describe('새 담당자'),
    progress: z.number().min(0).max(100).optional().describe('진행률 (0-100)'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `Blueprint 태스크 "${params.taskId}" 수정을 준비했습니다.`,
      action: {
        type: 'blueprint_update_task',
        data: params,
      }
    })
  },
})

// 28. Blueprint 태스크 삭제
export const blueprintDeleteTaskTool = new DynamicStructuredTool({
  name: 'blueprint_delete_task',
  description: 'Blueprint에서 태스크를 삭제합니다.',
  schema: z.object({
    taskId: z.string().describe('삭제할 태스크 ID'),
    deleteChildren: z.boolean().optional().describe('하위 태스크도 함께 삭제'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `Blueprint 태스크 "${params.taskId}" 삭제를 준비했습니다.`,
      action: {
        type: 'blueprint_delete_task',
        data: params,
      }
    })
  },
})

// 29. Blueprint 태스크 조회
export const blueprintGetTasksTool = new DynamicStructuredTool({
  name: 'blueprint_get_tasks',
  description: 'Blueprint의 태스크 목록을 조회합니다.',
  schema: z.object({
    status: z.enum(['todo', 'in_progress', 'review', 'done', 'all']).optional().describe('상태 필터'),
    assignee: z.string().optional().describe('담당자 필터'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('우선순위 필터'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: 'Blueprint 태스크 목록을 조회합니다.',
      action: {
        type: 'blueprint_get_tasks',
        data: {
          status: params.status || 'all',
          assignee: params.assignee,
          priority: params.priority,
        },
      }
    })
  },
})

// ============================================
// 🔥 Agent Builder 워크플로우 제어 도구
// ============================================

// 30. Agent Builder 노드 생성
export const agentBuilderCreateNodeTool = new DynamicStructuredTool({
  name: 'agent_create_node',
  description: `Agent Builder 캔버스에 새 워크플로우 노드를 생성합니다.
AI 에이전트 워크플로우의 각 단계를 노드로 표현합니다.

노드 타입:
- start: 워크플로우 시작점
- end: 워크플로우 종료점
- llm: LLM 텍스트 생성 (GPT, Claude 등)
- prompt: 프롬프트 템플릿
- router: 조건 분기 (if/else)
- memory: 대화 메모리 저장/조회
- tool: 외부 도구 호출
- rag: RAG 검색
- javascript: 커스텀 JS 코드 실행
- function: 함수 호출
- input: 사용자 입력
- output: 결과 출력
- image_generation: 이미지 생성`,
  schema: z.object({
    type: z.enum(['start', 'end', 'llm', 'prompt', 'router', 'memory', 'tool', 'rag', 'javascript', 'function', 'input', 'output', 'image_generation', 'embedding', 'evaluator', 'chain']).describe('노드 타입'),
    label: z.string().describe('노드 라벨 (표시 이름)'),
    config: z.any().describe('노드 설정 (model, temperature, prompt 등)').optional(),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }).describe('노드 위치').optional(),
  }),
  func: async (params) => {
    const pos = params.position || { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 }
    return JSON.stringify({
      success: true,
      message: `Agent Builder 노드 "${params.label}" (${params.type}) 생성을 준비했습니다.`,
      action: {
        type: 'agent_create_node',
        data: {
          nodeType: params.type,
          label: params.label,
          config: params.config || {},
          position: pos,
        },
      }
    })
  },
})

// 31. Agent Builder 노드 연결
export const agentBuilderConnectNodesTool = new DynamicStructuredTool({
  name: 'agent_connect_nodes',
  description: `Agent Builder에서 두 노드를 연결합니다.
워크플로우의 실행 흐름을 정의합니다.`,
  schema: z.object({
    sourceNodeId: z.string().describe('시작 노드 ID'),
    targetNodeId: z.string().describe('대상 노드 ID'),
    sourceHandle: z.string().optional().describe('소스 핸들 (조건 분기 시)'),
    label: z.string().optional().describe('연결 라벨'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `노드 연결: ${params.sourceNodeId} → ${params.targetNodeId}`,
      action: {
        type: 'agent_connect_nodes',
        data: params,
      }
    })
  },
})

// 32. Agent Builder 노드 삭제
export const agentBuilderDeleteNodeTool = new DynamicStructuredTool({
  name: 'agent_delete_node',
  description: 'Agent Builder에서 노드를 삭제합니다.',
  schema: z.object({
    nodeId: z.string().describe('삭제할 노드 ID'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `Agent Builder 노드 "${params.nodeId}" 삭제를 준비했습니다.`,
      action: {
        type: 'agent_delete_node',
        data: params,
      }
    })
  },
})

// 33. Agent Builder 노드 수정
export const agentBuilderUpdateNodeTool = new DynamicStructuredTool({
  name: 'agent_update_node',
  description: 'Agent Builder 노드의 설정을 수정합니다.',
  schema: z.object({
    nodeId: z.string().describe('수정할 노드 ID'),
    label: z.string().describe('새 라벨').optional(),
    config: z.any().describe('새 설정').optional(),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `Agent Builder 노드 "${params.nodeId}" 수정을 준비했습니다.`,
      action: {
        type: 'agent_update_node',
        data: params,
      }
    })
  },
})

// 34. Agent 워크플로우 생성 (AI가 자동으로 전체 워크플로우 생성)
export const agentBuilderGenerateWorkflowTool = new DynamicStructuredTool({
  name: 'agent_generate_workflow',
  description: `사용자의 요구사항을 바탕으로 전체 Agent 워크플로우를 자동 생성합니다.
"고객 문의 분석 에이전트 만들어줘" 같은 요청에 사용합니다.

이 도구는 노드들과 연결을 한번에 생성합니다.`,
  schema: z.object({
    name: z.string().describe('에이전트 이름'),
    description: z.string().describe('에이전트 기능 설명'),
    nodes: z.array(z.object({
      id: z.string(),
      type: z.string(),
      label: z.string(),
      config: z.any().optional(),
      position: z.object({ x: z.number(), y: z.number() }),
    })).describe('생성할 노드 목록'),
    edges: z.array(z.object({
      source: z.string(),
      target: z.string(),
      sourceHandle: z.string().optional(),
      label: z.string().optional(),
    })).describe('노드 연결 목록'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `Agent 워크플로우 "${params.name}" 생성을 준비했습니다. (노드 ${params.nodes.length}개, 연결 ${params.edges.length}개)`,
      action: {
        type: 'agent_generate_workflow',
        data: {
          name: params.name,
          description: params.description,
          nodes: params.nodes,
          edges: params.edges,
        },
      }
    })
  },
})

// 35. Agent 워크플로우 조회
export const agentBuilderGetWorkflowTool = new DynamicStructuredTool({
  name: 'agent_get_workflow',
  description: '현재 Agent Builder 캔버스의 워크플로우 상태를 조회합니다.',
  schema: z.object({
    includeConfig: z.boolean().optional().describe('노드 설정 포함 여부'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: 'Agent 워크플로우를 조회합니다.',
      action: {
        type: 'agent_get_workflow',
        data: params,
      }
    })
  },
})

// 36. Agent 배포
export const agentBuilderDeployTool = new DynamicStructuredTool({
  name: 'agent_deploy',
  description: `현재 Agent Builder의 워크플로우를 배포합니다.
배포하면 에이전트가 실제로 사용 가능해집니다.`,
  schema: z.object({
    name: z.string().describe('에이전트 이름'),
    description: z.string().optional().describe('에이전트 설명'),
    llmProvider: z.enum(['openai', 'anthropic', 'google', 'xai']).optional().describe('LLM 제공자'),
    llmModel: z.string().optional().describe('LLM 모델'),
  }),
  func: async (params) => {
    return JSON.stringify({
      success: true,
      message: `Agent "${params.name}" 배포를 준비했습니다.`,
      action: {
        type: 'agent_deploy',
        data: params,
      }
    })
  },
})

// 37. Agent Builder 초기화 (새 캔버스)
export const agentBuilderClearTool = new DynamicStructuredTool({
  name: 'agent_clear',
  description: 'Agent Builder 캔버스를 초기화합니다. 모든 노드와 연결이 삭제됩니다.',
  schema: z.object({
    confirm: z.boolean().describe('초기화 확인 (true로 설정해야 실행됨)'),
  }),
  func: async (params) => {
    if (!params.confirm) {
      return JSON.stringify({
        success: false,
        error: '초기화하려면 confirm: true를 설정해주세요.',
      })
    }
    return JSON.stringify({
      success: true,
      message: 'Agent Builder 캔버스를 초기화합니다.',
      action: {
        type: 'agent_clear',
        data: {},
      }
    })
  },
})

// ============================================
// 🔥 브라우저 자동화 도구
// ============================================

export const browserAutomationTool = new DynamicStructuredTool({
  name: 'browser_automation',
  description: `실제 웹 브라우저를 제어하여 웹사이트를 탐색하고 자동화 작업을 수행합니다.

🚀 Stagehand AI 브라우저 자동화 (NEW!)
- 자연어로 복잡한 작업 수행 가능
- 로그인, 예약, 폼 입력 등 고급 작업 지원
- AI가 화면을 보고 판단하여 실행

사용 가능한 작업:
- navigate: URL로 이동 (예: "네이버 열어줘", "https://google.com 가줘")
- search: 검색 수행 (예: "구글에서 날씨 검색해줘", "네이버에서 맛집 찾아줘")
- click: 요소 클릭 (예: "로그인 버튼 클릭해줘")
- type: 텍스트 입력 (예: "검색창에 'AI' 입력해줘")
- scroll: 페이지 스크롤 (예: "아래로 스크롤해줘")
- extract: 페이지 내용 추출 (예: "페이지 내용 읽어줘")
- screenshot: 현재 화면 캡처
- 예약/로그인: 복잡한 다단계 작업 (예: "야놀자에서 강남 호텔 예약해줘")

예시:
- "네이버 열어서 '오늘 날씨' 검색해줘"
- "구글에서 'ChatGPT' 검색하고 결과 보여줘"
- "야놀자에서 강남역 근처 호텔 검색해줘"
- "유튜브 가서 첫 번째 영상 클릭해줘"`,
  schema: z.object({
    task: z.string().describe('수행할 브라우저 작업 (자연어로 설명). 예: "네이버 열어서 날씨 검색해줘"'),
    useStagehand: z.boolean().optional().describe('Stagehand AI 브라우저 사용 여부 (복잡한 작업에 권장)'),
  }),
  func: async (params) => {
    console.log('[browser_automation] Task:', params.task)

    // 모든 브라우저 작업을 Stagehand로 처리 (더 강력함)
    console.log('[browser_automation] 🚀 Using Stagehand AI Browser...')

    try {
      // Stagehand 서버 직접 호출 (더 빠름)
      const stagehandResponse = await fetch('http://127.0.0.1:45679', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'agent', task: params.task }),
      })

      if (!stagehandResponse.ok) {
        throw new Error(`Stagehand server error: ${stagehandResponse.status}`)
      }

      const stagehandResult = await stagehandResponse.json()

      if (stagehandResult.success) {
        console.log('[browser_automation] ✅ Stagehand success!')
        console.log('[browser_automation] Steps:', stagehandResult.steps?.length || 0)

        // 결과 메시지 크기 제한 (토큰 오버플로우 방지)
        let resultMessage = stagehandResult.result || '작업을 완료했습니다.'
        if (resultMessage.length > 3000) {
          resultMessage = resultMessage.substring(0, 3000) + '... (결과가 너무 길어서 일부만 표시)'
        }

        // 스텝 정보 요약 (스크린샷 제외, 핵심만)
        const stepsSummary = (stagehandResult.steps || [])
          .slice(0, 5)
          .map((s: any, i: number) => `${i+1}. ${s.action || s.type || 'step'}: ${(s.detail || s.message || '').substring(0, 100)}`)
          .join('\n')

        return JSON.stringify({
          success: true,
          message: resultMessage,
          currentUrl: stagehandResult.currentUrl,
          stepsSummary: stepsSummary || '작업 완료',
        })
      }

      console.log('[browser_automation] Stagehand result:', stagehandResult)
      // 실패해도 결과 반환
      return JSON.stringify({
        success: false,
        message: stagehandResult.result || stagehandResult.error || '작업 중 오류가 발생했습니다.',
        currentUrl: stagehandResult.currentUrl,
      })
    } catch (stagehandError: any) {
      console.error('[browser_automation] Stagehand error:', stagehandError.message)

      // Stagehand 서버가 안 켜져 있으면 안내
      if (stagehandError.message.includes('ECONNREFUSED') || stagehandError.message.includes('fetch failed')) {
        return JSON.stringify({
          success: false,
          message: '브라우저 자동화 서버가 실행 중이지 않습니다. "npm run mcp:stagehand" 또는 "npm run dev:full"로 시작해주세요.',
        })
      }
    }

    // Fallback: 기존 Electron 브라우저 시도 (Stagehand 실패 시)

    // 2. Electron 브라우저 API 시도 (타임아웃 5초)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch('http://localhost:3000/api/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: params.task, maxSteps: 5 }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      const result = await response.json()

      // 브라우저 성공 시 결과 반환
      if (response.ok && result.success && result.finalMessage && !result.finalMessage.includes('오류')) {
        console.log('[browser_automation] ✅ Electron Browser success!')
        return JSON.stringify({
          success: true,
          message: result.finalMessage,
          action: {
            type: 'browser_automation',
            data: {
              task: params.task,
              results: result.results,
              currentUrl: result.currentUrl,
            },
          }
        })
      }

      console.log('[browser_automation] Electron Browser failed:', result.error || result.finalMessage)
    } catch (error: any) {
      console.log('[browser_automation] Electron Browser error:', error.message)
    }

    // 3. Fallback: Tavily 웹 검색
    console.log('[browser_automation] Falling back to Tavily...')
    try {
      const { tavily } = await import('@tavily/core')
      const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY || '' })

      if (!process.env.TAVILY_API_KEY) {
        return JSON.stringify({
          success: false,
          error: '브라우저와 웹 검색 모두 사용할 수 없습니다.',
          message: '브라우저 패널을 열거나 TAVILY_API_KEY를 설정해주세요.',
        })
      }

      // 검색 쿼리 추출 (예: "네이버에서 역삼동 맛집 검색해줘" → "역삼동 맛집")
      const searchQuery = params.task
        .replace(/네이버|구글|다음|에서|검색|해줘|해주세요|찾아|알려|열어/g, '')
        .trim() || params.task

      const searchResponse = await tavilyClient.search(searchQuery, {
        maxResults: 5,
        includeAnswer: true,
        searchDepth: 'advanced',
      })

      // 검색 결과 포맷팅
      const formattedResults = searchResponse.results.map((r: any, i: number) =>
        `${i + 1}. **${r.title}**\n   ${r.content?.slice(0, 200)}...\n   🔗 ${r.url}`
      ).join('\n\n')

      return JSON.stringify({
        success: true,
        message: `🔍 "${searchQuery}" 검색 결과:\n\n${searchResponse.answer || ''}\n\n${formattedResults}`,
        action: {
          type: 'web_search_fallback',
          data: {
            query: searchQuery,
            answer: searchResponse.answer,
            results: searchResponse.results.slice(0, 5),
          },
        }
      })
    } catch (searchError: any) {
      return JSON.stringify({
        success: false,
        error: searchError.message || '검색 실패',
        message: '브라우저 제어와 웹 검색 모두 실패했습니다.',
      })
    }
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
  generate_image: generateImageTool,
  create_task: createTaskTool,
  list_projects: listProjectsTool,
  // 🔥 앱 내비게이션 및 스킬 도구
  navigate_to: navigateToTool,
  use_skill: useSkillTool,
  get_emails: getEmailsTool,
  send_email: sendEmailTool,
  get_calendar_events: getCalendarEventsTool,
  create_calendar_event: createCalendarEventTool,
  // 🔥 Neural Editor 제어 도구
  create_node: createNodeTool,
  update_node: updateNodeTool,
  delete_node: deleteNodeTool,
  create_edge: createEdgeTool,
  delete_edge: deleteEdgeTool,
  get_graph: getGraphTool,
  create_file_with_node: createFileWithNodeTool,
  // 🔥 Orchestrator 에이전트 호출 도구
  call_agent: callAgentTool,
  get_agent_status: getAgentStatusTool,
  // 🔥 Flowchart 제어 도구
  flowchart_create_node: flowchartCreateNodeTool,
  flowchart_update_node: flowchartUpdateNodeTool,
  flowchart_delete_node: flowchartDeleteNodeTool,
  flowchart_create_edge: flowchartCreateEdgeTool,
  flowchart_delete_edge: flowchartDeleteEdgeTool,
  flowchart_get_graph: flowchartGetGraphTool,
  // 🔥 Blueprint 제어 도구
  blueprint_create_task: blueprintCreateTaskTool,
  blueprint_update_task: blueprintUpdateTaskTool,
  blueprint_delete_task: blueprintDeleteTaskTool,
  blueprint_get_tasks: blueprintGetTasksTool,
  // 🔥 Agent Builder 워크플로우 제어 도구
  agent_create_node: agentBuilderCreateNodeTool,
  agent_connect_nodes: agentBuilderConnectNodesTool,
  agent_delete_node: agentBuilderDeleteNodeTool,
  agent_update_node: agentBuilderUpdateNodeTool,
  agent_generate_workflow: agentBuilderGenerateWorkflowTool,
  agent_get_workflow: agentBuilderGetWorkflowTool,
  agent_deploy: agentBuilderDeployTool,
  agent_clear: agentBuilderClearTool,
  // 🔥 다단계 루프 워크플로우 도구
  create_workflow: createWorkflowTool,
  execute_workflow: executeWorkflowTool,
  list_workflows: listWorkflowsTool,
  get_workflow_history: getWorkflowHistoryTool,
  use_workflow_template: useWorkflowTemplateTool,
  schedule_workflow: scheduleWorkflowTool,
  // 🔥 브라우저 자동화 도구
  browser_automation: browserAutomationTool,
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
