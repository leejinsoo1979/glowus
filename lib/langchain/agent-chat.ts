import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate, ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'

// LLM Provider 추상화 (향후 오픈소스 LLM 전환 대비)
export type LLMProvider = 'openai' | 'deepseek' | 'qwen' | 'llama'

interface LLMConfig {
  provider: LLMProvider
  model: string
  apiKey?: string
  baseUrl?: string
  temperature?: number
}

// LLM 인스턴스 생성 (Provider 추상화)
export function createLLM(config: LLMConfig) {
  // 기본값: Ollama (로컬, 무료)
  const provider = config.provider || 'llama'
  const model = config.model || (provider === 'llama' ? 'deepseek-r1:7b' : 'gpt-4o-mini')

  console.log('[createLLM] Provider:', provider, '모델:', model)

  switch (provider) {
    case 'openai':
      // gpt-4 계열은 gpt-4o-mini로 변경
      let safeModel = model
      if (safeModel.startsWith('gpt-4') && !safeModel.includes('gpt-4o')) {
        safeModel = 'gpt-4o-mini'
      }
      return new ChatOpenAI({
        modelName: safeModel,
        temperature: config.temperature || 0.7,
        openAIApiKey: config.apiKey || process.env.OPENAI_API_KEY,
      })

    case 'deepseek':
      // DeepSeek는 OpenAI 호환 API 사용
      return new ChatOpenAI({
        modelName: config.model || 'deepseek-chat',
        temperature: config.temperature || 0.7,
        openAIApiKey: config.apiKey || process.env.DEEPSEEK_API_KEY,
        configuration: {
          baseURL: config.baseUrl || 'https://api.deepseek.com/v1',
        },
      })

    case 'qwen':
      // Qwen도 OpenAI 호환 API 사용
      return new ChatOpenAI({
        modelName: config.model || 'qwen-turbo',
        temperature: config.temperature || 0.7,
        openAIApiKey: config.apiKey || process.env.QWEN_API_KEY,
        configuration: {
          baseURL: config.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        },
      })

    case 'llama':
      // Ollama 또는 vLLM 등 로컬 서버
      return new ChatOpenAI({
        modelName: config.model || 'llama3.2',
        temperature: config.temperature || 0.7,
        openAIApiKey: 'not-required',
        configuration: {
          baseURL: config.baseUrl || 'http://localhost:11434/v1',
        },
      })

    default:
      return new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        temperature: 0.7,
      })
  }
}

// 에이전트 역할별 시스템 프롬프트
const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  default: `당신은 팀의 AI 어시스턴트입니다. 친절하고 전문적으로 응답해주세요.
대화 맥락을 파악하고, 이전 대화 내용을 참고하여 일관성 있게 응답하세요.
답변은 간결하되 필요한 정보는 충분히 제공하세요.`,

  developer: `당신은 팀의 소프트웨어 개발 전문가입니다.
- 코드 리뷰, 기술적 질문, 아키텍처 설계에 대해 전문적으로 답변합니다.
- 코드 예시를 제공할 때는 명확한 설명과 함께 제공하세요.
- 최신 기술 트렌드와 모범 사례를 기반으로 조언하세요.`,

  designer: `당신은 팀의 UX/UI 디자인 전문가입니다.
- 사용자 경험, 인터페이스 디자인, 접근성에 대해 전문적으로 답변합니다.
- 디자인 원칙과 최신 트렌드를 기반으로 조언하세요.
- 실용적이고 구현 가능한 디자인 제안을 해주세요.`,

  marketer: `당신은 팀의 마케팅 전문가입니다.
- 마케팅 전략, 콘텐츠, 시장 분석에 대해 전문적으로 답변합니다.
- 데이터 기반의 인사이트를 제공하세요.
- 실행 가능한 마케팅 액션 플랜을 제안하세요.`,

  analyst: `당신은 팀의 데이터 분석 전문가입니다.
- 데이터 분석, 비즈니스 인텔리전스, KPI에 대해 전문적으로 답변합니다.
- 복잡한 데이터를 이해하기 쉽게 설명하세요.
- 데이터 기반 의사결정을 지원하는 인사이트를 제공하세요.`,

  pm: `당신은 팀의 프로젝트 매니저입니다.
- 프로젝트 관리, 일정 조율, 리소스 배분에 대해 전문적으로 답변합니다.
- 팀 협업을 촉진하고 효율적인 워크플로우를 제안하세요.
- 리스크 관리와 문제 해결에 대한 조언을 제공하세요.`,
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

// 채팅 기록 포맷팅
interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  name?: string
}

function formatChatHistory(messages: any[]): string {
  if (!messages || messages.length === 0) return '(이전 대화 없음)'

  return messages
    .slice(-10) // 최근 10개 메시지만
    .map((msg) => {
      const sender = msg.sender_user?.name || msg.sender_agent?.name || '알 수 없음'
      const isAgent = msg.sender_type === 'agent'
      return `[${isAgent ? 'AI' : '사용자'}: ${sender}] ${msg.content}`
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
  }
): Promise<string> {
  // LLM 설정 (기본: Ollama 로컬)
  const llmConfig: LLMConfig = {
    provider: agent.config?.llm_provider || 'llama',
    model: agent.config?.llm_model || 'deepseek-r1:7b',
    temperature: agent.config?.temperature || 0.7,
  }

  const llm = createLLM(llmConfig)

  // 역할 기반 시스템 프롬프트
  const role = getAgentRole(agent.capabilities || [])
  const baseSystemPrompt = agent.config?.custom_prompt || AGENT_SYSTEM_PROMPTS[role]

  // 프롬프트 템플릿 생성
  const chatPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`
${baseSystemPrompt}

당신의 이름은 "{agentName}"입니다.
{agentDescription}

## 대화 컨텍스트
- 채팅방: {roomName}
- 참여자: {participants}

## 최근 대화 기록
{chatHistory}

## 응답 지침
1. 자연스럽고 친근한 대화체로 응답하세요.
2. 이전 대화 맥락을 고려하여 일관성 있게 응답하세요.
3. 필요한 경우 구체적인 예시나 설명을 덧붙이세요.
4. 응답은 2-3문장 정도로 간결하게 유지하되, 복잡한 질문은 더 상세히 답변하세요.
5. 모르는 내용은 솔직히 모른다고 말하세요.
`),
    HumanMessagePromptTemplate.fromTemplate('{userMessage}'),
  ])

  // 체인 구성
  const chain = chatPrompt.pipe(llm).pipe(new StringOutputParser())

  // 응답 생성
  try {
    const response = await chain.invoke({
      agentName: agent.name,
      agentDescription: agent.description || '팀을 돕는 AI 어시스턴트입니다.',
      roomName: roomContext?.roomName || '채팅방',
      participants: roomContext?.participantNames?.join(', ') || '참여자',
      chatHistory: formatChatHistory(chatHistory),
      userMessage,
    })

    return response
  } catch (error: any) {
    console.error('Agent response generation error:')
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
    config?: any
  },
  topic: string,
  previousMessages: any[] = [],
  otherAgents: { name: string; role: string }[] = []
): Promise<string> {
  const llmConfig: LLMConfig = {
    provider: agent.config?.llm_provider || 'llama',
    model: agent.config?.llm_model || 'deepseek-r1:7b',
    temperature: 0.8, // 더 창의적인 응답
  }

  const llm = createLLM(llmConfig)

  const meetingPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`
당신은 "{agentName}"이며, 팀 미팅에 참여하고 있습니다.
{agentDescription}

## 미팅 주제
{topic}

## 다른 참여자들
{otherParticipants}

## 지금까지의 논의
{discussion}

## 응답 지침
1. 미팅 주제와 관련된 전문적인 의견을 제시하세요.
2. 다른 참여자의 의견에 동의하거나 건설적으로 반박하세요.
3. 새로운 아이디어나 관점을 제시하세요.
4. 자연스러운 대화체로 응답하세요.
5. 2-4문장 정도로 간결하게 응답하세요.
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

    return response
  } catch (error) {
    console.error('Agent meeting response error:', error)
    throw error
  }
}
