/**
 * AI Agent Tools - 에이전트가 사용할 수 있는 도구들
 */

export interface Tool {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
    }>
    required: string[]
  }
}

export interface ToolCall {
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  success: boolean
  result?: unknown
  error?: string
}

// 에이전트 도구 정의
export const AGENT_TOOLS: Tool[] = [
  {
    name: 'read_file',
    description: '프로젝트의 특정 파일 내용을 읽습니다. 파일 경로나 이름을 지정하세요.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '읽을 파일의 경로 (예: src/App.tsx, package.json)'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'search_files',
    description: '프로젝트에서 파일이나 코드를 검색합니다.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '검색할 파일명, 함수명, 또는 코드 패턴'
        },
        type: {
          type: 'string',
          description: '검색 타입',
          enum: ['filename', 'content', 'function', 'import']
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_file_structure',
    description: '프로젝트의 폴더 및 파일 구조를 가져옵니다.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '특정 폴더 경로 (없으면 전체 구조)'
        },
        depth: {
          type: 'number',
          description: '탐색 깊이 (기본값: 3)'
        }
      },
      required: []
    }
  },
  {
    name: 'analyze_dependencies',
    description: '파일의 import/export 관계와 의존성을 분석합니다.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '분석할 파일 경로'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'find_references',
    description: '특정 함수, 변수, 컴포넌트가 어디서 사용되는지 찾습니다.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '찾을 심볼 이름 (함수명, 변수명, 컴포넌트명)'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'get_project_summary',
    description: '프로젝트 전체 요약 정보를 가져옵니다 (기술 스택, 구조, 주요 파일).',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
]

// OpenAI/Anthropic 형식으로 변환
export function getToolsForProvider(provider: string) {
  if (provider === 'openai' || provider === 'xai') {
    return AGENT_TOOLS.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }))
  }

  if (provider === 'anthropic') {
    return AGENT_TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }))
  }

  if (provider === 'google') {
    return [{
      functionDeclarations: AGENT_TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }))
    }]
  }

  return []
}
