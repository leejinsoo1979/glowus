/**
 * Jarvis Server - Claude Code CLI PTY 대화형 모드
 *
 * 도구 사용 가능 (파일 읽기/쓰기, 웹 검색 등)
 * Max 플랜 OAuth 사용
 */

const { WebSocketServer } = require('ws');
const pty = require('node-pty');

const PORT = process.env.JARVIS_PORT || 3098;
const CLAUDE_PATH = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude';

const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });

console.log(`[Jarvis] Starting PTY mode server on port ${PORT}...`);

const clients = new Map();

wss.on('connection', (ws) => {
  console.log('[Jarvis] Client connected');

  const client = {
    pty: null,
    persona: null,
    userName: null,
    cwd: process.env.HOME,
    initialized: false,
    waitingForResponse: false,
    responseBuffer: '',
    initBuffer: '',
    lastActivity: Date.now(),
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
    console.log('[Jarvis] Client disconnected');
    if (client.pty) {
      client.pty.kill();
    }
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('[Jarvis] WebSocket error:', err);
  });
});

function handleMessage(ws, client, msg) {
  console.log('[Jarvis] Received:', msg.type);

  switch (msg.type) {
    case 'start':
      startSession(ws, client, msg);
      break;

    case 'message':
      // 완성된 메시지 전송 (엔터 포함)
      if (msg.content && client.pty) {
        sendMessage(ws, client, msg.content);
      }
      break;

    case 'input':
      // raw 키보드 입력 (그대로 PTY에 전달)
      console.log('[Jarvis] Input received, hasPTY:', !!client.pty, 'data:', msg.data?.substring(0, 50));
      if (msg.data && client.pty) {
        // 엔터(\r)가 포함되면 메시지 전송으로 처리
        if (msg.data.includes('\r') || msg.data.includes('\n')) {
          const content = msg.data.replace(/[\r\n]+$/, '');
          console.log('[Jarvis] Has newline, content:', content.substring(0, 50));
          if (content.trim()) {
            sendMessage(ws, client, content);
          } else {
            client.pty.write(msg.data);
          }
        } else {
          client.pty.write(msg.data);
        }
      } else if (!client.pty) {
        console.log('[Jarvis] No PTY for input');
        safeSend(ws, { type: 'error', error: 'PTY가 없습니다.' });
      }
      break;

    case 'resize':
      if (client.pty && msg.cols && msg.rows) {
        client.pty.resize(msg.cols, msg.rows);
        console.log('[Jarvis] Resized:', msg.cols, 'x', msg.rows);
      }
      break;

    case 'stop':
      if (client.pty) {
        client.pty.write('\x03'); // Ctrl+C
        client.waitingForResponse = false;
        safeSend(ws, { type: 'stopped' });
      }
      break;

    case 'close':
      if (client.pty) {
        client.pty.kill();
        client.pty = null;
        client.initialized = false;
      }
      safeSend(ws, { type: 'closed' });
      break;

    case 'register_browser':
      console.log('[Jarvis] Browser registered! Total browsers:', Array.from(clients.values()).filter(c => c.isBrowser).length + 1);
      client.isBrowser = true;
      safeSend(ws, { type: 'registered' });
      break;

    case 'browser_control':
      // MCP에서 보낸 브라우저 제어 명령 → 등록된 브라우저들에게 전달
      console.log('[Jarvis] Browser control:', msg.action, msg.route || msg.data);
      const browserCount = Array.from(clients.values()).filter(c => c.isBrowser).length;
      console.log('[Jarvis] Registered browsers:', browserCount);
      broadcastToBrowsers({
        type: 'control',
        action: msg.action,
        route: msg.route,
        data: msg.data,
      });
      break;

    case 'workflow_control':
      // 워크플로우 빌더 제어 명령
      console.log('[Jarvis] Workflow control:', msg.action, msg.nodeType || msg.nodeId);
      broadcastToBrowsers({
        type: 'workflow_control',
        action: msg.action,
        nodeType: msg.nodeType,
        nodeId: msg.nodeId,
        position: msg.position,
        data: msg.data,
        sourceId: msg.sourceId,
        targetId: msg.targetId,
        sourceHandle: msg.sourceHandle,
        targetHandle: msg.targetHandle,
      });
      break;
  }
}

// 등록된 브라우저들에게 메시지 브로드캐스트
function broadcastToBrowsers(message) {
  let sent = 0;
  for (const [clientWs, clientData] of clients) {
    if (clientData.isBrowser && clientWs.readyState === 1) {
      clientWs.send(JSON.stringify(message));
      sent++;
    }
  }
  console.log('[Jarvis] Broadcast to', sent, 'browsers');
}

function startSession(ws, client, options) {
  // 이미 세션이 있고 초기화됨 → 재사용
  if (client.pty && client.initialized) {
    client.persona = options.persona || client.persona;
    client.userName = options.userName || client.userName;
    console.log('[Jarvis] Session reused, already initialized');
    safeSend(ws, { type: 'started', cwd: client.cwd, reused: true });
    // 이미 ready 상태이므로 즉시 ready도 보냄
    safeSend(ws, { type: 'ready' });
    return;
  }

  // 기존 PTY 정리
  if (client.pty) {
    console.log('[Jarvis] Killing existing PTY');
    client.pty.kill();
    client.pty = null;
  }

  let cwd = options.cwd || process.env.HOME;
  if (cwd === '~') cwd = process.env.HOME;

  client.cwd = cwd;
  client.userName = options.userName || 'User';
  client.persona = options.persona || {};
  client.initialized = false;
  client.waitingForResponse = false;
  client.responseBuffer = '';
  client.initBuffer = '';

  const persona = client.persona;
  const aiName = persona.name || 'Jarvis';
  const userTitle = persona.userTitle || '사용자님';
  const language = persona.language || '한국어';
  const personality = persona.personality || '';
  const customInstructions = persona.customInstructions || '';

  // 시스템 프롬프트 생성
  let systemPrompt = `당신의 이름은 "${aiName}"입니다. Claude나 AI라고 하지 마세요.
사용자를 "${userTitle}"라고 부르세요.
${language}로 응답하세요.
친근하고 도움이 되게 대화하세요.

# GlowUS 앱 제어
GlowUS MCP 도구를 사용하여 앱을 제어하세요:

## 페이지 이동
glowus_navigate 도구로 페이지 이동:
- dashboard: 대시보드
- agent-builder: 워크플로우 빌더
- agents: 에이전트 목록
- ai-sheet: AI 시트
- ai-docs: AI 문서
- ai-slides: AI 슬라이드

## 워크플로우 빌더 제어
- workflow_add_node: 노드 추가 (nodeType: trigger, ai, http, code, conditional, output 등)
- workflow_connect_nodes: 노드 연결 (sourceId, targetId)
- workflow_remove_node: 노드 삭제
- workflow_clear: 전체 삭제

## AI 시트 제어
- glowus_ai_sheet: 스프레드시트 액션 실행 (actions 배열)`;

  if (personality) systemPrompt += `\n성격: ${personality}`;

  if (customInstructions) {
    const maxLen = 2000;
    const truncated = customInstructions.length > maxLen
      ? customInstructions.substring(0, maxLen) + '...'
      : customInstructions;
    systemPrompt += `\n${truncated}`;
  }

  console.log('[Jarvis] System prompt length:', systemPrompt.length);

  const cols = options.cols || 120;
  const rows = options.rows || 30;

  console.log('[Jarvis] Starting PTY:', { cwd, aiName, userTitle, cols, rows });

  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;

  const args = ['--system-prompt', systemPrompt];

  let ptyProcess;
  try {
    ptyProcess = pty.spawn(CLAUDE_PATH, args, {
      name: 'xterm-256color',
      cols: cols,
      rows: rows,
      cwd: cwd,
      env: env,
    });
    console.log('[Jarvis] PTY spawned, pid:', ptyProcess.pid);
  } catch (err) {
    console.error('[Jarvis] PTY spawn error:', err);
    safeSend(ws, { type: 'error', error: 'PTY 스폰 실패: ' + err.message });
    return;
  }

  client.pty = ptyProcess;

  // 즉시 started 전송
  safeSend(ws, { type: 'started', cwd: cwd });

  ptyProcess.onData((data) => {
    client.lastActivity = Date.now();
    console.log('[Jarvis] PTY data:', data.length, 'bytes');

    // 항상 output 전송
    safeSend(ws, { type: 'output', data: data });

    // 초기화 체크
    if (!client.initialized) {
      client.initBuffer += data;

      // Claude Code 프롬프트 패턴 감지
      if (client.initBuffer.includes('>') ||
          client.initBuffer.includes('╭') ||
          client.initBuffer.includes('?')) {
        client.initialized = true;
        console.log('[Jarvis] CLI initialized');
        safeSend(ws, { type: 'ready' });
      }
    }

    // 응답 대기 중일 때 완료 체크
    if (client.waitingForResponse) {
      client.responseBuffer += data;

      // 응답 완료 감지: 새 프롬프트 또는 입력 대기 상태
      const hasNewPrompt =
        data.includes('\n>') ||
        data.includes('\n╭') ||
        data.includes('╭─') ||
        data.includes('ctrl+g') ||  // Claude Code 입력 대기
        data.includes('Ctrl+C') ||  // 중단 가능 상태
        /\n\s*>/.test(data);

      if (hasNewPrompt) {
        console.log('[Jarvis] Response complete');
        client.waitingForResponse = false;
        safeSend(ws, { type: 'done', exitCode: 0 });
      }
    }
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log('[Jarvis] PTY exited:', exitCode, signal);
    client.pty = null;
    client.initialized = false;
    safeSend(ws, { type: 'exit', exitCode, signal });
  });

  // 초기화 타임아웃 (10초)
  setTimeout(() => {
    if (!client.initialized && client.pty) {
      client.initialized = true;
      console.log('[Jarvis] CLI initialized (timeout fallback)');
      safeSend(ws, { type: 'ready' });
    }
  }, 10000);
}

function sendMessage(ws, client, content) {
  if (!client.pty) {
    safeSend(ws, { type: 'error', error: 'CLI not running' });
    return;
  }

  console.log('[Jarvis] Sending message:', content.substring(0, 100));

  client.waitingForResponse = true;
  client.responseBuffer = '';

  // 메시지 전송 + 엔터
  client.pty.write(content + '\r');

  // 응답 타임아웃 (2분) - 긴 작업을 위해
  setTimeout(() => {
    if (client.waitingForResponse) {
      console.log('[Jarvis] Response timeout (2min)');
      client.waitingForResponse = false;
      safeSend(ws, { type: 'done', exitCode: 0, timeout: true });
    }
  }, 120000);
}

function safeSend(ws, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

console.log(`[Jarvis] Ready on ws://localhost:${PORT}`);

process.on('SIGINT', () => {
  console.log('\n[Jarvis] Shutting down...');
  for (const [, client] of clients) {
    if (client.pty) client.pty.kill();
  }
  wss.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  for (const [, client] of clients) {
    if (client.pty) client.pty.kill();
  }
  wss.close();
  process.exit(0);
});
