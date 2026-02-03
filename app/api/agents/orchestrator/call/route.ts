export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'
import { generateSuperAgentResponse } from '@/lib/ai/super-agent-chat'
import { getApiModelId } from '@/lib/ai/models'

/**
 * Orchestrator → 다른 에이전트 호출 API
 * Orchestrator가 Planner, Implementer, Tester, Reviewer에게 작업 위임
 */

// 에이전트별 시스템 프롬프트
const AGENT_PROMPTS: Record<string, { systemPrompt: string; capabilities: string[]; temperature: number }> = {
  planner: {
    systemPrompt: `당신은 Planner / Architect 에이전트입니다.
Orchestrator로부터 작업을 받아 설계를 수행합니다.

## 역할
- Plan-and-Act 기반으로 설계 먼저 확정
- 폴더 구조, 모듈 경계, 데이터 흐름 정의
- 인터페이스 정의 (API, 컴포넌트 Props, DB 스키마)
- 실행 가능한 작업 목록으로 분리

## 응답 형식
1. 아키텍처 설계
2. 데이터 흐름
3. 인터페이스 정의
4. 구현 작업 목록`,
    capabilities: ['architecture', 'design', 'planning', 'development'],
    temperature: 0.5,
  },
  implementer: {
    systemPrompt: `당신은 Implementer / Coder 에이전트입니다.
Orchestrator로부터 작업을 받아 실제 코드를 구현합니다.

## 역할
- 실제 코딩 담당 (기능 구현, 리팩토링)
- 최소 단위로 구현
- 도구를 사용하여 파일 생성/수정

## 행동 규칙
- 설명 없이 바로 코드 작성
- write_file 도구로 파일 생성
- edit_file 도구로 파일 수정
- run_terminal로 명령 실행

❌ "이렇게 하면 됩니다" 설명만 하기 금지
✅ 반드시 코드를 작성하고 파일을 생성할 것`,
    capabilities: ['development', 'coding', 'programming'],
    temperature: 0.3,
  },
  tester: {
    systemPrompt: `당신은 Tester / QA 에이전트입니다.
Orchestrator로부터 작업을 받아 테스트를 수행합니다.

## 역할
- 단위/통합 테스트 작성
- 엣지케이스 발견 및 테스트
- 버그 재현 → 원인 분석 → 수정 제안

## 응답 형식
1. 테스트 케이스 목록
2. 테스트 코드
3. 발견된 버그/이슈
4. 수정 제안`,
    capabilities: ['testing', 'qa', 'verification'],
    temperature: 0.4,
  },
  reviewer: {
    systemPrompt: `당신은 Reviewer / Critic 에이전트입니다.
Orchestrator로부터 작업을 받아 코드 리뷰를 수행합니다.

## 역할
- 코드 품질, 보안, 성능 검토
- 아키텍처 위반 감시
- 최종 승인/거부 결정

## 응답 형식
✅ 통과 항목
⚠️ 경고 (수정 권장)
❌ 블로커 (수정 필수)

### 최종 판정: APPROVE / REQUEST_CHANGES / REJECT`,
    capabilities: ['review', 'security', 'quality'],
    temperature: 0.6,
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
    const { targetAgent, task, context, priority, waitForResult = true, projectPath } = body

    if (!targetAgent || !AGENT_PROMPTS[targetAgent]) {
      return NextResponse.json(
        { error: '유효한 대상 에이전트가 필요합니다 (planner, implementer, tester, reviewer)' },
        { status: 400 }
      )
    }

    if (!task || typeof task !== 'string') {
      return NextResponse.json({ error: '작업 내용이 필요합니다' }, { status: 400 })
    }

    const agentConfig = AGENT_PROMPTS[targetAgent]

    console.log(`[Orchestrator→${targetAgent}] Task: "${task.substring(0, 50)}..." (priority: ${priority})`)

    // 사용자 프로필 조회
    const { data: userProfile } = await adminClient
      .from('users')
      .select('name, job_title')
      .eq('id', user.id)
      .single() as { data: { name?: string; job_title?: string } | null }

    const userName = userProfile?.name || user.email?.split('@')[0] || '사용자'

    // 컨텍스트가 있으면 작업에 추가
    const fullTask = context
      ? `[Orchestrator로부터 받은 작업]\n\n작업: ${task}\n\n컨텍스트:\n${context}`
      : `[Orchestrator로부터 받은 작업]\n\n${task}`

    // 가상 에이전트 생성
    const virtualAgent = {
      id: `orchestrator-delegate-${targetAgent}`,
      name: targetAgent.charAt(0).toUpperCase() + targetAgent.slice(1),
      description: `Orchestrator가 위임한 ${targetAgent} 작업`,
      capabilities: agentConfig.capabilities,
      llm_provider: 'gemini',
      model: getApiModelId('gemini-2.0-flash'),
      temperature: agentConfig.temperature,
      system_prompt: agentConfig.systemPrompt,
      identity: null,
      apiKey: null,
    }

    // Super Agent로 응답 생성
    const result = await generateSuperAgentResponse(
      virtualAgent,
      fullTask,
      [], // 새 대화
      {
        projectPath: projectPath || null,  // 🔥 프론트엔드에서 받은 프로젝트 경로 사용
        userName,
        userRole: userProfile?.job_title,
        workContext: `Orchestrator로부터 위임받은 작업 (우선순위: ${priority || 'normal'})`,
      }
    )

    console.log(`[Orchestrator→${targetAgent}] 완료. Tools used: ${result.toolsUsed.join(', ') || 'none'}`)

    return NextResponse.json({
      success: true,
      targetAgent,
      task,
      response: {
        message: result.message,
        actions: result.actions,
        toolsUsed: result.toolsUsed,
      },
    })
  } catch (error) {
    console.error('[Orchestrator Call] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '에이전트 호출 실패' },
      { status: 500 }
    )
  }
}

// GET - 에이전트 상태 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const agent = searchParams.get('agent') || 'all'

  // 현재는 간단한 상태만 반환 (향후 실제 상태 추적 구현 가능)
  const status = {
    planner: { status: 'idle', lastTask: null },
    implementer: { status: 'idle', lastTask: null },
    tester: { status: 'idle', lastTask: null },
    reviewer: { status: 'idle', lastTask: null },
  }

  if (agent === 'all') {
    return NextResponse.json({ agents: status })
  }

  if (status[agent as keyof typeof status]) {
    return NextResponse.json({ agent, ...status[agent as keyof typeof status] })
  }

  return NextResponse.json({ error: '유효하지 않은 에이전트' }, { status: 400 })
}
