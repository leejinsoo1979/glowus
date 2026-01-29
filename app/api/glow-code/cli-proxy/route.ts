import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import {
  buildProjectContext,
  buildSystemPrompt,
  buildMemoryContext,
  addMemory
} from '@/lib/glow-code/skills-loader'

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

    // 🔥 시스템 프롬프트 구성 (스킬 포함)
    let systemPrompt = ''
    if (options.includeSkills !== false || options.includeProjectContext !== false) {
      try {
        const projectContext = await buildProjectContext(cwd)
        systemPrompt = buildSystemPrompt(projectContext)
        console.log('[Claude CLI] System prompt built with', projectContext.skills.length, 'skills')
      } catch (e) {
        console.warn('[Claude CLI] Failed to build system prompt:', e)
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

    // 🔥 최종 프롬프트 구성
    let prompt = lastUserMessage.content

    // 선택된 코드가 있을 경우
    if (context?.selectedCode) {
      prompt = `${memoryContext ? memoryContext + '\n\n' : ''}## 현재 작업 컨텍스트

현재 파일: ${context.fileName || 'unknown'}
선택된 코드:
\`\`\`${context.language || ''}
${context.selectedCode}
\`\`\`

질문: ${lastUserMessage.content}
`.trim()
    } else if (memoryContext) {
      prompt = `${memoryContext}

## 사용자 요청

${lastUserMessage.content}
`.trim()
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
    console.log('[Claude CLI] System prompt length:', systemPrompt.length, 'chars')

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
          args.push('--continue', '--session-id', options.sessionId)
        }

        args.push('-p', prompt)
        args.push('--output-format', 'stream-json')
        args.push('--verbose')  // Required for stream-json with -p
        args.push('--dangerously-skip-permissions')  // 비대화형으로 권한 스킵

        // 모델 지정
        if (options.model) {
          args.push('--model', options.model)
        }

        // 허용 도구
        if (options.allowedTools?.length) {
          args.push('--allowedTools', options.allowedTools.join(','))
        }

        // 최대 턴 수
        if (options.maxTurns) {
          args.push('--max-turns', String(options.maxTurns))
        }

        console.log('[Claude CLI] Args:', args.slice(0, 4).join(' '), '...')
        console.log('[Claude CLI] CWD:', cwd)

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', content: 'Starting Claude CLI...' })}\n\n`))

        // claude CLI 경로 (PATH에서 찾거나 homebrew 기본 경로 사용)
        const claudePath = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude'

        const claude = spawn(claudePath, args, {
          cwd,
          env: {
            ...process.env,
            CI: 'true',  // 비대화형 모드
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

        let buffer = ''

        claude.stdout.on('data', (data) => {
          console.log('[Claude CLI] stdout data received:', data.toString().substring(0, 100))
          buffer += data.toString()
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const json = JSON.parse(line)

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
          console.log('[Claude CLI] Exit code:', code)
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
