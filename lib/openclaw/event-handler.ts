/**
 * OpenClaw Event Handler
 * OpenClaw Gateway 이벤트 스트림 처리 및 GlowUS 시스템 연동
 */

import {
  OpenClawEvent,
  OpenClawToolEvent,
  OpenClawMessageEvent,
  OpenClawErrorEvent,
  EventHandler,
  AuditLogEntry,
} from './types';
import { OpenClawGatewayClient } from './gateway-client';

// ============================================
// Event Processor
// ============================================

export interface EventProcessorOptions {
  // 로깅
  enableAuditLog?: boolean;
  auditLogCallback?: (entry: AuditLogEntry) => Promise<void>;

  // 비용 추적
  enableCostTracking?: boolean;
  costCallback?: (skillName: string, cost: number) => Promise<void>;

  // 실시간 알림
  enableNotifications?: boolean;
  notificationCallback?: (notification: Notification) => void;

  // 에러 처리
  errorCallback?: (error: OpenClawErrorEvent) => void;

  // 디버그
  debug?: boolean;
}

export interface Notification {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  data?: any;
  timestamp: Date;
}

export class OpenClawEventProcessor {
  private client: OpenClawGatewayClient;
  private options: EventProcessorOptions;
  private eventLog: OpenClawEvent[] = [];
  private activeTools: Map<string, { startTime: Date; toolName: string }> = new Map();

  // 통계
  private stats = {
    eventsProcessed: 0,
    toolsExecuted: 0,
    toolsSucceeded: 0,
    toolsFailed: 0,
    totalDuration: 0,
    totalCost: 0,
  };

  constructor(client: OpenClawGatewayClient, options: EventProcessorOptions = {}) {
    this.client = client;
    this.options = {
      enableAuditLog: true,
      enableCostTracking: true,
      enableNotifications: true,
      debug: false,
      ...options,
    };

    this.setupEventHandlers();
  }

  // ============================================
  // Event Handlers Setup
  // ============================================

  private setupEventHandlers(): void {
    // 모든 이벤트 로깅
    this.client.on('event', this.handleEvent.bind(this));

    // 연결 이벤트
    this.client.on('connected', this.handleConnected.bind(this));
    this.client.on('disconnected', this.handleDisconnected.bind(this));
    this.client.on('reconnecting', this.handleReconnecting.bind(this));

    // 도구 이벤트
    this.client.on('tool_start', this.handleToolStart.bind(this));
    this.client.on('tool_end', this.handleToolEnd.bind(this));

    // 메시지 이벤트
    this.client.on('message', this.handleMessage.bind(this));
    this.client.on('thinking', this.handleThinking.bind(this));
    this.client.on('response', this.handleResponse.bind(this));

    // 에러 이벤트
    this.client.on('error', this.handleError.bind(this));
  }

  // ============================================
  // Event Handlers
  // ============================================

  private handleEvent(event: OpenClawEvent): void {
    this.stats.eventsProcessed++;
    this.eventLog.push(event);

    // 로그 크기 제한 (최근 1000개만 유지)
    if (this.eventLog.length > 1000) {
      this.eventLog = this.eventLog.slice(-1000);
    }

    this.log('Event:', event.type, event.data);
  }

  private handleConnected(data: any): void {
    this.notify({
      type: 'success',
      title: 'Connected',
      message: `Connected to OpenClaw Gateway at ${data.url}`,
      data,
      timestamp: new Date(),
    });
  }

  private handleDisconnected(data: any): void {
    this.notify({
      type: 'warning',
      title: 'Disconnected',
      message: `Disconnected from OpenClaw Gateway: ${data.reason || 'Unknown reason'}`,
      data,
      timestamp: new Date(),
    });
  }

  private handleReconnecting(data: any): void {
    this.notify({
      type: 'info',
      title: 'Reconnecting',
      message: `Attempting to reconnect (attempt ${data.attempt})...`,
      data,
      timestamp: new Date(),
    });
  }

  private async handleToolStart(event: OpenClawToolEvent): Promise<void> {
    const { toolName, params } = event.data;
    const toolId = `${toolName}_${Date.now()}`;

    this.activeTools.set(toolId, {
      startTime: new Date(),
      toolName,
    });

    this.log(`Tool started: ${toolName}`, params);

    this.notify({
      type: 'info',
      title: 'Tool Started',
      message: `Executing ${toolName}...`,
      data: { toolName, params },
      timestamp: new Date(),
    });

    // 감사 로그
    if (this.options.enableAuditLog && this.options.auditLogCallback) {
      await this.options.auditLogCallback({
        action: 'tool_start',
        skillName: toolName,
        params,
        userId: '', // 컨텍스트에서 가져와야 함
        agentId: '',
        timestamp: new Date(),
        success: true,
      });
    }
  }

  private async handleToolEnd(event: OpenClawToolEvent): Promise<void> {
    const { toolName, result, error, duration } = event.data;

    this.stats.toolsExecuted++;
    if (error) {
      this.stats.toolsFailed++;
    } else {
      this.stats.toolsSucceeded++;
    }

    if (duration) {
      this.stats.totalDuration += duration;
    }

    // 비용 추적
    const cost = result?.cost || this.estimateToolCost(toolName, duration);
    if (cost) {
      this.stats.totalCost += cost;

      if (this.options.enableCostTracking && this.options.costCallback) {
        await this.options.costCallback(toolName, cost);
      }
    }

    this.log(`Tool ended: ${toolName}`, { result, error, duration, cost });

    this.notify({
      type: error ? 'error' : 'success',
      title: error ? 'Tool Failed' : 'Tool Completed',
      message: error
        ? `${toolName} failed: ${error}`
        : `${toolName} completed in ${duration}ms`,
      data: { toolName, result, error, duration, cost },
      timestamp: new Date(),
    });

    // 감사 로그
    if (this.options.enableAuditLog && this.options.auditLogCallback) {
      await this.options.auditLogCallback({
        action: 'tool_end',
        skillName: toolName,
        result,
        userId: '',
        agentId: '',
        timestamp: new Date(),
        duration,
        cost,
        success: !error,
        error: error || undefined,
      });
    }

    // 활성 도구 목록에서 제거
    for (const [id, tool] of this.activeTools) {
      if (tool.toolName === toolName) {
        this.activeTools.delete(id);
        break;
      }
    }
  }

  private handleMessage(event: OpenClawMessageEvent): void {
    this.log('Message:', event.data.role, event.data.content);
  }

  private handleThinking(event: OpenClawMessageEvent): void {
    this.log('Thinking:', event.data.content);

    this.notify({
      type: 'info',
      title: 'Processing',
      message: 'AI is thinking...',
      data: event.data,
      timestamp: new Date(),
    });
  }

  private handleResponse(event: OpenClawMessageEvent): void {
    this.log('Response:', event.data.content);
  }

  private handleError(event: OpenClawErrorEvent): void {
    const { code, message, details } = event.data;

    this.log('Error:', code, message, details);

    this.notify({
      type: 'error',
      title: 'Error',
      message: `${code}: ${message}`,
      data: event.data,
      timestamp: new Date(),
    });

    if (this.options.errorCallback) {
      this.options.errorCallback(event);
    }
  }

  // ============================================
  // Custom Event Handlers
  // ============================================

  /**
   * 커스텀 이벤트 핸들러 등록
   */
  on(event: string, handler: EventHandler): void {
    this.client.on(event, handler);
  }

  /**
   * 커스텀 이벤트 핸들러 해제
   */
  off(event: string, handler: EventHandler): void {
    this.client.off(event, handler);
  }

  // ============================================
  // Statistics & Monitoring
  // ============================================

  /**
   * 통계 조회
   */
  getStats() {
    return {
      ...this.stats,
      activeTools: this.activeTools.size,
      successRate: this.stats.toolsExecuted > 0
        ? (this.stats.toolsSucceeded / this.stats.toolsExecuted * 100).toFixed(1)
        : 0,
      averageDuration: this.stats.toolsExecuted > 0
        ? Math.round(this.stats.totalDuration / this.stats.toolsExecuted)
        : 0,
    };
  }

  /**
   * 통계 리셋
   */
  resetStats(): void {
    this.stats = {
      eventsProcessed: 0,
      toolsExecuted: 0,
      toolsSucceeded: 0,
      toolsFailed: 0,
      totalDuration: 0,
      totalCost: 0,
    };
  }

  /**
   * 이벤트 로그 조회
   */
  getEventLog(limit = 100): OpenClawEvent[] {
    return this.eventLog.slice(-limit);
  }

  /**
   * 특정 타입 이벤트만 필터링
   */
  getEventsByType(type: string, limit = 100): OpenClawEvent[] {
    return this.eventLog
      .filter(e => e.type === type)
      .slice(-limit);
  }

  /**
   * 활성 도구 목록 조회
   */
  getActiveTools(): Array<{ toolName: string; startTime: Date; duration: number }> {
    const now = Date.now();
    return Array.from(this.activeTools.values()).map(tool => ({
      toolName: tool.toolName,
      startTime: tool.startTime,
      duration: now - tool.startTime.getTime(),
    }));
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * 도구 비용 추정 (실제로는 더 정교한 로직 필요)
   */
  private estimateToolCost(toolName: string, duration?: number): number {
    // 기본 비용 맵 (실제로는 설정 파일이나 DB에서 가져와야 함)
    const baseCostMap: Record<string, number> = {
      'web_search': 0.01,
      'scrape_website': 0.02,
      'browser_automation': 0.05,
      'code_interpreter': 0.03,
      'github_api': 0.01,
      'default': 0.01,
    };

    const baseCost = baseCostMap[toolName] || baseCostMap['default'];

    // 시간 기반 추가 비용 (1분당 0.01)
    const durationCost = duration ? (duration / 60000) * 0.01 : 0;

    return baseCost + durationCost;
  }

  /**
   * 알림 발송
   */
  private notify(notification: Notification): void {
    if (this.options.enableNotifications && this.options.notificationCallback) {
      this.options.notificationCallback(notification);
    }
  }

  /**
   * 디버그 로그
   */
  private log(...args: any[]): void {
    if (this.options.debug) {
      console.log('[OpenClaw EventProcessor]', ...args);
    }
  }
}

// ============================================
// Stream Handler (SSE/WebSocket 스트림용)
// ============================================

export interface StreamHandlerCallbacks {
  onStart?: () => void;
  onToken?: (token: string) => void;
  onToolStart?: (toolName: string, params?: any) => void;
  onToolEnd?: (toolName: string, result?: any, error?: string) => void;
  onComplete?: (response: string) => void;
  onError?: (error: string) => void;
}

/**
 * 스트리밍 응답 핸들러
 */
export class OpenClawStreamHandler {
  private client: OpenClawGatewayClient;
  private callbacks: StreamHandlerCallbacks;
  private buffer = '';
  private isComplete = false;

  constructor(client: OpenClawGatewayClient, callbacks: StreamHandlerCallbacks) {
    this.client = client;
    this.callbacks = callbacks;

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.client.on('thinking', (event: OpenClawMessageEvent) => {
      const token = event.data.content;
      this.buffer += token;
      this.callbacks.onToken?.(token);
    });

    this.client.on('tool_start', (event: OpenClawToolEvent) => {
      this.callbacks.onToolStart?.(event.data.toolName, event.data.params);
    });

    this.client.on('tool_end', (event: OpenClawToolEvent) => {
      this.callbacks.onToolEnd?.(
        event.data.toolName,
        event.data.result,
        event.data.error
      );
    });

    this.client.on('response', (event: OpenClawMessageEvent) => {
      this.isComplete = true;
      this.callbacks.onComplete?.(event.data.content || this.buffer);
    });

    this.client.on('error', (event: OpenClawErrorEvent) => {
      this.callbacks.onError?.(event.data.message);
    });
  }

  /**
   * 스트림 시작
   */
  async start(message: string): Promise<void> {
    this.buffer = '';
    this.isComplete = false;
    this.callbacks.onStart?.();

    await this.client.sendMessage(message);
  }

  /**
   * 현재 버퍼 내용 조회
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * 완료 여부 확인
   */
  isFinished(): boolean {
    return this.isComplete;
  }

  /**
   * 취소
   */
  async cancel(): Promise<void> {
    await this.client.cancel();
    this.isComplete = true;
  }
}

// ============================================
// Progress Tracker
// ============================================

export interface TaskProgress {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep?: string;
  steps: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: any;
    error?: string;
  }>;
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

/**
 * 태스크 진행 상황 추적기
 */
export class TaskProgressTracker {
  private tasks: Map<string, TaskProgress> = new Map();
  private listeners: Map<string, Set<(progress: TaskProgress) => void>> = new Map();

  /**
   * 태스크 시작
   */
  startTask(taskId: string, steps: string[]): TaskProgress {
    const progress: TaskProgress = {
      taskId,
      status: 'running',
      progress: 0,
      steps: steps.map(name => ({ name, status: 'pending' })),
      startTime: new Date(),
    };

    this.tasks.set(taskId, progress);
    this.notifyListeners(taskId, progress);

    return progress;
  }

  /**
   * 단계 시작
   */
  startStep(taskId: string, stepName: string): void {
    const progress = this.tasks.get(taskId);
    if (!progress) return;

    const step = progress.steps.find(s => s.name === stepName);
    if (step) {
      step.status = 'running';
      progress.currentStep = stepName;
    }

    this.updateProgress(taskId);
    this.notifyListeners(taskId, progress);
  }

  /**
   * 단계 완료
   */
  completeStep(taskId: string, stepName: string, result?: any): void {
    const progress = this.tasks.get(taskId);
    if (!progress) return;

    const step = progress.steps.find(s => s.name === stepName);
    if (step) {
      step.status = 'completed';
      step.result = result;
    }

    this.updateProgress(taskId);
    this.notifyListeners(taskId, progress);
  }

  /**
   * 단계 실패
   */
  failStep(taskId: string, stepName: string, error: string): void {
    const progress = this.tasks.get(taskId);
    if (!progress) return;

    const step = progress.steps.find(s => s.name === stepName);
    if (step) {
      step.status = 'failed';
      step.error = error;
    }

    this.updateProgress(taskId);
    this.notifyListeners(taskId, progress);
  }

  /**
   * 태스크 완료
   */
  completeTask(taskId: string): void {
    const progress = this.tasks.get(taskId);
    if (!progress) return;

    progress.status = 'completed';
    progress.progress = 100;
    progress.endTime = new Date();
    progress.currentStep = undefined;

    this.notifyListeners(taskId, progress);
  }

  /**
   * 태스크 실패
   */
  failTask(taskId: string, error: string): void {
    const progress = this.tasks.get(taskId);
    if (!progress) return;

    progress.status = 'failed';
    progress.error = error;
    progress.endTime = new Date();
    progress.currentStep = undefined;

    this.notifyListeners(taskId, progress);
  }

  /**
   * 진행률 계산
   */
  private updateProgress(taskId: string): void {
    const progress = this.tasks.get(taskId);
    if (!progress) return;

    const completed = progress.steps.filter(s => s.status === 'completed').length;
    progress.progress = Math.round((completed / progress.steps.length) * 100);
  }

  /**
   * 리스너에게 알림
   */
  private notifyListeners(taskId: string, progress: TaskProgress): void {
    const listeners = this.listeners.get(taskId);
    if (listeners) {
      listeners.forEach(listener => listener(progress));
    }

    // 전역 리스너 ('*')
    const globalListeners = this.listeners.get('*');
    if (globalListeners) {
      globalListeners.forEach(listener => listener(progress));
    }
  }

  /**
   * 진행 상황 조회
   */
  getProgress(taskId: string): TaskProgress | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 리스너 등록
   */
  subscribe(taskId: string, listener: (progress: TaskProgress) => void): () => void {
    if (!this.listeners.has(taskId)) {
      this.listeners.set(taskId, new Set());
    }
    this.listeners.get(taskId)!.add(listener);

    // 구독 해제 함수 반환
    return () => {
      this.listeners.get(taskId)?.delete(listener);
    };
  }

  /**
   * 모든 태스크 진행 상황 조회
   */
  getAllProgress(): TaskProgress[] {
    return Array.from(this.tasks.values());
  }
}
