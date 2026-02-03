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
  buildSkillsContext,
  AGENT_ROLE_PROMPTS,
  type AgentSkill,
} from '@/lib/agent/shared-prompts'
import { createAdminClient } from '@/lib/supabase/admin'

// 🧠 JARVIS 롱텀 메모리 시스템
import {
  buildJarvisContext,
  saveConversationMessage,
  analyzeAndLearn,
  type JarvisContext,
} from '@/lib/memory/jarvis-memory-manager'
import {
  getOrCreateRelationship,
  generateGreeting,
} from '@/lib/memory/agent-relationship-service'

// 🔌 커스텀 API 도구 (에이전트별 연결된 외부 API)
import {
  loadAgentApiConnections,
  createAllApiTools,
  generateApiToolsDescription,
} from '@/lib/agent/api-tool'

// 🦞 OpenClaw 스킬 도구 (OpenClaw Gateway 연동)
import {
  createOpenClawTools,
  createDynamicSkillTools,
} from '@/lib/openclaw'

// 📊 API 사용량 추적
import { logApiUsage } from '@/lib/usage/tracker'

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
  // 🔥 메모리 저장 제어 (API 라우트에서 이미 저장하는 경우 true)
  skipMemorySave?: boolean
}

// ============================================
// 안전한 JSON 파싱
// ============================================

/**
 * 도구 실행 결과 타입
 */
interface ToolResult {
  success?: boolean
  message?: string
  error?: string
  action?: ToolAction
  currentUrl?: string
  [key: string]: any
}

function safeJsonParse<T = ToolResult>(str: string, fallback?: T): T {
  try {
    return JSON.parse(str)
  } catch (error) {
    console.warn('[SuperAgent] JSON parse error:', error)
    return (fallback ?? { success: true, message: str }) as T
  }
}

// ============================================
// 에이전트 활동 로그 저장
// ============================================
async function logAgentActivity(
  agentId: string,
  logType: string,
  title: string,
  content: string,
  metadata: Record<string, any> = {},
  tags: string[] = [],
  importance: number = 5
): Promise<void> {
  try {
    const supabase = createAdminClient()
    // Note: agent_work_logs table may not exist in types, using any cast
    await (supabase.from('agent_work_logs') as any).insert({
      agent_id: agentId,
      log_type: logType,
      title,
      content,
      summary: content.slice(0, 200),
      importance,
      tags,
      metadata,
    })
  } catch (error) {
    console.error('[AgentLog] Failed to save activity log:', error)
  }
}

// ============================================
// LLM 생성
// ============================================
function createLLM(provider: LLMProvider, model: string, apiKey?: string, temperature = 0.7) {
  switch (provider) {
    case 'anthropic':
      // ⚠️ Anthropic API 사용 금지 - Claude Code CLI (Max 플랜 OAuth)로만 사용
      // anthropic 선택 시 openai로 fallback
      console.warn('[createLLM] Anthropic API 사용 금지 - OpenAI로 fallback')
      return new ChatOpenAI({
        model: 'gpt-4o',
        temperature,
        apiKey: process.env.OPENAI_API_KEY,
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
// 작업 복잡도 분석 (Phase 2)
// ============================================

interface TaskComplexity {
  score: number         // 1-10
  maxIterations: number // 5-25
  reason: string
}

/**
 * 사용자 메시지 기반 작업 복잡도 분석
 */
function analyzeTaskComplexity(userMessage: string): TaskComplexity {
  const msg = userMessage.toLowerCase()

  // 복잡도 점수 계산
  let score = 3  // 기본값
  const reasons: string[] = []

  // 🔴 매우 복잡한 작업 (score +4~5)
  const veryComplexKeywords = [
    '사업계획서', 'business plan', '분석 보고서', '종합 분석',
    '전체 리팩토링', 'full refactor', '마이그레이션',
    '처음부터 끝까지', '완전한', 'comprehensive', 'full audit',
  ]
  if (veryComplexKeywords.some(kw => msg.includes(kw))) {
    score += 5
    reasons.push('매우 복잡한 작업')
  }

  // 🟠 복잡한 작업 (score +3)
  const complexKeywords = [
    '조사', '리서치', 'research', '비교', '분석',
    '여러', '다수', 'multiple', '전부', '모든',
    '단계별', 'step by step', '순서대로',
  ]
  if (complexKeywords.some(kw => msg.includes(kw))) {
    score += 3
    reasons.push('복잡한 작업')
  }

  // 🟡 중간 복잡도 (score +2)
  const moderateKeywords = [
    '만들어', 'create', 'build', '구현', 'implement',
    '수정', 'update', '변경', 'change',
  ]
  if (moderateKeywords.some(kw => msg.includes(kw))) {
    score += 2
    reasons.push('생성/수정 작업')
  }

  // 🔵 멀티스텝 힌트 (score +2)
  const multiStepHints = [
    '그리고', '그 다음', 'then', 'and then', '후에',
    '1)', '2)', '①', '②', '먼저', '다음으로',
  ]
  if (multiStepHints.some(kw => msg.includes(kw))) {
    score += 2
    reasons.push('멀티스텝 요청')
  }

  // 점수 범위 제한
  score = Math.min(10, Math.max(1, score))

  // 반복 횟수 매핑
  const maxIterations = Math.min(25, Math.max(5, score * 2 + 3))

  return {
    score,
    maxIterations,
    reason: reasons.length > 0 ? reasons.join(', ') : '일반 작업',
  }
}

// ============================================
// 도구 재시도 로직 (Phase 3)
// ============================================

interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
}

/**
 * 재시도 불가능한 에러인지 확인
 * - 인증 오류, 권한 오류, 잘못된 인자 등은 재시도해도 의미 없음
 */
function isNonRetryableError(error: Error): boolean {
  const msg = error.message.toLowerCase()
  const nonRetryablePatterns = [
    'unauthorized',
    'forbidden',
    '401',
    '403',
    'invalid api key',
    'authentication',
    'permission denied',
    'invalid argument',
    'bad request',
    '400',
    'not found',
    '404',
  ]
  return nonRetryablePatterns.some(pattern => msg.includes(pattern))
}

/**
 * 지수 백오프로 도구 실행 재시도
 * - 재시도 불가능한 에러는 즉시 실패 반환
 * - 타임아웃 지원
 */
async function executeToolWithRetry(
  tool: any,
  toolArgs: Record<string, any>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<{ success: boolean; result?: string; error?: string; retries: number }> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // 타임아웃 처리 (30초)
      const timeoutMs = 30000
      const result = await Promise.race([
        tool.invoke(toolArgs),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Tool timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ])
      return { success: true, result, retries: attempt }
    } catch (error: any) {
      lastError = error
      console.warn(`[SuperAgent] Tool retry ${attempt + 1}/${config.maxRetries + 1}:`, error.message)

      // 재시도 불가능한 에러면 즉시 반환
      if (isNonRetryableError(error)) {
        console.warn(`[SuperAgent] Non-retryable error detected, stopping retries`)
        return {
          success: false,
          error: error.message,
          retries: attempt,
        }
      }

      if (attempt < config.maxRetries) {
        // 지수 백오프 대기
        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt),
          config.maxDelayMs
        )
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || '알 수 없는 오류',
    retries: config.maxRetries,
  }
}

/**
 * 도구 대안 매핑
 */
const TOOL_ALTERNATIVES: Record<string, string[]> = {
  'web_search': ['browser_automation'],
  'browser_automation': ['web_search'],
  'get_emails': [],
  'generate_image': [],
}

// ============================================
// 계획 수립 단계 (Phase 4)
// ============================================

interface ExecutionPlan {
  needsPlanning: boolean
  totalSteps: number
  steps: PlanStep[]
  estimatedIterations: number
  complexity: 'simple' | 'moderate' | 'complex' | 'very_complex'
}

interface PlanStep {
  stepNumber: number
  description: string
  toolsLikely: string[]
  dependsOn: number[]  // 선행 단계 번호
}

/**
 * 복잡한 작업에 대한 실행 계획 생성
 * - 젠스파크처럼 "계획 → 실행" 패턴 구현
 */
async function generateExecutionPlan(
  llm: any,
  userMessage: string,
  availableTools: string[]
): Promise<ExecutionPlan | null> {
  const planningPrompt = `당신은 작업 계획 전문가입니다. 다음 요청에 대한 실행 계획을 세우세요.

사용자 요청: "${userMessage}"

사용 가능한 도구: ${availableTools.join(', ')}

JSON 형식으로 응답하세요:
{
  "needsPlanning": true/false,
  "totalSteps": 숫자,
  "steps": [
    {
      "stepNumber": 1,
      "description": "단계 설명",
      "toolsLikely": ["사용할 도구명"],
      "dependsOn": []
    }
  ],
  "estimatedIterations": 예상 반복 횟수,
  "complexity": "simple|moderate|complex|very_complex"
}

규칙:
- 단순 질문/인사/짧은 요청은 needsPlanning: false
- 도구 사용이 2개 이상 필요한 작업만 계획 수립
- 각 단계는 1개의 주요 도구 사용
- 의존성 명시 (예: 3단계가 1,2단계 결과 필요하면 dependsOn: [1,2])
- JSON만 반환 (마크다운 코드블록 없이)`

  try {
    const response = await llm.invoke(planningPrompt)
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content)

    // JSON 추출 (마크다운 코드블록 제거)
    let jsonStr = content
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1]
    } else {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonStr = jsonMatch[0]
      }
    }

    const plan = JSON.parse(jsonStr)

    if (!plan.needsPlanning) {
      console.log('[SuperAgent] Plan not needed for this task')
      return null
    }

    console.log(`[SuperAgent] Execution plan generated:`, {
      totalSteps: plan.totalSteps,
      complexity: plan.complexity,
      estimatedIterations: plan.estimatedIterations,
    })

    return plan as ExecutionPlan
  } catch (error: any) {
    console.warn('[SuperAgent] Plan generation failed:', error.message)
    return null
  }
}

/**
 * 실행 계획을 프롬프트 컨텍스트로 포맷팅
 */
function formatPlanContext(plan: ExecutionPlan): string {
  return `
## 📋 실행 계획 (${plan.totalSteps}단계, ${plan.complexity})

${plan.steps.map(s => {
  const deps = s.dependsOn.length > 0 ? ` (선행: ${s.dependsOn.join(', ')}단계)` : ''
  return `${s.stepNumber}. ${s.description} [도구: ${s.toolsLikely.join(', ')}]${deps}`
}).join('\n')}

**위 계획을 순서대로 실행하세요. 각 단계 완료 후 다음 단계로 진행하세요.**
**모든 단계 완료 후 최종 결과를 사용자에게 요약해서 전달하세요.**
`
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

  // 🧠 JARVIS 메모리 컨텍스트 로드 (롱텀 메모리)
  let jarvisContext: JarvisContext | null = null
  let relationshipGreeting = ''

  if (context?.userId) {
    try {
      console.log(`[SuperAgent] Loading JARVIS context for user: ${context.userId}`)

      // JARVIS 컨텍스트 빌드 (RAG 검색 포함)
      jarvisContext = await buildJarvisContext(
        agent.id,
        context.userId,
        userMessage,
        {
          recentLimit: 10,    // 최근 대화 10개
          ragLimit: 5,        // RAG 검색 결과 5개
          includeEpisodes: true,  // 중요 이벤트 포함
        }
      )

      console.log(`[SuperAgent] JARVIS context loaded:`, {
        hasUserProfile: !!jarvisContext.userProfile,
        recentConversations: jarvisContext.recentConversations.length,
        relevantMemories: jarvisContext.relevantMemories.length,
        relevantEpisodes: jarvisContext.relevantEpisodes.length,
      })

      // 관계 기반 인사말 (선택적으로 사용)
      if (jarvisContext.userProfile) {
        const relationship = await getOrCreateRelationship(agent.id, 'user', context.userId)
        if (relationship) {
          relationshipGreeting = generateGreeting(relationship)
        }
      }
    } catch (memoryError) {
      console.warn('[SuperAgent] Memory context load failed (continuing without):', memoryError)
      // 메모리 로드 실패해도 대화는 계속 진행
    }
  }

  // 도구 바인딩 (기본 도구 + 비즈니스 도구 + 커스텀 API 도구)
  const superTools = getSuperAgentTools()
  const businessTools = getAgentBusinessTools()

  // 🔌 커스텀 API 도구 로드 (에이전트에 연결된 외부 API)
  let customApiTools: any[] = []
  let apiToolsDescription = ''
  try {
    const apiConnections = await loadAgentApiConnections(agent.id)
    if (apiConnections.length > 0) {
      customApiTools = createAllApiTools(apiConnections)
      apiToolsDescription = generateApiToolsDescription(apiConnections)
      console.log(`[SuperAgent] 🔌 Custom API tools loaded: ${customApiTools.length} tools from ${apiConnections.length} connections`)
    }
  } catch (apiError) {
    console.warn('[SuperAgent] Failed to load custom API tools:', apiError)
  }

  // 🎯 에이전트 스킬 로드 (Supabase에서 장착된 스킬 가져오기)
  let skillsContext = ''
  try {
    const adminClient = createAdminClient()
    const { data: skills } = await adminClient
      .from('agent_skills')
      .select('id, name, description, content, enabled, files, metadata')
      .eq('agent_id', agent.id)
      .eq('enabled', true)

    if (skills && skills.length > 0) {
      skillsContext = buildSkillsContext(skills as AgentSkill[])
      console.log(`[SuperAgent] 🎯 Skills loaded: ${skills.length} enabled skills for ${agent.name}`)
    }
  } catch (skillError) {
    console.warn('[SuperAgent] Failed to load agent skills:', skillError)
  }

  // 🦞 OpenClaw 스킬 도구 로드
  let openClawTools: any[] = []
  try {
    // 기본 OpenClaw 도구 (스킬 조회, 실행)
    openClawTools = createOpenClawTools(context.userId, agent.id)

    // 동적 스킬 도구 (각 스킬을 개별 도구로 변환)
    const dynamicSkillTools = await createDynamicSkillTools(context.userId, agent.id)
    openClawTools = [...openClawTools, ...dynamicSkillTools]

    if (openClawTools.length > 0) {
      console.log(`[SuperAgent] 🦞 OpenClaw tools loaded: ${openClawTools.length} tools for ${agent.name}`)
    }
  } catch (openClawError) {
    console.warn('[SuperAgent] Failed to load OpenClaw tools:', openClawError)
  }

  // 중복 도구 제거 (businessTools 우선)
  const businessToolNames = new Set(businessTools.map(t => t.name))
  const filteredSuperTools = superTools.filter(t => !businessToolNames.has(t.name))
  let tools = [...filteredSuperTools, ...businessTools, ...customApiTools, ...openClawTools]

  // Gemini 모델은 도구가 많으면 느려지므로 핵심 도구만 사용
  const isGemini = (agent as any).provider === 'gemini' || agent.model?.includes('gemini')
  if (isGemini) {
    // Gemini용 핵심 도구 (20개 이하 - 균형있는 선택)
    // 커스텀 API 도구는 항상 포함
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
      // 🔥 정부지원사업 도구
      'generate_business_plan',
      'match_government_programs',
      'query_government_programs',
    ]
    // 커스텀 API 도구 (api_로 시작)는 항상 포함
    tools = tools.filter(t => essentialTools.includes(t.name) || t.name.startsWith('api_'))
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
    false,
    undefined,
    skillsContext
  )

  // 프로젝트 컨텍스트
  const projectContext = context?.projectPath
    ? `\n## 📁 현재 프로젝트\n- 경로: ${context.projectPath}\n`
    : `\n## 📁 현재 프로젝트\n⚠️ 선택된 프로젝트 없음 - 파일 생성 시 create_project를 먼저 호출하세요!\n`

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

  // 🧠 JARVIS 메모리 컨텍스트 문자열 생성
  const memoryContextStr = jarvisContext?.formattedContext
    ? `\n## 🧠 롱텀 메모리 (이 사용자와의 과거 대화 기록)\n${jarvisContext.formattedContext}\n`
    : ''

  // 관계 기반 인사말 힌트
  const relationshipHint = relationshipGreeting
    ? `\n## 💬 소통 스타일 힌트\n이 사용자와는 "${relationshipGreeting}" 같은 톤으로 대화하세요.\n`
    : ''

  const systemPrompt = `${coreSystemPrompt}

${projectContext}
${userInfo}
${workContextStr}
${filesContext}
${memoryContextStr}
${relationshipHint}

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

### 🏛️ 정부지원사업 도구 (⭐ 핵심 기능!)
- **generate_business_plan** - ⭐ 사업계획서 자동 생성! (programId 필요)
- **match_government_programs** - ⭐ 회사에 적합한 정부지원사업 AI 추천
- **query_government_programs** - 정부지원사업 공고 목록 조회

### 🤖 다른 에이전트 호출 (오케스트레이션!)
- **call_agent** - ⭐ 다른 AI 에이전트에게 업무 위임 (agentId 또는 agentName으로 호출)
- **get_agent_status** - 배포된 에이전트 목록 및 상태 조회

### 프로젝트 관리
- **create_project** - ⭐ 새 프로젝트 생성 (파일 작업 전 필수!)
- **list_projects** - 프로젝트 목록 조회

### 코드/파일 작업
- **create_file_with_node** - ⭐ 코드 파일 생성 + 뉴런맵 노드 (가장 많이 씀!)
- **edit_file** - 기존 파일 수정
- **read_file** - 파일 내용 확인
- **get_file_structure** - 프로젝트 구조 파악

### ⚠️ 파일 생성 규칙
현재 프로젝트가 없으면 **create_project를 먼저 호출**한 후 create_file_with_node를 사용하세요!
프로젝트 이름은 작업 내용에 맞게 자동으로 정해주세요. (예: "퀴즈게임", "투두앱" 등)

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

사용자: "우리 회사에 맞는 정부지원사업 찾아줘"
→ 행동: match_government_programs() → 적합한 공고 리스트 반환

사용자: "이 공고 사업계획서 만들어줘" (programId가 있는 경우)
→ 행동: generate_business_plan(programId="xxx") → AI가 자동으로 사업계획서 생성

사용자: "제레미한테 코드 리뷰 맡겨줘"
→ 행동: call_agent(agentName="제레미", message="코드 리뷰해줘")

사용자: "배포된 에이전트 뭐 있어?"
→ 행동: get_agent_status() → 활성 에이전트 목록 반환

**너는 실행하는 AI다. 말만 하는 AI 아니다. 도구 써서 만들어!**
**모든 업무를 직접 수행하거나, 다른 에이전트에게 위임할 수 있다!**
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

  // 🧠 작업 복잡도 기반 동적 반복 횟수 설정 (Phase 2)
  const complexity = analyzeTaskComplexity(userMessage)
  let maxIterations = complexity.maxIterations
  console.log(`[SuperAgent] Task complexity: ${complexity.score}/10, maxIterations: ${maxIterations} (${complexity.reason})`)

  // 🧠 복잡한 작업은 먼저 실행 계획 수립 (Phase 4)
  let executionPlan: ExecutionPlan | null = null
  if (complexity.score >= 7) {
    console.log('[SuperAgent] 🎯 Complex task detected, generating execution plan...')
    executionPlan = await generateExecutionPlan(
      llm,
      userMessage,
      tools.map(t => t.name)
    )

    if (executionPlan) {
      console.log(`[SuperAgent] 📋 Execution plan: ${executionPlan.totalSteps} steps, ${executionPlan.complexity}`)

      // 계획을 시스템 프롬프트에 추가
      const planContext = formatPlanContext(executionPlan)
      messages[0] = new SystemMessage(systemPrompt + planContext)

      // 계획의 예상 반복 횟수로 업데이트 (계획이 더 정확함)
      if (executionPlan.estimatedIterations > maxIterations) {
        maxIterations = Math.min(25, executionPlan.estimatedIterations)
        console.log(`[SuperAgent] 📈 maxIterations updated to ${maxIterations} based on plan`)
      }
    }
  }

  let browserUrl: string | undefined  // 🔥 브라우저 최종 URL 추적

  try {
    while (iterations < maxIterations) {
      iterations++
      console.log(`[SuperAgent] Iteration ${iterations}`)

      // LLM 호출
      const response = await llmWithTools.invoke(messages)

      // 📊 API 사용량 추적
      if (context?.userId) {
        const usage = (response as any).response_metadata?.usage ||
                      (response as any).usage_metadata ||
                      (response as any).response_metadata?.tokenUsage
        if (usage) {
          logApiUsage({
            userId: context.userId,
            provider,
            model,
            inputTokens: usage.input_tokens || usage.prompt_tokens || usage.promptTokens || 0,
            outputTokens: usage.output_tokens || usage.completion_tokens || usage.completionTokens || 0,
            requestType: 'agent',
            agentId: agent.id,
            metadata: { iteration: iterations },
          }).catch(() => {}) // 비동기 실행, 에러 무시
        }
      }

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

        // 🔄 도구 실행 (재시도 포함 - Phase 3)
        const { success, result, error, retries } = await executeToolWithRetry(tool, toolArgs)

        if (success && result) {
          // 안전한 JSON 파싱 (파싱 실패 시 기본값 사용)
          const parsedResult: ToolResult = typeof result === 'string'
            ? safeJsonParse<ToolResult>(result, { success: true, message: result })
            : (result as ToolResult)

          // 재시도 정보 로깅
          if (retries > 0) {
            console.log(`[SuperAgent] Tool ${toolName} succeeded after ${retries} retries`)
          }

          // 🔥 browser_automation 도구에서 currentUrl 추출
          if (toolName === 'browser_automation' && parsedResult.currentUrl) {
            browserUrl = parsedResult.currentUrl
            console.log(`[SuperAgent] Browser URL captured: ${browserUrl}`)
          }

          // 🔥 에이전트 활동 로그 저장
          const toolImportance = ['generate_business_plan', 'match_government_programs', 'call_agent', 'create_task_db'].includes(toolName) ? 8 : 5
          logAgentActivity(
            agent.id,
            'tool_use',
            `${toolName} 도구 사용`,
            parsedResult.success !== false
              ? `${parsedResult.message || '성공적으로 실행됨'}`
              : `실패: ${parsedResult.error || '알 수 없는 오류'}`,
            { toolName, args: toolArgs, success: parsedResult.success !== false, retries },
            [toolName, parsedResult.success !== false ? 'success' : 'failed'],
            toolImportance
          ).catch(() => {}) // 로그 저장 실패해도 무시

          // 액션 수집 (프론트엔드에서 실행할 것들)
          if (parsedResult.action) {
            actions.push(parsedResult.action)
          }

          messages.push(new ToolMessage({
            content: result,
            tool_call_id: toolId,
          }))
        } else {
          // 🚨 재시도 실패 - 대안 도구 시도
          const alternatives = TOOL_ALTERNATIVES[toolName] || []
          let alternativeSuccess = false

          for (const altToolName of alternatives) {
            const altTool = tools.find(t => t.name === altToolName)
            if (altTool) {
              console.log(`[SuperAgent] Trying alternative tool: ${altToolName}`)
              const altResult = await executeToolWithRetry(altTool, toolArgs, { maxRetries: 1, baseDelayMs: 500, maxDelayMs: 2000 })

              if (altResult.success && altResult.result) {
                messages.push(new ToolMessage({
                  content: altResult.result,
                  tool_call_id: toolId,
                }))
                toolsUsed.push(altToolName)
                alternativeSuccess = true
                break
              }
            }
          }

          if (!alternativeSuccess) {
            // 최종 실패
            messages.push(new ToolMessage({
              content: JSON.stringify({
                success: false,
                error: `${error} (${retries}회 재시도 후 실패)`,
                retriesAttempted: retries,
              }),
              tool_call_id: toolId,
            }))
          }
        }
      }
    }

    // 응답 정리
    let cleanResponse = finalResponse
    cleanResponse = cleanResponse.replace(/<think>[\s\S]*?<\/think>\s*/g, '')
    cleanResponse = cleanResponse.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, '')

    // 🔥 대화 로그 저장 (도구를 사용한 경우)
    if (toolsUsed.length > 0) {
      logAgentActivity(
        agent.id,
        'conversation',
        `사용자 요청 처리 완료`,
        `요청: "${userMessage.slice(0, 100)}${userMessage.length > 100 ? '...' : ''}" → 응답: "${cleanResponse.slice(0, 100)}${cleanResponse.length > 100 ? '...' : ''}"`,
        { toolsUsed, userMessage: userMessage.slice(0, 500), response: cleanResponse.slice(0, 500) },
        toolsUsed,
        toolsUsed.some(t => ['generate_business_plan', 'match_government_programs', 'call_agent'].includes(t)) ? 7 : 5
      ).catch(() => {})
    }

    // 🧠 JARVIS 롱텀 메모리에 대화 저장 (Phase 1.4 - 영구 보존)
    // NOTE: API 라우트에서 이미 저장하는 경우 skipMemorySave=true로 중복 방지
    if (context?.userId && !context?.skipMemorySave) {
      try {
        // 사용자 메시지 저장
        await saveConversationMessage({
          agentId: agent.id,
          userId: context.userId,
          role: 'user',
          content: userMessage,
          importance: toolsUsed.length > 0 ? 7 : 5,
          topics: toolsUsed.length > 0 ? toolsUsed : undefined,
          metadata: {
            toolsUsed,
            hasActions: actions.length > 0,
            complexity: complexity.score,
          },
        })

        // 어시스턴트 응답 저장
        await saveConversationMessage({
          agentId: agent.id,
          userId: context.userId,
          role: 'assistant',
          content: cleanResponse,
          importance: toolsUsed.length > 0 ? 7 : 5,
          topics: toolsUsed.length > 0 ? toolsUsed : undefined,
          metadata: {
            toolsUsed,
            browserUrl,
            actionsCount: actions.length,
            iterations,
          },
        })

        // 대화에서 학습 (패턴, 선호도 등 추출)
        await analyzeAndLearn(agent.id, context.userId, userMessage, cleanResponse)

        console.log(`[SuperAgent] 💾 Conversation saved to long-term memory (user + assistant + learning)`)
      } catch (saveError) {
        // 메모리 저장 실패해도 응답은 정상 반환 (non-critical)
        console.warn('[SuperAgent] Memory save failed (non-critical):', saveError)
      }
    } else if (context?.skipMemorySave) {
      console.log(`[SuperAgent] 📌 Memory save skipped (handled by API route)`)
    }

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

// ============================================
// 스트리밍 응답 생성기 (Phase 5)
// ============================================

export interface StreamEvent {
  type: 'thinking' | 'planning' | 'tool_start' | 'tool_end' | 'tool_retry' | 'text' | 'memory_saved' | 'done' | 'error'
  content?: string
  tool?: { name: string; args?: Record<string, any> }
  result?: any
  error?: string
  plan?: ExecutionPlan
  iteration?: number
  maxIterations?: number
}

/**
 * 스트리밍 응답 생성 (SSE 지원)
 * - 젠스파크처럼 진행 상황 실시간 표시
 * - generateSuperAgentResponse와 동일한 로직 (동기화됨)
 */
export async function* generateSuperAgentResponseStream(
  agent: AgentConfig,
  userMessage: string,
  chatHistory: SuperAgentMessage[] = [],
  context?: ChatContext
): AsyncGenerator<StreamEvent, SuperAgentResponse, unknown> {
  // LLM 설정
  const provider = (agent.llm_provider || 'grok') as LLMProvider
  const model = agent.model || getDefaultModel(provider)
  const temperature = agent.temperature ?? 0.7

  console.log(`[SuperAgentStream] ${agent.name} using ${provider}/${model} with tool calling`)
  yield { type: 'thinking', content: `🤖 ${agent.name} 분석 중... (${provider}/${model})` }

  const llm = createLLM(provider, model, agent.apiKey || undefined, temperature)

  // 🔥 실행 컨텍스트 설정 (비즈니스 도구가 회사 정보에 접근할 수 있도록)
  setAgentExecutionContext({
    agentId: agent.id,
    companyId: context?.companyId || undefined,
    userId: context?.userId || undefined,
    projectPath: context?.projectPath || undefined,
  })

  // 🧠 JARVIS 메모리 컨텍스트 로드 (롱텀 메모리)
  let jarvisContext: JarvisContext | null = null
  let relationshipGreeting = ''

  if (context?.userId) {
    yield { type: 'thinking', content: '🧠 장기 기억 로딩 중...' }
    try {
      console.log(`[SuperAgentStream] Loading JARVIS context for user: ${context.userId}`)

      jarvisContext = await buildJarvisContext(
        agent.id,
        context.userId,
        userMessage,
        { recentLimit: 10, ragLimit: 5, includeEpisodes: true }
      )

      console.log(`[SuperAgentStream] JARVIS context loaded:`, {
        hasUserProfile: !!jarvisContext.userProfile,
        recentConversations: jarvisContext.recentConversations.length,
        relevantMemories: jarvisContext.relevantMemories.length,
        relevantEpisodes: jarvisContext.relevantEpisodes.length,
      })

      // 관계 기반 인사말 (선택적으로 사용)
      if (jarvisContext.userProfile) {
        const relationship = await getOrCreateRelationship(agent.id, 'user', context.userId)
        if (relationship) {
          relationshipGreeting = generateGreeting(relationship)
        }
      }
    } catch (memoryError) {
      console.warn('[SuperAgentStream] Memory context load failed (continuing without):', memoryError)
      // 메모리 로드 실패해도 대화는 계속 진행
    }
  }

  // 🔧 도구 바인딩 (기본 도구 + 비즈니스 도구)
  const superTools = getSuperAgentTools()
  const businessTools = getAgentBusinessTools()

  // 🔌 커스텀 API 도구 로드 (에이전트에 연결된 외부 API)
  let customApiTools: any[] = []
  let apiToolsDescription = ''
  try {
    const apiConnections = await loadAgentApiConnections(agent.id)
    if (apiConnections.length > 0) {
      customApiTools = createAllApiTools(apiConnections)
      apiToolsDescription = generateApiToolsDescription(apiConnections)
      console.log(`[SuperAgentStream] 🔌 Custom API tools loaded: ${customApiTools.length} tools from ${apiConnections.length} connections`)
    }
  } catch (apiError) {
    console.warn('[SuperAgentStream] Failed to load custom API tools:', apiError)
  }

  // 🎯 에이전트 스킬 로드 (Supabase에서 장착된 스킬 가져오기)
  let skillsContext = ''
  try {
    const adminClient = createAdminClient()
    const { data: skills } = await adminClient
      .from('agent_skills')
      .select('id, name, description, content, enabled, files, metadata')
      .eq('agent_id', agent.id)
      .eq('enabled', true)

    if (skills && skills.length > 0) {
      skillsContext = buildSkillsContext(skills as AgentSkill[])
      console.log(`[SuperAgentStream] 🎯 Skills loaded: ${skills.length} enabled skills for ${agent.name}`)
    }
  } catch (skillError) {
    console.warn('[SuperAgentStream] Failed to load agent skills:', skillError)
  }

  // 🦞 OpenClaw 스킬 도구 로드
  let openClawTools: any[] = []
  try {
    openClawTools = createOpenClawTools(context.userId, agent.id)
    const dynamicSkillTools = await createDynamicSkillTools(context.userId, agent.id)
    openClawTools = [...openClawTools, ...dynamicSkillTools]
    if (openClawTools.length > 0) {
      console.log(`[SuperAgentStream] 🦞 OpenClaw tools loaded: ${openClawTools.length} tools`)
    }
  } catch (openClawError) {
    console.warn('[SuperAgentStream] Failed to load OpenClaw tools:', openClawError)
  }

  // 중복 도구 제거 (businessTools 우선)
  const businessToolNames = new Set(businessTools.map(t => t.name))
  const filteredSuperTools = superTools.filter(t => !businessToolNames.has(t.name))
  let tools = [...filteredSuperTools, ...businessTools, ...customApiTools, ...openClawTools]

  // Gemini 모델은 도구가 많으면 느려지므로 핵심 도구만 사용
  const isGemini = (agent as any).provider === 'gemini' || agent.model?.includes('gemini')
  if (isGemini) {
    const essentialTools = [
      'search_web', 'get_current_time', 'get_weather', 'calculate',
      'read_file', 'write_file', 'edit_file', 'search_files', 'get_file_structure',
      'get_emails', 'send_email', 'get_calendar_events', 'create_calendar_event',
      'navigate_to', 'use_skill', 'create_project', 'list_projects', 'create_task',
      'run_terminal', 'generate_image', 'call_agent', 'get_agent_status',
      'browser_automation', 'generate_business_plan', 'match_government_programs', 'query_government_programs',
    ]
    // 커스텀 API 도구 (api_로 시작), OpenClaw 도구 (openclaw_, agent_skill, skill_로 시작)는 항상 포함
    tools = tools.filter(t =>
      essentialTools.includes(t.name) ||
      t.name.startsWith('api_') ||
      t.name.startsWith('openclaw_') ||
      t.name.startsWith('agent_skill') ||
      t.name.startsWith('skill_')
    )
    console.log(`[SuperAgentStream] Gemini detected - using ${tools.length} essential tools`)
  }

  console.log(`[SuperAgentStream] Tools loaded: ${tools.length} total (including ${customApiTools.length} custom API tools, ${openClawTools.length} OpenClaw tools)`)
  const llmWithTools = llm.bindTools(tools)

  // 🧠 작업 복잡도 기반 동적 반복 횟수 설정
  const complexity = analyzeTaskComplexity(userMessage)
  let maxIterations = complexity.maxIterations
  console.log(`[SuperAgentStream] Task complexity: ${complexity.score}/10, maxIterations: ${maxIterations} (${complexity.reason})`)

  yield {
    type: 'thinking',
    content: `📊 복잡도: ${complexity.score}/10 (${complexity.reason})`,
  }

  // 🧠 복잡한 작업은 먼저 실행 계획 수립
  let executionPlan: ExecutionPlan | null = null
  if (complexity.score >= 7) {
    yield { type: 'planning', content: '📋 실행 계획 수립 중...' }
    console.log('[SuperAgentStream] 🎯 Complex task detected, generating execution plan...')

    executionPlan = await generateExecutionPlan(
      llm,
      userMessage,
      tools.map(t => t.name)
    )

    if (executionPlan) {
      console.log(`[SuperAgentStream] 📋 Execution plan: ${executionPlan.totalSteps} steps, ${executionPlan.complexity}`)
      yield { type: 'planning', content: `계획 완료: ${executionPlan.totalSteps}단계`, plan: executionPlan }

      if (executionPlan.estimatedIterations > maxIterations) {
        maxIterations = Math.min(25, executionPlan.estimatedIterations)
        console.log(`[SuperAgentStream] 📈 maxIterations updated to ${maxIterations} based on plan`)
      }
    }
  }

  // 🔧 시스템 프롬프트 생성 (generateSuperAgentResponse와 동일)
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
    false,
    undefined,
    skillsContext
  )

  // 프로젝트 컨텍스트
  const projectContext = context?.projectPath
    ? `\n## 📁 현재 프로젝트\n- 경로: ${context.projectPath}\n`
    : `\n## 📁 현재 프로젝트\n⚠️ 선택된 프로젝트 없음 - 파일 생성 시 create_project를 먼저 호출하세요!\n`

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

  // 🧠 JARVIS 메모리 컨텍스트 문자열 생성
  const memoryContextStr = jarvisContext?.formattedContext
    ? `\n## 🧠 롱텀 메모리 (이 사용자와의 과거 대화 기록)\n${jarvisContext.formattedContext}\n`
    : ''

  // 관계 기반 인사말 힌트
  const relationshipHint = relationshipGreeting
    ? `\n## 💬 소통 스타일 힌트\n이 사용자와는 "${relationshipGreeting}" 같은 톤으로 대화하세요.\n`
    : ''

  let systemPrompt = `${coreSystemPrompt}

${projectContext}
${userInfo}
${workContextStr}
${filesContext}
${memoryContextStr}
${relationshipHint}

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

### 🏛️ 정부지원사업 도구 (⭐ 핵심 기능!)
- **generate_business_plan** - ⭐ 사업계획서 자동 생성! (programId 필요)
- **match_government_programs** - ⭐ 회사에 적합한 정부지원사업 AI 추천
- **query_government_programs** - 정부지원사업 공고 목록 조회

### 🤖 다른 에이전트 호출 (오케스트레이션!)
- **call_agent** - ⭐ 다른 AI 에이전트에게 업무 위임 (agentId 또는 agentName으로 호출)
- **get_agent_status** - 배포된 에이전트 목록 및 상태 조회

### 프로젝트 관리
- **create_project** - ⭐ 새 프로젝트 생성 (파일 작업 전 필수!)
- **list_projects** - 프로젝트 목록 조회

### 코드/파일 작업
- **create_file_with_node** - ⭐ 코드 파일 생성 + 뉴런맵 노드 (가장 많이 씀!)
- **edit_file** - 기존 파일 수정
- **read_file** - 파일 내용 확인
- **get_file_structure** - 프로젝트 구조 파악

### ⚠️ 파일 생성 규칙
현재 프로젝트가 없으면 **create_project를 먼저 호출**한 후 create_file_with_node를 사용하세요!
프로젝트 이름은 작업 내용에 맞게 자동으로 정해주세요. (예: "퀴즈게임", "투두앱" 등)

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

사용자: "우리 회사에 맞는 정부지원사업 찾아줘"
→ 행동: match_government_programs() → 적합한 공고 리스트 반환

사용자: "이 공고 사업계획서 만들어줘" (programId가 있는 경우)
→ 행동: generate_business_plan(programId="xxx") → AI가 자동으로 사업계획서 생성

사용자: "제레미한테 코드 리뷰 맡겨줘"
→ 행동: call_agent(agentName="제레미", message="코드 리뷰해줘")

사용자: "배포된 에이전트 뭐 있어?"
→ 행동: get_agent_status() → 활성 에이전트 목록 반환

**너는 실행하는 AI다. 말만 하는 AI 아니다. 도구 써서 만들어!**
**모든 업무를 직접 수행하거나, 다른 에이전트에게 위임할 수 있다!**
`

  // 실행 계획이 있으면 추가
  if (executionPlan) {
    systemPrompt += formatPlanContext(executionPlan)
  }

  const messages: (SystemMessage | HumanMessage | AIMessage | ToolMessage)[] = [
    new SystemMessage(systemPrompt),
  ]

  // 히스토리 추가
  for (const msg of chatHistory.slice(-20)) {
    if (msg.role === 'user') {
      messages.push(new HumanMessage(msg.content))
    } else if (msg.role === 'assistant') {
      messages.push(new AIMessage(msg.content))
    } else if (msg.role === 'tool' && msg.toolCallId) {
      messages.push(new ToolMessage({ content: msg.content, tool_call_id: msg.toolCallId }))
    }
  }

  messages.push(new HumanMessage(userMessage))

  // Tool Calling 루프
  const actions: ToolAction[] = []
  const toolsUsed: string[] = []
  let finalResponse = ''
  let iterations = 0
  let browserUrl: string | undefined

  try {
    while (iterations < maxIterations) {
      iterations++
      yield {
        type: 'thinking',
        content: `🔄 반복 ${iterations}/${maxIterations}`,
        iteration: iterations,
        maxIterations,
      }

      const response = await llmWithTools.invoke(messages)

      // 📊 API 사용량 추적
      if (context?.userId) {
        const usage = (response as any).response_metadata?.usage ||
                      (response as any).usage_metadata ||
                      (response as any).response_metadata?.tokenUsage
        if (usage) {
          logApiUsage({
            userId: context.userId,
            provider,
            model,
            inputTokens: usage.input_tokens || usage.prompt_tokens || usage.promptTokens || 0,
            outputTokens: usage.output_tokens || usage.completion_tokens || usage.completionTokens || 0,
            requestType: 'agent_stream',
            agentId: agent.id,
            metadata: { iteration: iterations },
          }).catch(() => {})
        }
      }

      const toolCalls = response.tool_calls || []

      if (toolCalls.length === 0) {
        finalResponse = typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content)
        break
      }

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

        console.log(`[SuperAgentStream] Tool call: ${toolName}`, toolArgs)

        // 🔴 중복 호출 방지: 같은 도구가 이미 성공적으로 호출되었는지 확인
        const previousCallCount = toolsUsed.filter(t => t === toolName).length
        if (previousCallCount > 0 && ['get_emails', 'get_calendar_events'].includes(toolName)) {
          console.log(`[SuperAgentStream] ⚠️ Duplicate tool call blocked: ${toolName}`)
          yield { type: 'tool_end', tool: { name: toolName }, result: '이미 호출됨 - 이전 결과 사용' }
          messages.push(new ToolMessage({
            content: JSON.stringify({
              success: true,
              completed: true,
              message: `${toolName}은 이미 호출되었습니다. 이전 결과를 사용해서 사용자에게 응답해주세요.`,
              instruction: '이전 도구 결과를 참고해서 사용자에게 자연어로 요약 응답해주세요.'
            }),
            tool_call_id: toolId,
          }))
          toolsUsed.push(toolName)
          continue
        }

        yield { type: 'tool_start', tool: { name: toolName, args: toolArgs } }

        const tool = tools.find(t => t.name === toolName)
        if (!tool) {
          yield { type: 'tool_end', tool: { name: toolName }, error: '도구를 찾을 수 없음' }
          messages.push(new ToolMessage({
            content: JSON.stringify({ success: false, error: `도구 "${toolName}"을 찾을 수 없습니다.` }),
            tool_call_id: toolId,
          }))
          continue
        }

        toolsUsed.push(toolName)

        // 🔄 도구 실행 (재시도 포함)
        const { success, result, error, retries } = await executeToolWithRetry(tool, toolArgs)

        if (retries > 0) {
          yield { type: 'tool_retry', tool: { name: toolName }, content: `${retries}회 재시도 후 ${success ? '성공' : '실패'}` }
        }

        if (success && result) {
          // 안전한 JSON 파싱 (파싱 실패 시 기본값 사용)
          const parsedResult: ToolResult = typeof result === 'string'
            ? safeJsonParse<ToolResult>(result, { success: true, message: result })
            : (result as ToolResult)

          // 재시도 정보 로깅
          if (retries > 0) {
            console.log(`[SuperAgentStream] Tool ${toolName} succeeded after ${retries} retries`)
          }

          // 🔥 browser_automation 도구에서 currentUrl 추출
          if (toolName === 'browser_automation' && parsedResult.currentUrl) {
            browserUrl = parsedResult.currentUrl
            console.log(`[SuperAgentStream] Browser URL captured: ${browserUrl}`)
          }

          // 🔥 에이전트 활동 로그 저장
          const toolImportance = ['generate_business_plan', 'match_government_programs', 'call_agent', 'create_task_db'].includes(toolName) ? 8 : 5
          logAgentActivity(
            agent.id,
            'tool_use',
            `${toolName} 도구 사용`,
            parsedResult.success !== false
              ? `${parsedResult.message || '성공적으로 실행됨'}`
              : `실패: ${parsedResult.error || '알 수 없는 오류'}`,
            { toolName, args: toolArgs, success: parsedResult.success !== false, retries },
            [toolName, parsedResult.success !== false ? 'success' : 'failed'],
            toolImportance
          ).catch(() => {}) // 로그 저장 실패해도 무시

          // 액션 수집 (프론트엔드에서 실행할 것들)
          if (parsedResult.action) {
            actions.push(parsedResult.action)
          }

          yield {
            type: 'tool_end',
            tool: { name: toolName },
            result: parsedResult.success !== false
              ? (parsedResult.message || '완료')
              : (parsedResult.error || '실패'),
          }

          messages.push(new ToolMessage({ content: result, tool_call_id: toolId }))
        } else {
          // 🚨 재시도 실패 - 대안 도구 시도
          const alternatives = TOOL_ALTERNATIVES[toolName] || []
          let alternativeSuccess = false

          for (const altToolName of alternatives) {
            const altTool = tools.find(t => t.name === altToolName)
            if (altTool) {
              console.log(`[SuperAgentStream] Trying alternative tool: ${altToolName}`)
              yield { type: 'tool_retry', tool: { name: altToolName }, content: `대안 도구 시도: ${altToolName}` }

              const altResult = await executeToolWithRetry(altTool, toolArgs, { maxRetries: 1, baseDelayMs: 500, maxDelayMs: 2000 })

              if (altResult.success && altResult.result) {
                yield { type: 'tool_end', tool: { name: altToolName }, result: '대안 도구 성공' }
                messages.push(new ToolMessage({
                  content: altResult.result,
                  tool_call_id: toolId,
                }))
                toolsUsed.push(altToolName)
                alternativeSuccess = true
                break
              }
            }
          }

          if (!alternativeSuccess) {
            // 최종 실패
            yield { type: 'tool_end', tool: { name: toolName }, error: `${error} (${retries}회 재시도 후 실패)` }
            messages.push(new ToolMessage({
              content: JSON.stringify({
                success: false,
                error: `${error} (${retries}회 재시도 후 실패)`,
                retriesAttempted: retries,
              }),
              tool_call_id: toolId,
            }))
          }
        }
      }
    }

    // 응답 정리
    let cleanResponse = finalResponse
    cleanResponse = cleanResponse.replace(/<think>[\s\S]*?<\/think>\s*/g, '')
    cleanResponse = cleanResponse.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, '')

    yield { type: 'text', content: cleanResponse.trim() || '작업을 완료했습니다.' }

    // 🔥 대화 로그 저장 (도구를 사용한 경우)
    if (toolsUsed.length > 0) {
      logAgentActivity(
        agent.id,
        'conversation',
        `사용자 요청 처리 완료`,
        `요청: "${userMessage.slice(0, 100)}${userMessage.length > 100 ? '...' : ''}" → 응답: "${cleanResponse.slice(0, 100)}${cleanResponse.length > 100 ? '...' : ''}"`,
        { toolsUsed, userMessage: userMessage.slice(0, 500), response: cleanResponse.slice(0, 500) },
        toolsUsed,
        toolsUsed.some(t => ['generate_business_plan', 'match_government_programs', 'call_agent'].includes(t)) ? 7 : 5
      ).catch(() => {})
    }

    // 🧠 JARVIS 롱텀 메모리에 대화 저장 (Phase 1.4 - 영구 보존)
    // NOTE: API 라우트에서 이미 저장하는 경우 skipMemorySave=true로 중복 방지
    if (context?.userId && !context?.skipMemorySave) {
      try {
        // 사용자 메시지 저장
        await saveConversationMessage({
          agentId: agent.id,
          userId: context.userId,
          role: 'user',
          content: userMessage,
          importance: toolsUsed.length > 0 ? 7 : 5,
          topics: toolsUsed.length > 0 ? toolsUsed : undefined,
          metadata: {
            toolsUsed,
            hasActions: actions.length > 0,
            complexity: complexity.score,
          },
        })

        // 어시스턴트 응답 저장
        await saveConversationMessage({
          agentId: agent.id,
          userId: context.userId,
          role: 'assistant',
          content: cleanResponse,
          importance: toolsUsed.length > 0 ? 7 : 5,
          topics: toolsUsed.length > 0 ? toolsUsed : undefined,
          metadata: {
            toolsUsed,
            browserUrl,
            actionsCount: actions.length,
            iterations,
          },
        })

        // 대화에서 학습 (패턴, 선호도 등 추출)
        await analyzeAndLearn(agent.id, context.userId, userMessage, cleanResponse)

        console.log(`[SuperAgentStream] 💾 Conversation saved to long-term memory (user + assistant + learning)`)
        yield { type: 'memory_saved', content: '💾 장기 기억에 저장됨' }
      } catch (saveError) {
        // 메모리 저장 실패해도 응답은 정상 반환 (non-critical)
        console.warn('[SuperAgentStream] Memory save failed (non-critical):', saveError)
      }
    } else if (context?.skipMemorySave) {
      console.log(`[SuperAgentStream] 📌 Memory save skipped (handled by caller)`)
    }

    yield { type: 'done' }

    return {
      message: cleanResponse.trim() || '작업을 완료했습니다.',
      actions,
      toolsUsed,
      browserUrl,
    }
  } catch (error: any) {
    yield { type: 'error', error: error.message }

    return {
      message: `죄송해요, 문제가 발생했어요: ${error.message}`,
      actions: [],
      toolsUsed,
      browserUrl,
    }
  }
}
