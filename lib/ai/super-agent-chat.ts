/**
 * Super Agent Chat - Tool Calling 지원 채팅 시스템
 * Cursor/Claude Code급 에이전트 기능
 */

import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatOllama } from '@langchain/ollama'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages'
import { getSuperAgentTools, ToolAction } from './super-agent-tools'
import {
  getAgentBusinessTools,
  setAgentExecutionContext,
  AgentExecutionContext,
} from './agent-business-tools'
import { getDefaultModel, LLMProvider } from '@/lib/llm/client'
import {
  buildDynamicAgentSystemPrompt,
  AGENT_ROLE_PROMPTS,
} from '@/lib/agent/shared-prompts'

// ============================================
// 타입 정의
// ============================================
export interface SuperAgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: ToolCallInfo[]
  toolCallId?: string
}

export interface ToolCallInfo {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface SuperAgentResponse {
  message: string
  actions: ToolAction[]  // 프론트엔드에서 실행할 액션들
  toolsUsed: string[]
  thinking?: string
  browserUrl?: string  // 브라우저 최종 URL
}

interface AgentConfig {
  id: string
  name: string
  description?: string
  capabilities?: string[]
  llm_provider?: string | null
  model?: string | null
  temperature?: number | null
  system_prompt?: string | null
  identity?: any
  apiKey?: string | null
}

interface ChatContext {
  projectPath?: string | null
  userName?: string
  userRole?: string
  workContext?: string
  files?: Array<{ path: string; content?: string }>
  // 🔥 업무 실행을 위한 컨텍스트
  companyId?: string | null
  userId?: string | null
}

// ============================================
// LLM 생성
// ============================================
function createLLM(provider: LLMProvider, model: string, apiKey?: string, temperature = 0.7) {
  switch (provider) {
    case 'anthropic':
      return new ChatAnthropic({
        model,
        temperature,
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
      })

    case 'openai':
      return new ChatOpenAI({
        model,
        temperature,
        apiKey: apiKey || process.env.OPENAI_API_KEY,
      })

    case 'grok':
      return new ChatOpenAI({
        model,
        temperature,
        apiKey: apiKey || process.env.XAI_API_KEY,
        configuration: {
          baseURL: 'https://api.x.ai/v1',
        },
      })

    case 'gemini':
      return new ChatGoogleGenerativeAI({
        model,
        temperature,
        apiKey: apiKey || process.env.GOOGLE_API_KEY,
      })

    case 'qwen':
      return new ChatOpenAI({
        model,
        temperature,
        apiKey: apiKey || process.env.DASHSCOPE_API_KEY,
        configuration: {
          baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        },
      })

    case 'ollama':
      return new ChatOllama({
        model,
        temperature,
        baseUrl: 'http://localhost:11434',
      })

    default:
      return new ChatOllama({
        model: 'qwen2.5:3b',
        temperature: 0.7,
      })
  }
}

// ============================================
// 역할 추출
// ============================================
function getAgentRole(capabilities: string[]): string {
  if (capabilities.includes('development') || capabilities.includes('coding')) return 'developer'
  if (capabilities.includes('design') || capabilities.includes('ui')) return 'designer'
  if (capabilities.includes('marketing') || capabilities.includes('growth')) return 'marketer'
  if (capabilities.includes('analytics') || capabilities.includes('data')) return 'analyst'
  if (capabilities.includes('management') || capabilities.includes('planning')) return 'pm'
  return 'default'
}

// ============================================
// 슈퍼 에이전트 채팅 응답 생성 (Tool Calling 지원)
// ============================================
export async function generateSuperAgentResponse(
  agent: AgentConfig,
  userMessage: string,
  chatHistory: SuperAgentMessage[] = [],
  context?: ChatContext
): Promise<SuperAgentResponse> {
  // LLM 설정
  const provider = (agent.llm_provider || 'grok') as LLMProvider
  const model = agent.model || getDefaultModel(provider)
  const temperature = agent.temperature ?? 0.7

  console.log(`[SuperAgent] ${agent.name} using ${provider}/${model} with tool calling`)

  // LLM 생성
  const llm = createLLM(provider, model, agent.apiKey || undefined, temperature)

  // 🔥 실행 컨텍스트 설정 (비즈니스 도구가 회사 정보에 접근할 수 있도록)
  setAgentExecutionContext({
    agentId: agent.id,
    companyId: context?.companyId || undefined,
    userId: context?.userId || undefined,
    projectPath: context?.projectPath || undefined,
  })

  // 도구 바인딩 (기본 도구 + 비즈니스 도구)
  const superTools = getSuperAgentTools()
  const businessTools = getAgentBusinessTools()

  // 중복 도구 제거 (businessTools 우선)
  const businessToolNames = new Set(businessTools.map(t => t.name))
  const filteredSuperTools = superTools.filter(t => !businessToolNames.has(t.name))
  let tools = [...filteredSuperTools, ...businessTools]

  // Gemini 모델은 도구가 많으면 느려지므로 핵심 도구만 사용
  const isGemini = (agent as any).provider === 'gemini' || agent.model?.includes('gemini')
  if (isGemini) {
    // Gemini용 핵심 도구 (20개 이하 - 균형있는 선택)
    const essentialTools = [
      // 유틸리티
      'search_web',
      'get_current_time',
      'get_weather',
      'calculate',
      // 파일 관리
      'read_file',
      'write_file',
      'edit_file',
      'search_files',
      'get_file_structure',
      // 커뮤니케이션 & 이메일/캘린더
      'get_emails',
      'send_email',
      'get_calendar_events',
      'create_calendar_event',
      // 앱 내비게이션
      'navigate_to',
      'use_skill',
      // 프로젝트 관리
      'create_project',
      'list_projects',
      'create_task',
      // 터미널 & 이미지
      'run_terminal',
      'generate_image',
      // 에이전트
      'call_agent',
      'get_agent_status',
      // 브라우저 자동화
      'browser_automation',
    ]
    tools = tools.filter(t => essentialTools.includes(t.name))
    console.log(`[SuperAgent] Gemini detected - using ${tools.length} essential tools (optimized for speed)`)
  }

  console.log(`[SuperAgent] Tools loaded: ${tools.length} total`)
  const llmWithTools = llm.bindTools(tools)

  // 시스템 프롬프트 생성
  const role = getAgentRole(agent.capabilities || [])
  const basePersonality = agent.system_prompt || AGENT_ROLE_PROMPTS[role] || AGENT_ROLE_PROMPTS['default']

  // 정체성 정보
  let identityStr = ''
  if (agent.identity) {
    const id = agent.identity
    const parts: string[] = ['## 🧠 당신의 정체성과 성격']
    if (id.self_summary) parts.push(`\n### 나는 누구인가\n${id.self_summary}`)
    if (id.core_values?.length) parts.push(`\n### 핵심 가치\n${id.core_values.map((v: string) => `- ${v}`).join('\n')}`)
    if (id.personality_traits?.length) parts.push(`\n### 성격 특성\n${id.personality_traits.map((t: string) => `- ${t}`).join('\n')}`)
    if (id.communication_style) parts.push(`\n### 소통 스타일\n${id.communication_style}`)
    identityStr = parts.join('\n')
  }

  const coreSystemPrompt = buildDynamicAgentSystemPrompt(
    agent.name,
    basePersonality,
    identityStr,
    '',
    false
  )

  // 프로젝트 컨텍스트
  const projectContext = context?.projectPath
    ? `\n## 📁 현재 프로젝트\n- 경로: ${context.projectPath}\n`
    : ''

  // 사용자 정보
  const userInfo = context?.userName
    ? `\n## 👤 대화 상대\n- 이름: ${context.userName}${context.userRole ? `\n- 직위: ${context.userRole}` : ''}\n`
    : ''

  // 업무 컨텍스트 (Brain State 포함)
  const workContextStr = context?.workContext
    ? `\n## 📋 업무 맥락 & 뇌 상태\n${context.workContext}\n`
    : ''

  // 파일 컨텍스트 (있는 경우)
  const filesContext = context?.files?.length
    ? `\n## 📄 로드된 파일들\n${context.files.map(f => `- ${f.path}`).join('\n')}\n`
    : ''

  const systemPrompt = `${coreSystemPrompt}

${projectContext}
${userInfo}
${workContextStr}
${filesContext}

## 🧠 핵심 원칙: 초보자도 쓸 수 있는 AI

사용자는 코딩을 모르는 초보자입니다. 대충 말해도 **의도를 파악해서 알아서 작업**하세요.

### 사용자가 이렇게 말하면:
- "게임 만들어줘" → 어떤 게임인지 추론해서 바로 코드 작성
- "뭔가 멋진 거" → 적절한 프로젝트 선택해서 구현
- "저번에 하던 거" → 컨텍스트에서 파악해서 이어서 작업
- "이거 고쳐" → 무엇이 문제인지 분석하고 수정
- "더 좋게" → 개선점 찾아서 리팩토링

### 당신이 해야 할 것:
1. **의도 파악**: 모호한 요청에서 구체적 작업 추출
2. **계획 수립**: 필요한 파일, 구조, 기술 스택 결정
3. **즉시 실행**: 도구를 사용해서 바로 만들기
4. **결과 보고**: 뭘 만들었는지 간단히 설명

## 🛠️ 도구 (반드시 사용!)

### 📊 업무 도구 (백엔드 실행 - 실제 데이터 조회/수정!)
- **query_employees** - 직원 목록 조회 (부서, 직급 필터)
- **get_employee_detail** - 직원 상세 정보 조회
- **query_transactions** - 거래내역 조회 (날짜, 금액 필터)
- **query_projects** - 프로젝트 목록 조회
- **query_tasks** - 태스크 목록 조회
- **create_task_db** - 태스크 생성 (DB 저장)
- **update_task_status** - 태스크 상태 변경
- **query_calendar** - 일정 조회
- **create_calendar_event** - 일정 생성
- **get_company_info** - 회사 정보 조회
- **get_business_stats** - 업무 통계/대시보드
- **get_current_datetime** - 현재 날짜/시간 조회

### 코드/파일 작업
- **create_file_with_node** - ⭐ 코드 파일 생성 + 뉴런맵 노드 (가장 많이 씀!)
- **edit_file** - 기존 파일 수정
- **read_file** - 파일 내용 확인
- **get_file_structure** - 프로젝트 구조 파악

### 뉴런맵 노드
- **create_node** - 노트, 다이어그램, 문서 등 노드 생성
- **update_node** / **delete_node** - 노드 수정/삭제
- **create_edge** - 노드 연결

### 📧 이메일/캘린더 (앱 내 기능!)
- **get_emails** - ⭐ 이메일 조회 (메일 확인할 때 반드시 사용!)
- **send_email** - 이메일 발송
- **get_calendar_events** - ⭐ 일정 조회 (캘린더 확인할 때 반드시 사용!)
- **create_calendar_event** - 일정 생성

### 🚀 앱 내비게이션 (페이지 이동!)
- **navigate_to** - 앱 내 페이지 이동 (email, calendar, projects 등)
- **use_skill** - 스킬 API 호출 (youtube-transcript, ppt-pro 등)

### 🌐 브라우저 자동화 (실제 브라우저 제어!) - ⭐ 핵심 도구!
- **browser_automation** - Vision AI가 화면을 보고 자율적으로 행동!
  - 단순히 사용자 메시지를 복사하지 마! **대화 맥락을 이해해서 지능적인 task를 만들어!**
  - 예: 사용자가 "스크롤 좀 내려봐" 라고 하면 → 이전 대화에서 뭘 찾고 있었는지 파악해서 task 생성

  **맥락 기반 task 생성 예시:**
  - 이전: "네이버에서 날씨 검색" → 현재: "스크롤 내려"
    → task="현재 날씨 검색 결과 페이지에서 스크롤을 내려서 주간 예보 확인해줘"
  - 이전: "구글에서 AI 뉴스 찾아" → 현재: "첫번째 거 클릭"
    → task="검색 결과에서 첫번째 AI 뉴스 기사를 클릭해줘"

  **기본 예시:**
  - "네이버 열어줘" → browser_automation(task="네이버 홈페이지 열어줘")
  - "오늘 날씨 알려줘" → browser_automation(task="네이버에서 오늘 날씨 검색해서 결과 알려줘")
  - 스크린샷, 클릭, 스크롤, 텍스트 입력 모두 가능!

### 기타
- **run_terminal** - npm install, git 등 명령 실행
- **web_search** - 모르는 거 검색 (외부 정보가 필요할 때만!)

## 🧠 Brain State 준수

업무 맥락에 "Brain State" 또는 "Context Pack"이 포함되어 있다면:
- **Policies/Identity**: 사용자의 원칙 → 반드시 준수
- **Decisions**: 이미 결정된 사항 → 번복 금지
- **Playbooks**: 작업 절차 → 순서대로 진행
- **Constraints**: Do-Not 목록 → 절대 위반 금지

Brain State와 충돌하는 제안을 하지 마세요!

## 🚨 절대 규칙

### ❌ 하지 마:
- "어떤 게임을 만들까요?" 같은 역질문
- "~할 수 있습니다" 같은 설명만
- "draw.io 사용하세요" 같은 외부 도구 추천
- 코드 없이 설명만 하기
- **이메일/캘린더 요청에 web_search 사용 금지!** → get_emails, get_calendar_events 사용
- **앱 내 기능을 외부 검색으로 대체하지 마!**

### ✅ 무조건 해:
- **일단 만들어!** 질문하지 말고 가장 적절한 걸 선택해서 구현
- 모든 코드는 **create_file_with_node**로 파일+노드 생성
- 모든 문서/노트는 **create_node**로 뉴런맵에 추가

### 🔴 도구 완료 규칙 (중요!):
- 도구 결과에 "success: true" 또는 "completed: true"가 있으면 **작업 완료**
- 이메일/캘린더 조회 후에는 **결과를 요약해서 사용자에게 바로 답변** (같은 도구 재호출 금지!)
- 한 번 성공한 도구는 다시 호출하지 마!
- 도구 결과가 왔으면 → 사용자에게 자연어로 요약 응답

## 예시

사용자: "게임 만들어"
→ 생각: 간단한 게임... 벽돌깨기나 스네이크가 적당
→ 행동: create_file_with_node로 game.html 생성 (Canvas 기반 벽돌깨기)

사용자: "이거 뭔가 이상해"
→ 생각: 현재 프로젝트 파일 확인 필요
→ 행동: get_file_structure로 구조 파악 → read_file로 코드 확인 → edit_file로 수정

사용자: "문서 정리해줘"
→ 생각: 프로젝트 구조를 노트로 정리
→ 행동: create_node(type="note")로 문서 노드 생성

사용자: "이메일 확인해줘"
→ 행동: get_emails() 1회 호출
→ 결과 받으면: "받은편지함에 5개의 이메일이 있어요. 1) 팀 회의 안내... 2) 서비스 업데이트..." 형태로 요약 응답

사용자: "네이버 열어줘" / "구글 가줘" / "유튜브 열어"
→ 행동: browser_automation(task="네이버 열어줘") - 실제 브라우저 열림!

사용자: "구글에서 날씨 검색해줘"
→ 행동: browser_automation(task="구글에서 날씨 검색해줘") - 브라우저로 검색 실행!

사용자: "네이버에서 맛집 찾아줘"
→ 행동: browser_automation(task="네이버에서 맛집 검색해줘")

**너는 실행하는 AI다. 말만 하는 AI 아니다. 도구 써서 만들어!**
`

  // 메시지 배열 구성
  const messages: (SystemMessage | HumanMessage | AIMessage | ToolMessage)[] = [
    new SystemMessage(systemPrompt),
  ]

  // 채팅 히스토리 추가
  for (const msg of chatHistory.slice(-20)) {
    if (msg.role === 'user') {
      messages.push(new HumanMessage(msg.content))
    } else if (msg.role === 'assistant') {
      messages.push(new AIMessage(msg.content))
    } else if (msg.role === 'tool' && msg.toolCallId) {
      messages.push(new ToolMessage({ content: msg.content, tool_call_id: msg.toolCallId }))
    }
  }

  // 현재 사용자 메시지 추가
  messages.push(new HumanMessage(userMessage))

  // Tool Calling 루프
  const actions: ToolAction[] = []
  const toolsUsed: string[] = []
  let finalResponse = ''
  let iterations = 0
  const maxIterations = 5  // 무한 루프 방지
  let browserUrl: string | undefined  // 🔥 브라우저 최종 URL 추적

  try {
    while (iterations < maxIterations) {
      iterations++
      console.log(`[SuperAgent] Iteration ${iterations}`)

      // LLM 호출
      const response = await llmWithTools.invoke(messages)

      // Tool Call 확인
      const toolCalls = response.tool_calls || []

      if (toolCalls.length === 0) {
        // Tool Call 없음 - 최종 응답
        finalResponse = typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content)
        break
      }

      // Tool Call 있음 - 도구 실행
      messages.push(new AIMessage({
        content: response.content || '',
        tool_calls: toolCalls.map(tc => ({
          id: tc.id || `tool_${Date.now()}`,
          name: tc.name,
          args: tc.args,
        })),
      }))

      for (const toolCall of toolCalls) {
        const toolName = toolCall.name
        const toolArgs = toolCall.args || {}
        const toolId = toolCall.id || `tool_${Date.now()}`

        console.log(`[SuperAgent] Tool call: ${toolName}`, toolArgs)

        // 🔴 중복 호출 방지: 같은 도구가 이미 성공적으로 호출되었는지 확인
        const previousCallCount = toolsUsed.filter(t => t === toolName).length
        if (previousCallCount > 0 && ['get_emails', 'get_calendar_events'].includes(toolName)) {
          console.log(`[SuperAgent] ⚠️ Duplicate tool call blocked: ${toolName}`)
          messages.push(new ToolMessage({
            content: JSON.stringify({
              success: true,
              completed: true,
              message: `${toolName}은 이미 호출되었습니다. 이전 결과를 사용해서 사용자에게 응답해주세요. 추가 도구 호출 없이 바로 답변하세요.`,
              instruction: '이전 도구 결과를 참고해서 사용자에게 자연어로 요약 응답해주세요.'
            }),
            tool_call_id: toolId,
          }))
          toolsUsed.push(toolName)
          continue
        }

        toolsUsed.push(toolName)

        // 도구 찾기 및 실행
        const tool = tools.find(t => t.name === toolName)
        if (!tool) {
          messages.push(new ToolMessage({
            content: JSON.stringify({ success: false, error: `도구 "${toolName}"을 찾을 수 없습니다.` }),
            tool_call_id: toolId,
          }))
          continue
        }

        try {
          // 도구 실행
          const result = await tool.invoke(toolArgs)
          const parsedResult = typeof result === 'string' ? JSON.parse(result) : result

          // 🔥 browser_automation 도구에서 currentUrl 추출
          if (toolName === 'browser_automation' && parsedResult.currentUrl) {
            browserUrl = parsedResult.currentUrl
            console.log(`[SuperAgent] Browser URL captured: ${browserUrl}`)
          }

          // 액션 수집 (프론트엔드에서 실행할 것들)
          if (parsedResult.action) {
            actions.push(parsedResult.action)
          }

          messages.push(new ToolMessage({
            content: result,
            tool_call_id: toolId,
          }))
        } catch (error: any) {
          messages.push(new ToolMessage({
            content: JSON.stringify({ success: false, error: error.message }),
            tool_call_id: toolId,
          }))
        }
      }
    }

    // 응답 정리
    let cleanResponse = finalResponse
    cleanResponse = cleanResponse.replace(/<think>[\s\S]*?<\/think>\s*/g, '')
    cleanResponse = cleanResponse.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, '')

    return {
      message: cleanResponse.trim() || '작업을 완료했습니다.',
      actions,
      toolsUsed,
      browserUrl,  // 🔥 브라우저 최종 URL
    }
  } catch (error: any) {
    console.error('[SuperAgent] Error:', error)
    return {
      message: `죄송해요, 문제가 발생했어요: ${error.message}`,
      actions: [],
      toolsUsed,
      browserUrl,
    }
  }
}

// ============================================
// 액션 실행 결과 처리
// ============================================
export interface ActionExecutionResult {
  action: ToolAction
  success: boolean
  result?: unknown
  error?: string
}

export function formatActionResults(results: ActionExecutionResult[]): string {
  if (results.length === 0) return ''

  const lines: string[] = ['## 실행 결과']

  for (const r of results) {
    const status = r.success ? '✅' : '❌'
    const type = r.action.type

    switch (type) {
      case 'create_project':
        lines.push(`${status} 프로젝트 생성: ${r.action.data.name}`)
        break
      case 'write_file':
      case 'edit_file':
        lines.push(`${status} 파일 수정: ${r.action.data.path}`)
        break
      case 'terminal_cmd':
        lines.push(`${status} 명령 실행: ${r.action.data.command}`)
        if (r.result) lines.push(`   결과: ${String(r.result).slice(0, 200)}`)
        break
      case 'create_task':
        lines.push(`${status} 태스크 생성: ${r.action.data.title}`)
        break
      default:
        lines.push(`${status} ${type}: ${JSON.stringify(r.action.data).slice(0, 100)}`)
    }

    if (r.error) {
      lines.push(`   오류: ${r.error}`)
    }
  }

  return lines.join('\n')
}
