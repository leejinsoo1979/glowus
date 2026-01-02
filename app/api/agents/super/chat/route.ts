export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { generateSuperAgentResponse, SuperAgentMessage } from '@/lib/ai/super-agent-chat'

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
    const body = await request.json()
    const { message, chatHistory = [] } = body

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    // 채팅 히스토리를 SuperAgentMessage 형식으로 변환
    const formattedHistory: SuperAgentMessage[] = chatHistory.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    console.log('[Super Agent Chat] Message:', message)

    // Super Agent 응답 생성 (도구 사용 가능)
    const response = await generateSuperAgentResponse(
      SUPER_AGENT_CONFIG as any,
      message,
      formattedHistory,
    )

    console.log('[Super Agent Chat] Response:', response.message?.substring(0, 100))
    console.log('[Super Agent Chat] Tools used:', response.toolsUsed)
    console.log('[Super Agent Chat] Browser URL:', response.browserUrl)

    return NextResponse.json({
      response: response.message,
      actions: response.actions,
      toolsUsed: response.toolsUsed,
      browserUrl: response.browserUrl,  // 🔥 브라우저 최종 URL
    })

  } catch (error: any) {
    console.error('[Super Agent Chat] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
