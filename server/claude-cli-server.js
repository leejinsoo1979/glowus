/**
 * Claude CLI Server (Print Mode)
 * WebSocket 기반 Claude CLI 세션 관리
 * --print 모드 + --output-format stream-json 사용
 */

const WebSocket = require('ws')
const { spawn } = require('child_process')

const PORT = process.env.CLAUDE_CLI_PORT || 3099
const CLAUDE_PATH = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude'

const wss = new WebSocket.Server({ port: PORT, host: '0.0.0.0' })

console.log(`[Claude CLI Server] Starting on port ${PORT}...`)

wss.on('connection', (ws) => {
  console.log('[Claude CLI Server] New connection')

  let sessionId = null
  let currentCwd = process.env.HOME
  let claudeProcess = null
  let isProcessing = false

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      console.log('[Claude CLI Server] Received:', msg.type)

      switch (msg.type) {
        case 'start':
          // 세션 초기화
          initSession(ws, msg)
          break

        case 'message':
          // 메시지 전송 (--print 모드로 실행)
          sendMessage(ws, msg.content)
          break

        case 'resume':
          // 세션 재개
          sessionId = msg.sessionId
          currentCwd = msg.cwd || currentCwd
          ws.send(JSON.stringify({ type: 'ready', sessionId }))
          break

        case 'stop':
          // 현재 작업 중단
          stopCurrentTask(ws)
          break

        case 'close':
          // 세션 종료
          closeSession(ws)
          break
      }
    } catch (e) {
      console.error('[Claude CLI Server] Parse error:', e)
      ws.send(JSON.stringify({ type: 'error', content: 'Invalid message format' }))
    }
  })

  ws.on('close', () => {
    console.log('[Claude CLI Server] Connection closed')
    if (claudeProcess) {
      claudeProcess.kill('SIGTERM')
    }
  })

  ws.on('error', (err) => {
    console.error('[Claude CLI Server] WebSocket error:', err)
  })

  // 세션 초기화
  function initSession(ws, options) {
    console.log('[Claude CLI Server] Init session:', JSON.stringify(options))

    // cwd 설정
    let cwd = options.cwd
    if (!cwd || cwd.includes('@') || !cwd.startsWith('/')) {
      cwd = process.env.HOME
    }
    currentCwd = cwd

    // 기존 세션 ID 사용 또는 새로 생성
    if (options.sessionId) {
      sessionId = options.sessionId
    }

    console.log('[Claude CLI Server] Session initialized, cwd:', currentCwd)
    ws.send(JSON.stringify({
      type: 'started',
      cwd: currentCwd,
      sessionId: sessionId
    }))

    // 바로 ready 상태로 전환
    ws.send(JSON.stringify({ type: 'ready' }))
  }

  // 메시지 전송 (--print 모드)
  function sendMessage(ws, content) {
    if (isProcessing) {
      ws.send(JSON.stringify({ type: 'error', content: '이전 요청 처리 중입니다' }))
      return
    }

    console.log('[Claude CLI Server] Processing message:', content.substring(0, 100))
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
    const { ANTHROPIC_API_KEY, ...envWithoutApiKey } = process.env

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
      console.error('[Claude CLI Server] Process spawn error:', err)
      ws.send(JSON.stringify({ type: 'error', content: `Spawn error: ${err.message}` }))
      isProcessing = false
    })

    if (!claudeProcess.pid) {
      ws.send(JSON.stringify({ type: 'error', content: 'Failed to start Claude CLI' }))
      isProcessing = false
      return
    }

    console.log('[Claude CLI Server] Claude PID:', claudeProcess.pid)

    let buffer = ''

    // stdout 처리 (stream-json 출력)
    claudeProcess.stdout.on('data', (data) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const json = JSON.parse(line)
          handleClaudeEvent(ws, json)
        } catch {
          // JSON이 아닌 출력은 텍스트로 전송
          console.log('[Claude CLI Server] Non-JSON output:', line.substring(0, 200))
        }
      }
    })

    // stderr 처리
    claudeProcess.stderr.on('data', (data) => {
      const text = data.toString()
      console.log('[Claude CLI Server] stderr:', text.substring(0, 500))

      // 에러 메시지 전달
      if (text.includes('error') || text.includes('Error')) {
        ws.send(JSON.stringify({ type: 'status', content: text }))
      }
    })

    claudeProcess.on('close', (code) => {
      console.log('[Claude CLI Server] Process closed with code:', code)

      // 남은 버퍼 처리
      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer)
          handleClaudeEvent(ws, json)
        } catch {
          // 무시
        }
      }

      isProcessing = false
      claudeProcess = null

      // 완료 후 ready 상태
      ws.send(JSON.stringify({ type: 'ready' }))
    })
  }

  // 현재 작업 중단
  function stopCurrentTask(ws) {
    if (claudeProcess) {
      claudeProcess.kill('SIGINT')
      ws.send(JSON.stringify({ type: 'stopped' }))
    }
    isProcessing = false
  }

  // 세션 종료
  function closeSession(ws) {
    if (claudeProcess) {
      claudeProcess.kill('SIGTERM')
    }
    sessionId = null
    isProcessing = false
    ws.send(JSON.stringify({ type: 'closed' }))
  }

  // Claude 이벤트 처리
  function handleClaudeEvent(ws, json) {
    console.log('[Claude CLI Server] Event:', json.type)

    switch (json.type) {
      case 'system':
        // 세션 ID 저장
        if (json.session_id) {
          sessionId = json.session_id
          console.log('[Claude CLI Server] Session ID:', sessionId)
        }
        ws.send(JSON.stringify({
          type: 'system',
          sessionId: json.session_id,
          tools: json.tools,
          model: json.model,
          cwd: json.cwd
        }))
        break

      case 'assistant':
        if (json.message?.content) {
          for (const block of json.message.content) {
            if (block.type === 'text') {
              ws.send(JSON.stringify({ type: 'text', content: block.text }))
            }
            if (block.type === 'thinking') {
              ws.send(JSON.stringify({ type: 'thinking', content: block.thinking }))
            }
            if (block.type === 'tool_use') {
              ws.send(JSON.stringify({
                type: 'tool',
                name: block.name,
                input: block.input,
                id: block.id
              }))
            }
          }
        }
        break

      case 'content_block_start':
        if (json.content_block?.type === 'text') {
          // 텍스트 블록 시작
        } else if (json.content_block?.type === 'tool_use') {
          ws.send(JSON.stringify({
            type: 'tool',
            name: json.content_block.name,
            id: json.content_block.id
          }))
        }
        break

      case 'content_block_delta':
        if (json.delta?.type === 'text_delta') {
          ws.send(JSON.stringify({ type: 'text', content: json.delta.text }))
        } else if (json.delta?.type === 'thinking_delta') {
          ws.send(JSON.stringify({ type: 'thinking', content: json.delta.thinking }))
        } else if (json.delta?.type === 'input_json_delta') {
          // tool input delta - 무시하거나 누적
        }
        break

      case 'tool_use':
        ws.send(JSON.stringify({
          type: 'tool',
          name: json.name,
          input: json.input,
          id: json.id
        }))
        break

      case 'tool_result':
        ws.send(JSON.stringify({
          type: 'tool_result',
          toolUseId: json.tool_use_id,
          content: json.content,
          isError: json.is_error
        }))
        break

      case 'result':
        // 세션 ID 저장
        if (json.session_id) {
          sessionId = json.session_id
        }
        ws.send(JSON.stringify({
          type: 'result',
          content: json.result,
          sessionId: json.session_id,
          cost: json.total_cost_usd,
          duration: json.duration_ms
        }))
        break

      default:
        // 기타 이벤트 전달
        ws.send(JSON.stringify(json))
    }
  }
})

console.log(`[Claude CLI Server] Ready on ws://localhost:${PORT}`)
