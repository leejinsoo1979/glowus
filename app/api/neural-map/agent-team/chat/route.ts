export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'
import { generateSuperAgentResponse, SuperAgentMessage } from '@/lib/ai/super-agent-chat'

/**
 * Agent Team Chat API
 * 5개 전문 에이전트 (Orchestrator, Planner, Implementer, Tester, Reviewer)
 * 각 에이전트는 고유한 시스템 프롬프트와 역할을 가짐
 */

// 에이전트 역할별 추가 설정
const AGENT_CONFIGS: Record<string, {
  capabilities: string[]
  temperature: number
  forceToolUse: boolean
}> = {
  orchestrator: {
    capabilities: ['management', 'planning', 'routing'],
    temperature: 0.7,
    forceToolUse: false, // 오케스트레이터는 분석/계획이 주 역할
  },
  planner: {
    capabilities: ['architecture', 'design', 'planning'],
    temperature: 0.5,
    forceToolUse: false, // 플래너는 설계가 주 역할
  },
  implementer: {
    capabilities: ['development', 'coding', 'programming'],
    temperature: 0.3,
    forceToolUse: true, // 임플리멘터는 반드시 도구 사용!
  },
  tester: {
    capabilities: ['testing', 'qa', 'verification'],
    temperature: 0.4,
    forceToolUse: true, // 테스터도 테스트 코드 작성
  },
  reviewer: {
    capabilities: ['review', 'security', 'quality'],
    temperature: 0.6,
    forceToolUse: false, // 리뷰어는 분석이 주 역할
  },
}

export async function POST(request: NextRequest) {
  try {
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
    const { message, agentRole, systemPrompt, mapId, history = [] } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: '메시지가 필요합니다' }, { status: 400 })
    }

    if (!agentRole || !AGENT_CONFIGS[agentRole]) {
      return NextResponse.json({ error: '유효한 에이전트 역할이 필요합니다' }, { status: 400 })
    }

    const agentConfig = AGENT_CONFIGS[agentRole]

    console.log(`[AgentTeam] ${agentRole} processing: "${message.substring(0, 50)}..."`)

    // 사용자 프로필 조회
    const { data: userProfile } = await adminClient
      .from('users')
      .select('name, job_title')
      .eq('id', user.id)
      .single()

    const userName = userProfile?.name || user.email?.split('@')[0] || '사용자'

    // 채팅 히스토리 변환
    const chatHistory: SuperAgentMessage[] = history.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }))

    // 🔥 Implementer와 Tester는 반드시 Tool Calling 사용
    if (agentConfig.forceToolUse) {
      console.log(`[AgentTeam] ${agentRole}: Forcing Super Agent mode (Tool Calling)`)

      // 가상 에이전트 생성 (실제 DB 에이전트 없이 사용)
      const virtualAgent = {
        id: `agent-team-${agentRole}`,
        name: agentRole.charAt(0).toUpperCase() + agentRole.slice(1),
        description: `Agent Team ${agentRole}`,
        capabilities: agentConfig.capabilities,
        llm_provider: 'grok',
        model: 'grok-3-fast',
        temperature: agentConfig.temperature,
        system_prompt: systemPrompt,
        identity: null,
        apiKey: null,
      }

      try {
        const superAgentResult = await generateSuperAgentResponse(
          virtualAgent,
          message,
          chatHistory,
          {
            projectPath: null,
            userName,
            userRole: userProfile?.job_title,
            workContext: mapId ? `Neural Map ID: ${mapId}` : '',
          }
        )

        console.log(`[AgentTeam] ${agentRole} tools used: ${superAgentResult.toolsUsed.join(', ') || 'none'}`)

        return NextResponse.json({
          response: superAgentResult.message,
          actions: superAgentResult.actions,
          toolsUsed: superAgentResult.toolsUsed,
          agentRole,
        })
      } catch (error: any) {
        console.error(`[AgentTeam] ${agentRole} error:`, error)
        return NextResponse.json({
          response: `죄송합니다, ${agentRole} 에이전트에서 오류가 발생했습니다: ${error.message}`,
          agentRole,
        })
      }
    } else {
      // Orchestrator, Planner, Reviewer는 일반 LLM 호출 (도구 없이)
      const { ChatOpenAI } = await import('@langchain/openai')
      const { HumanMessage, SystemMessage, AIMessage } = await import('@langchain/core/messages')

      const llm = new ChatOpenAI({
        model: 'grok-3-fast',
        temperature: agentConfig.temperature,
        apiKey: process.env.XAI_API_KEY,
        configuration: {
          baseURL: 'https://api.x.ai/v1',
        },
      })

      const messages = [
        new SystemMessage(systemPrompt + `\n\n사용자: ${userName}`),
        ...chatHistory.map((msg) =>
          msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
        ),
        new HumanMessage(message),
      ]

      try {
        const result = await llm.invoke(messages)
        const responseContent = typeof result.content === 'string' ? result.content : JSON.stringify(result.content)

        return NextResponse.json({
          response: responseContent,
          agentRole,
        })
      } catch (error: any) {
        console.error(`[AgentTeam] ${agentRole} LLM error:`, error)
        return NextResponse.json({
          response: `죄송합니다, ${agentRole} 에이전트에서 오류가 발생했습니다: ${error.message}`,
          agentRole,
        })
      }
    }
  } catch (error) {
    console.error('[AgentTeam] API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'API 오류' },
      { status: 500 }
    )
  }
}
