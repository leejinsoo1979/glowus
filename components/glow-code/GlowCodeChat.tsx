'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useGlowCodeStore } from '@/stores/glowCodeStore'
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

// Claude Code 브랜드 색상
const CLAUDE_ORANGE = '#D97757'

// Spark 아이콘 (Claude Code 로고)
const SparkIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
    <path d="M12 2L13.09 8.26L18 6L15.74 10.91L22 12L15.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L8.26 13.09L2 12L8.26 10.91L6 6L10.91 8.26L12 2Z" />
  </svg>
)

// 픽셀 마스코트 (Claude Code 스타일)
const PixelMascot = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 48" className={className}>
    {/* Body */}
    <rect x="16" y="16" width="32" height="24" fill={CLAUDE_ORANGE} />
    {/* Head top */}
    <rect x="20" y="8" width="24" height="8" fill={CLAUDE_ORANGE} />
    {/* Eyes */}
    <rect x="24" y="20" width="4" height="4" fill="#1a1a1a" />
    <rect x="36" y="20" width="4" height="4" fill="#1a1a1a" />
    {/* Legs */}
    <rect x="20" y="40" width="8" height="8" fill={CLAUDE_ORANGE} />
    <rect x="36" y="40" width="8" height="8" fill={CLAUDE_ORANGE} />
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

// Message Component
const MessageBubble = ({
  role,
  content,
  isStreaming,
  streamEvents = []
}: {
  role: 'user' | 'assistant' | 'system'
  content: string
  isStreaming?: boolean
  streamEvents?: StreamEvent[]
}) => {
  return (
    <div className={cn(
      "px-4 py-3",
      role === 'user' ? "bg-zinc-800/50" : ""
    )}>
      <div className="flex items-start gap-3">
        {role === 'assistant' && (
          <SparkIcon className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: CLAUDE_ORANGE }} />
        )}
        <div className="flex-1 min-w-0">
          {/* 🔥 Thinking 블록 - 접이식 */}
          {streamEvents.filter(e => e.type === 'thinking').length > 0 && (
            <details className="my-2 group">
              <summary className="text-zinc-400 text-sm cursor-pointer hover:text-zinc-300 flex items-center gap-2">
                <span className="animate-pulse">💭</span>
                <span>Thinking...</span>
                <span className="text-zinc-600 text-xs">(클릭하여 펼치기)</span>
              </summary>
              <div className="mt-2 pl-4 border-l-2 border-zinc-700 space-y-1">
                {streamEvents.filter(e => e.type === 'thinking').map((e, i) => (
                  <div key={`thinking-${i}`} className="text-zinc-500 text-sm italic">
                    {e.content}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* 🔥 Tool 사용 - 타입별 UI */}
          {streamEvents.filter(e => e.type === 'tool').map((e, i) => {
            const config = TOOL_CONFIG[e.name || ''] || { icon: '🔧', color: 'text-zinc-400', label: e.name }

            return (
              <div key={`tool-${i}`} className="my-2">
                {/* Tool Header */}
                <div className={`flex items-center gap-2 text-sm ${config.color}`}>
                  <span>{config.icon}</span>
                  <span className="font-medium">{config.label}</span>
                  {e.name === 'Bash' && e.input?.command && (
                    <code className="bg-zinc-800 px-2 py-0.5 rounded text-xs">
                      {e.input.command}
                    </code>
                  )}
                </div>

                {/* Write Tool - 파일 diff */}
                {e.name === 'Write' && e.input?.file_path && (
                  <div className="bg-zinc-900 rounded p-3 mt-1 font-mono text-xs">
                    <div className="text-green-400 mb-2">📝 {e.input.file_path}</div>
                    {e.input.content && (
                      <pre className="text-zinc-400 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                        {e.input.content.substring(0, 1000)}
                        {e.input.content.length > 1000 && '...'}
                      </pre>
                    )}
                  </div>
                )}

                {/* Edit Tool - 변경 내용 */}
                {e.name === 'Edit' && e.input && (
                  <div className="bg-zinc-900 rounded p-3 mt-1 font-mono text-xs">
                    <div className="text-yellow-400 mb-2">✏️ {e.input.file_path}</div>
                    {e.input.old_string && (
                      <div className="mb-2">
                        <span className="text-red-400">- </span>
                        <span className="text-red-300 line-through">{e.input.old_string.substring(0, 200)}</span>
                      </div>
                    )}
                    {e.input.new_string && (
                      <div>
                        <span className="text-green-400">+ </span>
                        <span className="text-green-300">{e.input.new_string.substring(0, 200)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Read Tool - 파일 경로 */}
                {e.name === 'Read' && e.input?.file_path && (
                  <div className="bg-zinc-900/50 rounded px-3 py-2 mt-1 text-xs">
                    <span className="text-blue-400">📖 Reading:</span>
                    <code className="ml-2 text-zinc-400">{e.input.file_path}</code>
                  </div>
                )}

                {/* Bash Tool - 명령어 */}
                {e.name === 'Bash' && e.input?.command && (
                  <div className="bg-zinc-900 rounded p-3 mt-1 font-mono text-xs">
                    <div className="flex items-center gap-2 text-purple-400">
                      <span>$</span>
                      <code className="text-zinc-300">{e.input.command}</code>
                    </div>
                    {e.input.description && (
                      <div className="text-zinc-500 mt-1 text-xs">{e.input.description}</div>
                    )}
                  </div>
                )}

                {/* Glob/Grep Tool - 검색 패턴 */}
                {(e.name === 'Glob' || e.name === 'Grep') && e.input && (
                  <div className="bg-zinc-900/50 rounded px-3 py-2 mt-1 text-xs">
                    <span className={e.name === 'Glob' ? 'text-cyan-400' : 'text-orange-400'}>
                      {e.name === 'Glob' ? '🔍 Pattern:' : '🔎 Search:'}
                    </span>
                    <code className="ml-2 text-zinc-400">
                      {e.input.pattern || e.input.query}
                    </code>
                    {e.input.path && (
                      <span className="ml-2 text-zinc-600">in {e.input.path}</span>
                    )}
                  </div>
                )}

                {/* 기타 Tool - 일반 JSON */}
                {!['Write', 'Edit', 'Read', 'Bash', 'Glob', 'Grep'].includes(e.name || '') && e.input && (
                  <div className="bg-zinc-900/50 rounded px-3 py-2 mt-1 text-xs font-mono text-zinc-500">
                    {JSON.stringify(e.input, null, 2).substring(0, 300)}
                  </div>
                )}
              </div>
            )
          })}

          {/* 🔥 Tool 결과 - 성공/실패 구분 */}
          {streamEvents.filter(e => e.type === 'tool_result').map((e, i) => (
            <div
              key={`result-${i}`}
              className={cn(
                "text-sm font-mono rounded p-2 my-2 max-h-32 overflow-y-auto",
                e.isError
                  ? "bg-red-900/30 text-red-300 border border-red-800"
                  : "bg-zinc-800/50 text-zinc-400"
              )}
            >
              <span className="mr-2">{e.isError ? '❌' : '✅'}</span>
              {typeof e.content === 'string'
                ? e.content.substring(0, 500)
                : JSON.stringify(e.content).substring(0, 500)}
              {(typeof e.content === 'string' ? e.content.length : JSON.stringify(e.content).length) > 500 && '...'}
            </div>
          ))}

          {/* 🔥 Status - 진행률 표시 */}
          {streamEvents.filter(e => e.type === 'status').map((e, i) => (
            <div key={`status-${i}`} className="flex items-center gap-2 text-yellow-400 text-xs font-mono my-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{e.content}</span>
            </div>
          ))}

          {/* 텍스트 응답 */}
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
          {isStreaming && (
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
  } = useGlowCodeStore()

  // 🔥 승인 시스템 스토어
  const {
    activeRequest: approvalRequest,
    setActiveRequest: setApprovalRequest,
  } = useApprovalStore()

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPastConversations, setShowPastConversations] = useState(false)
  const [showTerminalBanner, setShowTerminalBanner] = useState(true)
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  // 🔥 Permission mode dropdown
  const [showPermissionMenu, setShowPermissionMenu] = useState(false)
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

  const messages = getMessages()

  // 🔥 슬래시 명령어 자동완성
  const commandSuggestions = useMemo(() => {
    if (!input.startsWith('/') || input.includes(' ')) return []
    return getCommandSuggestions(input)
  }, [input])

  useEffect(() => {
    setShowCommandSuggestions(commandSuggestions.length > 0)
    setSelectedSuggestionIndex(0)
  }, [commandSuggestions])

  // 🔥 슬래시 명령어 컨텍스트
  const slashCommandContext: CommandContext = useMemo(() => ({
    cwd: context.projectPath || undefined,
    sessionId: null, // TODO: 세션 ID 관리
    currentFile: context.currentFile || context.activeFile?.path,
    selectedCode: context.selectedCode,
    clearMessages,
    addMessage,
    setContext: (ctx) => setContext(ctx as any),
    updateSettings: (s) => updateSettings(s as any),
  }), [context, clearMessages, addMessage, setContext, updateSettings])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamContent, streamEvents])

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
                    break
                  case 'thinking':
                    addStreamEvent({ type: 'thinking', content: data.content })
                    break
                  case 'tool':
                    addStreamEvent({ type: 'tool', name: data.name, input: data.input, id: data.id })
                    break
                  case 'tool_result':
                    addStreamEvent({ type: 'tool_result', content: data.content, toolUseId: data.toolUseId, isError: data.isError })
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
              } catch {}
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
        break
    }
  }, [addMessage, clearMessages, sendPromptToClaudeCode])

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setShowCommandSuggestions(false)

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
    addMessage({ role: 'assistant', content: '', isStreaming: true })

    try {
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
        body: JSON.stringify({
          messages: apiMessages,
          options: {
            model: settings.model !== 'custom' ? settings.model : settings.customModelId,
            cwd: context.projectPath || process.cwd?.() || undefined,
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
                    break
                  case 'thinking':
                    addStreamEvent({ type: 'thinking', content: data.content })
                    break
                  case 'tool':
                    addStreamEvent({
                      type: 'tool',
                      name: data.name,
                      input: data.input,
                      id: data.id
                    })
                    break
                  case 'tool_result':
                    addStreamEvent({
                      type: 'tool_result',
                      content: data.content,
                      toolUseId: data.toolUseId,
                      isError: data.isError
                    })
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
    }
  }, [input, isLoading, messages, addMessage, updateMessage, getMessages, setStreamContent, clearStreamContent, addStreamEvent, clearStreamEvents, context, settings])

  const handleKeyDown = (e: React.KeyboardEvent) => {
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

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-white">Claude Code</div>
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
                streamEvents={msg.isStreaming ? streamEvents : []}  // 🔥 스트리밍 중일 때만 이벤트 전달
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
      <div className="p-4 relative">
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

        <div
          className="rounded-lg border-2 overflow-hidden"
          style={{ borderColor: CLAUDE_ORANGE }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={context.selectedCode ? "선택한 코드에 대해 질문하세요..." : "Ask Claude to edit..."}
            className="w-full bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 resize-none focus:outline-none"
            rows={1}
            disabled={isLoading}
          />

          {/* Bottom Bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-t border-zinc-800">
            <div className="flex items-center gap-3">
              {/* 🔥 Permission Mode Toggle */}
              <div className="relative" ref={permissionMenuRef}>
                <button
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

                {/* Permission Mode Dropdown */}
                {showPermissionMenu && (
                  <div className="absolute bottom-full left-0 mb-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-50 min-w-[200px]">
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
                  </div>
                )}
              </div>

              {/* Current file */}
              <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                <Code2 className="w-4 h-4" />
                <span className="max-w-[150px] truncate">
                  {context.currentFile || context.activeFile?.name || 'No file'}
                </span>
              </div>

              {/* 🔥 Project Path Selector */}
              <div className="relative">
                <button
                  onClick={() => {
                    setProjectPathInput(context.projectPath || '')
                    setShowProjectPathInput(!showProjectPathInput)
                  }}
                  className={cn(
                    "flex items-center gap-1.5 text-sm transition-colors",
                    context.projectPath
                      ? "text-green-400 hover:text-green-300"
                      : "text-orange-400 hover:text-orange-300"
                  )}
                  title={context.projectPath ? `작업 경로: ${context.projectPath}` : '작업 경로 미설정 (클릭하여 설정)'}
                >
                  {context.projectPath ? (
                    <FolderOpen className="w-4 h-4" />
                  ) : (
                    <FolderCog className="w-4 h-4" />
                  )}
                  <span className="max-w-[100px] truncate">
                    {context.projectPath
                      ? context.projectPath.split('/').pop() || context.projectPath
                      : 'Set path'}
                  </span>
                </button>

                {/* Project Path Input Popup */}
                {showProjectPathInput && (
                  <div className="absolute bottom-full left-0 mb-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-50 min-w-[300px]">
                    <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                      <span className="text-xs text-zinc-500">프로젝트 경로 설정</span>
                      <button
                        onClick={() => setShowProjectPathInput(false)}
                        className="text-zinc-500 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="p-3 space-y-2">
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
                        autoFocus
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
                          설정
                        </button>
                        {context.projectPath && (
                          <button
                            onClick={() => {
                              setContext({ projectPath: undefined })
                              setProjectPathInput('')
                              setShowProjectPathInput(false)
                            }}
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded transition-colors"
                          >
                            초기화
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">
                        💡 <code>/cd /path</code> 명령어로도 변경 가능
                      </p>
                    </div>
                  </div>
                )}
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

              {/* Send */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  (!input.trim() || isLoading)
                    ? "bg-zinc-700 text-zinc-500"
                    : "text-white"
                )}
                style={{
                  backgroundColor: (!input.trim() || isLoading) ? undefined : CLAUDE_ORANGE
                }}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 🔥 승인 모달 */}
      <ApprovalModal
        isOpen={!!approvalRequest}
        onClose={() => setApprovalRequest(null)}
      />
    </div>
  )
}

export default ClaudeCodeUI
