import { NextRequest } from 'next/server'
import { spawn, ChildProcess } from 'child_process'
import {
  AGENT_MODE_SYSTEM_PROMPT,
  analyzeProjectAndSuggestAgents,
  AGENT_ROLE_TEMPLATES,
  type SubAgentRole
} from '@/lib/agent/agent-mode'

export const runtime = 'nodejs'
export const maxDuration = 300

interface RequestBody {
  userRequest: string
  cwd: string
  model?: string
}

interface ActiveAgent {
  id: string
  name: string
  role: string
  task: string
  process: ChildProcess
  status: 'starting' | 'working' | 'complete' | 'error'
}

// 🔥 활성 에이전트 관리 (요청별)
const activeAgents = new Map<string, ActiveAgent>()

/**
 * Orchestrator API
 *
 * PM(메인 CLI)이 Task 도구로 서브 에이전트를 요청하면,
 * 서버에서 실제 CLI 프로세스를 spawn하고 실시간 스트리밍
 */
export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json()
  const { userRequest, cwd, model } = body

  console.log('[Orchestrator] Starting with request:', userRequest.substring(0, 100))

  // 🔥 ANTHROPIC_API_KEY 제거 - OAuth 인증 사용
  const { ANTHROPIC_API_KEY, ...envWithoutApiKey } = process.env
  const claudePath = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude'

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const requestId = `req-${Date.now()}`

      // 🔥 프로젝트 분석하여 에이전트 추천
      const suggestedAgents = analyzeProjectAndSuggestAgents(userRequest)
      const agentContext = suggestedAgents.length > 0
        ? `\n\n## 🤖 추천 에이전트\n${suggestedAgents.map(a => `- **${a.name}**: ${a.expertise.slice(0, 3).join(', ')}`).join('\n')}`
        : ''

      // 🔥 PM 프롬프트 구성 - 강제로 Task 사용하도록
      const pmPrompt = `${AGENT_MODE_SYSTEM_PROMPT}${agentContext}

---

## 사용자 요청
${userRequest}

---

# ⚠️ 지금 즉시 Task 도구를 호출하세요!

위 요청에 대해 **지금 바로** Task 도구를 호출하여 에이전트에게 작업을 위임하세요.

**예시:**
\`\`\`
Task(
  subagent_type: "general-purpose",
  description: "Frontend Developer - [작업 내용]",
  prompt: "당신은 Frontend Developer입니다. [상세 지시]"
)
\`\`\`

분석만 하지 말고, **지금 Task 도구를 사용하세요!**`

      // 🔥 PM CLI 실행 - Task 도구만 허용!
      const pmArgs = [
        '-p', pmPrompt,
        '--output-format', 'stream-json',
        '--verbose',
        '--permission-mode', 'acceptEdits',
        '--model', model || 'claude-sonnet-4-20250514',
        '--max-turns', '20',
        '--allowedTools', 'Task,Read,Glob,Grep'  // 🔥 PM은 Task + 읽기만 가능, 쓰기 금지!
      ]

      console.log('[Orchestrator] Starting PM CLI...')

      const pmProcess = spawn(claudePath, pmArgs, {
        cwd,
        env: {
          ...envWithoutApiKey,
          TERM: 'dumb',
          NO_COLOR: '1'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      })

      // PM stdin 닫기 (비대화형)
      pmProcess.stdin.end()

      // PM 시작 알림
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'pm_status',
        status: 'started',
        message: 'PM(Project Manager) 시작됨'
      })}\n\n`))

      let pmBuffer = ''
      let pendingTaskCalls: Map<string, { description: string; prompt: string }> = new Map()

      // 🔥 PM stdout 처리
      pmProcess.stdout?.on('data', (chunk: Buffer) => {
        pmBuffer += chunk.toString()
        const lines = pmBuffer.split('\n')
        pmBuffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const data = JSON.parse(line)

            // PM 텍스트 응답
            if (data.type === 'assistant' && data.message?.content) {
              for (const block of data.message.content) {
                if (block.type === 'text' && block.text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'pm_text',
                    content: block.text
                  })}\n\n`))
                }

                // 🔥 Task 도구 호출 감지 → 서브 에이전트 spawn
                if (block.type === 'tool_use' && block.name === 'Task') {
                  const taskId = block.id
                  const description = block.input?.description || ''
                  const prompt = block.input?.prompt || ''

                  // 역할 감지
                  const { role, name } = detectAgentRole(description, prompt)

                  console.log(`[Orchestrator] Task detected: ${name} (${role})`)

                  // 에이전트 spawn 알림
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'agent_spawn',
                    agent: {
                      id: taskId,
                      name,
                      role,
                      task: description || prompt.substring(0, 100),
                      status: 'starting'
                    }
                  })}\n\n`))

                  // 🔥 서브 에이전트 CLI 실행
                  spawnSubAgent(
                    taskId,
                    name,
                    role,
                    prompt,
                    cwd,
                    claudePath,
                    envWithoutApiKey,
                    controller,
                    encoder
                  )
                }

                // 다른 도구 사용
                if (block.type === 'tool_use' && block.name !== 'Task') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'pm_tool',
                    name: block.name,
                    input: block.input,
                    id: block.id
                  })}\n\n`))
                }
              }
            }

            // Tool 결과 (PM이 받은 결과)
            if (data.type === 'tool_result') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'pm_tool_result',
                toolUseId: data.tool_use_id,
                content: data.content,
                isError: data.is_error
              })}\n\n`))
            }

          } catch (e) {
            // JSON 파싱 실패 무시
          }
        }
      })

      // PM stderr
      pmProcess.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        console.log('[Orchestrator] PM stderr:', text.substring(0, 200))
      })

      // PM 종료
      pmProcess.on('close', (code) => {
        console.log('[Orchestrator] PM finished with code:', code)

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'pm_status',
          status: code === 0 ? 'complete' : 'error',
          message: code === 0 ? 'PM 작업 완료' : `PM 오류 (code: ${code})`
        })}\n\n`))

        // 모든 에이전트 완료 대기 후 스트림 종료
        setTimeout(() => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'orchestrator_complete'
          })}\n\n`))
          controller.close()
        }, 1000)
      })

      pmProcess.on('error', (err) => {
        console.error('[Orchestrator] PM error:', err)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'pm_status',
          status: 'error',
          message: err.message
        })}\n\n`))
        controller.close()
      })
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
 * 역할 감지
 */
function detectAgentRole(description: string, prompt: string): { role: string; name: string } {
  const text = `${description} ${prompt}`.toLowerCase()

  if (text.includes('frontend') || text.includes('ui') || text.includes('component') || text.includes('react')) {
    return { role: 'frontend', name: 'Frontend Developer' }
  }
  if (text.includes('backend') || text.includes('api') || text.includes('server') || text.includes('database')) {
    return { role: 'backend', name: 'Backend Developer' }
  }
  if (text.includes('test') || text.includes('qa') || text.includes('jest') || text.includes('cypress')) {
    return { role: 'tester', name: 'QA Tester' }
  }
  if (text.includes('security') || text.includes('auth') || text.includes('vulnerability')) {
    return { role: 'security', name: 'Security Expert' }
  }
  if (text.includes('plan') || text.includes('architect') || text.includes('design')) {
    return { role: 'planner', name: 'Planner' }
  }
  if (text.includes('review') || text.includes('quality')) {
    return { role: 'reviewer', name: 'Code Reviewer' }
  }
  if (text.includes('devops') || text.includes('deploy') || text.includes('docker') || text.includes('ci')) {
    return { role: 'devops', name: 'DevOps Engineer' }
  }

  return { role: 'general', name: 'Sub Agent' }
}

/**
 * 서브 에이전트 CLI spawn 및 실시간 스트리밍
 */
function spawnSubAgent(
  agentId: string,
  agentName: string,
  agentRole: string,
  task: string,
  cwd: string,
  claudePath: string,
  env: NodeJS.ProcessEnv,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  const roleTemplate = AGENT_ROLE_TEMPLATES.find(r => r.id === agentRole)
  const systemPrompt = roleTemplate?.systemPrompt || `당신은 ${agentName}입니다. 주어진 작업을 수행하세요.`

  const agentPrompt = `${systemPrompt}

---

## 작업 지시
${task}

## 작업 규칙
- 직접 파일을 생성/수정하세요
- 완료 후 결과를 간단히 요약해주세요
- 독립적으로 작업하세요`

  const args = [
    '-p', agentPrompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--permission-mode', 'acceptEdits',
    '--allowedTools', 'Read,Write,Edit,Bash,Glob,Grep',
    '--max-turns', '15'
  ]

  console.log(`[Orchestrator] Spawning agent: ${agentName} (${agentId})`)

  const proc = spawn(claudePath, args, {
    cwd,
    env: {
      ...env,
      TERM: 'dumb',
      NO_COLOR: '1'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  })

  proc.stdin.end()

  // 시작 상태
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
    type: 'agent_status',
    agentId,
    status: 'working',
    progress: 0
  })}\n\n`))

  let buffer = ''
  let progress = 0

  proc.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const data = JSON.parse(line)

        progress = Math.min(progress + 5, 95)

        // 텍스트 출력
        if (data.type === 'assistant' && data.message?.content) {
          for (const block of data.message.content) {
            if (block.type === 'text' && block.text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'agent_log',
                agentId,
                log: block.text.substring(0, 300),
                progress
              })}\n\n`))
            }

            // 도구 사용
            if (block.type === 'tool_use') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'agent_tool',
                agentId,
                toolName: block.name,
                toolInput: block.input,
                progress
              })}\n\n`))
            }
          }
        }

        // Tool 결과
        if (data.type === 'tool_result') {
          const resultPreview = typeof data.content === 'string'
            ? data.content.substring(0, 200)
            : JSON.stringify(data.content).substring(0, 200)

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'agent_tool_result',
            agentId,
            content: resultPreview,
            isError: data.is_error,
            progress
          })}\n\n`))
        }

      } catch (e) {
        // JSON 파싱 실패 무시
      }
    }
  })

  proc.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString()
    console.log(`[Orchestrator] Agent ${agentId} stderr:`, text.substring(0, 100))
  })

  proc.on('close', (code) => {
    console.log(`[Orchestrator] Agent ${agentId} finished with code:`, code)

    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'agent_status',
      agentId,
      status: code === 0 ? 'complete' : 'error',
      progress: 100
    })}\n\n`))
  })

  proc.on('error', (err) => {
    console.error(`[Orchestrator] Agent ${agentId} error:`, err)

    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'agent_status',
      agentId,
      status: 'error',
      error: err.message
    })}\n\n`))
  })
}
