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
  projectPath?: string // 프로젝트 폴더 경로
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

export default function XTermWrapper({ tabId, onExecute, projectPath }: XTermWrapperProps) {
  // 🔥 컴포넌트 마운트 시 projectPath 로그
  console.log('[XTermWrapper] 🚀 MOUNT/RENDER - projectPath:', projectPath, 'tabId:', tabId)

  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const eventListenerRef = useRef<((e: Event) => void) | null>(null)
  const cleanupFnsRef = useRef<(() => void)[]>([])
  const isInitializedRef = useRef(false)
  const isMountedRef = useRef(false)
  const wsRef = useRef<WebSocket | null>(null) // WebSocket 참조 저장
  const lastSentCwdRef = useRef<string | null>(null) // 마지막으로 전송한 cwd
  const projectPathRef = useRef<string | undefined>(projectPath) // 🔥 최신 projectPath 추적
  const { resolvedTheme } = useTheme()

  // 🔥 projectPath가 변경될 때마다 ref 업데이트
  useEffect(() => {
    console.log('[XTermWrapper] 📝 projectPath ref updated:', projectPath)
    projectPathRef.current = projectPath
  }, [projectPath])

  // projectPath가 변경되면 터미널에 새 경로 전송 (cd 명령)
  useEffect(() => {
    console.log('[XTerm] projectPath useEffect triggered:', { projectPath, lastSent: lastSentCwdRef.current, tabId })

    if (!projectPath) return

    // 이미 같은 경로를 전송한 경우 스킵
    if (lastSentCwdRef.current === projectPath) {
      console.log('[XTerm] Same path, skipping cd command')
      return
    }

    // Electron 터미널인 경우 cd 명령 전송
    if (isElectron()) {
      const electronApi = (window as any).electron?.terminal
      if (electronApi) {
        console.log('[Terminal] projectPath changed, sending cd command:', projectPath)
        // cd 명령으로 디렉토리 변경 (clear도 같이)
        electronApi.write(tabId, `cd "${projectPath}" && clear\n`)
        lastSentCwdRef.current = projectPath
        return
      }
    }

    // WebSocket 터미널인 경우
    const sendCwd = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('[Terminal] projectPath changed, sending set-cwd:', projectPath)
        wsRef.current.send(JSON.stringify({ type: 'set-cwd', cwd: projectPath }))
        lastSentCwdRef.current = projectPath
        return true
      }
      return false
    }

    // 즉시 전송 시도
    if (sendCwd()) return

    // WebSocket이 아직 연결 중이면 대기 후 재시도
    console.log('[Terminal] WebSocket not ready, waiting to send set-cwd:', projectPath)
    const intervalId = setInterval(() => {
      if (sendCwd()) {
        clearInterval(intervalId)
      }
    }, 500)

    // 10초 후 포기
    const timeoutId = setTimeout(() => {
      clearInterval(intervalId)
      console.warn('[Terminal] Gave up waiting to send set-cwd')
    }, 10000)

    return () => {
      clearInterval(intervalId)
      clearTimeout(timeoutId)
    }
  }, [projectPath, tabId])

  // 테마 변경 시 xterm 테마 업데이트
  useEffect(() => {
    if (xtermRef.current) {
      const isDark = resolvedTheme === 'dark'
      xtermRef.current.options.theme = isDark ? darkTheme : lightTheme
    }
  }, [resolvedTheme])

  useEffect(() => {
    isMountedRef.current = true

    let intervalId: NodeJS.Timeout | null = null

    // 초기화 함수 - 컨테이너 크기가 생길 때까지 재시도 (무한)
    const tryInitialize = () => {
      if (!terminalRef.current || !isMountedRef.current) {
        return
      }

      // 이미 초기화된 경우 체크
      if (isInitializedRef.current) {
        if (intervalId) clearInterval(intervalId)
        return
      }

      const container = terminalRef.current

      // 컨테이너에 크기가 있는지 확인
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        // 패널이 hidden일 때는 크기가 0 - 계속 재시도 (무한)
        return
      }

      // 크기가 생김 - 초기화 진행
      console.log(`[XTerm] Container has size: ${container.offsetWidth}x${container.offsetHeight}`)
      if (intervalId) clearInterval(intervalId)

      // 기존 xterm 인스턴스가 있으면 정리
      if (xtermRef.current) {
        try {
          xtermRef.current.dispose()
          xtermRef.current = null
        } catch (e) {
          console.warn('[XTerm] Failed to dispose existing terminal:', e)
        }
      }

      // xterm이 생성한 자식 요소만 제거 (React 관리 요소는 유지)
      const xtermElements = container.querySelectorAll('.xterm')
      xtermElements.forEach(el => {
        try {
          el.remove()
        } catch (e) {
          // ignore
        }
      })

      isInitializedRef.current = true
      setIsLoading(false)
      initializeTerminal(container)
    }

    // 200ms마다 재시도 (패널이 열릴 때까지 무한 대기)
    intervalId = setInterval(tryInitialize, 200)
    // 즉시 한 번 시도
    tryInitialize()

    return () => {
      console.log(`[XTerm] Cleanup for tab: ${tabId}`)
      isMountedRef.current = false
      if (intervalId) clearInterval(intervalId)
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

    console.log('[Terminal] connectElectronTerminal called, tabId:', tabId)

    const electronApi = (window as any).electron?.terminal
    if (!electronApi) {
      console.error('[Terminal] No electron terminal API found, falling back to WebSocket')
      connectWebSocketTerminal(terminal)
      return
    }

    try {
      // 🔥 터미널 생성 - projectPathRef.current로 최신 값 사용
      const currentPath = projectPathRef.current
      console.log('[Terminal] Calling electronApi.create with cwd:', currentPath)
      const result = await electronApi.create(tabId, currentPath || undefined)
      console.log('[Terminal] electronApi.create result:', result)

      if (!result.success) {
        terminal.write(`\x1b[31m[Error] ${result.error}\x1b[0m\r\n`)
        return
      }

      // WebSocket 모드로 리다이렉트
      if (result.useWebSocket) {
        console.log(`[Terminal] Using WebSocket: ${result.wsUrl}`)
        connectWebSocketTerminalReal(terminal, result.wsUrl || 'ws://localhost:3001')
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

    // 브라우저 환경에서도 WebSocket 터미널 서버에 연결
    const wsUrl = 'ws://localhost:3001'
    terminal.write('\x1b[36m[Connecting to terminal server...]\x1b[0m\r\n')
    connectWebSocketTerminalReal(terminal, wsUrl)
  }

  // 실제 WebSocket 터미널 연결 (Electron에서 PTY 대신 사용)
  function connectWebSocketTerminalReal(terminal: Terminal, wsUrl: string, retryCount = 0) {
    if (!isMountedRef.current) return

    const maxRetries = 10
    const retryDelay = Math.min(1000 * Math.pow(1.5, retryCount), 10000) // 최대 10초

    console.log('[Terminal] Connecting to WebSocket:', wsUrl, retryCount > 0 ? `(retry ${retryCount})` : '')

    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl)
      wsRef.current = ws // WebSocket 참조 저장
    } catch (err) {
      console.error('[Terminal] WebSocket creation failed:', err)
      if (retryCount < maxRetries && isMountedRef.current) {
        terminal.write(`\x1b[33m[Retrying in ${Math.round(retryDelay/1000)}s...]\x1b[0m\r\n`)
        setTimeout(() => connectWebSocketTerminalReal(terminal, wsUrl, retryCount + 1), retryDelay)
      }
      return
    }

    ws.onopen = () => {
      console.log('[Terminal] WebSocket connected to', wsUrl)
      if (retryCount > 0) {
        terminal.write('\x1b[32m[Reconnected]\x1b[0m\r\n')
      }

      // 🔥 최신 projectPath 값 사용 (ref에서 가져옴)
      const currentProjectPath = projectPathRef.current

      // 🔥 projectPath가 없으면 강력한 경고 메시지 표시
      if (!currentProjectPath) {
        terminal.write('\x1b[31m╔════════════════════════════════════════════════════════════╗\x1b[0m\r\n')
        terminal.write('\x1b[31m║  ⚠️  프로젝트 폴더가 설정되지 않았습니다!                   ║\x1b[0m\r\n')
        terminal.write('\x1b[31m╠════════════════════════════════════════════════════════════╣\x1b[0m\r\n')
        terminal.write('\x1b[33m║  터미널은 프로젝트 폴더 내에서 실행되어야 합니다.          ║\x1b[0m\r\n')
        terminal.write('\x1b[33m║                                                            ║\x1b[0m\r\n')
        terminal.write('\x1b[33m║  👉 좌측 파일 트리에서 "Open Folder" 버튼을 클릭하거나     ║\x1b[0m\r\n')
        terminal.write('\x1b[33m║  👉 프로젝트를 선택해서 폴더를 열어주세요.                  ║\x1b[0m\r\n')
        terminal.write('\x1b[31m╚════════════════════════════════════════════════════════════╝\x1b[0m\r\n')
        terminal.write('\r\n')
        terminal.write('\x1b[90m현재 위치: 홈 디렉토리 (임시)\x1b[0m\r\n\r\n')
      }

      // 🔥 터미널 초기화 메시지: 크기 + 초기 cwd를 함께 전송
      // 서버가 PTY 생성 시 바로 이 cwd를 사용하도록 함
      const { cols, rows } = terminal
      const initMsg = {
        type: 'init',
        cols,
        rows,
        cwd: currentProjectPath || undefined
      }
      console.log('[Terminal] Sending init message:', initMsg)
      ws.send(JSON.stringify(initMsg))

      if (currentProjectPath) {
        lastSentCwdRef.current = currentProjectPath
      }
    }

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'output') {
          terminal.write(msg.data)
        } else if (msg.type === 'shell-info') {
          window.dispatchEvent(new CustomEvent('terminal-shell-info', {
            detail: { id: tabId, shell: msg.shell, cwd: msg.cwd, pid: msg.pid }
          }))
        }
      } catch {
        // 일반 텍스트인 경우 그대로 출력
        terminal.write(event.data)
      }
    }

    ws.onerror = (err) => {
      console.error('[Terminal] WebSocket error:', err, 'URL:', wsUrl)
    }

    ws.onclose = (event) => {
      wsRef.current = null // WebSocket 참조 제거
      if (isMountedRef.current) {
        terminal.write('\r\n\x1b[33m[Connection closed]\x1b[0m\r\n')
        // 비정상 종료 시 자동 재연결
        if (!event.wasClean && retryCount < maxRetries) {
          terminal.write(`\x1b[36m[Reconnecting in ${Math.round(retryDelay/1000)}s...]\x1b[0m\r\n`)
          setTimeout(() => connectWebSocketTerminalReal(terminal, wsUrl, retryCount + 1), retryDelay)
        }
      }
    }

    // 터미널 입력 → WebSocket
    const dataHandler = terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    // 리사이즈
    const resizeHandler = terminal.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }))
      }
    })

    // 클린업
    cleanupFnsRef.current.push(() => {
      dataHandler.dispose()
      resizeHandler.dispose()
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    })
  }

  function cleanup() {
    // 초기화 상태 리셋 (다음 마운트에서 다시 초기화할 수 있도록)
    isInitializedRef.current = false

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

  const [isLoading, setIsLoading] = useState(true)

  return (
    <div
      className="w-full bg-white dark:bg-black"
      style={{
        height: '100%',
        minHeight: '150px',
        minWidth: '200px',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* 로딩 오버레이 - xterm 컨테이너와 분리 */}
      {isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center text-zinc-500 dark:text-zinc-400 text-sm z-10 bg-white dark:bg-black"
          style={{ pointerEvents: 'none' }}
        >
          터미널 연결 대기 중... (tabId: {tabId})
        </div>
      )}
      {/* xterm 전용 컨테이너 - React가 건드리지 않음 */}
      <div
        ref={terminalRef}
        style={{
          width: '100%',
          height: '100%',
          padding: '4px',
        }}
      />
    </div>
  )
}
