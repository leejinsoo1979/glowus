'use client'

/**
 * AgentChatPanel - 코딩 에이전트 채팅 인터페이스
 * Cursor Composer / Claude Code 수준의 전문 코딩 인터페이스
 *
 * Features:
 * - SSE 스트리밍 메시지
 * - 코드 블록 문법 하이라이팅
 * - 도구 실행 인라인 표시
 * - 플랜 승인/거부 UI
 * - 이미지 업로드 (AI Viewfinder 연동)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  Send,
  Loader2,
  Image,
  Paperclip,
  ChevronDown,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Terminal,
  File,
  GitBranch,
  Search,
  AlertCircle,
  StopCircle,
  Sparkles,
} from 'lucide-react'
import type { AgentMessage, AgentPlan, AgentState } from '@/lib/neural-map/types'

interface AgentChatPanelProps {
  messages: AgentMessage[]
  plan?: AgentPlan | null
  isExecuting: boolean
  onSendMessage: (message: string, image?: string) => void
  onApprovePlan: () => void
  onRejectPlan: () => void
  onCancel: () => void
  className?: string
}

export function AgentChatPanel({
  messages,
  plan,
  isExecuting,
  onSendMessage,
  onApprovePlan,
  onRejectPlan,
  onCancel,
  className,
}: AgentChatPanelProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [input, setInput] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // textarea 높이 자동 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() && !imagePreview) return
    if (isExecuting) return

    onSendMessage(input.trim(), imagePreview || undefined)
    setInput('')
    setImagePreview(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const renderMessageContent = (content: string, messageId: string) => {
    // 코드 블록 파싱
    const parts = content.split(/(```[\s\S]*?```)/g)

    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const match = part.match(/```(\w+)?\n?([\s\S]*?)```/)
        if (match) {
          const [, language, code] = match
          const codeId = `${messageId}-code-${index}`

          return (
            <div
              key={index}
              className={cn(
                "relative my-3 rounded-lg overflow-hidden",
                isDark ? "bg-zinc-900" : "bg-zinc-100"
              )}
            >
              {/* 코드 헤더 */}
              <div className={cn(
                "flex items-center justify-between px-3 py-1.5 text-xs border-b",
                isDark ? "bg-zinc-800 border-zinc-700" : "bg-zinc-200 border-zinc-300"
              )}>
                <span className={cn(
                  "font-mono",
                  isDark ? "text-zinc-400" : "text-zinc-600"
                )}>
                  {language || 'code'}
                </span>
                <button
                  onClick={() => copyCode(code.trim(), codeId)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded transition-colors",
                    isDark ? "hover:bg-zinc-700" : "hover:bg-zinc-300"
                  )}
                >
                  {copiedId === codeId ? (
                    <>
                      <Check className="w-3 h-3 text-green-500" />
                      <span className="text-green-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* 코드 내용 */}
              <pre className={cn(
                "p-3 overflow-x-auto text-sm font-mono",
                isDark ? "text-zinc-300" : "text-zinc-800"
              )}>
                <code>{code.trim()}</code>
              </pre>
            </div>
          )
        }
      }

      // 인라인 코드
      const inlineParts = part.split(/(`[^`]+`)/g)
      return (
        <span key={index}>
          {inlineParts.map((inline, i) => {
            if (inline.startsWith('`') && inline.endsWith('`')) {
              return (
                <code
                  key={i}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-sm font-mono",
                    isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-200 text-zinc-800"
                  )}
                >
                  {inline.slice(1, -1)}
                </code>
              )
            }
            return <span key={i}>{inline}</span>
          })}
        </span>
      )
    })
  }

  const getToolIcon = (name: string) => {
    if (name.includes('search')) return Search
    if (name.includes('read') || name.includes('file')) return File
    if (name.includes('run') || name.includes('terminal')) return Terminal
    if (name.includes('git')) return GitBranch
    return Terminal
  }

  return (
    <div className={cn(
      "flex flex-col h-full",
      isDark ? "bg-zinc-950" : "bg-white",
      className
    )}>
      {/* 메시지 영역 */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className={cn(
              "w-12 h-12 mb-4",
              isDark ? "text-zinc-600" : "text-zinc-400"
            )} />
            <h3 className={cn(
              "text-lg font-medium mb-2",
              isDark ? "text-zinc-300" : "text-zinc-700"
            )}>
              NeuraMap Coding Agent
            </h3>
            <p className={cn(
              "text-sm max-w-md",
              isDark ? "text-zinc-500" : "text-zinc-500"
            )}>
              코드베이스를 분석하고, 코드를 수정하고, 빌드를 검증하고, 커밋까지 자동으로 수행합니다.
              화면 캡처를 첨부하거나 메시지를 입력하세요.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex gap-3",
                message.role === 'user' && "justify-end"
              )}
            >
              {message.role === 'assistant' && (
                <div className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                  isDark ? "bg-blue-500/20" : "bg-blue-100"
                )}>
                  <Sparkles className="w-4 h-4 text-blue-500" />
                </div>
              )}

              <div className={cn(
                "max-w-[85%] rounded-lg px-4 py-3",
                message.role === 'user'
                  ? isDark ? "bg-blue-600 text-white" : "bg-blue-500 text-white"
                  : isDark ? "bg-zinc-800 text-zinc-100" : "bg-zinc-100 text-zinc-900"
              )}>
                {/* 이미지 */}
                {message.imageDataUrl && (
                  <img
                    src={message.imageDataUrl}
                    alt="Attached"
                    className="max-w-full rounded-lg mb-2"
                  />
                )}

                {/* 내용 */}
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {renderMessageContent(message.content, message.id)}
                </div>

                {/* 도구 호출 표시 */}
                {message.toolCall && (
                  <div className={cn(
                    "mt-2 pt-2 border-t space-y-1",
                    isDark ? "border-zinc-700" : "border-zinc-200"
                  )}>
                    {(() => {
                      const Icon = getToolIcon(message.toolCall.name)
                      const hasResult = message.toolCall.result !== undefined
                      return (
                        <div
                          className={cn(
                            "flex items-center gap-2 text-xs",
                            isDark ? "text-zinc-400" : "text-zinc-600"
                          )}
                        >
                          {hasResult ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          )}
                          <Icon className="w-3 h-3" />
                          <span className="font-mono">{message.toolCall.name}</span>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                  isDark ? "bg-zinc-700" : "bg-zinc-300"
                )}>
                  <span className="text-sm font-medium">U</span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* 플랜 승인 UI */}
        {plan && plan.approvalStatus === 'pending' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "rounded-lg p-4",
              isDark ? "bg-zinc-800 border border-zinc-700" : "bg-zinc-100 border border-zinc-200"
            )}
          >
            <h4 className={cn(
              "text-sm font-semibold mb-3 flex items-center gap-2",
              isDark ? "text-zinc-100" : "text-zinc-900"
            )}>
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
              Plan Approval Required
            </h4>

            <div className="space-y-2 mb-4">
              {plan.tasks.map((task, idx) => (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-start gap-2 text-sm",
                    isDark ? "text-zinc-300" : "text-zinc-700"
                  )}
                >
                  <span className={cn(
                    "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs",
                    isDark ? "bg-zinc-700" : "bg-zinc-200"
                  )}>
                    {idx + 1}
                  </span>
                  <div>
                    <div>{task.description}</div>
                    {task.files && task.files.length > 0 && (
                      <div className={cn(
                        "text-xs mt-1",
                        isDark ? "text-zinc-500" : "text-zinc-500"
                      )}>
                        Files: {task.files.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onApprovePlan}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve
              </button>
              <button
                onClick={onRejectPlan}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  isDark
                    ? "bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                    : "bg-zinc-200 hover:bg-zinc-300 text-zinc-800"
                )}
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </div>
          </motion.div>
        )}

        {/* 실행 중 표시 */}
        {isExecuting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-4"
          >
            <div className={cn(
              "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
              isDark ? "bg-blue-500/20" : "bg-blue-100"
            )}>
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            </div>
            <div className={cn(
              "text-sm",
              isDark ? "text-zinc-400" : "text-zinc-600"
            )}>
              Executing...
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className={cn(
        "flex-shrink-0 border-t px-4 py-3",
        isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"
      )}>
        {/* 이미지 프리뷰 */}
        {imagePreview && (
          <div className="relative mb-3 inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="h-20 rounded-lg"
            />
            <button
              onClick={() => setImagePreview(null)}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
            >
              <XCircle className="w-3 h-3" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "p-2 rounded-lg transition-colors",
              isDark
                ? "hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                : "hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600"
            )}
          >
            <Image className="w-5 h-5" />
          </button>

          <div className={cn(
            "flex-1 flex items-end rounded-lg border",
            isDark
              ? "bg-zinc-800 border-zinc-700"
              : "bg-white border-zinc-300"
          )}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="코드 작업을 설명하세요..."
              disabled={isExecuting}
              rows={1}
              className={cn(
                "flex-1 px-3 py-2 bg-transparent resize-none outline-none text-sm",
                isDark
                  ? "text-zinc-100 placeholder-zinc-500"
                  : "text-zinc-900 placeholder-zinc-400"
              )}
            />
          </div>

          {isExecuting ? (
            <button
              type="button"
              onClick={onCancel}
              className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              <StopCircle className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() && !imagePreview}
              className={cn(
                "p-2 rounded-lg transition-colors",
                input.trim() || imagePreview
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : isDark
                    ? "bg-zinc-800 text-zinc-600"
                    : "bg-zinc-200 text-zinc-400"
              )}
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </form>

        <div className={cn(
          "flex items-center justify-center mt-2 text-xs",
          isDark ? "text-zinc-600" : "text-zinc-400"
        )}>
          <kbd className={cn(
            "px-1.5 py-0.5 rounded",
            isDark ? "bg-zinc-800" : "bg-zinc-200"
          )}>
            Enter
          </kbd>
          <span className="mx-1">to send,</span>
          <kbd className={cn(
            "px-1.5 py-0.5 rounded",
            isDark ? "bg-zinc-800" : "bg-zinc-200"
          )}>
            Shift+Enter
          </kbd>
          <span className="mx-1">for new line</span>
        </div>
      </div>
    </div>
  )
}

export default AgentChatPanel
