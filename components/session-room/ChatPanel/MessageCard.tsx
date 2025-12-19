'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { Copy, Check, MoreHorizontal, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EvidenceTag, type Evidence } from './EvidenceTag'
import type { SessionParticipant } from './index'

export interface SessionMessage {
  id: string
  participantId: string
  content: string
  timestamp: Date
  evidence?: Evidence[]
  confidence?: number // 0-1
  isSystemMessage?: boolean
  replyTo?: string
  role?: 'claim' | 'rebuttal' | 'question' | 'answer' | 'conclusion'
}

interface MessageCardProps {
  message: SessionMessage
  participant?: SessionParticipant
  isOwn: boolean
  onEvidenceClick: (evidence: Evidence) => void
  showAvatar?: boolean
}

export function MessageCard({
  message,
  participant,
  isOwn,
  onEvidenceClick,
  showAvatar = true
}: MessageCardProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [copied, setCopied] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const isAgent = participant?.type === 'agent'
  const hasEvidence = message.evidence && message.evidence.length > 0

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(date))
  }

  // Role badge styles
  const getRoleBadgeStyle = () => {
    switch (message.role) {
      case 'claim':
        return isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'
      case 'rebuttal':
        return isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'
      case 'question':
        return isDark ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-600'
      case 'answer':
        return isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-600'
      case 'conclusion':
        return isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-600'
      default:
        return ''
    }
  }

  const getRoleBadgeText = () => {
    switch (message.role) {
      case 'claim': return '주장'
      case 'rebuttal': return '반론'
      case 'question': return '질문'
      case 'answer': return '답변'
      case 'conclusion': return '결론'
      default: return null
    }
  }

  // System message
  if (message.isSystemMessage) {
    return (
      <div className={cn(
        'flex justify-center my-4',
      )}>
        <span className={cn(
          'px-3 py-1 rounded-full text-xs',
          isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-100 text-neutral-500'
        )}>
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div className={cn(
      'group flex gap-3',
      isOwn && 'flex-row-reverse'
    )}>
      {/* Avatar */}
      {showAvatar ? (
        <div className={cn(
          'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium',
          isAgent
            ? isDark
              ? 'bg-neutral-800 text-neutral-300'
              : 'bg-neutral-200 text-neutral-700'
            : isDark
              ? 'bg-neutral-700 text-neutral-200'
              : 'bg-neutral-300 text-neutral-800'
        )}>
          {participant?.name?.slice(0, 2) || '??'}
        </div>
      ) : (
        <div className="w-8" />
      )}

      {/* Content */}
      <div className={cn(
        'flex-1 max-w-[85%]',
        isOwn && 'flex flex-col items-end'
      )}>
        {/* Header */}
        {showAvatar && (
          <div className={cn(
            'flex items-center gap-2 mb-1',
            isOwn && 'flex-row-reverse'
          )}>
            <span className={cn(
              'text-xs font-medium',
              isDark ? 'text-neutral-300' : 'text-neutral-700'
            )}>
              {participant?.name || 'Unknown'}
            </span>

            {isAgent && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded',
                isDark ? 'bg-neutral-800 text-neutral-500' : 'bg-neutral-100 text-neutral-500'
              )}>
                Agent
              </span>
            )}

            {participant?.role && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded',
                isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-100 text-neutral-500'
              )}>
                {participant.role}
              </span>
            )}

            {message.role && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded',
                getRoleBadgeStyle()
              )}>
                {getRoleBadgeText()}
              </span>
            )}

            <span className={cn(
              'text-[10px]',
              isDark ? 'text-neutral-600' : 'text-neutral-400'
            )}>
              {formatTime(message.timestamp)}
            </span>
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={cn(
            'relative rounded-lg px-3 py-2',
            isOwn
              ? isDark
                ? 'bg-neutral-700'
                : 'bg-neutral-200'
              : isDark
                ? 'bg-neutral-800'
                : 'bg-neutral-100'
          )}
          onMouseEnter={() => setShowMenu(true)}
          onMouseLeave={() => setShowMenu(false)}
        >
          {/* Content */}
          <p className={cn(
            'text-sm whitespace-pre-wrap',
            isDark ? 'text-neutral-100' : 'text-neutral-900'
          )}>
            {message.content}
          </p>

          {/* Evidence Tags */}
          {hasEvidence && (
            <div className={cn(
              'flex flex-wrap gap-1.5 mt-2 pt-2 border-t',
              isDark ? 'border-neutral-700' : 'border-neutral-200'
            )}>
              {message.evidence!.map((ev, idx) => (
                <EvidenceTag
                  key={idx}
                  evidence={ev}
                  onClick={() => onEvidenceClick(ev)}
                />
              ))}
            </div>
          )}

          {/* Confidence indicator (for agents) */}
          {isAgent && typeof message.confidence === 'number' && (
            <div className={cn(
              'flex items-center gap-1.5 mt-2 pt-2 border-t',
              isDark ? 'border-neutral-700' : 'border-neutral-200'
            )}>
              <div className={cn(
                'h-1 flex-1 rounded-full overflow-hidden',
                isDark ? 'bg-neutral-700' : 'bg-neutral-200'
              )}>
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    message.confidence > 0.7
                      ? 'bg-emerald-500'
                      : message.confidence > 0.4
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  )}
                  style={{ width: `${message.confidence * 100}%` }}
                />
              </div>
              <span className={cn(
                'text-[10px]',
                isDark ? 'text-neutral-500' : 'text-neutral-400'
              )}>
                {Math.round(message.confidence * 100)}%
              </span>
            </div>
          )}

          {/* Warning if agent claims without evidence */}
          {isAgent && !hasEvidence && message.content.match(/확인|봤|분석|검토/) && (
            <div className={cn(
              'flex items-center gap-1.5 mt-2 pt-2 border-t',
              isDark ? 'border-neutral-700' : 'border-neutral-200'
            )}>
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span className={cn(
                'text-[10px] text-amber-500'
              )}>
                근거 없이 확인했다고 주장
              </span>
            </div>
          )}

          {/* Action Menu */}
          {showMenu && (
            <div className={cn(
              'absolute -top-1 -right-1 flex items-center gap-0.5 p-0.5 rounded',
              isDark ? 'bg-neutral-900' : 'bg-white shadow-sm'
            )}>
              <button
                onClick={handleCopy}
                className={cn(
                  'p-1 rounded transition-colors',
                  isDark
                    ? 'hover:bg-neutral-800 text-neutral-400'
                    : 'hover:bg-neutral-100 text-neutral-500'
                )}
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              <button
                className={cn(
                  'p-1 rounded transition-colors',
                  isDark
                    ? 'hover:bg-neutral-800 text-neutral-400'
                    : 'hover:bg-neutral-100 text-neutral-500'
                )}
              >
                <MoreHorizontal className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
