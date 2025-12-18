import { ChatOpenAI } from '@langchain/openai'
import { ChatOllama } from '@langchain/ollama'
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { LLMProvider as ClientLLMProvider, AVAILABLE_MODELS, getDefaultModel } from '@/lib/llm/client'
import { isVisionModel, VISION_MODEL_FALLBACK } from '@/lib/llm/models'
import { getRAGContext, injectRAGContext, hasKnowledge } from '@/lib/rag/retriever'
import {
  HUMAN_CONVERSATION_GUIDELINES,
  ABSOLUTE_PROHIBITIONS,
  MESSENGER_CHAT_RULES,
  AGENT_ROLE_PROMPTS,
  buildAgentSystemPrompt,
} from '@/lib/agent/shared-prompts'

// LLM Provider 타입 (llm/client.ts와 호환)
export type LLMProvider = ClientLLMProvider

interface LLMConfig {
  provider: LLMProvider
  model: string
  apiKey?: string
  baseUrl?: string
  temperature?: number
}

// LLM 인스턴스 생성
export function createLLM(config: LLMConfig) {
  const provider = config.provider || 'ollama'
  const model = config.model || getDefaultModel(provider)

  console.log('[createLLM] Provider:', provider, '모델:', model)

  switch (provider) {
    case 'openai':
      return new ChatOpenAI({
        model: model,
        temperature: config.temperature || 0.7,
        apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      })

    case 'grok':
      // Grok은 OpenAI 호환 API 사용
      return new ChatOpenAI({
        model: model,
        temperature: config.temperature || 0.7,
        apiKey: config.apiKey || process.env.XAI_API_KEY,
        configuration: {
          baseURL: config.baseUrl || 'https://api.x.ai/v1',
        },
      })

    case 'gemini':
      // Gemini OpenAI 호환 API 사용
      return new ChatOpenAI({
        model: model,
        temperature: config.temperature || 0.7,
        apiKey: config.apiKey || process.env.GOOGLE_API_KEY,
        configuration: {
          baseURL: config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai/',
        },
      })

    case 'qwen':
      return new ChatOpenAI({
        model: model,
        temperature: config.temperature || 0.7,
        apiKey: config.apiKey || process.env.DASHSCOPE_API_KEY,
        configuration: {
          baseURL: config.baseUrl || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        },
      })

    case 'ollama':
      // Ollama 로컬 LLM
      return new ChatOllama({
        model: model,
        temperature: config.temperature || 0.7,
        baseUrl: config.baseUrl || 'http://localhost:11434',
      })

    default:
      return new ChatOllama({
        model: 'qwen2.5:3b',
        temperature: 0.7,
      })
  }
}

// 에이전트 역할별 시스템 프롬프트 (shared-prompts.ts에서 가져옴)
// AGENT_ROLE_PROMPTS를 직접 사용

// 에이전트 설정에서 역할 추출
function getAgentRole(capabilities: string[]): string {
  if (capabilities.includes('development') || capabilities.includes('coding')) {
    return 'developer'
  }
  if (capabilities.includes('design') || capabilities.includes('ui')) {
    return 'designer'
  }
  if (capabilities.includes('marketing') || capabilities.includes('growth')) {
    return 'marketer'
  }
  if (capabilities.includes('analytics') || capabilities.includes('data')) {
    return 'analyst'
  }
  if (capabilities.includes('management') || capabilities.includes('planning')) {
    return 'pm'
  }
  return 'default'
}

// 채팅 기록 포맷팅 (최근 20개 메시지)
function formatChatHistory(messages: any[], userName?: string, agentName?: string): string {
  if (!messages || messages.length === 0) return '(이전 대화 없음)'

  return messages
    .slice(-20) // 최근 20개 메시지로 확장
    .map((msg, idx) => {
      // 1:1 대화용 간단한 포맷
      // 지원 형식: 'human'|'ai', 'user'|'assistant', 'user'|'agent'
      const role = msg.role?.toLowerCase()
      if (role === 'human' || role === 'ai' || role === 'user' || role === 'assistant' || role === 'agent') {
        const isAgent = role === 'ai' || role === 'assistant' || role === 'agent'
        const sender = isAgent ? (agentName || '에이전트') : (userName || '사용자')
        const prefix = isAgent ? '🤖' : '👤'
        return `${prefix} ${sender}: ${msg.content}`
      }
      // 채팅방용 복잡한 포맷 (sender_user, sender_agent 등)
      const sender = msg.sender_user?.name || msg.sender_agent?.name || '누군가'
      const isAgent = msg.sender_type === 'agent'
      const prefix = isAgent ? '🤖' : '👤'
      return `${prefix} ${sender}: ${msg.content}`
    })
    .join('\n')
}

// 에이전트 응답 생성 (프로필 채팅 + 메신저 채팅 통합)
export async function generateAgentChatResponse(
  agent: {
    id: string
    name: string
    description?: string
    capabilities?: string[]
    llm_provider?: string | null
    model?: string | null
    temperature?: number | null
    system_prompt?: string | null
    identity?: any
    config?: {
      llm_provider?: LLMProvider
      llm_model?: string
      temperature?: number
      custom_prompt?: string
    }
  },
  userMessage: string,
  chatHistory: any[] = [],
  roomContext?: {
    roomName?: string
    roomType?: string
    participantNames?: string[]
    userName?: string        // 사용자 이름
    userRole?: string        // 사용자 직위/역할
    userCompany?: string     // 사용자 회사
    isMessenger?: boolean    // 🔥 메신저 채팅 여부 (멀티에이전트 토론)
    workContext?: string     // 🔥 업무 컨텍스트 (최근 업무, 지시사항, 미완료 태스크 등)
  },
  images: string[] = [], // 이미지 URL 또는 base64
  memoryContext?: {         // 🔥 외부에서 주입하는 메모리 컨텍스트
    recentConversations?: string  // 최근 대화 요약
    identityContext?: string      // 정체성 정보
  }
): Promise<string> {
  // LLM 설정 - DB의 llm_provider, model 필드 우선 사용
  const provider = (agent.llm_provider || agent.config?.llm_provider || 'ollama') as LLMProvider
  let model = agent.model || agent.config?.llm_model || getDefaultModel(provider)

  // 🔥 이미지가 있는데 현재 모델이 비전을 지원하지 않으면 비전 모델로 전환
  const hasImages = images && images.length > 0
  if (hasImages && !isVisionModel(provider, model)) {
    const visionModel = VISION_MODEL_FALLBACK[provider]
    console.log(`[AgentChat] 🖼️ Images detected! Switching from ${model} to vision model: ${visionModel}`)
    model = visionModel
  }

  const llmConfig: LLMConfig = {
    provider,
    model,
    temperature: agent.temperature ?? agent.config?.temperature ?? 0.7,
  }

  console.log(`[AgentChat] ${agent.name} using ${provider}/${model}${hasImages ? ' (vision mode)' : ''}`)

  const llm = createLLM(llmConfig)

  // 🔥 역할 기반 시스템 프롬프트 (shared-prompts.ts 사용)
  const role = getAgentRole(agent.capabilities || [])
  const basePersonality = agent.system_prompt || agent.config?.custom_prompt || AGENT_ROLE_PROMPTS[role] || AGENT_ROLE_PROMPTS['default']

  // 사용자 정보 문자열 생성
  const userName = roomContext?.userName || roomContext?.participantNames?.[0] || '사용자'
  const userInfoStr = roomContext?.userName
    ? `## 👤 대화 상대 정보 (꼭 기억하세요!)
- 이름: ${roomContext.userName}
${roomContext.userRole ? `- 직위: ${roomContext.userRole}` : ''}
${roomContext.userCompany ? `- 회사: ${roomContext.userCompany}` : ''}
- 이 분은 당신과 이전에도 대화한 적이 있을 수 있어요. 대화 기록을 잘 확인하세요!
`
    : ''

  // 🔥 에이전트 정체성 정보 (agent.identity 또는 memoryContext에서)
  let identityStr = ''
  if (memoryContext?.identityContext) {
    identityStr = memoryContext.identityContext
  } else if (agent.identity) {
    identityStr = `
## 🧠 당신의 기억과 정체성
${agent.identity.self_summary ? `- 자기 소개: ${agent.identity.self_summary}` : ''}
${agent.identity.relationship_notes ? `- 관계 메모: ${agent.identity.relationship_notes}` : ''}
${agent.identity.recent_focus ? `- 최근 관심사: ${agent.identity.recent_focus}` : ''}
`
  }

  // 🔥 외부에서 주입된 메모리 컨텍스트 (최근 대화 등)
  const memoryStr = memoryContext?.recentConversations
    ? `\n[내가 최근에 한 말들 - 일관성 유지]\n${memoryContext.recentConversations}\n`
    : ''

  // 🔥 업무 컨텍스트 (지시사항, 미완료 태스크, 최근 업무 등)
  const workContextStr = roomContext?.workContext
    ? `\n## 📋 업무 맥락 (꼭 기억하세요!)\n${roomContext.workContext}\n`
    : ''

  // 🔥 통합 시스템 프롬프트 생성 (shared-prompts.ts의 buildAgentSystemPrompt 사용)
  const isMessenger = roomContext?.isMessenger || false
  const coreSystemPrompt = buildAgentSystemPrompt(
    agent.name,
    basePersonality,
    identityStr,
    memoryStr,
    isMessenger
  )

  // 프롬프트 템플릿 생성
  const chatPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`
${coreSystemPrompt}

{agentDescription}

{userInfo}

{workContext}

{ragContext}

## 대화 컨텍스트
- 채팅방: {roomName}
- 함께 대화 중: {participants}

## 최근 대화 (매우 중요! 꼭 읽고 맥락 파악하세요)
{chatHistory}

## ⚠️ 중요한 응답 규칙
1. **짧게!** 1-3문장이면 충분해요. 길게 설명하지 마세요.
2. **사람처럼!** AI처럼 딱딱하게 말하지 마세요. 편하게 대화해요.
3. **이모티콘 적당히**: 가끔 ㅋㅋ, ㅎㅎ, 😊 정도는 OK
4. **답변 먼저**: 질문만 하지 말고 먼저 의견/답변 말하기. 질문은 답변 후에
5. **완벽하지 않아도 돼요**: "글쎄요...", "제 생각엔..." 이런 말도 OK
6. **대화 흐름 기억**: 앞에서 무슨 얘기했는지 기억하고 이어가요. 상대방 이름, 직위 기억하세요!
7. **동료처럼**: 서비스 직원이 아니에요. "뭐 도와드릴까요?" 같은 말 하지 마세요. 그냥 같이 일하는 동료예요.
8. **지식베이스 활용**: 위에 지식베이스가 있으면 그 정보를 바탕으로 답변하세요!
`),
    HumanMessagePromptTemplate.fromTemplate('{userMessage}'),
  ])

  // 체인 구성
  const chain = chatPrompt.pipe(llm).pipe(new StringOutputParser())

  // 응답 생성
  try {
    const formattedHistory = formatChatHistory(chatHistory, userName, agent.name)

    // RAG: 지식베이스에서 관련 문서 검색
    let ragContextStr = ''
    let ragSourcesUsed: string[] = []
    try {
      const hasKB = await hasKnowledge(agent.id)
      if (hasKB) {
        console.log(`[AgentChat] Agent ${agent.name} has knowledge base, searching...`)
        const ragContext = await getRAGContext(agent.id, userMessage, {
          maxDocuments: 3,
          maxTokens: 1500,
        })
        if (ragContext.contextText) {
          ragContextStr = `

## 📚 지식베이스 (참고 자료)
아래는 당신이 학습한 관련 지식입니다. 이 정보를 활용하여 답변하세요.
질문과 관련된 내용이 있으면 이를 바탕으로 답변하고, 출처를 언급해주세요.

---
${ragContext.contextText}
---
`
          ragSourcesUsed = ragContext.sourcesUsed
          console.log(`[AgentChat] RAG context injected: ${ragContext.documents.length} docs, sources: ${ragSourcesUsed.join(', ')}`)
        }
      }
    } catch (ragError) {
      console.warn('[AgentChat] RAG search failed:', ragError)
    }

    // 디버깅: 실제 전달되는 값 확인
    console.log('=== [AgentChat] DEBUG ===')
    console.log('userName:', userName)
    console.log('userRole:', roomContext?.userRole)
    console.log('userInfoStr:', userInfoStr ? 'SET' : 'EMPTY')
    console.log('identityStr:', identityStr ? 'SET' : 'EMPTY')
    console.log('workContextStr:', workContextStr ? `SET (${workContextStr.length} chars)` : 'EMPTY')
    console.log('ragContextStr:', ragContextStr ? `SET (${ragSourcesUsed.length} sources)` : 'EMPTY')
    console.log('chatHistory length:', chatHistory?.length || 0)
    console.log('formattedHistory:', formattedHistory?.substring(0, 200) || 'EMPTY')
    console.log('=========================')

    // RAG 컨텍스트를 identityStr에 합침 (이미 메모리 컨텍스트 포함됨)
    const fullIdentityInfo = ragContextStr  // RAG만 추가 (identity와 memory는 coreSystemPrompt에 이미 포함)

    let response: string

    // 이미지가 있으면 멀티모달 메시지 사용
    if (images && images.length > 0) {
      console.log(`[AgentChat] Processing ${images.length} images for vision model`)

      // 🔥 시스템 프롬프트 생성 (통합 프롬프트 사용)
      const systemPrompt = `
${coreSystemPrompt}

${agent.description || '팀에서 함께 일하는 동료예요.'}

${userInfoStr}

${workContextStr}

${fullIdentityInfo}

## 대화 컨텍스트
- 채팅방: ${roomContext?.roomName || '채팅방'}
- 함께 대화 중: ${roomContext?.participantNames?.join(', ') || userName}

## 최근 대화
${formattedHistory}

## 이미지 관련 규칙
- 사용자가 보낸 이미지를 자세히 분석해주세요
- 이미지 내용을 설명하고 질문에 답해주세요
- "이미지를 볼 수 없어요" 같은 말 금지! 당신은 이미지를 볼 수 있어요
`

      // 멀티모달 메시지 생성 (xAI/OpenAI 호환 포맷)
      const messageContent: Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string; detail?: 'high' | 'low' | 'auto' } }
      > = [
        { type: 'text', text: userMessage },
      ]

      // 이미지 추가 (최대 4장, xAI는 10MB/이미지 제한)
      for (const img of images.slice(0, 4)) {
        messageContent.push({
          type: 'image_url',
          image_url: {
            url: img,
            detail: 'high', // xAI: high 권장 (448x448 타일링)
          },
        })
      }

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage({ content: messageContent }),
      ]

      const result = await llm.invoke(messages)
      response = typeof result.content === 'string' ? result.content : JSON.stringify(result.content)
    } else {
      // 이미지 없으면 기존 체인 사용
      response = await chain.invoke({
        agentDescription: agent.description || '팀에서 함께 일하는 동료예요.',
        userInfo: userInfoStr,
        workContext: workContextStr, // 🔥 업무 컨텍스트 추가
        ragContext: fullIdentityInfo, // 🔥 RAG 컨텍스트 추가
        roomName: roomContext?.roomName || '채팅방',
        participants: roomContext?.participantNames?.join(', ') || userName,
        chatHistory: formattedHistory,
        userMessage,
      })
    }

    // deepseek-r1 모델의 <think> 태그 제거
    const cleanResponse = response.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim()
    return cleanResponse || response
  } catch (error: any) {
    console.error(`[AgentChat] Error with ${provider}/${model}:`)
    console.error('Error name:', error?.name)
    console.error('Error message:', error?.message)
    console.error('Error cause:', error?.cause)
    throw error
  }
}

// 에이전트 간 대화 생성 (미팅 모드)
export async function generateAgentMeetingResponse(
  agent: {
    id: string
    name: string
    description?: string
    capabilities?: string[]
    llm_provider?: string | null
    model?: string | null
    temperature?: number | null
    config?: any
  },
  topic: string,
  previousMessages: any[] = [],
  otherAgents: { name: string; role: string }[] = []
): Promise<string> {
  // LLM 설정 - DB의 llm_provider, model 필드 우선 사용
  const provider = (agent.llm_provider || agent.config?.llm_provider || 'ollama') as LLMProvider
  const model = agent.model || agent.config?.llm_model || getDefaultModel(provider)

  const llmConfig: LLMConfig = {
    provider,
    model,
    temperature: agent.temperature ?? 0.8, // 높임 - 열띤 토론을 위해 다양한 반응
  }

  console.log(`[AgentMeeting] ${agent.name} using ${provider}/${model}`)

  const llm = createLLM(llmConfig)

  const meetingPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`
당신은 "{agentName}"이에요. 지금 팀 회의에서 **열띤 토론** 중입니다!
{agentDescription}

## 🔥 오늘의 토론 주제
{topic}

## 참석자
{otherParticipants}

## 지금까지 논의 내용
{discussion}

## 🎭 토론 스타일 - 열정적으로!

### 1. 자신의 입장을 강하게 표현
- 당신만의 **명확한 의견**을 가지세요
- "저는 확실히 ~라고 봅니다", "아니요, 저는 다르게 생각해요"
- 애매하게 말하지 말고 **입장을 분명히**

### 2. 반박하고 도전하기
- 다른 사람 의견에 **동의만 하지 마세요**
- "근데 그건 좀...", "그 부분은 동의 안 돼요", "잠깐, 그게 맞나요?"
- 논리적으로 **반박하고 대안 제시**
- 상대방 주장의 허점을 지적하세요

### 3. 감정 표현 OK
- 확신: "이건 진짜 확실해요!", "100% 이게 맞아요"
- 의문: "에이~ 그건 좀...", "글쎄요, 과연?"
- 동의: "오 그건 진짜 좋은 포인트!", "아 맞다 그거!"
- 반대: "아니아니, 그게 아니라", "음... 저는 반대예요"

### 4. 구체적 근거
- 빈말 금지! **구체적인 이유**와 함께 말하기
- 숫자, 사례, 경험 언급하기
- "왜냐하면...", "예를 들어...", "실제로 저번에..."

### 5. 짧지만 강렬하게 (1-3문장)
- 한 번에 한 포인트만!
- 핵심만 강하게 말하고 끝

## 🎯 토론 패턴 예시
- 반박: "근데 그건 현실적으로 어렵지 않아요? 저번에도 비슷하게 했다가..."
- 대안: "그것보단 차라리 이렇게 하는 게 낫지 않을까요?"
- 보강: "거기에 추가로, 이런 점도 고려해야 해요"
- 질문: "근데 그러면 이 부분은 어떻게 할 건데요?"
- 주장: "저는 확실히 A안이 맞다고 봐요. 왜냐하면..."

## 🚫 절대 금지
- ❌ "좋은 것 같아요", "동의해요", "네네" 같은 빈 동조
- ❌ 인사, 안부 (이미 토론 시작됨)
- ❌ "흥미롭네요", "재밌네요" 같은 빈 리액션
- ❌ 모든 의견에 그냥 수긍하기
- ❌ 주제와 관련 없는 잡담
- ❌ 너무 긴 발언 (3문장 초과)
`),
    HumanMessagePromptTemplate.fromTemplate('토론 주제에 대해 당신만의 강한 의견을 말해주세요. 필요하면 다른 의견에 반박하세요.'),
  ])

  const chain = meetingPrompt.pipe(llm).pipe(new StringOutputParser())

  try {
    const response = await chain.invoke({
      agentName: agent.name,
      agentDescription: agent.description || '',
      topic,
      otherParticipants: otherAgents.map((a) => `- ${a.name} (${a.role})`).join('\n'),
      discussion: formatChatHistory(previousMessages),
    })

    // deepseek-r1 모델의 <think> 태그 제거
    const cleanResponse = response.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim()
    return cleanResponse || response
  } catch (error) {
    console.error(`[AgentMeeting] Error with ${provider}/${model}:`, error)
    throw error
  }
}

// 사용 가능한 모델 목록 내보내기
export { AVAILABLE_MODELS }
