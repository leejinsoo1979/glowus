/**
 * Claude Code Automation Server
 *
 * 텔레그램에서 코딩 지시를 받아 Claude Code에 자동으로 전달하는 서버
 *
 * 사용법:
 * 1. 일반 터미널(VS Code 아님)에서 실행: node server/claude-automation-server.js
 * 2. 텔레그램에서 코딩 지시 전송
 * 3. 자동으로 Terminal.app에서 Claude Code 실행 + 프롬프트 입력
 *
 * 포트: 45680
 */

const http = require('http')
const { exec } = require('child_process')
const { promisify } = require('util')

const execPromise = promisify(exec)

const PORT = 45680

// Homebrew 경로 (LaunchAgent에서 PATH가 제한적이므로 절대경로 사용)
const GH_PATH = '/opt/homebrew/bin/gh'
const CLAUDE_PATH = '/opt/homebrew/bin/claude'

/**
 * 텔레그램으로 메시지 전송
 */
async function sendTelegramMessage(chatId, message, botToken) {
  if (!botToken || !chatId) {
    console.log('[Telegram] No bot token or chatId, skipping notification')
    return
  }

  try {
    const https = require('https')
    const data = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    })

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = ''
        res.on('data', chunk => body += chunk)
        res.on('end', () => {
          console.log(`[Telegram] Message sent: ${res.statusCode}`)
          resolve(body)
        })
      })
      req.on('error', reject)
      req.write(data)
      req.end()
    })
  } catch (error) {
    console.error('[Telegram] Send failed:', error.message)
  }
}

/**
 * AppleScript 실행
 */
async function runAppleScript(script) {
  try {
    const { stdout, stderr } = await execPromise(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`)
    return { success: true, output: stdout.trim(), error: stderr }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * 멀티라인 AppleScript 실행 (파일 사용)
 */
async function runMultilineAppleScript(script) {
  const fs = require('fs').promises
  const path = require('path')
  const os = require('os')

  const tempFile = path.join(os.tmpdir(), `claude_automation_${Date.now()}.scpt`)

  try {
    await fs.writeFile(tempFile, script, 'utf-8')
    const { stdout, stderr } = await execPromise(`osascript "${tempFile}"`)
    await fs.unlink(tempFile).catch(() => {})
    return { success: true, output: stdout.trim(), error: stderr }
  } catch (error) {
    await fs.unlink(tempFile).catch(() => {})
    return { success: false, error: error.message }
  }
}

/**
 * Claude Code 실행 및 프롬프트 전달
 */
async function executeClaudeCode(projectPath, prompt, repoName, chatId, telegramBotToken) {
  console.log(`[Claude Automation] Starting...`)
  console.log(`[Claude Automation] Project: ${projectPath}`)
  console.log(`[Claude Automation] Repo: ${repoName}`)
  console.log(`[Claude Automation] ChatId: ${chatId}`)
  console.log(`[Claude Automation] BotToken: ${telegramBotToken ? 'provided' : 'missing'}`)
  console.log(`[Claude Automation] Prompt: ${prompt.substring(0, 100)}...`)

  // 프로젝트 이름 추출
  const projectName = repoName || projectPath.split('/').pop()

  // GitHub 유저명 가져오기
  let githubUsername = 'unknown'
  try {
    const { stdout } = await execPromise(`${GH_PATH} api user -q .login`)
    githubUsername = stdout.trim()
  } catch (e) {
    console.log('[Claude Automation] Could not get GitHub username')
  }

  let repoUrl = `https://github.com/${githubUsername}/${projectName}`
  let repoCreated = false

  // 0. GitHub 레포 생성 + 클론 (gh CLI 사용)
  try {
    // 레포 존재 확인
    const { stdout: repoCheck } = await execPromise(`${GH_PATH} repo view ${projectName} 2>/dev/null || echo "NOT_FOUND"`)

    if (repoCheck.includes('NOT_FOUND')) {
      console.log(`[Claude Automation] Creating GitHub repo: ${projectName}`)
      // 부모 디렉토리 생성
      const parentDir = projectPath.split('/').slice(0, -1).join('/')
      await execPromise(`mkdir -p '${parentDir}'`)
      // 레포 생성 (public, 빈 레포)
      await execPromise(`${GH_PATH} repo create ${projectName} --public --clone --add-readme`, {
        cwd: parentDir
      })
      console.log(`[Claude Automation] GitHub repo created and cloned`)
      repoCreated = true
    } else {
      console.log(`[Claude Automation] Repo exists, cloning...`)
      // 이미 존재하면 클론
      const parentDir = projectPath.split('/').slice(0, -1).join('/')
      await execPromise(`mkdir -p '${parentDir}'`)
      await execPromise(`${GH_PATH} repo clone ${projectName} '${projectPath}'`).catch(() => {
        // 이미 클론되어 있을 수 있음
        console.log(`[Claude Automation] Directory may already exist`)
      })
    }
  } catch (error) {
    console.log(`[Claude Automation] GitHub setup skipped: ${error.message}`)
    // GitHub 설정 실패해도 로컬에서 계속 진행
    await execPromise(`mkdir -p '${projectPath.replace(/'/g, "'\\''")}'`)
    repoUrl = null
  }

  // 프롬프트에서 특수문자 이스케이프 (zsh 호환)
  const escapedPrompt = prompt
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\"'\"'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/\[/g, '\\[')      // zsh glob pattern
    .replace(/\]/g, '\\]')      // zsh glob pattern
    .replace(/\(/g, '\\(')      // subshell
    .replace(/\)/g, '\\)')      // subshell
    .replace(/\$/g, '\\$')      // variable expansion
    .replace(/`/g, '\\`')       // command substitution
    .replace(/!/g, '\\!')       // history expansion
    .replace(/\*/g, '\\*')      // glob
    .replace(/\?/g, '\\?')      // glob

  // 시작 알림
  await sendTelegramMessage(chatId, `🚀 <b>Claude Code 시작 중...</b>\n\n📁 ${projectName}\n${repoUrl ? `🔗 ${repoUrl}` : ''}`, telegramBotToken)

  // Claude Code를 --print 모드로 실행 (출력 캡처)
  // --print: 비대화형 모드로 실행 후 종료
  // --dangerously-skip-permissions: 권한 확인 없이 자동 실행
  const claudeCommand = `cd '${projectPath.replace(/'/g, "'\\''")}' && ${CLAUDE_PATH} --print --dangerously-skip-permissions "${escapedPrompt}" 2>&1`

  console.log(`[Claude Automation] Running Claude Code in print mode...`)
  console.log(`[Claude Automation] Command: ${claudeCommand.substring(0, 200)}...`)

  // 진행 중 알림
  await sendTelegramMessage(chatId, `⏳ <b>Claude Code 작업 중...</b>\n\n잠시 기다려 주세요. 완료되면 알림드립니다.`, telegramBotToken)

  try {
    // Claude Code 실행 (최대 10분 타임아웃)
    const { stdout, stderr } = await execPromise(claudeCommand, {
      maxBuffer: 50 * 1024 * 1024, // 50MB
      timeout: 600000, // 10분
      env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
    })

    console.log(`[Claude Automation] Claude Code completed`)
    console.log(`[Claude Automation] Output length: ${stdout.length}`)

    // 출력에서 중요 정보 추출
    const output = stdout || ''
    const filesCreated = (output.match(/(?:Created|Writing|Wrote|Creating)\s+[\w\/.]+/gi) || []).slice(0, 10)
    const gitCommit = output.match(/\[[\w-]+\s+[\da-f]+\]/)?.[0] || ''

    // 완료 알림
    const completionMessage = `✅ <b>Claude Code 작업 완료!</b>

📁 <b>프로젝트:</b> ${projectName}
📂 <b>경로:</b> <code>${projectPath}</code>
${repoUrl ? `🔗 <b>GitHub:</b> ${repoUrl}` : ''}

${filesCreated.length > 0 ? `📄 <b>생성된 파일:</b>\n${filesCreated.map(f => `  • ${f}`).join('\n')}` : ''}
${gitCommit ? `\n🔖 <b>Git:</b> ${gitCommit}` : ''}

${output.length > 500 ? `\n📝 <b>요약:</b>\n<i>${output.substring(0, 500)}...</i>` : ''}`

    await sendTelegramMessage(chatId, completionMessage, telegramBotToken)

    return {
      success: true,
      message: 'Claude Code completed',
      repoUrl,
      projectName,
      projectPath,
      output: output.substring(0, 1000)
    }

  } catch (execError) {
    console.error(`[Claude Automation] Claude Code error:`, execError.message)

    // 에러 알림
    await sendTelegramMessage(chatId, `❌ <b>Claude Code 오류</b>\n\n프로젝트: ${projectName}\n오류: ${execError.message?.substring(0, 500) || '알 수 없는 오류'}`, telegramBotToken)

    return {
      success: false,
      error: execError.message,
      repoUrl,
      projectName,
      projectPath
    }
  }
}

/**
 * HTTP 서버
 */
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'claude-automation-server' }))
    return
  }

  // Execute Claude Code
  if (req.method === 'POST' && req.url === '/execute') {
    let body = ''

    req.on('data', chunk => {
      body += chunk.toString()
    })

    req.on('end', async () => {
      try {
        const { projectPath, prompt, repoName, chatId, telegramBotToken } = JSON.parse(body)

        if (!projectPath || !prompt) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Missing projectPath or prompt' }))
          return
        }

        const result = await executeClaudeCode(projectPath, prompt, repoName, chatId, telegramBotToken)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: error.message }))
      }
    })

    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

// IPv4에서 명시적으로 리스닝 (Next.js 호환성)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           Claude Code Automation Server                     ║
╠════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                               ║
║                                                            ║
║  Endpoints:                                                ║
║    GET  /health   - Health check                           ║
║    POST /execute  - Execute Claude Code with prompt        ║
║                                                            ║
║  Body format for /execute:                                 ║
║  {                                                         ║
║    "projectPath": "/path/to/project",                      ║
║    "prompt": "Create a Tetris game..."                     ║
║  }                                                         ║
║                                                            ║
║  ⚠️  이 서버는 일반 터미널에서 실행하세요 (VS Code 아님)     ║
╚════════════════════════════════════════════════════════════╝
`)
})
