/**
 * useJarvis - 완전한 대화형 Claude Code + PC 제어 훅
 *
 * 기능:
 * 1. PTY 기반 실시간 대화형 Claude Code
 * 2. 도구 실행 전 권한 승인 UI
 * 3. GlowUS 앱 제어
 * 4. PC 제어
 */

import { useState, useEffect, useRef, useCallback } from 'react'

const WS_URL = process.env.NEXT_PUBLIC_JARVIS_WS || 'ws://localhost:3098'

export interface PermissionRequest {
  requestId: string
  tool: string
  action: string
  fullText: string
  timestamp: Date
}

export interface JarvisOptions {
  autoConnect?: boolean
  cwd?: string
  cols?: number
  rows?: number
  onOutput?: (data: string) => void
  onPermissionRequest?: (request: PermissionRequest) => void
  onExit?: (code: number, signal?: string) => void
}

export function useJarvis(options: JarvisOptions = {}) {
  const {
    autoConnect = false,
    cwd,
    cols = 120,
    rows = 30,
    onOutput,
    onPermissionRequest,
    onExit,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [currentCwd, setCurrentCwd] = useState(cwd || '')
  const [error, setError] = useState<string | null>(null)
  const [pendingPermissions, setPendingPermissions] = useState<PermissionRequest[]>([])

  const wsRef = useRef<WebSocket | null>(null)
  const outputBufferRef = useRef('')

  // 콜백 refs (클로저 문제 해결) - 함수 자체가 아닌 최신 함수를 호출하는 래퍼 저장
  const onOutputRef = useRef<((data: string) => void) | undefined>(onOutput)
  const onPermissionRequestRef = useRef(onPermissionRequest)
  const onExitRef = useRef(onExit)

  // 콜백 업데이트 - 매 렌더링마다 최신 함수로 업데이트
  onOutputRef.current = onOutput
  onPermissionRequestRef.current = onPermissionRequest
  onExitRef.current = onExit

  // WebSocket 연결
  const connect = useCallback(() => {
    // 이미 연결되었거나 연결 중이면 스킵
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('[Jarvis] Already connected or connecting, skipping')
      return
    }

    // 이전 연결이 있으면 정리
    if (wsRef.current) {
      console.log('[Jarvis] Cleaning up previous connection')
      wsRef.current.onclose = null // onclose 핸들러 제거하여 상태 변경 방지
      wsRef.current.close()
      wsRef.current = null
    }

    console.log('[Jarvis] Connecting to', WS_URL)
    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      console.log('[Jarvis] Connected')
      setIsConnected(true)
      setError(null)
    }

    ws.onclose = () => {
      console.log('[Jarvis] Disconnected')
      setIsConnected(false)
      setIsRunning(false)
    }

    ws.onerror = (e) => {
      console.error('[Jarvis] Error:', e)
      setError('Jarvis 서버에 연결할 수 없습니다.')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('[Jarvis] WebSocket message received:', data.type)

        switch (data.type) {
          case 'started':
            console.log('[Jarvis] Session started, PID:', data.pid)
            setIsRunning(true)
            if (data.cwd) setCurrentCwd(data.cwd)
            break

          case 'output':
            // 터미널 출력 - 디버그 로그 추가
            console.log('[Jarvis] Output received, length:', data.data?.length)
            outputBufferRef.current += data.data
            if (onOutputRef.current) {
              console.log('[Jarvis] Calling onOutput callback')
              onOutputRef.current(data.data)
            } else {
              console.warn('[Jarvis] onOutputRef.current is null/undefined!')
            }
            break

          case 'permission-request':
            // 권한 승인 요청
            const request: PermissionRequest = {
              requestId: data.requestId,
              tool: data.tool,
              action: data.action,
              fullText: data.fullText,
              timestamp: new Date(),
            }
            setPendingPermissions((prev) => [...prev, request])
            onPermissionRequestRef.current?.(request)
            break

          case 'exit':
            setIsRunning(false)
            onExitRef.current?.(data.exitCode, data.signal)
            break

          case 'closed':
            setIsConnected(false)
            setIsRunning(false)
            break

          case 'pc-command-result':
            console.log('[Jarvis] PC command result:', data)
            break

          case 'glowus-action':
            console.log('[Jarvis] GlowUS action:', data.action, data.path)
            break
        }
      } catch (e) {
        console.error('[Jarvis] Parse error:', e)
      }
    }

    wsRef.current = ws
  }, [])

  // Claude 세션 시작
  const startSession = useCallback((sessionCwd?: string, sessionId?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connect()
      setTimeout(() => startSession(sessionCwd, sessionId), 500)
      return
    }

    const targetCwd = sessionCwd || currentCwd || process.env.HOME || '~'
    console.log('[Jarvis] Starting session in:', targetCwd)

    wsRef.current.send(JSON.stringify({
      type: 'start',
      cwd: targetCwd,
      sessionId,
      cols,
      rows,
    }))

    setCurrentCwd(targetCwd)
    outputBufferRef.current = ''
  }, [connect, currentCwd, cols, rows])

  // 입력 전송
  const sendInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data }))
    }
  }, [])

  // Enter 키로 메시지 전송
  const sendMessage = useCallback((message: string) => {
    sendInput(message + '\r')
  }, [sendInput])

  // 권한 승인
  const approvePermission = useCallback((requestId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'permission-response',
        requestId,
        approved: true,
      }))
    }
    setPendingPermissions((prev) => prev.filter((p) => p.requestId !== requestId))
  }, [])

  // 권한 거부
  const denyPermission = useCallback((requestId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'permission-response',
        requestId,
        approved: false,
      }))
    }
    setPendingPermissions((prev) => prev.filter((p) => p.requestId !== requestId))
  }, [])

  // 모든 권한 승인
  const approveAllPermissions = useCallback(() => {
    pendingPermissions.forEach((p) => approvePermission(p.requestId))
  }, [pendingPermissions, approvePermission])

  // 중지 (Ctrl+C)
  const stop = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }))
    }
  }, [])

  // 세션 종료
  const closeSession = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'close' }))
    }
  }, [])

  // 리사이즈
  const resize = useCallback((newCols: number, newRows: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'resize', cols: newCols, rows: newRows }))
    }
  }, [])

  // PC 명령 실행
  const executePCCommand = useCallback((command: string, args?: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'pc-command',
        command,
        args,
      }))
    }
  }, [])

  // 연결 해제
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  // 자동 연결
  useEffect(() => {
    if (autoConnect) {
      connect()
    }
    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  return {
    // 상태
    isConnected,
    isRunning,
    currentCwd,
    error,
    pendingPermissions,

    // Claude 세션
    connect,
    disconnect,
    startSession,
    sendInput,
    sendMessage,
    stop,
    closeSession,
    resize,

    // 권한 관리
    approvePermission,
    denyPermission,
    approveAllPermissions,

    // PC 제어
    executePCCommand,
  }
}
