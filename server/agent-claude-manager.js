#!/usr/bin/env node
/**
 * Agent Claude Code Manager
 *
 * 각 에이전트별로 독립적인 Claude Code CLI 세션 관리
 * 맥스플랜 1개로 여러 에이전트가 동시에 사용
 */

const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

const execAsync = promisify(exec);

const PORT = process.env.AGENT_CLAUDE_PORT || 3100;
const WORKSPACES_DIR = process.env.WORKSPACES_DIR || path.join(__dirname, '..', 'workspaces');

// 활성 에이전트 세션 저장
const agentSessions = new Map();

// ============================================
// 에이전트 워크스페이스 관리
// ============================================

async function ensureWorkspace(agentId, agentName) {
  const workspacePath = path.join(WORKSPACES_DIR, agentId);

  try {
    await fs.access(workspacePath);
  } catch {
    // 워크스페이스 생성
    await fs.mkdir(workspacePath, { recursive: true });

    // CLAUDE.md 생성 (에이전트 컨텍스트)
    const claudeMd = `# ${agentName} Workspace

This is the dedicated workspace for agent: ${agentName}
Agent ID: ${agentId}

## Instructions
- You are ${agentName}, an AI agent in the GlowUS system
- Execute tasks assigned to you
- Report results back through the system
- Maintain context in this workspace

## Workspace Structure
- /tasks - Current tasks
- /output - Generated outputs
- /logs - Execution logs
`;
    await fs.writeFile(path.join(workspacePath, 'CLAUDE.md'), claudeMd);
    await fs.mkdir(path.join(workspacePath, 'tasks'), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'output'), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'logs'), { recursive: true });
  }

  return workspacePath;
}

// ============================================
// Claude Code CLI 세션 관리
// ============================================

async function startClaudeSession(agentId, agentName) {
  // 이미 실행 중이면 반환
  if (agentSessions.has(agentId)) {
    const session = agentSessions.get(agentId);
    if (session.process && !session.process.killed) {
      return { success: true, message: '세션 이미 실행 중', agentId };
    }
  }

  const workspacePath = await ensureWorkspace(agentId, agentName);

  // Claude Code CLI 찾기
  let claudePath;
  try {
    const { stdout } = await execAsync('which claude');
    claudePath = stdout.trim();
  } catch {
    return { success: false, error: 'Claude Code CLI를 찾을 수 없습니다' };
  }

  // Claude Code 프로세스 시작
  const claudeProcess = spawn(claudePath, ['--dangerously-skip-permissions'], {
    cwd: workspacePath,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      CLAUDE_AGENT_ID: agentId,
      CLAUDE_AGENT_NAME: agentName,
    }
  });

  const session = {
    agentId,
    agentName,
    workspacePath,
    process: claudeProcess,
    startedAt: new Date(),
    outputBuffer: '',
    isReady: false,
    pendingCallbacks: [],
  };

  // stdout 수집
  claudeProcess.stdout.on('data', (data) => {
    const text = data.toString();
    session.outputBuffer += text;
    console.log(`[${agentName}] ${text}`);

    // 준비 완료 감지
    if (text.includes('>') || text.includes('Claude')) {
      session.isReady = true;
      // 대기 중인 콜백 처리
      session.pendingCallbacks.forEach(cb => cb());
      session.pendingCallbacks = [];
    }
  });

  claudeProcess.stderr.on('data', (data) => {
    console.error(`[${agentName} ERROR] ${data.toString()}`);
  });

  claudeProcess.on('exit', (code) => {
    console.log(`[${agentName}] 세션 종료 (code: ${code})`);
    agentSessions.delete(agentId);
  });

  agentSessions.set(agentId, session);

  // 준비될 때까지 대기 (최대 10초)
  await new Promise((resolve) => {
    if (session.isReady) {
      resolve();
    } else {
      session.pendingCallbacks.push(resolve);
      setTimeout(resolve, 10000);
    }
  });

  return {
    success: true,
    message: '세션 시작됨',
    agentId,
    agentName,
    workspacePath,
  };
}

async function stopClaudeSession(agentId) {
  const session = agentSessions.get(agentId);
  if (!session) {
    return { success: false, error: '세션을 찾을 수 없습니다' };
  }

  session.process.kill('SIGTERM');
  agentSessions.delete(agentId);

  return { success: true, message: '세션 종료됨', agentId };
}

async function sendToAgent(agentId, message) {
  const session = agentSessions.get(agentId);
  if (!session) {
    return { success: false, error: '세션을 찾을 수 없습니다. 먼저 시작하세요.' };
  }

  // 이전 출력 클리어
  session.outputBuffer = '';

  // 메시지 전송
  session.process.stdin.write(message + '\n');

  // 응답 대기 (최대 60초)
  await new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      // 응답 완료 감지 (프롬프트가 다시 나타나면)
      if (session.outputBuffer.includes('>') && session.outputBuffer.length > message.length) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 500);

    setTimeout(() => {
      clearInterval(checkInterval);
      resolve();
    }, 60000);
  });

  return {
    success: true,
    agentId,
    response: session.outputBuffer.trim(),
  };
}

function getActiveSessions() {
  const sessions = [];
  for (const [agentId, session] of agentSessions) {
    sessions.push({
      agentId,
      agentName: session.agentName,
      workspacePath: session.workspacePath,
      startedAt: session.startedAt,
      isReady: session.isReady,
    });
  }
  return sessions;
}

// ============================================
// HTTP 서버
// ============================================

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // GET /sessions - 활성 세션 목록
  if (req.method === 'GET' && url.pathname === '/sessions') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sessions: getActiveSessions() }));
    return;
  }

  // GET /health
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', activeSessions: agentSessions.size }));
    return;
  }

  // POST /start - 에이전트 세션 시작
  if (req.method === 'POST' && url.pathname === '/start') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { agentId, agentName } = JSON.parse(body);
        if (!agentId || !agentName) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'agentId와 agentName이 필요합니다' }));
          return;
        }

        console.log(`[Manager] 세션 시작: ${agentName} (${agentId})`);
        const result = await startClaudeSession(agentId, agentName);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /stop - 에이전트 세션 종료
  if (req.method === 'POST' && url.pathname === '/stop') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { agentId } = JSON.parse(body);
        const result = await stopClaudeSession(agentId);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /send - 에이전트에게 메시지 전송
  if (req.method === 'POST' && url.pathname === '/send') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { agentId, message } = JSON.parse(body);
        if (!agentId || !message) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'agentId와 message가 필요합니다' }));
          return;
        }

        console.log(`[Manager] 메시지 전송 → ${agentId}: ${message.substring(0, 50)}...`);
        const result = await sendToAgent(agentId, message);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /execute - 에이전트에게 작업 실행 (시작 + 전송 + 응답)
  if (req.method === 'POST' && url.pathname === '/execute') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { agentId, agentName, task } = JSON.parse(body);
        if (!agentId || !agentName || !task) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'agentId, agentName, task가 필요합니다' }));
          return;
        }

        console.log(`[Manager] 작업 실행: ${agentName} → ${task.substring(0, 50)}...`);

        // 세션이 없으면 시작
        if (!agentSessions.has(agentId)) {
          await startClaudeSession(agentId, agentName);
        }

        // 작업 전송
        const result = await sendToAgent(agentId, task);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║              AGENT CLAUDE CODE MANAGER                          ║
║           에이전트별 Claude Code CLI 세션 관리                    ║
╠════════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                                     ║
║  Workspaces: ${WORKSPACES_DIR.substring(0, 40)}...
╠════════════════════════════════════════════════════════════════╣
║  Endpoints:                                                     ║
║    GET  /health     - 상태 확인                                 ║
║    GET  /sessions   - 활성 세션 목록                            ║
║    POST /start      - 에이전트 세션 시작                        ║
║    POST /stop       - 에이전트 세션 종료                        ║
║    POST /send       - 메시지 전송                               ║
║    POST /execute    - 작업 실행 (자동 시작)                     ║
╚════════════════════════════════════════════════════════════════╝
  `);
});

// 종료 처리
process.on('SIGINT', () => {
  console.log('\n[Manager] 종료 중... 모든 세션 정리');
  for (const [agentId, session] of agentSessions) {
    session.process.kill('SIGTERM');
  }
  server.close();
  process.exit(0);
});
