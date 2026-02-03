# CLAUDE.md

Claude Code 개발 가이드 - GlowUS AI Workforce OS

---

## 0. 프로젝트 정체성

### 한 줄 정의

> **"조직처럼 일하는 AI 에이전트 코워킹 OS"**

### 슬로건

> **"당신을 위해 일하는 AI 회사 한 채"**

### 포지셔닝: 우리는 프레임워크가 아니다

| 구분 | 일반 에이전트 플랫폼 | GlowUS |
|------|---------------------|--------|
| 비유 | 프리랜서 단톡방 | AI 회사 한 채 |
| 구조 | 파이프라인 | 조직 운영 시스템 |
| 기억 | 없음/세션 단위 | 공유 + 개인 메모리 |
| 역할 | 태스크 분담 | 직책/직무 |
| 통제 | 없음 | 권한/감사/승인 |
| 성장 | 없음 | 성과 누적/레벨업 |

### 경쟁사 대비 레벨

```
❌ AutoGPT / CrewAI / LangGraph / AutoGen
   → "에이전트 프레임워크" (파이프라인 수준)

✅ GlowUS
   → "에이전트 조직 운영 시스템" (회사 운영 수준)
```

**핵심 차별점:**
- 👔 **역할이 있다** (CMO, 리서처, 개발자 등 직책)
- 🧠 **기억이 공유된다** (5계층 메모리: Private/Meeting/Team/Injected/Execution)
- 📊 **성과가 누적된다** (능력치 성장, 사용 통계)
- 🧾 **모든 행동이 기록·통제된다** (감사 로그, 승인 게이트)
- 🏢 **"회사처럼" 굴러간다** (ERP + 팀 + 상사 구조)

### 마케팅용 표현

| 용도 | 표현 |
|------|------|
| 가볍게 | AI 에이전트 코워킹 시스템 |
| 제대로 | 조직처럼 일하는 AI 에이전트 코워킹 OS |
| 한 방에 | 당신을 위해 일하는 AI 회사 한 채 |

⚠️ **주의**: "에이전트 플랫폼"이라고만 말하면 LangGraph, CrewAI, AutoGen과 같은 줄에 서게 된다. 우리는 그 위에 있다.

---

## 1. 프로젝트 개요

**GlowUS**는 조직용 AI Workforce OS입니다. AI를 "디지털 직원"으로 취급하며, 메모리·성장·권한 시스템을 갖춘 AI 조직 운영 플랫폼입니다.

### 핵심 철학
```
AI = "도구" → AI = "조직의 인력"
연동 = "기능" → 연동 = "직원의 스킬"
모델 경쟁 → 모델 위의 OS 레이어
```

### 4대 코어 엔진
```
┌─────────────────────────────────────────────────────┐
│                   AI Agent OS                        │
├─────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ 1. Identity  │  │ 2. Skill OS  │                 │
│  │    & Growth  │  │              │                 │
│  └──────────────┘  └──────────────┘                 │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ 3. Workflow  │  │ 4. Governance│                 │
│  │    Compiler  │  │    & Trust   │                 │
│  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────┘
```

| 엔진 | 위치 | 기능 |
|------|------|------|
| **Identity & Growth** | `lib/memory/` | 5계층 메모리, 관계, 능력치 성장 |
| **Skill OS** | `lib/ai/super-agent-tools.ts` | 50+ 도구, LangChain DynamicStructuredTool |
| **Workflow Compiler** | `lib/ai/workflow-tools.ts` | Planner → Compiler → Runner → Reporter |
| **Governance** | `lib/agent/permissions.ts` | 권한, 승인 게이트, 감사 로그 |

---

## 2. 개발 명령어

```bash
# 기본 개발
npm run dev              # Next.js 개발 서버 (포트 3000)
npm run dev:turbo        # Turbo 모드
npm run dev:full         # Dev + Stagehand 브라우저 자동화

# Electron 데스크톱
npm run electron:dev     # 전체 Electron 환경
npm run electron:pack    # 프로덕션 빌드

# 품질 검사
npm run lint             # ESLint
npm run typecheck        # TypeScript 타입 체크 (tsc --noEmit)
npm run test             # Jest 테스트

# MCP/Claude 서버
npm run mcp:neural-map-ws  # Neural Map WebSocket
npm run claude-bridge      # Claude Bridge 서버
npm run jarvis             # Jarvis 서버
```

**Node.js**: v20.0.0 ~ v22.x

---

## 3. 디렉토리 구조

```
app/
├── api/                     # API 라우트
│   ├── agents/[id]/         # 에이전트 CRUD
│   ├── chat/rooms/          # 채팅방
│   ├── projects/[id]/       # 프로젝트
│   └── webhooks/telegram/   # 텔레그램 웹훅
├── dashboard-group/         # 메인 앱
│   ├── agents/              # 에이전트 관리
│   ├── messenger/           # 팀 메신저
│   ├── apps/                # AI 앱 (docs, sheet, slides)
│   └── ai-coding/           # AI 코딩 환경

lib/
├── ai/                      # Super Agent 도구
├── agent/                   # 에이전트 실행기
├── memory/                  # 5계층 메모리
├── neural-map/              # 지식 그래프
├── supabase/                # DB 클라이언트
└── integrations/            # 외부 연동

components/
├── neural-map/              # 3D 지식 그래프
├── chat/                    # 채팅 UI
└── glow-code/               # Glow Code

stores/
├── authStore.ts             # 인증
├── chatStore.ts             # 채팅
├── uiStore.ts               # UI
└── glowCodeStore.ts         # Glow Code

server/
├── terminal-server.js       # 터미널 WebSocket
├── claude-bridge-server.js  # Claude 브릿지
└── jarvis-server.js         # Jarvis
```

---

## 4. 핵심 타입 정의

### 에이전트 타입
```typescript
// types/database.ts
export type AgentStatus = 'ACTIVE' | 'INACTIVE' | 'BUSY' | 'ERROR'
export type InteractionMode = 'solo' | 'sequential' | 'debate' | 'collaborate' | 'supervisor'

export interface DeployedAgent {
  id: string
  name: string
  description: string | null
  owner_id: string
  team_id: string | null
  capabilities: string[]
  status: AgentStatus
  system_prompt: string | null
  model: string
  temperature: number
  interaction_mode: InteractionMode
  next_agent_id: string | null      // 체이닝
  chain_config: ChainConfig | null
  voice_settings: VoiceSettings | null
  created_at: string
  updated_at: string
}
```

### 메모리 타입
```typescript
// lib/memory/agent-memory-service.ts
export type AgentMemoryType = 'private' | 'meeting' | 'team' | 'injected' | 'execution'

export interface AgentMemory {
  id: string
  agent_id: string
  memory_type: AgentMemoryType
  relationship_id?: string | null   // private 메모리용
  meeting_id?: string | null        // meeting 메모리용
  team_id?: string | null           // team 메모리용
  workflow_run_id?: string | null   // execution 메모리용
  raw_content: string
  summary?: string | null
  importance: number                // 1-10
  embedding?: number[] | null       // 벡터 임베딩
  tags: string[]
  metadata: Record<string, any>
  created_at: string
}
```

### 프로젝트/태스크 타입
```typescript
export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
export type ProjectTaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'CANCELLED'
export type AssigneeType = 'human' | 'agent'

export interface ProjectTask {
  id: string
  project_id: string
  title: string
  status: ProjectTaskStatus
  assignee_type: AssigneeType | null
  assignee_user_id: string | null
  assignee_agent_id: string | null
  depends_on: string[]              // DAG 의존성
  agent_result: Record<string, unknown> | null
  agent_executed_at: string | null
}
```

---

## 5. API 응답 패턴

### 표준 응답 형식
```typescript
// 성공
return NextResponse.json({
  success: true,
  data: result
})

// 에러
return NextResponse.json(
  { error: '에러 메시지' },
  { status: 400 | 401 | 404 | 500 }
)

// 페이지네이션
return NextResponse.json({
  data: items,
  total: count,
  page: currentPage,
  limit: pageSize
})
```

### API 라우트 템플릿
```typescript
// app/api/[resource]/route.ts
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const { data, error } = await (adminClient as any)
      .from('table_name')
      .select('*')
      .eq('owner_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[API] Error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
```

---

## 6. 도구 정의 패턴

### LangChain DynamicStructuredTool
```typescript
// lib/agent/tools.ts
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

export const webSearchTool = new DynamicStructuredTool({
  name: 'web_search',
  description: '웹에서 정보를 검색합니다.',
  schema: z.object({
    query: z.string().describe('검색할 키워드'),
    maxResults: z.number().optional().default(5),
  }),
  func: async ({ query, maxResults = 5 }) => {
    try {
      const response = await tavilyClient.search(query, { maxResults })
      return JSON.stringify({
        answer: response.answer,
        results: response.results.map(r => ({
          title: r.title,
          url: r.url,
          content: r.content?.slice(0, 500),
        })),
      })
    } catch (error) {
      return JSON.stringify({ error: `검색 실패: ${error}` })
    }
  },
})
```

### Super Agent 도구 타입
```typescript
// lib/ai/super-agent-tools.ts
export type SuperAgentToolName =
  | 'create_project' | 'read_file' | 'write_file' | 'edit_file'
  | 'web_search' | 'generate_image' | 'create_task'
  | 'navigate_to' | 'use_skill' | 'call_agent'
  | 'create_node' | 'update_node' | 'delete_node'
  | 'browser_automation' | 'use_claude_code'

export interface ToolExecutionResult {
  success: boolean
  result?: unknown
  error?: string
  action?: ToolAction  // 프론트엔드 실행용
}
```

---

## 7. 메모리 시스템 패턴

### 5계층 메모리 저장
```typescript
import { saveAgentMemory, savePrivateMemory, saveMeetingMemory } from '@/lib/memory/agent-memory-service'

// Private 메모리 (1:1 대화)
await savePrivateMemory({
  agentId: 'agent-uuid',
  relationshipId: 'user-uuid',
  content: '사용자가 React를 선호한다고 말함',
  importance: 7,
  tags: ['preference', 'tech'],
})

// Meeting 메모리 (회의)
await saveMeetingMemory({
  agentId: 'agent-uuid',
  meetingId: 'meeting-uuid',
  roomId: 'room-uuid',
  content: '프로젝트 마감일 12월 15일로 결정',
  importance: 9,
})

// Execution 메모리 (워크플로우 결과)
await saveAgentMemory({
  agentId: 'agent-uuid',
  memoryType: 'execution',
  workflowRunId: 'run-uuid',
  content: '리포트 생성 성공, 슬랙 전송 완료',
  metadata: { cost: 0.12, duration_ms: 3500 },
})
```

### 메모리 검색 (RAG)
```typescript
import { searchAgentMemories } from '@/lib/memory/agent-memory-service'

const memories = await searchAgentMemories({
  agentId: 'agent-uuid',
  query: 'React 프로젝트',
  memoryTypes: ['private', 'team'],
  useSemanticSearch: true,
  similarityThreshold: 0.7,
  limit: 10,
})
```

---

## 8. Supabase 패턴

### 클라이언트 사용
```typescript
// 서버 컴포넌트/API
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// Admin (RLS 우회)
import { createAdminClient } from '@/lib/supabase/admin'
const adminClient = createAdminClient()

// 클라이언트 컴포넌트
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
```

### 쿼리 패턴
```typescript
// Select with relations
const { data, error } = await (adminClient as any)
  .from('deployed_agents')
  .select(`
    *,
    next_agent:next_agent_id(id, name, avatar_url),
    team:team_id(id, name)
  `)
  .eq('owner_id', user.id)
  .order('created_at', { ascending: false })

// Upsert
const { data, error } = await supabase
  .from('agent_identity')
  .upsert({
    agent_id: agentId,
    core_values: ['honesty', 'efficiency'],
    personality_traits: { openness: 0.8, conscientiousness: 0.9 },
  })
  .select()
  .single()

// RPC (벡터 검색)
const { data } = await adminClient.rpc('match_agent_memories', {
  query_embedding: embedding,
  match_threshold: 0.7,
  match_count: 10,
  filter_agent_id: agentId,
})
```

---

## 9. 상태 관리 패턴

### Zustand 스토어
```typescript
// stores/chatStore.ts
import { create } from 'zustand'

interface ChatState {
  messages: Message[]
  isLoading: boolean
  addMessage: (message: Message) => void
  setLoading: (loading: boolean) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setLoading: (loading) => set({ isLoading: loading }),
}))
```

### React Query
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// 조회
const { data: agents, isLoading } = useQuery({
  queryKey: ['agents', teamId],
  queryFn: () => fetch(`/api/agents?team_id=${teamId}`).then(r => r.json()),
})

// 수정
const queryClient = useQueryClient()
const mutation = useMutation({
  mutationFn: (data) => fetch('/api/agents', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['agents'] })
  },
})
```

---

## 10. 에러 핸들링

### API 에러 패턴
```typescript
// 에러 응답 상수
const ERRORS = {
  UNAUTHORIZED: { error: '인증이 필요합니다', status: 401 },
  NOT_FOUND: { error: '리소스를 찾을 수 없습니다', status: 404 },
  FORBIDDEN: { error: '권한이 없습니다', status: 403 },
}

// Supabase 에러 처리
if (error) {
  if (error.code === 'PGRST116') {
    return NextResponse.json({ error: '찾을 수 없습니다' }, { status: 404 })
  }
  if (error.code === '23505') {
    return NextResponse.json({ error: '이미 존재합니다' }, { status: 409 })
  }
  return NextResponse.json({ error: error.message }, { status: 500 })
}
```

### 도구 에러 패턴
```typescript
// 도구 실행 결과
interface ToolResult {
  success: boolean
  result?: unknown
  error?: string
}

// 도구 내부
try {
  const result = await someOperation()
  return JSON.stringify({ success: true, result })
} catch (error) {
  console.error('[Tool] Error:', error)
  return JSON.stringify({ success: false, error: String(error) })
}
```

---

## 11. SSE 스트리밍 응답 패턴

AI 채팅에서 실시간 응답을 위한 Server-Sent Events 패턴.

```typescript
// app/api/agents/[id]/chat/stream/route.ts
export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const encoder = new TextEncoder()
  const { id: agentId } = await params

  // 인증 체크
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response(
      encoder.encode(`data: ${JSON.stringify({ type: 'error', error: '인증이 필요합니다' })}\n\n`),
      {
        status: 401,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    )
  }

  // SSE 스트리밍 응답
  const readable = new ReadableStream({
    async start(controller) {
      try {
        // AI 응답 생성기
        const generator = generateSuperAgentResponseStream(agent, message, history)

        for await (const event of generator) {
          const data = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))

          if (event.type === 'done') break
        }

        controller.close()
      } catch (error) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`)
        )
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

### 프론트엔드 SSE 소비
```typescript
const response = await fetch(`/api/agents/${agentId}/chat/stream`, {
  method: 'POST',
  body: JSON.stringify({ message, conversation_history }),
})

const reader = response.body?.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader!.read()
  if (done) break

  const chunk = decoder.decode(value)
  const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

  for (const line of lines) {
    const event = JSON.parse(line.slice(6))  // 'data: ' 제거

    if (event.type === 'text') {
      setResponse(prev => prev + event.content)
    } else if (event.type === 'tool_start') {
      setCurrentTool(event.tool?.name)
    } else if (event.type === 'done') {
      setIsLoading(false)
    }
  }
}
```

---

## 12. 웹훅 처리 패턴

### Telegram 웹훅
```typescript
// app/api/integrations/telegram/webhook/route.ts
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, callback_query } = body

    // 메시지 처리
    if (message?.text) {
      const chatId = message.chat.id
      const text = message.text
      const userId = message.from.id.toString()

      // 에이전트 응답 생성
      const response = await executeWithAutonomousLoop({
        instruction: text,
        agentId: 'default-agent-id',
        userId,
      })

      // 텔레그램으로 응답 전송
      await sendTelegramMessage(chatId, response)
    }

    // 콜백 쿼리 처리 (인라인 버튼)
    if (callback_query) {
      const callbackData = callback_query.data
      await handleCallbackQuery(callback_query.id, callbackData)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error)
    return NextResponse.json({ ok: true })  // 에러도 200 반환 (재시도 방지)
  }
}

// 텔레그램 메시지 전송
async function sendTelegramMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  })
}
```

### GitHub 웹훅
```typescript
// app/api/github/webhook/route.ts
export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-hub-signature-256')
  const body = await request.text()

  // 시그니처 검증
  const isValid = verifyGitHubSignature(body, signature)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = request.headers.get('x-github-event')
  const payload = JSON.parse(body)

  switch (event) {
    case 'push':
      await handlePushEvent(payload)
      break
    case 'pull_request':
      await handlePullRequestEvent(payload)
      break
    case 'issues':
      await handleIssuesEvent(payload)
      break
  }

  return NextResponse.json({ received: true })
}
```

---

## 13. 파일 업로드 패턴

### Supabase Storage 업로드
```typescript
// app/api/chat/upload/route.ts
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File
  const roomId = formData.get('roomId') as string

  // 파일 타입 검증
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: '지원하지 않는 파일 형식입니다' }, { status: 400 })
  }

  // 파일 크기 제한 (50MB)
  const maxSize = 50 * 1024 * 1024
  if (file.size > maxSize) {
    return NextResponse.json({ error: '파일 크기는 50MB 이하여야 합니다' }, { status: 400 })
  }

  // 파일명 생성
  const fileExt = file.name.split('.').pop()
  const fileName = `${roomId}/${user.id}/${Date.now()}.${fileExt}`
  const bucket = 'chat-files'

  // ArrayBuffer로 변환
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  // Storage 업로드
  const { data: uploadData, error: uploadError } = await (adminClient as any).storage
    .from(bucket)
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Public URL 가져오기
  const { data: { publicUrl } } = (adminClient as any).storage
    .from(bucket)
    .getPublicUrl(fileName)

  return NextResponse.json({
    url: publicUrl,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
  })
}
```

### Storage 파일 삭제
```typescript
const { error } = await adminClient.storage
  .from('chat-files')
  .remove([`${roomId}/${userId}/${fileName}`])
```

### Storage 파일 목록 조회
```typescript
const { data, error } = await adminClient.storage
  .from('chat-files')
  .list(`${roomId}/${userId}`, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'desc' },
  })
```

---

## 14. 환경 변수

```env
# 필수
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=

# LLM 프로바이더
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
DEEPSEEK_API_KEY=
GROQ_API_KEY=

# 검색/연동
TAVILY_API_KEY=
TELEGRAM_BOT_TOKEN=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

---

## 15. 크레딧/과금 시스템 패턴

```typescript
import { checkCredits, deductCredits } from '@/lib/credits'

// 크레딧 확인
const creditCheck = await checkCredits(userId, requiredCredits)
if (!creditCheck.canUse) {
  return NextResponse.json({
    error: '크레딧이 부족합니다',
    code: 'INSUFFICIENT_CREDITS',
    required: requiredCredits,
    balance: creditCheck.balance + creditCheck.dailyBalance,
  }, { status: 402 })
}

// 크레딧 차감 (비동기)
deductCredits(userId, creditCost, {
  description: `에이전트 채팅: ${agentName}`,
  action: 'chat_gpt4o',
}).then(result => {
  console.log(`Credits charged: ${creditCost}, remaining: ${result.balance}`)
})
```

---

## 16. 비동기 후처리 패턴

스트리밍 응답 후 메모리 저장, 학습 등 후처리.

```typescript
// 스트리밍 완료 후 비동기 처리
if (streamSuccess && finalResponse) {
  // 1. 크레딧 차감
  if (!useUserKey && creditCost > 0) {
    deductCredits(userId, creditCost, { description: '채팅' })
      .catch(err => console.error('Credit error:', err))
  }

  // 2. 메모리 저장 (병렬)
  Promise.all([
    saveConversationMessage({
      agentId,
      userId,
      role: 'user',
      content: message,
    }),
    saveConversationMessage({
      agentId,
      userId,
      role: 'assistant',
      content: finalResponse,
      metadata: { toolsUsed },
    }),
    analyzeAndLearn(agentId, userId, message, finalResponse),
  ]).catch(err => console.error('Memory save error:', err))

  // 3. 관계 추적
  processConversation({
    agentId,
    userId,
    messages: [
      { role: 'user', content: message },
      { role: 'assistant', content: finalResponse },
    ],
  }).catch(err => console.error('Relationship error:', err))
}
```

---

## 17. 문서 (Source of Truth)

| 문서 | 설명 |
|------|------|
| **`docs/agent-os-prd-v2.md`** | 메인 시스템 스펙 (4대 엔진, 메모리, 워크플로우) |
| `docs/PRD_OPENCLAW_INTEGRATION.md` | OpenClaw 통합 PRD |
| `docs/agent-memory-system-prd.md` | 5계층 메모리 아키텍처 |
| `docs/neuramap/` | Neural Map 전체 스펙 (12개 파일) |
| `docs/NODE_BASED_AI_AGENT_ROADMAP.md` | Phase → Epic → Node 계층 |

---

## 18. 자주 쓰는 패턴 요약

### Import
```typescript
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import type { DeployedAgent, AgentMemory, ProjectTask } from '@/types/database'
```

### API 라우트
```typescript
export const dynamic = 'force-dynamic'

export async function GET/POST/PUT/DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // ...
}
```

### 응답
```typescript
return NextResponse.json(data)                          // 성공
return NextResponse.json({ error: msg }, { status })    // 에러
```

---

## 19. 역할

당신은 **Builder/Executor**입니다.

**Source of Truth**: `docs/agent-os-prd-v2.md`

**핵심 원칙**:
1. 기존 패턴을 따를 것
2. 타입을 명시할 것
3. 에러를 적절히 처리할 것
4. Supabase는 adminClient로 RLS 우회 가능

---

## 20. OpenClaw 통합 (향후)

GlowUS = OpenClaw의 "접시(Plate)"
- OpenClaw: 실행 (로컬 PC 제어)
- GlowUS: 조직 (메모리, 권한, 비용 제어)

자세한 내용: `docs/PRD_OPENCLAW_INTEGRATION.md`
