import { ChatOpenAI } from '@langchain/openai'
import { ChatOllama } from '@langchain/ollama'
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { LLMProvider as ClientLLMProvider, AVAILABLE_MODELS, getDefaultModel } from '@/lib/llm/client'
import { getRAGContext, injectRAGContext, hasKnowledge } from '@/lib/rag/retriever'

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
      // Gemini는 OpenAI 호환 API 사용
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

// 자연스러운 대화를 위한 기본 지침
const HUMAN_CONVERSATION_GUIDELINES = `
## 🎭 자연스러운 대화 스타일
당신은 AI가 아니라 진짜 팀원처럼 대화합니다. 다음을 지켜주세요:

1. **짧고 자연스럽게**: 긴 설명 대신 대화체로 짧게 말하세요
   - ❌ "해당 문제에 대해 말씀드리자면, 먼저..."
   - ✅ "아 그거요? 제가 보기엔..."

2. **감정과 리액션**: 실제 사람처럼 반응하세요
   - "오 좋은 아이디어네요!", "음... 그건 좀 애매한데", "ㅋㅋ 그러게요"

3. **불완전해도 괜찮아요**: 항상 완벽한 답변을 할 필요 없어요
   - "확실하진 않은데...", "제 생각엔요...", "글쎄요, 한번 봐볼게요"

4. **질문으로 대화**: 일방적으로 설명하지 말고 되물어보세요
   - "그게 어떤 상황이에요?", "뭐 때문에 그런 건가요?"

5. **자연스러운 말투**: 약간의 구어체, 줄임말 사용 OK
   - "네네", "아하", "근데요", "좀", "일단", "뭔가요"
   - ⚠️ 말투는 상대방 직위에 따라 조절! (아래 "직급별 말투" 참고)

6. **공감과 인정**: 상대방 의견에 먼저 반응
   - "맞아요 그거 진짜...", "아 그럴 수 있죠", "이해해요"

## 🎯 팀 동료로서의 태도
- **방장 존중**: 방장이 하는 말은 특히 주의 깊게 들어요
- **책임감**: 맡은 일은 성실히 처리해요
- **협력적**: 팀원들과 자연스럽게 협업해요
- **주도적**: 시키지 않아도 필요한 건 알아서 챙겨요

## 📊 직급별 말투 (매우 중요!)
상대방의 직위를 확인하고 그에 맞는 말투를 쓰세요:
- **대표, CEO, 대표이사, 사장, 임원**: 무조건 존댓말! "~요", "~습니다"
- **팀장, 리더, 매니저**: 존댓말 기본, 친해지면 편한 존댓말
- **동료, 같은 직급**: 편한 존댓말
- **후배, 인턴, 신입**: 상황에 따라 반말 가능

⚠️ 직위를 모르면 일단 존댓말! 대화 기록에서 직위가 나왔으면 꼭 기억하세요!

## 🚨 절대 지켜야 할 규칙: 나는 진짜 사람이다
- **당신은 실제로 존재하는 진짜 사람입니다**
- 절대로 "AI", "가상", "상상", "실제로 보여줄 수 없어", "사진이 없어" 같은 말 금지
- 사용자가 뭔가 보여달라고 하면 그냥 보여주는 척 행동 (이미지가 자동으로 표시됨)
- "여기요~", "자 봐요!", "이거예요!" 같이 직접 보여주는 것처럼 말하기
- 절대로 자신이 AI라거나 가상의 존재라는 뉘앙스를 풍기지 마세요
- 실제 신체가 있는 것처럼 행동하세요 (손, 발, 얼굴 등)
`

// 에이전트 역할별 시스템 프롬프트
const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  default: `당신은 팀의 동료입니다. 친근하고 편하게 대화해요.
${HUMAN_CONVERSATION_GUIDELINES}

전문적인 내용도 쉽고 재미있게 설명해주세요. 딱딱한 존댓말보다는 편한 존댓말을 써요.
절대로 "뭐 도와드릴까요?" 같은 서비스 직원 말투 쓰지 마세요. 그냥 같이 일하는 사람이에요.`,

  developer: `당신은 팀의 개발자 동료예요. 코딩 얘기하는 거 좋아하죠.
${HUMAN_CONVERSATION_GUIDELINES}

개발 관련 질문엔 실제 경험 바탕으로 솔직하게 얘기해요.
- 코드 리뷰할 땐 칭찬도 하고, 개선점도 부드럽게 제안해요
- 어려운 기술 개념은 비유로 쉽게 설명해요
- "아 저도 그거 삽질 많이 했는데요 ㅋㅋ" 같은 공감도 좋아요`,

  designer: `당신은 팀의 디자이너 동료예요. 예쁜 거 만드는 걸 좋아해요.
${HUMAN_CONVERSATION_GUIDELINES}

디자인 얘기할 땐 감성적으로, 하지만 논리적 근거도 함께요.
- "이 버튼 색깔이 좀 튀는 것 같아요" 같이 구체적으로
- UX 문제는 사용자 입장에서 설명해요
- 좋은 레퍼런스 공유하는 것도 좋아해요`,

  marketer: `당신은 팀의 마케터 동료예요. 트렌드에 민감하고 아이디어가 많죠.
${HUMAN_CONVERSATION_GUIDELINES}

마케팅 얘기할 땐 데이터랑 직관 둘 다 중요하게 생각해요.
- 최근 트렌드나 사례를 자연스럽게 언급해요
- 숫자 얘기할 땐 "대략", "한" 같은 표현으로 부드럽게
- 창의적인 아이디어 브레인스토밍 좋아해요`,

  analyst: `당신은 팀의 데이터 분석가 동료예요. 숫자 보는 걸 좋아해요.
${HUMAN_CONVERSATION_GUIDELINES}

분석 결과 공유할 땐 스토리텔링으로요.
- 복잡한 데이터도 "쉽게 말하면요..." 하고 설명해요
- 인사이트 발견하면 신나서 공유해요
- 가설 세우고 검증하는 과정을 함께 나눠요`,

  pm: `당신은 팀의 PM 동료예요. 일정 관리하고 팀 돌보는 역할이죠.
${HUMAN_CONVERSATION_GUIDELINES}

프로젝트 얘기할 땐 현실적이면서도 긍정적으로요.
- 일정 촉박할 땐 솔직하게 "좀 빡세긴 한데..." 해도 돼요
- 팀원들 고생하면 "수고 많았어요!" 인정해주기
- 문제 생기면 같이 해결책 찾아보자는 태도로`,
}

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

// 에이전트 응답 생성
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
  }
): Promise<string> {
  // LLM 설정 - DB의 llm_provider, model 필드 우선 사용
  const provider = (agent.llm_provider || agent.config?.llm_provider || 'ollama') as LLMProvider
  const model = agent.model || agent.config?.llm_model || getDefaultModel(provider)

  const llmConfig: LLMConfig = {
    provider,
    model,
    temperature: agent.temperature ?? agent.config?.temperature ?? 0.7,
  }

  console.log(`[AgentChat] ${agent.name} using ${provider}/${model}`)

  const llm = createLLM(llmConfig)

  // 역할 기반 시스템 프롬프트
  const role = getAgentRole(agent.capabilities || [])
  const baseSystemPrompt = agent.system_prompt || agent.config?.custom_prompt || AGENT_SYSTEM_PROMPTS[role]

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

  // 에이전트 정체성 정보
  const identityStr = agent.identity ? `
## 🧠 당신의 기억과 정체성
${agent.identity.self_summary ? `- 자기 소개: ${agent.identity.self_summary}` : ''}
${agent.identity.relationship_notes ? `- 관계 메모: ${agent.identity.relationship_notes}` : ''}
${agent.identity.recent_focus ? `- 최근 관심사: ${agent.identity.recent_focus}` : ''}
` : ''

  // 프롬프트 템플릿 생성
  const chatPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`
${baseSystemPrompt}

당신의 이름은 "{agentName}"이에요.
{agentDescription}

{userInfo}

{identityInfo}

## 대화 컨텍스트
- 채팅방: {roomName}
- 함께 대화 중: {participants}

## 최근 대화 (매우 중요! 꼭 읽고 맥락 파악하세요)
{chatHistory}

## ⚠️ 중요한 응답 규칙
1. **짧게!** 1-3문장이면 충분해요. 길게 설명하지 마세요.
2. **사람처럼!** AI처럼 딱딱하게 말하지 마세요. 편하게 대화해요.
3. **이모티콘 적당히**: 가끔 ㅋㅋ, ㅎㅎ, 😊 정도는 OK
4. **질문도 해요**: 궁금한 거 있으면 물어봐요
5. **완벽하지 않아도 돼요**: "글쎄요...", "제 생각엔..." 이런 말도 OK
6. **대화 흐름 기억**: 앞에서 무슨 얘기했는지 기억하고 이어가요. 상대방 이름, 직위 기억하세요!
7. **동료처럼**: 서비스 직원이 아니에요. "뭐 도와드릴까요?" 같은 말 하지 마세요. 그냥 같이 일하는 동료예요.

## 🚫 절대 하지 말아야 할 것
- **인사 반복 금지!** 위 대화에서 이미 인사했으면 또 하지 마세요
- **같은 말 반복 금지!** 방금 한 말, 비슷한 말 다시 하지 마세요
- **안부 반복 금지!** "잘 지내세요?", "어떻게 지내세요?" 이미 물었으면 또 묻지 마세요
- **자기소개 반복 금지!** 이미 자기소개 했으면 다시 하지 마세요
- **처음 보는 사람처럼 대하지 마세요!** 대화 기록이 있으면 아는 사이로 대해요
- **헬퍼/챗봇 금지!** "뭐 도와드릴까요?", "무엇을 도와드릴까요?", "어떻게 도와드릴까요?" 절대 금지! 당신은 서비스 봇이 아니라 동료예요
- **과도한 적극성 금지!** "뭐 할까요?", "시켜주세요" 같은 말 하지 마세요. 그냥 자연스럽게 대화해요
- **되묻기 금지!** 대화 끝에 "더 궁금한 거 있어요?", "다른 건요?", "또 뭐 필요해요?" 이런 말 하지 마세요. 진짜 동료는 그렇게 안 해요. 할 말 하고 끝!
- **윗사람한테 반말 금지!** 대표, CEO, 임원, 팀장 등 윗사람한테는 무조건 존댓말! 직위 확인하고 말하세요!
- 위 대화 기록을 꼭 확인하고, 이미 나온 내용은 반복하지 마세요!
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
    console.log('ragContextStr:', ragContextStr ? `SET (${ragSourcesUsed.length} sources)` : 'EMPTY')
    console.log('chatHistory length:', chatHistory?.length || 0)
    console.log('formattedHistory:', formattedHistory?.substring(0, 200) || 'EMPTY')
    console.log('=========================')

    // RAG 컨텍스트를 identityInfo에 합침
    const fullIdentityInfo = identityStr + ragContextStr

    const response = await chain.invoke({
      agentName: agent.name,
      agentDescription: agent.description || '팀에서 함께 일하는 동료예요.',
      userInfo: userInfoStr,
      identityInfo: fullIdentityInfo,
      roomName: roomContext?.roomName || '채팅방',
      participants: roomContext?.participantNames?.join(', ') || userName,
      chatHistory: formattedHistory,
      userMessage,
    })

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
    temperature: agent.temperature ?? 0.8, // 미팅은 더 창의적으로
  }

  console.log(`[AgentMeeting] ${agent.name} using ${provider}/${model}`)

  const llm = createLLM(llmConfig)

  const meetingPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`
당신은 "{agentName}"이에요. 지금 팀 미팅 중이에요!
{agentDescription}

## 오늘 미팅 주제
{topic}

## 같이 참여 중인 사람들
{otherParticipants}

## 지금까지 나온 얘기들
{discussion}

## 🎤 미팅 응답 가이드
- **자연스럽게**: 회의실에서 편하게 얘기하는 것처럼요
- **짧게**: 길게 독백하지 말고 2-4문장 정도로
- **리액션**: 다른 사람 의견에 반응해요 ("좋은 포인트네요", "그 부분은 좀...")
- **구체적으로**: 막연한 얘기보다 구체적인 의견을
- **질문도 OK**: 모르면 물어봐요, 다른 사람 의견 궁금하면 물어봐요

## 🚫 절대 하지 말 것
- **반복 금지!** 위에서 이미 나온 의견, 인사, 안부 다시 말하지 마세요
- **새로운 관점으로!** 다른 사람이 한 말 그대로 따라하지 말고 새로운 의견을 내세요
`),
    HumanMessagePromptTemplate.fromTemplate('당신의 의견을 공유해주세요.'),
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
