'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useGlowCodeStore } from '@/stores/glowCodeStore'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Code2,
  Paperclip,
  ArrowUp,
  X,
  Terminal,
  Loader2,
  Command,
  Check,
  FileText,
  Shield,
  ShieldCheck,
  ShieldOff,
  Image as ImageIcon,
  FolderOpen,
  FolderCog,
  Square,
  Zap,
  Users,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import {
  executeSlashCommand,
  getCommandSuggestions,
  parseSlashCommand,
  type CommandContext,
  type CommandResult,
} from '@/lib/glow-code/slash-commands'
import { useApprovalStore } from '@/lib/glow-code/approval-system'
import { ApprovalModal, ApprovalBadge } from '@/components/glow-code/ApprovalModal'
import { useAIThreadSync } from '@/hooks/useAIThreadSync'
import { emitAgentSpawnEvent, emitAgentUpdateEvent } from '@/lib/agent/agent-mode'
import { AgentTabs, useAgentTabsStore, type AgentTabsStore } from '@/components/glow-code/AgentTabs'

// 🔥 Agent Team 백그라운드 실행 함수 (비블로킹)
async function runAgentTeamInBackground(
  userRequest: string,
  cwd: string,
  store: AgentTabsStore,
  chatActions: {
    addMessage: (msg: any) => void
    getMessages: () => any[]
    updateMessage: (id: string, updates: any) => void
    setStreamContent: (content: string) => void
  }
) {
  try {
    const response = await fetch('/api/glow-code/agent-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userRequest, cwd }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API 오류: ${response.status} - ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('스트림을 읽을 수 없습니다')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue

        try {
          const data = JSON.parse(line.slice(6))

          switch (data.type) {
            case 'agents_init':
              // 에이전트 탭 추가
              for (const agent of data.agents) {
                store.addTab({
                  id: agent.id,
                  name: agent.name,
                  role: agent.role,
                  task: agent.task,
                  status: 'idle',
                })
              }
              // 채팅에 팀 구성 알림
              chatActions.addMessage({
                role: 'assistant',
                content: `## 👥 에이전트 팀 구성 완료\n\n${data.agents.map((a: any) => `- **${a.name}** (${a.role}): ${a.task}`).join('\n')}\n\n각 에이전트가 병렬로 작업을 시작합니다...`,
                isStreaming: false
              })
              break

            case 'agent_status':
              store.updateTab(data.agentId, {
                status: data.status,
                progress: data.progress || 0,
                ...(data.status === 'complete' || data.status === 'error'
                  ? { endTime: Date.now() }
                  : {})
              })
              if (data.status === 'error' && data.error) {
                store.addMessage(data.agentId, { type: 'text', content: `❌ 오류: ${data.error}` })
              }
              break

            case 'agent_output':
              store.updateTab(data.agentId, { progress: data.progress || 0 })
              if (data.data?.error || (typeof data.data?.content === 'string' && data.data.content.includes('error'))) {
                const errContent = data.data?.error || data.data?.content
                store.addMessage(data.agentId, { type: 'text', content: `⚠️ ${errContent}` })
              }
              break

            case 'agent_log':
              store.addMessage(data.agentId, { type: 'text', content: data.log })
              break

            case 'all_complete':
              const currentTabs = useAgentTabsStore.getState().tabs
              const errorTabs = currentTabs.filter(t => t.status === 'error')
              const completeTabs = currentTabs.filter(t => t.status === 'complete')

              let completeMsg = ''
              if (errorTabs.length > 0) {
                completeMsg = `## ⚠️ 작업 완료 (일부 오류)\n\n✅ 성공: ${completeTabs.length}개\n❌ 실패: ${errorTabs.length}개`
              } else {
                completeMsg = `## ✅ 모든 에이전트 작업 완료\n\n${currentTabs.map(t => `- **${t.name}**: 완료`).join('\n')}`
              }
              chatActions.addMessage({ role: 'assistant', content: completeMsg, isStreaming: false })
              break
          }
        } catch (e) {
          // JSON 파싱 에러 무시
        }
      }
    }
  } catch (error: any) {
    console.error('[Agent Mode] Background error:', error)
    chatActions.addMessage({
      role: 'assistant',
      content: `## ❌ 에이전트 팀 오류\n\n${error.message}\n\n**해결 방법:**\n- Claude CLI 설치 확인: \`claude --version\`\n- 프로젝트 경로 확인`,
      isStreaming: false
    })
    useAgentTabsStore.getState().clearTabs()
  }
}

// Claude Code 브랜드 색상
const CLAUDE_ORANGE = '#D97757'

// Spark 아이콘 (Claude Code 로고)
const SparkIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
    <path d="M12 2L13.09 8.26L18 6L15.74 10.91L22 12L15.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L8.26 13.09L2 12L8.26 10.91L6 6L10.91 8.26L12 2Z" />
  </svg>
)

// 픽셀 마스코트 (Claude Code 오리지널)
const PixelMascot = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 22 13" className={className}>
    {/* Ears - 양옆으로 돌출 (눈 아래) */}
    <rect x="1" y="4" width="2" height="3" fill={CLAUDE_ORANGE} />
    <rect x="19" y="4" width="2" height="3" fill={CLAUDE_ORANGE} />
    {/* Body - 메인 몸통 (더 크게) */}
    <rect x="3" y="0" width="16" height="10" fill={CLAUDE_ORANGE} />
    {/* Eyes - 넓게 퍼짐 */}
    <rect x="5" y="4" width="2" height="2" fill="#2a2a2a" />
    <rect x="15" y="4" width="2" height="2" fill="#2a2a2a" />
    {/* Legs - 짧게 */}
    <rect x="4" y="10" width="2" height="3" fill={CLAUDE_ORANGE} />
    <rect x="7" y="10" width="2" height="3" fill={CLAUDE_ORANGE} />
    <rect x="13" y="10" width="2" height="3" fill={CLAUDE_ORANGE} />
    <rect x="16" y="10" width="2" height="3" fill={CLAUDE_ORANGE} />
  </svg>
)

// 🔥 메시지 타입 정의
interface StreamEvent {
  type: 'thinking' | 'tool' | 'tool_result' | 'status' | 'text'
  content?: string
  name?: string
  input?: any
  id?: string
  toolUseId?: string
  isError?: boolean
}

// 🔥 현재 활성 이벤트 타입 (순차적 표시용)
type ActiveEventType = 'idle' | 'thinking' | 'tool' | 'responding'

// 🔥 Tool별 아이콘 및 색상
const TOOL_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  Read: { icon: '📖', color: 'text-blue-400', label: '파일 읽기' },
  Write: { icon: '📝', color: 'text-green-400', label: '파일 쓰기' },
  Edit: { icon: '✏️', color: 'text-yellow-400', label: '파일 편집' },
  Bash: { icon: '💻', color: 'text-purple-400', label: '명령 실행' },
  Glob: { icon: '🔍', color: 'text-cyan-400', label: '파일 검색' },
  Grep: { icon: '🔎', color: 'text-orange-400', label: '내용 검색' },
  LS: { icon: '📁', color: 'text-teal-400', label: '디렉토리 목록' },
  TodoWrite: { icon: '📋', color: 'text-pink-400', label: 'Todo 작성' },
  Task: { icon: '🎯', color: 'text-indigo-400', label: '작업 실행' },
  WebFetch: { icon: '🌐', color: 'text-sky-400', label: '웹 요청' },
  WebSearch: { icon: '🔍', color: 'text-emerald-400', label: '웹 검색' },
}

// 🔥 Tool 이벤트 컴포넌트 - Cursor/Windsurf 스타일
const ToolEventItem = ({
  event,
  result,
  isLatest
}: {
  event: StreamEvent
  result?: StreamEvent
  isLatest: boolean
}) => {
  const config = TOOL_CONFIG[event.name || ''] || { icon: '🔧', color: 'text-zinc-400', label: event.name }
  const [isOpen, setIsOpen] = useState(false)
  const hasResult = !!result
  const isError = result?.isError

  // 파일명 추출
  const fileName = event.input?.file_path?.split('/').pop() || ''
  const isFileOp = ['Read', 'Write', 'Edit', 'MultiEdit'].includes(event.name || '')

  return (
    <div className={cn(
      "my-1 rounded-lg overflow-hidden transition-all duration-200",
      isLatest && !hasResult ? "ring-1 ring-blue-500/50 bg-blue-500/5" : "bg-zinc-800/30"
    )}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-2 text-sm py-2 px-3 transition-colors text-left",
          hasResult ? (isError ? "text-red-400" : "text-zinc-300") : config.color
        )}
      >
        {/* 상태 아이콘 - 더 크고 눈에 띄게 */}
        <div className={cn(
          "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-sm",
          isLatest && !hasResult
            ? "bg-blue-500/20 text-blue-400"
            : hasResult
              ? (isError ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400")
              : "bg-zinc-700/50"
        )}>
          {isLatest && !hasResult ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : hasResult ? (
            <span>{isError ? '✗' : '✓'}</span>
          ) : (
            <span>{config.icon}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{config.label}</span>
            {isLatest && !hasResult && (
              <span className="text-xs text-blue-400 animate-pulse">실행 중...</span>
            )}
          </div>

          {/* 파일 정보 - 더 눈에 띄게 */}
          {isFileOp && fileName && (
            <div className="flex items-center gap-1 mt-0.5">
              <code className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                event.name === 'Write' ? "bg-green-500/10 text-green-400" :
                event.name === 'Edit' ? "bg-yellow-500/10 text-yellow-400" :
                "bg-zinc-700/50 text-zinc-400"
              )}>
                {fileName}
              </code>
              {event.name === 'Write' && <span className="text-xs text-green-500">+new</span>}
              {event.name === 'Edit' && <span className="text-xs text-yellow-500">modified</span>}
            </div>
          )}

          {/* Bash 명령어 */}
          {event.name === 'Bash' && event.input?.command && (
            <code className="text-xs text-purple-400 block mt-0.5 truncate">
              $ {event.input.command.substring(0, 40)}{event.input.command.length > 40 ? '...' : ''}
            </code>
          )}

          {/* 검색 패턴 */}
          {(event.name === 'Glob' || event.name === 'Grep') && event.input && (
            <code className="text-xs text-cyan-400 block mt-0.5">
              🔍 {(event.input.pattern || event.input.query || '').substring(0, 30)}
            </code>
          )}
        </div>

        <ChevronDown className={cn(
          "w-4 h-4 transition-transform flex-shrink-0 text-zinc-500",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <div className="border-t border-zinc-700/50 p-3 bg-zinc-900/50">
          {/* Tool Input Details */}
          {event.name === 'Write' && event.input?.file_path && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-400 text-xs">
                <span>📄</span>
                <span className="font-mono">{event.input.file_path}</span>
              </div>
              {event.input.content && (
                <pre className="text-xs text-zinc-500 bg-zinc-900 rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
                  {event.input.content.substring(0, 500)}{event.input.content.length > 500 ? '\n...' : ''}
                </pre>
              )}
            </div>
          )}

          {event.name === 'Edit' && event.input && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-yellow-400 text-xs">
                <span>✏️</span>
                <span className="font-mono">{event.input.file_path}</span>
              </div>
              <div className="grid gap-2 text-xs">
                {event.input.old_string && (
                  <div className="bg-red-500/10 rounded p-2 border-l-2 border-red-500">
                    <div className="text-red-400 mb-1">- 삭제</div>
                    <pre className="text-red-300/70 overflow-x-auto whitespace-pre-wrap">
                      {event.input.old_string.substring(0, 150)}{event.input.old_string.length > 150 ? '...' : ''}
                    </pre>
                  </div>
                )}
                {event.input.new_string && (
                  <div className="bg-green-500/10 rounded p-2 border-l-2 border-green-500">
                    <div className="text-green-400 mb-1">+ 추가</div>
                    <pre className="text-green-300/70 overflow-x-auto whitespace-pre-wrap">
                      {event.input.new_string.substring(0, 150)}{event.input.new_string.length > 150 ? '...' : ''}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {event.name === 'Read' && event.input?.file_path && (
            <div className="flex items-center gap-2 text-blue-400 text-xs">
              <span>📖</span>
              <span className="font-mono">{event.input.file_path}</span>
            </div>
          )}

          {event.name === 'Bash' && event.input?.command && (
            <div className="bg-zinc-900 rounded p-2 font-mono text-sm">
              <span className="text-purple-400">$ </span>
              <span className="text-zinc-300">{event.input.command}</span>
            </div>
          )}

          {/* Tool Result */}
          {result && (
            <div className={cn(
              "mt-2 text-xs font-mono rounded p-2 max-h-24 overflow-y-auto",
              isError ? "bg-red-900/30 text-red-300 border border-red-500/30" : "bg-zinc-900/50 text-zinc-400"
            )}>
              <div className="text-zinc-500 mb-1">{isError ? '❌ Error:' : '✅ Result:'}</div>
              {typeof result.content === 'string'
                ? result.content.substring(0, 300)
                : JSON.stringify(result.content).substring(0, 300)}
              {(typeof result.content === 'string' ? result.content.length : 0) > 300 && '...'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Message Component
const MessageBubble = ({
  role,
  content,
  isStreaming,
  streamEvents = [],
  startTime,
  tokenCount = 0
}: {
  role: 'user' | 'assistant' | 'system'
  content: string
  isStreaming?: boolean
  streamEvents?: StreamEvent[]
  startTime?: number
  tokenCount?: number
}) => {
  // 🔥 실시간 경과 시간 계산
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    if (!isStreaming || !startTime) {
      setElapsedTime(0)
      return
    }

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [isStreaming, startTime])
  // 🔥 이벤트 분류
  const hasThinking = streamEvents.some(e => e.type === 'thinking')
  const toolEvents = streamEvents.filter(e => e.type === 'tool')
  const toolResults = streamEvents.filter(e => e.type === 'tool_result')
  const latestToolId = toolEvents[toolEvents.length - 1]?.id
  const hasContent = content.trim().length > 0

  // 🔥 tool_result를 해당 tool에 매핑
  const getResultForTool = (toolId?: string) => {
    if (!toolId) return undefined
    return toolResults.find(r => r.toolUseId === toolId)
  }

  // 🔥 현재 상태: idle → thinking → tool → responding
  const currentPhase: ActiveEventType = isStreaming
    ? (hasContent ? 'responding' : (toolEvents.length > 0 ? 'tool' : (hasThinking ? 'thinking' : 'idle')))
    : 'idle'

  // 🔥 스트리밍 시작했지만 아직 아무 이벤트도 없는 상태 (처음 2초만)
  const isInitialLoading = isStreaming && !hasThinking && toolEvents.length === 0 && !hasContent && elapsedTime < 3

  return (
    <div className={cn(
      "px-4 py-3",
      role === 'user' ? "bg-zinc-800/50" : ""
    )}>
      <div className="flex items-start gap-3">
        {role === 'assistant' && (
          <div className="relative mt-0.5 flex-shrink-0">
            {/* 🔥 주황색 깜빡이는 점 (스트리밍 중일 때) */}
            {isStreaming ? (
              <div className="relative">
                <div
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: CLAUDE_ORANGE }}
                />
                <div
                  className="absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-75"
                  style={{ backgroundColor: CLAUDE_ORANGE }}
                />
              </div>
            ) : (
              <SparkIcon className="w-5 h-5" style={{ color: CLAUDE_ORANGE }} />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {/* 🔥 스트리밍 헤더 - 시간 + 토큰 */}
          {isStreaming && role === 'assistant' && (
            <div className="flex items-center gap-2 mb-2 text-xs">
              <span className="text-zinc-400">
                {toolEvents.length > 0
                  ? `${toolEvents[toolEvents.length - 1]?.name || 'Working'}...`
                  : hasThinking
                    ? 'Thinking...'
                    : 'Connecting...'}
              </span>
              <span className="text-zinc-600">
                ({elapsedTime}s · ↓ {tokenCount.toLocaleString()} tokens)
              </span>
            </div>
          )}

          {/* 🔥 초기 로딩 상태 - 연결 중 */}
          {isInitialLoading && (
            <div className="my-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                </div>
                <div>
                  <div className="text-zinc-300 font-medium text-sm">Claude Code 연결 중...</div>
                  <div className="text-zinc-500 text-xs">잠시만 기다려주세요</div>
                </div>
              </div>
            </div>
          )}

          {/* 🔥 Thinking - Cursor/Windsurf 스타일 */}
          {isStreaming && hasThinking && currentPhase === 'thinking' && (
            <div className="my-3 p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <span className="text-lg">🧠</span>
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-purple-400/50 animate-ping" />
                </div>
                <div>
                  <div className="text-purple-300 font-medium text-sm">생각하는 중...</div>
                  <div className="text-purple-400/60 text-xs">코드를 분석하고 최적의 방법을 찾고 있어요</div>
                </div>
              </div>
            </div>
          )}

          {/* 🔥 Tool 사용 - 순차적 표시, 결과와 연결 */}
          {toolEvents.length > 0 && (
            <div className="my-2">
              {toolEvents.map((e, i) => (
                <ToolEventItem
                  key={`tool-${e.id || i}`}
                  event={e}
                  result={getResultForTool(e.id)}
                  isLatest={!!(isStreaming && e.id === latestToolId && !getResultForTool(e.id))}
                />
              ))}
            </div>
          )}

          {/* 🔥 현재 Status - 더 눈에 띄게 */}
          {isStreaming && (() => {
            const latestStatus = streamEvents.filter(e => e.type === 'status').pop()
            return latestStatus ? (
              <div className="flex items-center gap-2 text-blue-400 text-sm my-2 py-1.5 px-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{latestStatus.content}</span>
              </div>
            ) : null
          })()}

          {/* 텍스트 응답 */}
          {(hasContent || !isStreaming) && (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{content || (isStreaming ? '' : '응답 없음')}</ReactMarkdown>
            </div>
          )}

          {/* 커서 */}
          {isStreaming && hasContent && (
            <span className="inline-block w-2 h-4 bg-zinc-400 animate-pulse ml-1" />
          )}
        </div>
      </div>
    </div>
  )
}

// Main Chat Component
export function ClaudeCodeUI() {
  const {
    settings,
    threads,
    activeThreadId,
    getMessages,
    addMessage,
    updateMessage,
    createThread,
    clearMessages,
    streamContent,
    setStreamContent,
    clearStreamContent,
    streamEvents,
    addStreamEvent,
    clearStreamEvents,
    updateSettings,
    context,
    setContext,
    getOrCreateThreadForProject, // 🔥 프로젝트별 스레드 관리
  } = useGlowCodeStore()

  // 🔥 NeuralMapStore에서 프로젝트 경로 가져오기 (현재 메뉴의 프로젝트 컨텍스트)
  const neuralMapProjectPath = useNeuralMapStore((state) => state.projectPath)
  const linkedProjectId = useNeuralMapStore((state) => state.linkedProjectId)
  const linkedProjectName = useNeuralMapStore((state) => state.linkedProjectName)
  const setNeuralMapProjectPath = useNeuralMapStore((state) => state.setProjectPath)

  // 🔥 승인 시스템 스토어
  const {
    activeRequest: approvalRequest,
    setActiveRequest: setApprovalRequest,
  } = useApprovalStore()

  // 🔥 DB 동기화 훅
  const { addMessageWithSync, updateThreadTitleWithSync } = useAIThreadSync()

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  // 🔥 실시간 토큰 카운트 및 스트리밍 시작 시간
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null)
  const [streamTokenCount, setStreamTokenCount] = useState(0)
  // 🔥 대기열 메시지 (에이전트 작업 중 미리 입력)
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null)
  // 🔥 IME 조합 상태 추적 (한글 입력 시 마지막 글자 중복 방지)
  const [isComposing, setIsComposing] = useState(false)
  const [showPastConversations, setShowPastConversations] = useState(false)
  const [showTerminalBanner, setShowTerminalBanner] = useState(true)
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  // 🔥 Permission mode dropdown
  const [showPermissionMenu, setShowPermissionMenu] = useState(false)
  // 🔥 Model selector modal
  const [showModelSelector, setShowModelSelector] = useState(false)
  const modelSelectorRef = useRef<HTMLDivElement>(null)
  // 🔥 Project path popup
  const [showProjectPathInput, setShowProjectPathInput] = useState(false)
  const [projectPathInput, setProjectPathInput] = useState('')
  const projectPathInputRef = useRef<HTMLInputElement>(null)
  // 🔥 Attached files
  const [attachedFiles, setAttachedFiles] = useState<Array<{
    name: string
    content: string
    type: 'text' | 'image'
  }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const permissionMenuRef = useRef<HTMLDivElement>(null)
  const inputAreaRef = useRef<HTMLDivElement>(null)
  const projectPathButtonRef = useRef<HTMLButtonElement>(null)
  const permissionButtonRef = useRef<HTMLButtonElement>(null)
  // 🔥 Tool 이벤트 추적 (파일 변경 감지용)
  const pendingToolsRef = useRef<Map<string, { name: string; input: any }>>(new Map())

  // 🔥 Portal mount state
  const [portalMounted, setPortalMounted] = useState(false)
  useEffect(() => {
    setPortalMounted(true)
  }, [])

  // 🔥 NeuralMapStore의 프로젝트 경로와 자동 동기화
  // 각 메뉴의 채팅 에이전트는 해당 메뉴의 프로젝트 경로를 자동으로 사용
  // 🔥 Cursor/Windsurf 스타일: 프로젝트 변경 시 해당 프로젝트의 이전 대화 복원
  const setActiveThread = useGlowCodeStore((state) => state.setActiveThread)
  useEffect(() => {
    if (neuralMapProjectPath) {
      // 프로젝트 경로가 있으면 해당 프로젝트의 스레드로 전환
      setContext({ projectPath: neuralMapProjectPath })
      console.log('[GlowCode] 🔄 프로젝트 경로 동기화:', neuralMapProjectPath)

      // 🔥 프로젝트 경로로 기존 스레드 찾거나 새로 생성 (이전 대화 복원)
      getOrCreateThreadForProject(neuralMapProjectPath)
    } else if (!activeThreadId && threads.length > 0) {
      // 프로젝트 경로가 없고 활성 스레드도 없으면 가장 최근 스레드 선택
      console.log('[GlowCode] 🔄 자동으로 마지막 스레드 선택:', threads[0].id)
      setActiveThread(threads[0].id)
    }
  }, [neuralMapProjectPath, activeThreadId, threads, setContext, getOrCreateThreadForProject, setActiveThread])

  // 🔥 프로젝트 연결 시 DB에서 folder_path 자동 가져오기
  // linkedProjectId가 있는데 projectPath가 없으면 DB에서 folder_path 조회
  useEffect(() => {
    if (linkedProjectId && !neuralMapProjectPath) {
      console.log('[GlowCode] 🔍 프로젝트 folder_path 조회 중:', linkedProjectId)
      fetch(`/api/projects/${linkedProjectId}`)
        .then(res => res.ok ? res.json() : null)
        .then(project => {
          if (project?.folder_path) {
            console.log('[GlowCode] ✅ folder_path 자동 설정:', project.folder_path)
            setNeuralMapProjectPath(project.folder_path)
          }
        })
        .catch(err => {
          console.error('[GlowCode] folder_path 조회 실패:', err)
        })
    }
  }, [linkedProjectId, neuralMapProjectPath, setNeuralMapProjectPath])

  const messages = getMessages()

  // 🔥 프로젝트 경로 필수 체크 - 코딩 에이전트는 프로젝트 컨텍스트 없이 작동하면 안 됨
  const hasProjectContext = !!(context.projectPath || neuralMapProjectPath)

  // 🔥 슬래시 명령어 자동완성
  const commandSuggestions = useMemo(() => {
    if (!input.startsWith('/') || input.includes(' ')) return []
    return getCommandSuggestions(input)
  }, [input])

  useEffect(() => {
    setShowCommandSuggestions(commandSuggestions.length > 0)
    setSelectedSuggestionIndex(0)
  }, [commandSuggestions])

  // 🔥 슬래시 명령어 컨텍스트 (스토어 함수 직접 참조로 최신 상태 보장)
  const slashCommandContext: CommandContext = useMemo(() => ({
    cwd: context.projectPath || undefined,
    sessionId: null, // TODO: 세션 ID 관리
    currentFile: context.currentFile || context.activeFile?.path,
    selectedCode: context.selectedCode,
    clearMessages,
    addMessage,
    setContext: (ctx) => setContext(ctx as any),
    updateSettings: (s) => {
      console.log('[GlowCodeChat] slashCommandContext.updateSettings 호출:', s)
      useGlowCodeStore.getState().updateSettings(s as any)
    },
  }), [context, clearMessages, addMessage, setContext])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamContent, streamEvents])

  // 🔥 대기열 메시지 자동 전송용 ref (클로저 문제 방지)
  const queuedMessageRef = useRef<string | null>(null)

  // 🔥 대기열 메시지 ref 동기화
  useEffect(() => {
    queuedMessageRef.current = queuedMessage
  }, [queuedMessage])

  // 🔥 대기열 메시지 자동 전송 (에이전트 작업 완료 후)
  useEffect(() => {
    if (!isLoading && queuedMessage) {
      const messageToSend = queuedMessage
      console.log('[GlowCode] 📤 Sending queued message:', messageToSend.substring(0, 50))

      // 🔥 대기열 먼저 클리어 (중복 전송 방지)
      setQueuedMessage(null)

      // 약간의 딜레이 후 input 설정 및 전송
      setTimeout(() => {
        setInput(messageToSend)
        // 🔥 다음 틱에서 전송 (input 상태 업데이트 보장)
        setTimeout(() => {
          const sendButton = document.querySelector('[data-send-button]') as HTMLButtonElement
          sendButton?.click()
        }, 50)
      }, 100)
    }
  }, [isLoading, queuedMessage])

  // 🔥 Click outside to close permission menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (permissionMenuRef.current && !permissionMenuRef.current.contains(e.target as Node)) {
        setShowPermissionMenu(false)
      }
    }
    if (showPermissionMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPermissionMenu])

  // 🔥 Click outside to close project path popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (projectPathInputRef.current && !projectPathInputRef.current.closest('.relative')?.contains(e.target as Node)) {
        setShowProjectPathInput(false)
      }
    }
    if (showProjectPathInput) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showProjectPathInput])

  // 🔥 Click outside to close model selector
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(e.target as Node)) {
        setShowModelSelector(false)
      }
    }
    if (showModelSelector) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showModelSelector])

  // 🔥 File attachment handler
  const handleFileAttach = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach(file => {
      const isImage = file.type.startsWith('image/')

      if (isImage) {
        // 이미지는 base64로 변환
        const reader = new FileReader()
        reader.onload = () => {
          setAttachedFiles(prev => [...prev, {
            name: file.name,
            content: reader.result as string,
            type: 'image'
          }])
        }
        reader.readAsDataURL(file)
      } else {
        // 텍스트 파일 읽기
        const reader = new FileReader()
        reader.onload = () => {
          setAttachedFiles(prev => [...prev, {
            name: file.name,
            content: reader.result as string,
            type: 'text'
          }])
        }
        reader.readAsText(file)
      }
    })

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // 🔥 Remove attached file
  const removeAttachedFile = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  // 🔥 파일 변경 이벤트 발생 함수 (실시간 파일 트리 업데이트용)
  const emitFileChangeEvent = useCallback((filePath: string, changeType: 'create' | 'change' | 'delete') => {
    console.log('[GlowCode] 📁 File change event:', changeType, filePath)
    // Electron 환경에서는 파일 시스템 감시자가 자동으로 이벤트를 발생시키지만,
    // 웹 환경에서는 직접 이벤트를 발생시켜야 함
    window.dispatchEvent(new CustomEvent('glowus:file-changed', {
      detail: { path: filePath, type: changeType }
    }))
  }, [])

  // 🔥 Tool 결과 처리 시 파일 변경 감지
  const handleToolResult = useCallback((toolUseId: string, isError: boolean) => {
    console.log('[GlowCode] 🔧 handleToolResult called:', toolUseId, 'isError:', isError)
    console.log('[GlowCode] 📋 pendingToolsRef contents:', Array.from(pendingToolsRef.current.entries()))

    const toolInfo = pendingToolsRef.current.get(toolUseId)
    if (!toolInfo) {
      console.log('[GlowCode] ⚠️ No tool info found for:', toolUseId)
      return
    }

    console.log('[GlowCode] 📝 Tool info:', toolInfo.name, toolInfo.input?.file_path)

    // 에러가 아니고 Write/Edit 도구인 경우 파일 변경 이벤트 발생
    if (!isError && toolInfo.input?.file_path) {
      if (toolInfo.name === 'Write') {
        console.log('[GlowCode] ✅ Emitting file create event:', toolInfo.input.file_path)
        emitFileChangeEvent(toolInfo.input.file_path, 'create')
      } else if (toolInfo.name === 'Edit') {
        console.log('[GlowCode] ✅ Emitting file change event:', toolInfo.input.file_path)
        emitFileChangeEvent(toolInfo.input.file_path, 'change')
      }
    }

    // 처리 완료된 도구 정보 삭제
    pendingToolsRef.current.delete(toolUseId)
  }, [emitFileChangeEvent])

  // Handle /login command - CLI opens OAuth automatically
  const handleLogin = async () => {
    try {
      await fetch('/api/glow-code/login', { method: 'POST' })
    } catch (e) {
      // CLI handles everything
    }
  }

  // 🔥 슬래시 명령어 결과를 프롬프트로 전송
  const sendPromptToClaudeCode = useCallback(async (prompt: string) => {
    setIsLoading(true)
    clearStreamContent()
    clearStreamEvents()
    // 🔥 스트리밍 시작 시간 및 토큰 카운트 초기화
    setStreamStartTime(Date.now())
    setStreamTokenCount(0)

    addMessage({ role: 'user', content: prompt })
    addMessage({ role: 'assistant', content: '', isStreaming: true })

    try {
      const apiMessages = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: prompt }
      ]

      const requestContext = context.selectedCode ? {
        fileName: context.currentFile || context.activeFile?.name,
        selectedCode: context.selectedCode,
        language: context.activeFile?.name?.split('.').pop() || 'text'
      } : undefined

      const response = await fetch('/api/glow-code/cli-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          options: {
            model: settings.model !== 'custom' ? settings.model : settings.customModelId,
            cwd: context.projectPath || undefined,
            includeProjectContext: settings.includeProjectContext,
            executionMode: settings.executionMode, // 🔥 Agent Mode 전달
          },
          context: requestContext
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '요청 실패')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                switch (data.type) {
                  case 'text':
                    fullContent = data.content
                    setStreamContent(fullContent)
                    // 🔥 토큰 카운트 업데이트 (대략적 계산: 4자당 1토큰)
                    setStreamTokenCount(Math.floor(fullContent.length / 4))
                    break
                  case 'thinking':
                    addStreamEvent({ type: 'thinking', content: data.content })
                    break
                  case 'tool':
                    console.log('[GlowCode/Prompt] 🛠️ Tool event:', data.name, data.id, data.input?.file_path)
                    addStreamEvent({ type: 'tool', name: data.name, input: data.input, id: data.id })
                    // 🔥 Write/Edit 도구는 바로 파일 변경 이벤트 발생 (tool_result 기다리지 않음)
                    if (data.input?.file_path && (data.name === 'Write' || data.name === 'Edit')) {
                      console.log('[GlowCode/Prompt] 📂 Emitting file change from tool event:', data.name, data.input.file_path)
                      emitFileChangeEvent(data.input.file_path, data.name === 'Write' ? 'create' : 'change')
                    }
                    break
                  case 'tool_result':
                    console.log('[GlowCode/Prompt] 📦 Tool result:', data.toolUseId, 'isError:', data.isError)
                    addStreamEvent({ type: 'tool_result', content: data.content, toolUseId: data.toolUseId, isError: data.isError })
                    // 🔥 파일 변경 이벤트 발생
                    if (data.toolUseId) {
                      handleToolResult(data.toolUseId, data.isError)
                    }
                    break
                  case 'status':
                  case 'progress':
                    addStreamEvent({ type: 'status', content: data.content })
                    break
                  case 'result':
                    if (data.content) {
                      fullContent = data.content
                      setStreamContent(fullContent)
                    }
                    break
                  case 'error':
                    addStreamEvent({ type: 'tool_result', content: data.content, isError: true })
                    break
                }
              } catch (e) {
                console.warn('[GlowCode/Prompt] Parse error:', e)
              }
            }
          }
        }
      }

      const msgs = getMessages()
      const lastMsg = msgs[msgs.length - 1]
      if (lastMsg && lastMsg.role === 'assistant') {
        updateMessage(lastMsg.id, { content: fullContent || '응답 없음', isStreaming: false })
      }
    } catch (error: any) {
      const msgs = getMessages()
      const lastMsg = msgs[msgs.length - 1]
      if (lastMsg && lastMsg.role === 'assistant') {
        updateMessage(lastMsg.id, { content: `Error: ${error.message}`, isStreaming: false })
      }
    } finally {
      setIsLoading(false)
      clearStreamContent()
      setStreamStartTime(null)
    }
  }, [messages, context, settings, addMessage, updateMessage, getMessages, setStreamContent, clearStreamContent, addStreamEvent, clearStreamEvents])

  // 🔥 슬래시 명령어 처리
  const handleSlashCommand = useCallback(async (result: CommandResult) => {
    switch (result.type) {
      case 'message':
        // 시스템 메시지로 표시
        addMessage({ role: 'assistant', content: result.content || '' })
        break
      case 'clear':
        clearMessages()
        if (result.content) {
          addMessage({ role: 'system', content: result.content })
        }
        break
      case 'settings':
        addMessage({ role: 'assistant', content: result.content || '설정이 변경되었습니다.' })
        break
      case 'prompt':
        // Claude Code로 프롬프트 전송
        if (result.prompt) {
          if (result.immediate) {
            await sendPromptToClaudeCode(result.prompt)
          } else {
            setInput(result.prompt)
          }
        }
        break
      case 'action':
        // 커스텀 액션 처리
        if ((result.data as any)?.action === 'showModelSelector') {
          setShowModelSelector(true)
        }
        break
    }
  }, [addMessage, clearMessages, sendPromptToClaudeCode])

  // 🔥 Stop/Cancel streaming
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsLoading(false)
    setStreamStartTime(null)

    // 스트리밍 중인 마지막 메시지 종료 처리
    const msgs = getMessages()
    const lastMsg = msgs[msgs.length - 1]
    if (lastMsg?.role === 'assistant' && lastMsg?.isStreaming) {
      updateMessage(lastMsg.id, {
        content: lastMsg.content + '\n\n[중단됨]',
        isStreaming: false
      })
    }

    console.log('[GlowCode] ⏹️ Streaming stopped by user')
  }, [getMessages, updateMessage])

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!input.trim()) return

    const userMessage = input.trim()
    setShowCommandSuggestions(false)

    // 🔥 에이전트가 작업 중이면 대기열에 추가
    if (isLoading) {
      setQueuedMessage(userMessage)
      setInput('')
      console.log('[GlowCode] 📋 Message queued:', userMessage.substring(0, 50))
      return
    }

    // Handle /login command (legacy)
    if (userMessage === '/login') {
      setInput('')
      handleLogin()
      return
    }

    // 🔥 슬래시 명령어 처리
    if (userMessage.startsWith('/')) {
      setInput('')
      const result = await executeSlashCommand(userMessage, slashCommandContext)
      if (result) {
        await handleSlashCommand(result)
        return
      }
    }

    setInput('')
    setIsLoading(true)
    clearStreamContent()
    clearStreamEvents()
    // 🔥 스트리밍 시작 시간 및 토큰 카운트 초기화
    setStreamStartTime(Date.now())
    setStreamTokenCount(0)

    // 🔥 첨부 파일 컨텍스트 추가
    let messageWithAttachments = userMessage
    if (attachedFiles.length > 0) {
      const attachmentContext = attachedFiles
        .filter(f => f.type === 'text')
        .map(f => `\n\n--- ${f.name} ---\n${f.content}`)
        .join('')
      if (attachmentContext) {
        messageWithAttachments = `${userMessage}\n\n첨부 파일:${attachmentContext}`
      }
    }
    const currentAttachedFiles = [...attachedFiles]
    setAttachedFiles([]) // 첨부 파일 초기화

    addMessage({ role: 'user', content: userMessage })

    // 🔥 DB에 사용자 메시지 저장
    if (activeThreadId) {
      addMessageWithSync(activeThreadId, 'user', userMessage).catch(console.error)
    }

    // 🔥 Team Mode: Orchestrator API 사용 (PM + 서브 에이전트 실시간 스트리밍)
    // Quick Mode: cli-proxy API 사용 (단일 CLI)

    if (settings.executionMode === 'agent') {
      // 에이전트 패널 초기화
      const store = useAgentTabsStore.getState()
      store.clearTabs()

      addMessage({ role: 'assistant', content: '', isStreaming: true })

      try {
        abortControllerRef.current = new AbortController()
        const signal = abortControllerRef.current.signal

        const response = await fetch('/api/glow-code/orchestrator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            userRequest: messageWithAttachments,
            cwd: context.projectPath || '',
            model: settings.model !== 'custom' ? settings.model : settings.customModelId,
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Orchestrator 오류: ${response.status} - ${errorText}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('스트림을 읽을 수 없습니다')

        const decoder = new TextDecoder()
        let buffer = ''
        let pmContent = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue

            try {
              const data = JSON.parse(line.slice(6))

              switch (data.type) {
                // PM 상태
                case 'pm_status':
                  if (data.status === 'started') {
                    addStreamEvent({ type: 'status', content: '🎯 PM(Project Manager) 분석 시작...' })
                  } else if (data.status === 'complete') {
                    addStreamEvent({ type: 'status', content: '✅ PM 작업 완료' })
                  } else if (data.status === 'error') {
                    addStreamEvent({ type: 'status', content: `❌ PM 오류: ${data.message}` })
                  }
                  break

                // PM 텍스트 응답
                case 'pm_text':
                  pmContent += data.content
                  setStreamContent(pmContent)
                  break

                // PM 도구 사용
                case 'pm_tool':
                  addStreamEvent({
                    type: 'tool',
                    name: data.name,
                    input: data.input,
                    id: data.id
                  })
                  break

                // 에이전트 spawn
                case 'agent_spawn':
                  console.log('[Orchestrator] Agent spawned:', data.agent)
                  store.addTab({
                    id: data.agent.id,
                    name: data.agent.name,
                    role: data.agent.role,
                    task: data.agent.task,
                    status: 'idle',
                  })
                  addStreamEvent({
                    type: 'status',
                    content: `🤖 ${data.agent.name} 시작: ${data.agent.task}`
                  })
                  break

                // 에이전트 상태
                case 'agent_status':
                  store.updateTab(data.agentId, {
                    status: data.status,
                    progress: data.progress || 0,
                    ...(data.status === 'complete' || data.status === 'error'
                      ? { endTime: Date.now() }
                      : {})
                  })
                  if (data.status === 'complete') {
                    addStreamEvent({ type: 'status', content: `✅ 에이전트 완료: ${data.agentId}` })
                  }
                  break

                // 에이전트 로그
                case 'agent_log':
                  store.addMessage(data.agentId, { type: 'text', content: data.log })
                  store.updateTab(data.agentId, { progress: data.progress || 0 })
                  break

                // 에이전트 도구 사용
                case 'agent_tool':
                  store.addMessage(data.agentId, {
                    type: 'tool',
                    content: `🔧 ${data.toolName}: ${JSON.stringify(data.toolInput).substring(0, 100)}`
                  })
                  store.updateTab(data.agentId, { progress: data.progress || 0, status: 'working' })
                  break

                // 에이전트 도구 결과
                case 'agent_tool_result':
                  store.addMessage(data.agentId, {
                    type: 'tool_result',
                    content: data.isError ? `❌ ${data.content}` : `✅ ${data.content}`
                  })
                  break

                // 오케스트레이터 완료
                case 'orchestrator_complete':
                  const tabs = store.tabs
                  const completedCount = tabs.filter(t => t.status === 'complete').length
                  const errorCount = tabs.filter(t => t.status === 'error').length
                  if (tabs.length > 0) {
                    pmContent += `\n\n---\n## 📊 작업 결과\n- 완료: ${completedCount}개\n- 오류: ${errorCount}개`
                    setStreamContent(pmContent)
                  }
                  break
              }
            } catch (e) {
              // JSON 파싱 에러 무시
            }
          }
        }

        // 스트리밍 완료
        const msgs = getMessages()
        const lastMsg = msgs[msgs.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          updateMessage(lastMsg.id, {
            content: pmContent || '작업 완료',
            isStreaming: false
          })
          if (activeThreadId && pmContent) {
            addMessageWithSync(activeThreadId, 'assistant', pmContent).catch(console.error)
          }
        }

      } catch (error: any) {
        const msgs = getMessages()
        const lastMsg = msgs[msgs.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          updateMessage(lastMsg.id, {
            content: `Error: ${error.message}`,
            isStreaming: false
          })
        }
      } finally {
        setIsLoading(false)
        clearStreamContent()
        setStreamStartTime(null)
      }

      return
    }

    // 🔥 Quick Mode: 기존 cli-proxy API 사용
    addMessage({ role: 'assistant', content: '', isStreaming: true })

    try {
      // 🔥 AbortController 생성 (Stop 버튼용)
      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal

      const apiMessages = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: messageWithAttachments }
      ]

      // 🔥 Monaco 선택 컨텍스트 포함
      const requestContext = context.selectedCode ? {
        fileName: context.currentFile || context.activeFile?.name,
        selectedCode: context.selectedCode,
        language: context.activeFile?.name?.split('.').pop() || 'text',
        attachedFiles: currentAttachedFiles.length > 0 ? currentAttachedFiles : undefined
      } : (currentAttachedFiles.length > 0 ? { attachedFiles: currentAttachedFiles } : undefined)

      const response = await fetch('/api/glow-code/cli-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          messages: apiMessages,
          options: {
            model: settings.model !== 'custom' ? settings.model : settings.customModelId,
            cwd: context.projectPath || process.cwd?.() || undefined,
            executionMode: 'quick',
          },
          context: requestContext
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '요청 실패')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                // 🔥 모든 이벤트 타입 처리
                switch (data.type) {
                  case 'text':
                    fullContent = data.content
                    setStreamContent(fullContent)
                    // 🔥 토큰 카운트 업데이트 (대략적 계산: 4자당 1토큰)
                    setStreamTokenCount(Math.floor(fullContent.length / 4))
                    break
                  case 'thinking':
                    addStreamEvent({ type: 'thinking', content: data.content })
                    break
                  case 'tool':
                    console.log('[GlowCode] 🛠️ Tool event received:', data.name, data.id, data.input?.file_path)
                    addStreamEvent({
                      type: 'tool',
                      name: data.name,
                      input: data.input,
                      id: data.id
                    })
                    // 🔥 Write/Edit 도구는 바로 파일 변경 이벤트 발생 (tool_result 기다리지 않음)
                    // CLI가 tool_result를 안 보내는 경우가 있어서 tool 이벤트에서 바로 처리
                    if (data.input?.file_path && (data.name === 'Write' || data.name === 'Edit')) {
                      console.log('[GlowCode] 📂 Emitting file change from tool event:', data.name, data.input.file_path)
                      emitFileChangeEvent(data.input.file_path, data.name === 'Write' ? 'create' : 'change')
                    }
                    break
                  case 'tool_result':
                    console.log('[GlowCode] 📦 Tool result received:', data.toolUseId, 'isError:', data.isError)
                    addStreamEvent({
                      type: 'tool_result',
                      content: data.content,
                      toolUseId: data.toolUseId,
                      isError: data.isError
                    })
                    // 🔥 파일 변경 이벤트 발생
                    if (data.toolUseId) {
                      handleToolResult(data.toolUseId, data.isError)

                      // 🔥 Agent Panel: Task 도구 결과로 에이전트 상태 업데이트
                      const agentStore = useAgentTabsStore.getState()
                      const agentTab = agentStore.tabs.find(t => t.id === data.toolUseId)
                      if (agentTab) {
                        agentStore.updateTab(data.toolUseId, {
                          status: data.isError ? 'error' : 'complete',
                          progress: 100,
                          endTime: Date.now()
                        })
                        // 결과를 에이전트 메시지에 추가
                        if (data.content) {
                          const resultText = typeof data.content === 'string'
                            ? data.content
                            : JSON.stringify(data.content).substring(0, 500)
                          agentStore.addMessage(data.toolUseId, {
                            type: 'text',
                            content: data.isError ? `❌ 오류: ${resultText}` : `✅ 완료: ${resultText}`
                          })
                        }
                      }
                    }
                    break
                  case 'status':
                    addStreamEvent({ type: 'status', content: data.content })
                    break
                  case 'system':
                    // 세션 정보 저장 (나중에 session continuation 용)
                    console.log('[Claude] Session:', data.sessionId, 'Model:', data.model)
                    break
                  case 'result':
                    // 최종 결과 - 비용 정보 등
                    if (data.content) {
                      fullContent = data.content
                      setStreamContent(fullContent)
                    }
                    console.log('[Claude] Cost:', data.cost, 'Duration:', data.duration)
                    break
                  case 'progress':
                    addStreamEvent({ type: 'status', content: data.content })
                    break
                  case 'error':
                    addStreamEvent({
                      type: 'tool_result',
                      content: data.content,
                      isError: true
                    })
                    break
                  case 'done':
                    console.log('[Claude] Done with code:', data.code)
                    break

                  // 🔥 Agent Mode: 서브 에이전트 스폰 이벤트 → Agent Panel에 표시
                  case 'agent_spawn':
                    if (data.agent) {
                      console.log('[Claude] Agent spawned:', data.agent)

                      // 🔥 Agent Panel에 탭 추가
                      const agentStore = useAgentTabsStore.getState()
                      agentStore.addTab({
                        id: data.agent.id || `agent-${Date.now()}`,
                        name: data.agent.name,
                        role: data.agent.role,
                        task: data.agent.task,
                        status: 'working',
                      })

                      // 이벤트도 발생 (다른 컴포넌트용)
                      emitAgentSpawnEvent({
                        name: data.agent.name,
                        role: data.agent.role,
                        task: data.agent.task
                      })

                      addStreamEvent({
                        type: 'status',
                        content: `🤖 서브 에이전트 시작: ${data.agent.name}`
                      })
                    }
                    break
                }
              } catch (e) {}
            }
          }
        }
      }

      const msgs = getMessages()
      const lastMsg = msgs[msgs.length - 1]
      if (lastMsg && lastMsg.role === 'assistant') {
        updateMessage(lastMsg.id, {
          content: fullContent || '응답 없음',
          isStreaming: false
        })

        // 🔥 DB에 assistant 응답 저장
        if (activeThreadId && fullContent) {
          addMessageWithSync(activeThreadId, 'assistant', fullContent).catch(console.error)
        }
      }
    } catch (error: any) {
      const msgs = getMessages()
      const lastMsg = msgs[msgs.length - 1]
      if (lastMsg && lastMsg.role === 'assistant') {
        updateMessage(lastMsg.id, {
          content: `Error: ${error.message}`,
          isStreaming: false
        })
      }
    } finally {
      setIsLoading(false)
      clearStreamContent()
      setStreamStartTime(null)
    }
  }, [input, isLoading, messages, addMessage, updateMessage, getMessages, setStreamContent, clearStreamContent, addStreamEvent, clearStreamEvents, context, settings, activeThreadId, addMessageWithSync])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 🔥 Escape 키로 스트리밍 중단
    if (e.key === 'Escape' && isLoading) {
      e.preventDefault()
      handleStop()
      return
    }

    // 🔥 명령어 자동완성 네비게이션
    if (showCommandSuggestions && commandSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedSuggestionIndex(i => Math.min(i + 1, commandSuggestions.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedSuggestionIndex(i => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault()
        const selected = commandSuggestions[selectedSuggestionIndex]
        if (selected) {
          setInput(selected.fullCommand + ' ')
          setShowCommandSuggestions(false)
        }
        return
      }
      if (e.key === 'Escape') {
        setShowCommandSuggestions(false)
        return
      }
    }

    // 🔥 IME 조합 중이면 Enter 무시 (한글 입력 시 마지막 글자 중복 방지)
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  // 🔥 프로젝트 경로 없으면 폴더 선택 유도 화면 표시
  if (!hasProjectContext) {
    return (
      <div className="flex flex-col h-full bg-[#1a1a1a]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <SparkIcon className="w-5 h-5" style={{ color: CLAUDE_ORANGE }} />
            <span className="text-sm font-medium text-white">Claude Code</span>
          </div>
        </div>

        {/* 프로젝트 필요 안내 */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-6">
            <FolderCog className="w-8 h-8 text-zinc-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            프로젝트를 먼저 열어주세요
          </h3>
          <p className="text-zinc-400 text-sm mb-6 max-w-[280px]">
            Claude Code는 프로젝트 폴더 내에서 작동합니다.<br />
            좌측 파일 트리에서 폴더를 선택하거나<br />
            새 프로젝트를 생성해주세요.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-[200px]">
            <button
              onClick={() => {
                // Electron 폴더 선택 다이얼로그
                const electron = typeof window !== 'undefined' ? (window as any).electron : null
                if (electron?.fs?.selectDirectory) {
                  electron.fs.selectDirectory().then((result: { path: string } | null) => {
                    if (result?.path) {
                      setNeuralMapProjectPath(result.path)
                      setContext({ projectPath: result.path })
                    }
                  })
                } else {
                  // 웹 환경: 수동 입력 팝업
                  setShowProjectPathInput(true)
                }
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: CLAUDE_ORANGE }}
            >
              <FolderOpen className="w-4 h-4" />
              폴더 열기
            </button>
            <button
              onClick={() => setShowProjectPathInput(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              경로 직접 입력
            </button>
          </div>
        </div>

        {/* 🔥 Project Path Input Popup - Portal로 body에 렌더링 */}
        {portalMounted && showProjectPathInput && createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
            onClick={() => setShowProjectPathInput(false)}
          >
            <div
              className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden w-[400px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-sm font-medium text-white">프로젝트 경로 입력</span>
                <button
                  onClick={() => setShowProjectPathInput(false)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <input
                  ref={projectPathInputRef}
                  type="text"
                  value={projectPathInput}
                  onChange={(e) => setProjectPathInput(e.target.value)}
                  placeholder="/path/to/your/project"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && projectPathInput.trim()) {
                      setNeuralMapProjectPath(projectPathInput.trim())
                      setContext({ projectPath: projectPathInput.trim() })
                      setShowProjectPathInput(false)
                    } else if (e.key === 'Escape') {
                      setShowProjectPathInput(false)
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (projectPathInput.trim()) {
                      setNeuralMapProjectPath(projectPathInput.trim())
                      setContext({ projectPath: projectPathInput.trim() })
                      setShowProjectPathInput(false)
                    }
                  }}
                  disabled={!projectPathInput.trim()}
                  className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: projectPathInput.trim() ? CLAUDE_ORANGE : undefined }}
                >
                  프로젝트 열기
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    )
  }

  // 🔥 Agent Mode 상태
  const agentTabs = useAgentTabsStore((state) => state.tabs)
  const hasActiveAgents = agentTabs.length > 0

  return (
    <div className="flex h-full bg-[#1a1a1a]">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Claude Code</span>
            {settings.executionMode === 'agent' && (
              <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Users className="w-3 h-3" />
                Team Mode
              </span>
            )}
          </div>
          {/* 🔥 승인 대기 뱃지 */}
          <ApprovalBadge />
        </div>
        <button
          onClick={() => setShowPastConversations(!showPastConversations)}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white mt-1"
        >
          Past Conversations
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* New Conversation Button */}
      <div className="absolute top-3 right-4">
        <button
          onClick={() => createThread()}
          className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-white"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Logo */}
      <div className="flex justify-center py-4">
        <div className="flex items-center gap-2">
          <SparkIcon className="w-5 h-5" style={{ color: CLAUDE_ORANGE }} />
          <span className="text-lg font-medium text-white">Claude Code</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center">
            <PixelMascot className="w-16 h-12 mb-6" />
            <p className="text-zinc-300 text-sm">
              What to do first? Ask about this codebase or<br />
              we can start writing code.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.isStreaming && streamContent ? streamContent : msg.content}
                isStreaming={msg.isStreaming}
                streamEvents={msg.isStreaming ? streamEvents : []}
                startTime={msg.isStreaming ? streamStartTime ?? undefined : undefined}
                tokenCount={msg.isStreaming ? streamTokenCount : 0}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>


      {/* Terminal Banner */}
      {showTerminalBanner && (
        <div className="mx-4 mb-2 flex items-center justify-between px-3 py-2 bg-zinc-800/50 rounded-lg text-sm">
          <div className="flex items-center gap-2 text-zinc-400">
            <Terminal className="w-4 h-4" />
            <span>Prefer the Terminal experience?</span>
            <button className="text-zinc-300 hover:text-white underline">
              Switch back in Settings.
            </button>
          </div>
          <button
            onClick={() => setShowTerminalBanner(false)}
            className="text-zinc-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 relative" ref={inputAreaRef}>
        {/* 🔥 슬래시 명령어 자동완성 */}
        {showCommandSuggestions && commandSuggestions.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-50">
            <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2 text-xs text-zinc-500">
              <Command className="w-3 h-3" />
              <span>명령어</span>
              <span className="ml-auto">↑↓ 이동 · Tab/Enter 선택 · Esc 닫기</span>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {commandSuggestions.map((cmd, i) => (
                <button
                  key={cmd.name}
                  onClick={() => {
                    setInput(cmd.fullCommand + ' ')
                    setShowCommandSuggestions(false)
                    inputRef.current?.focus()
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left flex items-center gap-3 transition-colors",
                    i === selectedSuggestionIndex
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                  )}
                >
                  <code className="text-sm font-mono" style={{ color: CLAUDE_ORANGE }}>
                    {cmd.fullCommand.split(' ')[0]}
                  </code>
                  <span className="text-sm text-zinc-500 flex-1 truncate">
                    {cmd.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}


        {/* 🔥 Hidden file input for attachments */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.js,.ts,.jsx,.tsx,.py,.json,.css,.html,.svg,.png,.jpg,.jpeg,.gif,.webp"
          onChange={handleFileAttach}
          className="hidden"
        />

        {/* 🔥 첨부 파일 표시 */}
        {attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-zinc-800/50 rounded-lg px-3 py-1.5 border border-zinc-700 text-sm"
              >
                {file.type === 'image' ? (
                  <ImageIcon className="w-4 h-4 text-purple-400" />
                ) : (
                  <FileText className="w-4 h-4 text-blue-400" />
                )}
                <span className="text-zinc-300 max-w-[100px] truncate">{file.name}</span>
                <button
                  onClick={() => removeAttachedFile(index)}
                  className="text-zinc-500 hover:text-white p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 🔥 Monaco 선택 컨텍스트 표시 */}
        {context.selectedCode && (
          <div className="mb-2 bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Code2 className="w-3 h-3" />
                <span>선택된 코드:</span>
                {context.currentFile && (
                  <code className="text-zinc-500">{context.currentFile}</code>
                )}
              </div>
              <button
                onClick={() => setContext({ selectedCode: undefined })}
                className="text-zinc-500 hover:text-white p-1"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <pre className="text-xs font-mono text-zinc-400 overflow-x-auto max-h-20 overflow-y-auto">
              {context.selectedCode.substring(0, 300)}
              {context.selectedCode.length > 300 && '...'}
            </pre>
          </div>
        )}

        {/* 🔥 대기열 메시지 표시 */}
        {queuedMessage && (
          <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-amber-400 text-sm flex-1 truncate">
              대기 중: {queuedMessage.substring(0, 50)}{queuedMessage.length > 50 ? '...' : ''}
            </span>
            <button
              onClick={() => setQueuedMessage(null)}
              className="text-amber-500/70 hover:text-amber-400 p-1"
              title="대기열 취소"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div
          className="rounded-lg border-2 overflow-hidden"
          style={{ borderColor: isLoading && input.trim() ? '#f59e0b' : CLAUDE_ORANGE }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder={
              isLoading
                ? "메시지를 입력하면 대기열에 추가됩니다..."
                : context.selectedCode
                  ? "선택한 코드에 대해 질문하세요..."
                  : "Ask Claude to edit..."
            }
            className="w-full bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 resize-none focus:outline-none"
            rows={1}
          />

          {/* Bottom Bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-t border-zinc-800">
            <div className="flex items-center gap-3">
              {/* 🔥 Execution Mode Toggle (Quick/Agent) */}
              <button
                onClick={() => {
                  const newMode = settings.executionMode === 'quick' ? 'agent' : 'quick'
                  updateSettings({ executionMode: newMode })
                  // Quick Mode로 전환 시 에이전트 탭 초기화
                  if (newMode === 'quick') {
                    useAgentTabsStore.getState().clearTabs()
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 text-sm hover:text-white transition-colors px-2 py-1 rounded-md",
                  settings.executionMode === 'agent'
                    ? "text-purple-400 bg-purple-500/10"
                    : "text-cyan-400 bg-cyan-500/10"
                )}
                title={settings.executionMode === 'agent'
                  ? "Team Mode: /team [작업] 으로 에이전트 팀 spawn 가능"
                  : "Quick Mode: 직접 실행 (단일 CLI)"
                }
              >
                {settings.executionMode === 'agent' ? (
                  <>
                    <Users className="w-4 h-4" />
                    <span>Agent</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Quick</span>
                  </>
                )}
              </button>

              {/* 🔥 Permission Mode Toggle */}
              <div className="relative" ref={permissionMenuRef}>
                <button
                  ref={permissionButtonRef}
                  onClick={() => setShowPermissionMenu(!showPermissionMenu)}
                  className={cn(
                    "flex items-center gap-1.5 text-sm hover:text-white transition-colors",
                    settings.permissionMode === 'acceptEdits'
                      ? "text-green-400"
                      : settings.permissionMode === 'plan'
                        ? "text-yellow-400"
                        : "text-zinc-400"
                  )}
                  title={`현재 모드: ${
                    settings.permissionMode === 'acceptEdits' ? '자동 승인'
                    : settings.permissionMode === 'plan' ? '계획 검토'
                    : '편집 전 확인'
                  }`}
                >
                  {settings.permissionMode === 'acceptEdits' ? (
                    <ShieldOff className="w-4 h-4" />
                  ) : settings.permissionMode === 'plan' ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <Shield className="w-4 h-4" />
                  )}
                  <span>
                    {settings.permissionMode === 'acceptEdits' ? 'Auto accept'
                      : settings.permissionMode === 'plan' ? 'Plan mode'
                      : 'Ask before edits'}
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              {/* Current file */}
              <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                <Code2 className="w-4 h-4" />
                <span className="max-w-[150px] truncate">
                  {context.currentFile || context.activeFile?.name || 'No file'}
                </span>
              </div>

              {/* 🔥 Project Path Selector - 자동 동기화됨 */}
              <div className="relative">
                <button
                  ref={projectPathButtonRef}
                  onClick={() => {
                    setProjectPathInput(context.projectPath || '')
                    setShowProjectPathInput(!showProjectPathInput)
                  }}
                  className={cn(
                    "flex items-center gap-1.5 text-sm transition-colors",
                    context.projectPath
                      ? neuralMapProjectPath === context.projectPath
                        ? "text-blue-400 hover:text-blue-300"  // 🔥 동기화됨 = 파란색
                        : "text-green-400 hover:text-green-300"
                      : "text-orange-400 hover:text-orange-300"
                  )}
                  title={
                    context.projectPath
                      ? neuralMapProjectPath === context.projectPath
                        ? `🔗 프로젝트와 동기화됨: ${context.projectPath}`
                        : `작업 경로: ${context.projectPath}`
                      : '작업 경로 미설정'
                  }
                >
                  {context.projectPath ? (
                    <FolderOpen className="w-4 h-4" />
                  ) : (
                    <FolderCog className="w-4 h-4" />
                  )}
                  <span className="max-w-[100px] truncate">
                    {context.projectPath
                      ? context.projectPath.split('/').pop() || context.projectPath
                      : linkedProjectName || 'No project'}
                  </span>
                  {/* 🔥 동기화 아이콘 표시 */}
                  {neuralMapProjectPath && neuralMapProjectPath === context.projectPath && (
                    <span className="text-blue-400 text-xs" title="프로젝트와 동기화됨">🔗</span>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* 🔥 File Attachment Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "p-1.5 hover:text-white transition-colors",
                  attachedFiles.length > 0 ? "text-blue-400" : "text-zinc-400"
                )}
                title="파일 첨부 (이미지, 코드 파일)"
              >
                <Paperclip className="w-4 h-4" />
                {attachedFiles.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                    {attachedFiles.length}
                  </span>
                )}
              </button>

              {/* Slash command */}
              <button
                onClick={() => {
                  if (!input.startsWith('/')) {
                    setInput('/')
                    inputRef.current?.focus()
                  }
                }}
                className="p-1.5 text-zinc-400 hover:text-white text-lg font-light"
                title="명령어 입력 (/help)"
              >
                /
              </button>

              {/* Send / Stop / Queue */}
              {isLoading ? (
                <div className="flex items-center gap-1">
                  {/* 대기열 추가 버튼 */}
                  {input.trim() && (
                    <button
                      onClick={handleSend}
                      className="p-2 rounded-lg transition-all bg-amber-600 hover:bg-amber-500 text-white"
                      title="대기열에 추가 (작업 완료 후 자동 전송)"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                  {/* 중단 버튼 */}
                  <button
                    onClick={handleStop}
                    className="p-2 rounded-lg transition-all bg-red-600 hover:bg-red-500 text-white"
                    title="중단 (Escape)"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                </div>
              ) : (
                <button
                  data-send-button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    !input.trim()
                      ? "bg-zinc-700 text-zinc-500"
                      : "text-white"
                  )}
                  style={{
                    backgroundColor: !input.trim() ? undefined : CLAUDE_ORANGE
                  }}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 🔥 Model Selector Modal - Portal로 body에 렌더링 */}
      {portalMounted && showModelSelector && createPortal(
        <div
          ref={modelSelectorRef}
          className="fixed bg-[#1e3a5f] border border-[#3d5a80] rounded-xl shadow-2xl overflow-hidden"
          style={{
            zIndex: 9999,
            width: inputAreaRef.current ? inputAreaRef.current.offsetWidth - 32 : 300,
            ...(inputAreaRef.current ? (() => {
              const rect = inputAreaRef.current.getBoundingClientRect()
              return {
                bottom: window.innerHeight - rect.top + 8,
                left: rect.left + 16,
              }
            })() : { bottom: 100, left: 50 })
          }}
        >
          <div className="px-4 py-3 border-b border-[#3d5a80]/50 text-sm text-zinc-300">
            Select a model
          </div>
          <div className="py-1">
            {/* Opus */}
            <button
              onClick={() => {
                updateSettings({ model: 'opus' })
                setShowModelSelector(false)
              }}
              className={cn(
                "w-full px-4 py-3 text-left flex items-center justify-between transition-colors",
                settings.model === 'opus' || !settings.model
                  ? "bg-[#2d5a87] text-white"
                  : "text-zinc-300 hover:bg-[#2d4a6f]"
              )}
            >
              <div>
                <div className="font-medium">Default (recommended)</div>
                <div className="text-sm text-zinc-400">Opus 4.5 - Most capable for complex work</div>
              </div>
              {(settings.model === 'opus' || !settings.model) && (
                <Check className="w-5 h-5 text-white" />
              )}
            </button>

            {/* Sonnet */}
            <button
              onClick={() => {
                updateSettings({ model: 'sonnet' })
                setShowModelSelector(false)
              }}
              className={cn(
                "w-full px-4 py-3 text-left flex items-center justify-between transition-colors",
                settings.model === 'sonnet'
                  ? "bg-[#2d5a87] text-white"
                  : "text-zinc-300 hover:bg-[#2d4a6f]"
              )}
            >
              <div>
                <div className="font-medium">Sonnet</div>
                <div className="text-sm text-zinc-400">Sonnet 4.5 - Best for everyday tasks</div>
              </div>
              {settings.model === 'sonnet' && (
                <Check className="w-5 h-5 text-white" />
              )}
            </button>

            {/* Haiku */}
            <button
              onClick={() => {
                updateSettings({ model: 'haiku' })
                setShowModelSelector(false)
              }}
              className={cn(
                "w-full px-4 py-3 text-left flex items-center justify-between transition-colors",
                settings.model === 'haiku'
                  ? "bg-[#2d5a87] text-white"
                  : "text-zinc-300 hover:bg-[#2d4a6f]"
              )}
            >
              <div>
                <div className="font-medium">Haiku</div>
                <div className="text-sm text-zinc-400">Haiku 4.5 - Fastest for quick answers</div>
              </div>
              {settings.model === 'haiku' && (
                <Check className="w-5 h-5 text-white" />
              )}
            </button>

            {/* Custom model option */}
            <button
              onClick={() => {
                const customModel = prompt('모델 ID를 입력하세요:', settings.customModelId || 'claude-3-5-sonnet-20241022')
                if (customModel) {
                  updateSettings({ model: 'custom', customModelId: customModel })
                  setShowModelSelector(false)
                }
              }}
              className={cn(
                "w-full px-4 py-3 text-left flex items-center justify-between transition-colors",
                settings.model === 'custom'
                  ? "bg-[#2d5a87] text-white"
                  : "text-zinc-300 hover:bg-[#2d4a6f]"
              )}
            >
              <div>
                <div className="font-medium">{settings.customModelId || 'Custom model'}</div>
                <div className="text-sm text-zinc-400">Enter custom model ID</div>
              </div>
              {settings.model === 'custom' && (
                <Check className="w-5 h-5 text-white" />
              )}
            </button>
          </div>

          <div className="px-4 py-2 border-t border-[#3d5a80]/50 text-xs text-zinc-500">
            Esc to close
          </div>
        </div>,
        document.body
      )}

      {/* 🔥 Permission Mode Dropdown - Portal로 body에 렌더링 */}
      {portalMounted && showPermissionMenu && createPortal(
        <div
          ref={permissionMenuRef}
          className="fixed bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden min-w-[200px]"
          style={{
            zIndex: 9999,
            ...(permissionButtonRef.current ? (() => {
              const rect = permissionButtonRef.current.getBoundingClientRect()
              return {
                bottom: window.innerHeight - rect.top + 8,
                left: Math.max(8, rect.left),
              }
            })() : { bottom: 100, left: 50 })
          }}
        >
          <div className="px-3 py-2 border-b border-zinc-800 text-xs text-zinc-500">
            권한 모드 선택
          </div>
          <button
            onClick={() => {
              updateSettings({ permissionMode: 'default' })
              setShowPermissionMenu(false)
            }}
            className={cn(
              "w-full px-3 py-2 text-left flex items-center gap-3 transition-colors",
              settings.permissionMode === 'default'
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:bg-zinc-800/50"
            )}
          >
            <Shield className="w-4 h-4" />
            <div className="flex-1">
              <div className="text-sm">Ask before edits</div>
              <div className="text-xs text-zinc-500">모든 변경사항 확인</div>
            </div>
            {settings.permissionMode === 'default' && (
              <Check className="w-4 h-4 text-green-400" />
            )}
          </button>
          <button
            onClick={() => {
              updateSettings({ permissionMode: 'plan' })
              setShowPermissionMenu(false)
            }}
            className={cn(
              "w-full px-3 py-2 text-left flex items-center gap-3 transition-colors",
              settings.permissionMode === 'plan'
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:bg-zinc-800/50"
            )}
          >
            <ShieldCheck className="w-4 h-4" />
            <div className="flex-1">
              <div className="text-sm">Plan mode</div>
              <div className="text-xs text-zinc-500">실행 전 계획 검토</div>
            </div>
            {settings.permissionMode === 'plan' && (
              <Check className="w-4 h-4 text-green-400" />
            )}
          </button>
          <button
            onClick={() => {
              updateSettings({ permissionMode: 'acceptEdits' })
              setShowPermissionMenu(false)
            }}
            className={cn(
              "w-full px-3 py-2 text-left flex items-center gap-3 transition-colors",
              settings.permissionMode === 'acceptEdits'
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:bg-zinc-800/50"
            )}
          >
            <ShieldOff className="w-4 h-4" />
            <div className="flex-1">
              <div className="text-sm">Auto accept</div>
              <div className="text-xs text-zinc-500">자동으로 모든 변경 승인</div>
            </div>
            {settings.permissionMode === 'acceptEdits' && (
              <Check className="w-4 h-4 text-green-400" />
            )}
          </button>
        </div>,
        document.body
      )}

      {/* 🔥 Project Path Input Popup - Portal로 body에 렌더링 */}
      {portalMounted && showProjectPathInput && createPortal(
        <div
          className="fixed bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden"
          style={{
            zIndex: 9999,
            width: 320,
            maxWidth: 'calc(100vw - 16px)',
            ...(projectPathButtonRef.current ? (() => {
              const rect = projectPathButtonRef.current.getBoundingClientRect()
              // 우측 패널 안에서 표시되도록 right 기준으로 위치 계산
              const rightOffset = window.innerWidth - rect.right
              return {
                bottom: window.innerHeight - rect.top + 8,
                right: Math.max(8, rightOffset),
              }
            })() : { bottom: 100, right: 8 })
          }}
        >
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-xs text-zinc-500">프로젝트 작업 경로</span>
            <button
              onClick={() => setShowProjectPathInput(false)}
              className="text-zinc-500 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="p-3 space-y-3">
            {/* 🔥 동기화 상태 표시 */}
            {neuralMapProjectPath && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <span className="text-blue-400">🔗</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-blue-300">현재 프로젝트와 동기화됨</div>
                  <div className="text-xs text-zinc-400 truncate">
                    {linkedProjectName || neuralMapProjectPath.split('/').pop()}
                  </div>
                </div>
              </div>
            )}

            {/* 🔥 현재 경로 표시 (읽기 전용으로 변경) */}
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">작업 디렉토리</label>
              <div className="w-full bg-zinc-800/50 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-300 font-mono">
                {context.projectPath || neuralMapProjectPath || '설정되지 않음'}
              </div>
            </div>

            {/* 🔥 수동 경로 설정 (고급) */}
            <details className="group">
              <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400 flex items-center gap-1">
                <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                수동 경로 설정 (고급)
              </summary>
              <div className="mt-2 space-y-2">
                <input
                  ref={projectPathInputRef}
                  type="text"
                  value={projectPathInput}
                  onChange={(e) => setProjectPathInput(e.target.value)}
                  placeholder="/path/to/your/project"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && projectPathInput.trim()) {
                      setContext({ projectPath: projectPathInput.trim() })
                      setShowProjectPathInput(false)
                    } else if (e.key === 'Escape') {
                      setShowProjectPathInput(false)
                    }
                  }}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (projectPathInput.trim()) {
                        setContext({ projectPath: projectPathInput.trim() })
                        setShowProjectPathInput(false)
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded transition-colors"
                  >
                    수동 설정
                  </button>
                  {neuralMapProjectPath && context.projectPath !== neuralMapProjectPath && (
                    <button
                      onClick={() => {
                        setContext({ projectPath: neuralMapProjectPath })
                        setProjectPathInput(neuralMapProjectPath)
                        setShowProjectPathInput(false)
                      }}
                      className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm rounded transition-colors"
                    >
                      동기화
                    </button>
                  )}
                </div>
              </div>
            </details>

            <p className="text-xs text-zinc-500">
              💡 프로젝트 경로는 현재 메뉴의 프로젝트와 자동 동기화됩니다
            </p>
          </div>
        </div>,
        document.body
      )}

      {/* 🔥 승인 모달 */}
      <ApprovalModal
        isOpen={!!approvalRequest}
        onClose={() => setApprovalRequest(null)}
      />
      </div>

      {/* 🔥 Agent Tabs Panel - 우측에 접었다 폈다 가능 */}
      {hasActiveAgents && <AgentTabs />}
    </div>
  )
}

export default ClaudeCodeUI
