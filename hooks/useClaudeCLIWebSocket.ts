/**
 * Claude CLI WebSocket Hook
 * 인터랙티브 Claude CLI 세션 관리
 */

import { useState, useEffect, useRef, useCallback } from 'react'

const WS_URL = process.env.NEXT_PUBLIC_CLAUDE_CLI_WS || 'ws://localhost:3099'

export interface CLIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  toolEvents?: StreamEvent[]
}

export interface StreamEvent {
  type: 'thinking' | 'tool' | 'tool_result' | 'status' | 'text'
  content?: string
  name?: string
  input?: any
  id?: string
  toolUseId?: string
  isError?: boolean
}

interface UseClaudeCLIOptions {
  autoConnect?: boolean
  cwd?: string
  onMessage?: (msg: CLIMessage) => void
  onError?: (error: string) => void
  onReady?: () => void
}

export function useClaudeCLIWebSocket(options: UseClaudeCLIOptions = {}) {
  const { autoConnect = false, cwd, onMessage, onError, onReady } = options

  const [isConnected, setIsConnected] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentCwd, setCurrentCwd] = useState(cwd || '')
  const [messages, setMessages] = useState<CLIMessage[]>([])
  const [streamContent, setStreamContent] = useState('')
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const eventsRef = useRef<StreamEvent[]>([])
  const contentRef = useRef('')

  // WebSocket 연결
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    console.log('[Claude CLI WS] Connecting to', WS_URL)
    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      console.log('[Claude CLI WS] Connected')
      setIsConnected(true)
      setError(null)
    }

    ws.onclose = () => {
      console.log('[Claude CLI WS] Disconnected')
      setIsConnected(false)
      setIsReady(false)
      setSessionId(null)
    }

    ws.onerror = (e) => {
      console.error('[Claude CLI WS] Error:', e)
      setError('WebSocket 연결 실패. 서버가 실행 중인지 확인하세요.')
      onError?.('WebSocket 연결 실패')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleMessage(data)
      } catch (e) {
        console.error('[Claude CLI WS] Parse error:', e)
      }
    }

    wsRef.current = ws
  }, [onError])

  // 메시지 처리
  const handleMessage = useCallback((data: any) => {
    console.log('[Claude CLI WS] Received:', data.type)

    switch (data.type) {
      case 'started':
        console.log('[Claude CLI WS] Session started, PID:', data.pid)
        if (data.cwd) setCurrentCwd(data.cwd)
        if (data.sessionId) setSessionId(data.sessionId)
        // started 이벤트도 세션 준비 완료로 처리
        setIsReady(true)
        setIsLoading(false)
        break

      case 'system':
        setSessionId(data.sessionId)
        setIsReady(true)
        onReady?.()
        break

      case 'ready':
        setIsLoading(false)
        setIsReady(true)
        // 스트리밍 완료 - 메시지 저장
        if (contentRef.current || eventsRef.current.length > 0) {
          const assistantMsg: CLIMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: contentRef.current || '(완료)',
            timestamp: new Date(),
            toolEvents: eventsRef.current.filter(e => e.type === 'tool' || e.type === 'tool_result')
          }
          setMessages(prev => [...prev, assistantMsg])
          onMessage?.(assistantMsg)

          // 초기화
          contentRef.current = ''
          eventsRef.current = []
          setStreamContent('')
          setStreamEvents([])
        }
        onReady?.()
        break

      case 'text':
        contentRef.current = data.content
        setStreamContent(data.content)
        break

      case 'thinking':
        eventsRef.current.push({ type: 'thinking', content: data.content })
        setStreamEvents([...eventsRef.current])
        break

      case 'tool':
        eventsRef.current.push({
          type: 'tool',
          name: data.name,
          input: data.input,
          id: data.id
        })
        setStreamEvents([...eventsRef.current])
        break

      case 'tool_result':
        eventsRef.current.push({
          type: 'tool_result',
          content: data.content,
          toolUseId: data.toolUseId,
          isError: data.isError
        })
        setStreamEvents([...eventsRef.current])
        break

      case 'result':
        if (data.content) {
          contentRef.current = data.content
          setStreamContent(data.content)
        }
        if (data.sessionId) {
          setSessionId(data.sessionId)
        }
        break

      case 'error':
        setError(data.content)
        setIsLoading(false)
        onError?.(data.content)
        break

      case 'stopped':
        setIsLoading(false)
        break

      case 'closed':
        setIsConnected(false)
        setIsReady(false)
        setSessionId(null)
        break
    }
  }, [onMessage, onError, onReady])

  // 세션 시작
  const startSession = useCallback((sessionCwd?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connect()
      // 연결 후 재시도
      setTimeout(() => startSession(sessionCwd), 500)
      return
    }

    const targetCwd = sessionCwd || currentCwd || process.env.HOME || '~'
    console.log('[Claude CLI WS] Starting session in:', targetCwd)

    wsRef.current.send(JSON.stringify({
      type: 'start',
      cwd: targetCwd,
      permissionMode: 'acceptEdits'
    }))

    setCurrentCwd(targetCwd)
    setIsLoading(true)
  }, [connect, currentCwd])

  // 메시지 전송
  // displayContent: UI에 표시할 메시지 (선택적)
  // content: 실제 Claude에 전송할 메시지 (컨텍스트 포함 가능)
  const sendMessage = useCallback((content: string, displayContent?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('연결되지 않음')
      return
    }

    if (!isReady) {
      setError('세션이 준비되지 않음')
      return
    }

    // 사용자 메시지 추가 (UI에는 displayContent 표시, 없으면 content)
    const userMsg: CLIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: displayContent || content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMsg])

    // 스트리밍 상태 초기화
    contentRef.current = ''
    eventsRef.current = []
    setStreamContent('')
    setStreamEvents([])
    setIsLoading(true)
    setIsReady(false)

    // 실제 전송은 전체 content (컨텍스트 포함)
    wsRef.current.send(JSON.stringify({
      type: 'message',
      content
    }))
  }, [isReady])

  // 작업 중단
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

  // 연결 해제
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  // 대화 초기화
  const clearMessages = useCallback(() => {
    setMessages([])
    contentRef.current = ''
    eventsRef.current = []
    setStreamContent('')
    setStreamEvents([])
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

  // cwd 변경 감지 - 유효한 경로일 때만 세션 재시작
  const lastCwdRef = useRef<string | null>(null)
  useEffect(() => {
    // 유효한 경로인지 확인 (절대 경로여야 함)
    const isValidPath = cwd && cwd.startsWith('/') && !cwd.includes('@')

    if (isValidPath && cwd !== lastCwdRef.current && isConnected) {
      lastCwdRef.current = cwd
      setCurrentCwd(cwd)
      // 세션 재시작
      startSession(cwd)
    }
  }, [cwd, isConnected, startSession])

  return {
    // 상태
    isConnected,
    isReady,
    isLoading,
    sessionId,
    currentCwd,
    messages,
    streamContent,
    streamEvents,
    error,

    // 액션
    connect,
    disconnect,
    startSession,
    sendMessage,
    stop,
    closeSession,
    clearMessages,
    setCurrentCwd
  }
}
