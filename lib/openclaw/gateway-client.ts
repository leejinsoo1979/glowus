/**
 * OpenClaw Gateway Client
 * WebSocket 클라이언트로 OpenClaw Gateway (ws://127.0.0.1:18789)와 통신
 */

import {
  OpenClawEvent,
  OpenClawRequest,
  OpenClawResponse,
  GlowUSContext,
  GatewayClientOptions,
  ConnectionState,
  EventHandler,
  SkillResult,
} from './types';

const DEFAULT_OPTIONS: Required<GatewayClientOptions> = {
  url: 'ws://127.0.0.1:18789',
  autoReconnect: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
  connectionTimeout: 10000,
  requestTimeout: 60000,
  authToken: '',
  debug: false,
};

export class OpenClawGatewayClient {
  private ws: WebSocket | null = null;
  private options: Required<GatewayClientOptions>;
  private state: ConnectionState = {
    connected: false,
    connecting: false,
    reconnectAttempts: 0,
  };

  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  private reconnectTimer: NodeJS.Timeout | null = null;
  private sessionId: string | null = null;

  constructor(options: GatewayClientOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ============================================
  // Connection Management
  // ============================================

  /**
   * OpenClaw Gateway에 연결
   */
  async connect(): Promise<void> {
    if (this.state.connected || this.state.connecting) {
      this.log('Already connected or connecting');
      return;
    }

    this.state.connecting = true;
    this.emit('connecting', { url: this.options.url });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.state.connecting = false;
        reject(new Error(`Connection timeout after ${this.options.connectionTimeout}ms`));
      }, this.options.connectionTimeout);

      try {
        // Node.js 환경에서는 ws 패키지 사용
        const WebSocketImpl = typeof WebSocket !== 'undefined'
          ? WebSocket
          : require('ws');

        this.ws = new WebSocketImpl(this.options.url);
        const ws = this.ws!;

        ws.onopen = () => {
          clearTimeout(timeout);
          this.state.connected = true;
          this.state.connecting = false;
          this.state.lastConnected = new Date();
          this.state.reconnectAttempts = 0;
          this.state.error = undefined;

          this.log('Connected to OpenClaw Gateway');
          this.emit('connected', { url: this.options.url });

          // 인증 토큰이 있으면 전송
          if (this.options.authToken) {
            this.sendRaw({
              type: 'auth',
              token: this.options.authToken,
            });
          }

          resolve();
        };

        ws.onclose = (event: any) => {
          clearTimeout(timeout);
          const wasConnected = this.state.connected;
          this.state.connected = false;
          this.state.connecting = false;
          this.state.lastDisconnected = new Date();

          this.log(`Disconnected: code=${event.code}, reason=${event.reason}`);
          this.emit('disconnected', { code: event.code, reason: event.reason });

          // 재연결 시도
          if (wasConnected && this.options.autoReconnect) {
            this.scheduleReconnect();
          }

          if (!wasConnected) {
            reject(new Error(`Connection closed: ${event.reason || 'Unknown reason'}`));
          }
        };

        ws.onerror = (error: any) => {
          this.log('WebSocket error:', error);
          this.state.error = error.message || 'WebSocket error';
          this.emit('error', { error: this.state.error });
        };

        ws.onmessage = (event: any) => {
          this.handleMessage(event.data);
        };

      } catch (error) {
        clearTimeout(timeout);
        this.state.connecting = false;
        this.state.error = error instanceof Error ? error.message : 'Connection failed';
        reject(error);
      }
    });
  }

  /**
   * 연결 종료
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.state.connected = false;
    this.state.connecting = false;
    this.sessionId = null;

    // 대기 중인 요청 모두 거부
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Connection closed'));
    });
    this.pendingRequests.clear();

    this.emit('disconnected', { reason: 'Client disconnect' });
  }

  /**
   * 재연결 스케줄링
   */
  private scheduleReconnect(): void {
    if (this.state.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.log('Max reconnect attempts reached');
      this.emit('reconnect_failed', { attempts: this.state.reconnectAttempts });
      return;
    }

    this.state.reconnectAttempts++;
    const delay = this.options.reconnectInterval * Math.pow(1.5, this.state.reconnectAttempts - 1);

    this.log(`Scheduling reconnect in ${delay}ms (attempt ${this.state.reconnectAttempts})`);
    this.emit('reconnecting', { attempt: this.state.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        this.log('Reconnect failed:', error);
        this.scheduleReconnect();
      });
    }, delay);
  }

  // ============================================
  // Message Handling
  // ============================================

  /**
   * 메시지 전송 (GlowUS 컨텍스트 주입)
   */
  async sendMessage(message: string, context?: GlowUSContext): Promise<OpenClawResponse> {
    return this.sendRequest({
      action: 'send_message',
      message,
      context,
    });
  }

  /**
   * 스킬 직접 호출
   */
  async invokeSkill(
    skillName: string,
    params: Record<string, any>,
    context?: GlowUSContext
  ): Promise<SkillResult> {
    const startTime = Date.now();

    try {
      const response = await this.sendRequest({
        action: 'invoke_skill',
        skill: skillName,
        params,
        context,
      });

      if (!response.success) {
        return {
          success: false,
          error: {
            code: response.error?.code || 'SKILL_ERROR',
            message: response.error?.message || 'Skill execution failed',
          },
          duration: Date.now() - startTime,
        };
      }

      return {
        success: true,
        data: response.data,
        duration: Date.now() - startTime,
        toolsUsed: response.data?.toolsUsed,
        cost: response.data?.cost,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 스킬 목록 조회
   */
  async listSkills(): Promise<string[]> {
    const response = await this.sendRequest({
      action: 'list_skills',
    });

    return response.data?.skills || [];
  }

  /**
   * 스킬 상세 정보 조회
   */
  async getSkill(skillName: string): Promise<any> {
    const response = await this.sendRequest({
      action: 'get_skill',
      skill: skillName,
    });

    return response.data;
  }

  /**
   * 현재 작업 취소
   */
  async cancel(): Promise<void> {
    await this.sendRequest({
      action: 'cancel',
    });
  }

  /**
   * 세션 리셋
   */
  async reset(): Promise<void> {
    await this.sendRequest({
      action: 'reset',
    });
    this.sessionId = null;
  }

  // ============================================
  // Internal Methods
  // ============================================

  /**
   * 요청 전송 (응답 대기)
   */
  private async sendRequest(request: OpenClawRequest): Promise<OpenClawResponse> {
    if (!this.state.connected || !this.ws) {
      throw new Error('Not connected to OpenClaw Gateway');
    }

    const requestId = this.generateRequestId();
    const payload = {
      ...request,
      requestId,
      sessionId: this.sessionId,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout after ${this.options.requestTimeout}ms`));
      }, this.options.requestTimeout);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      try {
        this.sendRaw(payload);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(error);
      }
    });
  }

  /**
   * Raw 데이터 전송
   */
  private sendRaw(data: any): void {
    if (!this.ws || this.ws.readyState !== 1) { // 1 = OPEN
      throw new Error('WebSocket is not open');
    }

    const payload = JSON.stringify(data);
    this.log('Sending:', payload);
    this.ws.send(payload);
  }

  /**
   * 메시지 수신 처리
   */
  private handleMessage(data: string): void {
    this.log('Received:', data);

    try {
      const message = JSON.parse(data);

      // 응답 메시지인 경우
      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const { resolve, reject, timeout } = this.pendingRequests.get(message.requestId)!;
        clearTimeout(timeout);
        this.pendingRequests.delete(message.requestId);

        if (message.error) {
          reject(new Error(message.error.message || 'Request failed'));
        } else {
          resolve(message);
        }
        return;
      }

      // 세션 ID 업데이트
      if (message.sessionId) {
        this.sessionId = message.sessionId;
      }

      // 이벤트 발생
      const event: OpenClawEvent = {
        type: message.type || 'message',
        sessionId: message.sessionId || this.sessionId || '',
        timestamp: new Date(message.timestamp || Date.now()),
        data: message.data || message,
      };

      this.emit(event.type, event);
      this.emit('event', event); // 모든 이벤트 구독

    } catch (error) {
      this.log('Failed to parse message:', error);
      this.emit('error', { error: 'Failed to parse message', data });
    }
  }

  // ============================================
  // Event Emitter
  // ============================================

  /**
   * 이벤트 구독
   */
  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * 이벤트 구독 해제
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * 일회성 이벤트 구독
   */
  once(event: string, handler: EventHandler): void {
    const wrappedHandler: EventHandler = (data) => {
      this.off(event, wrappedHandler);
      handler(data);
    };
    this.on(event, wrappedHandler);
  }

  /**
   * 이벤트 발생
   */
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Event handler error for '${event}':`, error);
        }
      });
    }
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.state.connected;
  }

  /**
   * 연결 상태 조회
   */
  getState(): ConnectionState {
    return { ...this.state };
  }

  /**
   * 세션 ID 조회
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * 요청 ID 생성
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 디버그 로그
   */
  private log(...args: any[]): void {
    if (this.options.debug) {
      console.log('[OpenClaw Gateway]', ...args);
    }
  }
}

// 싱글톤 인스턴스 (선택적 사용)
let defaultClient: OpenClawGatewayClient | null = null;

export function getDefaultClient(options?: GatewayClientOptions): OpenClawGatewayClient {
  if (!defaultClient) {
    defaultClient = new OpenClawGatewayClient(options);
  }
  return defaultClient;
}

export function resetDefaultClient(): void {
  if (defaultClient) {
    defaultClient.disconnect();
    defaultClient = null;
  }
}
