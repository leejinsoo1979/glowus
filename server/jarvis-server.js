/**
 * Jarvis Server - 완전한 대화형 Claude Code + PC 제어
 *
 * 기능:
 * 1. PTY 기반 실시간 대화형 Claude Code 세션
 * 2. 도구 실행 전 권한 승인 요청 → 웹 UI
 * 3. GlowUS 앱 제어
 * 4. PC 제어 (앱 실행, 파일, 시스템)
 */

const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const os = require('os');
const { spawn, exec } = require('child_process');

const PORT = process.env.JARVIS_PORT || 3098;
const CLAUDE_PATH = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude';

const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });

console.log(`[Jarvis] Starting on port ${PORT}...`);

// 연결된 클라이언트
const clients = new Map(); // ws -> { type, ptyProcess, pendingPermissions }

// 권한 요청 대기열
const pendingPermissions = new Map(); // requestId -> { ws, resolve, reject, timeout }

wss.on('connection', (ws) => {
  console.log('[Jarvis] New connection');

  const client = {
    type: 'unknown',
    ptyProcess: null,
    sessionId: null,
    cwd: process.env.HOME,
    pendingPermissions: new Map(),
  };

  clients.set(ws, client);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleMessage(ws, client, msg);
    } catch (e) {
      console.error('[Jarvis] Parse error:', e);
    }
  });

  ws.on('close', () => {
    console.log('[Jarvis] Connection closed');
    cleanup(ws, client);
  });

  ws.on('error', (err) => {
    console.error('[Jarvis] WebSocket error:', err);
    cleanup(ws, client);
  });
});

/**
 * 메시지 핸들러
 */
function handleMessage(ws, client, msg) {
  console.log('[Jarvis] Received:', msg.type);

  switch (msg.type) {
    // ===== Claude Code 세션 =====
    case 'start':
      startClaudeSession(ws, client, msg);
      break;

    case 'input':
      // 사용자 입력을 PTY에 전송
      if (client.ptyProcess) {
        client.ptyProcess.write(msg.data);
      }
      break;

    case 'resize':
      if (client.ptyProcess) {
        client.ptyProcess.resize(msg.cols || 120, msg.rows || 30);
      }
      break;

    case 'stop':
      // Ctrl+C 전송
      if (client.ptyProcess) {
        client.ptyProcess.write('\x03');
      }
      break;

    case 'close':
      cleanup(ws, client);
      safeSend(ws, { type: 'closed' });
      break;

    // ===== 권한 응답 =====
    case 'permission-response':
      handlePermissionResponse(ws, client, msg);
      break;

    // ===== GlowUS 제어 =====
    case 'glowus-navigate':
      // GlowUS 페이지 이동 요청 (프론트엔드에서 처리)
      safeSend(ws, { type: 'glowus-action', action: 'navigate', path: msg.path });
      break;

    // ===== PC 제어 =====
    case 'pc-command':
      executePCCommand(ws, client, msg);
      break;
  }
}

/**
 * Claude Code 대화형 세션 시작 (PTY)
 */
function startClaudeSession(ws, client, options) {
  if (client.ptyProcess) {
    client.ptyProcess.kill();
  }

  // cwd 처리: '~'는 홈 디렉토리로 변환, 없으면 홈 디렉토리 사용
  let cwd = options.cwd || process.env.HOME;
  if (cwd === '~' || cwd.startsWith('~/')) {
    cwd = cwd.replace(/^~/, process.env.HOME);
  }
  client.cwd = cwd;

  console.log('[Jarvis] Starting Claude session in:', cwd);

  // Claude Code를 PTY로 실행 (대화형 모드)
  const args = [];

  // 세션 재개
  if (options.sessionId) {
    args.push('--resume', options.sessionId);
  }

  // 권한 모드: 도구 실행 전 확인 요청
  // bypassPermissions로 시작하고, 권한 요청은 출력 파싱으로 처리

  // 환경변수 설정 (ANTHROPIC_API_KEY 제거 - Max 플랜 OAuth 사용)
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  env.TERM = 'xterm-256color';
  env.COLORTERM = 'truecolor';

  client.ptyProcess = pty.spawn(CLAUDE_PATH, args, {
    name: 'xterm-256color',
    cols: options.cols || 120,
    rows: options.rows || 30,
    cwd: cwd,
    env: env,
  });

  console.log('[Jarvis] Claude PID:', client.ptyProcess.pid);

  // 출력 버퍼 (권한 요청 감지용)
  let outputBuffer = '';

  // PTY 출력 → WebSocket + 권한 요청 감지
  client.ptyProcess.onData((data) => {
    // 디버그: 출력 내용 로깅
    console.log('[Jarvis] PTY Output:', JSON.stringify(data.substring(0, 200)));

    // 클라이언트에 출력 전송
    safeSend(ws, { type: 'output', data });

    // 권한 요청 감지
    outputBuffer += data;

    // 권한 요청 패턴 감지 (Claude Code의 도구 승인 프롬프트)
    detectPermissionRequest(ws, client, outputBuffer);

    // 버퍼 크기 제한 (최근 2000자만 유지)
    if (outputBuffer.length > 2000) {
      outputBuffer = outputBuffer.slice(-2000);
    }
  });

  client.ptyProcess.onExit(({ exitCode, signal }) => {
    console.log('[Jarvis] Claude exited:', exitCode, signal);
    safeSend(ws, { type: 'exit', exitCode, signal });
    client.ptyProcess = null;
  });

  safeSend(ws, {
    type: 'started',
    pid: client.ptyProcess.pid,
    cwd: cwd
  });
}

/**
 * 권한 요청 감지 (Claude Code 출력에서)
 */
function detectPermissionRequest(ws, client, buffer) {
  // Claude Code의 권한 요청 패턴들
  const patterns = [
    // Bash 명령 실행 요청
    /Allow\s+(.*?)\s+to run\s+`(.*?)`\?/i,
    // 파일 쓰기 요청
    /Allow\s+(.*?)\s+to write to\s+(.*?)\?/i,
    // 파일 읽기 요청
    /Allow\s+(.*?)\s+to read\s+(.*?)\?/i,
    // 일반적인 Yes/No 프롬프트
    /\[Y\/n\]/i,
    /\[y\/N\]/i,
    // 도구 실행 요청 (stream-json의 경우)
    /"type":\s*"tool_use"/,
  ];

  for (const pattern of patterns) {
    const match = buffer.match(pattern);
    if (match) {
      const requestId = Date.now().toString();

      // 권한 요청을 웹 UI에 전송
      safeSend(ws, {
        type: 'permission-request',
        requestId,
        tool: match[1] || 'Claude',
        action: match[2] || match[0],
        fullText: buffer.slice(-500), // 최근 500자 컨텍스트
      });

      // 대기열에 추가
      client.pendingPermissions.set(requestId, {
        timestamp: Date.now(),
      });

      break;
    }
  }
}

/**
 * 권한 응답 처리
 */
function handlePermissionResponse(ws, client, msg) {
  const { requestId, approved } = msg;

  if (!client.pendingPermissions.has(requestId)) {
    console.log('[Jarvis] Unknown permission request:', requestId);
    return;
  }

  client.pendingPermissions.delete(requestId);

  // PTY에 응답 전송
  if (client.ptyProcess) {
    if (approved) {
      // Yes 입력
      client.ptyProcess.write('y\r');
    } else {
      // No 입력
      client.ptyProcess.write('n\r');
    }
  }

  console.log('[Jarvis] Permission', approved ? 'granted' : 'denied', 'for', requestId);
}

/**
 * PC 명령 실행
 */
function executePCCommand(ws, client, msg) {
  const { command, args, requirePermission } = msg;

  // 위험한 명령 차단
  const dangerousPatterns = [
    /rm\s+-rf\s+\//,
    /mkfs/,
    /dd\s+if=/,
    />\s*\/dev\/sd/,
    /shutdown/,
    /reboot/,
  ];

  const fullCommand = `${command} ${(args || []).join(' ')}`;

  for (const pattern of dangerousPatterns) {
    if (pattern.test(fullCommand)) {
      safeSend(ws, {
        type: 'pc-command-result',
        success: false,
        error: '위험한 명령은 실행할 수 없습니다.',
      });
      return;
    }
  }

  // 명령 실행
  exec(fullCommand, { cwd: client.cwd }, (error, stdout, stderr) => {
    safeSend(ws, {
      type: 'pc-command-result',
      success: !error,
      stdout,
      stderr,
      error: error?.message,
    });
  });
}

/**
 * 정리
 */
function cleanup(ws, client) {
  if (client.ptyProcess) {
    client.ptyProcess.kill();
    client.ptyProcess = null;
  }
  clients.delete(ws);
}

/**
 * 안전한 전송
 */
function safeSend(ws, data) {
  if (ws.readyState === 1) { // WebSocket.OPEN
    ws.send(JSON.stringify(data));
  }
}

console.log(`[Jarvis] Ready on ws://localhost:${PORT}`);

// 종료 처리
process.on('SIGINT', () => {
  console.log('\n[Jarvis] Shutting down...');
  clients.forEach((client, ws) => cleanup(ws, client));
  wss.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  clients.forEach((client, ws) => cleanup(ws, client));
  wss.close();
  process.exit(0);
});
