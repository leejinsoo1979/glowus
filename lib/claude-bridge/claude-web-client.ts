/**
 * Claude Code CLI Web Client
 *
 * 웹 브라우저에서 로컬 Claude Bridge 서버를 통해 Claude Code CLI를 사용하기 위한 클라이언트
 *
 * @example
 * ```typescript
 * import { ClaudeWebClient } from '@/lib/claude-bridge/claude-web-client'
 *
 * const claude = new ClaudeWebClient('http://localhost:3333')
 *
 * // 일반 질문
 * const response = await claude.ask('React의 useEffect 훅에 대해 설명해줘')
 *
 * // 코드와 함께 질문
 * const response = await claude.askWithCode(
 *   '이 코드를 리팩토링해줘',
 *   code,
 *   'typescript'
 * )
 *
 * // 스트리밍 응답
 * await claude.stream('긴 코드를 작성해줘', (chunk) => {
 *   console.log(chunk.delta)
 * })
 * ```
 */

export interface ClaudeBridgeOptions {
  model?: string
  maxTokens?: number
  allowedTools?: string[]
  disallowedTools?: string[]
}

export interface StreamChunk {
  type: 'text' | 'tool_use' | 'tool_result' | 'error' | 'done' | 'result'
  content?: string
  delta?: string
  tool?: string
  input?: any
  result?: any
  message?: string
  code?: number
  cost?: number
  sessionId?: string
  messageCount?: number
}

export interface HealthCheckResponse {
  status: string
  timestamp: string
  platform: string
  cwd: string
  claudeCodeVersion: string
}

export interface CLICheckResponse {
  available: boolean
  version?: string
  error?: string
}

export class ClaudeWebClient {
  private bridgeUrl: string
  private defaultOptions: ClaudeBridgeOptions
  private abortController: AbortController | null = null

  constructor(
    bridgeUrl: string = 'http://localhost:3333',
    defaultOptions: ClaudeBridgeOptions = {}
  ) {
    this.bridgeUrl = bridgeUrl.replace(/\/$/, '') // 끝의 슬래시 제거
    this.defaultOptions = defaultOptions
  }

  /**
   * 브릿지 서버 연결 확인
   */
  async checkConnection(): Promise<HealthCheckResponse | null> {
    try {
      const response = await fetch(`${this.bridgeUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        return null
      }

      return await response.json()
    } catch (error) {
      console.error('[ClaudeWebClient] Connection check failed:', error)
      return null
    }
  }

  /**
   * Claude Code CLI 설치 확인 (버전 엔드포인트 사용)
   */
  async checkCLI(): Promise<CLICheckResponse> {
    try {
      const response = await fetch(`${this.bridgeUrl}/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })

      const data = await response.json()
      return {
        available: data.code === 0,
        version: data.version,
        error: data.code !== 0 ? 'CLI not found' : undefined
      }
    } catch (error) {
      return { available: false, error: 'Bridge server not reachable' }
    }
  }

  /**
   * Claude Code 버전 확인
   */
  async getVersion(): Promise<{ version: string; code: number } | null> {
    try {
      const response = await fetch(`${this.bridgeUrl}/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })
      return await response.json()
    } catch {
      return null
    }
  }

  /**
   * Claude에게 질문 (전체 응답 대기)
   */
  async ask(
    prompt: string,
    options: ClaudeBridgeOptions & { cwd?: string } = {}
  ): Promise<string> {
    let fullContent = ''

    await this.stream(prompt, (chunk) => {
      if (chunk.type === 'text' && chunk.content) {
        fullContent = chunk.content
      } else if (chunk.type === 'done' && chunk.content) {
        fullContent = chunk.content
      } else if (chunk.type === 'result' && chunk.content) {
        fullContent = chunk.content
      }
    }, options)

    return fullContent
  }

  /**
   * 코드와 함께 Claude에게 질문
   */
  async askWithCode(
    prompt: string,
    code: string,
    language: string = 'text',
    options: ClaudeBridgeOptions & { cwd?: string; filename?: string } = {}
  ): Promise<string> {
    let fullContent = ''

    await this.streamWithCode(prompt, code, language, (chunk) => {
      if (chunk.type === 'text' && chunk.content) {
        fullContent = chunk.content
      } else if (chunk.type === 'done' && chunk.content) {
        fullContent = chunk.content
      }
    }, options)

    return fullContent
  }

  /**
   * 동기 요청 (스트리밍 없이 전체 응답)
   */
  async askSync(
    prompt: string,
    options: { code?: string; language?: string; cwd?: string; model?: string } = {}
  ): Promise<{ result?: string; error?: string; code?: number }> {
    try {
      const response = await fetch(`${this.bridgeUrl}/claude/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          code: options.code,
          language: options.language,
          cwd: options.cwd,
          model: options.model || this.defaultOptions.model,
        }),
      })

      return await response.json()
    } catch (error: any) {
      return { error: error.message }
    }
  }

  /**
   * 스트리밍 응답 처리
   */
  async stream(
    prompt: string,
    onChunk: (chunk: StreamChunk) => void,
    options: ClaudeBridgeOptions & { cwd?: string } = {}
  ): Promise<void> {
    this.abortController = new AbortController()

    const mergedOptions = { ...this.defaultOptions, ...options }
    const { cwd, ...claudeOptions } = mergedOptions

    try {
      const response = await fetch(`${this.bridgeUrl}/claude`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          cwd,
          options: claudeOptions,
        }),
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Request failed')
      }

      await this.processSSEStream(response, onChunk)
    } catch (error: any) {
      if (error.name === 'AbortError') {
        onChunk({ type: 'done', content: 'Request cancelled' })
      } else {
        onChunk({ type: 'error', message: error.message })
        throw error
      }
    } finally {
      this.abortController = null
    }
  }

  /**
   * 코드와 함께 스트리밍 요청
   */
  async streamWithCode(
    prompt: string,
    code: string,
    language: string,
    onChunk: (chunk: StreamChunk) => void,
    options: ClaudeBridgeOptions & { cwd?: string; filename?: string } = {}
  ): Promise<void> {
    this.abortController = new AbortController()

    const mergedOptions = { ...this.defaultOptions, ...options }
    const { cwd, filename, ...claudeOptions } = mergedOptions

    try {
      const response = await fetch(`${this.bridgeUrl}/claude/code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          code,
          language,
          filename,
          cwd,
          model: claudeOptions.model,
        }),
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Request failed')
      }

      await this.processSSEStream(response, onChunk)
    } catch (error: any) {
      if (error.name === 'AbortError') {
        onChunk({ type: 'done', content: 'Request cancelled' })
      } else {
        onChunk({ type: 'error', message: error.message })
        throw error
      }
    } finally {
      this.abortController = null
    }
  }

  /**
   * 파일 편집 요청
   */
  async editFile(
    filepath: string,
    instruction: string,
    onChunk: (chunk: StreamChunk) => void,
    options: ClaudeBridgeOptions & { cwd?: string } = {}
  ): Promise<void> {
    this.abortController = new AbortController()

    const { cwd, ...claudeOptions } = options

    try {
      const response = await fetch(`${this.bridgeUrl}/claude/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: instruction,
          filepath,
          cwd,
          options: claudeOptions,
        }),
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Request failed')
      }

      await this.processSSEStream(response, onChunk)
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        onChunk({ type: 'error', message: error.message })
        throw error
      }
    } finally {
      this.abortController = null
    }
  }

  /**
   * 대화 세션 시작/계속
   */
  async conversation(
    sessionId: string,
    prompt: string,
    onChunk: (chunk: StreamChunk) => void,
    options: ClaudeBridgeOptions & { cwd?: string } = {}
  ): Promise<void> {
    this.abortController = new AbortController()

    const { cwd, ...claudeOptions } = options

    try {
      const response = await fetch(`${this.bridgeUrl}/claude/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          prompt,
          cwd,
          options: claudeOptions,
        }),
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Request failed')
      }

      await this.processSSEStream(response, onChunk)
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        onChunk({ type: 'error', message: error.message })
        throw error
      }
    } finally {
      this.abortController = null
    }
  }

  /**
   * 세션 삭제
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.bridgeUrl}/claude/conversation/${sessionId}`, {
        method: 'DELETE',
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * 세션 목록 조회
   */
  async getSessions(): Promise<Array<{ id: string; messageCount: number; createdAt: string }>> {
    try {
      const response = await fetch(`${this.bridgeUrl}/claude/sessions`)
      if (!response.ok) return []
      return await response.json()
    } catch {
      return []
    }
  }

  /**
   * 현재 요청 취소
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
  }

  /**
   * SSE 스트림 처리
   */
  private async processSSEStream(
    response: Response,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Response body is not readable')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })

        // SSE 이벤트 파싱
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 마지막 불완전한 라인은 버퍼에 보관

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              onChunk(data)
            } catch {
              // JSON 파싱 실패 시 무시
            }
          }
        }
      }

      // 남은 버퍼 처리
      if (buffer.startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.slice(6))
          onChunk(data)
        } catch {
          // 무시
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * 브릿지 URL 변경
   */
  setBridgeUrl(url: string): void {
    this.bridgeUrl = url.replace(/\/$/, '')
  }

  /**
   * 기본 옵션 설정
   */
  setDefaultOptions(options: ClaudeBridgeOptions): void {
    this.defaultOptions = options
  }

  // ===== 프리셋 메서드 =====

  /**
   * 코드 설명 요청
   */
  async explain(
    code: string,
    language?: string,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<string> {
    const prompt = '이 코드를 자세히 설명해줘.'
    if (onChunk) {
      let result = ''
      await this.streamWithCode(prompt, code, language || 'plaintext', (chunk) => {
        if (chunk.type === 'text' && chunk.content) result = chunk.content
        onChunk(chunk)
      })
      return result
    }
    return this.askWithCode(prompt, code, language)
  }

  /**
   * 코드 리팩토링 요청
   */
  async refactor(
    code: string,
    language?: string,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<string> {
    const prompt = '이 코드를 더 깔끔하게 리팩토링해줘.'
    if (onChunk) {
      let result = ''
      await this.streamWithCode(prompt, code, language || 'plaintext', (chunk) => {
        if (chunk.type === 'text' && chunk.content) result = chunk.content
        onChunk(chunk)
      })
      return result
    }
    return this.askWithCode(prompt, code, language)
  }

  /**
   * 버그 찾기 요청
   */
  async findBugs(
    code: string,
    language?: string,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<string> {
    const prompt = '이 코드에서 버그나 개선점을 찾아줘.'
    if (onChunk) {
      let result = ''
      await this.streamWithCode(prompt, code, language || 'plaintext', (chunk) => {
        if (chunk.type === 'text' && chunk.content) result = chunk.content
        onChunk(chunk)
      })
      return result
    }
    return this.askWithCode(prompt, code, language)
  }

  /**
   * 주석 추가 요청
   */
  async addComments(
    code: string,
    language?: string,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<string> {
    const prompt = '이 코드에 주석을 추가해줘.'
    if (onChunk) {
      let result = ''
      await this.streamWithCode(prompt, code, language || 'plaintext', (chunk) => {
        if (chunk.type === 'text' && chunk.content) result = chunk.content
        onChunk(chunk)
      })
      return result
    }
    return this.askWithCode(prompt, code, language)
  }

  /**
   * 테스트 코드 작성 요청
   */
  async writeTests(
    code: string,
    language?: string,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<string> {
    const prompt = '이 코드의 테스트 코드를 작성해줘.'
    if (onChunk) {
      let result = ''
      await this.streamWithCode(prompt, code, language || 'plaintext', (chunk) => {
        if (chunk.type === 'text' && chunk.content) result = chunk.content
        onChunk(chunk)
      })
      return result
    }
    return this.askWithCode(prompt, code, language)
  }
}

// 싱글톤 인스턴스 (편의를 위해)
let defaultClient: ClaudeWebClient | null = null

export function getClaudeClient(bridgeUrl?: string): ClaudeWebClient {
  if (!defaultClient) {
    defaultClient = new ClaudeWebClient(bridgeUrl)
  } else if (bridgeUrl) {
    defaultClient.setBridgeUrl(bridgeUrl)
  }
  return defaultClient
}

// 헬퍼 함수들
export async function askClaude(
  prompt: string,
  options?: ClaudeBridgeOptions & { cwd?: string }
): Promise<string> {
  return getClaudeClient().ask(prompt, options)
}

export async function askClaudeWithCode(
  prompt: string,
  code: string,
  language?: string,
  options?: ClaudeBridgeOptions & { cwd?: string; filename?: string }
): Promise<string> {
  return getClaudeClient().askWithCode(prompt, code, language, options)
}

export async function streamClaude(
  prompt: string,
  onChunk: (chunk: StreamChunk) => void,
  options?: ClaudeBridgeOptions & { cwd?: string }
): Promise<void> {
  return getClaudeClient().stream(prompt, onChunk, options)
}

export async function checkClaudeConnection(): Promise<boolean> {
  const result = await getClaudeClient().checkConnection()
  return result !== null
}

export default ClaudeWebClient
