#!/usr/bin/env node

/**
 * Agent Builder MCP Server
 * Claude Code에서 Agent Builder 캔버스를 제어할 수 있게 해주는 MCP 서버
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const WebSocket = require('ws');

// 캔버스 상태 (WebSocket으로 프론트엔드와 동기화)
let canvasState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
};

// WebSocket 연결
let wsConnection = null;
let wsReconnectTimer = null;
let wsReconnectAttempts = 0;
const WS_URL = 'ws://localhost:3001';
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 3000;

// 대기 중인 요청들 (requestId -> callback)
const pendingRequests = new Map();
let requestIdCounter = 0;

/**
 * WebSocket 연결 설정
 */
function connectWebSocket() {
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    return;
  }

  try {
    wsConnection = new WebSocket(WS_URL);

    wsConnection.on('open', () => {
      console.error('[MCP] WebSocket connected to Agent Builder');
      wsReconnectAttempts = 0; // 연결 성공 시 재시도 횟수 초기화
      // MCP 클라이언트임을 알림
      wsConnection.send(JSON.stringify({ type: 'mcp-connect' }));
    });

    wsConnection.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleWebSocketMessage(msg);
      } catch (e) {
        console.error('[MCP] Failed to parse WebSocket message:', e);
      }
    });

    wsConnection.on('close', () => {
      console.error('[MCP] WebSocket disconnected, reconnecting...');
      wsConnection = null;
      scheduleReconnect();
    });

    wsConnection.on('error', (err) => {
      console.error('[MCP] WebSocket error:', err.message);
    });
  } catch (e) {
    console.error('[MCP] Failed to connect WebSocket:', e);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (wsReconnectTimer) return;
  if (wsReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`[MCP] 최대 재연결 시도 횟수(${MAX_RECONNECT_ATTEMPTS})에 도달. 터미널 서버 실행 필요: node server/terminal-server.js`);
    return;
  }
  wsReconnectAttempts++;
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null;
    connectWebSocket();
  }, RECONNECT_DELAY);
}

/**
 * WebSocket 메시지 처리
 */
function handleWebSocketMessage(msg) {
  switch (msg.type) {
    case 'canvas-state':
      // 프론트엔드에서 캔버스 상태 업데이트
      canvasState = {
        nodes: msg.nodes || [],
        edges: msg.edges || [],
        selectedNodeId: msg.selectedNodeId || null,
      };
      break;

    case 'mcp-response':
      // MCP 명령 응답
      const callback = pendingRequests.get(msg.requestId);
      if (callback) {
        pendingRequests.delete(msg.requestId);
        callback(msg.result);
      }
      break;

    case 'node-created':
    case 'node-updated':
    case 'node-deleted':
    case 'nodes-connected':
      // 노드 변경 이벤트 - 상태 업데이트 요청
      requestCanvasState();
      break;
  }
}

/**
 * 프론트엔드에 캔버스 상태 요청
 */
function requestCanvasState() {
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    wsConnection.send(JSON.stringify({ type: 'get-canvas-state' }));
  }
}

/**
 * MCP 명령을 프론트엔드에 전송하고 응답 대기
 */
function sendMcpCommand(command, params) {
  return new Promise((resolve, reject) => {
    if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
      reject(new Error('WebSocket not connected. Agent Builder가 실행 중인지 확인하세요.'));
      return;
    }

    const requestId = ++requestIdCounter;
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Request timeout'));
    }, 10000);

    pendingRequests.set(requestId, (result) => {
      clearTimeout(timeout);
      if (result.error) {
        reject(new Error(result.error));
      } else {
        resolve(result);
      }
    });

    wsConnection.send(JSON.stringify({
      type: 'mcp-command',
      requestId,
      command,
      params,
    }));
  });
}

/**
 * MCP Server 생성
 */
const server = new Server(
  {
    name: 'agent-builder',
    version: '1.0.0',
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

    switch (name) {
      case 'get_canvas_state':
        requestCanvasState();
        // 약간의 딜레이 후 상태 반환
        await new Promise(resolve => setTimeout(resolve, 100));
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
        result = await sendMcpCommand('create_node', args);
        break;

      case 'update_node':
        result = await sendMcpCommand('update_node', args);
        break;

      case 'delete_node':
        result = await sendMcpCommand('delete_node', args);
        break;

      case 'connect_nodes':
        result = await sendMcpCommand('connect_nodes', args);
        break;

      case 'disconnect_nodes':
        result = await sendMcpCommand('disconnect_nodes', args);
        break;

      case 'clear_canvas':
        result = await sendMcpCommand('clear_canvas', args);
        break;

      case 'load_template':
        result = await sendMcpCommand('load_template', args);
        break;

      case 'validate_agent':
        result = await sendMcpCommand('validate_agent', args);
        break;

      case 'export_agent':
        result = await sendMcpCommand('export_agent', args);
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
        uri: 'agent-builder://canvas/nodes',
        name: '노드 목록',
        description: '현재 캔버스에 있는 모든 노드',
        mimeType: 'application/json',
      },
    ],
  };
});

/**
 * 리소스 읽기
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  // 최신 상태 요청
  requestCanvasState();
  await new Promise(resolve => setTimeout(resolve, 100));

  switch (uri) {
    case 'agent-builder://canvas/state':
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

    case 'agent-builder://canvas/nodes':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(canvasState.nodes.map(n => ({
              id: n.id,
              type: n.type,
              label: n.data?.label,
              position: n.position,
            })), null, 2),
          },
        ],
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

/**
 * 서버 시작
 */
async function main() {
  // WebSocket 연결 시작
  connectWebSocket();

  // MCP 서버 시작
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP] Agent Builder MCP Server started');
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
