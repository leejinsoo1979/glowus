"use client"

/**
 * GlobalAgentSidebar - Jarvis 기반 Claude Code 사이드바
 *
 * PTY 대화형 + 권한 승인 UI + GlowUS 컨텍스트 통합
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
    X,
    Trash2,
    FolderOpen,
    Wifi,
    WifiOff,
    Play,
    Square,
    Maximize2,
    Minimize2,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useJarvis, WorkflowControlCommand } from '@/hooks/useJarvis'
import { useWorkflowStore } from '@/stores/workflowStore'
import { PermissionModal } from '@/components/jarvis/PermissionModal'
import { useGlowContextStore } from '@/stores/glowContextStore'

// Claude Code 브랜드 색상
const CLAUDE_ORANGE = '#D97757'

// Spark 아이콘 (Claude Code 로고)
const SparkIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
        <path d="M12 2L13.09 8.26L18 6L15.74 10.91L22 12L15.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L8.26 13.09L2 12L8.26 10.91L6 6L10.91 8.26L12 2Z" />
    </svg>
)

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

interface GlobalAgentSidebarProps {
    isOpen: boolean
    onToggle: () => void
}

export function GlobalAgentSidebar({ isOpen, onToggle }: GlobalAgentSidebarProps) {
    const { resolvedTheme } = useTheme()
    const router = useRouter()
    const isDark = resolvedTheme === 'dark'

    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<any>(null)
    const fitAddonRef = useRef<any>(null)
    const sendInputRef = useRef<(data: string) => void>(() => {})
    const outputBufferRef = useRef<string[]>([])
    const xtermInitializedRef = useRef(false)

    const [projectPath, setProjectPath] = useState('')
    const [isExpanded, setIsExpanded] = useState(false)
    const [terminalReady, setTerminalReady] = useState(false)
    const [mounted, setMounted] = useState(false)

    // GlowUS 컨텍스트
    const currentPageTitle = useGlowContextStore((s) => s.currentPageTitle)
    const getContextForClaude = useGlowContextStore((s) => s.getContextForClaude)

    // 워크플로우 스토어 - 액션만 가져오기 (상태 구독 안함, 액션은 안정적)
    const workflowAddNode = useWorkflowStore((s) => s.addNode)
    const workflowRemoveNode = useWorkflowStore((s) => s.removeNode)
    const workflowUpdateNode = useWorkflowStore((s) => s.updateNode)
    const workflowConnectNodes = useWorkflowStore((s) => s.connectNodes)
    const workflowDisconnectNodes = useWorkflowStore((s) => s.disconnectNodes)
    const workflowClearAll = useWorkflowStore((s) => s.clearAll)

    // MCP에서 보낸 네비게이션 명령 처리
    const handleNavigate = useCallback((route: string) => {
        console.log('[Jarvis] Navigate command received:', route)
        xtermRef.current?.writeln(`\r\n\x1b[36m[GlowUS] 페이지 이동: ${route}\x1b[0m`)
        router.push(route)
    }, [router])

    // 워크플로우 빌더 제어 명령 처리
    const handleWorkflowControl = useCallback((command: WorkflowControlCommand) => {
        console.log('[Jarvis] Workflow control:', command.action, command)
        xtermRef.current?.writeln(`\r\n\x1b[35m[워크플로우] ${command.action}\x1b[0m`)

        switch (command.action) {
            case 'add_node':
                if (command.nodeType) {
                    const nodeId = workflowAddNode(
                        command.nodeType,
                        command.position,
                        command.data
                    )
                    xtermRef.current?.writeln(`\x1b[32m  ✓ 노드 추가됨: ${nodeId}\x1b[0m`)
                }
                break

            case 'remove_node':
                if (command.nodeId) {
                    workflowRemoveNode(command.nodeId)
                    xtermRef.current?.writeln(`\x1b[32m  ✓ 노드 삭제됨: ${command.nodeId}\x1b[0m`)
                }
                break

            case 'update_node':
                if (command.nodeId && command.data) {
                    workflowUpdateNode(command.nodeId, command.data)
                    xtermRef.current?.writeln(`\x1b[32m  ✓ 노드 수정됨: ${command.nodeId}\x1b[0m`)
                }
                break

            case 'connect':
                if (command.sourceId && command.targetId) {
                    workflowConnectNodes(
                        command.sourceId,
                        command.targetId,
                        command.sourceHandle,
                        command.targetHandle
                    )
                    xtermRef.current?.writeln(`\x1b[32m  ✓ 연결됨: ${command.sourceId} → ${command.targetId}\x1b[0m`)
                }
                break

            case 'disconnect':
                if (command.sourceId && command.targetId) {
                    workflowDisconnectNodes(command.sourceId, command.targetId)
                    xtermRef.current?.writeln(`\x1b[32m  ✓ 연결 해제됨\x1b[0m`)
                }
                break

            case 'clear':
                workflowClearAll()
                xtermRef.current?.writeln(`\x1b[32m  ✓ 워크플로우 초기화됨\x1b[0m`)
                break

            case 'execute':
                // TODO: 실행은 WorkflowBuilder 컴포넌트의 handleExecute 호출 필요
                xtermRef.current?.writeln(`\x1b[33m  ⚠ 실행은 워크플로우 빌더에서 직접 해주세요\x1b[0m`)
                break

            case 'get_state':
                // 상태 조회 시에만 getState()로 직접 접근 (구독 안함)
                const currentState = useWorkflowStore.getState()
                const stateInfo = {
                    nodes: currentState.nodes.length,
                    edges: currentState.edges.length,
                    nodeList: currentState.nodes.map(n => `${n.type}(${n.id})`),
                }
                xtermRef.current?.writeln(`\x1b[36m  상태: 노드 ${stateInfo.nodes}개, 연결 ${stateInfo.edges}개\x1b[0m`)
                break
        }
    }, [workflowAddNode, workflowRemoveNode, workflowUpdateNode, workflowConnectNodes, workflowDisconnectNodes, workflowClearAll])

    // 터미널에 출력하는 콜백
    const writeToTerminal = useCallback((data: string) => {
        console.log('[Jarvis] writeToTerminal called, data length:', data?.length, 'xterm ready:', !!xtermRef.current)
        if (xtermRef.current) {
            try {
                xtermRef.current.write(data)
                console.log('[Jarvis] Write to xterm successful')
            } catch (err) {
                console.error('[Jarvis] Failed to write to xterm:', err)
            }
        } else {
            outputBufferRef.current.push(data)
            console.log('[Jarvis] Buffered output, count:', outputBufferRef.current.length)
        }
    }, [])

    // Jarvis 훅
    const {
        isConnected,
        isRunning,
        currentCwd,
        error,
        pendingPermissions,
        isBrowserRegistered,
        connect,
        startSession,
        sendInput,
        stop,
        closeSession,
        resize,
        registerAsBrowser,
        approvePermission,
        denyPermission,
        approveAllPermissions,
    } = useJarvis({
        autoConnect: false,
        cwd: projectPath,
        onOutput: writeToTerminal,
        onExit: (code) => {
            xtermRef.current?.writeln(`\r\n\x1b[90m[세션 종료: ${code}]\x1b[0m`)
        },
        onNavigate: handleNavigate,
        onControl: (action, data) => {
            console.log('[Jarvis] Control action:', action, data)
        },
        onWorkflowControl: handleWorkflowControl,
    })

    // 브라우저 등록 상태 로그
    useEffect(() => {
        console.log('[Jarvis] Browser registered:', isBrowserRegistered)
    }, [isBrowserRegistered])

    // sendInput ref 업데이트
    useEffect(() => {
        sendInputRef.current = sendInput
    }, [sendInput])

    // 클라이언트 마운트 확인
    useEffect(() => {
        setMounted(true)
    }, [])

    // localStorage에서 프로젝트 경로 로드
    useEffect(() => {
        if (mounted) {
            const savedPath = localStorage.getItem('jarvis_project_path')
            // 경로 검증: /로 시작하거나 ~로 시작해야 함
            if (savedPath && (savedPath.startsWith('/') || savedPath.startsWith('~'))) {
                setProjectPath(savedPath)
            } else if (savedPath) {
                // 잘못된 값이면 삭제
                localStorage.removeItem('jarvis_project_path')
            }
        }
    }, [mounted])

    // 프로젝트 경로 저장
    useEffect(() => {
        // 경로 검증 후 저장
        if (projectPath && mounted && (projectPath.startsWith('/') || projectPath.startsWith('~'))) {
            localStorage.setItem('jarvis_project_path', projectPath)
        }
    }, [projectPath, mounted])

    // xterm 초기화 - 동적 import 사용
    useEffect(() => {
        if (!mounted || !terminalRef.current || xtermInitializedRef.current) return

        const initTerminal = async () => {
            try {
                // 동적 import
                const { Terminal } = await import('@xterm/xterm')
                const { FitAddon } = await import('@xterm/addon-fit')
                const { WebLinksAddon } = await import('@xterm/addon-web-links')

                // CSS import
                await import('@xterm/xterm/css/xterm.css')

                if (!terminalRef.current || xtermInitializedRef.current) return

                const theme = isDark ? CLAUDE_THEME.dark : CLAUDE_THEME.light

                const terminal = new Terminal({
                    cursorBlink: true,
                    cursorStyle: 'bar',
                    fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
                    fontSize: 11,  // 사이드바 너비에 맞게 조금 줄임
                    lineHeight: 1.2,
                    theme,
                    allowProposedApi: true,
                    scrollback: 5000,
                })

                const fitAddon = new FitAddon()
                const webLinksAddon = new WebLinksAddon()

                terminal.loadAddon(fitAddon)
                terminal.loadAddon(webLinksAddon)

                terminal.open(terminalRef.current)

                xtermRef.current = terminal
                fitAddonRef.current = fitAddon
                xtermInitializedRef.current = true

                // 입력 처리 → Jarvis 서버로 전송
                terminal.onData((data: string) => {
                    sendInputRef.current(data)
                })

                // 초기 메시지
                terminal.writeln('\x1b[1;38;2;217;119;87m╔══════════════════════════════════════╗\x1b[0m')
                terminal.writeln('\x1b[1;38;2;217;119;87m║\x1b[0m    \x1b[1;33mJarvis\x1b[0m - GlowUS AI Assistant    \x1b[1;38;2;217;119;87m║\x1b[0m')
                terminal.writeln('\x1b[1;38;2;217;119;87m╚══════════════════════════════════════╝\x1b[0m')
                terminal.writeln('')
                terminal.writeln('\x1b[90m  Play 버튼을 눌러 세션을 시작하세요.\x1b[0m')
                terminal.writeln('')

                setTerminalReady(true)

                // 버퍼된 출력 플러시
                if (outputBufferRef.current.length > 0) {
                    console.log('[Jarvis] Flushing buffered output:', outputBufferRef.current.length, 'items')
                    outputBufferRef.current.forEach(data => terminal.write(data))
                    outputBufferRef.current = []
                }

                // fit 호출
                setTimeout(() => {
                    fitAddon.fit()
                }, 100)

                console.log('[Jarvis] xterm initialized successfully')
            } catch (err) {
                console.error('[Jarvis] Failed to initialize xterm:', err)
            }
        }

        initTerminal()

        return () => {
            if (xtermRef.current) {
                xtermRef.current.dispose()
                xtermRef.current = null
                fitAddonRef.current = null
                xtermInitializedRef.current = false
                setTerminalReady(false)
            }
        }
    }, [mounted, isDark])

    // 사이드바 열릴 때 터미널 fit
    useEffect(() => {
        if (isOpen && fitAddonRef.current && xtermRef.current) {
            setTimeout(() => {
                fitAddonRef.current?.fit()
                if (xtermRef.current) {
                    resize(xtermRef.current.cols, xtermRef.current.rows)
                }
            }, 300)
        }
    }, [isOpen, isExpanded, resize])

    // 리사이즈 처리
    useEffect(() => {
        const handleResize = () => {
            if (fitAddonRef.current && xtermRef.current && isOpen) {
                fitAddonRef.current.fit()
                resize(xtermRef.current.cols, xtermRef.current.rows)
            }
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [isOpen, resize])

    // 테마 변경 시 업데이트
    useEffect(() => {
        if (xtermRef.current && mounted) {
            const theme = isDark ? CLAUDE_THEME.dark : CLAUDE_THEME.light
            xtermRef.current.options.theme = theme
        }
    }, [isDark, mounted])

    // 자동 연결 및 브라우저 등록
    useEffect(() => {
        if (isOpen && !isConnected && mounted) {
            connect().then((connected) => {
                if (connected) {
                    // 연결 성공 시 브라우저로 등록 (MCP 제어 명령 수신용)
                    setTimeout(() => registerAsBrowser(), 100)
                }
            })
        }
    }, [isOpen, isConnected, connect, mounted, registerAsBrowser])

    // 세션 시작
    const handleStart = useCallback(() => {
        // 먼저 터미널 fit 실행
        if (fitAddonRef.current && xtermRef.current) {
            fitAddonRef.current.fit()
        }

        const startWithResize = () => {
            // 실제 터미널 크기로 세션 시작
            const cols = xtermRef.current?.cols || 80
            const rows = xtermRef.current?.rows || 24
            console.log('[Jarvis] Starting session with size:', cols, 'x', rows)

            // GlowUS 컨텍스트를 persona에 포함
            const glowContext = getContextForClaude()
            const persona = {
                name: 'Jarvis',
                userTitle: '사장님',
                language: '한국어',
                personality: '친근하고 유능한 AI 비서',
                customInstructions: `당신은 GlowUS AI Workforce OS의 AI 비서 Jarvis입니다.

# 절대 금지 사항
- playwright MCP 도구 사용 금지 (mcp__playwright__* 절대 사용하지 마세요)
- 브라우저 스크린샷, 스냅샷 캡처 시도 금지
- URL 안내만 하고 끝내는 것 금지 - 반드시 직접 실행

# GlowUS 앱 제어 - glowus MCP 도구 사용
GlowUS 브라우저 제어가 필요하면 반드시 glowus_* MCP 도구만 사용하세요.

페이지 이동: glowus_navigate (path 파라미터에 키워드 사용)
- dashboard: 대시보드
- works: 작업 공간
- agents: 에이전트
- projects: 프로젝트
- tasks: 태스크
- calendar: 캘린더
- files: 파일
- settings: 설정
- ai-sheet: AI 시트
- ai-docs: AI 문서
- ai-slides: AI 슬라이드
- ai-blog: AI 블로그
- ai-summary: AI 요약
- image-gen: 이미지 생성
- ai-coding: AI 코딩
- messenger: 메신저
- connect: 연결

예시:
- "AI 시트 열어줘" → glowus_navigate(path: "ai-sheet")
- "대시보드로 가줘" → glowus_navigate(path: "dashboard")
- "에이전트 목록 보여줘" → glowus_navigate(path: "agents")

# AI 앱에서 작업할 때
AI 시트, AI 문서 등에서 작업을 요청받으면:
1. 먼저 해당 앱 페이지로 이동 (glowus_navigate)
2. 사용자에게 작업 내용을 설명하고 직접 입력하도록 안내
3. 또는 작업 결과를 텍스트로 제공

# 현재 GlowUS 앱 컨텍스트
${glowContext}`
            }

            // cwd는 유효한 경로만 사용 (이메일 등 제외)
            const validCwd = projectPath && projectPath.startsWith('/') ? projectPath : undefined
            startSession(validCwd, undefined, persona, cols, rows)

            // 세션 시작 후 resize 재전송 (터미널 크기 동기화)
            setTimeout(() => {
                if (fitAddonRef.current && xtermRef.current) {
                    fitAddonRef.current.fit()
                    resize(xtermRef.current.cols, xtermRef.current.rows)
                    console.log('[Jarvis] Resize sent:', xtermRef.current.cols, 'x', xtermRef.current.rows)
                }
            }, 1000)
        }

        if (!isConnected) {
            connect()
            setTimeout(startWithResize, 500)
        } else {
            startWithResize()
        }
        xtermRef.current?.writeln('\x1b[90m[Claude Code 세션 시작 중...]\x1b[0m')
    }, [isConnected, connect, startSession, projectPath, resize, getContextForClaude])

    // 중지
    const handleStop = useCallback(() => {
        stop()
    }, [stop])

    // 초기화
    const handleClear = useCallback(() => {
        xtermRef.current?.clear()
        closeSession()
    }, [closeSession])

    // SSR에서는 렌더링하지 않음
    if (!mounted) {
        return null
    }

    return (
        <>
            <div
                className={cn(
                    "fixed right-0 top-12 border-l z-[90]",
                    "transform transition-all duration-300 ease-in-out",
                    "flex flex-col",
                    isDark
                        ? "bg-[#1a1a1a] border-zinc-800 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]"
                        : "bg-white border-zinc-200 shadow-[-10px_0_30px_rgba(0,0,0,0.1)]",
                    isOpen ? "translate-x-0" : "translate-x-full",
                    isExpanded ? "w-[600px]" : "w-[420px]"
                )}
                style={{ height: 'calc(100vh - 48px)' }}
            >
                {/* 헤더 */}
                <div className={cn(
                    "h-12 flex items-center justify-between px-3 border-b flex-shrink-0",
                    isDark ? "border-zinc-800 bg-[#1a1a1a]" : "border-zinc-200 bg-white"
                )}>
                    <div className="flex items-center gap-2">
                        <SparkIcon className="w-5 h-5" style={{ color: CLAUDE_ORANGE }} />
                        <div>
                            <h2 className={cn("text-sm font-semibold", isDark ? "text-white" : "text-zinc-900")}>
                                Jarvis
                            </h2>
                            <div className="flex items-center gap-1.5">
                                {isConnected ? (
                                    <Wifi className="w-3 h-3 text-green-500" />
                                ) : (
                                    <WifiOff className="w-3 h-3 text-zinc-500" />
                                )}
                                <p className="text-[10px] text-zinc-500 truncate max-w-[120px]">
                                    {currentPageTitle || (isConnected ? (isRunning ? 'Running' : 'Ready') : 'Disconnected')}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                        {!isRunning ? (
                            <button
                                onClick={handleStart}
                                className={cn(
                                    "p-1.5 rounded-md transition-colors",
                                    isDark ? "hover:bg-zinc-800 text-green-400" : "hover:bg-zinc-200 text-green-600"
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
                                    isDark ? "hover:bg-zinc-800 text-red-400" : "hover:bg-zinc-200 text-red-600"
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
                                isDark ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-zinc-200 text-zinc-600"
                            )}
                            title="초기화"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className={cn(
                                "p-1.5 rounded-md transition-colors",
                                isDark ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-zinc-200 text-zinc-600"
                            )}
                            title={isExpanded ? "축소" : "확대"}
                        >
                            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={onToggle}
                            className={cn(
                                "p-1.5 rounded-md transition-colors",
                                isDark ? "hover:bg-zinc-800" : "hover:bg-zinc-200"
                            )}
                        >
                            <X className={cn("w-4 h-4", isDark ? "text-zinc-500 hover:text-white" : "text-zinc-400 hover:text-zinc-900")} />
                        </button>
                    </div>
                </div>

                {/* 프로젝트 경로 */}
                <div className={cn(
                    "px-3 py-2 border-b flex-shrink-0",
                    isDark ? "border-zinc-800/50 bg-zinc-900/30" : "border-zinc-100 bg-zinc-50"
                )}>
                    <div className="flex items-center gap-2">
                        <FolderOpen className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                        <input
                            type="text"
                            value={projectPath}
                            onChange={(e) => setProjectPath(e.target.value)}
                            placeholder="프로젝트 경로 (예: /Users/...)"
                            className={cn(
                                "flex-1 bg-transparent text-xs focus:outline-none min-w-0",
                                isDark ? "text-zinc-400 placeholder:text-zinc-600" : "text-zinc-600 placeholder:text-zinc-400"
                            )}
                        />
                    </div>
                    {currentCwd && currentCwd !== projectPath && (
                        <p className="text-[10px] text-zinc-500 mt-1 truncate">현재: {currentCwd}</p>
                    )}
                </div>

                {/* 에러 표시 */}
                {error && (
                    <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 flex-shrink-0">
                        <p className="text-xs text-red-500">{error}</p>
                    </div>
                )}

                {/* 터미널 */}
                <div
                    ref={terminalRef}
                    className={cn(
                        "flex-1 overflow-hidden",
                        isDark ? "bg-[#1a1a1a]" : "bg-white"
                    )}
                    style={{ padding: '8px', minHeight: '200px' }}
                />

                {/* 하단 상태바 */}
                <div className={cn(
                    "h-6 flex items-center justify-between px-3 border-t text-[10px] flex-shrink-0",
                    isDark ? "border-zinc-800 bg-zinc-900/50 text-zinc-500" : "border-zinc-200 bg-zinc-50 text-zinc-400"
                )}>
                    <span>
                        {isRunning ? '● Running' : isConnected ? '○ Connected' : '○ Disconnected'}
                    </span>
                    <span>
                        Jarvis powered by Claude Code
                    </span>
                </div>
            </div>

            {/* 권한 승인 모달 */}
            <PermissionModal
                requests={pendingPermissions}
                onApprove={approvePermission}
                onDeny={denyPermission}
                onApproveAll={approveAllPermissions}
            />
        </>
    )
}
