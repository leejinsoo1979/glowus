#!/usr/bin/env node

/**
 * Agent Builder MCP Server (Supabase Realtime Version)
 *
 * Claude Code에서 Agent Builder 캔버스를 제어할 수 있게 해주는 MCP 서버
 * Supabase Realtime을 사용하여 Vercel 배포 환경에서도 작동합니다.
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// 환경 변수 로드 (.env.local 또는 .env)
function loadEnv() {
  const envPaths = [
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env'),
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '..', '.env'),
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach((line) => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
      console.error(`[MCP] Loaded env from: ${envPath}`);
      break;
    }
  }
}

loadEnv();

// Supabase 설정
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[MCP] Error: SUPABASE_URL or SUPABASE_KEY not found');
  console.error('[MCP] Make sure .env.local file exists with:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=...');
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=...');
  process.exit(1);
}

// Supabase 클라이언트
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 세션 파일 경로
const SESSION_FILE_PATH = '/tmp/glow-mcp-session.txt';
const PROJECT_SESSION_PATH = path.join(process.cwd(), '.mcp-session');

/**
 * 세션 파일에서 세션 ID 읽기
 */
function readSessionFromFile() {
  // 프로젝트 루트에서 먼저 시도
  if (fs.existsSync(PROJECT_SESSION_PATH)) {
    try {
      const data = fs.readFileSync(PROJECT_SESSION_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed.sessionId) {
        console.error(`[MCP] Session ID loaded from project file: ${parsed.sessionId}`);
        return parsed.sessionId;
      }
    } catch (e) {
      console.error('[MCP] Failed to read project session file:', e.message);
    }
  }

  // /tmp에서 시도
  if (fs.existsSync(SESSION_FILE_PATH)) {
    try {
      const data = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed.sessionId) {
        console.error(`[MCP] Session ID loaded from temp file: ${parsed.sessionId}`);
        return parsed.sessionId;
      }
    } catch (e) {
      console.error('[MCP] Failed to read temp session file:', e.message);
    }
  }

  return null;
}

// 세션 ID (파일에서 자동 로드 또는 환경변수)
let sessionId = process.env.MCP_SESSION_ID || readSessionFromFile();

// 캔버스 상태
let canvasState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
};

// Realtime 채널
let channel = null;

// 대기 중인 요청들
const pendingRequests = new Map();
let requestIdCounter = 0;

/**
 * Supabase Realtime 연결
 */
async function connectRealtime() {
  if (!sessionId) {
    console.error('[MCP] No session ID. Run with MCP_SESSION_ID env or wait for frontend connection.');
    console.error('[MCP] 세션 ID가 없습니다. 브라우저에서 Agent Builder를 열고 세션 ID를 확인하세요.');
    return;
  }

  const channelName = `mcp-bridge:${sessionId}`;
  console.error(`[MCP] Connecting to Supabase Realtime channel: ${channelName}`);

  channel = supabase.channel(channelName, {
    config: {
      broadcast: { self: false },
      presence: { key: 'mcp' },
    },
  });

  // 브로드캐스트 메시지 수신
  channel.on('broadcast', { event: 'mcp-message' }, ({ payload }) => {
    handleRealtimeMessage(payload);
  });

  // Presence로 프론트엔드 감지
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    const clients = Object.keys(state);
    console.error(`[MCP] Presence sync - clients: ${clients.join(', ') || 'none'}`);
  });

  channel.on('presence', { event: 'join' }, ({ key }) => {
    console.error(`[MCP] Client joined: ${key}`);
    if (key === 'frontend') {
      // 프론트엔드 연결되면 캔버스 상태 요청
      sendMessage({ type: 'get-canvas-state' });
    }
  });

  channel.on('presence', { event: 'leave' }, ({ key }) => {
    console.error(`[MCP] Client left: ${key}`);
  });

  // 구독
  await channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      console.error('[MCP] Connected to Supabase Realtime');

      // Presence 등록
      await channel.track({
        clientType: 'mcp',
        online_at: new Date().toISOString(),
      });

      // MCP 연결 알림
      sendMessage({
        type: 'mcp-connect',
        clientType: 'mcp',
        sessionId,
      });
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      console.error(`[MCP] Channel status: ${status}`);
      // 재연결 시도
      setTimeout(() => connectRealtime(), 5000);
    }
  });
}

/**
 * 메시지 전송
 */
function sendMessage(message) {
  if (!channel) {
    console.error('[MCP] Cannot send, channel not connected');
    return;
  }

  channel.send({
    type: 'broadcast',
    event: 'mcp-message',
    payload: message,
  });
}

/**
 * Realtime 메시지 처리
 */
function handleRealtimeMessage(msg) {
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'canvas-state':
      canvasState = {
        nodes: msg.nodes || [],
        edges: msg.edges || [],
        selectedNodeId: msg.selectedNodeId || null,
      };
      console.error(`[MCP] Canvas state updated: ${canvasState.nodes.length} nodes, ${canvasState.edges.length} edges`);
      break;

    case 'mcp-response':
      const callback = pendingRequests.get(msg.requestId);
      if (callback) {
        pendingRequests.delete(msg.requestId);
        callback(msg.result);
      }
      break;

    case 'frontend-connect':
      console.error('[MCP] Frontend connected');
      // 캔버스 상태 요청
      sendMessage({ type: 'get-canvas-state' });
      break;
  }
}

/**
 * MCP 명령을 프론트엔드에 전송하고 응답 대기
 */
function sendMcpCommand(command, params) {
  return new Promise((resolve, reject) => {
    if (!channel) {
      reject(new Error('Supabase Realtime not connected. 세션 ID를 확인하세요.'));
      return;
    }

    const requestId = ++requestIdCounter;
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Request timeout - 프론트엔드가 응답하지 않습니다.'));
    }, 30000);

    pendingRequests.set(requestId, (result) => {
      clearTimeout(timeout);
      if (result && result.error) {
        reject(new Error(result.error));
      } else {
        resolve(result);
      }
    });

    sendMessage({
      type: 'mcp-command',
      requestId,
      command,
      params,
    });
  });
}

/**
 * MCP Server 생성
 */
const server = new Server(
  {
    name: 'agent-builder',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

/**
 * 도구 목록
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_canvas_state',
        description: '현재 Agent Builder 캔버스의 상태(노드, 엣지)를 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'create_node',
        description: '새로운 노드를 캔버스에 생성합니다',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['start', 'prompt', 'llm', 'image_generation', 'tool', 'router', 'javascript', 'embedding', 'custom_tool', 'end', 'memory', 'rag', 'input', 'output'],
              description: '노드 타입',
            },
            label: {
              type: 'string',
              description: '노드 이름 (선택사항)',
            },
            position: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
              },
              description: '노드 위치 (선택사항, 기본값: 자동 배치)',
            },
            config: {
              type: 'object',
              description: '노드별 추가 설정',
            },
          },
          required: ['type'],
        },
      },
      {
        name: 'update_node',
        description: '기존 노드의 설정을 수정합니다',
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: {
              type: 'string',
              description: '수정할 노드의 ID',
            },
            label: {
              type: 'string',
              description: '새로운 노드 이름',
            },
            config: {
              type: 'object',
              description: '수정할 설정 (model, temperature, systemPrompt 등)',
            },
          },
          required: ['nodeId'],
        },
      },
      {
        name: 'delete_node',
        description: '노드를 삭제합니다',
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: {
              type: 'string',
              description: '삭제할 노드의 ID',
            },
          },
          required: ['nodeId'],
        },
      },
      {
        name: 'connect_nodes',
        description: '두 노드를 연결합니다',
        inputSchema: {
          type: 'object',
          properties: {
            sourceId: {
              type: 'string',
              description: '시작 노드 ID',
            },
            targetId: {
              type: 'string',
              description: '대상 노드 ID',
            },
            sourceHandle: {
              type: 'string',
              description: '시작 노드의 핸들 ID (선택사항)',
            },
            targetHandle: {
              type: 'string',
              description: '대상 노드의 핸들 ID (선택사항)',
            },
          },
          required: ['sourceId', 'targetId'],
        },
      },
      {
        name: 'disconnect_nodes',
        description: '두 노드의 연결을 해제합니다',
        inputSchema: {
          type: 'object',
          properties: {
            sourceId: {
              type: 'string',
              description: '시작 노드 ID',
            },
            targetId: {
              type: 'string',
              description: '대상 노드 ID',
            },
          },
          required: ['sourceId', 'targetId'],
        },
      },
      {
        name: 'clear_canvas',
        description: '캔버스의 모든 노드와 연결을 삭제합니다',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'load_template',
        description: '미리 정의된 에이전트 템플릿을 로드합니다',
        inputSchema: {
          type: 'object',
          properties: {
            templateId: {
              type: 'string',
              enum: ['chatbot-basic', 'rag-assistant', 'tool-agent', 'multi-agent'],
              description: '템플릿 ID',
            },
          },
          required: ['templateId'],
        },
      },
      {
        name: 'validate_agent',
        description: '현재 에이전트 설정이 유효한지 검증합니다',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'export_agent',
        description: '현재 에이전트를 JSON으로 내보냅니다',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: '에이전트 이름',
            },
          },
          required: [],
        },
      },
      {
        name: 'set_session',
        description: '세션 ID를 설정합니다. Agent Builder UI에서 표시되는 세션 ID를 입력하세요.',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: '브라우저의 Agent Builder에서 표시되는 세션 ID',
            },
          },
          required: ['sessionId'],
        },
      },
    ],
  };
});

/**
 * 도구 실행
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    // 세션 설정 명령은 별도 처리
    if (name === 'set_session') {
      sessionId = args.sessionId;
      console.error(`[MCP] Session ID set: ${sessionId}`);

      // 기존 채널 연결 해제
      if (channel) {
        await channel.unsubscribe();
        supabase.removeChannel(channel);
        channel = null;
      }

      // 새 세션으로 연결
      await connectRealtime();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `세션 ID가 설정되었습니다: ${sessionId}`,
              sessionId,
            }, null, 2),
          },
        ],
      };
    }

    // 세션 ID가 없으면 에러
    if (!sessionId || !channel) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: '세션이 연결되지 않았습니다.',
              hint: '먼저 set_session 도구로 세션 ID를 설정하세요. 세션 ID는 Agent Builder UI에서 확인할 수 있습니다.',
            }, null, 2),
          },
        ],
        isError: true,
      };
    }

    switch (name) {
      case 'get_canvas_state':
        // 캔버스 상태 요청
        sendMessage({ type: 'get-canvas-state' });
        await new Promise(resolve => setTimeout(resolve, 200));
        result = {
          nodes: canvasState.nodes.map(n => ({
            id: n.id,
            type: n.type,
            label: n.data?.label,
            position: n.position,
            config: n.data,
          })),
          edges: canvasState.edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
          })),
          nodeCount: canvasState.nodes.length,
          edgeCount: canvasState.edges.length,
        };
        break;

      case 'create_node':
      case 'update_node':
      case 'delete_node':
      case 'connect_nodes':
      case 'disconnect_nodes':
      case 'clear_canvas':
      case 'load_template':
      case 'validate_agent':
      case 'export_agent':
        result = await sendMcpCommand(name, args);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `오류: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * 리소스 목록
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'agent-builder://canvas/state',
        name: '캔버스 상태',
        description: '현재 Agent Builder 캔버스의 노드와 연결 상태',
        mimeType: 'application/json',
      },
      {
        uri: 'agent-builder://session/id',
        name: '세션 ID',
        description: '현재 MCP 세션 ID',
        mimeType: 'text/plain',
      },
    ],
  };
});

/**
 * 리소스 읽기
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'agent-builder://canvas/state':
      sendMessage({ type: 'get-canvas-state' });
      await new Promise(resolve => setTimeout(resolve, 200));
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              nodes: canvasState.nodes,
              edges: canvasState.edges,
              summary: {
                nodeCount: canvasState.nodes.length,
                edgeCount: canvasState.edges.length,
                nodeTypes: [...new Set(canvasState.nodes.map(n => n.type))],
              },
            }, null, 2),
          },
        ],
      };

    case 'agent-builder://session/id':
      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: sessionId || '세션이 설정되지 않았습니다.',
          },
        ],
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

/**
 * 세션 파일 감시 및 자동 재연결
 */
function watchSessionFile() {
  const watchPaths = [PROJECT_SESSION_PATH, SESSION_FILE_PATH];

  for (const watchPath of watchPaths) {
    try {
      // 파일 변경 감시
      fs.watchFile(watchPath, { interval: 1000 }, async (curr, prev) => {
        if (curr.mtime > prev.mtime) {
          console.error(`[MCP] Session file changed: ${watchPath}`);
          const newSessionId = readSessionFromFile();

          if (newSessionId && newSessionId !== sessionId) {
            console.error(`[MCP] New session detected: ${newSessionId}`);
            sessionId = newSessionId;

            // 기존 채널 연결 해제
            if (channel) {
              try {
                await channel.unsubscribe();
                supabase.removeChannel(channel);
              } catch (e) {
                // 무시
              }
              channel = null;
            }

            // 새 세션으로 연결
            await connectRealtime();
          }
        }
      });
      console.error(`[MCP] Watching session file: ${watchPath}`);
    } catch (e) {
      // 파일이 없으면 무시
    }
  }
}

/**
 * 세션 파일이 생성될 때까지 주기적 확인
 */
function pollForSession() {
  if (sessionId) return;

  const checkInterval = setInterval(async () => {
    const newSessionId = readSessionFromFile();
    if (newSessionId) {
      console.error(`[MCP] Session found: ${newSessionId}`);
      sessionId = newSessionId;
      clearInterval(checkInterval);
      await connectRealtime();
    }
  }, 2000); // 2초마다 확인

  console.error('[MCP] Polling for session file...');
}

/**
 * 서버 시작
 */
async function main() {
  // 세션 파일 감시 시작
  watchSessionFile();

  // 세션 ID가 있으면 Realtime 연결 시작
  if (sessionId) {
    await connectRealtime();
  } else {
    console.error('[MCP] No session found. Waiting for Agent Builder to start...');
    console.error('[MCP] 브라우저에서 Agent Builder를 열면 자동으로 연결됩니다.');
    pollForSession();
  }

  // MCP 서버 시작
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP] Agent Builder MCP Server (Realtime) started');
  console.error('[MCP] 자동 연결 모드 활성화됨 - 브라우저에서 Agent Builder를 열어주세요.');
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
