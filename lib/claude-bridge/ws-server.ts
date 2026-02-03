/**
 * Claude CLI WebSocket Server
 * Next.js instrumentation에서 자동 시작되는 내장 WebSocket 서버
 * --print 모드 + --output-format stream-json 사용
 */

import { WebSocketServer, WebSocket } from 'ws'
import { spawn, ChildProcess } from 'child_process'

const PORT = parseInt(process.env.CLAUDE_CLI_PORT || '3099', 10)
const CLAUDE_PATH = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude'

let wss: WebSocketServer | null = null

/**
 * Claude CLI WebSocket 서버 시작
 * Next.js 서버와 함께 자동으로 실행됨
 */
export function startClaudeCLIServer(): void {
  if (wss) {
    console.log('[Claude CLI WS] Server already running')
    return
  }

  try {
    wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' })
    console.log(`[Claude CLI WS] Server starting on port ${PORT}...`)

    wss.on('connection', handleConnection)

    wss.on('error', (error: Error & { code?: string }) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`[Claude CLI WS] Port ${PORT} already in use, assuming server is running`)
        wss = null
      } else {
        console.error('[Claude CLI WS] Server error:', error)
      }
    })

    console.log(`[Claude CLI WS] Ready on ws://localhost:${PORT}`)
  } catch (error) {
    console.error('[Claude CLI WS] Failed to start server:', error)
  }
}

/**
 * WebSocket 연결 핸들러
 */
function handleConnection(ws: WebSocket): void {
  console.log('[Claude CLI WS] New connection')

  let sessionId: string | null = null
  let currentCwd = process.env.HOME || '~'
  let claudeProcess: ChildProcess | null = null
  let isProcessing = false

  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString())
      console.log('[Claude CLI WS] Received:', msg.type)

      switch (msg.type) {
        case 'start':
          initSession(msg)
          break

        case 'message':
          sendMessage(msg.content)
          break

        case 'resume':
          sessionId = msg.sessionId
          currentCwd = msg.cwd || currentCwd
          safeSend({ type: 'ready', sessionId })
          break

        case 'stop':
          stopCurrentTask()
          break

        case 'close':
          closeSession()
          break
      }
    } catch (e) {
      console.error('[Claude CLI WS] Parse error:', e)
      safeSend({ type: 'error', content: 'Invalid message format' })
    }
  })

  ws.on('close', () => {
    console.log('[Claude CLI WS] Connection closed')
    if (claudeProcess) {
      claudeProcess.kill('SIGTERM')
    }
  })

  ws.on('error', (err) => {
    console.error('[Claude CLI WS] WebSocket error:', err)
  })

  // Safe send helper
  function safeSend(data: object): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    }
  }

  // 세션 초기화
  function initSession(options: { cwd?: string; sessionId?: string }): void {
    console.log('[Claude CLI WS] Init session:', JSON.stringify(options))

    // cwd 설정
    let cwd = options.cwd
    if (!cwd || cwd.includes('@') || !cwd.startsWith('/')) {
      cwd = process.env.HOME || '~'
    }
    currentCwd = cwd

    // 기존 세션 ID 사용 또는 새로 생성
    if (options.sessionId) {
      sessionId = options.sessionId
    }

    console.log('[Claude CLI WS] Session initialized, cwd:', currentCwd)
    safeSend({
      type: 'started',
      cwd: currentCwd,
      sessionId: sessionId
    })

    // 바로 ready 상태로 전환
    safeSend({ type: 'ready' })
  }

  // 메시지 전송 (--print 모드)
  function sendMessage(content: string): void {
    if (isProcessing) {
      safeSend({ type: 'error', content: '이전 요청 처리 중입니다' })
      return
    }

    console.log('[Claude CLI WS] Processing message:', content.substring(0, 100))
    isProcessing = true

    const args = [
      '--print', content,
      '--output-format', 'stream-json',
      '--verbose',
      '--permission-mode', 'acceptEdits'
    ]

    // 세션 재개 (대화 이어가기)
    if (sessionId) {
      args.push('--resume', sessionId)
    }

    // ANTHROPIC_API_KEY 제거 (Max 플랜 OAuth 사용)
    const envWithoutApiKey = { ...process.env }
    delete envWithoutApiKey.ANTHROPIC_API_KEY

    claudeProcess = spawn(CLAUDE_PATH, args, {
      cwd: currentCwd,
      env: {
        ...envWithoutApiKey,
        TERM: 'xterm-256color',
        NO_COLOR: '1',
        PATH: process.env.PATH,
        HOME: process.env.HOME
      },
      stdio: ['ignore', 'pipe', 'pipe']  // stdin을 ignore로 변경
    })

    claudeProcess.on('error', (err) => {
      console.error('[Claude CLI WS] Process spawn error:', err)
      safeSend({ type: 'error', content: `Spawn error: ${err.message}` })
      isProcessing = false
    })

    if (!claudeProcess.pid) {
      safeSend({ type: 'error', content: 'Failed to start Claude CLI' })
      isProcessing = false
      return
    }

    console.log('[Claude CLI WS] Claude PID:', claudeProcess.pid)

    let buffer = ''

    // stdout 처리 (stream-json 출력)
    claudeProcess.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const json = JSON.parse(line)
          handleClaudeEvent(json)
        } catch {
          // JSON이 아닌 출력은 무시
          console.log('[Claude CLI WS] Non-JSON output:', line.substring(0, 200))
        }
      }
    })

    // stderr 처리
    claudeProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString()
      console.log('[Claude CLI WS] stderr:', text.substring(0, 500))

      // 에러 메시지 전달
      if (text.includes('error') || text.includes('Error')) {
        safeSend({ type: 'status', content: text })
      }
    })

    claudeProcess.on('close', (code) => {
      console.log('[Claude CLI WS] Process closed with code:', code)

      // 남은 버퍼 처리
      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer)
          handleClaudeEvent(json)
        } catch {
          // 무시
        }
      }

      isProcessing = false
      claudeProcess = null

      // 완료 후 ready 상태
      safeSend({ type: 'ready' })
    })
  }

  // 현재 작업 중단
  function stopCurrentTask(): void {
    if (claudeProcess) {
      claudeProcess.kill('SIGINT')
      safeSend({ type: 'stopped' })
    }
    isProcessing = false
  }

  // 세션 종료
  function closeSession(): void {
    if (claudeProcess) {
      claudeProcess.kill('SIGTERM')
    }
    sessionId = null
    isProcessing = false
    safeSend({ type: 'closed' })
  }

  // Claude 이벤트 처리
  function handleClaudeEvent(json: any): void {
    console.log('[Claude CLI WS] Event:', json.type)

    switch (json.type) {
      case 'system':
        // 세션 ID 저장
        if (json.session_id) {
          sessionId = json.session_id
          console.log('[Claude CLI WS] Session ID:', sessionId)
        }
        safeSend({
          type: 'system',
          sessionId: json.session_id,
          tools: json.tools,
          model: json.model,
          cwd: json.cwd
        })
        break

      case 'assistant':
        if (json.message?.content) {
          for (const block of json.message.content) {
            if (block.type === 'text') {
              safeSend({ type: 'text', content: block.text })
            }
            if (block.type === 'thinking') {
              safeSend({ type: 'thinking', content: block.thinking })
            }
            if (block.type === 'tool_use') {
              safeSend({
                type: 'tool',
                name: block.name,
                input: block.input,
                id: block.id
              })
            }
          }
        }
        break

      case 'content_block_start':
        if (json.content_block?.type === 'text') {
          // 텍스트 블록 시작
        } else if (json.content_block?.type === 'tool_use') {
          safeSend({
            type: 'tool',
            name: json.content_block.name,
            id: json.content_block.id
          })
        }
        break

      case 'content_block_delta':
        if (json.delta?.type === 'text_delta') {
          safeSend({ type: 'text', content: json.delta.text })
        } else if (json.delta?.type === 'thinking_delta') {
          safeSend({ type: 'thinking', content: json.delta.thinking })
        } else if (json.delta?.type === 'input_json_delta') {
          // tool input delta - 무시하거나 누적
        }
        break

      case 'tool_use':
        safeSend({
          type: 'tool',
          name: json.name,
          input: json.input,
          id: json.id
        })
        break

      case 'tool_result':
        safeSend({
          type: 'tool_result',
          toolUseId: json.tool_use_id,
          content: json.content,
          isError: json.is_error
        })
        break

      case 'result':
        // 세션 ID 저장
        if (json.session_id) {
          sessionId = json.session_id
        }
        safeSend({
          type: 'result',
          content: json.result,
          sessionId: json.session_id,
          cost: json.total_cost_usd,
          duration: json.duration_ms
        })
        break

      default:
        // 기타 이벤트 전달
        safeSend(json)
    }
  }
}

/**
 * Claude CLI WebSocket 서버 중지
 */
export function stopClaudeCLIServer(): void {
  if (wss) {
    wss.close()
    wss = null
    console.log('[Claude CLI WS] Server stopped')
  }
}
