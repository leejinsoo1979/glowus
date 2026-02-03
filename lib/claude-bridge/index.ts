/**
 * Claude Code CLI Bridge
 *
 * 웹 브라우저에서 로컬 Claude Code CLI를 사용하기 위한 브릿지 시스템
 *
 * 구조:
 * 웹 브라우저 → localhost:3333 (브릿지 서버) → Claude Code CLI (Max 플랜)
 *
 * @example
 * ```typescript
 * // 1. 서버 시작 (터미널)
 * // node claude-bridge/bridge-server.js
 *
 * // 2. 웹 클라이언트 사용
 * import { ClaudeWebClient, askClaude } from '@/lib/claude-bridge'
 *
 * const response = await askClaude('React 훅에 대해 설명해줘')
 *
 * // 3. Monaco Editor 연동
 * import { initMonacoClaudePlugin, useClaudeBridgeStatus } from '@/lib/claude-bridge'
 *
 * // 연결 상태 확인
 * const { connected, version, checking } = useClaudeBridgeStatus()
 *
 * // 에디터 플러그인
 * initMonacoClaudePlugin(editor, {
 *   onResponse: (response, type) => showInPanel(response)
 * })
 * ```
 */

import { useState, useEffect, useCallback } from 'react'
import { checkClaudeConnection, getClaudeClient } from './claude-web-client'

// ===== React Hook for Connection Status =====

export interface ClaudeBridgeStatus {
  connected: boolean
  checking: boolean
  version: string | null
  error: string | null
  lastChecked: Date | null
  recheck: () => Promise<void>
}

/**
 * Claude Bridge 연결 상태를 확인하는 React Hook
 *
 * @param bridgeUrl - 브릿지 서버 URL (기본: http://localhost:3333)
 * @param autoCheck - 자동 연결 확인 여부 (기본: true)
 * @param checkInterval - 자동 재확인 간격 (ms, 0이면 비활성화, 기본: 0)
 *
 * @example
 * ```tsx
 * function StatusIndicator() {
 *   const { connected, checking, version, recheck } = useClaudeBridgeStatus()
 *
 *   if (checking) return <span>연결 확인 중...</span>
 *   if (!connected) return <button onClick={recheck}>연결 끊김 - 재연결</button>
 *   return <span>연결됨 (v{version})</span>
 * }
 * ```
 */
export function useClaudeBridgeStatus(
  bridgeUrl: string = 'http://localhost:3333',
  autoCheck: boolean = true,
  checkInterval: number = 0
): ClaudeBridgeStatus {
  const [connected, setConnected] = useState(false)
  const [checking, setChecking] = useState(true)
  const [version, setVersion] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const checkConnection = useCallback(async () => {
    setChecking(true)
    setError(null)

    try {
      const client = getClaudeClient(bridgeUrl)

      // 연결 확인
      const health = await client.checkConnection()

      if (health) {
        setConnected(true)
        // 버전 확인
        const versionInfo = await client.getVersion()
        if (versionInfo) {
          setVersion(versionInfo.version)
        }
      } else {
        setConnected(false)
        setVersion(null)
        setError('브릿지 서버에 연결할 수 없습니다')
      }
    } catch (err: any) {
      setConnected(false)
      setVersion(null)
      setError(err.message || '연결 확인 중 오류 발생')
    } finally {
      setChecking(false)
      setLastChecked(new Date())
    }
  }, [bridgeUrl])

  // 초기 연결 확인
  useEffect(() => {
    if (autoCheck) {
      checkConnection()
    }
  }, [autoCheck, checkConnection])

  // 주기적 재확인
  useEffect(() => {
    if (checkInterval > 0) {
      const interval = setInterval(checkConnection, checkInterval)
      return () => clearInterval(interval)
    }
  }, [checkInterval, checkConnection])

  return {
    connected,
    checking,
    version,
    error,
    lastChecked,
    recheck: checkConnection,
  }
}

// Web Client
export {
  ClaudeWebClient,
  getClaudeClient,
  askClaude,
  askClaudeWithCode,
  streamClaude,
  checkClaudeConnection,
  type ClaudeBridgeOptions,
  type StreamChunk,
  type HealthCheckResponse,
  type CLICheckResponse,
} from './claude-web-client'

// Monaco Plugin
export {
  MonacoClaudePlugin,
  initMonacoClaudePlugin,
  injectClaudeStyles,
  type MonacoClaudePluginOptions,
  type ClaudeActionType,
} from './monaco-claude-plugin'

// Re-export hook (already defined above)
// useClaudeBridgeStatus is exported directly

// Default export
export { ClaudeWebClient as default } from './claude-web-client'
