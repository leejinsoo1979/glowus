export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { generateSuperAgentResponse, SuperAgentMessage } from '@/lib/ai/super-agent-chat'
import { requireCredits, chargeCredits } from '@/lib/credits/middleware'

// 기본 Super Agent 설정
const SUPER_AGENT_CONFIG = {
  id: 'super-agent',
  name: 'Super Agent',
  llm_provider: 'openai',
  model: 'gpt-4o',
  temperature: 0.7,
  system_prompt: `당신은 강력한 AI 어시스턴트입니다. 다양한 도구를 사용하여 사용자를 도울 수 있습니다.

🔍 검색/브라우저:
- browser_automation: 웹 브라우저 자동화 (검색, 클릭, 스크롤 등)
- web_search: 웹 검색 (Tavily API)

사용자가 검색을 요청하면:
1. browser_automation 도구를 사용하여 검색
2. 검색 결과를 분석하여 유용한 정보 추출
3. 사용자에게 친절하게 결과 요약

예시:
- "역삼동 맛집 추천해줘" → browser_automation으로 검색 후 결과 요약
- "오늘 날씨 알려줘" → browser_automation으로 날씨 검색`,
}

export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const supabase = await createClient()
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data, error: authError } = await supabase.auth.getUser()
      if (authError || !data.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = data.user
    }

    const body = await request.json()
    const { message, chatHistory = [] } = body

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    // 2. 크레딧 확인 (GPT-4o 사용 = 10 크레딧)
    const creditCheck = await requireCredits(user.id, 'chat_gpt4o')
    if (!creditCheck.success) {
      return creditCheck.response
    }

    // 채팅 히스토리를 SuperAgentMessage 형식으로 변환
    const formattedHistory: SuperAgentMessage[] = chatHistory.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    console.log('[Super Agent Chat] Message:', message, '| User:', user.id)

    // Super Agent 응답 생성 (도구 사용 가능)
    const response = await generateSuperAgentResponse(
      SUPER_AGENT_CONFIG as any,
      message,
      formattedHistory,
    )

    // 3. 크레딧 차감
    const chargeResult = await chargeCredits(user.id, 'chat_gpt4o', `Super Agent 채팅`)

    console.log('[Super Agent Chat] Response:', response.message?.substring(0, 100))
    console.log('[Super Agent Chat] Tools used:', response.toolsUsed)
    console.log('[Super Agent Chat] Credits remaining:', chargeResult.balance)

    return NextResponse.json({
      response: response.message,
      actions: response.actions,
      toolsUsed: response.toolsUsed,
      browserUrl: response.browserUrl,
      credits: {
        used: 10,
        remaining: chargeResult.balance,
      },
    })

  } catch (error: any) {
    console.error('[Super Agent Chat] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
