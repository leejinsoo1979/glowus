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

// Electron 환경 체크
function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electron?.terminal
}

export default function XTermWrapper({ tabId, onExecute }: XTermWrapperProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const eventListenerRef = useRef<((e: Event) => void) | null>(null)
  const cleanupFnsRef = useRef<(() => void)[]>([])
  const isInitializedRef = useRef(false)
  const isMountedRef = useRef(false)
  const { resolvedTheme } = useTheme()

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

    // Electron IPC 또는 WebSocket 연결
    if (isElectron()) {
      connectElectronTerminal(terminal)
    } else {
      connectWebSocketTerminal(terminal)
    }

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
          // Electron 환경에서 리사이즈 전송
          if (isElectron() && xtermRef.current) {
            const { cols, rows } = xtermRef.current
            ;(window as any).electron.terminal.resize(tabId, cols, rows)
          }
        } catch (e) {
          // ignore
        }
      }
    })
    resizeObserverRef.current = resizeObserver
    resizeObserver.observe(container)
  }

  // Electron IPC 기반 터미널 (안정적)
  async function connectElectronTerminal(terminal: Terminal) {
    if (!isMountedRef.current) return

    const electronApi = (window as any).electron.terminal

    try {
      // 터미널 생성
      const result = await electronApi.create(tabId)

      if (!result.success) {
        terminal.write(`\x1b[31m[Error] ${result.error}\x1b[0m\r\n`)
        return
      }

      console.log(`[Terminal] Connected: ${result.shell} (PID: ${result.pid})`)

      // 셸 정보 이벤트 발송
      window.dispatchEvent(new CustomEvent('terminal-shell-info', {
        detail: {
          id: tabId,
          shell: result.shell,
          cwd: result.cwd,
          pid: result.pid
        }
      }))

      // 터미널 출력 수신
      const unsubData = electronApi.onData((id: string, data: string) => {
        if (id === tabId && isMountedRef.current) {
          terminal.write(data)
        }
      })
      cleanupFnsRef.current.push(unsubData)

      // 터미널 종료 수신
      const unsubExit = electronApi.onExit((id: string, exitCode: number) => {
        if (id === tabId && isMountedRef.current) {
          terminal.write(`\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m\r\n`)
        }
      })
      cleanupFnsRef.current.push(unsubExit)

      // 터미널 입력 → Electron
      terminal.onData((data) => {
        if (isMountedRef.current) {
          electronApi.write(tabId, data)
        }
      })

      // 초기 리사이즈
      const { cols, rows } = terminal
      await electronApi.resize(tabId, cols, rows)

      // 리사이즈 이벤트
      terminal.onResize(({ cols, rows }) => {
        if (isMountedRef.current) {
          electronApi.resize(tabId, cols, rows)
        }
      })

    } catch (err) {
      console.error('Electron terminal error:', err)
      terminal.write(`\x1b[31m[Error] Failed to connect terminal\x1b[0m\r\n`)
    }
  }

  // WebSocket 기반 터미널 (브라우저 환경 폴백)
  function connectWebSocketTerminal(terminal: Terminal) {
    if (!isMountedRef.current) return

    // 브라우저 환경에서는 안내 메시지 표시
    terminal.write('\x1b[36m┌─────────────────────────────────────────────────────┐\x1b[0m\r\n')
    terminal.write('\x1b[36m│\x1b[0m  \x1b[33mTerminal requires Electron environment\x1b[0m          \x1b[36m│\x1b[0m\r\n')
    terminal.write('\x1b[36m│\x1b[0m                                                     \x1b[36m│\x1b[0m\r\n')
    terminal.write('\x1b[36m│\x1b[0m  Desktop 앱에서 터미널이 작동합니다.               \x1b[36m│\x1b[0m\r\n')
    terminal.write('\x1b[36m│\x1b[0m  브라우저에서는 지원되지 않습니다.                 \x1b[36m│\x1b[0m\r\n')
    terminal.write('\x1b[36m│\x1b[0m                                                     \x1b[36m│\x1b[0m\r\n')
    terminal.write('\x1b[36m│\x1b[0m  \x1b[32mOption 1:\x1b[0m Electron 앱으로 실행                  \x1b[36m│\x1b[0m\r\n')
    terminal.write('\x1b[36m│\x1b[0m  \x1b[32mOption 2:\x1b[0m node server/terminal-server.js       \x1b[36m│\x1b[0m\r\n')
    terminal.write('\x1b[36m└─────────────────────────────────────────────────────┘\x1b[0m\r\n')
  }

  function cleanup() {
    // Electron 터미널 종료
    if (isElectron()) {
      ;(window as any).electron.terminal.kill(tabId).catch(() => {})
    }

    // 클린업 함수들 실행
    cleanupFnsRef.current.forEach(fn => fn())
    cleanupFnsRef.current = []

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

    // xterm dispose
    if (xtermRef.current) {
      xtermRef.current.dispose()
      xtermRef.current = null
    }

    fitAddonRef.current = null
    isInitializedRef.current = false
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
