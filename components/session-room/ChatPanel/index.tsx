'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTheme } from 'next-themes'
import {
  Send,
  Paperclip,
  ChevronDown,
  Loader2,
  FileText,
  CornerDownRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MessageCard, type SessionMessage } from './MessageCard'
import { EvidenceTag, type Evidence } from './EvidenceTag'

export interface SessionParticipant {
  id: string
  name: string
  type: 'user' | 'agent'
  role?: string
  color?: string
  isActive?: boolean
}

interface ChatPanelProps {
  messages: SessionMessage[]
  participants: SessionParticipant[]
  currentUserId: string
  mode: 'meeting' | 'presentation' | 'debate' | 'free'
  isLoading?: boolean
  isSending?: boolean
  onSendMessage: (content: string, evidence?: Evidence[]) => void
  onEvidenceClick: (evidence: Evidence) => void
  typingParticipants?: string[]
  onConcludeRequest?: () => void
}

export function ChatPanel({
  messages,
  participants,
  currentUserId,
  mode,
  isLoading,
  isSending,
  onSendMessage,
  onEvidenceClick,
  typingParticipants = [],
  onConcludeRequest
}: ChatPanelProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [inputText, setInputText] = useState('')
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [evidenceMode, setEvidenceMode] = useState(false)

  // Auto-scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      })
    }
  }, [])

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  // Track scroll position
  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setShowScrollButton(!isNearBottom)
  }

  // Handle send
  const handleSend = () => {
    if (!inputText.trim() || isSending) return
    onSendMessage(inputText.trim())
    setInputText('')
    inputRef.current?.focus()
  }

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Get participant by ID
  const getParticipant = (id: string) => participants.find(p => p.id === id)

  // Mode-specific placeholder
  const getPlaceholder = () => {
    switch (mode) {
      case 'meeting': return '의견을 입력하세요...'
      case 'presentation': return '질문을 입력하세요...'
      case 'debate': return '주장 또는 반론을 입력하세요...'
      default: return '메시지를 입력하세요...'
    }
  }

  return (
    <div className={cn(
      'h-full flex flex-col',
      isDark ? 'bg-neutral-900' : 'bg-white'
    )}>
      {/* Header */}
      <div className={cn(
        'flex-shrink-0 flex items-center justify-between px-4 py-3 border-b',
        isDark ? 'border-neutral-800' : 'border-neutral-200'
      )}>
        <div className="flex items-center gap-3">
          <span className={cn(
            'text-sm font-medium',
            isDark ? 'text-neutral-200' : 'text-neutral-800'
          )}>
            {mode === 'meeting' && '회의'}
            {mode === 'presentation' && '발표'}
            {mode === 'debate' && '토론'}
            {mode === 'free' && '자유 대화'}
          </span>

          {/* Participant count */}
          <span className={cn(
            'text-xs px-2 py-0.5 rounded',
            isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-100 text-neutral-600'
          )}>
            {participants.length}명
          </span>
        </div>

        {/* Conclude Button (for meeting/debate modes) */}
        {(mode === 'meeting' || mode === 'debate') && onConcludeRequest && (
          <button
            onClick={onConcludeRequest}
            className={cn(
              'px-3 py-1.5 rounded text-xs font-medium transition-colors',
              isDark
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
            )}
          >
            결론 도출
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className={cn(
              'w-5 h-5 animate-spin',
              isDark ? 'text-neutral-500' : 'text-neutral-400'
            )} />
          </div>
        ) : messages.length === 0 ? (
          <div className={cn(
            'flex flex-col items-center justify-center py-12 text-center',
            isDark ? 'text-neutral-500' : 'text-neutral-400'
          )}>
            <FileText className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">아직 메시지가 없습니다</p>
            <p className="text-xs mt-1">대화를 시작하세요</p>
          </div>
        ) : (
          messages.map((message, idx) => (
            <MessageCard
              key={message.id}
              message={message}
              participant={getParticipant(message.participantId)}
              isOwn={message.participantId === currentUserId}
              onEvidenceClick={onEvidenceClick}
              showAvatar={idx === 0 || messages[idx - 1].participantId !== message.participantId}
            />
          ))
        )}

        {/* Typing Indicators */}
        {typingParticipants.length > 0 && (
          <div className={cn(
            'flex items-center gap-2 text-xs',
            isDark ? 'text-neutral-500' : 'text-neutral-400'
          )}>
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>
              {typingParticipants.map(id => getParticipant(id)?.name).filter(Boolean).join(', ')} 입력 중...
            </span>
          </div>
        )}
      </div>

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom()}
          className={cn(
            'absolute bottom-24 right-4 p-2 rounded-full shadow-lg transition-all',
            isDark
              ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
              : 'bg-white hover:bg-neutral-50 text-neutral-600 border border-neutral-200'
          )}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}

      {/* Input Area */}
      <div className={cn(
        'flex-shrink-0 border-t',
        isDark ? 'border-neutral-800' : 'border-neutral-200'
      )}>
        {/* Evidence Mode Toggle */}
        <div className={cn(
          'flex items-center gap-2 px-4 py-2 border-b',
          isDark ? 'border-neutral-800/50' : 'border-neutral-100'
        )}>
          <button
            onClick={() => setEvidenceMode(!evidenceMode)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
              evidenceMode
                ? isDark
                  ? 'bg-amber-900/30 text-amber-400'
                  : 'bg-amber-50 text-amber-600'
                : isDark
                  ? 'text-neutral-500 hover:text-neutral-300'
                  : 'text-neutral-400 hover:text-neutral-600'
            )}
          >
            <CornerDownRight className="w-3 h-3" />
            자료 기반 답변
          </button>

          {evidenceMode && (
            <span className={cn(
              'text-xs',
              isDark ? 'text-neutral-500' : 'text-neutral-400'
            )}>
              에이전트가 근거를 명시합니다
            </span>
          )}
        </div>

        {/* Text Input */}
        <div className="flex items-end gap-2 p-3">
          <button
            className={cn(
              'p-2 rounded transition-colors',
              isDark
                ? 'hover:bg-neutral-800 text-neutral-500'
                : 'hover:bg-neutral-100 text-neutral-400'
            )}
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <div className={cn(
            'flex-1 rounded-lg border transition-colors',
            isDark
              ? 'bg-neutral-800/50 border-neutral-700 focus-within:border-neutral-600'
              : 'bg-neutral-50 border-neutral-200 focus-within:border-neutral-300'
          )}>
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholder()}
              rows={1}
              className={cn(
                'w-full px-3 py-2 text-sm resize-none bg-transparent focus:outline-none',
                isDark ? 'text-neutral-100 placeholder:text-neutral-500' : 'text-neutral-900 placeholder:text-neutral-400'
              )}
              style={{ maxHeight: '120px' }}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isSending}
            className={cn(
              'p-2 rounded-lg transition-colors disabled:opacity-40',
              isDark
                ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200'
                : 'bg-neutral-900 hover:bg-neutral-800 text-white'
            )}
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export { MessageCard } from './MessageCard'
export { EvidenceTag } from './EvidenceTag'
export type { SessionMessage } from './MessageCard'
export type { Evidence } from './EvidenceTag'
