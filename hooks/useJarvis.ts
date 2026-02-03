/**
 * useJarvis - Claude Code CLI WebSocket 연결 (PTY 대화형 모드)
 *
 * 사이드바용: shared=true (기본값) - 싱글톤 WebSocket 공유
 * ChatView용: shared=false - 독립 WebSocket, 별도 PTY 세션
 */

import { useState, useRef, useCallback, useEffect } from 'react'

const WS_URL = process.env.NEXT_PUBLIC_JARVIS_WS || 'ws://localhost:3098'

export interface PermissionRequest {
  requestId: string
  tool: string
  action: string
  fullText: string
  timestamp: Date
}

export interface JarvisPersona {
  name?: string
  userTitle?: string
  personality?: string
  language?: string
  greeting?: string
  customInstructions?: string
}

// 워크플로우 제어 명령 타입
export interface WorkflowControlCommand {
  action: 'add_node' | 'remove_node' | 'update_node' | 'connect' | 'disconnect' | 'clear' | 'execute' | 'get_state'
  nodeType?: string
  nodeId?: string
  position?: { x: number; y: number }
  data?: Record<string, unknown>
  sourceId?: string
  targetId?: string
  sourceHandle?: string
  targetHandle?: string
}

interface UseJarvisOptions {
  shared?: boolean  // true: 사이드바용 싱글톤, false: ChatView용 독립 연결
  cwd?: string
  onOutput?: (data: string) => void
  onReady?: () => void
  onDone?: (exitCode: number) => void
  onExit?: (code: number, signal?: string) => void
  onNavigate?: (route: string) => void
  onControl?: (action: string, data?: unknown) => void
  onWorkflowControl?: (command: WorkflowControlCommand) => void
}

// 사이드바용 싱글톤 WebSocket
let sharedWs: WebSocket | null = null
let sharedWsConnecting = false
const sharedHandlers = new Set<(msg: Record<string, unknown>) => void>()

function getSharedWebSocket(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    if (sharedWs && sharedWs.readyState === WebSocket.OPEN) {
      resolve(sharedWs)
      return
    }

    if (sharedWsConnecting) {
      const check = setInterval(() => {
        if (sharedWs?.readyState === WebSocket.OPEN) {
          clearInterval(check)
          resolve(sharedWs)
        } else if (!sharedWs || sharedWs.readyState === WebSocket.CLOSED) {
          clearInterval(check)
          reject(new Error('Connection failed'))
        }
      }, 100)
      setTimeout(() => { clearInterval(check); reject(new Error('Timeout')) }, 10000)
      return
    }

    console.log('[Jarvis:Shared] Connecting...')
    sharedWsConnecting = true
    const ws = new WebSocket(WS_URL)
    sharedWs = ws

    ws.onopen = () => {
      console.log('[Jarvis:Shared] Connected')
      sharedWsConnecting = false
      resolve(ws)
    }
    ws.onerror = () => {
      sharedWsConnecting = false
      sharedWs = null
      reject(new Error('Connection error'))
    }
    ws.onclose = () => {
      sharedWsConnecting = false
      sharedWs = null
    }
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        sharedHandlers.forEach(h => h(msg))
      } catch {}
    }
  })
}

export function useJarvis(options: UseJarvisOptions = {}) {
  const { shared = true, cwd, onOutput, onReady, onDone, onExit, onNavigate, onControl, onWorkflowControl } = options

  const [isConnected, setIsConnected] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [currentCwd, setCurrentCwd] = useState(cwd || '')
  const [error, setError] = useState<string | null>(null)
  const [pendingPermissions] = useState<PermissionRequest[]>([])
  const [isBrowserRegistered, setIsBrowserRegistered] = useState(false)

  // 독립 모드용 WebSocket ref
  const independentWsRef = useRef<WebSocket | null>(null)

  const onOutputRef = useRef(onOutput)
  const onReadyRef = useRef(onReady)
  const onDoneRef = useRef(onDone)
  const onExitRef = useRef(onExit)
  const onNavigateRef = useRef(onNavigate)
  const onControlRef = useRef(onControl)
  const onWorkflowControlRef = useRef(onWorkflowControl)

  useEffect(() => {
    onOutputRef.current = onOutput
    onReadyRef.current = onReady
    onDoneRef.current = onDone
    onExitRef.current = onExit
    onNavigateRef.current = onNavigate
    onControlRef.current = onControl
    onWorkflowControlRef.current = onWorkflowControl
  }, [onOutput, onReady, onDone, onExit, onNavigate, onControl, onWorkflowControl])

  // 메시지 처리 함수
  const handleMessage = useCallback((msg: Record<string, unknown>) => {
    const msgType = msg.type as string

    switch (msgType) {
      case 'started':
        console.log('[Jarvis] Session started')
        setIsRunning(true)
        if (msg.cwd) setCurrentCwd(msg.cwd as string)
        break
      case 'ready':
        console.log('[Jarvis] Ready')
        onReadyRef.current?.()
        break
      case 'output':
        onOutputRef.current?.(msg.data as string)
        break
      case 'done':
        console.log('[Jarvis] Done')
        onDoneRef.current?.(msg.exitCode as number)
        break
      case 'exit':
        setIsRunning(false)
        onExitRef.current?.(msg.exitCode as number, msg.signal as string)
        break
      case 'stopped':
        setIsRunning(false)
        break
      case 'error':
        setError(msg.error as string)
        break
      case 'closed':
        setIsRunning(false)
        break
      case 'registered':
        setIsBrowserRegistered(true)
        break
      case 'control':
        if (msg.action === 'navigate' && msg.route) {
          onNavigateRef.current?.(msg.route as string)
        }
        onControlRef.current?.(msg.action as string, msg.data || msg.route)
        break
      case 'workflow_control':
        // 워크플로우 빌더 제어 명령
        console.log('[Jarvis] Workflow control:', msg)
        onWorkflowControlRef.current?.(msg as unknown as WorkflowControlCommand)
        break
    }
  }, [])

  // 공유 모드: 핸들러 등록
  useEffect(() => {
    if (!shared) return

    sharedHandlers.add(handleMessage)
    if (sharedWs?.readyState === WebSocket.OPEN) {
      setIsConnected(true)
    }

    return () => {
      sharedHandlers.delete(handleMessage)
    }
  }, [shared, handleMessage])

  // 독립 모드: 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (!shared && independentWsRef.current) {
        independentWsRef.current.close()
        independentWsRef.current = null
      }
    }
  }, [shared])

  // 현재 사용할 WebSocket 가져오기
  const getWs = useCallback((): WebSocket | null => {
    return shared ? sharedWs : independentWsRef.current
  }, [shared])

  // 연결
  const connect = useCallback(async (): Promise<boolean> => {
    try {
      setError(null)

      if (shared) {
        await getSharedWebSocket()
        setIsConnected(true)
        return true
      } else {
        // 독립 모드: 새 WebSocket 생성
        if (independentWsRef.current?.readyState === WebSocket.OPEN) {
          return true
        }

        console.log('[Jarvis:Independent] Connecting...')
        const ws = new WebSocket(WS_URL)
        independentWsRef.current = ws

        return new Promise((resolve) => {
          ws.onopen = () => {
            console.log('[Jarvis:Independent] Connected')
            setIsConnected(true)
            resolve(true)
          }
          ws.onerror = () => {
            setError('연결 실패')
            setIsConnected(false)
            resolve(false)
          }
          ws.onclose = () => {
            setIsConnected(false)
            setIsRunning(false)
          }
          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data)
              handleMessage(msg)
            } catch {}
          }
          setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
              setError('연결 타임아웃')
              resolve(false)
            }
          }, 10000)
        })
      }
    } catch (e) {
      setError('연결 실패')
      setIsConnected(false)
      return false
    }
  }, [shared, handleMessage])

  // 세션 시작
  const startSession = useCallback(async (
    sessionCwd?: string,
    userName?: string,
    persona?: JarvisPersona,
    cols?: number,
    rows?: number
  ): Promise<boolean> => {
    try {
      setError(null)

      // 먼저 연결
      const connected = await connect()
      if (!connected) return false

      const ws = getWs()
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        setError('WebSocket not ready')
        return false
      }

      const targetCwd = sessionCwd || cwd || '~'
      console.log('[Jarvis] Starting session:', { cwd: targetCwd, shared })

      ws.send(JSON.stringify({
        type: 'start',
        cwd: targetCwd,
        userName,
        persona,
        cols: cols || 80,
        rows: rows || 24,
      }))

      setCurrentCwd(targetCwd)
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }, [connect, getWs, cwd, shared])

  // 입력 전송
  const sendInput = useCallback((data: string): boolean => {
    const ws = getWs()
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify({ type: 'input', data }))
    return true
  }, [getWs])

  // 메시지 전송
  const sendMessage = useCallback((message: string): boolean => {
    const ws = getWs()
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    console.log('[Jarvis] Sending:', message.substring(0, 50))
    ws.send(JSON.stringify({ type: 'input', data: message + '\r' }))
    return true
  }, [getWs])

  // 중지
  const stop = useCallback(() => {
    const ws = getWs()
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'stop' }))
    }
    setIsRunning(false)
  }, [getWs])

  // 세션 종료
  const closeSession = useCallback(() => {
    const ws = getWs()
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'close' }))
    }
    setIsRunning(false)
  }, [getWs])

  // 리사이즈
  const resize = useCallback((cols: number, rows: number) => {
    const ws = getWs()
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }))
    }
  }, [getWs])

  // 연결 해제
  const disconnect = useCallback(() => {
    if (shared) {
      // 공유 모드에서는 닫지 않음 (다른 컴포넌트가 사용 중일 수 있음)
    } else {
      independentWsRef.current?.close()
      independentWsRef.current = null
    }
    setIsConnected(false)
    setIsRunning(false)
  }, [shared])

  // 브라우저 등록
  const registerAsBrowser = useCallback(() => {
    const ws = getWs()
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'register_browser' }))
    }
  }, [getWs])

  // 권한 관련 (미구현)
  const approvePermission = useCallback(() => {}, [])
  const denyPermission = useCallback(() => {}, [])
  const approveAllPermissions = useCallback(() => {}, [])

  return {
    isConnected,
    isRunning,
    isReady: isConnected,
    currentCwd,
    error,
    pendingPermissions,
    isBrowserRegistered,
    connect,
    disconnect,
    startSession,
    sendInput,
    sendMessage,
    stop,
    closeSession,
    resize,
    registerAsBrowser,
    approvePermission,
    denyPermission,
    approveAllPermissions,
  }
}
