const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');

const PORT = 3001;

const wss = new WebSocketServer({ port: PORT });

console.log(`Terminal WebSocket server running on ws://localhost:${PORT}`);

// 연결된 클라이언트 관리
const clients = {
  terminals: new Map(),   // 터미널 클라이언트 (브라우저) - ws -> ptyProcess
  mcp: null,              // MCP 서버 클라이언트
  frontend: new Set(),    // 프론트엔드 클라이언트 (Agent Builder)
};

// 현재 캔버스 상태 (프론트엔드에서 업데이트)
let canvasState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
};

// MCP 요청 대기열 (requestId -> { resolve, reject, timeout })
const mcpPendingRequests = new Map();

/**
 * 프론트엔드에 MCP 명령 전달
 */
function broadcastToFrontend(message) {
  const msgStr = JSON.stringify(message);
  clients.frontend.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(msgStr);
    }
  });
}

/**
 * MCP 서버에 메시지 전송
 */
function sendToMcp(message) {
  if (clients.mcp && clients.mcp.readyState === 1) {
    clients.mcp.send(JSON.stringify(message));
  }
}

wss.on('connection', (ws) => {
  console.log('Client connected');

  // 클라이언트 타입 (기본: terminal)
  let clientType = 'unknown';
  let ptyProcess = null;

  // 초기 메시지 핸들러 (클라이언트 타입 결정 전)
  const initialMessageHandler = (message) => {
    try {
      const msg = JSON.parse(message.toString());

      // 클라이언트 타입 결정
      if (msg.type === 'mcp-connect') {
        // MCP 서버 연결
        clientType = 'mcp';
        clients.mcp = ws;
        console.log('MCP Server connected');

        // 현재 캔버스 상태 전송
        ws.send(JSON.stringify({
          type: 'canvas-state',
          ...canvasState,
        }));

        // 메시지 핸들러 교체
        ws.removeListener('message', initialMessageHandler);
        ws.on('message', mcpMessageHandler);
        return;
      }

      if (msg.type === 'frontend-connect') {
        // 프론트엔드 (Agent Builder) 연결
        clientType = 'frontend';
        clients.frontend.add(ws);
        console.log('Frontend (Agent Builder) connected');

        // 메시지 핸들러 교체
        ws.removeListener('message', initialMessageHandler);
        ws.on('message', frontendMessageHandler);
        return;
      }

      // 기본: 터미널 연결
      clientType = 'terminal';

      // 🔥 init 메시지에서 초기 cwd 추출
      const initialCwd = msg.type === 'init' && msg.cwd ? msg.cwd : null;
      initializeTerminal(initialCwd);

      // 메시지 핸들러 교체
      ws.removeListener('message', initialMessageHandler);
      ws.on('message', terminalMessageHandler);

      // 현재 메시지 처리 (init은 이미 처리됨, resize/set-cwd 등 다른 메시지는 처리)
      if (msg.type !== 'init') {
        handleTerminalMessage(msg);
      } else if (msg.cols && msg.rows) {
        // init 메시지에 포함된 resize 정보 처리
        if (ptyProcess) {
          ptyProcess.resize(msg.cols, msg.rows);
        }
      }
    } catch (e) {
      console.error('Initial message parse error:', e);
      // 파싱 실패 시 터미널로 가정
      clientType = 'terminal';
      initializeTerminal(null);
      ws.removeListener('message', initialMessageHandler);
      ws.on('message', terminalMessageHandler);
    }
  };

  /**
   * 터미널 초기화
   * @param {string|null} requestedCwd - 클라이언트가 요청한 초기 디렉토리
   */
  function initializeTerminal(requestedCwd = null) {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh';
    const shellName = path.basename(shell);

    // 🔥 요청된 cwd가 있으면 사용, 없으면 홈 디렉토리 사용 (GlowUS 폴더 보호)
    const safeDefault = os.homedir();
    let initialCwd = requestedCwd || safeDefault;

    // 경로가 존재하는지 확인 (존재하지 않으면 홈 디렉토리로 폴백)
    if (requestedCwd && !fs.existsSync(requestedCwd)) {
      console.warn(`[Terminal] Requested cwd does not exist: ${requestedCwd}, using home directory`);
      initialCwd = safeDefault;
    }

    console.log(`[Terminal] Starting shell in: ${initialCwd}`);

    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: initialCwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    });

    clients.terminals.set(ws, ptyProcess);
    console.log(`Spawned ${shell} with PID ${ptyProcess.pid} in ${initialCwd}`);

    // 셸 정보 전송
    ws.send(JSON.stringify({
      type: 'shell-info',
      shell: shellName,
      cwd: initialCwd,
      pid: ptyProcess.pid
    }));

    // PTY 출력 → WebSocket
    ptyProcess.onData((data) => {
      try {
        ws.send(JSON.stringify({ type: 'output', data }));
      } catch (e) {
        // 연결 끊어짐
      }
    });

    // PTY 종료 시
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`PTY exited with code ${exitCode}, signal ${signal}`);
      try {
        ws.send(JSON.stringify({ type: 'exit', exitCode, signal }));
        ws.close();
      } catch (e) {
        // 연결 끊어짐
      }
    });
  }

  /**
   * 터미널 메시지 핸들러
   */
  function terminalMessageHandler(message) {
    try {
      const msg = JSON.parse(message.toString());
      handleTerminalMessage(msg);
    } catch (e) {
      console.error('Terminal message parse error:', e);
    }
  }

  function handleTerminalMessage(msg) {
    if (!ptyProcess) return;

    switch (msg.type) {
      case 'input':
        ptyProcess.write(msg.data);
        break;
      case 'resize':
        ptyProcess.resize(msg.cols, msg.rows);
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      case 'set-cwd':
        // 프로젝트 경로로 cd 명령어 실행
        if (msg.cwd) {
          const targetCwd = msg.cwd;
          console.log(`[Terminal] Changing directory to: ${targetCwd}`);
          // cd 명령어 전송
          ptyProcess.write(`cd "${targetCwd}" && clear\r`);
          ws.send(JSON.stringify({ type: 'cwd-update', cwd: targetCwd }));
        }
        break;
      case 'get-cwd':
        if (os.platform() !== 'win32') {
          const { execSync } = require('child_process');
          try {
            const cwd = execSync(`lsof -p ${ptyProcess.pid} | grep cwd | awk '{print $NF}'`, { encoding: 'utf8' }).trim();
            ws.send(JSON.stringify({ type: 'cwd-update', cwd: cwd || os.homedir() }));
          } catch {
            ws.send(JSON.stringify({ type: 'cwd-update', cwd: os.homedir() }));
          }
        }
        break;
    }
  }

  /**
   * MCP 메시지 핸들러
   */
  function mcpMessageHandler(message) {
    try {
      const msg = JSON.parse(message.toString());

      switch (msg.type) {
        case 'mcp-command':
          // MCP 명령을 프론트엔드에 전달
          console.log(`[MCP] Command: ${msg.command}`, msg.params);
          broadcastToFrontend({
            type: 'mcp-command',
            requestId: msg.requestId,
            command: msg.command,
            params: msg.params,
          });
          break;

        case 'get-canvas-state':
          // 현재 캔버스 상태 전송
          ws.send(JSON.stringify({
            type: 'canvas-state',
            ...canvasState,
          }));
          break;
      }
    } catch (e) {
      console.error('MCP message parse error:', e);
    }
  }

  /**
   * 프론트엔드 메시지 핸들러
   */
  function frontendMessageHandler(message) {
    try {
      const msg = JSON.parse(message.toString());

      switch (msg.type) {
        case 'canvas-state':
          // 캔버스 상태 업데이트
          canvasState = {
            nodes: msg.nodes || [],
            edges: msg.edges || [],
            selectedNodeId: msg.selectedNodeId || null,
          };
          // MCP 서버에 상태 전달
          sendToMcp({
            type: 'canvas-state',
            ...canvasState,
          });
          break;

        case 'mcp-response':
          // MCP 명령 응답을 MCP 서버에 전달
          console.log(`[Frontend] MCP Response for request ${msg.requestId}`);
          sendToMcp({
            type: 'mcp-response',
            requestId: msg.requestId,
            result: msg.result,
          });
          break;

        case 'node-created':
        case 'node-updated':
        case 'node-deleted':
        case 'nodes-connected':
          // 노드 변경 이벤트를 MCP에 전달
          sendToMcp(msg);
          break;
      }
    } catch (e) {
      console.error('Frontend message parse error:', e);
    }
  }

  // 초기 메시지 핸들러 등록
  ws.on('message', initialMessageHandler);

  // 연결 종료 처리
  ws.on('close', () => {
    console.log(`Client disconnected (type: ${clientType})`);

    switch (clientType) {
      case 'terminal':
        if (ptyProcess) {
          ptyProcess.kill();
        }
        clients.terminals.delete(ws);
        break;
      case 'mcp':
        clients.mcp = null;
        break;
      case 'frontend':
        clients.frontend.delete(ws);
        break;
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    if (clientType === 'terminal' && ptyProcess) {
      ptyProcess.kill();
    }
  });

  // 타임아웃: 5초 내에 클라이언트 타입이 결정되지 않으면 터미널로 가정
  setTimeout(() => {
    if (clientType === 'unknown') {
      console.log('Client type timeout, assuming terminal');
      clientType = 'terminal';
      initializeTerminal(null);
      ws.removeListener('message', initialMessageHandler);
      ws.on('message', terminalMessageHandler);
    }
  }, 5000);
});

// 서버 종료 시 정리
process.on('SIGINT', () => {
  console.log('\nShutting down terminal server...');

  // 모든 PTY 프로세스 종료
  clients.terminals.forEach((ptyProcess) => {
    ptyProcess.kill();
  });

  wss.close();
  process.exit(0);
});
