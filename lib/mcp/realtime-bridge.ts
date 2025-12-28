/**
 * MCP Realtime Bridge using Supabase Realtime
 *
 * WebSocket 서버 대신 Supabase Realtime을 사용하여
 * Claude Code(MCP Server)와 Agent Builder(Frontend)를 연결합니다.
 *
 * 이 방식으로 Vercel에 배포해도 MCP 기능을 사용할 수 있습니다.
 */

import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

export interface McpMessage {
  type: 'mcp-command' | 'mcp-response' | 'canvas-state' | 'mcp-connect' | 'frontend-connect'
  requestId?: number
  command?: string
  params?: Record<string, unknown>
  result?: unknown
  nodes?: unknown[]
  edges?: unknown[]
  selectedNodeId?: string | null
  sessionId?: string
  clientType?: 'mcp' | 'frontend'
}

export interface McpRealtimeBridgeOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
  sessionId: string
  clientType: 'mcp' | 'frontend'
  onMessage?: (message: McpMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
}

/**
 * MCP Realtime Bridge Class
 * Supabase Realtime Channel을 통해 MCP 통신을 처리합니다.
 */
export class McpRealtimeBridge {
  private channel: RealtimeChannel | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: SupabaseClient<any, any, any>
  private sessionId: string
  private clientType: 'mcp' | 'frontend'
  private onMessage?: (message: McpMessage) => void
  private onConnect?: () => void
  private onDisconnect?: () => void
  private onError?: (error: Error) => void
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null

  constructor(options: McpRealtimeBridgeOptions) {
    this.supabase = options.supabase
    this.sessionId = options.sessionId
    this.clientType = options.clientType
    this.onMessage = options.onMessage
    this.onConnect = options.onConnect
    this.onDisconnect = options.onDisconnect
    this.onError = options.onError
  }

  /**
   * Supabase Realtime Channel에 연결
   */
  connect(): void {
    if (this.channel) {
      console.log('[MCP Bridge] Already connected')
      return
    }

    // 재연결 타이머 정리
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    const channelName = `mcp-bridge:${this.sessionId}`
    console.log(`[MCP Bridge] Connecting to channel: ${channelName}`)

    this.channel = this.supabase.channel(channelName, {
      config: {
        broadcast: { self: false }, // 자신이 보낸 메시지는 받지 않음
        presence: { key: this.clientType },
      },
    })

    // 브로드캐스트 메시지 수신
    this.channel.on('broadcast', { event: 'mcp-message' }, ({ payload }) => {
      console.log('[MCP Bridge] Received:', payload?.type)
      if (payload && this.onMessage) {
        this.onMessage(payload as McpMessage)
      }
    })

    // Presence로 다른 클라이언트 감지
    this.channel.on('presence', { event: 'sync' }, () => {
      const state = this.channel?.presenceState()
      console.log('[MCP Bridge] Presence state:', Object.keys(state || {}))
    })

    this.channel.on('presence', { event: 'join' }, ({ key }) => {
      console.log(`[MCP Bridge] Client joined: ${key}`)
    })

    this.channel.on('presence', { event: 'leave' }, ({ key }) => {
      console.log(`[MCP Bridge] Client left: ${key}`)
    })

    // 채널 구독
    this.channel.subscribe(async (status, err) => {
      console.log(`[MCP Bridge] Channel status: ${status}`, err ? `Error: ${err.message}` : '')

      if (status === 'SUBSCRIBED') {
        console.log('[MCP Bridge] Connected to channel')
        this.isConnected = true
        this.reconnectAttempts = 0 // 성공 시 초기화

        // Presence 등록
        try {
          await this.channel?.track({
            clientType: this.clientType,
            online_at: new Date().toISOString(),
          })
        } catch (e) {
          console.error('[MCP Bridge] Presence track failed:', e)
        }

        // 연결 알림 메시지 전송
        this.send({
          type: this.clientType === 'mcp' ? 'mcp-connect' : 'frontend-connect',
          clientType: this.clientType,
          sessionId: this.sessionId,
        })

        // Heartbeat 시작
        this.startHeartbeat()

        this.onConnect?.()
      } else if (status === 'CLOSED') {
        console.log('[MCP Bridge] Channel closed')
        this.isConnected = false
        this.stopHeartbeat()
        this.onDisconnect?.()
        // CLOSED는 정상 종료일 수 있으므로 재연결 안함
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[MCP Bridge] Channel error:', err)
        this.isConnected = false
        this.stopHeartbeat()
        this.onDisconnect?.()
        // 에러 시 재연결
        this.scheduleReconnect()
      } else if (status === 'TIMED_OUT') {
        console.log('[MCP Bridge] Channel timed out')
        this.isConnected = false
        this.stopHeartbeat()
        this.onDisconnect?.()
        this.scheduleReconnect()
      }
    })
  }

  /**
   * Heartbeat 시작 (연결 유지)
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()

    // 30초마다 presence 업데이트
    this.heartbeatTimer = setInterval(async () => {
      if (this.channel && this.isConnected) {
        try {
          await this.channel.track({
            clientType: this.clientType,
            online_at: new Date().toISOString(),
            heartbeat: Date.now(),
          })
        } catch (error) {
          console.error('[MCP Bridge] Heartbeat failed:', error)
          // Heartbeat 실패 시 재연결
          this.handleConnectionLost()
        }
      }
    }, 30000)
  }

  /**
   * Heartbeat 중지
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 재연결 스케줄링
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[MCP Bridge] Max reconnect attempts reached')
      this.onError?.(new Error('Max reconnect attempts reached'))
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000) // 최대 30초
    console.log(`[MCP Bridge] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.cleanupChannel()
      this.connect()
    }, delay)
  }

  /**
   * 연결 끊김 처리
   */
  private handleConnectionLost(): void {
    console.log('[MCP Bridge] Connection lost, reconnecting...')
    this.isConnected = false
    this.stopHeartbeat()
    this.cleanupChannel()
    this.scheduleReconnect()
  }

  /**
   * 채널 정리
   */
  private cleanupChannel(): void {
    if (this.channel) {
      try {
        this.channel.unsubscribe()
        this.supabase.removeChannel(this.channel)
      } catch (e) {
        // 무시
      }
      this.channel = null
    }
  }

  /**
   * 메시지 전송
   */
  send(message: McpMessage): void {
    if (!this.channel || !this.isConnected) {
      console.warn('[MCP Bridge] Cannot send, not connected')
      return
    }

    this.channel.send({
      type: 'broadcast',
      event: 'mcp-message',
      payload: message,
    })
  }

  /**
   * MCP 명령 전송 (응답 대기)
   */
  sendCommand(command: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const requestId = Date.now()
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'))
      }, 30000)

      // 응답 대기 핸들러
      const originalOnMessage = this.onMessage
      this.onMessage = (msg: McpMessage) => {
        if (msg.type === 'mcp-response' && msg.requestId === requestId) {
          clearTimeout(timeout)
          this.onMessage = originalOnMessage
          if (msg.result && typeof msg.result === 'object' && 'error' in msg.result) {
            reject(new Error(String((msg.result as Record<string, unknown>).error)))
          } else {
            resolve(msg.result)
          }
        } else if (originalOnMessage) {
          originalOnMessage(msg)
        }
      }

      // 명령 전송
      this.send({
        type: 'mcp-command',
        requestId,
        command,
        params,
      })
    })
  }

  /**
   * MCP 응답 전송
   */
  sendResponse(requestId: number, result: unknown): void {
    this.send({
      type: 'mcp-response',
      requestId,
      result,
    })
  }

  /**
   * 캔버스 상태 전송
   */
  sendCanvasState(nodes: unknown[], edges: unknown[], selectedNodeId?: string | null): void {
    this.send({
      type: 'canvas-state',
      nodes,
      edges,
      selectedNodeId,
    })
  }

  /**
   * 연결 해제
   */
  disconnect(): void {
    // 타이머 정리
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // 채널 정리
    this.cleanupChannel()
    this.isConnected = false
    this.reconnectAttempts = 0
    console.log('[MCP Bridge] Disconnected')
  }

  /**
   * 연결 상태 확인
   */
  get connected(): boolean {
    return this.isConnected
  }

  /**
   * 수동 재연결
   */
  reconnect(): void {
    console.log('[MCP Bridge] Manual reconnect requested')
    this.disconnect()
    this.reconnectAttempts = 0
    setTimeout(() => this.connect(), 100)
  }
}

/**
 * Session ID 생성
 * 사용자별로 고유한 세션 ID를 생성합니다.
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Local Storage에서 세션 ID 가져오기 또는 생성
 * 또한 /tmp/glow-mcp-session.txt 파일에 저장하여 MCP 서버가 읽을 수 있게 함
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') {
    return generateSessionId()
  }

  const stored = localStorage.getItem('mcp-session-id')
  if (stored) {
    // 기존 세션 ID를 서버에 알림 (자동 연결용)
    notifySessionToServer(stored)
    return stored
  }

  const newId = generateSessionId()
  localStorage.setItem('mcp-session-id', newId)
  notifySessionToServer(newId)
  return newId
}

/**
 * 세션 ID를 서버에 알리기 위해 API 호출
 * MCP 서버가 읽을 수 있는 파일에 저장
 */
async function notifySessionToServer(sessionId: string): Promise<void> {
  try {
    await fetch('/api/mcp-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
  } catch (error) {
    console.warn('[MCP] Failed to notify session to server:', error)
  }
}
