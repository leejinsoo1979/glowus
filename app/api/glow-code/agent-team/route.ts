import { NextRequest } from 'next/server'
import { spawn, ChildProcess } from 'child_process'
import { AGENT_ROLE_TEMPLATES, analyzeProjectAndSuggestAgents } from '@/lib/agent/agent-mode'

export const runtime = 'nodejs'
export const maxDuration = 300

interface AgentTask {
  id: string
  role: string
  name: string
  task: string
  systemPrompt: string
}

interface RequestBody {
  userRequest: string
  cwd: string
  agents?: AgentTask[]  // 미리 정의된 에이전트 (없으면 자동 분석)
}

/**
 * Agent Team API
 *
 * 여러 에이전트를 병렬로 실행하고, 각각의 출력을 실시간으로 스트리밍
 * 클라이언트는 각 에이전트의 상태를 한눈에 확인 가능
 */
export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json()
  const { userRequest, cwd, agents: predefinedAgents } = body

  console.log('[Agent Team] Starting with request:', userRequest.substring(0, 100))

  // 1. 에이전트 자동 분석 또는 사용자 지정
  let agents: AgentTask[]

  if (predefinedAgents && predefinedAgents.length > 0) {
    agents = predefinedAgents
  } else {
    // 자동 분석
    const suggestedRoles = analyzeProjectAndSuggestAgents(userRequest)
    agents = suggestedRoles.slice(0, 4).map((role, idx) => ({  // 최대 4개
      id: `agent-${role.id}-${Date.now()}`,
      role: role.id,
      name: role.name,
      task: generateTaskForRole(role.id, userRequest),
      systemPrompt: role.systemPrompt,
    }))

    // 최소 1개 에이전트 보장
    if (agents.length === 0) {
      const defaultRole = AGENT_ROLE_TEMPLATES.find(r => r.id === 'backend')!
      agents = [{
        id: `agent-backend-${Date.now()}`,
        role: 'backend',
        name: 'Backend Developer',
        task: userRequest,
        systemPrompt: defaultRole.systemPrompt,
      }]
    }
  }

  console.log('[Agent Team] Spawning', agents.length, 'agents:', agents.map(a => a.role).join(', '))

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // 초기 에이전트 목록 전송
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'agents_init',
        agents: agents.map(a => ({
          id: a.id,
          name: a.name,
          role: a.role,
          task: a.task,
          status: 'starting'
        }))
      })}\n\n`))

      // 각 에이전트를 병렬로 실행
      const agentPromises = agents.map(agent =>
        runAgentProcess(agent, cwd, controller, encoder)
      )

      // 모든 에이전트 완료 대기
      await Promise.all(agentPromises)

      // 완료 신호
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'all_complete'
      })}\n\n`))

      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

/**
 * 개별 에이전트 프로세스 실행
 */
async function runAgentProcess(
  agent: AgentTask,
  cwd: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<void> {
  return new Promise((resolve) => {
    const prompt = `${agent.systemPrompt}

---

## 작업 지시
${agent.task}

## 작업 규칙
- 직접 파일을 생성/수정하세요
- 완료 후 결과를 요약해주세요
- 다른 에이전트와 협력할 필요 없이 독립적으로 작업하세요`

    // Claude CLI 실행
    const args = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--permission-mode', 'acceptEdits',  // 🔥 비대화형 모드 (서버 환경)
      '--allowedTools', 'Read,Write,Edit,Bash,Glob,Grep',
      '--max-turns', '10'
    ]

    console.log(`[Agent ${agent.id}] Starting CLI in:`, cwd)

    // 🔥 ANTHROPIC_API_KEY 제거 - 있으면 CLI가 OAuth 대신 API 키 사용하려고 함!
    // Max 플랜 OAuth 인증 사용 필수
    const { ANTHROPIC_API_KEY, ...envWithoutApiKey } = process.env

    // claude CLI 경로 (PATH에서 찾거나 homebrew 기본 경로 사용)
    const claudePath = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude'

    const proc = spawn(claudePath, args, {
      cwd,
      env: {
        ...envWithoutApiKey,
        TERM: 'dumb',
        NO_COLOR: '1'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    // 상태 업데이트: 시작
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'agent_status',
      agentId: agent.id,
      status: 'working',
      progress: 0
    })}\n\n`))

    let buffer = ''
    let progress = 0

    proc.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()

      // 줄바꿈 기준으로 파싱
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const data = JSON.parse(line)

          // 진행률 업데이트
          progress = Math.min(progress + 5, 95)

          // 에이전트별 출력 전송
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'agent_output',
            agentId: agent.id,
            data,
            progress
          })}\n\n`))

          // 텍스트 출력이면 로그로 추가
          if (data.type === 'assistant' && data.message?.content) {
            const content = Array.isArray(data.message.content)
              ? data.message.content.map((c: any) => c.text || '').join('')
              : data.message.content

            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'agent_log',
                agentId: agent.id,
                log: content.substring(0, 200)
              })}\n\n`))
            }
          }

          // Tool 사용 로그
          if (data.type === 'assistant' && data.message?.content) {
            const toolUses = Array.isArray(data.message.content)
              ? data.message.content.filter((c: any) => c.type === 'tool_use')
              : []

            for (const tool of toolUses) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'agent_log',
                agentId: agent.id,
                log: `🔧 ${tool.name}: ${JSON.stringify(tool.input).substring(0, 100)}`
              })}\n\n`))
            }
          }

        } catch (e) {
          // JSON 파싱 실패는 무시 (부분 데이터)
        }
      }
    })

    proc.stderr?.on('data', (chunk: Buffer) => {
      const error = chunk.toString()
      console.error(`[Agent ${agent.id}] stderr:`, error)
    })

    proc.on('close', (code) => {
      console.log(`[Agent ${agent.id}] Finished with code:`, code)

      // 상태 업데이트: 완료
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'agent_status',
        agentId: agent.id,
        status: code === 0 ? 'complete' : 'error',
        progress: 100
      })}\n\n`))

      resolve()
    })

    proc.on('error', (err) => {
      console.error(`[Agent ${agent.id}] Error:`, err)

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'agent_status',
        agentId: agent.id,
        status: 'error',
        error: err.message
      })}\n\n`))

      resolve()
    })
  })
}

/**
 * 역할에 맞는 작업 지시 생성
 */
function generateTaskForRole(roleId: string, userRequest: string): string {
  const taskTemplates: Record<string, string> = {
    planner: `사용자 요청을 분석하고 구현 계획을 수립하세요:
"${userRequest}"

출력:
1. 필요한 파일 목록
2. 폴더 구조
3. 구현 순서`,

    frontend: `UI 컴포넌트를 개발하세요:
"${userRequest}"

React + Tailwind CSS를 사용하여 구현하세요.`,

    backend: `API 및 서버 로직을 개발하세요:
"${userRequest}"

Next.js API Routes를 사용하여 구현하세요.`,

    tester: `테스트 케이스를 작성하세요:
"${userRequest}"

Jest/Vitest를 사용하여 테스트 파일을 생성하세요.`,

    reviewer: `코드를 리뷰하고 개선점을 찾으세요:
"${userRequest}"

품질, 보안, 성능 관점에서 분석하세요.`,

    security: `보안 관점에서 분석하세요:
"${userRequest}"

취약점과 개선 방안을 제시하세요.`,
  }

  return taskTemplates[roleId] || userRequest
}
