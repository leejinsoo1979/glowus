'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Send,
  Loader2,
  Mail,
  Check,
  X,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import type { EmailAccount, EmailMessage } from '@/types/email'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  emailData?: EmailMessage
}

type Folder = 'inbox' | 'starred' | 'sent' | 'trash' | 'spam' | 'drafts' | 'all' | 'scheduled' | 'attachments'

interface PendingAiReply {
  to: string
  subject: string
  body: string
  originalEmail: EmailMessage
}

// 답장 유형 옵션
const REPLY_TYPE_OPTIONS = [
  { id: 'positive', label: '긍정적 수락', description: '요청을 수락하거나 긍정적으로 답변', icon: '👍' },
  { id: 'negative', label: '정중한 거절', description: '정중하게 거절하거나 어려움 표현', icon: '🙏' },
  { id: 'question', label: '추가 질문', description: '추가 정보나 명확한 설명 요청', icon: '❓' },
  { id: 'schedule', label: '일정 조율', description: '미팅이나 일정 관련 답변', icon: '📅' },
  { id: 'thankyou', label: '감사 인사', description: '감사 인사 및 확인 답변', icon: '🙂' },
  { id: 'formal', label: '공식적 답변', description: '격식체로 비즈니스 답변', icon: '📋' },
]

interface EmailSidebarChatProps {
  accounts: EmailAccount[]
  selectedAccount: EmailAccount | null
  onAccountChange: (account: EmailAccount) => void
  onAddAccount: () => void
  allEmails: EmailMessage[]
  visibleEmails: EmailMessage[] // 현재 화면에 보이는 필터된 이메일들
  currentFolder: Folder
  onFolderChange: (folder: Folder) => void
  onCompose: () => void
  onSync: () => void
  isSyncing: boolean
  selectedEmail?: EmailMessage | null
  onEmailSelect?: (email: EmailMessage | null) => void
  pendingAiReply?: PendingAiReply | null
  isGeneratingReply?: boolean
  onConfirmAiReply?: () => void
  onCancelAiReply?: () => void
  replyOptionsEmail?: EmailMessage | null
  onSelectReplyType?: (replyType: string) => void
  onCancelReplyOptions?: () => void
}


export function EmailSidebarChat({
  accounts,
  selectedAccount,
  onAccountChange,
  onAddAccount,
  allEmails,
  visibleEmails,
  currentFolder,
  onFolderChange,
  onCompose,
  onSync,
  isSyncing,
  selectedEmail,
  onEmailSelect,
  pendingAiReply,
  isGeneratingReply,
  onConfirmAiReply,
  onCancelAiReply,
  replyOptionsEmail,
  onSelectReplyType,
  onCancelReplyOptions,
}: EmailSidebarChatProps) {
  const { accentColor } = useThemeStore()
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: '안녕하세요, 이메일 AI 비서입니다.\n\n이메일에 대해 자유롭게 질문해주세요:\n• "안읽은 메일 요약해줘"\n• "오늘 온 메일 중 중요한 것은?"\n• "1번 메일 분석해줘"\n• "회의 관련 메일 찾아줘"',
      timestamp: new Date(),
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const getAccentClasses = () => {
    switch (accentColor) {
      case 'purple': return { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', light: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400' }
      case 'blue': return { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', light: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' }
      case 'green': return { bg: 'bg-green-500', hover: 'hover:bg-green-600', light: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-600 dark:text-green-400' }
      case 'orange': return { bg: 'bg-orange-500', hover: 'hover:bg-orange-600', light: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400' }
      case 'pink': return { bg: 'bg-pink-500', hover: 'hover:bg-pink-600', light: 'bg-pink-100 dark:bg-pink-500/20', text: 'text-pink-600 dark:text-pink-400' }
      case 'red': return { bg: 'bg-red-500', hover: 'hover:bg-red-600', light: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-400' }
      case 'yellow': return { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-600', light: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-600 dark:text-yellow-400' }
      case 'cyan': return { bg: 'bg-cyan-500', hover: 'hover:bg-cyan-600', light: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-600 dark:text-cyan-400' }
      default: return { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', light: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' }
    }
  }

  const accent = getAccentClasses()

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || isChatLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    }

    setChatMessages(prev => [...prev, userMessage])
    const currentInput = chatInput
    setChatInput('')
    setIsChatLoading(true)

    try {
      // Quick commands that don't need AI
      const input = currentInput.toLowerCase()

      // Folder navigation commands
      if (input.includes('동기화') || input.includes('새로고침') || input.includes('sync')) {
        onSync()
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '이메일을 동기화하고 있습니다...',
          timestamp: new Date(),
        }
        setChatMessages(prev => [...prev, assistantMessage])
        setIsChatLoading(false)
        return
      }

      if (input.includes('메일 쓰기') || input.includes('작성') || input === 'compose') {
        onCompose()
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '메일 작성 창을 열었습니다.',
          timestamp: new Date(),
        }
        setChatMessages(prev => [...prev, assistantMessage])
        setIsChatLoading(false)
        return
      }

      if (input.includes('닫') || input.includes('뒤로') || input === '목록') {
        onEmailSelect?.(null)
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '메일 뷰어를 닫았습니다.',
          timestamp: new Date(),
        }
        setChatMessages(prev => [...prev, assistantMessage])
        setIsChatLoading(false)
        return
      }

      // Call AI API for intelligent responses (현재 화면 기준)
      const res = await fetch('/api/email/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          account_id: selectedAccount?.id,
          selected_email_id: selectedEmail?.id,
          visible_email_ids: visibleEmails.map(e => e.id),
          current_folder: currentFolder,
        }),
      })

      if (res.ok) {
        const data = await res.json()

        // Find email to show if AI suggested one (현재 화면 기준)
        let emailToShow: EmailMessage | undefined
        if (data.email_to_show) {
          emailToShow = visibleEmails.find(e => e.id === data.email_to_show)
        }

        // Also check user input for email number pattern (현재 화면 기준)
        const showEmailMatch = currentInput.match(/(\d+)\s*(번|번째)?\s*(메일|보여|읽|열|확인)?/)
        if (showEmailMatch && !emailToShow) {
          const emailNum = parseInt(showEmailMatch[1])
          if (emailNum > 0 && emailNum <= visibleEmails.length) {
            emailToShow = visibleEmails[emailNum - 1]
          }
        }

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          emailData: emailToShow,
        }
        setChatMessages(prev => [...prev, assistantMessage])

        if (emailToShow) {
          onEmailSelect?.(emailToShow)
        }
      } else {
        // Fallback to simple response
        const errorData = await res.json()
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: errorData.error || 'AI 응답을 받지 못했습니다. 다시 시도해주세요.',
          timestamp: new Date(),
        }
        setChatMessages(prev => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('Chat error:', error)
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, assistantMessage])
    } finally {
      setIsChatLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <h2 className="font-semibold text-zinc-900 dark:text-white text-base">이메일 AI</h2>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {chatMessages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                "max-w-[90%] px-3 py-2 rounded-xl text-sm",
                message.role === 'user'
                  ? cn(accent.bg, "text-white rounded-br-sm")
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-bl-sm"
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              {message.emailData && (
                <button
                  onClick={() => onEmailSelect?.(message.emailData!)}
                  className="mt-2 flex items-center gap-1.5 text-xs underline opacity-80 hover:opacity-100"
                >
                  <Mail className="w-3.5 h-3.5" />
                  메일 보기
                </button>
              )}
            </div>
          </div>
        ))}
        {isChatLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-xl rounded-bl-sm">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
            </div>
          </div>
        )}

        {/* Reply Type Options */}
        {replyOptionsEmail && !isGeneratingReply && !pendingAiReply && (
          <div className="flex justify-start">
            <div className="max-w-[95%] rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-800 dark:to-zinc-800/80 border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              {/* Header */}
              <div className={cn("px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2", accent.light)}>
                <Sparkles className={cn("w-4 h-4", accent.text)} />
                <span className={cn("text-sm font-medium", accent.text)}>답장 유형 선택</span>
              </div>

              {/* Email Info */}
              <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-700/50">
                <p className="text-xs text-zinc-500 truncate">
                  {replyOptionsEmail.from_name || replyOptionsEmail.from_address}
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 truncate font-medium">
                  {replyOptionsEmail.subject || '(제목 없음)'}
                </p>
              </div>

              {/* Options */}
              <div className="p-2 space-y-1.5">
                {REPLY_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => onSelectReplyType?.(option.id)}
                    className="w-full px-3 py-2.5 rounded-lg text-left hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{option.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white">
                          {option.label}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Cancel */}
              <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-700">
                <button
                  onClick={onCancelReplyOptions}
                  className="w-full px-3 py-2 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Reply Generation Loading */}
        {isGeneratingReply && !pendingAiReply && (
          <div className="flex justify-start">
            <div className={cn("max-w-[90%] px-3 py-2.5 rounded-xl rounded-bl-sm", accent.light)}>
              <div className="flex items-center gap-2">
                <Sparkles className={cn("w-4 h-4 animate-pulse", accent.text)} />
                <span className={cn("text-sm font-medium", accent.text)}>AI 답장 생성 중...</span>
              </div>
            </div>
          </div>
        )}

        {/* Pending AI Reply */}
        {pendingAiReply && (
          <div className="flex justify-start">
            <div className="max-w-[95%] rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-800 dark:to-zinc-800/80 border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              {/* Header */}
              <div className={cn("px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2", accent.light)}>
                <Sparkles className={cn("w-4 h-4", accent.text)} />
                <span className={cn("text-sm font-medium", accent.text)}>AI 답장</span>
              </div>

              {/* Reply Info */}
              <div className="px-3 py-2 space-y-1 text-sm">
                <p className="text-zinc-500">
                  <span className="font-medium">받는 사람:</span> {pendingAiReply.to}
                </p>
                <p className="text-zinc-500">
                  <span className="font-medium">제목:</span> {pendingAiReply.subject}
                </p>
              </div>

              {/* Reply Body */}
              <div className="px-3 py-2 border-t border-zinc-100 dark:border-zinc-700/50">
                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                  {pendingAiReply.body}
                </p>
              </div>

              {/* Actions */}
              <div className="px-3 py-2.5 border-t border-zinc-200 dark:border-zinc-700 flex gap-2">
                <button
                  onClick={onConfirmAiReply}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-1.5 transition-colors",
                    accent.bg, accent.hover
                  )}
                >
                  <Check className="w-4 h-4" />
                  메일에 적용
                </button>
                <button
                  onClick={onCancelAiReply}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <X className="w-4 h-4" />
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Quick Options */}
      <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-1.5">
        {[
          { label: '번역', prompt: '이 메일 한글로 번역해줘' },
          { label: '요약', prompt: '이 메일 요약해줘' },
          { label: '분석', prompt: '이 메일 분석해줘' },
          { label: '긴급도', prompt: '이 메일 긴급한거야?' },
          { label: '답장필요?', prompt: '이 메일 답장해야 해?' },
        ].map((opt) => (
          <button
            key={opt.label}
            onClick={async () => {
              if (!selectedEmail) {
                setChatMessages(prev => [...prev, {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: '먼저 메일을 선택해주세요.',
                  timestamp: new Date(),
                }])
                return
              }
              const userMessage: ChatMessage = {
                id: Date.now().toString(),
                role: 'user',
                content: opt.prompt,
                timestamp: new Date(),
              }
              setChatMessages(prev => [...prev, userMessage])
              setIsChatLoading(true)
              try {
                const res = await fetch('/api/email/ai/chat', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    message: opt.prompt,
                    account_id: selectedAccount?.id,
                    selected_email_id: selectedEmail?.id,
                    visible_email_ids: visibleEmails.map(e => e.id),
                    current_folder: currentFolder,
                  }),
                })
                if (res.ok) {
                  const data = await res.json()
                  setChatMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: data.response,
                    timestamp: new Date(),
                  }])
                } else {
                  setChatMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: '오류가 발생했습니다.',
                    timestamp: new Date(),
                  }])
                }
              } catch {
                setChatMessages(prev => [...prev, {
                  id: (Date.now() + 1).toString(),
                  role: 'assistant',
                  content: '오류가 발생했습니다.',
                  timestamp: new Date(),
                }])
              } finally {
                setIsChatLoading(false)
              }
            }}
            disabled={isChatLoading}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors disabled:opacity-50"
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Chat Input */}
      <form onSubmit={handleChatSubmit} className="p-3 pt-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="이메일에 대해 질문하세요..."
            className="flex-1 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 text-sm focus:outline-none"
          />
          <button
            type="submit"
            disabled={isChatLoading || !chatInput.trim()}
            className={cn(
              "px-4 py-3 rounded-xl transition-colors disabled:opacity-50",
              accent.bg, accent.hover, "text-white"
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  )
}
