import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'
import { generateAgentChatResponse } from '@/lib/langchain/agent-chat'

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

    // 에이전트 응답 생성 (타임아웃 처리)
    let response: string
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('LLM 응답 시간 초과 (30초)')), 30000)
      })

      const responsePromise = generateAgentChatResponse(
        { ...agent, identity },
        message,
        chatHistory,
        {
          roomName: '1:1 대화',
          roomType: 'direct',
          participantNames: [userProfile?.name || user.email?.split('@')[0] || '사용자'],
          userName: userProfile?.name || user.email?.split('@')[0] || '사용자',
          userRole: userProfile?.job_title,
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
