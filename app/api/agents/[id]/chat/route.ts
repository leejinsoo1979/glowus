export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'
import { generateAgentChatResponse } from '@/lib/langchain/agent-chat'
import { generateSuperAgentResponse, SuperAgentMessage } from '@/lib/ai/super-agent-chat'
import {
  loadAgentWorkContext,
  formatContextForPrompt,
  saveInstruction,
  updateActiveContext,
  processAgentConversation,
} from '@/lib/agent/work-memory'
import { getLLMConfigForAgent } from '@/lib/llm/user-keys'

// 슈퍼에이전트 모드 감지 (도구 사용이 필요한 요청)
function shouldUseSuperAgent(message: string, capabilities: string[] = []): boolean {
  // 도구 사용이 필요한 패턴들
  const toolPatterns = [
    // 프로젝트 관련
    /프로젝트\s*(를|을)?\s*(만들|생성|추가|새로)/i,
    /새\s*(로운|)?\s*프로젝트/i,
    /create\s*project/i,
    /new\s*project/i,
    // 파일 관련
    /파일\s*(을|를)?\s*(읽|만들|생성|수정|작성)/i,
    /read\s*file/i,
    /write\s*file/i,
    /edit\s*file/i,
    /create\s*file/i,
    // 터미널 관련
    /터미널/i,
    /명령어\s*(실행|수행)/i,
    /npm\s*(install|run|build)/i,
    /git\s*(clone|pull|push|commit)/i,
    /run\s*(command|terminal)/i,
    // 태스크 관련
    /태스크\s*(를|을)?\s*(만들|생성|추가)/i,
    /할\s*일\s*(추가|생성)/i,
    /create\s*task/i,
    /add\s*task/i,
    // 검색 관련
    /검색해\s*(줘|줘요|주세요)/i,
    /찾아\s*(줘|줘요|주세요)/i,
    /web\s*search/i,
    /search\s*(for|the)/i,
    // 코드 작성 요청
    /코드\s*(짜|작성|만들)/i,
    /구현해\s*(줘|주세요)/i,
    /개발해\s*(줘|주세요)/i,
    /만들어\s*(줘|주세요)/i,
  ]

  // 패턴 매칭
  for (const pattern of toolPatterns) {
    if (pattern.test(message)) {
      return true
    }
  }

  // 개발 관련 capability가 있으면 슈퍼에이전트 모드
  const devCapabilities = ['development', 'coding', 'programming', '개발', '코딩']
  if (capabilities.some(cap => devCapabilities.some(dc => cap.toLowerCase().includes(dc)))) {
    // 개발자 에이전트는 코드 관련 질문에 도구 사용
    const codePatterns = [
      /버그|에러|오류|error/i,
      /리팩토링|refactor/i,
      /최적화|optimize/i,
      /테스트|test/i,
    ]
    for (const pattern of codePatterns) {
      if (pattern.test(message)) {
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

    // 인텐트 감지 (프로젝트 생성 등)
    const { actionType, extractedData } = detectIntent(message)

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

    // 🔥 슈퍼에이전트 모드 확인 (Tool Calling 사용)
    const useSuperAgent = body.superAgentMode === true ||
                          shouldUseSuperAgent(message, agent.capabilities || [])

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

    // 🔥 사용자의 LLM API 키 가져오기
    let userApiKey: string | undefined
    try {
      const provider = agent.llm_provider || 'grok'
      const llmConfig = await getLLMConfigForAgent(user.id, provider)
      userApiKey = llmConfig.apiKey
      if (llmConfig.useUserKey) {
        console.log(`[AgentChat] Using user's ${provider} API key`)
      }
    } catch (keyError) {
      console.warn('[AgentChat] Failed to fetch user LLM key:', keyError)
    }

    // 에이전트 응답 생성 (타임아웃 처리)
    let response: string
    let actions: any[] = []
    let toolsUsed: string[] = []

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('LLM 응답 시간 초과 (60초)')), 60000)
      })

      const userName = userProfile?.name || user.email?.split('@')[0] || '사용자'

      // 🔥 슈퍼에이전트 모드: Tool Calling 사용
      if (useSuperAgent) {
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
            workContext: workContextPrompt,
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
            workContext: workContextPrompt,
          },
          validImages
        )

        response = await Promise.race([responsePromise, timeoutPromise])
      }
    } catch (llmError: any) {
      console.error('LLM Error:', llmError)
      response = `죄송해요, 지금 잠시 생각이 안 나네요. (${llmError.message || 'LLM 연결 실패'})`
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

    // 🔥 슈퍼에이전트 응답: 액션 포함
    return NextResponse.json({
      response,
      actions: actions.length > 0 ? actions : undefined,
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
      superAgentMode: useSuperAgent,
    })
  } catch (error) {
    console.error('Agent chat error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '응답 생성 실패' },
      { status: 500 }
    )
  }
}
