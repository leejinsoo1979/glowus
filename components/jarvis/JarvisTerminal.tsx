'use client'

/**
 * JarvisTerminal - 완전한 대화형 Claude Code 터미널
 *
 * xterm.js 기반 실시간 터미널 + 권한 승인 UI
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useTheme } from 'next-themes'
import { Wifi, WifiOff, Play, Square, Trash2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useJarvis } from '@/hooks/useJarvis'
import { PermissionModal } from './PermissionModal'

import '@xterm/xterm/css/xterm.css'

interface JarvisTerminalProps {
  cwd?: string
  sessionId?: string
  className?: string
  onSessionStart?: () => void
}

// Claude Code 스타일 테마
const CLAUDE_THEME = {
  dark: {
    background: '#1a1a1a',
    foreground: '#e4e4e7',
    cursor: '#cc5500',
    cursorAccent: '#1a1a1a',
    selectionBackground: '#cc550040',
    black: '#27272a',
    red: '#f87171',
    green: '#4ade80',
    yellow: '#facc15',
    blue: '#60a5fa',
    magenta: '#c084fc',
    cyan: '#22d3ee',
    white: '#e4e4e7',
    brightBlack: '#52525b',
    brightRed: '#fca5a5',
    brightGreen: '#86efac',
    brightYellow: '#fde047',
    brightBlue: '#93c5fd',
    brightMagenta: '#d8b4fe',
    brightCyan: '#67e8f9',
    brightWhite: '#fafafa',
  },
  light: {
    background: '#ffffff',
    foreground: '#18181b',
    cursor: '#cc5500',
    cursorAccent: '#ffffff',
    selectionBackground: '#cc550030',
    black: '#18181b',
    red: '#dc2626',
    green: '#16a34a',
    yellow: '#ca8a04',
    blue: '#2563eb',
    magenta: '#9333ea',
    cyan: '#0891b2',
    white: '#f4f4f5',
    brightBlack: '#71717a',
    brightRed: '#ef4444',
    brightGreen: '#22c55e',
    brightYellow: '#eab308',
    brightBlue: '#3b82f6',
    brightMagenta: '#a855f7',
    brightCyan: '#06b6d4',
    brightWhite: '#fafafa',
  },
}

export function JarvisTerminal({
  cwd,
  sessionId,
  className,
  onSessionStart,
}: JarvisTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const {
    isConnected,
    isRunning,
    currentCwd,
    pendingPermissions,
    connect,
    startSession,
    sendInput,
    stop,
    closeSession,
    resize,
    approvePermission,
    denyPermission,
    approveAllPermissions,
  } = useJarvis({
    autoConnect: true,
    cwd,
    onOutput: (data) => {
      xtermRef.current?.write(data)
    },
    onExit: (code) => {
      xtermRef.current?.writeln(`\r\n[세션 종료: ${code}]`)
    },
  })

  // xterm 초기화
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return

    const theme = isDark ? CLAUDE_THEME.dark : CLAUDE_THEME.light

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      theme,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)

    terminal.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = terminal
    fitAddonRef.current = fitAddon

    // 입력 처리 → Jarvis 서버로 전송
    terminal.onData((data) => {
      sendInput(data)
    })

    // 리사이즈 처리
    const handleResize = () => {
      fitAddon.fit()
      resize(terminal.cols, terminal.rows)
    }

    window.addEventListener('resize', handleResize)

    // 초기 메시지
    terminal.writeln('\x1b[1;36m╔══════════════════════════════════════════════════════════╗\x1b[0m')
    terminal.writeln('\x1b[1;36m║\x1b[0m  \x1b[1;33mJarvis\x1b[0m - GlowUS AI Assistant powered by Claude Code   \x1b[1;36m║\x1b[0m')
    terminal.writeln('\x1b[1;36m╚══════════════════════════════════════════════════════════╝\x1b[0m')
    terminal.writeln('')

    return () => {
      window.removeEventListener('resize', handleResize)
      terminal.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [])

  // 테마 변경 시 업데이트
  useEffect(() => {
    if (xtermRef.current) {
      const theme = isDark ? CLAUDE_THEME.dark : CLAUDE_THEME.light
      xtermRef.current.options.theme = theme
    }
  }, [isDark])

  // 세션 시작
  const handleStart = useCallback(() => {
    if (!isConnected) {
      connect()
      setTimeout(() => {
        startSession(cwd, sessionId)
        onSessionStart?.()
      }, 500)
    } else {
      startSession(cwd, sessionId)
      onSessionStart?.()
    }

    xtermRef.current?.writeln('\x1b[90m[Claude Code 세션 시작 중...]\x1b[0m')
  }, [isConnected, connect, startSession, cwd, sessionId, onSessionStart])

  // 세션 종료
  const handleStop = useCallback(() => {
    stop()
    xtermRef.current?.writeln('\x1b[90m[중단 요청...]\x1b[0m')
  }, [stop])

  // 초기화
  const handleClear = useCallback(() => {
    xtermRef.current?.clear()
    closeSession()
  }, [closeSession])

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* 툴바 */}
      <div className={cn(
        "flex items-center justify-between px-4 py-2 border-b",
        isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-100 border-zinc-200"
      )}>
        <div className="flex items-center gap-3">
          {/* 연결 상태 */}
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-zinc-500" />
            )}
            <span className={cn(
              "text-xs",
              isConnected ? "text-green-500" : "text-zinc-500"
            )}>
              {isConnected ? (isRunning ? 'Running' : 'Connected') : 'Disconnected'}
            </span>
          </div>

          {/* CWD */}
          {currentCwd && (
            <span className="text-xs text-zinc-500 truncate max-w-[200px]">
              {currentCwd}
            </span>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-1">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                isDark
                  ? "hover:bg-zinc-800 text-green-400"
                  : "hover:bg-zinc-200 text-green-600"
              )}
              title="세션 시작"
            >
              <Play className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleStop}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                isDark
                  ? "hover:bg-zinc-800 text-red-400"
                  : "hover:bg-zinc-200 text-red-600"
              )}
              title="중단 (Ctrl+C)"
            >
              <Square className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleClear}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              isDark
                ? "hover:bg-zinc-800 text-zinc-400"
                : "hover:bg-zinc-200 text-zinc-600"
            )}
            title="초기화"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 터미널 */}
      <div
        ref={terminalRef}
        className={cn(
          "flex-1 overflow-hidden",
          isDark ? "bg-[#1a1a1a]" : "bg-white"
        )}
        style={{ padding: '8px' }}
      />

      {/* 권한 승인 모달 */}
      <PermissionModal
        requests={pendingPermissions}
        onApprove={approvePermission}
        onDeny={denyPermission}
        onApproveAll={approveAllPermissions}
      />
    </div>
  )
}

export default JarvisTerminal
