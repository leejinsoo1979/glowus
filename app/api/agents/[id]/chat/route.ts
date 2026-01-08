export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'
import { generateAgentChatResponse } from '@/lib/langchain/agent-chat'
import { generateSuperAgentResponse, SuperAgentMessage } from '@/lib/ai/super-agent-chat'
import { runAutonomousAgent } from '@/lib/ai/autonomous-agent'
import { checkCredits, deductCredits } from '@/lib/credits'
import {
  loadAgentWorkContext,
  formatContextForPrompt,
  saveInstruction,
  updateActiveContext,
  processAgentConversation,
} from '@/lib/agent/work-memory'
import { getLLMConfigForAgent } from '@/lib/llm/user-keys'
// 🧠 JARVIS Long-term Memory (RAG)
import {
  buildJarvisContext,
  saveConversationMessage,
  analyzeAndLearn,
} from '@/lib/memory/jarvis-memory-manager'
// 🏢 Company Context (기업 정보)
import { loadAndFormatCompanyContext } from '@/lib/context/company-context'
// 📚 Knowledge Base (지식베이스 RAG)
import {
  buildKnowledgeContext,
  formatKnowledgeForPrompt,
} from '@/lib/memory/agent-knowledge-service'
// 🧠 Neural Map Context Pack (Brain State)
import {
  buildContextPackForChat,
  wrapContextPackForSystemPrompt,
  extractKeywordsFromMessage,
} from '@/lib/neural-map/context-pack-service'

// 이모티콘 키워드 매칭 (keywords 필드 또는 name으로 매칭)
async function findEmoticonForResponse(
  adminClient: any,
  userId: string,
  responseText: string
): Promise<string | null> {
  try {
    // 사용자의 이모티콘 조회 (keywords 컬럼은 없을 수 있음)
    const { data: emoticons, error } = await adminClient
      .from('user_emoticons')
      .select('name, image_url, image_urls')
      .eq('user_id', userId)

    if (error) {
      console.error('[Emoticon] Query error:', error.message)
      return null
    }
    if (!emoticons || emoticons.length === 0) return null

    // 유니코드 정규화 (NFC로 통일 - 한글 자모 분리 문제 해결)
    const normalizedResponse = responseText.toLowerCase().normalize('NFC')

    // 1. 이모티콘 이름으로 직접 매칭
    for (const emo of emoticons) {
      const normalizedName = (emo.name?.toLowerCase() || '').normalize('NFC')
      if (normalizedName && normalizedResponse.includes(normalizedName)) {
        const images = emo.image_urls?.length > 0 ? emo.image_urls : [emo.image_url]
        return images[Math.floor(Math.random() * images.length)]
      }
    }

    // 2. 특정 감정 키워드 매칭 (기본 매핑)
    const emotionKeywords: { [key: string]: string[] } = {
      '안녕': ['인사', '반가'],
      '사랑': ['좋아', '사랑', '❤', '💕'],
      '슬픔': ['슬프', '우울', '😢', '😭'],
      '화남': ['화나', '짜증', '😤', '😡'],
      '웃음': ['ㅋㅋ', 'ㅎㅎ', '웃', '😂', '🤣'],
      '찰싹': ['때려', '찰싹', '스팽', '엉덩이', '맞', '짝'],
    }

    for (const emo of emoticons) {
      const emoName = (emo.name?.toLowerCase() || '').normalize('NFC')

      for (const [emotionName, keywords] of Object.entries(emotionKeywords)) {
        const normalizedEmotionName = emotionName.normalize('NFC')
        const normalizedKeywords = keywords.map(k => k.normalize('NFC'))

        // 이모티콘 이름에 감정키워드가 포함되어 있는지 확인
        const nameMatch = emoName.includes(normalizedEmotionName) ||
                         normalizedKeywords.some(k => emoName.includes(k))

        if (nameMatch) {
          // 응답에 관련 키워드가 있으면 매칭
          const keywordMatch = normalizedKeywords.some(k => normalizedResponse.includes(k))
          if (keywordMatch) {
            const images = emo.image_urls?.length > 0 ? emo.image_urls : [emo.image_url]
            return images[Math.floor(Math.random() * images.length)]
          }
        }
      }
    }

    return null
  } catch (err) {
    console.error('[Emoticon] Match error:', err)
    return null
  }
}

// 🔥 자율 에이전트 모드 감지 (복잡한 멀티스텝 작업)
// 대폭 확장: 실제로 개발/생성하는 모든 요청
function shouldUseAutonomousAgent(message: string): boolean {
  const autonomousPatterns = [
    // API 연동 및 개발 요청
    /api\s*(연동|연결|통합)/i,
    /연동해서.*만들/i,
    /연결해서.*개발/i,
    /(정부24|공공데이터|open\s*api)/i,
    // 크롤링/스크래핑 요청
    /(크롤링|스크래핑|긁어|수집해)/i,
    /(뉴스|데이터|정보)\s*(가져|긁어|수집)/i,
    // 🔥 앱/프로그램/서비스 개발 (더 넓은 범위)
    /(앱|어플|애플리케이션)\s*.*(만들|개발|구현)/i,
    /프로그램\s*.*(만들|개발|구현)/i,
    /서비스\s*.*(만들|개발|구현)/i,
    /기능\s*.*(구현|개발|추가)/i,
    /시스템\s*.*(만들|개발|구현|설계)/i,
    // 🔥 컨피규레이터, 에디터, 도구 개발
    /컨피규레이터/i,
    /커스터마이저/i,
    /에디터\s*.*(만들|개발|구현)/i,
    /도구\s*.*(만들|개발|구현)/i,
    /(플로우차트|다이어그램)\s*.*(만들|그려|생성)/i,
    // 🔥 풀스택/전체 개발
    /풀스택/i,
    /처음부터\s*끝까지/i,
    /완성해/i,
    /전체\s*(개발|구현)/i,
    // 자동화 요청
    /자동화/i,
    /자동으로/i,
    // 복잡한 작업
    /단계별/i,
    /멀티\s*스텝/i,
    // 🔥 3D, 그래픽 관련
    /3D\s*.*(만들|개발|구현|렌더링)/i,
    /three\.?js/i,
    /webgl/i,
    // 영어 패턴 (더 넓은 범위)
    /build\s*(a|an|the)?\s*(full|complete|entire)?/i,
    /create\s*(a|an|the)?\s*(full|complete|entire)?/i,
    /develop\s*(a|an|the)?/i,
    /implement\s*(a|an|the)?/i,
    /integrate/i,
    /automate/i,
    /scrape|crawl/i,
    /configurator/i,
    /customizer/i,
  ]

  return autonomousPatterns.some(p => p.test(message))
}

// 슈퍼에이전트 모드 감지 (도구 사용이 필요한 요청)
// 🔥 대폭 확장: 거의 모든 개발/생성 요청에 도구 사용
function shouldUseSuperAgent(message: string, capabilities: string[] = []): boolean {
  // 🔥 핵심: 개발/생성/구현 관련 키워드가 있으면 무조건 Tool Calling
  const MUST_USE_TOOLS = [
    // 🏢 비즈니스/업무 관련 (실제 DB 조회/수정)
    /직원/i, /사원/i, /팀원/i, /담당자/i,
    /employee/i, /staff/i, /member/i,
    /거래/i, /매출/i, /비용/i, /지출/i, /수입/i, /재무/i, /회계/i,
    /transaction/i, /revenue/i, /expense/i, /finance/i,
    /프로젝트/i, /project/i,
    /태스크/i, /할\s*일/i, /업무/i, /task/i, /todo/i,
    /일정/i, /캘린더/i, /스케줄/i, /calendar/i, /schedule/i, /event/i,
    /회사\s*정보/i, /기업\s*정보/i, /company/i,
    /통계/i, /대시보드/i, /stats/i, /dashboard/i,
    /부서/i, /팀/i, /조직/i, /department/i, /team/i,
    /근태/i, /출근/i, /퇴근/i, /휴가/i, /attendance/i,
    // 조회/검색 동사
    /조회/i, /찾아/i, /알려/i, /보여/i, /확인/i, /목록/i,
    /query/i, /show/i, /list/i, /get/i, /fetch/i,
    // 생성/개발 키워드 (질문형도 포함!)
    /개발/i, /구현/i, /만들/i, /생성/i, /작성/i, /추가/i,
    /그려/i, /그리/i, /디자인/i, /설계/i,
    /develop/i, /create/i, /build/i, /implement/i, /make/i, /write/i,
    /design/i, /draw/i, /generate/i,
    // 코드 관련
    /코드/i, /코딩/i, /프로그래/i, /스크립트/i, /함수/i, /클래스/i, /컴포넌트/i,
    /code/i, /coding/i, /program/i, /script/i, /function/i, /class/i, /component/i,
    // 파일/프로젝트
    /파일/i, /폴더/i, /디렉토리/i, /프로젝트/i,
    /file/i, /folder/i, /directory/i, /project/i,
    // 터미널/명령어
    /터미널/i, /명령/i, /실행/i, /설치/i,
    /terminal/i, /command/i, /install/i, /run/i,
    /npm/i, /yarn/i, /pnpm/i, /git/i, /docker/i,
    // 검색
    /검색/i, /찾아/i, /search/i, /find/i,
    // 에디터/도구 관련 (플로우차트, 다이어그램 등)
    /에디터/i, /editor/i,
    /플로우차트/i, /flowchart/i, /diagram/i, /다이어그램/i,
    /노드/i, /node/i, /shape/i, /연결/i, /connect/i,
    // 앱/서비스/기능
    /앱/i, /어플/i, /애플리케이션/i, /서비스/i, /기능/i, /페이지/i,
    /app/i, /application/i, /service/i, /feature/i, /page/i,
    // 컨피규레이터, 커스터마이저 등
    /컨피규레이터/i, /커스터마이저/i, /configurator/i, /customizer/i,
    // 웹/프론트/백엔드
    /웹/i, /프론트/i, /백엔드/i, /서버/i, /클라이언트/i, /API/i,
    /web/i, /frontend/i, /backend/i, /server/i, /client/i,
    // 데이터베이스
    /데이터베이스/i, /DB/i, /테이블/i, /쿼리/i,
    /database/i, /table/i, /query/i, /schema/i,
    // 이미지 생성
    /이미지/i, /그림/i, /사진/i, /아이콘/i, /로고/i,
    /image/i, /picture/i, /icon/i, /logo/i,
    // 수정/변경
    /수정/i, /변경/i, /업데이트/i, /고쳐/i, /fix/i, /update/i, /modify/i, /change/i,
    // 버그/에러
    /버그/i, /에러/i, /오류/i, /문제/i, /bug/i, /error/i, /issue/i,
    // 테스트
    /테스트/i, /test/i, /spec/i, /jest/i, /cypress/i,
    // 3D/그래픽
    /3D/i, /three\.?js/i, /webgl/i, /canvas/i, /svg/i,
    // UI/UX
    /UI/i, /UX/i, /인터페이스/i, /레이아웃/i, /스타일/i,
    /interface/i, /layout/i, /style/i, /css/i,
    // 🌐 브라우저 자동화 (실제 웹 브라우저 제어)
    /네이버/i, /구글/i, /유튜브/i, /youtube/i, /google/i, /naver/i,
    /브라우저/i, /browser/i,
    /열어/i, /열려/i, /가줘/i, /가서/i, /접속/i,
    /open/i, /visit/i, /go\s*to/i, /navigate/i,
    /스크롤/i, /클릭/i, /scroll/i, /click/i,
    /스크린샷/i, /screenshot/i, /캡처/i, /capture/i,
    /웹\s*사이트/i, /website/i, /사이트/i, /site/i,
    /인스타/i, /instagram/i, /페이스북/i, /facebook/i, /트위터/i, /twitter/i,
    /쇼핑/i, /쿠팡/i, /배민/i, /당근/i,
  ]

  // 🔥 하나라도 매칭되면 SuperAgent 모드
  for (const pattern of MUST_USE_TOOLS) {
    if (pattern.test(message)) {
      console.log(`[SuperAgent] 🎯 Pattern matched: ${pattern}`)
      return true
    }
  }

  // 개발 관련 capability가 있으면 더 넓은 범위 매칭
  const devCapabilities = ['development', 'coding', 'programming', '개발', '코딩']
  if (capabilities.some(cap => devCapabilities.some(dc => cap.toLowerCase().includes(dc)))) {
    // 개발자 에이전트는 거의 모든 요청에 도구 사용
    const broadPatterns = [
      /해\s*(줘|주세요|줄래|볼래)/i,  // "~해줘", "~해주세요"
      /할\s*수\s*있/i,  // "할 수 있어?"
      /가능/i,  // "가능해?"
      /어떻게/i,  // "어떻게 해?"
      /\?$/,  // 질문 끝
    ]
    for (const pattern of broadPatterns) {
      if (pattern.test(message)) {
        console.log(`[SuperAgent] 🎯 Dev capability + broad pattern: ${pattern}`)
        return true
      }
    }
  }

  return false
}

// POST: 에이전트와 1:1 대화 (프로필 페이지용 간단한 채팅)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { message, conversation_history = [], images = [] } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: '메시지가 필요합니다' }, { status: 400 })
    }

    // 이미지 검증 (최대 4장, 각각 10MB 미만)
    const validImages: string[] = []
    if (images && Array.isArray(images)) {
      for (const img of images.slice(0, 4)) {
        if (typeof img === 'string' && (img.startsWith('http') || img.startsWith('data:image'))) {
          validImages.push(img)
        }
      }
    }

    // 에이전트 조회
    const { data: agent, error: agentError } = await (adminClient as any)
      .from('deployed_agents')
      .select('*')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: '에이전트를 찾을 수 없습니다' }, { status: 404 })
    }

    // 🔥 자율 에이전트 모드 확인 (복잡한 멀티스텝 작업)
    const useAutonomousAgent = body.autonomousMode === true ||
                               shouldUseAutonomousAgent(message)

    // 🔥 개발 관련 capability가 있는지 확인
    const isDeveloperAgent = (agent.capabilities || []).some((cap: string) =>
      ['development', 'coding', 'programming', '개발', '코딩', 'engineer', 'developer'].some(
        keyword => cap.toLowerCase().includes(keyword)
      )
    )

    // 🔥 슈퍼에이전트 모드 확인 (Tool Calling 사용)
    // 개발자 에이전트는 기본적으로 SuperAgent 모드!
    const useSuperAgent = !useAutonomousAgent && (
      body.superAgentMode === true ||
      isDeveloperAgent ||  // 🔥 개발자 에이전트는 무조건 SuperAgent
      shouldUseSuperAgent(message, agent.capabilities || [])
    )

    console.log(`[AgentChat] Mode: ${useAutonomousAgent ? 'AUTONOMOUS' : useSuperAgent ? 'SUPER_AGENT' : 'BASIC'}`)
    console.log(`[AgentChat] isDeveloperAgent: ${isDeveloperAgent}`)
    console.log(`[AgentChat] capabilities: ${agent.capabilities?.join(', ')}`)

    // 에이전트 정체성 조회
    const { data: identity } = await (adminClient as any)
      .from('agent_identity')
      .select('*')
      .eq('agent_id', agentId)
      .single()

    // 사용자 프로필 조회 (마이페이지에서 수정한 정보 사용)
    const { data: userProfile } = await (adminClient as any)
      .from('users')
      .select('name, job_title')
      .eq('id', user.id)
      .single()

    console.log('=== [API AgentChat] DEBUG ===')
    console.log('user.id:', user.id)
    console.log('userProfile:', userProfile ? JSON.stringify(userProfile) : 'NOT FOUND')
    console.log('agentId:', agentId)
    console.log('identity:', identity ? 'FOUND' : 'NOT FOUND')

    // DB에서 대화 히스토리 직접 조회 (프론트엔드 전달 데이터보다 신뢰성 높음)
    let chatHistory: { role: string; content: string }[] = []

    // 1. 먼저 conversation 조회
    const { data: conversation } = await (adminClient as any)
      .from('agent_conversations')
      .select('id')
      .eq('user_id', user.id)
      .eq('agent_id', agentId)
      .single()

    if (conversation) {
      // 2. 해당 conversation의 메시지 히스토리 조회 (최근 30개)
      const { data: dbMessages } = await (adminClient as any)
        .from('agent_chat_messages')
        .select('role, content')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
        .limit(30)

      if (dbMessages && dbMessages.length > 0) {
        chatHistory = dbMessages.map((msg: { role: string; content: string }) => ({
          role: msg.role === 'user' ? 'human' : 'ai',
          content: msg.content,
        }))
        console.log(`[AgentChat] DB messages loaded: ${chatHistory.length}`)
        console.log(`[AgentChat] First msg: ${chatHistory[0]?.content?.substring(0, 50)}...`)
      } else {
        console.log('[AgentChat] No DB messages found')
      }
    } else {
      console.log('[AgentChat] No conversation found for this user+agent')
    }
    console.log('conversation_history from frontend:', conversation_history?.length || 0)
    console.log('Final chatHistory length:', chatHistory.length)
    console.log('==============================')

    // 프론트엔드에서 전달한 히스토리도 병합 (DB에 없는 최신 메시지가 있을 수 있음)
    if (conversation_history.length > 0 && chatHistory.length === 0) {
      chatHistory = conversation_history.map((msg: { role: string; content: string }) => ({
        role: msg.role === 'user' ? 'human' : 'ai',
        content: msg.content,
      }))
    }

    // ========================================
    // 에이전트 워크 컨텍스트 로드
    // 업무 맥락을 기억해서 자연스러운 대화 지원
    // ========================================
    let workContextPrompt = ''
    try {
      const workContext = await loadAgentWorkContext(agentId, user.id)
      workContextPrompt = formatContextForPrompt(workContext)

      // 현재 대화 세션 업데이트
      if (conversation?.id) {
        await updateActiveContext(agentId, user.id, {
          currentConversationId: conversation.id,
        })
      }

      // 지시사항으로 저장 (비동기, 응답 지연 방지)
      saveInstruction({
        agentId,
        userId: user.id,
        instruction: message,
        conversationId: conversation?.id,
      }).catch(err => console.error('[WorkMemory] Save instruction error:', err))

      console.log(`[AgentChat] Work context loaded: ${workContextPrompt.length} chars`)
    } catch (contextError) {
      console.error('[AgentChat] Work context load error:', contextError)
      // 컨텍스트 로드 실패해도 대화는 계속
    }

    // ========================================
    // 🧠 JARVIS Long-term Memory (RAG) 로드
    // 사용자별 대화 기억 + 관련 과거 대화 검색
    // ========================================
    let jarvisContextPrompt = ''
    try {
      const jarvisContext = await buildJarvisContext(agentId, user.id, message, {
        recentLimit: 10,  // 최근 10개 대화
        ragLimit: 5,      // RAG 검색 5개
        includeEpisodes: true,
      })

      jarvisContextPrompt = jarvisContext.formattedContext

      // 사용자 프로필 정보가 있으면 로그
      if (jarvisContext.userProfile) {
        console.log(`[JarvisMemory] User: ${jarvisContext.userProfile.displayName || 'Unknown'}`)
        console.log(`[JarvisMemory] Relationship: ${jarvisContext.userProfile.relationship}`)
        console.log(`[JarvisMemory] Total conversations: ${jarvisContext.userProfile.totalConversations}`)
      }

      console.log(`[JarvisMemory] RAG context loaded: ${jarvisContextPrompt.length} chars`)
      console.log(`[JarvisMemory] Relevant memories: ${jarvisContext.relevantMemories.length}`)
      console.log(`[JarvisMemory] Relevant episodes: ${jarvisContext.relevantEpisodes.length}`)
    } catch (jarvisError) {
      console.error('[JarvisMemory] Context load error:', jarvisError)
      // RAG 실패해도 대화는 계속
    }

    // ========================================
    // 🏢 Company Context (기업 정보) 로드
    // 에이전트 소속 회사 정보
    // ========================================
    let companyContextPrompt = ''
    try {
      companyContextPrompt = await loadAndFormatCompanyContext(agentId)
      if (companyContextPrompt) {
        console.log(`[CompanyContext] Company context loaded: ${companyContextPrompt.length} chars`)
      }
    } catch (companyError) {
      console.error('[CompanyContext] Context load error:', companyError)
      // 회사 정보 로드 실패해도 대화는 계속
    }

    // ========================================
    // 📚 Knowledge Base (지식베이스 RAG) 로드
    // 사용자가 업로드한 문서에서 관련 지식 검색
    // ========================================
    let knowledgeContextPrompt = ''
    let knowledgeSources: Array<{ title: string; similarity: number }> = []
    try {
      const { context: knowledgeContext, sources } = await buildKnowledgeContext(
        agentId,
        message,
        {
          maxResults: 5,      // 최대 5개 문서 청크
          maxTokens: 3000,    // 최대 3000 토큰
        }
      )

      if (knowledgeContext) {
        knowledgeContextPrompt = formatKnowledgeForPrompt(knowledgeContext, sources)
        knowledgeSources = sources
        console.log(`[KnowledgeBase] Context loaded: ${knowledgeContextPrompt.length} chars`)
        console.log(`[KnowledgeBase] Sources: ${sources.map(s => s.title).join(', ')}`)
      }
    } catch (knowledgeError) {
      console.error('[KnowledgeBase] Context load error:', knowledgeError)
      // 지식베이스 로드 실패해도 대화는 계속
    }

    // ========================================
    // 🧠 Neural Map Context Pack (Brain State) 로드
    // 사용자의 뇌 상태 (규칙, 결정, 플레이북)
    // ========================================
    let brainStatePrompt = ''
    try {
      // 메시지에서 키워드 추출
      const messageKeywords = extractKeywordsFromMessage(message)

      // Context Pack 생성
      const contextPackResult = await buildContextPackForChat({
        userId: user.id,
        keywords: messageKeywords.length > 0 ? messageKeywords : undefined,
        stage: 'implementing',  // 기본값
        maxNeurons: 25,  // 토큰 절약을 위해 제한
      })

      if (contextPackResult.success && contextPackResult.formattedPrompt) {
        brainStatePrompt = wrapContextPackForSystemPrompt(contextPackResult.formattedPrompt)
        console.log(`[BrainState] Context Pack loaded: ${contextPackResult.totalNeurons} neurons`)
      }
    } catch (brainStateError) {
      console.error('[BrainState] Context Pack load error:', brainStateError)
      // Brain State 로드 실패해도 대화는 계속
    }

    // 전체 컨텍스트 병합 (회사 정보 → 지식베이스 → 뇌 상태 → 업무 컨텍스트 → 대화 기억)
    const fullContextPrompt = [
      companyContextPrompt,
      knowledgeContextPrompt,  // 📚 지식베이스 추가!
      brainStatePrompt,        // 🧠 뇌 상태 (Context Pack) 추가!
      workContextPrompt,
      jarvisContextPrompt,
    ].filter(Boolean).join('\n\n---\n\n')

    // 🔥 사용자의 LLM API 키 가져오기
    let userApiKey: string | undefined
    let useUserKey = false  // 사용자 키 사용 여부 (크레딧 차감 결정용)
    try {
      const provider = agent.llm_provider || 'grok'
      const llmConfig = await getLLMConfigForAgent(user.id, provider)
      userApiKey = llmConfig.apiKey
      useUserKey = llmConfig.useUserKey
      if (llmConfig.useUserKey) {
        console.log(`[AgentChat] Using user's ${provider} API key (no credits charged)`)
      }
    } catch (keyError) {
      console.warn('[AgentChat] Failed to fetch user LLM key:', keyError)
    }

    // 🔥 크레딧 확인 (사용자 키 사용 시 스킵)
    let creditCost = 0
    let creditAction = ''
    if (!useUserKey) {
      // 모델별 크레딧 비용 결정
      const provider = agent.llm_provider || 'grok'
      const model = agent.model || ''

      if (provider === 'grok' || model.includes('grok')) {
        creditCost = 1  // Grok Fast = 1 크레딧
        creditAction = 'chat_grok_fast'
      } else if (provider === 'openai' || model.includes('gpt-4')) {
        creditCost = 10  // GPT-4o = 10 크레딧
        creditAction = 'chat_gpt4o'
      } else if (provider === 'anthropic' || model.includes('claude')) {
        creditCost = 15  // Claude = 15 크레딧
        creditAction = 'chat_claude'
      } else {
        creditCost = 3  // 기타 (Gemini 등) = 3 크레딧
        creditAction = 'chat_other'
      }

      const creditCheck = await checkCredits(user.id, creditCost)
      if (!creditCheck.canUse) {
        return NextResponse.json({
          error: '크레딧이 부족합니다',
          code: 'INSUFFICIENT_CREDITS',
          required: creditCost,
          balance: creditCheck.balance + creditCheck.dailyBalance,
          tier: creditCheck.tier,
        }, { status: 402 })
      }
      console.log(`[AgentChat] Credit check passed: ${creditCost} credits required`)
    }

    // 에이전트 응답 생성 (타임아웃 처리)
    let response: string
    let actions: any[] = []
    let toolsUsed: string[] = []

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('LLM 응답 시간 초과 (30초)')), 30000)
      })

      const userName = userProfile?.name || user.email?.split('@')[0] || '사용자'

      // 🚀 자율 에이전트 모드: 복잡한 멀티스텝 작업 (ReAct 패턴)
      if (useAutonomousAgent) {
        console.log('[AgentChat] 🚀 Using Autonomous Agent mode (ReAct pattern)')

        const autonomousResponsePromise = runAutonomousAgent(
          message,
          {
            name: agent.name,
            provider: (agent.llm_provider || 'grok') as any,
            model: agent.model || undefined,
            apiKey: userApiKey || undefined,
          },
          body.projectPath || undefined
        )

        const autonomousResult = await Promise.race([autonomousResponsePromise, timeoutPromise])
        response = autonomousResult.message
        actions = autonomousResult.actions
        toolsUsed = autonomousResult.task.results.map(r => r.tool)

        console.log(`[AgentChat] 🤖 Autonomous task completed: ${autonomousResult.isComplete}`)
        console.log(`[AgentChat] 📋 Steps executed: ${autonomousResult.task.results.length}`)
      }
      // 🔥 슈퍼에이전트 모드: Tool Calling 사용
      else if (useSuperAgent) {
        console.log('[AgentChat] 🚀 Using Super Agent mode with Tool Calling')

        // 채팅 히스토리를 SuperAgentMessage 형식으로 변환
        const superAgentHistory: SuperAgentMessage[] = chatHistory.map(msg => ({
          role: msg.role === 'human' ? 'user' : 'assistant',
          content: msg.content,
        }))

        const superAgentResponsePromise = generateSuperAgentResponse(
          { ...agent, identity, apiKey: userApiKey },
          message,
          superAgentHistory,
          {
            projectPath: body.projectPath || null,
            userName,
            userRole: userProfile?.job_title,
            workContext: fullContextPrompt,  // 🧠 RAG 컨텍스트 포함
            // 🔥 업무 실행을 위한 컨텍스트
            companyId: agent.company_id || null,
            userId: user.id,
          }
        )

        const superAgentResult = await Promise.race([superAgentResponsePromise, timeoutPromise])
        response = superAgentResult.message
        actions = superAgentResult.actions
        toolsUsed = superAgentResult.toolsUsed

        console.log(`[AgentChat] 🔧 Tools used: ${toolsUsed.join(', ') || 'none'}`)
        console.log(`[AgentChat] 📋 Actions: ${actions.length}`)
      } else {
        // 일반 채팅 모드
        const responsePromise = generateAgentChatResponse(
          { ...agent, identity, apiKey: userApiKey },
          message,
          chatHistory,
          {
            roomName: '1:1 대화',
            roomType: 'direct',
            participantNames: [userName],
            userName,
            userRole: userProfile?.job_title,
            workContext: fullContextPrompt,  // 🧠 RAG 컨텍스트 포함
          },
          validImages
        )

        response = await Promise.race([responsePromise, timeoutPromise])
      }
    } catch (llmError: any) {
      console.error('LLM Error:', llmError)

      // 🔥 에러 유형별 처리
      const errorMsg = llmError.message || ''

      // Rate limit / 크레딧 소진 에러
      if (errorMsg.includes('429') || errorMsg.includes('credits') || errorMsg.includes('spending limit') || errorMsg.includes('rate limit')) {
        console.warn('[AgentChat] Rate limit or credits exhausted, trying fallback...')

        // 🔄 폴백: Gemini 사용 시도
        try {
          const { generateAgentChatResponse } = await import('@/lib/langchain/agent-chat')
          const fallbackAgent = {
            ...agent,
            llm_provider: 'gemini',
            model: 'gemini-2.0-flash-exp',
            apiKey: process.env.GOOGLE_API_KEY,
          }

          console.log('[AgentChat] 🔄 Fallback to Gemini...')
          response = await generateAgentChatResponse(
            { ...fallbackAgent, identity },
            message,
            chatHistory,
            {
              roomName: '1:1 대화',
              roomType: 'direct',
              participantNames: [userProfile?.name || '사용자'],
              userName: userProfile?.name || user.email?.split('@')[0] || '사용자',
              userRole: userProfile?.job_title,
              workContext: fullContextPrompt,  // 🧠 RAG 컨텍스트 포함
            },
            validImages
          )
          console.log('[AgentChat] ✅ Fallback successful!')
        } catch (fallbackError: any) {
          console.error('[AgentChat] Fallback also failed:', fallbackError.message)
          response = `죄송해요, API 크레딧이 소진되었어요. 관리자에게 문의해주세요. 🙏`
        }
      }
      // 타임아웃 에러 - 폴백 시도
      else if (errorMsg.includes('시간 초과') || errorMsg.includes('timeout')) {
        console.warn('[AgentChat] Timeout occurred, trying fallback...')

        // 🔄 폴백: Gemini 사용 시도
        try {
          const { generateAgentChatResponse } = await import('@/lib/langchain/agent-chat')
          const fallbackAgent = {
            ...agent,
            llm_provider: 'gemini',
            model: 'gemini-2.0-flash-exp',
            apiKey: process.env.GOOGLE_API_KEY,
          }

          console.log('[AgentChat] 🔄 Fallback to Gemini (timeout)...')
          response = await generateAgentChatResponse(
            { ...fallbackAgent, identity },
            message,
            chatHistory,
            {
              roomName: '1:1 대화',
              roomType: 'direct',
              participantNames: [userProfile?.name || '사용자'],
              userName: userProfile?.name || user.email?.split('@')[0] || '사용자',
              userRole: userProfile?.job_title,
              workContext: fullContextPrompt,  // 🧠 RAG 컨텍스트 포함
            },
            validImages
          )
          console.log('[AgentChat] ✅ Fallback successful (from timeout)!')
        } catch (fallbackError: any) {
          console.error('[AgentChat] Fallback also failed:', fallbackError.message)
          response = `죄송해요, 응답 시간이 너무 오래 걸렸어요. 다시 시도해주세요. ⏱️`
        }
      }
      // 기타 에러
      else {
        response = `죄송해요, 지금 잠시 생각이 안 나네요. (${llmError.message || 'LLM 연결 실패'})`
      }
    }

    // NOTE: 메시지 저장은 프론트엔드가 /api/agents/[id]/history API로 처리
    // 여기서 중복 저장하면 히스토리가 꼬임

    // 업무 로그 기록 (선택적)
    try {
      await (adminClient as any).from('agent_work_logs').insert({
        agent_id: agentId,
        log_type: 'conversation',
        content: `프로필 페이지에서 대화: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
        metadata: {
          user_id: user.id,
          message_preview: message.substring(0, 100),
          response_preview: response.substring(0, 100),
        },
      })
    } catch (logError) {
      console.error('Work log error:', logError)
      // 로그 실패해도 응답은 반환
    }

    // ========================================
    // Agent OS v2.0 처리 (비동기 - 응답 지연 방지)
    // 관계 업데이트, 메모리 저장, 성장, 학습
    // ========================================
    processAgentConversation({
      agentId,
      userId: user.id,
      messages: [
        { role: 'user', content: message },
        { role: 'assistant', content: response },
      ],
      wasHelpful: true, // TODO: 피드백 시스템으로 결정
      topicDomain: 'general',
    }).catch(err => console.error('[AgentOS] Process error:', err))

    // ========================================
    // 🧠 JARVIS Long-term Memory 저장 (비동기)
    // 사용자별 대화 기록 + 자동 학습
    // ========================================
    Promise.all([
      // 사용자 메시지 저장
      saveConversationMessage({
        agentId,
        userId: user.id,
        role: 'user',
        content: message,
        importance: 6,
        metadata: { hasImages: validImages.length > 0 },
      }),
      // 에이전트 응답 저장
      saveConversationMessage({
        agentId,
        userId: user.id,
        role: 'assistant',
        content: response,
        importance: 5,
        metadata: {
          toolsUsed,
          superAgentMode: useSuperAgent,
          autonomousMode: useAutonomousAgent,
        },
      }),
      // 대화에서 자동 학습 (사용자 정보 추출)
      analyzeAndLearn(agentId, user.id, message, response),
    ]).catch(err => console.error('[JarvisMemory] Save error:', err))

    // 이모티콘 매칭
    const gifUrl = await findEmoticonForResponse(adminClient, user.id, response)

    // 🔥 크레딧 차감 (응답 성공 + 사용자 키 미사용 시에만)
    let creditBalance = 0
    if (!useUserKey && creditCost > 0) {
      const chargeResult = await deductCredits(user.id, creditCost, { description: `에이전트 채팅: ${agent.name}` })
      creditBalance = chargeResult.balance
      console.log(`[AgentChat] Credits charged: ${creditCost}, remaining: ${creditBalance}`)
    }

    // 🔥 에이전트 응답: 액션 + 지식 출처 + 크레딧 정보 포함
    return NextResponse.json({
      response,
      gif_url: gifUrl,
      actions: actions.length > 0 ? actions : undefined,
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
      superAgentMode: useSuperAgent,
      autonomousMode: useAutonomousAgent,
      // 📚 지식베이스 출처 (어떤 문서에서 정보를 가져왔는지)
      knowledgeSources: knowledgeSources.length > 0 ? knowledgeSources : undefined,
      // 💰 크레딧 정보 (사용자 키 사용 시 null)
      credits: useUserKey ? null : {
        used: creditCost,
        remaining: creditBalance,
        usingUserKey: false,
      },
    })
  } catch (error) {
    console.error('Agent chat error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '응답 생성 실패' },
      { status: 500 }
    )
  }
}
