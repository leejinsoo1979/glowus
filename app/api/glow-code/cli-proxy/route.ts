import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import {
  buildProjectContext,
  buildMemoryContext,
  addMemory
} from '@/lib/glow-code/skills-loader'
import {
  AGENT_MODE_SYSTEM_PROMPT,
  QUICK_MODE_SYSTEM_PROMPT,
  analyzeProjectAndSuggestAgents,
  AGENT_ROLE_TEMPLATES
} from '@/lib/agent/agent-mode'

export const runtime = 'nodejs'
export const maxDuration = 300

// 🔥 기본 허용 도구 목록
const DEFAULT_ALLOWED_TOOLS = [
  'Read', 'Write', 'Edit', 'MultiEdit',
  'Bash', 'Glob', 'Grep', 'LS',
  'TodoWrite', 'Task',
  'WebSearch', 'WebFetch'
]

interface RequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  options?: {
    model?: string
    allowedTools?: string[]
    maxTurns?: number
    sessionId?: string  // 대화 이어가기
    cwd?: string        // 작업 디렉토리
    includeProjectContext?: boolean  // 프로젝트 컨텍스트 자동 포함
    includeSkills?: boolean          // 🔥 스킬 로드
    includeMemory?: boolean          // 🔥 메모리 컨텍스트 포함
    permissionMode?: 'default' | 'plan' | 'acceptEdits'  // 🔥 권한 모드
    extendedThinking?: boolean       // 🔥 확장 사고 모드
    executionMode?: 'quick' | 'agent'  // 🔥 실행 모드: Quick (직접) vs Agent (PM 모드)
  }
  context?: {
    fileName?: string
    selectedCode?: string
    language?: string
  }
}

export async function GET() {
  return new Response(JSON.stringify({ status: 'ok', endpoint: 'claude-cli-proxy' }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function POST(request: NextRequest) {
  console.log('[Claude CLI] POST request received')

  try {
    const body: RequestBody = await request.json()
    const { messages, options = {}, context } = body

    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    if (!lastUserMessage) {
      return new Response(JSON.stringify({ error: '메시지 필요' }), { status: 400 })
    }

    const cwd = options.cwd || process.cwd()

    // ⚠️ 작업 경로가 설정되지 않았을 때 경고
    if (!options.cwd) {
      console.warn('[Claude CLI] ⚠️ No cwd provided, using server directory:', cwd)
      console.warn('[Claude CLI] 💡 Set project path in GlowCode using /cd command or UI')
    } else {
      console.log('[Claude CLI] Working directory:', cwd)
    }

    // 🔥 프로젝트 컨텍스트 수집 (시스템 프롬프트가 아닌 추가 컨텍스트로 사용)
    // Claude CLI의 기본 시스템 프롬프트를 유지하면서 프로젝트 정보만 추가
    let projectContextInfo = ''
    if (options.includeProjectContext !== false) {
      try {
        const projectContext = await buildProjectContext(cwd)
        // 최소한의 프로젝트 정보만 전달 (Claude CLI 기본 동작 유지)
        const contextParts: string[] = []
        if (projectContext.gitBranch) {
          contextParts.push(`Git branch: ${projectContext.gitBranch}`)
        }
        if (projectContext.gitStatus) {
          const changedCount = projectContext.gitStatus.split('\n').filter(Boolean).length
          if (changedCount > 0) {
            contextParts.push(`${changedCount} uncommitted changes`)
          }
        }
        if (projectContext.skills.length > 0) {
          contextParts.push(`Available skills: ${projectContext.skills.map(s => s.name).join(', ')}`)
        }
        if (contextParts.length > 0) {
          projectContextInfo = `\n\n[Project context: ${contextParts.join(' | ')}]`
        }
        console.log('[Claude CLI] Project context collected:', contextParts.length, 'items')
      } catch (e) {
        console.warn('[Claude CLI] Failed to collect project context:', e)
      }
    }

    // 🔥 메모리 컨텍스트
    let memoryContext = ''
    if (options.includeMemory !== false) {
      try {
        memoryContext = await buildMemoryContext(cwd, lastUserMessage.content)
      } catch (e) {
        console.warn('[Claude CLI] Failed to build memory context:', e)
      }
    }

    // 🔥 Team Mode (Agent Mode) 처리 - PM으로서 Task 도구로 서브 에이전트 spawn
    const isTeamMode = options.executionMode === 'agent'
    let agentModeContext = ''

    if (isTeamMode) {
      // 프로젝트 분석하여 필요한 에이전트 추천
      const suggestedAgents = analyzeProjectAndSuggestAgents(lastUserMessage.content)
      if (suggestedAgents.length > 0) {
        agentModeContext = `\n\n## 🤖 추천 에이전트 (프로젝트 분석 결과)
${suggestedAgents.map(a => `- **${a.name}** (${a.nameKr}): ${a.expertise.slice(0, 3).join(', ')}`).join('\n')}

위 에이전트들을 Task 도구로 스폰하여 작업을 병렬로 위임하세요.`
      }
      console.log('[Claude CLI] Team Mode - Suggested agents:', suggestedAgents.map(a => a.id).join(', '))
    }

    // 🔥 최종 프롬프트 구성
    let prompt = lastUserMessage.content

    // Team Mode: PM 시스템 프롬프트 + 에이전트 추천
    if (isTeamMode) {
      prompt = `${AGENT_MODE_SYSTEM_PROMPT}${agentModeContext}

---

## 사용자 요청
${lastUserMessage.content}${projectContextInfo}${memoryContext ? '\n\n' + memoryContext : ''}`
    }
    // 선택된 코드가 있을 경우
    else if (context?.selectedCode) {
      prompt = `${memoryContext ? memoryContext + '\n\n' : ''}## 현재 작업 컨텍스트

현재 파일: ${context.fileName || 'unknown'}
선택된 코드:
\`\`\`${context.language || ''}
${context.selectedCode}
\`\`\`

질문: ${lastUserMessage.content}
`.trim()
    } else if (memoryContext || projectContextInfo) {
      prompt = `${lastUserMessage.content}${projectContextInfo}${memoryContext ? '\n\n' + memoryContext : ''}`
    }

    // 🔥 메모리에 사용자 요청 저장
    try {
      await addMemory(cwd, {
        type: 'context',
        content: `사용자 질문: ${lastUserMessage.content.slice(0, 200)}`,
        relevance: 0.5
      })
    } catch {}

    console.log('[Claude CLI] Prompt length:', prompt.length, 'chars')

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        console.log('[Claude CLI] Stream starting...')

        // 즉시 연결 확인 메시지 전송
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', content: 'Connecting to Claude...' })}\n\n`))

        // 🔥 CLI 인자 구성
        const args: string[] = []

        // 세션 이어가기
        if (options.sessionId) {
          args.push('--resume', options.sessionId)
        }

        args.push('-p', prompt)
        args.push('--output-format', 'stream-json')
        args.push('--verbose')  // Required for stream-json with -p flag

        // 🔥 Claude CLI 기본 시스템 프롬프트 유지 (덮어쓰지 않음)
        // 프로젝트 컨텍스트는 사용자 메시지에 추가됨

        // 🔥 권한 모드 설정 - CLI 내장 플래그 사용
        // Max 플랜은 OAuth 인증 사용 - dangerously-skip-permissions/CI=true 절대 사용 금지!
        // --permission-mode 플래그로 비대화형 실행 가능
        const permMode = options.permissionMode === 'plan' ? 'plan'
          : options.permissionMode === 'acceptEdits' ? 'acceptEdits'
          : 'acceptEdits'  // 서버에서는 기본적으로 acceptEdits 사용 (비대화형)
        args.push('--permission-mode', permMode)

        // 허용 도구 설정 (선택적)
        if (options.allowedTools?.length) {
          args.push('--allowedTools', options.allowedTools.join(','))
        }

        // 모델 지정 (기본: Sonnet - 빠르고 효율적)
        const model = options.model || 'claude-sonnet-4-20250514'
        args.push('--model', model)

        // 최대 턴 수
        if (options.maxTurns) {
          args.push('--max-turns', String(options.maxTurns))
        }

        console.log('[Claude CLI] Args:', args.slice(0, 4).join(' '), '...')
        console.log('[Claude CLI] CWD:', cwd)

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', content: 'Starting Claude CLI...' })}\n\n`))

        // claude CLI 경로 (PATH에서 찾거나 homebrew 기본 경로 사용)
        const claudePath = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude'

        // 🔥 ANTHROPIC_API_KEY 제거 - 있으면 CLI가 OAuth 대신 API 키 사용하려고 함!
        const { ANTHROPIC_API_KEY, ...envWithoutApiKey } = process.env

        const claude = spawn(claudePath, args, {
          cwd,
          env: {
            ...envWithoutApiKey,
            // CI: 'true' 제거 - Max 플랜 OAuth 인증 사용하려면 CI 모드 쓰면 안됨
            TERM: 'dumb',
            NO_COLOR: '1'
          },
          stdio: ['pipe', 'pipe', 'pipe']
        })

        if (!claude.pid) {
          console.error('[Claude CLI] Failed to spawn process')
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: 'Failed to spawn Claude CLI process' })}\n\n`))
          controller.close()
          return
        }

        console.log('[Claude CLI] Spawned with PID:', claude.pid)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', content: `CLI PID: ${claude.pid}` })}\n\n`))

        // 🔥 stdin 즉시 닫기 (비대화형 모드)
        claude.stdin.end()

        // 🔥 타임아웃 설정 (5분)
        const timeoutId = setTimeout(() => {
          console.log('[Claude CLI] Timeout - killing process')
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: 'Timeout: Claude CLI took too long' })}\n\n`))
          claude.kill('SIGTERM')
        }, 5 * 60 * 1000)

        let buffer = ''
        let hasReceivedData = false

        claude.stdout.on('data', (data) => {
          hasReceivedData = true
          console.log('[Claude CLI] stdout data received:', data.toString().substring(0, 100))
          buffer += data.toString()
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const json = JSON.parse(line)
              console.log('[Claude CLI] Parsed event:', json.type, json.name || '', json.tool_use_id || '')

              // 🔥 전체 이벤트 타입 처리
              switch (json.type) {
                case 'system':
                  // 시스템 초기화 메시지 (세션 ID 포함)
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'system',
                    sessionId: json.session_id,
                    tools: json.tools,
                    model: json.model
                  })}\n\n`))
                  break

                case 'thinking':
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'thinking',
                    content: json.thinking || json.content
                  })}\n\n`))
                  break

                case 'tool_use':
                  // 🔥 도구별 세부 정보 전달
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'tool',
                    name: json.name,
                    input: json.input,
                    id: json.id
                  })}\n\n`))

                  // 🔥 Task 도구 사용 시 서브 에이전트 스폰 이벤트
                  // PM이 Task 도구로 서브 에이전트를 spawn하면 클라이언트에 알림
                  if (json.name === 'Task' && json.input?.subagent_type) {
                    // 에이전트 역할 추출 (description이나 prompt에서)
                    const description = json.input.description || ''
                    const prompt = json.input.prompt || ''

                    // 역할 감지
                    let role = 'general'
                    let name = 'Sub Agent'
                    if (description.toLowerCase().includes('frontend') || prompt.toLowerCase().includes('frontend') || prompt.toLowerCase().includes('ui')) {
                      role = 'frontend'
                      name = 'Frontend Developer'
                    } else if (description.toLowerCase().includes('backend') || prompt.toLowerCase().includes('backend') || prompt.toLowerCase().includes('api')) {
                      role = 'backend'
                      name = 'Backend Developer'
                    } else if (description.toLowerCase().includes('test') || prompt.toLowerCase().includes('test')) {
                      role = 'tester'
                      name = 'QA Tester'
                    } else if (description.toLowerCase().includes('security') || prompt.toLowerCase().includes('security')) {
                      role = 'security'
                      name = 'Security Expert'
                    } else if (description.toLowerCase().includes('plan') || prompt.toLowerCase().includes('plan')) {
                      role = 'planner'
                      name = 'Planner'
                    }

                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'agent_spawn',
                      agent: {
                        id: json.id || `agent-${Date.now()}`,
                        name,
                        role,
                        task: description || prompt.substring(0, 100),
                        toolCallId: json.id  // 🔥 Task 결과와 매칭용
                      }
                    })}\n\n`))
                  }
                  break

                case 'tool_result':
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'tool_result',
                    toolUseId: json.tool_use_id,
                    content: json.content,
                    isError: json.is_error
                  })}\n\n`))
                  break

                case 'progress':
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'progress',
                    content: json.message || json.content
                  })}\n\n`))
                  break

                case 'error':
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    content: json.error || json.message
                  })}\n\n`))
                  break

                case 'result':
                  // 최종 결과 (세션 ID, 비용 등 포함)
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'result',
                    content: json.result,
                    sessionId: json.session_id,
                    cost: json.total_cost_usd,
                    duration: json.duration_ms
                  })}\n\n`))
                  break

                case 'assistant':
                  // 텍스트 응답
                  if (json.message?.content) {
                    for (const block of json.message.content) {
                      if (block.type === 'thinking') {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                          type: 'thinking',
                          content: block.thinking
                        })}\n\n`))
                      }
                      if (block.type === 'text') {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                          type: 'text',
                          content: block.text
                        })}\n\n`))
                      }
                      if (block.type === 'tool_use') {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                          type: 'tool',
                          name: block.name,
                          input: block.input,
                          id: block.id
                        })}\n\n`))
                      }
                    }
                  }
                  break
              }
            } catch {}
          }
        })

        claude.stderr.on('data', (data) => {
          const text = data.toString()
          console.log('[Claude CLI] stderr:', text.substring(0, 200))

          // 에러 메시지 전달
          if (text.includes('Error') || text.includes('error')) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              content: text.trim()
            })}\n\n`))
          }
          // 진행 상황 파싱
          else if (text.includes('Reading') || text.includes('Writing') ||
              text.includes('Running') || text.includes('Searching')) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'status',
              content: text.trim()
            })}\n\n`))
          }
        })

        claude.on('close', (code) => {
          clearTimeout(timeoutId)
          console.log('[Claude CLI] Exit code:', code, 'hasReceivedData:', hasReceivedData)
          if (!hasReceivedData && code !== 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: `Claude CLI exited with code ${code} without response` })}\n\n`))
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', code })}\n\n`))
          controller.close()
        })

        claude.on('error', (err) => {
          console.error('[Claude CLI] Error:', err)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            content: err.message
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
      }
    })

  } catch (error: any) {
    console.error('[Claude CLI] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'CLI 연결 실패' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
