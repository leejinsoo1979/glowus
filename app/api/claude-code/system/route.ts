/**
 * Claude Code System Access API
 *
 * Extended API with full system access capabilities:
 * - File system operations
 * - Application control
 * - Browser automation
 * - Web search and content analysis
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for complex operations

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { AgentRole } from '@/lib/agent/permissions'

// ============================================
// Types
// ============================================

interface SystemAccessRequest {
  task: string
  context?: string
  agentRole?: AgentRole
  model?: 'gpt-4o' | 'gpt-4o-mini'
  tools?: string[]
  systemPrompt?: string
  maxIterations?: number
}

interface SystemAccessResponse {
  success: boolean
  output?: string
  toolsUsed?: string[]
  iterations?: number
  error?: string
}

// ============================================
// Tool Definitions
// ============================================

interface FunctionTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, any>
      required: string[]
    }
  }
}

const SYSTEM_TOOLS: FunctionTool[] = [
  // ========== Web & Content Tools ==========
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: '웹에서 정보를 검색합니다.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '검색 쿼리' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'youtube_transcript',
      description: 'YouTube 동영상의 자막을 가져옵니다.',
      parameters: {
        type: 'object',
        properties: {
          videoUrl: { type: 'string', description: 'YouTube URL' },
          lang: { type: 'string', description: '자막 언어 (ko, en 등)', default: 'ko' },
        },
        required: ['videoUrl'],
      },
    },
  },
  // ========== File System Tools ==========
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: '파일을 읽습니다. 허용된 디렉토리 내에서만 작동합니다.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '읽을 파일의 절대 경로' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: '파일을 작성합니다. 허용된 디렉토리 내에서만 작동합니다.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '작성할 파일의 절대 경로' },
          content: { type: 'string', description: '파일 내용' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: '디렉토리의 파일 목록을 가져옵니다.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '디렉토리 경로' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: '디렉토리에서 파일을 검색합니다.',
      parameters: {
        type: 'object',
        properties: {
          directory: { type: 'string', description: '검색할 디렉토리' },
          pattern: { type: 'string', description: '검색 패턴 (정규식)' },
        },
        required: ['directory', 'pattern'],
      },
    },
  },
  // ========== Application Control Tools ==========
  {
    type: 'function',
    function: {
      name: 'launch_app',
      description: '애플리케이션을 실행합니다.',
      parameters: {
        type: 'object',
        properties: {
          app: { type: 'string', description: '앱 경로 또는 이름' },
          args: { type: 'array', items: { type: 'string' }, description: '실행 인자' },
        },
        required: ['app'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_installed_apps',
      description: '설치된 애플리케이션 목록을 가져옵니다.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_url',
      description: 'URL을 기본 브라우저에서 엽니다.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '열 URL' },
        },
        required: ['url'],
      },
    },
  },
  // ========== Browser Control Tools ==========
  {
    type: 'function',
    function: {
      name: 'start_browser',
      description: '브라우저 세션을 시작합니다.',
      parameters: {
        type: 'object',
        properties: {
          browser: { type: 'string', enum: ['chrome', 'firefox', 'safari', 'edge'], description: '브라우저 종류' },
          url: { type: 'string', description: '시작 URL (선택사항)' },
          headless: { type: 'boolean', description: '헤드리스 모드 여부', default: false },
        },
        required: ['browser'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_navigate',
      description: '브라우저에서 URL로 이동합니다.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: '브라우저 세션 ID' },
          url: { type: 'string', description: '이동할 URL' },
        },
        required: ['sessionId', 'url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_click',
      description: '브라우저에서 요소를 클릭합니다 (AI 기반).',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: '브라우저 세션 ID' },
          description: { type: 'string', description: '클릭할 요소 설명 (예: "로그인 버튼", "검색창")' },
        },
        required: ['sessionId', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_type',
      description: '브라우저 입력 필드에 텍스트를 입력합니다.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: '브라우저 세션 ID' },
          description: { type: 'string', description: '입력 필드 설명' },
          text: { type: 'string', description: '입력할 텍스트' },
        },
        required: ['sessionId', 'description', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_extract',
      description: '브라우저 페이지에서 정보를 추출합니다.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: '브라우저 세션 ID' },
          description: { type: 'string', description: '추출할 정보 설명' },
        },
        required: ['sessionId', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_screenshot',
      description: '브라우저 페이지의 스크린샷을 촬영합니다.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: '브라우저 세션 ID' },
        },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'close_browser',
      description: '브라우저 세션을 종료합니다.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: '브라우저 세션 ID' },
        },
        required: ['sessionId'],
      },
    },
  },
]

// ============================================
// Tool Execution Router
// ============================================

async function executeTool(
  name: string,
  args: Record<string, any>,
  role: AgentRole
): Promise<string> {
  try {
    switch (name) {
      // Web & Content Tools
      case 'web_search': {
        const { webSearchTool } = await import('@/lib/agent/tools')
        return await webSearchTool.invoke({ query: args.query, maxResults: 5 })
      }

      case 'youtube_transcript': {
        const { youtubeTranscriptTool } = await import('@/lib/agent/tools')
        return await youtubeTranscriptTool.invoke({
          videoUrl: args.videoUrl,
          lang: args.lang || 'ko',
        })
      }

      // File System Tools
      case 'read_file': {
        const { readFileSecure } = await import('@/lib/agent/filesystem-tools')
        const content = await readFileSecure(args.path, role)
        return JSON.stringify({ success: true, content })
      }

      case 'write_file': {
        const { writeFileSecure } = await import('@/lib/agent/filesystem-tools')
        await writeFileSecure(args.path, args.content, role)
        return JSON.stringify({ success: true, message: `File written: ${args.path}` })
      }

      case 'list_directory': {
        const { listDirectorySecure } = await import('@/lib/agent/filesystem-tools')
        const entries = await listDirectorySecure(args.path, role)
        return JSON.stringify({ success: true, entries })
      }

      case 'search_files': {
        const { searchFilesSecure } = await import('@/lib/agent/filesystem-tools')
        const files = await searchFilesSecure(args.directory, args.pattern, role)
        return JSON.stringify({ success: true, files })
      }

      // Application Control Tools
      case 'launch_app': {
        const { launchApplication } = await import('@/lib/agent/app-control-tools')
        const result = await launchApplication(args.app, args.args || [], role)
        return JSON.stringify(result)
      }

      case 'list_installed_apps': {
        const { getInstalledApplications } = await import('@/lib/agent/app-control-tools')
        const apps = await getInstalledApplications(role)
        return JSON.stringify({ success: true, apps })
      }

      case 'open_url': {
        const { openURL } = await import('@/lib/agent/app-control-tools')
        const result = await openURL(args.url, role)
        return JSON.stringify(result)
      }

      // Browser Control Tools
      case 'start_browser': {
        const { startBrowserSession } = await import('@/lib/agent/browser-control-tools')
        const result = await startBrowserSession(args.browser, role, {
          url: args.url,
          headless: args.headless,
        })
        return JSON.stringify(result)
      }

      case 'browser_navigate': {
        const { navigateToURL } = await import('@/lib/agent/browser-control-tools')
        const result = await navigateToURL(args.sessionId, args.url, role)
        return JSON.stringify(result)
      }

      case 'browser_click': {
        const { clickElement } = await import('@/lib/agent/browser-control-tools')
        const result = await clickElement(args.sessionId, args.description, role)
        return JSON.stringify(result)
      }

      case 'browser_type': {
        const { typeText } = await import('@/lib/agent/browser-control-tools')
        const result = await typeText(args.sessionId, args.description, args.text, role)
        return JSON.stringify(result)
      }

      case 'browser_extract': {
        const { extractText } = await import('@/lib/agent/browser-control-tools')
        const result = await extractText(args.sessionId, args.description, role)
        return JSON.stringify(result)
      }

      case 'browser_screenshot': {
        const { takeScreenshot } = await import('@/lib/agent/browser-control-tools')
        const result = await takeScreenshot(args.sessionId, role)
        return JSON.stringify(result)
      }

      case 'close_browser': {
        const { closeBrowserSession } = await import('@/lib/agent/browser-control-tools')
        const result = await closeBrowserSession(args.sessionId, role)
        return JSON.stringify(result)
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (error: any) {
    return JSON.stringify({ error: error.message || 'Tool execution failed' })
  }
}

// ============================================
// System Prompt
// ============================================

const SYSTEM_PROMPT = `당신은 GlowUS의 고급 AI 에이전트입니다. 사용자의 PC 시스템에 대한 전체 접근 권한이 있습니다.

## 사용 가능한 기능

### 1. 웹 & 콘텐츠
- web_search: 웹에서 정보 검색
- youtube_transcript: YouTube 자막 추출

### 2. 파일 시스템
- read_file: 파일 읽기
- write_file: 파일 작성
- list_directory: 디렉토리 목록
- search_files: 파일 검색

### 3. 애플리케이션 제어
- launch_app: 앱 실행
- list_installed_apps: 설치된 앱 목록
- open_url: URL 열기

### 4. 브라우저 자동화
- start_browser: 브라우저 시작
- browser_navigate: 페이지 이동
- browser_click: 요소 클릭 (AI 기반)
- browser_type: 텍스트 입력
- browser_extract: 정보 추출
- browser_screenshot: 스크린샷
- close_browser: 브라우저 종료

## 원칙
1. 사용자의 요청을 정확히 이해하고 적절한 도구를 선택합니다
2. 권한 제한을 존중하며, 거부된 경우 사용자에게 알립니다
3. 복잡한 작업은 여러 도구를 조합하여 수행합니다
4. 실행 결과를 명확하게 보고합니다
5. 한국어로 자연스럽게 응답합니다`

// ============================================
// API Handler
// ============================================

const getOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export async function POST(request: NextRequest) {
  try {
    const body: SystemAccessRequest = await request.json()

    const {
      task,
      context,
      agentRole = 'jeremy',
      model = 'gpt-4o-mini',
      tools: requestedTools,
      systemPrompt,
      maxIterations = 10,
    } = body

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Task is required' },
        { status: 400 }
      )
    }

    const openai = getOpenAI()
    const toolsUsed: string[] = []

    // Build messages
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt || SYSTEM_PROMPT },
    ]

    if (context) {
      messages.push({ role: 'user', content: `컨텍스트:\n${context}` })
    }

    messages.push({ role: 'user', content: task })

    // Filter tools if specific tools requested
    const availableTools = requestedTools
      ? SYSTEM_TOOLS.filter(tool => requestedTools.includes(tool.function.name))
      : SYSTEM_TOOLS

    // Agent loop
    let iterations = 0
    let finalOutput = ''

    while (iterations < maxIterations) {
      iterations++

      const completion = await openai.chat.completions.create({
        model: model === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini',
        messages,
        tools: availableTools.length > 0 ? availableTools : undefined,
        tool_choice: availableTools.length > 0 ? 'auto' : undefined,
        temperature: 0.7,
        max_tokens: 4000,
      })

      const choice = completion.choices[0]
      const message = choice.message

      // Add assistant message to history
      messages.push(message)

      // Check if done (no tool calls)
      if (!message.tool_calls || message.tool_calls.length === 0) {
        finalOutput = message.content || ''
        break
      }

      // Execute tool calls
      for (const toolCall of message.tool_calls) {
        // Skip non-function tool calls
        if (toolCall.type !== 'function') continue

        const toolName = toolCall.function.name
        const toolArgs = JSON.parse(toolCall.function.arguments)

        console.log(`[System Access API] Calling tool: ${toolName}`)
        toolsUsed.push(toolName)

        const toolResult = await executeTool(toolName, toolArgs, agentRole)

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        })
      }
    }

    const response: SystemAccessResponse = {
      success: true,
      output: finalOutput,
      toolsUsed: [...new Set(toolsUsed)],
      iterations,
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('[System Access API] Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Execution failed',
      },
      { status: 500 }
    )
  }
}

// ============================================
// GET - Health Check & Available Tools
// ============================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    toolCategories: {
      web: ['web_search', 'youtube_transcript'],
      filesystem: ['read_file', 'write_file', 'list_directory', 'search_files'],
      apps: ['launch_app', 'list_installed_apps', 'open_url'],
      browser: [
        'start_browser',
        'browser_navigate',
        'browser_click',
        'browser_type',
        'browser_extract',
        'browser_screenshot',
        'close_browser',
      ],
    },
    models: ['gpt-4o', 'gpt-4o-mini'],
    agentRoles: ['jeremy', 'rachel', 'amy', 'antigravity'],
  })
}
