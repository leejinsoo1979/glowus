/**
 * 에이전트 간 통신 API
 * Orchestrator가 다른 에이전트를 호출할 때 사용
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSuperAgentResponse } from '@/lib/ai/super-agent-chat'

interface CallAgentRequest {
  targetAgent: 'planner' | 'implementer' | 'tester' | 'reviewer'
  task: string
  context?: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  waitForResult?: boolean
  callerAgentId?: string  // 호출한 에이전트 ID
}

// 에이전트 역할별 기본 설정
const AGENT_ROLE_CONFIGS: Record<string, {
  name: string
  capabilities: string[]
  systemPromptAddition: string
}> = {
  planner: {
    name: 'Planner',
    capabilities: ['planning', 'design', 'architecture'],
    systemPromptAddition: `
당신은 Planner 에이전트입니다.
- 프로젝트 계획 수립
- 아키텍처 설계
- 태스크 분해 및 우선순위 결정
- 기술 스택 선택
작업 결과를 구조화된 형태로 반환하세요.`
  },
  implementer: {
    name: 'Implementer',
    capabilities: ['development', 'coding', 'implementation'],
    systemPromptAddition: `
당신은 Implementer 에이전트입니다.
- 코드 작성 및 구현
- 파일 생성 및 수정
- 기능 개발
- 버그 수정
create_file_with_node, edit_file 도구를 적극 활용하세요.`
  },
  tester: {
    name: 'Tester',
    capabilities: ['testing', 'qa', 'quality'],
    systemPromptAddition: `
당신은 Tester 에이전트입니다.
- 테스트 코드 작성
- 버그 발견 및 보고
- 품질 검증
- 테스트 커버리지 확인
테스트 결과를 상세히 보고하세요.`
  },
  reviewer: {
    name: 'Reviewer',
    capabilities: ['review', 'analysis', 'feedback'],
    systemPromptAddition: `
당신은 Reviewer 에이전트입니다.
- 코드 리뷰
- 품질 평가
- 개선점 제안
- 보안 취약점 검토
구체적인 개선 제안을 포함하세요.`
  },
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orchestratorId } = await params
    const body: CallAgentRequest = await request.json()

    const { targetAgent, task, context, priority, callerAgentId } = body

    if (!targetAgent || !task) {
      return NextResponse.json(
        { error: 'targetAgent와 task는 필수입니다.' },
        { status: 400 }
      )
    }

    const roleConfig = AGENT_ROLE_CONFIGS[targetAgent]
    if (!roleConfig) {
      return NextResponse.json(
        { error: `알 수 없는 에이전트: ${targetAgent}` },
        { status: 400 }
      )
    }

    // Supabase에서 호출 기록 저장 (선택적)
    const supabase = await createClient()

    // 에이전트 호출 로그 저장 (테이블이 없으면 스킵)
    try {
      await supabase.from('agent_call_logs').insert({
        caller_agent_id: callerAgentId || orchestratorId,
        target_agent: targetAgent,
        task,
        context,
        priority: priority || 'normal',
        status: 'processing',
        created_at: new Date().toISOString(),
      } as never)
    } catch (e) {
      console.warn('[Agent Call] Failed to log call:', e)
    }

    // 타겟 에이전트 설정 구성
    const targetAgentConfig = {
      id: `${targetAgent}-agent`,
      name: roleConfig.name,
      capabilities: roleConfig.capabilities,
      llm_provider: 'gemini',  // 기본 provider
      model: 'gemini-2.0-flash-exp',
      temperature: 0.7,
      system_prompt: roleConfig.systemPromptAddition,
    }

    // 컨텍스트 구성
    const chatContext = {
      workContext: context ? `
## 작업 요청
- 요청자: Orchestrator
- 우선순위: ${priority || 'normal'}
- 컨텍스트: ${context}
` : undefined,
    }

    // 에이전트 응답 생성
    const response = await generateSuperAgentResponse(
      targetAgentConfig,
      task,
      [],  // 새 대화이므로 히스토리 없음
      chatContext
    )

    return NextResponse.json({
      success: true,
      targetAgent,
      task,
      response: {
        message: response.message,
        actions: response.actions,
        toolsUsed: response.toolsUsed,
      },
    })

  } catch (error: any) {
    console.error('[Agent Call API] Error:', error)
    return NextResponse.json(
      { error: error.message || '에이전트 호출 실패' },
      { status: 500 }
    )
  }
}

// 에이전트 상태 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const targetAgent = searchParams.get('agent') || 'all'

    // 현재는 정적 상태 반환 (추후 실제 상태 관리 시스템 연동)
    const agentStatuses: Record<string, {
      status: 'idle' | 'busy' | 'error'
      lastActivity?: string
      currentTask?: string
    }> = {
      planner: { status: 'idle', lastActivity: new Date().toISOString() },
      implementer: { status: 'idle', lastActivity: new Date().toISOString() },
      tester: { status: 'idle', lastActivity: new Date().toISOString() },
      reviewer: { status: 'idle', lastActivity: new Date().toISOString() },
    }

    if (targetAgent === 'all') {
      return NextResponse.json({
        success: true,
        agents: agentStatuses,
      })
    }

    if (!agentStatuses[targetAgent]) {
      return NextResponse.json(
        { error: `알 수 없는 에이전트: ${targetAgent}` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      agent: targetAgent,
      ...agentStatuses[targetAgent],
    })

  } catch (error: any) {
    console.error('[Agent Status API] Error:', error)
    return NextResponse.json(
      { error: error.message || '상태 조회 실패' },
      { status: 500 }
    )
  }
}
