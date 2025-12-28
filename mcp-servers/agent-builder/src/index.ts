#!/usr/bin/env node
/**
 * Agent Builder MCP Server
 *
 * Claude Code에서 GlowUS Agent Builder를 제어하기 위한 MCP Server입니다.
 * Supabase Realtime을 통해 Agent Builder와 실시간 통신합니다.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

// ============================================
// Types
// ============================================

interface McpMessage {
  type: 'mcp-command' | 'mcp-response' | 'canvas-state' | 'mcp-connect' | 'frontend-connect'
  requestId?: number
  command?: string
  params?: Record<string, unknown>
  result?: unknown
  nodes?: CanvasNode[]
  edges?: CanvasEdge[]
  selectedNodeId?: string | null
  sessionId?: string
  clientType?: 'mcp' | 'frontend'
}

interface CanvasNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: {
    label: string
    [key: string]: unknown
  }
}

interface CanvasEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

interface CanvasState {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedNodeId: string | null
  lastUpdate: number
}

// ============================================
// Agent Builder MCP Server
// ============================================

class AgentBuilderMcpServer {
  private server: Server
  private supabase: SupabaseClient | null = null
  private channel: RealtimeChannel | null = null
  private sessionId: string
  private isConnected = false
  private canvasState: CanvasState = {
    nodes: [],
    edges: [],
    selectedNodeId: null,
    lastUpdate: 0,
  }
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }>()

  constructor() {
    // 세션 ID는 환경변수 또는 자동 생성
    this.sessionId = process.env.AGENT_BUILDER_SESSION_ID || this.generateSessionId()

    this.server = new Server(
      {
        name: 'agent-builder-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    )

    this.setupHandlers()
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'agent_builder_connect',
          description: 'Agent Builder에 연결합니다. 세션 ID를 지정하여 특정 Agent Builder에 연결할 수 있습니다.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              sessionId: {
                type: 'string',
                description: 'Agent Builder 세션 ID (UI에 표시된 값). 지정하지 않으면 새 세션을 생성합니다.',
              },
            },
          },
        },
        {
          name: 'agent_builder_disconnect',
          description: 'Agent Builder 연결을 종료합니다.',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
        {
          name: 'agent_builder_get_canvas',
          description: '현재 Agent Builder 캔버스 상태(노드, 엣지)를 조회합니다.',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
        {
          name: 'agent_builder_create_node',
          description: 'Agent Builder 캔버스에 새 노드를 생성합니다.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              type: {
                type: 'string',
                enum: ['start', 'end', 'llm', 'prompt', 'condition', 'tool', 'memory', 'api', 'code', 'loop', 'parallel', 'merge', 'delay', 'log', 'variable', 'transform', 'validate', 'error', 'retry', 'cache', 'webhook', 'email', 'schedule', 'human', 'approval', 'notification', 'database', 'file', 'image', 'audio', 'video', 'embedding', 'search', 'classify', 'summarize', 'translate', 'sentiment'],
                description: '노드 타입',
              },
              label: {
                type: 'string',
                description: '노드 라벨 (선택사항)',
              },
              position: {
                type: 'object',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                },
                description: '노드 위치 (선택사항, 자동 배치)',
              },
              config: {
                type: 'object',
                description: '노드 설정 (선택사항)',
              },
            },
            required: ['type'],
          },
        },
        {
          name: 'agent_builder_update_node',
          description: '기존 노드의 라벨이나 설정을 수정합니다.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              nodeId: {
                type: 'string',
                description: '수정할 노드 ID',
              },
              label: {
                type: 'string',
                description: '새 라벨',
              },
              config: {
                type: 'object',
                description: '새 설정',
              },
            },
            required: ['nodeId'],
          },
        },
        {
          name: 'agent_builder_delete_node',
          description: '노드를 삭제합니다. 연결된 엣지도 함께 삭제됩니다.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              nodeId: {
                type: 'string',
                description: '삭제할 노드 ID',
              },
            },
            required: ['nodeId'],
          },
        },
        {
          name: 'agent_builder_connect_nodes',
          description: '두 노드를 연결합니다.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              sourceId: {
                type: 'string',
                description: '소스 노드 ID',
              },
              targetId: {
                type: 'string',
                description: '타겟 노드 ID',
              },
              sourceHandle: {
                type: 'string',
                description: '소스 핸들 (선택사항)',
              },
              targetHandle: {
                type: 'string',
                description: '타겟 핸들 (선택사항)',
              },
            },
            required: ['sourceId', 'targetId'],
          },
        },
        {
          name: 'agent_builder_disconnect_nodes',
          description: '두 노드의 연결을 해제합니다.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              sourceId: {
                type: 'string',
                description: '소스 노드 ID',
              },
              targetId: {
                type: 'string',
                description: '타겟 노드 ID',
              },
            },
            required: ['sourceId', 'targetId'],
          },
        },
        {
          name: 'agent_builder_clear_canvas',
          description: '캔버스의 모든 노드와 엣지를 삭제합니다.',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
        {
          name: 'agent_builder_load_template',
          description: '미리 정의된 에이전트 템플릿을 로드합니다.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              templateId: {
                type: 'string',
                enum: ['basic', 'chatbot', 'rag', 'multi-agent', 'workflow'],
                description: '템플릿 ID',
              },
            },
            required: ['templateId'],
          },
        },
        {
          name: 'agent_builder_validate',
          description: '현재 에이전트 설정을 검증합니다.',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
        {
          name: 'agent_builder_export',
          description: '에이전트를 JSON으로 내보냅니다.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              name: {
                type: 'string',
                description: '에이전트 이름',
              },
            },
          },
        },
        {
          name: 'agent_builder_create_workflow',
          description: '자연어 설명을 기반으로 완전한 에이전트 워크플로우를 자동 생성합니다.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              description: {
                type: 'string',
                description: '생성할 에이전트 워크플로우에 대한 설명',
              },
              complexity: {
                type: 'string',
                enum: ['simple', 'medium', 'complex'],
                description: '워크플로우 복잡도 (기본값: medium)',
              },
            },
            required: ['description'],
          },
        },
      ],
    }))

    // List resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'agent-builder://canvas/state',
          name: 'Canvas State',
          description: '현재 Agent Builder 캔버스 상태',
          mimeType: 'application/json',
        },
        {
          uri: 'agent-builder://connection/status',
          name: 'Connection Status',
          description: 'Agent Builder 연결 상태',
          mimeType: 'application/json',
        },
      ],
    }))

    // Read resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params

      if (uri === 'agent-builder://canvas/state') {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(this.canvasState, null, 2),
            },
          ],
        }
      }

      if (uri === 'agent-builder://connection/status') {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                connected: this.isConnected,
                sessionId: this.sessionId,
                lastUpdate: this.canvasState.lastUpdate,
              }, null, 2),
            },
          ],
        }
      }

      throw new Error(`Unknown resource: ${uri}`)
    })

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        switch (name) {
          case 'agent_builder_connect':
            return await this.handleConnect(args as { sessionId?: string })

          case 'agent_builder_disconnect':
            return await this.handleDisconnect()

          case 'agent_builder_get_canvas':
            return await this.handleGetCanvas()

          case 'agent_builder_create_node':
            return await this.handleCreateNode(args as {
              type: string
              label?: string
              position?: { x: number; y: number }
              config?: Record<string, unknown>
            })

          case 'agent_builder_update_node':
            return await this.handleUpdateNode(args as {
              nodeId: string
              label?: string
              config?: Record<string, unknown>
            })

          case 'agent_builder_delete_node':
            return await this.handleDeleteNode(args as { nodeId: string })

          case 'agent_builder_connect_nodes':
            return await this.handleConnectNodes(args as {
              sourceId: string
              targetId: string
              sourceHandle?: string
              targetHandle?: string
            })

          case 'agent_builder_disconnect_nodes':
            return await this.handleDisconnectNodes(args as {
              sourceId: string
              targetId: string
            })

          case 'agent_builder_clear_canvas':
            return await this.handleClearCanvas()

          case 'agent_builder_load_template':
            return await this.handleLoadTemplate(args as { templateId: string })

          case 'agent_builder_validate':
            return await this.handleValidate()

          case 'agent_builder_export':
            return await this.handleExport(args as { name?: string })

          case 'agent_builder_create_workflow':
            return await this.handleCreateWorkflow(args as {
              description: string
              complexity?: string
            })

          default:
            throw new Error(`Unknown tool: ${name}`)
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `오류: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        }
      }
    })
  }

  // ============================================
  // Supabase Realtime Connection
  // ============================================

  private async connectToSupabase(sessionId: string): Promise<void> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase 환경변수가 설정되지 않았습니다. SUPABASE_URL과 SUPABASE_ANON_KEY를 설정하세요.')
    }

    this.sessionId = sessionId
    this.supabase = createClient(supabaseUrl, supabaseKey)

    const channelName = `mcp-bridge:${sessionId}`
    console.error(`[MCP Server] Connecting to channel: ${channelName}`)

    this.channel = this.supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: 'mcp' },
      },
    })

    // 메시지 수신 핸들러
    this.channel.on('broadcast', { event: 'mcp-message' }, ({ payload }) => {
      this.handleIncomingMessage(payload as McpMessage)
    })

    // Presence 이벤트
    this.channel.on('presence', { event: 'join' }, ({ key }) => {
      console.error(`[MCP Server] Client joined: ${key}`)
    })

    this.channel.on('presence', { event: 'leave' }, ({ key }) => {
      console.error(`[MCP Server] Client left: ${key}`)
    })

    // 채널 구독
    await new Promise<void>((resolve, reject) => {
      this.channel!.subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          console.error('[MCP Server] Connected to channel')
          this.isConnected = true

          // Presence 등록
          await this.channel!.track({
            clientType: 'mcp',
            online_at: new Date().toISOString(),
          })

          // 연결 알림
          this.sendMessage({
            type: 'mcp-connect',
            clientType: 'mcp',
            sessionId: this.sessionId,
          })

          resolve()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`[MCP Server] Connection failed: ${status}`, err)
          this.isConnected = false
          reject(new Error(`연결 실패: ${status}`))
        }
      })
    })
  }

  private handleIncomingMessage(message: McpMessage): void {
    console.error(`[MCP Server] Received: ${message.type}`)

    switch (message.type) {
      case 'canvas-state':
        // 캔버스 상태 업데이트
        this.canvasState = {
          nodes: message.nodes || [],
          edges: message.edges || [],
          selectedNodeId: message.selectedNodeId || null,
          lastUpdate: Date.now(),
        }
        console.error(`[MCP Server] Canvas updated: ${this.canvasState.nodes.length} nodes, ${this.canvasState.edges.length} edges`)
        break

      case 'mcp-response':
        // 응답 처리
        if (message.requestId && this.pendingRequests.has(message.requestId)) {
          const pending = this.pendingRequests.get(message.requestId)!
          clearTimeout(pending.timeout)
          this.pendingRequests.delete(message.requestId)

          if (message.result && typeof message.result === 'object' && 'error' in message.result) {
            pending.reject(new Error(String((message.result as Record<string, unknown>).error)))
          } else {
            pending.resolve(message.result)
          }
        }
        break

      case 'frontend-connect':
        console.error('[MCP Server] Agent Builder connected')
        // 캔버스 상태 요청
        this.sendMessage({ type: 'mcp-connect', clientType: 'mcp', sessionId: this.sessionId })
        break
    }
  }

  private sendMessage(message: McpMessage): void {
    if (!this.channel || !this.isConnected) {
      console.error('[MCP Server] Cannot send message: not connected')
      return
    }

    this.channel.send({
      type: 'broadcast',
      event: 'mcp-message',
      payload: message,
    })
  }

  private async sendCommand(command: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.isConnected) {
      throw new Error('Agent Builder에 연결되지 않았습니다. agent_builder_connect를 먼저 실행하세요.')
    }

    const requestId = Date.now()

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('요청 시간 초과 (30초)'))
      }, 30000)

      this.pendingRequests.set(requestId, { resolve, reject, timeout })

      this.sendMessage({
        type: 'mcp-command',
        requestId,
        command,
        params,
      })
    })
  }

  // ============================================
  // Tool Handlers
  // ============================================

  private async handleConnect(args: { sessionId?: string }) {
    const targetSessionId = args.sessionId || this.sessionId

    if (this.isConnected && this.sessionId === targetSessionId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `이미 Agent Builder에 연결되어 있습니다.\n세션 ID: ${this.sessionId}`,
          },
        ],
      }
    }

    // 기존 연결 해제
    if (this.isConnected) {
      await this.handleDisconnect()
    }

    await this.connectToSupabase(targetSessionId)

    return {
      content: [
        {
          type: 'text' as const,
          text: `Agent Builder에 연결되었습니다.\n세션 ID: ${this.sessionId}\n\n이제 agent_builder_* 도구를 사용하여 Agent Builder를 제어할 수 있습니다.`,
        },
      ],
    }
  }

  private async handleDisconnect() {
    if (this.channel) {
      await this.channel.unsubscribe()
      this.supabase?.removeChannel(this.channel)
      this.channel = null
    }
    this.isConnected = false
    this.canvasState = { nodes: [], edges: [], selectedNodeId: null, lastUpdate: 0 }

    return {
      content: [
        {
          type: 'text' as const,
          text: 'Agent Builder 연결이 종료되었습니다.',
        },
      ],
    }
  }

  private async handleGetCanvas() {
    if (!this.isConnected) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Agent Builder에 연결되지 않았습니다. agent_builder_connect를 먼저 실행하세요.',
          },
        ],
      }
    }

    const { nodes, edges } = this.canvasState

    let summary = `## Agent Builder 캔버스 상태\n\n`
    summary += `- 노드 수: ${nodes.length}\n`
    summary += `- 연결 수: ${edges.length}\n\n`

    if (nodes.length > 0) {
      summary += `### 노드 목록\n`
      nodes.forEach((node, i) => {
        summary += `${i + 1}. **${node.data.label}** (${node.type})\n`
        summary += `   - ID: \`${node.id}\`\n`
        summary += `   - 위치: (${Math.round(node.position.x)}, ${Math.round(node.position.y)})\n`
      })
    }

    if (edges.length > 0) {
      summary += `\n### 연결 목록\n`
      edges.forEach((edge, i) => {
        const sourceNode = nodes.find(n => n.id === edge.source)
        const targetNode = nodes.find(n => n.id === edge.target)
        summary += `${i + 1}. ${sourceNode?.data.label || edge.source} → ${targetNode?.data.label || edge.target}\n`
      })
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: summary,
        },
      ],
    }
  }

  private async handleCreateNode(args: {
    type: string
    label?: string
    position?: { x: number; y: number }
    config?: Record<string, unknown>
  }) {
    const result = await this.sendCommand('create_node', args) as { success: boolean; nodeId?: string; message?: string; error?: string }

    if (result.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `노드가 생성되었습니다.\n- 노드 ID: ${result.nodeId}\n- 메시지: ${result.message}`,
          },
        ],
      }
    } else {
      throw new Error(result.error || '노드 생성 실패')
    }
  }

  private async handleUpdateNode(args: {
    nodeId: string
    label?: string
    config?: Record<string, unknown>
  }) {
    const result = await this.sendCommand('update_node', args) as { success: boolean; message?: string; error?: string }

    if (result.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: result.message || '노드가 수정되었습니다.',
          },
        ],
      }
    } else {
      throw new Error(result.error || '노드 수정 실패')
    }
  }

  private async handleDeleteNode(args: { nodeId: string }) {
    const result = await this.sendCommand('delete_node', args) as { success: boolean; message?: string; error?: string }

    if (result.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: result.message || '노드가 삭제되었습니다.',
          },
        ],
      }
    } else {
      throw new Error(result.error || '노드 삭제 실패')
    }
  }

  private async handleConnectNodes(args: {
    sourceId: string
    targetId: string
    sourceHandle?: string
    targetHandle?: string
  }) {
    const result = await this.sendCommand('connect_nodes', args) as { success: boolean; edgeId?: string; message?: string; error?: string }

    if (result.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `노드가 연결되었습니다.\n- 엣지 ID: ${result.edgeId}\n- ${result.message}`,
          },
        ],
      }
    } else {
      throw new Error(result.error || '노드 연결 실패')
    }
  }

  private async handleDisconnectNodes(args: { sourceId: string; targetId: string }) {
    const result = await this.sendCommand('disconnect_nodes', args) as { success: boolean; message?: string; error?: string }

    if (result.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: result.message || '노드 연결이 해제되었습니다.',
          },
        ],
      }
    } else {
      throw new Error(result.error || '노드 연결 해제 실패')
    }
  }

  private async handleClearCanvas() {
    const result = await this.sendCommand('clear_canvas', {}) as { success: boolean; message?: string; error?: string }

    if (result.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: result.message || '캔버스가 초기화되었습니다.',
          },
        ],
      }
    } else {
      throw new Error(result.error || '캔버스 초기화 실패')
    }
  }

  private async handleLoadTemplate(args: { templateId: string }) {
    const result = await this.sendCommand('load_template', args) as { success: boolean; message?: string; nodeCount?: number; edgeCount?: number; error?: string }

    if (result.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `템플릿이 로드되었습니다.\n- ${result.message}\n- 노드: ${result.nodeCount}개\n- 연결: ${result.edgeCount}개`,
          },
        ],
      }
    } else {
      throw new Error(result.error || '템플릿 로드 실패')
    }
  }

  private async handleValidate() {
    const result = await this.sendCommand('validate_agent', {}) as { valid: boolean; errors?: string[]; message?: string }

    if (result.valid) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `✅ ${result.message || '에이전트 설정이 유효합니다.'}`,
          },
        ],
      }
    } else {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ 검증 실패:\n${result.errors?.map(e => `- ${e}`).join('\n') || '알 수 없는 오류'}`,
          },
        ],
      }
    }
  }

  private async handleExport(args: { name?: string }) {
    const result = await this.sendCommand('export_agent', args) as { success: boolean; json?: unknown; message?: string; error?: string }

    if (result.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `에이전트가 JSON으로 내보내졌습니다:\n\n\`\`\`json\n${JSON.stringify(result.json, null, 2)}\n\`\`\``,
          },
        ],
      }
    } else {
      throw new Error(result.error || '내보내기 실패')
    }
  }

  private async handleCreateWorkflow(args: { description: string; complexity?: string }) {
    // 워크플로우 자동 생성 로직
    // 실제로는 AI를 사용하여 워크플로우를 생성해야 하지만,
    // 여기서는 간단한 템플릿 기반 생성을 수행합니다.

    const complexity = args.complexity || 'medium'

    // 먼저 캔버스 초기화
    await this.sendCommand('clear_canvas', {})

    // 기본 구조 생성: Start -> 노드들 -> End
    const nodes: Array<{ type: string; label: string; position: { x: number; y: number } }> = [
      { type: 'start', label: 'Start', position: { x: 100, y: 200 } },
    ]

    // 복잡도에 따라 노드 추가
    if (complexity === 'simple') {
      nodes.push(
        { type: 'llm', label: 'LLM 처리', position: { x: 350, y: 200 } },
        { type: 'end', label: 'End', position: { x: 600, y: 200 } },
      )
    } else if (complexity === 'medium') {
      nodes.push(
        { type: 'prompt', label: '프롬프트', position: { x: 300, y: 200 } },
        { type: 'llm', label: 'LLM 처리', position: { x: 500, y: 200 } },
        { type: 'transform', label: '결과 변환', position: { x: 700, y: 200 } },
        { type: 'end', label: 'End', position: { x: 900, y: 200 } },
      )
    } else {
      nodes.push(
        { type: 'prompt', label: '시스템 프롬프트', position: { x: 300, y: 100 } },
        { type: 'memory', label: '컨텍스트 메모리', position: { x: 300, y: 300 } },
        { type: 'llm', label: 'LLM 추론', position: { x: 500, y: 200 } },
        { type: 'condition', label: '조건 분기', position: { x: 700, y: 200 } },
        { type: 'tool', label: '도구 실행', position: { x: 900, y: 100 } },
        { type: 'transform', label: '결과 처리', position: { x: 900, y: 300 } },
        { type: 'merge', label: '결과 병합', position: { x: 1100, y: 200 } },
        { type: 'end', label: 'End', position: { x: 1300, y: 200 } },
      )
    }

    // 노드 생성
    const createdNodeIds: string[] = []
    for (const node of nodes) {
      const result = await this.sendCommand('create_node', node) as { success: boolean; nodeId?: string }
      if (result.success && result.nodeId) {
        createdNodeIds.push(result.nodeId)
      }
    }

    // 연결 생성 (순차적으로)
    for (let i = 0; i < createdNodeIds.length - 1; i++) {
      await this.sendCommand('connect_nodes', {
        sourceId: createdNodeIds[i],
        targetId: createdNodeIds[i + 1],
      })
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `워크플로우가 생성되었습니다!\n\n**설명**: ${args.description}\n**복잡도**: ${complexity}\n**생성된 노드**: ${createdNodeIds.length}개\n\n이제 각 노드의 설정을 수정하거나 agent_builder_validate를 실행하여 검증할 수 있습니다.`,
        },
      ],
    }
  }

  // ============================================
  // Server Start
  // ============================================

  async run(): Promise<void> {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    console.error('[MCP Server] Agent Builder MCP Server started')
    console.error(`[MCP Server] Default session ID: ${this.sessionId}`)
  }
}

// Start server
const server = new AgentBuilderMcpServer()
server.run().catch(console.error)
