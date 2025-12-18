"use client"

import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useTheme } from 'next-themes'
import '@xterm/xterm/css/xterm.css'

interface XTermWrapperProps {
  onExecute?: (command: string) => Promise<string>
  tabId: string
}

const darkTheme = {
  background: '#000000',
  foreground: '#ffffff',
  cursor: '#ffffff',
  cursorAccent: '#000000',
  selectionBackground: '#444444',
  black: '#000000',
  red: '#ff5555',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  blue: '#6272a4',
  magenta: '#ff79c6',
  cyan: '#8be9fd',
  white: '#f8f8f2',
  brightBlack: '#6272a4',
  brightRed: '#ff6e6e',
  brightGreen: '#69ff94',
  brightYellow: '#ffffa5',
  brightBlue: '#d6acff',
  brightMagenta: '#ff92df',
  brightCyan: '#a4ffff',
  brightWhite: '#ffffff',
}

const lightTheme = {
  background: '#ffffff',
  foreground: '#1e1e1e',
  cursor: '#1e1e1e',
  cursorAccent: '#ffffff',
  selectionBackground: '#add6ff',
  black: '#1e1e1e',
  red: '#cd3131',
  green: '#14ce14',
  yellow: '#949800',
  blue: '#0451a5',
  magenta: '#bc05bc',
  cyan: '#0598bc',
  white: '#555555',
  brightBlack: '#666666',
  brightRed: '#cd3131',
  brightGreen: '#14ce14',
  brightYellow: '#b5ba00',
  brightBlue: '#0451a5',
  brightMagenta: '#bc05bc',
  brightCyan: '#0598bc',
  brightWhite: '#1e1e1e',
}

const MAX_TERMINAL_RECONNECT_ATTEMPTS = 3

// Production 환경 체크 함수 (런타임에 평가)
function checkIsProduction(): boolean {
  if (typeof window === 'undefined') return true // SSR에서는 production으로 간주
  const hostname = window.location.hostname
  return !hostname.includes('localhost') && !hostname.includes('127.0.0.1')
}

export default function XTermWrapper({ tabId, onExecute }: XTermWrapperProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const eventListenerRef = useRef<((e: Event) => void) | null>(null)
  const isInitializedRef = useRef(false)
  const isMountedRef = useRef(false)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isProductionRef = useRef<boolean | null>(null) // Production 여부 캐시
  const { resolvedTheme } = useTheme()

  // Production 체크 (캐시됨)
  const isProductionEnv = (): boolean => {
    if (isProductionRef.current !== null) return isProductionRef.current
    isProductionRef.current = checkIsProduction()
    return isProductionRef.current
  }

  // 테마 변경 시 xterm 테마 업데이트
  useEffect(() => {
    if (xtermRef.current) {
      const isDark = resolvedTheme === 'dark'
      xtermRef.current.options.theme = isDark ? darkTheme : lightTheme
    }
  }, [resolvedTheme])

  useEffect(() => {
    isMountedRef.current = true

    // 이미 초기화된 경우 스킵
    if (isInitializedRef.current) return

    // 초기화 지연 - DOM이 완전히 렌더링될 때까지 대기
    const timeoutId = setTimeout(() => {
      if (!terminalRef.current || isInitializedRef.current || !isMountedRef.current) return

      const container = terminalRef.current

      // 컨테이너에 크기가 있는지 확인
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        console.log('Container has no size, waiting...')
        return
      }

      // 기존 내용 클리어
      container.innerHTML = ''

      isInitializedRef.current = true
      initializeTerminal(container)
    }, 100)

    return () => {
      isMountedRef.current = false
      clearTimeout(timeoutId)
      cleanup()
    }
  }, [tabId])

  function initializeTerminal(container: HTMLDivElement) {
    const isDark = resolvedTheme === 'dark'
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      lineHeight: 1.2,
      theme: isDark ? darkTheme : lightTheme,
      scrollback: 10000,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)

    terminal.open(container)

    // Fit after open
    setTimeout(() => {
      try {
        fitAddon.fit()
      } catch (e) {
        console.error('Fit error:', e)
      }
    }, 50)

    xtermRef.current = terminal
    fitAddonRef.current = fitAddon

    // WebSocket 연결 (진짜 터미널)
    connectWebSocket(terminal)

    // External write listener
    const handleExternalWrite = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail.id === tabId) {
        terminal.write(customEvent.detail.text)
      }
    }
    eventListenerRef.current = handleExternalWrite
    window.addEventListener('terminal-write', handleExternalWrite)

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && isMountedRef.current) {
        try {
          fitAddonRef.current.fit()
        } catch (e) {
          // ignore
        }
      }
    })
    resizeObserverRef.current = resizeObserver
    resizeObserver.observe(container)
  }

  function connectWebSocket(terminal: Terminal) {
    if (!isMountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    // Production 환경에서는 WebSocket 연결 시도하지 않음
    if (isProductionEnv()) {
      terminal.write('\x1b[36m┌─────────────────────────────────────────────────────┐\x1b[0m\r\n')
      terminal.write('\x1b[36m│\x1b[0m  \x1b[33m⚡ Cloud Terminal Mode\x1b[0m                            \x1b[36m│\x1b[0m\r\n')
      terminal.write('\x1b[36m│\x1b[0m                                                     \x1b[36m│\x1b[0m\r\n')
      terminal.write('\x1b[36m│\x1b[0m  터미널은 로컬 개발 환경에서만 사용 가능합니다.    \x1b[36m│\x1b[0m\r\n')
      terminal.write('\x1b[36m│\x1b[0m  MCP 기능은 정상 작동합니다.                       \x1b[36m│\x1b[0m\r\n')
      terminal.write('\x1b[36m│\x1b[0m                                                     \x1b[36m│\x1b[0m\r\n')
      terminal.write('\x1b[36m│\x1b[0m  \x1b[32m✓\x1b[0m Claude Code로 캔버스 제어 가능                 \x1b[36m│\x1b[0m\r\n')
      terminal.write('\x1b[36m│\x1b[0m  \x1b[32m✓\x1b[0m 세션 ID를 복사하여 Claude에서 사용             \x1b[36m│\x1b[0m\r\n')
      terminal.write('\x1b[36m└─────────────────────────────────────────────────────┘\x1b[0m\r\n')
      return
    }

    if (reconnectAttemptsRef.current >= MAX_TERMINAL_RECONNECT_ATTEMPTS) {
      // Production에서는 메시지 표시하지 않음
      if (!isProductionEnv()) {
        terminal.write('\r\n\x1b[31m[Max reconnection attempts reached]\x1b[0m\r\n')
        terminal.write('\x1b[33mRun: node server/terminal-server.js\x1b[0m\r\n')
      }
      return
    }

    const ws = new WebSocket('ws://localhost:3001')

    ws.onopen = () => {
      if (!isMountedRef.current) {
        ws.close()
        return
      }
      console.log('Terminal connected')
      reconnectAttemptsRef.current = 0
      wsRef.current = ws
      const { cols, rows } = terminal
      ws.send(JSON.stringify({ type: 'resize', cols, rows }))
    }

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'output') {
          terminal.write(msg.data)
        } else if (msg.type === 'exit') {
          terminal.write('\r\n\x1b[31m[Process exited]\x1b[0m\r\n')
        } else if (msg.type === 'shell-info') {
          // 셸 정보를 TerminalPanel에 전달
          window.dispatchEvent(new CustomEvent('terminal-shell-info', {
            detail: {
              id: tabId,
              shell: msg.shell,
              cwd: msg.cwd,
              pid: msg.pid
            }
          }))
        } else if (msg.type === 'cwd-update') {
          // CWD 업데이트를 TerminalPanel에 전달
          window.dispatchEvent(new CustomEvent('terminal-cwd-update', {
            detail: { id: tabId, cwd: msg.cwd }
          }))
        }
      } catch (e) {
        console.error('Message parse error:', e)
      }
    }

    ws.onclose = () => {
      if (!isMountedRef.current) return
      wsRef.current = null

      // Production 환경에서는 재연결 시도하지 않음
      if (isProductionEnv()) return

      // 재연결 시도 (제한 있음)
      if (reconnectTimerRef.current) return
      if (reconnectAttemptsRef.current >= MAX_TERMINAL_RECONNECT_ATTEMPTS) {
        return
      }

      reconnectAttemptsRef.current++
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null
        if (isMountedRef.current && xtermRef.current && !isProductionEnv()) {
          connectWebSocket(xtermRef.current)
        }
      }, 3000)
    }

    ws.onerror = () => {
      if (!isMountedRef.current) return
      // Production 환경에서는 에러 메시지 표시하지 않음
      if (isProductionEnv()) return
      terminal.write('\r\n\x1b[31m[Connection error]\x1b[0m\r\n')
      terminal.write('\x1b[33mRun: node server/terminal-server.js\x1b[0m\r\n')
    }

    wsRef.current = ws

    // Terminal input -> WebSocket
    terminal.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }))
      }
    })

    terminal.onResize(({ cols, rows }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }))
      }
    })
  }

  function cleanup() {
    // Event listener 제거
    if (eventListenerRef.current) {
      window.removeEventListener('terminal-write', eventListenerRef.current)
      eventListenerRef.current = null
    }
    // ResizeObserver 해제
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect()
      resizeObserverRef.current = null
    }
    // 재연결 타이머 정리
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    // WebSocket 닫기
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    // xterm dispose
    if (xtermRef.current) {
      xtermRef.current.dispose()
      xtermRef.current = null
    }
    fitAddonRef.current = null
    isInitializedRef.current = false
    reconnectAttemptsRef.current = 0
  }

  return (
    <div
      ref={terminalRef}
      className="h-full w-full bg-white dark:bg-black"
      style={{
        minHeight: '100px',
        minWidth: '200px',
        padding: '4px',
      }}
      onKeyDown={(e) => e.stopPropagation()}
    />
  )
}
