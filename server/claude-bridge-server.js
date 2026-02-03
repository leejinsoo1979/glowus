#!/usr/bin/env node
/**
 * Claude Code CLI Bridge Server
 *
 * 웹 브라우저에서 Claude Code CLI를 사용하기 위한 로컬 브릿지 서버
 * Max 플랜 사용 시 API 비용 없이 CLI를 통해 Claude를 호출할 수 있음
 *
 * 사용법:
 *   node server/claude-bridge-server.js
 *   또는
 *   npm run claude-bridge
 *
 * 환경변수:
 *   CLAUDE_BRIDGE_PORT - 포트 번호 (기본값: 3333)
 *   CLAUDE_BRIDGE_CWD - 기본 작업 디렉토리
 */

const express = require('express')
const cors = require('cors')
const { spawn } = require('child_process')
const path = require('path')
const os = require('os')

const app = express()
const PORT = process.env.CLAUDE_BRIDGE_PORT || 3333
const DEFAULT_CWD = process.env.CLAUDE_BRIDGE_CWD || process.cwd()

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json({ limit: '50mb' }))

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    platform: os.platform(),
    cwd: DEFAULT_CWD,
    claudeCodeVersion: getClaudeCodeVersion(),
  })
})

// Get Claude Code version
function getClaudeCodeVersion() {
  try {
    const { execSync } = require('child_process')
    const version = execSync('claude --version', { encoding: 'utf8', timeout: 5000 })
    return version.trim()
  } catch {
    return 'unknown'
  }
}

// Check if Claude Code CLI is available
app.get('/check-cli', (req, res) => {
  const { execSync } = require('child_process')
  try {
    execSync('which claude || where claude', { encoding: 'utf8', timeout: 5000 })
    res.json({ available: true, version: getClaudeCodeVersion() })
  } catch {
    res.json({ available: false, error: 'Claude Code CLI not found. Please install it first.' })
  }
})

/**
 * POST /claude
 * Claude Code CLI에 프롬프트 전송 (스트리밍 응답)
 */
app.post('/claude', async (req, res) => {
  const { prompt, cwd, options = {} } = req.body

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' })
  }

  const workDir = cwd || DEFAULT_CWD

  // SSE 헤더 설정
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  try {
    // Claude Code CLI 실행
    // 🔥 프롬프트를 안전하게 이스케이프 (shell: true 사용시 필수)
    const escapedPrompt = prompt.replace(/'/g, "'\\''")

    const args = ['-p', `'${escapedPrompt}'`, '--output-format', 'stream-json']

    // 추가 옵션 처리
    if (options.model) {
      args.push('--model', options.model)
    }
    if (options.verbose) {
      args.push('--verbose')
    }
    if (options.maxTokens) {
      args.push('--max-tokens', String(options.maxTokens))
    }
    if (options.allowedTools) {
      args.push('--allowedTools', options.allowedTools.join(','))
    }
    if (options.disallowedTools) {
      args.push('--disallowedTools', options.disallowedTools.join(','))
    }

    console.log(`[Claude Bridge] Executing: claude ${args.join(' ')}`)
    console.log(`[Claude Bridge] CWD: ${workDir}`)

    const claude = spawn('claude', args, {
      cwd: workDir,
      env: { ...process.env },
      shell: true,  // 🔥 shell: true로 이스케이프된 프롬프트 전달
    })

    let fullContent = ''
    let errorOutput = ''

    claude.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean)

      for (const line of lines) {
        try {
          const json = JSON.parse(line)

          // stream-json 형식 처리
          if (json.type === 'assistant' && json.message) {
            // 텍스트 콘텐츠 추출
            for (const block of json.message.content || []) {
              if (block.type === 'thinking') {
                // 🔥 Thinking 블록 (Extended Thinking)
                res.write(`data: ${JSON.stringify({ type: 'thinking', content: block.thinking })}\n\n`)
              } else if (block.type === 'text') {
                fullContent += block.text
                res.write(`data: ${JSON.stringify({ type: 'text', content: fullContent, delta: block.text })}\n\n`)
              } else if (block.type === 'tool_use') {
                res.write(`data: ${JSON.stringify({ type: 'tool_use', tool: block.name, input: block.input })}\n\n`)
              }
            }
          } else if (json.type === 'thinking') {
            // 🔥 Thinking 이벤트 (별도 이벤트로 올 경우)
            res.write(`data: ${JSON.stringify({ type: 'thinking', content: json.thinking || json.content })}\n\n`)
          } else if (json.type === 'content_block_delta') {
            // 델타 형식
            if (json.delta?.text) {
              fullContent += json.delta.text
              res.write(`data: ${JSON.stringify({ type: 'text', content: fullContent, delta: json.delta.text })}\n\n`)
            }
          } else if (json.type === 'result') {
            // 최종 결과
            res.write(`data: ${JSON.stringify({ type: 'result', content: json.result || fullContent, cost: json.cost_usd })}\n\n`)
          } else {
            // 기타 이벤트 전달
            res.write(`data: ${JSON.stringify(json)}\n\n`)
          }
        } catch {
          // JSON이 아닌 출력은 텍스트로 처리
          if (line.trim()) {
            fullContent += line
            res.write(`data: ${JSON.stringify({ type: 'text', content: fullContent, delta: line })}\n\n`)
          }
        }
      }
    })

    claude.stderr.on('data', (data) => {
      errorOutput += data.toString()
      console.error(`[Claude Bridge] stderr: ${data}`)
      res.write(`data: ${JSON.stringify({ type: 'error', message: data.toString() })}\n\n`)
    })

    claude.on('close', (code) => {
      console.log(`[Claude Bridge] Process exited with code ${code}`)

      if (code === 0) {
        res.write(`data: ${JSON.stringify({ type: 'done', content: fullContent })}\n\n`)
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', code, message: errorOutput || 'Process exited with error' })}\n\n`)
      }
      res.end()
    })

    claude.on('error', (err) => {
      console.error(`[Claude Bridge] Spawn error:`, err)
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`)
      res.end()
    })

    // 클라이언트 연결 종료 시 프로세스 정리
    req.on('close', () => {
      if (!claude.killed) {
        claude.kill('SIGTERM')
        console.log('[Claude Bridge] Client disconnected, process terminated')
      }
    })

  } catch (err) {
    console.error(`[Claude Bridge] Error:`, err)
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`)
    res.end()
  }
})

/**
 * POST /claude/with-file
 * 파일 내용과 함께 Claude에게 질문
 */
app.post('/claude/with-file', async (req, res) => {
  const { prompt, code, language, filename, cwd, options = {} } = req.body

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' })
  }

  // 파일 내용을 프롬프트에 포함
  let fullPrompt = prompt
  if (code) {
    const lang = language || 'text'
    const fname = filename || 'code'
    fullPrompt = `다음은 ${fname} 파일의 내용입니다:\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n${prompt}`
  }

  // /claude 엔드포인트로 리다이렉트
  req.body.prompt = fullPrompt

  // SSE 헤더 설정
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const workDir = cwd || DEFAULT_CWD

  try {
    const args = [
      '--output-format', 'stream-json',
      '--print',
    ]

    if (options.model) args.push('--model', options.model)
    if (options.maxTokens) args.push('--max-tokens', String(options.maxTokens))

    args.push(fullPrompt)

    console.log(`[Claude Bridge] With file - Executing claude`)
    console.log(`[Claude Bridge] CWD: ${workDir}`)
    console.log(`[Claude Bridge] Code length: ${code?.length || 0} chars`)

    const claude = spawn('claude', args, {
      cwd: workDir,
      env: { ...process.env },
      shell: true,  // 🔥 shell: true로 이스케이프된 프롬프트 전달
    })

    let fullContent = ''

    claude.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean)

      for (const line of lines) {
        try {
          const json = JSON.parse(line)

          if (json.type === 'assistant' && json.message) {
            for (const block of json.message.content || []) {
              if (block.type === 'text') {
                fullContent += block.text
                res.write(`data: ${JSON.stringify({ type: 'text', content: fullContent, delta: block.text })}\n\n`)
              }
            }
          } else if (json.type === 'content_block_delta' && json.delta?.text) {
            fullContent += json.delta.text
            res.write(`data: ${JSON.stringify({ type: 'text', content: fullContent, delta: json.delta.text })}\n\n`)
          } else if (json.type === 'result') {
            res.write(`data: ${JSON.stringify({ type: 'result', content: json.result || fullContent })}\n\n`)
          } else {
            res.write(`data: ${JSON.stringify(json)}\n\n`)
          }
        } catch {
          if (line.trim()) {
            fullContent += line
            res.write(`data: ${JSON.stringify({ type: 'text', content: fullContent, delta: line })}\n\n`)
          }
        }
      }
    })

    claude.stderr.on('data', (data) => {
      console.error(`[Claude Bridge] stderr: ${data}`)
      res.write(`data: ${JSON.stringify({ type: 'error', message: data.toString() })}\n\n`)
    })

    claude.on('close', (code) => {
      if (code === 0) {
        res.write(`data: ${JSON.stringify({ type: 'done', content: fullContent })}\n\n`)
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', code })}\n\n`)
      }
      res.end()
    })

    req.on('close', () => {
      if (!claude.killed) {
        claude.kill('SIGTERM')
      }
    })

  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`)
    res.end()
  }
})

/**
 * POST /claude/edit
 * 파일 편집 요청 (Claude가 직접 파일 수정)
 */
app.post('/claude/edit', async (req, res) => {
  const { prompt, filepath, cwd, options = {} } = req.body

  if (!prompt || !filepath) {
    return res.status(400).json({ error: 'prompt and filepath are required' })
  }

  const workDir = cwd || DEFAULT_CWD
  const fullPath = path.isAbsolute(filepath) ? filepath : path.join(workDir, filepath)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    // 파일 편집을 위한 프롬프트 구성
    const editPrompt = `${filepath} 파일을 다음과 같이 수정해줘: ${prompt}`

    const args = [
      '--output-format', 'stream-json',
      '--print',
      '--allowedTools', 'Edit,Write,Read',  // 파일 편집 도구만 허용
    ]

    if (options.model) args.push('--model', options.model)

    args.push(editPrompt)

    const claude = spawn('claude', args, {
      cwd: workDir,
      env: { ...process.env },
      shell: true,  // 🔥 shell: true로 이스케이프된 프롬프트 전달
    })

    let fullContent = ''

    claude.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean)

      for (const line of lines) {
        try {
          const json = JSON.parse(line)

          if (json.type === 'assistant' && json.message) {
            for (const block of json.message.content || []) {
              if (block.type === 'text') {
                fullContent += block.text
                res.write(`data: ${JSON.stringify({ type: 'text', content: fullContent, delta: block.text })}\n\n`)
              } else if (block.type === 'tool_use') {
                res.write(`data: ${JSON.stringify({ type: 'tool_use', tool: block.name, input: block.input })}\n\n`)
              }
            }
          } else if (json.type === 'tool_result') {
            res.write(`data: ${JSON.stringify({ type: 'tool_result', result: json.content })}\n\n`)
          } else {
            res.write(`data: ${JSON.stringify(json)}\n\n`)
          }
        } catch {
          if (line.trim()) {
            fullContent += line
            res.write(`data: ${JSON.stringify({ type: 'text', delta: line })}\n\n`)
          }
        }
      }
    })

    claude.stderr.on('data', (data) => {
      res.write(`data: ${JSON.stringify({ type: 'error', message: data.toString() })}\n\n`)
    })

    claude.on('close', (code) => {
      res.write(`data: ${JSON.stringify({ type: 'done', code, content: fullContent })}\n\n`)
      res.end()
    })

    req.on('close', () => {
      if (!claude.killed) claude.kill('SIGTERM')
    })

  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`)
    res.end()
  }
})

/**
 * POST /claude/conversation
 * 대화 컨텍스트를 유지하며 Claude와 대화 (세션 기반)
 */
const sessions = new Map()

app.post('/claude/conversation', async (req, res) => {
  const { sessionId, prompt, cwd, options = {} } = req.body

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' })
  }

  const workDir = cwd || DEFAULT_CWD

  // 세션 관리
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      messages: [],
      createdAt: new Date(),
    })
  }

  const session = sessions.get(sessionId)
  session.messages.push({ role: 'user', content: prompt })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    // 대화 히스토리를 포함한 프롬프트 구성
    const contextPrompt = session.messages
      .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
      .join('\n\n')

    const args = [
      '--output-format', 'stream-json',
      '--print',
    ]

    if (options.model) args.push('--model', options.model)
    args.push(contextPrompt)

    const claude = spawn('claude', args, {
      cwd: workDir,
      env: { ...process.env },
      shell: true,  // 🔥 shell: true로 이스케이프된 프롬프트 전달
    })

    let fullContent = ''

    claude.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean)

      for (const line of lines) {
        try {
          const json = JSON.parse(line)

          if (json.type === 'assistant' && json.message) {
            for (const block of json.message.content || []) {
              if (block.type === 'text') {
                fullContent += block.text
                res.write(`data: ${JSON.stringify({ type: 'text', content: fullContent, delta: block.text })}\n\n`)
              }
            }
          } else if (json.type === 'content_block_delta' && json.delta?.text) {
            fullContent += json.delta.text
            res.write(`data: ${JSON.stringify({ type: 'text', content: fullContent, delta: json.delta.text })}\n\n`)
          }
        } catch {
          if (line.trim()) {
            fullContent += line
          }
        }
      }
    })

    claude.on('close', (code) => {
      // 응답을 세션에 저장
      if (fullContent) {
        session.messages.push({ role: 'assistant', content: fullContent })
      }

      res.write(`data: ${JSON.stringify({
        type: 'done',
        content: fullContent,
        sessionId,
        messageCount: session.messages.length
      })}\n\n`)
      res.end()
    })

    req.on('close', () => {
      if (!claude.killed) claude.kill('SIGTERM')
    })

  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`)
    res.end()
  }
})

// 세션 삭제
app.delete('/claude/conversation/:sessionId', (req, res) => {
  const { sessionId } = req.params
  sessions.delete(sessionId)
  res.json({ success: true })
})

// 세션 목록
app.get('/claude/sessions', (req, res) => {
  const list = []
  for (const [id, session] of sessions) {
    list.push({
      id,
      messageCount: session.messages.length,
      createdAt: session.createdAt,
    })
  }
  res.json(list)
})

// 서버 시작
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🚀 Claude Code Bridge Server                               ║
║                                                              ║
║   Port: ${PORT}                                                ║
║   CWD:  ${DEFAULT_CWD.substring(0, 45).padEnd(45)}║
║                                                              ║
║   Endpoints:                                                 ║
║   - GET  /health              서버 상태 확인                 ║
║   - GET  /check-cli           CLI 설치 확인                  ║
║   - POST /claude              프롬프트 전송 (SSE)            ║
║   - POST /claude/with-file    파일과 함께 질문               ║
║   - POST /claude/edit         파일 편집 요청                 ║
║   - POST /claude/conversation 대화 세션                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Claude Bridge] Shutting down...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[Claude Bridge] Shutting down...')
  process.exit(0)
})
