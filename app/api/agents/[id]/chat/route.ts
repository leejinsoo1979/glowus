import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'
import { generateAgentChatResponse } from '@/lib/langchain/agent-chat'
import {
  loadAgentWorkContext,
  formatContextForPrompt,
  saveInstruction,
  updateActiveContext,
} from '@/lib/agent/work-memory'
import { getLLMConfigForAgent } from '@/lib/llm/user-keys'

// 인텐트 감지 함수
type ActionType = 'project_create' | 'task_create' | 'general'

function detectIntent(message: string): { actionType: ActionType; extractedData: any } {
  // 프로젝트 생성 인텐트 감지
  const projectCreatePatterns = [
    /프로젝트\s*(를|을)?\s*(만들|생성|추가|새로)/,
    /새\s*(로운|)?\s*프로젝트/,
    /프로젝트\s*하나\s*(만들|생성)/,
    /create\s*project/i,
    /new\s*project/i,
  ]

  for (const pattern of projectCreatePatterns) {
    if (pattern.test(message)) {
      // 프로젝트명 추출 시도
      const nameMatch = message.match(/["']([^"']+)["']/) ||
                        message.match(/프로젝트\s*(?:이름은?|명은?)?\s*(.+?)(?:로|으로|라고|$)/)
      return {
        actionType: 'project_create',
        extractedData: {
          suggestedName: nameMatch?.[1]?.trim() || null
        }
      }
    }
  }

  return { actionType: 'general', extractedData: null }
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

    // 프로젝트 생성 인텐트 감지 시 컨펌 폼 반환
    if (actionType === 'project_create') {
      const confirmMessage = extractedData?.suggestedName
        ? `"${extractedData.suggestedName}" 프로젝트를 생성할까요?\n\n아래 세부사항을 입력해주시면 바로 생성해드릴게요!`
        : `프로젝트를 생성해드릴게요!\n\n아래 세부사항을 입력해주시면 바로 생성해드릴게요.`

      return NextResponse.json({
        response: confirmMessage,
        action_type: 'project_create',
        requires_confirmation: true,
        input_fields: [
          { name: 'name', label: '프로젝트 이름', type: 'text', required: true, placeholder: '예: 신규 마케팅 캠페인' },
          { name: 'description', label: '설명', type: 'textarea', required: false, placeholder: '프로젝트에 대한 간단한 설명' },
          { name: 'priority', label: '우선순위', type: 'select', required: false, options: [
            { value: 'low', label: '낮음' },
            { value: 'medium', label: '보통' },
            { value: 'high', label: '높음' },
            { value: 'urgent', label: '긴급' }
          ]},
          { name: 'deadline', label: '마감일', type: 'date', required: false }
        ],
        extracted_data: extractedData,
        agent: {
          id: agent.id,
          name: agent.name,
          avatar_url: agent.avatar_url
        }
      })
    }

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
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('LLM 응답 시간 초과 (30초)')), 30000)
      })

      const responsePromise = generateAgentChatResponse(
        { ...agent, identity, apiKey: userApiKey },
        message,
        chatHistory,
        {
          roomName: '1:1 대화',
          roomType: 'direct',
          participantNames: [userProfile?.name || user.email?.split('@')[0] || '사용자'],
          userName: userProfile?.name || user.email?.split('@')[0] || '사용자',
          userRole: userProfile?.job_title,
          workContext: workContextPrompt, // 업무 맥락 주입
        },
        validImages // 이미지 전달
      )

      response = await Promise.race([responsePromise, timeoutPromise])
    } catch (llmError: any) {
      console.error('LLM Error:', llmError)
      // LLM 오류 시 친근한 fallback 응답
      response = `죄송해요, 지금 잠시 생각이 안 나네요 😅 (${llmError.message || 'LLM 연결 실패'})`
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

    return NextResponse.json({ response })
  } catch (error) {
    console.error('Agent chat error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '응답 생성 실패' },
      { status: 500 }
    )
  }
}
