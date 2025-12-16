'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Send,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import type { EmailAccount, EmailMessage } from '@/types/email'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

type Folder = 'inbox' | 'starred' | 'sent' | 'trash' | 'spam' | 'drafts' | 'all' | 'scheduled' | 'attachments'

interface EmailSidebarChatProps {
  accounts: EmailAccount[]
  selectedAccount: EmailAccount | null
  onAccountChange: (account: EmailAccount) => void
  onAddAccount: () => void
  allEmails: EmailMessage[]
  currentFolder: Folder
  onFolderChange: (folder: Folder) => void
  onCompose: () => void
  onSync: () => void
  isSyncing: boolean
}


export function EmailSidebarChat({
  accounts,
  selectedAccount,
  onAccountChange,
  onAddAccount,
  allEmails,
  currentFolder,
  onFolderChange,
  onCompose,
  onSync,
  isSyncing,
}: EmailSidebarChatProps) {
  const { accentColor } = useThemeStore()
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: '안녕하세요! 대화로 이메일을 제어해보세요.\n\n"안읽은 메일" "오늘 온 메일"\n"요약해줘" "검색 [키워드]"',
      timestamp: new Date(),
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Email counts
  const unreadCount = allEmails.filter((e) => !e.is_read && !e.is_trash && !e.is_sent).length
  const starredCount = allEmails.filter((e) => e.is_starred && !e.is_trash).length
  const attachmentCount = allEmails.filter((e) => e.has_attachments && !e.is_trash).length
  const allCount = allEmails.filter((e) => !e.is_trash).length
  const inboxCount = allEmails.filter((e) => !e.is_trash && !e.is_sent && !(e as any).is_spam).length
  const sentCount = allEmails.filter((e) => e.is_sent && !e.is_trash).length
  const spamCount = allEmails.filter((e) => (e as any).is_spam && !e.is_trash).length
  const trashCount = allEmails.filter((e) => e.is_trash).length
  const draftsCount = allEmails.filter((e) => (e as any).is_draft && !e.is_trash).length

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
    setChatInput('')
    setIsChatLoading(true)

    const input = chatInput.toLowerCase()
    let response = ''

    // Folder navigation
    if (input.includes('받은') && (input.includes('메일') || input.includes('편지'))) {
      onFolderChange('inbox')
      response = `받은메일함 (${inboxCount}개)`
    } else if (input.includes('보낸') && (input.includes('메일') || input.includes('편지'))) {
      onFolderChange('sent')
      response = `보낸메일함 (${sentCount}개)`
    } else if (input.includes('휴지통') || input.includes('삭제')) {
      onFolderChange('trash')
      response = `휴지통 (${trashCount}개)`
    } else if (input.includes('스팸') || input.includes('spam')) {
      onFolderChange('spam')
      response = `스팸함 (${spamCount}개)`
    } else if (input.includes('임시') || input.includes('초안') || input.includes('draft')) {
      onFolderChange('drafts')
      response = `임시보관함 (${draftsCount}개)`
    } else if (input.includes('전체') && input.includes('메일')) {
      onFolderChange('all')
      response = `전체메일 (${allCount}개)`
    } else if (input.includes('읽지 않은') || input.includes('안읽은')) {
      const unread = allEmails.filter(e => !e.is_read && !e.is_trash)
      response = `읽지 않은 메일 ${unread.length}개`
      if (unread.length > 0) {
        unread.slice(0, 3).forEach((email, i) => {
          response += `\n${i + 1}. ${email.from_name || email.from_address}`
        })
      }
    } else if (input.includes('중요') || input.includes('별표') || input.includes('starred')) {
      onFolderChange('starred')
      response = `중요메일 (${starredCount}개)`
    } else if (input.includes('첨부') || input.includes('파일')) {
      onFolderChange('attachments')
      response = `첨부파일메일 (${attachmentCount}개)`
    } else if (input.includes('요약') || input.includes('정리')) {
      response = `현황\n• 전체: ${allCount}개\n• 안읽음: ${unreadCount}개\n• 중요: ${starredCount}개\n• 첨부: ${attachmentCount}개`
    } else if (input.includes('오늘')) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayEmails = allEmails.filter(e => {
        const emailDate = new Date(e.received_at || e.created_at)
        return emailDate >= today && !e.is_trash
      })
      response = `오늘 받은 메일 ${todayEmails.length}개`
    } else if (input.includes('검색') || input.includes('찾아')) {
      const searchTerm = input.replace(/검색|찾아|줘|해줘|보여/g, '').trim()
      if (searchTerm) {
        const results = allEmails.filter(e =>
          (e.subject?.toLowerCase().includes(searchTerm) ||
           e.from_name?.toLowerCase().includes(searchTerm) ||
           e.from_address?.toLowerCase().includes(searchTerm)) &&
          !e.is_trash
        )
        response = `"${searchTerm}" 검색: ${results.length}개`
      } else {
        response = '검색어를 입력해주세요'
      }
    } else if (input.includes('동기화') || input.includes('새로고침') || input.includes('sync')) {
      onSync()
      response = '동기화 중...'
    } else if (input.includes('메일 쓰기') || input.includes('작성') || input.includes('compose')) {
      onCompose()
      response = '메일 작성'
    } else {
      response = `"받은메일" "보낸메일" "휴지통"\n"안읽은 메일" "첨부파일"\n"요약해줘"`
    }

    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, assistantMessage])
      setIsChatLoading(false)
    }, 300)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <h2 className="font-semibold text-zinc-900 dark:text-white text-sm">이메일 AI</h2>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
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
                "max-w-[90%] px-2.5 py-1.5 rounded-xl text-xs",
                message.role === 'user'
                  ? cn(accent.bg, "text-white rounded-br-sm")
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-bl-sm"
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            </div>
          </div>
        ))}
        {isChatLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1.5 rounded-xl rounded-bl-sm">
              <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Chat Input */}
      <form onSubmit={handleChatSubmit} className="p-2 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="메일 명령..."
            className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 text-xs focus:outline-none"
          />
          <button
            type="submit"
            disabled={isChatLoading || !chatInput.trim()}
            className={cn(
              "px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50",
              accent.bg, accent.hover, "text-white"
            )}
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </form>
    </div>
  )
}
