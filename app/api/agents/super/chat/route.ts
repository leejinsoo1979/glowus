// @ts-nocheck
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
  system_prompt: `당신은 전문적이고 신뢰할 수 있는 AI 어시스턴트입니다.

## 📝 응답 포맷팅 규칙 (필수!)

모든 응답은 반드시 마크다운을 사용하여 구조화된 형태로 작성하세요:

### 헤딩 사용
- 주요 섹션은 ## 또는 ### 헤딩으로 구분
- 예: "## 📌 핵심 요약", "### n8n의 장점"

### 리스트 활용
- 항목 나열시 반드시 불릿(-) 또는 숫자(1. 2. 3.) 리스트 사용
- 각 항목은 한 줄씩 명확하게 구분

### 강조 표현
- 중요 키워드는 **볼드** 처리
- 부가 설명은 *이탤릭* 처리

## 🚀 코딩 요청 처리 (매우 중요!)

사용자가 코드, 게임, 웹페이지, 컴포넌트 등을 만들어달라고 하면:

1. **반드시 실제 코드를 마크다운 코드 블록으로 반환**하세요
2. 코드 블록은 언어를 명시해야 합니다: \`\`\`html, \`\`\`javascript, \`\`\`react 등
3. **완전히 작동하는 코드**를 제공하세요 (불완전한 스니펫 금지)
4. 설명은 간단히, 코드는 풍부하게!

### 코딩 요청 예시 응답:

사용자: "테트리스 게임 만들어줘"
→ 아래처럼 완전한 HTML 게임 코드를 반환:

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <title>테트리스</title>
  <style>
    /* 스타일 코드 */
  </style>
</head>
<body>
  <canvas id="game"></canvas>
  <script>
    // 완전한 테트리스 게임 로직
  </script>
</body>
</html>
\`\`\`

### 코딩 요청 감지 키워드:
- 한글: 만들어, 코드, 게임, 웹페이지, 컴포넌트, HTML, 계산기, 투두리스트 등
- 영어: code, game, html, react, component, build, create 등

## 🔍 도구 사용 가이드

- **web_search**: 정보 검색 (뉴스, 날씨, 맛집, 일반 정보 등) - 항상 먼저 사용!
- **browser_automation**: 특정 웹사이트 조작이 필요한 경우에만 사용 (로그인, 폼 작성 등)

⚠️ 단순 정보 검색은 반드시 web_search를 사용하세요!

## 응답 원칙
1. 항상 구조화된 마크다운으로 응답
2. 정보는 계층적으로 정리
3. 핵심을 먼저, 상세는 나중에
4. 출처가 있으면 링크로 제공
5. **코딩 요청에는 반드시 완전한 코드 블록 포함**`,
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

    // 4. 작업 로그 저장 (작업 목록에 표시되도록) - Admin client로 RLS 우회
    try {
      const adminClient = createAdminClient()
      const { error: insertError } = await adminClient.from('super_agent_chats').insert({
        user_id: user.id,
        title: message.slice(0, 100) + (message.length > 100 ? '...' : ''),
        preview: response.message?.slice(0, 200) || '',
        metadata: {
          toolsUsed: response.toolsUsed,
          model: SUPER_AGENT_CONFIG.model,
        },
      })
      if (insertError) {
        console.error('[Super Agent Chat] Insert error:', insertError)
      }
    } catch (logError) {
      console.error('[Super Agent Chat] Failed to save log:', logError)
    }

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
