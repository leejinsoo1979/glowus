'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  X,
  Reply,
  Forward,
  Trash2,
  Star,
  Bot,
  Sparkles,
  Send,
  Loader2,
  ArrowLeft,
  Paperclip,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import type { EmailMessage, EmailPriority, EmailSentiment } from '@/types/email'

interface EmailViewerProps {
  email: EmailMessage
  onClose: () => void
  onReply: (email: EmailMessage) => void
  onForward: (email: EmailMessage) => void
  onDelete: (emailId: string) => void
  onStar: (emailId: string, starred: boolean) => void
  onGenerateReply: (email: EmailMessage) => void
  isGeneratingReply?: boolean
  generatedReply?: {
    subject: string
    body_text: string
    body_html: string
  } | null
}

const priorityColors: Record<EmailPriority, { bg: string; text: string }> = {
  urgent: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-400' },
  high: { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400' },
  normal: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' },
  low: { bg: 'bg-zinc-100 dark:bg-zinc-500/20', text: 'text-zinc-600 dark:text-zinc-400' },
}

const sentimentEmoji: Record<EmailSentiment, string> = {
  positive: '😊',
  neutral: '😐',
  negative: '😟',
}

export function EmailViewer({
  email,
  onClose,
  onReply,
  onForward,
  onDelete,
  onStar,
  onGenerateReply,
  isGeneratingReply = false,
  generatedReply,
}: EmailViewerProps) {
  const { accentColor } = useThemeStore()
  const [showReplyEditor, setShowReplyEditor] = useState(false)
  const [replyText, setReplyText] = useState('')

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col h-full bg-white dark:bg-zinc-900"
    >
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors lg:hidden"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onStar(email.id, !email.is_starred)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                email.is_starred
                  ? "text-yellow-500 hover:text-yellow-600"
                  : "text-zinc-400 hover:text-yellow-500"
              )}
            >
              <Star className={cn("w-5 h-5", email.is_starred && "fill-current")} />
            </button>
            <button
              onClick={() => onDelete(email.id)}
              className="p-2 rounded-lg text-zinc-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Subject */}
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white mb-3">
          {email.subject || '(제목 없음)'}
        </h1>

        {/* From */}
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-medium", accent.bg)}>
            {(email.from_name || email.from_address)[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-zinc-900 dark:text-white truncate">
              {email.from_name || email.from_address}
            </p>
            <p className="text-sm text-zinc-500 truncate">
              {email.from_address}
            </p>
          </div>
          <span className="text-sm text-zinc-400 flex-shrink-0">
            {formatDate(email.received_at || email.created_at)}
          </span>
        </div>

        {/* To */}
        {email.to_addresses && email.to_addresses.length > 0 && (
          <p className="text-sm text-zinc-500 mt-2">
            받는 사람: {email.to_addresses.map((a) => a.name || a.email).join(', ')}
          </p>
        )}
      </div>

      {/* AI Summary */}
      {email.ai_summary && (
        <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-start gap-3">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", accent.light)}>
              <Bot className={cn("w-4 h-4", accent.text)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-zinc-500">AI 분석</span>
                {email.ai_priority && (
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium",
                    priorityColors[email.ai_priority].bg,
                    priorityColors[email.ai_priority].text
                  )}>
                    {email.ai_priority === 'urgent' ? '긴급' : email.ai_priority === 'high' ? '높음' : email.ai_priority === 'low' ? '낮음' : '보통'}
                  </span>
                )}
                {email.ai_sentiment && (
                  <span className="text-sm">{sentimentEmoji[email.ai_sentiment]}</span>
                )}
                {email.ai_category && (
                  <span className="text-xs text-zinc-400">#{email.ai_category}</span>
                )}
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                {email.ai_summary}
              </p>
              {email.ai_action_required && (
                <div className="flex items-center gap-1 mt-2 text-orange-500 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>조치가 필요한 이메일입니다</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Body - Always Light Mode */}
      <div className="flex-1 overflow-y-auto p-4 bg-white">
        {/* Attachments */}
        {email.has_attachments && email.attachments && email.attachments.length > 0 && (
          <div className="mb-4 p-3 bg-zinc-100 rounded-xl">
            <div className="flex items-center gap-2 mb-2 text-sm text-zinc-500">
              <Paperclip className="w-4 h-4" />
              <span>첨부파일 ({email.attachments.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {email.attachments.map((att, i) => (
                <div
                  key={i}
                  className="px-3 py-2 bg-white rounded-lg text-sm text-zinc-700 border border-zinc-200"
                >
                  {att.filename}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Email Content - Always Light */}
        {email.body_html ? (
          <div
            className="prose prose-sm max-w-none text-zinc-900"
            dangerouslySetInnerHTML={{ __html: email.body_html }}
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700">
            {email.body_text}
          </pre>
        )}
      </div>

      {/* Generated Reply Preview */}
      {generatedReply && (
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">AI 생성 답장</span>
          </div>
          <div className="p-3 bg-white dark:bg-zinc-800 rounded-xl text-sm text-zinc-700 dark:text-zinc-300 mb-3">
            <p className="font-medium mb-1">{generatedReply.subject}</p>
            <p className="whitespace-pre-wrap">{generatedReply.body_text}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setReplyText(generatedReply.body_text)
                setShowReplyEditor(true)
              }}
              className={cn(
                "flex-1 px-4 py-2 rounded-xl font-medium text-white transition-all text-sm",
                accent.bg, accent.hover
              )}
            >
              수정 후 발송
            </button>
          </div>
        </div>
      )}

      {/* Reply Editor */}
      {showReplyEditor && (
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="답장을 작성하세요..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all resize-none mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowReplyEditor(false)}
              className="px-4 py-2 rounded-xl font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-sm"
            >
              취소
            </button>
            <button
              className={cn(
                "flex-1 px-4 py-2 rounded-xl font-medium text-white transition-all text-sm flex items-center justify-center gap-2",
                accent.bg, accent.hover
              )}
            >
              <Send className="w-4 h-4" />
              발송
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!showReplyEditor && !generatedReply && (
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex gap-2">
          <button
            onClick={() => onReply(email)}
            className="flex-1 px-4 py-2.5 rounded-xl font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Reply className="w-4 h-4" />
            답장
          </button>
          <button
            onClick={() => onForward(email)}
            className="flex-1 px-4 py-2.5 rounded-xl font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Forward className="w-4 h-4" />
            전달
          </button>
          <button
            onClick={() => onGenerateReply(email)}
            disabled={isGeneratingReply}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-xl font-medium text-white transition-all text-sm flex items-center justify-center gap-2",
              accent.bg, accent.hover,
              "disabled:opacity-50"
            )}
          >
            {isGeneratingReply ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            AI 답장
          </button>
        </div>
      )}
    </motion.div>
  )
}
