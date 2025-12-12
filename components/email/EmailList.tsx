'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Star,
  Trash2,
  RefreshCw,
  Search,
  Bot,
  AlertCircle,
  Clock,
  Paperclip,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import type { EmailMessage, EmailPriority } from '@/types/email'

interface EmailListProps {
  emails: EmailMessage[]
  selectedEmail?: EmailMessage | null
  onSelectEmail: (email: EmailMessage) => void
  onRefresh: () => void
  onStar: (emailId: string, starred: boolean) => void
  onDelete: (emailId: string) => void
  onMarkRead: (emailId: string, read: boolean) => void
  isLoading?: boolean
}

const priorityColors: Record<EmailPriority, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  normal: 'bg-blue-500',
  low: 'bg-zinc-400',
}

const priorityLabels: Record<EmailPriority, string> = {
  urgent: '긴급',
  high: '높음',
  normal: '보통',
  low: '낮음',
}

export function EmailList({
  emails,
  selectedEmail,
  onSelectEmail,
  onRefresh,
  onStar,
  onDelete,
  onMarkRead,
  isLoading = false,
}: EmailListProps) {
  const { accentColor } = useThemeStore()
  const [searchQuery, setSearchQuery] = useState('')

  const getAccentClasses = () => {
    switch (accentColor) {
      case 'purple': return { bg: 'bg-purple-500', light: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500' }
      case 'blue': return { bg: 'bg-blue-500', light: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500' }
      case 'green': return { bg: 'bg-green-500', light: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-600 dark:text-green-400', border: 'border-green-500' }
      case 'orange': return { bg: 'bg-orange-500', light: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500' }
      case 'pink': return { bg: 'bg-pink-500', light: 'bg-pink-100 dark:bg-pink-500/20', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-500' }
      case 'red': return { bg: 'bg-red-500', light: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-400', border: 'border-red-500' }
      case 'yellow': return { bg: 'bg-yellow-500', light: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-500' }
      case 'cyan': return { bg: 'bg-cyan-500', light: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500' }
      default: return { bg: 'bg-blue-500', light: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500' }
    }
  }

  const accent = getAccentClasses()

  const filteredEmails = searchQuery
    ? emails.filter(
        (e) =>
          e.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.from_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.from_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : emails

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return '어제'
    } else if (days < 7) {
      return `${days}일 전`
    } else {
      return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search & Actions */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이메일 검색..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all text-sm"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {filteredEmails.length}개의 이메일
          </span>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto">
        {filteredEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400 py-12">
            <Mail className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">이메일이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            <AnimatePresence>
              {filteredEmails.map((email) => (
                <motion.div
                  key={email.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => onSelectEmail(email)}
                  className={cn(
                    "relative p-4 cursor-pointer transition-colors group",
                    selectedEmail?.id === email.id
                      ? cn("bg-zinc-100 dark:bg-zinc-800", `border-l-2 ${accent.border}`)
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-l-2 border-transparent",
                    !email.is_read && "bg-blue-50/50 dark:bg-blue-900/10"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Unread indicator */}
                    {!email.is_read && (
                      <div className={cn("w-2 h-2 rounded-full mt-2 flex-shrink-0", accent.bg)} />
                    )}

                    <div className="flex-1 min-w-0">
                      {/* From & Date */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={cn(
                          "text-sm truncate",
                          !email.is_read ? "font-semibold text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-300"
                        )}>
                          {email.from_name || email.from_address}
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {email.ai_priority && email.ai_priority !== 'normal' && (
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-medium text-white",
                              priorityColors[email.ai_priority]
                            )}>
                              {priorityLabels[email.ai_priority]}
                            </span>
                          )}
                          <span className="text-xs text-zinc-400">
                            {formatDate(email.received_at || email.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Subject */}
                      <p className={cn(
                        "text-sm truncate mb-1",
                        !email.is_read ? "font-medium text-zinc-800 dark:text-zinc-200" : "text-zinc-600 dark:text-zinc-400"
                      )}>
                        {email.subject || '(제목 없음)'}
                      </p>

                      {/* Preview */}
                      <p className="text-xs text-zinc-500 dark:text-zinc-500 line-clamp-1">
                        {email.snippet || email.body_text?.substring(0, 100)}
                      </p>

                      {/* Indicators */}
                      <div className="flex items-center gap-2 mt-2">
                        {email.has_attachments && (
                          <Paperclip className="w-3 h-3 text-zinc-400" />
                        )}
                        {email.ai_action_required && (
                          <span className="flex items-center gap-1 text-[10px] text-orange-500">
                            <AlertCircle className="w-3 h-3" />
                            조치 필요
                          </span>
                        )}
                        {email.ai_summary && (
                          <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                            <Bot className="w-3 h-3" />
                            AI 분석됨
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onStar(email.id, !email.is_starred)
                        }}
                        className={cn(
                          "p-1.5 rounded-lg transition-colors",
                          email.is_starred
                            ? "text-yellow-500 hover:text-yellow-600"
                            : "text-zinc-400 hover:text-yellow-500"
                        )}
                      >
                        <Star className={cn("w-4 h-4", email.is_starred && "fill-current")} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(email.id)
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Chevron */}
                    <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 flex-shrink-0 mt-1" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
