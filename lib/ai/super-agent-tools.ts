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
  | 'generate_image'
  | 'create_task'
  | 'list_projects'
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

export interface ToolAction {
  type:
    | 'create_project' | 'write_file' | 'edit_file' | 'terminal_cmd'
    | 'web_search' | 'create_task' | 'read_file' | 'generate_image'
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
// 9. 이미지 생성 도구 (Z-Image)
// ============================================
export const generateImageTool = new DynamicStructuredTool({
  name: 'generate_image',
  description: 'AI로 이미지를 생성합니다. 프롬프트를 설명하면 그에 맞는 고품질 이미지를 만들어줍니다.',
  schema: z.object({
    prompt: z.string().describe('생성할 이미지에 대한 설명 (영어로 작성하면 더 좋은 결과)'),
    negative_prompt: z.string().optional().describe('이미지에서 제외할 요소'),
    width: z.number().optional().describe('이미지 너비 (기본: 1024)'),
    height: z.number().optional().describe('이미지 높이 (기본: 1024)'),
    style: z.enum(['realistic', 'artistic', 'anime', 'digital_art', 'photography']).optional().describe('이미지 스타일'),
  }),
  func: async (params) => {
    try {
      // API 호출
      const response = await fetch('/api/skills/z-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          negative_prompt: params.negative_prompt || 'low quality, blurry, distorted',
          width: params.width || 1024,
          height: params.height || 1024,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        return JSON.stringify({
          success: false,
          error: result.error || '이미지 생성 실패'
        })
      }

      return JSON.stringify({
        success: true,
        message: `이미지가 성공적으로 생성되었습니다!`,
        image_url: result.image_url,
        action: {
          type: 'generate_image',
          data: {
            prompt: params.prompt,
            image_url: result.image_url,
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
// 🔥 Neural Editor 제어 도구들
// ============================================

// 11. 노드 생성 도구
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
