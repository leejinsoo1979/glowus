# JARVIS 급 AI 비서 업그레이드 로드맵 (상세 버전)

> **목표**: 슈퍼에이전트를 젠스파크/마누스 수준의 완전 자율 AI 비서로 업그레이드
> **핵심 원칙**: LLM은 교체 가능, 메모리는 영구 보존
> **작성일**: 2026-01-20
> **기반 코드 분석**: 완료

---

## 🔍 현재 상태 진단 (코드 레벨 분석)

### 이미 있는 것 ✅

#### 1. 5계층 메모리 시스템 (`lib/memory/agent-memory-service.ts`)
```typescript
// 5가지 메모리 타입 지원 (lines 19-20)
export type AgentMemoryType = 'private' | 'meeting' | 'team' | 'injected' | 'execution'

// 핵심 함수들
- savePrivateMemory()      // 1:1 대화 메모리 저장 (lines 156-175)
- searchAgentMemories()    // 메모리 검색 + RAG (lines 248-324)
- semanticSearch()         // 벡터 유사도 검색 (lines 329-354)
```

#### 2. JARVIS 메모리 매니저 (`lib/memory/jarvis-memory-manager.ts`)
```typescript
// 🔥 핵심 발견: 이미 구현되어 있음!
export async function buildJarvisContext(
  agentId: string,
  userId: string,
  currentMessage: string,
  options: { recentLimit?: number; ragLimit?: number; includeEpisodes?: boolean }
): Promise<JarvisContext>  // line 390-434

export async function saveConversationMessage(
  params: SaveMessageParams
): Promise<{ success: boolean; memoryId?: string }>  // line 257-279
```

#### 3. 관계 관리 시스템 (`lib/memory/agent-relationship-service.ts`)
```typescript
- getOrCreateRelationship()     // 관계 조회/생성 (lines 68-131)
- recordInteraction()           // 상호작용 기록 (lines 209-273)
- generateGreeting()            // 관계 기반 인사 (lines 388-410)
- buildRelationshipContext()    // 프롬프트용 컨텍스트 (lines 415-474)
```

#### 4. 학습 시스템 (`lib/memory/agent-learning-service.ts`)
```typescript
- learnFromConversation()       // 대화에서 인사이트 추출 (lines 333-348)
- buildLearningContext()        // 학습 기반 컨텍스트 생성 (lines 398-461)
```

#### 5. 통합 Agent OS (`lib/memory/agent-os.ts`)
```typescript
export async function buildAgentContext(params): Promise<AgentContext>  // lines 125-188
export async function processConversation(params): Promise<...>         // lines 234-298
```

---

### ❌ 문제점 (정확한 코드 위치)

#### 문제 1: 메모리 시스템이 연동되지 않음
**파일**: `lib/ai/super-agent-chat.ts`

```typescript
// line 481: 단순히 마지막 20개 메시지만 사용
for (const msg of chatHistory.slice(-20)) {
  // ... 롱텀 메모리 로드 없음!
}

// 🔴 문제: buildJarvisContext()나 buildAgentContext()를 호출하지 않음
// 🔴 문제: saveConversationMessage()도 호출하지 않음
```

#### 문제 2: 반복 횟수 5회 고정
**파일**: `lib/ai/super-agent-chat.ts`, **line 499**

```typescript
const maxIterations = 5  // 무한 루프 방지 ← 🔴 고정값!
```

복잡한 작업 (사업계획서 작성, 멀티스텝 리서치 등)에는 5회로 부족함.

#### 문제 3: 에러 복구 없음
**파일**: `lib/ai/super-agent-chat.ts`, **lines 601-606**

```typescript
} catch (error: any) {
  messages.push(new ToolMessage({
    content: JSON.stringify({ success: false, error: error.message }),
    tool_call_id: toolId,
  }))
  // 🔴 재시도 없이 바로 실패 처리
}
```

#### 문제 4: 계획 수립 단계 없음
현재 흐름: 사용자 메시지 → 즉시 도구 실행 → 응답

젠스파크 흐름: 사용자 메시지 → **계획 수립** → 단계별 실행 → 검증 → 응답

---

## 📋 Phase 1: 롱텀 메모리 연동 (핵심!)

> **예상 소요**: 2-3시간
> **효과**: 대화 기억 영구 보존, 관계 기반 응답, 학습 내용 활용
> **우선순위**: ⭐⭐⭐⭐⭐ (최우선)

### Task 1.1: 메모리 시스템 Import 추가

**파일**: `lib/ai/super-agent-chat.ts`
**위치**: 파일 상단 import 섹션 (line 6 이후)

**추가할 코드**:
```typescript
// === 기존 import (lines 6-22) ===
import { ChatOpenAI } from '@langchain/openai'
// ... 생략 ...

// === 추가할 import ===
import {
  buildJarvisContext,
  saveConversationMessage,
  analyzeAndLearn,
  type JarvisContext,
} from '@/lib/memory/jarvis-memory-manager'

import {
  buildAgentContext,
  processConversation,
  formatAgentContext,
  getOrCreateRelationship,
  recordInteraction,
} from '@/lib/memory/agent-os'
```

**체크리스트**:
- [ ] import 추가
- [ ] 타입스크립트 에러 없는지 확인
- [ ] 사용하지 않는 import 없는지 확인

### Task 1.2: 메모리 컨텍스트 로드

**파일**: `lib/ai/super-agent-chat.ts`
**위치**: `generateSuperAgentResponse()` 함수 시작 부분 (line 178 이후)
**정확한 삽입 위치**: line 200 이후 (setAgentExecutionContext 호출 다음)

**변경 전** (lines 194-200):
```typescript
// 🔥 실행 컨텍스트 설정 (비즈니스 도구가 회사 정보에 접근할 수 있도록)
setAgentExecutionContext({
  agentId: agent.id,
  companyId: context?.companyId || undefined,
  userId: context?.userId || undefined,
  projectPath: context?.projectPath || undefined,
})
```

**변경 후**:
```typescript
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
      const { getOrCreateRelationship, generateGreeting } = await import('@/lib/memory/agent-relationship-service')
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
```

**체크리스트**:
- [ ] userId가 있을 때만 메모리 로드 시도
- [ ] 에러 발생해도 대화 진행되는지 확인
- [ ] 로깅으로 디버깅 가능한지 확인

### Task 1.3: 시스템 프롬프트에 메모리 컨텍스트 주입

**파일**: `lib/ai/super-agent-chat.ts`
**위치**: 시스템 프롬프트 생성 부분 (lines 303-308)

**변경 전** (lines 303-308):
```typescript
const systemPrompt = `${coreSystemPrompt}

${projectContext}
${userInfo}
${workContextStr}
${filesContext}
```

**변경 후**:
```typescript
// 🧠 JARVIS 메모리 컨텍스트 문자열 생성
const memoryContextStr = jarvisContext?.formattedContext
  ? `\n## 🧠 롱텀 메모리 (이 사용자와의 과거 대화 기록)\n${jarvisContext.formattedContext}\n`
  : ''

// 관계 기반 인사말 힌트
const relationshipHint = relationshipGreeting
  ? `\n## 💬 인사말 힌트\n이 사용자와는 "${relationshipGreeting}" 같은 톤으로 대화하세요.\n`
  : ''

const systemPrompt = `${coreSystemPrompt}

${projectContext}
${userInfo}
${workContextStr}
${filesContext}
${memoryContextStr}
${relationshipHint}
```

**체크리스트**:
- [ ] 메모리 컨텍스트가 프롬프트에 포함되는지 확인
- [ ] 토큰 사용량이 과도하지 않은지 확인 (formattedContext 길이 제한 필요할 수 있음)

### Task 1.4: 대화 종료 후 메모리 저장

**파일**: `lib/ai/super-agent-chat.ts`
**위치**: 응답 반환 직전 (line 628 이전)

**변경 전** (lines 615-632):
```typescript
// 🔥 대화 로그 저장 (도구를 사용한 경우)
if (toolsUsed.length > 0) {
  logAgentActivity(
    // ... 기존 로깅 코드
  ).catch(() => {})
}

return {
  message: cleanResponse.trim() || '작업을 완료했습니다.',
  actions,
  toolsUsed,
  browserUrl,
}
```

**변경 후**:
```typescript
// 🔥 대화 로그 저장 (도구를 사용한 경우)
if (toolsUsed.length > 0) {
  logAgentActivity(
    // ... 기존 로깅 코드
  ).catch(() => {})
}

// 🧠 JARVIS 롱텀 메모리에 대화 저장 (영구 보존)
if (context?.userId) {
  try {
    // 사용자 메시지 저장
    await saveConversationMessage({
      agentId: agent.id,
      userId: context.userId,
      role: 'user',
      content: userMessage,
      importance: toolsUsed.length > 0 ? 7 : 5,  // 도구 사용 대화는 더 중요
      topics: toolsUsed,
      metadata: { toolsUsed, hasActions: actions.length > 0 },
    })

    // 어시스턴트 응답 저장
    await saveConversationMessage({
      agentId: agent.id,
      userId: context.userId,
      role: 'assistant',
      content: cleanResponse,
      importance: toolsUsed.length > 0 ? 7 : 5,
      topics: toolsUsed,
      metadata: { toolsUsed, browserUrl },
    })

    // 대화에서 학습 (자동 패턴 추출)
    await analyzeAndLearn(agent.id, context.userId, userMessage, cleanResponse)

    console.log(`[SuperAgent] Conversation saved to long-term memory`)
  } catch (saveError) {
    console.warn('[SuperAgent] Memory save failed (non-critical):', saveError)
    // 메모리 저장 실패해도 응답은 반환
  }
}

return {
  message: cleanResponse.trim() || '작업을 완료했습니다.',
  actions,
  toolsUsed,
  browserUrl,
}
```

**체크리스트**:
- [ ] 사용자 메시지와 어시스턴트 응답 모두 저장
- [ ] 중요도(importance) 적절히 설정
- [ ] 도구 사용 정보 메타데이터에 포함
- [ ] 에러 발생해도 응답 반환되는지 확인

### Task 1.5: 테스트 방법

```bash
# 1. 서버 시작 후 슈퍼에이전트 채팅 열기

# 2. 테스트 대화
사용자: "안녕, 나는 프론트엔드 개발자야"
→ 예상: 정상 응답 + 콘솔에 "[SuperAgent] Conversation saved to long-term memory" 로그

# 3. 페이지 새로고침 후 다시 대화
사용자: "나 뭐하는 사람이었지?"
→ 예상: "프론트엔드 개발자라고 하셨어요" 류의 응답 (롱텀 메모리에서 조회)

# 4. Supabase에서 확인
SELECT * FROM agent_memories WHERE agent_id = '[에이전트ID]' ORDER BY created_at DESC;
```

---

## 📋 Phase 2: 반복 횟수 동적 조정

> **예상 소요**: 1-2시간
> **효과**: 복잡한 멀티스텝 작업 완료율 대폭 향상

### Task 2.1: 작업 복잡도 분석 함수

**파일**: `lib/ai/super-agent-chat.ts`
**위치**: 파일 상단 유틸리티 섹션 (line 100 이후)

**추가할 코드**:
```typescript
// ============================================
// 작업 복잡도 분석
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
```

### Task 2.2: 동적 maxIterations 적용

**파일**: `lib/ai/super-agent-chat.ts`
**위치**: Tool Calling 루프 시작 부분 (lines 494-499)

**변경 전** (lines 494-499):
```typescript
// Tool Calling 루프
const actions: ToolAction[] = []
const toolsUsed: string[] = []
let finalResponse = ''
let iterations = 0
const maxIterations = 5  // 무한 루프 방지
```

**변경 후**:
```typescript
// Tool Calling 루프
const actions: ToolAction[] = []
const toolsUsed: string[] = []
let finalResponse = ''
let iterations = 0

// 🧠 작업 복잡도 기반 동적 반복 횟수 설정
const complexity = analyzeTaskComplexity(userMessage)
const maxIterations = complexity.maxIterations
console.log(`[SuperAgent] Task complexity: ${complexity.score}/10, maxIterations: ${maxIterations} (${complexity.reason})`)
```

### Task 2.3: 테스트 케이스

```bash
# 간단한 요청 (예상: 5-7회)
"안녕"
"오늘 날씨 어때?"

# 중간 복잡도 (예상: 9-13회)
"게임 만들어줘"
"이 파일 수정해줘"

# 복잡한 요청 (예상: 15-20회)
"우리 회사에 맞는 정부지원사업 찾아서 분석해줘"
"처음부터 끝까지 웹사이트 만들어줘"

# 매우 복잡한 요청 (예상: 20-25회)
"사업계획서 작성해줘"
"전체 코드베이스 분석하고 리팩토링 계획 세워줘"
```

---

## 📋 Phase 3: 에러 복구 및 재시도

> **예상 소요**: 2-3시간
> **효과**: 안정성 대폭 향상, 도구 실패 시 자동 복구

### Task 3.1: 재시도 로직 구현

**파일**: `lib/ai/super-agent-chat.ts`
**위치**: 유틸리티 섹션 (analyzeTaskComplexity 함수 뒤)

**추가할 코드**:
```typescript
// ============================================
// 도구 재시도 로직
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
 * 지수 백오프로 도구 실행 재시도
 */
async function executeToolWithRetry(
  tool: any,
  toolArgs: Record<string, any>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<{ success: boolean; result?: string; error?: string; retries: number }> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await tool.invoke(toolArgs)
      return { success: true, result, retries: attempt }
    } catch (error: any) {
      lastError = error
      console.warn(`[SuperAgent] Tool retry ${attempt + 1}/${config.maxRetries + 1}:`, error.message)

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
  'get_emails': ['query_calendar'],  // 이메일 실패 시 캘린더로 대체 (제한적)
  'generate_image': [],  // 대안 없음
}
```

### Task 3.2: Tool Calling 루프에 재시도 적용

**파일**: `lib/ai/super-agent-chat.ts`
**위치**: Tool Call 실행 부분 (lines 567-606)

**변경 전** (lines 567-606):
```typescript
try {
  // 도구 실행
  const result = await tool.invoke(toolArgs)
  // ... 결과 처리
} catch (error: any) {
  messages.push(new ToolMessage({
    content: JSON.stringify({ success: false, error: error.message }),
    tool_call_id: toolId,
  }))
}
```

**변경 후**:
```typescript
// 🔄 도구 실행 (재시도 포함)
const { success, result, error, retries } = await executeToolWithRetry(tool, toolArgs)

if (success && result) {
  const parsedResult = typeof result === 'string' ? JSON.parse(result) : result

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
    parsedResult.success
      ? `${parsedResult.message || '성공적으로 실행됨'}`
      : `실패: ${parsedResult.error || '알 수 없는 오류'}`,
    { toolName, args: toolArgs, success: parsedResult.success, retries },
    [toolName, parsedResult.success ? 'success' : 'failed'],
    toolImportance
  ).catch(() => {})

  // 액션 수집
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
```

---

## 📋 Phase 4: 계획 수립 단계

> **예상 소요**: 3-4시간
> **효과**: 젠스파크처럼 "계획 → 실행" 패턴

### Task 4.1: 계획 생성 함수

**파일**: `lib/ai/super-agent-chat.ts` (또는 새 파일 `lib/ai/super-agent-planner.ts`)

```typescript
// ============================================
// 작업 계획 생성기
// ============================================

interface ExecutionPlan {
  totalSteps: number
  steps: PlanStep[]
  estimatedIterations: number
  complexity: string
}

interface PlanStep {
  stepNumber: number
  description: string
  toolsLikely: string[]
  dependsOn: number[]  // 선행 단계 번호
}

/**
 * 복잡한 작업에 대한 실행 계획 생성
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
  "needsPlanning": true/false,  // 단순 요청이면 false
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
- 단순 질문/인사는 needsPlanning: false
- 도구 사용이 필요한 작업만 계획 수립
- 각 단계는 1개의 주요 도구 사용
- 의존성 명시 (예: 3단계가 1,2단계 결과 필요하면 dependsOn: [1,2])
`

  try {
    const response = await llm.invoke(planningPrompt)
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content)

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const plan = JSON.parse(jsonMatch[0])
      if (!plan.needsPlanning) {
        return null  // 계획 불필요
      }
      return plan as ExecutionPlan
    }
  } catch (error) {
    console.warn('[SuperAgent] Plan generation failed:', error)
  }
  return null
}
```

### Task 4.2: 계획 기반 실행 통합

**파일**: `lib/ai/super-agent-chat.ts`
**위치**: Tool Calling 루프 시작 전

```typescript
// 🧠 복잡한 작업은 먼저 계획 수립
let executionPlan: ExecutionPlan | null = null
if (complexity.score >= 7) {
  console.log('[SuperAgent] Complex task detected, generating execution plan...')
  executionPlan = await generateExecutionPlan(
    llm,
    userMessage,
    tools.map(t => t.name)
  )

  if (executionPlan) {
    console.log(`[SuperAgent] Execution plan: ${executionPlan.totalSteps} steps, ${executionPlan.complexity}`)

    // 계획을 시스템 프롬프트에 추가
    const planContext = `\n## 📋 실행 계획 (${executionPlan.totalSteps}단계)
${executionPlan.steps.map(s => `${s.stepNumber}. ${s.description} [도구: ${s.toolsLikely.join(', ')}]`).join('\n')}

위 계획을 순서대로 실행하세요. 각 단계 완료 후 다음 단계로 진행하세요.
`
    messages[0] = new SystemMessage(systemPrompt + planContext)
  }
}
```

---

## 📋 Phase 5: 실시간 스트리밍

> **예상 소요**: 4-5시간
> **효과**: 젠스파크처럼 진행 상황 실시간 표시

### Task 5.1: 스트리밍 응답 함수

```typescript
// ============================================
// 스트리밍 응답 생성기
// ============================================

export interface StreamEvent {
  type: 'thinking' | 'tool_start' | 'tool_end' | 'text' | 'done' | 'error'
  content?: string
  tool?: { name: string; args?: any }
  result?: any
  error?: string
}

export async function* generateSuperAgentResponseStream(
  agent: AgentConfig,
  userMessage: string,
  chatHistory: SuperAgentMessage[] = [],
  context?: ChatContext
): AsyncGenerator<StreamEvent, SuperAgentResponse, unknown> {
  // ... 기존 로직을 yield로 이벤트 방출하도록 변환

  yield { type: 'thinking', content: '요청 분석 중...' }

  // Tool call 시작
  yield { type: 'tool_start', tool: { name: toolName, args: toolArgs } }

  // Tool call 완료
  yield { type: 'tool_end', tool: { name: toolName }, result: parsedResult }

  // 최종 텍스트
  yield { type: 'text', content: cleanResponse }

  // 완료
  yield { type: 'done' }

  return finalResponse
}
```

### Task 5.2: API 라우트 SSE 지원

**파일**: `app/api/agents/[id]/chat/route.ts`

```typescript
// SSE 스트리밍 엔드포인트
export async function POST(request: Request, { params }: { params: { id: string } }) {
  // ... 기존 인증/검증 로직

  const { stream } = await request.json()

  if (stream) {
    // SSE 스트리밍
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of generateSuperAgentResponseStream(agent, message, history, context)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        }
        controller.close()
      }
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })
  }

  // 기존 비스트리밍 응답
  // ...
}
```

---

## 📋 Phase 6: 통합 테스트 및 최적화

> **예상 소요**: 2-3시간

### 체크리스트

- [ ] **롱텀 메모리 테스트**
  - [ ] 새 대화 → 저장 확인
  - [ ] 페이지 새로고침 → 기억 유지 확인
  - [ ] 다른 에이전트로 전환 → 메모리 분리 확인

- [ ] **복잡도 분석 테스트**
  - [ ] 간단한 요청 → 5-7회 반복
  - [ ] 복잡한 요청 → 15-20회 반복
  - [ ] 사업계획서 → 20-25회 반복

- [ ] **에러 복구 테스트**
  - [ ] 네트워크 에러 시뮬레이션 → 재시도 확인
  - [ ] 도구 실패 → 대안 도구 시도 확인

- [ ] **LLM 교체 테스트**
  - [ ] GPT-4 → 메모리 유지 확인
  - [ ] Claude → 메모리 유지 확인
  - [ ] Gemini → 메모리 유지 확인

---

## 📊 참고: 데이터베이스 테이블

### 필요한 테이블 (이미 존재해야 함)

```sql
-- agent_memories (메모리 저장)
-- agent_relationships (관계 관리)
-- agent_learnings (학습 내용)
-- agent_user_profiles (사용자 프로필) - jarvis-memory-manager용
-- agent_episodes (중요 이벤트) - 선택적
```

### 테이블 존재 확인
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'agent_%';
```

---

## ✅ 완료 기준

- [ ] 어제 대화 내용을 기억하고 있음
- [ ] "저번에 뭐 했지?"라고 물으면 대답 가능
- [ ] 복잡한 10단계 작업도 완료
- [ ] 도구 실패 시 자동 재시도
- [ ] GPT-4에서 Claude로 바꿔도 기억 유지
- [ ] (선택) 실행 중 진행 상황이 실시간으로 보임

---

## 📝 작업 로그

| 날짜 | 작업 내용 | 상태 |
|------|----------|------|
| 2026-01-20 | 로드맵 문서 상세 버전 작성 | ✅ 완료 |
| | | |
