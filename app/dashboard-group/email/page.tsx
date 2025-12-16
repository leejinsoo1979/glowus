'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Plus,
  Inbox,
  Star,
  Trash2,
  RefreshCw,
  Sparkles,
  Loader2,
  Paperclip,
  Reply,
  Forward,
  ArrowLeft,
  Bot,
  ChevronDown,
  MailOpen,
  AlertTriangle,
  FolderInput,
  ReplyAll,
  Check,
  Minus,
  MailX,
  Filter,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import { useUIStore } from '@/stores/uiStore'
import { Button } from '@/components/ui/Button'
import { EmailAccountModal, EmailAccountFormData } from '@/components/email/EmailAccountModal'
import { EmailFolderMenu } from '@/components/email/EmailFolderMenu'
import { EmailSidebarChat } from '@/components/email/EmailSidebarChat'
import { EmailCompose } from '@/components/email/EmailCompose'
import type { EmailAccount, EmailMessage } from '@/types/email'

type Folder = 'inbox' | 'starred' | 'sent' | 'trash' | 'spam' | 'drafts' | 'all' | 'scheduled' | 'attachments'

const folderLabels: Record<Folder, string> = {
  inbox: '받은메일',
  starred: '중요메일',
  sent: '보낸메일',
  trash: '휴지통',
  spam: '스팸',
  drafts: '임시보관함',
  all: '전체메일',
  scheduled: '예약메일',
  attachments: '첨부파일',
}

export default function EmailPage() {
  const searchParams = useSearchParams()
  const { accentColor } = useThemeStore()
  const { emailSidebarWidth, setEmailSidebarWidth, isResizingEmail, setIsResizingEmail } = useUIStore()
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null)
  const [emails, setEmails] = useState<EmailMessage[]>([])
  const [allEmails, setAllEmails] = useState<EmailMessage[]>([])
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null)

  // Get folder from URL params or state
  const folderParam = searchParams.get('folder') as Folder | null
  const [currentFolder, setCurrentFolder] = useState<Folder>(folderParam || 'inbox')
  const actionParam = searchParams.get('action')

  // Update folder from URL params
  useEffect(() => {
    if (folderParam && folderParam !== currentFolder) {
      setCurrentFolder(folderParam)
    }
  }, [folderParam])

  const [isAddModalOpen, setIsAddModalOpen] = useState(actionParam === 'add-account')
  const [isComposeOpen, setIsComposeOpen] = useState(actionParam === 'compose')
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isAddingAccount, setIsAddingAccount] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isGeneratingReply, setIsGeneratingReply] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [pendingAiReply, setPendingAiReply] = useState<{
    to: string
    subject: string
    body: string
    originalEmail: EmailMessage
  } | null>(null)
  // 답장 유형 선택을 위한 상태
  const [replyOptionsEmail, setReplyOptionsEmail] = useState<EmailMessage | null>(null)

  // Multi-select state
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set())

  // Filter state
  type EmailFilter = 'all' | 'unread' | 'starred' | 'attachments'
  const [activeFilter, setActiveFilter] = useState<EmailFilter>('all')

  // Toggle email selection
  const toggleEmailSelection = useCallback((emailId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSelectedEmailIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(emailId)) {
        newSet.delete(emailId)
      } else {
        newSet.add(emailId)
      }
      return newSet
    })
  }, [])

  // Select all / deselect all (based on current filter)
  const toggleSelectAll = useCallback(() => {
    const currentFiltered = emails.filter((email) => {
      switch (activeFilter) {
        case 'unread': return !email.is_read
        case 'starred': return email.is_starred
        case 'attachments': return email.has_attachments
        default: return true
      }
    })
    if (selectedEmailIds.size === currentFiltered.length) {
      setSelectedEmailIds(new Set())
    } else {
      setSelectedEmailIds(new Set(currentFiltered.map(e => e.id)))
    }
  }, [emails, activeFilter, selectedEmailIds.size])

  // Bulk actions
  const handleBulkStar = async () => {
    for (const emailId of Array.from(selectedEmailIds)) {
      await handleStar(emailId, true)
    }
    setSelectedEmailIds(new Set())
  }

  const handleBulkMarkRead = async () => {
    for (const emailId of Array.from(selectedEmailIds)) {
      await handleMarkRead(emailId, true)
    }
    setSelectedEmailIds(new Set())
  }

  const handleBulkDelete = async () => {
    for (const emailId of Array.from(selectedEmailIds)) {
      await handleDelete(emailId)
    }
    setSelectedEmailIds(new Set())
  }

  const handleBulkSpam = async () => {
    // Mark as spam - would need API support
    for (const emailId of Array.from(selectedEmailIds)) {
      try {
        await fetch('/api/email/messages', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email_id: emailId, action: 'spam' }),
        })
      } catch (error) {
        console.error('Failed to mark as spam:', error)
      }
    }
    setSelectedEmailIds(new Set())
    fetchEmails()
  }

  // Chat sidebar resize handlers
  const handleChatResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingEmail(true)
  }, [setIsResizingEmail])

  useEffect(() => {
    if (!isResizingEmail) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      const minWidth = 280
      const maxWidth = 500
      setEmailSidebarWidth(Math.min(Math.max(newWidth, minWidth), maxWidth))
    }

    const handleMouseUp = () => {
      setIsResizingEmail(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingEmail, setEmailSidebarWidth, setIsResizingEmail])

  // Email counts
  const unreadCount = allEmails.filter((e) => !e.is_read && !e.is_trash && !e.is_sent).length

  // Filtered emails based on active filter
  const filteredEmails = emails.filter((email) => {
    switch (activeFilter) {
      case 'unread':
        return !email.is_read
      case 'starred':
        return email.is_starred
      case 'attachments':
        return email.has_attachments
      default:
        return true
    }
  })

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

  // Handle action params
  useEffect(() => {
    if (actionParam === 'add-account') {
      setIsAddModalOpen(true)
    } else if (actionParam === 'compose') {
      setIsComposeOpen(true)
    }
  }, [actionParam])

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/email/accounts')
      if (res.ok) {
        const data = await res.json()
        setAccounts(data)
        if (data.length > 0 && !selectedAccount) {
          setSelectedAccount(data[0])
        }
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
    }
  }, [selectedAccount])

  // Fetch emails
  const fetchEmails = useCallback(async () => {
    if (!selectedAccount) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/email/messages?account_id=${selectedAccount.id}`)
      if (res.ok) {
        let data = await res.json()
        setAllEmails(data)

        // Client-side filtering based on folder
        if (currentFolder === 'starred') {
          data = data.filter((e: EmailMessage) => e.is_starred && !e.is_trash)
        } else if (currentFolder === 'sent') {
          data = data.filter((e: EmailMessage) => e.is_sent && !e.is_trash)
        } else if (currentFolder === 'trash') {
          data = data.filter((e: EmailMessage) => e.is_trash)
        } else if (currentFolder === 'spam') {
          data = data.filter((e: EmailMessage) => (e as any).is_spam && !e.is_trash)
        } else if (currentFolder === 'drafts') {
          data = data.filter((e: EmailMessage) => (e as any).is_draft && !e.is_trash)
        } else if (currentFolder === 'all') {
          data = data.filter((e: EmailMessage) => !e.is_trash)
        } else if (currentFolder === 'attachments') {
          data = data.filter((e: EmailMessage) => e.has_attachments && !e.is_trash)
        } else {
          // inbox
          data = data.filter((e: EmailMessage) => !e.is_trash && !e.is_sent && !(e as any).is_spam && !(e as any).is_draft)
        }

        setEmails(data)
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedAccount, currentFolder])

  // Sync emails
  const syncEmails = async () => {
    if (!selectedAccount) return

    setIsSyncing(true)
    try {
      const res = await fetch('/api/email/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: selectedAccount.id }),
      })

      if (res.ok) {
        await fetchEmails()
      }
    } catch (error) {
      console.error('Failed to sync emails:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  // Add account
  const handleAddAccount = async (data: EmailAccountFormData) => {
    setIsAddingAccount(true)
    try {
      const res = await fetch('/api/email/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const account = await res.json()
        setAccounts([...accounts, account])
        setSelectedAccount(account)
        setIsAddModalOpen(false)

        // Sync emails for new account
        setIsSyncing(true)
        try {
          await fetch('/api/email/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account_id: account.id }),
          })
        } catch (syncError) {
          console.error('Failed to sync emails:', syncError)
        } finally {
          setIsSyncing(false)
        }
      } else {
        const error = await res.json()
        alert(error.error || '계정 추가에 실패했습니다.')
      }
    } catch (error) {
      console.error('Failed to add account:', error)
      alert('계정 추가에 실패했습니다.')
    } finally {
      setIsAddingAccount(false)
    }
  }

  // Star email
  const handleStar = async (emailId: string, starred: boolean) => {
    try {
      await fetch('/api/email/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: emailId, action: 'star', value: starred }),
      })

      setEmails(emails.map((e) =>
        e.id === emailId ? { ...e, is_starred: starred } : e
      ))
      setAllEmails(allEmails.map((e) =>
        e.id === emailId ? { ...e, is_starred: starred } : e
      ))

      if (selectedEmail?.id === emailId) {
        setSelectedEmail({ ...selectedEmail, is_starred: starred })
      }
    } catch (error) {
      console.error('Failed to star email:', error)
    }
  }

  // Delete email
  const handleDelete = async (emailId: string) => {
    try {
      await fetch('/api/email/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: emailId, action: 'trash' }),
      })

      setEmails(emails.filter((e) => e.id !== emailId))
      if (selectedEmail?.id === emailId) {
        setSelectedEmail(null)
      }
    } catch (error) {
      console.error('Failed to delete email:', error)
    }
  }

  // Mark as read
  const handleMarkRead = async (emailId: string, read: boolean) => {
    try {
      await fetch('/api/email/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: emailId, action: 'read', value: read }),
      })

      setEmails(emails.map((e) =>
        e.id === emailId ? { ...e, is_read: read } : e
      ))
      setAllEmails(allEmails.map((e) =>
        e.id === emailId ? { ...e, is_read: read } : e
      ))
    } catch (error) {
      console.error('Failed to mark email:', error)
    }
  }

  // AI 답장 버튼 클릭 - 유형 선택 화면 표시
  const handleGenerateReply = (email: EmailMessage) => {
    setReplyOptionsEmail(email)
    setIsChatOpen(true)
  }

  // 답장 유형 선택 후 실제 답장 생성
  const handleSelectReplyType = async (replyType: string) => {
    if (!replyOptionsEmail) return

    setIsGeneratingReply(true)
    setReplyOptionsEmail(null) // 옵션 닫기

    try {
      const res = await fetch('/api/email/ai/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_id: replyOptionsEmail.id,
          reply_type: replyType,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setPendingAiReply({
          to: replyOptionsEmail.from_address,
          subject: data.subject || (replyOptionsEmail.subject?.startsWith('Re:') ? replyOptionsEmail.subject : `Re: ${replyOptionsEmail.subject || ''}`),
          body: data.body_text || '',
          originalEmail: replyOptionsEmail,
        })
      } else {
        const errorData = await res.json().catch(() => ({}))
        alert(errorData.error || 'AI 답장 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('Failed to generate reply:', error)
      alert('AI 답장 생성에 실패했습니다.')
    } finally {
      setIsGeneratingReply(false)
    }
  }

  // 답장 유형 선택 취소
  const handleCancelReplyOptions = () => {
    setReplyOptionsEmail(null)
  }

  // AI 답장 확인 후 메일쓰기로 이동
  const handleConfirmAiReply = () => {
    if (!pendingAiReply) return
    setIsComposeOpen(true)
    setSelectedEmail(null)
  }

  // AI 답장 취소
  const handleCancelAiReply = () => {
    setPendingAiReply(null)
  }

  // Select email and mark as read
  const handleSelectEmail = (email: EmailMessage) => {
    setSelectedEmail(email)
    if (!email.is_read) {
      handleMarkRead(email.id, true)
    }
  }

  // Send email
  const handleSendEmail = async (data: {
    to: string
    cc?: string
    subject: string
    body: string
    bodyHtml: string
  }) => {
    if (!selectedAccount) {
      alert('계정을 선택해주세요.')
      return
    }

    setIsSending(true)
    try {
      const toAddresses = data.to.split(',').map(e => {
        const trimmed = e.trim()
        return { email: trimmed, name: trimmed.split('@')[0] }
      })

      const ccAddresses = data.cc ? data.cc.split(',').map(e => {
        const trimmed = e.trim()
        return { email: trimmed, name: trimmed.split('@')[0] }
      }) : undefined

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: selectedAccount.id,
          to: toAddresses,
          cc: ccAddresses,
          subject: data.subject,
          body_text: data.body,
          body_html: data.bodyHtml,
        }),
      })

      if (res.ok) {
        alert('이메일이 발송되었습니다.')
        setIsComposeOpen(false)
      } else {
        const error = await res.json()
        alert(error.error || '이메일 발송에 실패했습니다.')
      }
    } catch (error) {
      console.error('Failed to send email:', error)
      alert('이메일 발송에 실패했습니다.')
    } finally {
      setIsSending(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    fetchEmails()
  }, [fetchEmails])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // Handle folder change
  const handleFolderChange = (folder: Folder) => {
    setCurrentFolder(folder)
    setSelectedEmail(null)
  }

  return (
    <div className="h-[calc(100vh-64px)] flex bg-white dark:bg-zinc-900">
      {/* Folder Menu */}
      <div className="w-64 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800">
        <EmailFolderMenu
          accounts={accounts}
          selectedAccount={selectedAccount}
          onAccountChange={setSelectedAccount}
          onAddAccount={() => setIsAddModalOpen(true)}
          allEmails={allEmails}
          currentFolder={currentFolder}
          onFolderChange={handleFolderChange}
          onCompose={() => setIsComposeOpen(true)}
          onSync={syncEmails}
          isSyncing={isSyncing}
        />
      </div>

      {/* Right Section: Header + (Content + Chat) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - spans full width */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            {(selectedEmail || isComposeOpen) && (
              <button
                onClick={() => {
                  if (isComposeOpen) setIsComposeOpen(false)
                  else setSelectedEmail(null)
                }}
                className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-lg font-bold text-zinc-900 dark:text-white">
              {isComposeOpen ? '메일 쓰기' : selectedEmail ? selectedEmail.subject || '(제목 없음)' : folderLabels[currentFolder]}
            </h1>
            {!selectedEmail && !isComposeOpen && unreadCount > 0 && currentFolder === 'inbox' && (
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", accent.light, accent.text)}>
                {unreadCount} 안읽음
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isComposeOpen ? null : selectedEmail ? (
              <>
                <button
                  onClick={() => handleStar(selectedEmail.id, !selectedEmail.is_starred)}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    selectedEmail.is_starred
                      ? "text-yellow-500 hover:text-yellow-600"
                      : "text-zinc-400 hover:text-yellow-500"
                  )}
                >
                  <Star className={cn("w-5 h-5", selectedEmail.is_starred && "fill-current")} />
                </button>
                <button
                  onClick={() => handleDelete(selectedEmail.id)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            ) : (
              <button
                onClick={syncEmails}
                disabled={isSyncing || !selectedAccount}
                className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("w-5 h-5", isSyncing && "animate-spin")} />
              </button>
            )}
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                isChatOpen
                  ? cn(accent.light, accent.text)
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
              title="AI 채팅"
            >
              <Bot className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Area: Content + Chat Sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 overflow-hidden min-w-0">
        <AnimatePresence mode="wait">
          {isComposeOpen ? (
            /* Compose View */
            <motion.div
              key="compose"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <EmailCompose
                account={selectedAccount}
                onBack={() => {
                  setIsComposeOpen(false)
                  setPendingAiReply(null)
                }}
                onSend={async (data) => {
                  await handleSendEmail(data)
                  setPendingAiReply(null)
                }}
                isSending={isSending}
                replyTo={pendingAiReply ? {
                  to: pendingAiReply.to,
                  subject: pendingAiReply.subject,
                  body: pendingAiReply.body,
                } : undefined}
              />
            </motion.div>
          ) : selectedEmail ? (
            /* Email Viewer */
            <motion.div
              key="viewer"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full flex flex-col"
            >
              {/* Email Header */}
              <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-white font-medium text-lg", accent.bg)}>
                    {(selectedEmail.from_name || selectedEmail.from_address)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-white">
                      {selectedEmail.from_name || selectedEmail.from_address}
                    </p>
                    <p className="text-sm text-zinc-500 truncate">
                      {selectedEmail.from_address}
                    </p>
                  </div>
                  <span className="text-sm text-zinc-400 flex-shrink-0">
                    {new Date(selectedEmail.received_at || selectedEmail.created_at).toLocaleString('ko-KR')}
                  </span>
                </div>
                {selectedEmail.to_addresses && selectedEmail.to_addresses.length > 0 && (
                  <p className="text-sm text-zinc-500 mt-2">
                    받는 사람: {selectedEmail.to_addresses.map((a) => a.name || a.email).join(', ')}
                  </p>
                )}
              </div>

              {/* AI Summary */}
              {selectedEmail.ai_summary && (
                <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-start gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", accent.light)}>
                      <Bot className={cn("w-4 h-4", accent.text)} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-500 mb-1">AI 분석</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300">{selectedEmail.ai_summary}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Body - Always Light Mode */}
              <div className="flex-1 overflow-y-auto p-6 bg-white">
                {selectedEmail.has_attachments && selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                  <div className="mb-4 p-3 bg-zinc-100 rounded-xl">
                    <div className="flex items-center gap-2 mb-2 text-sm text-zinc-500">
                      <Paperclip className="w-4 h-4" />
                      <span>첨부파일 ({selectedEmail.attachments.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedEmail.attachments.map((att, i) => (
                        <div key={i} className="px-3 py-2 bg-white rounded-lg text-sm text-zinc-700 border border-zinc-200">
                          {att.filename}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEmail.body_html ? (
                  <div
                    className="prose prose-sm max-w-none text-zinc-900"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700">
                    {selectedEmail.body_text}
                  </pre>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-700 flex gap-2">
                <button className="flex-1 px-4 py-2.5 rounded-xl font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-sm flex items-center justify-center gap-2">
                  <Reply className="w-4 h-4" />
                  답장
                </button>
                <button className="flex-1 px-4 py-2.5 rounded-xl font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-sm flex items-center justify-center gap-2">
                  <Forward className="w-4 h-4" />
                  전달
                </button>
                <button
                  onClick={() => handleGenerateReply(selectedEmail)}
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
            </motion.div>
          ) : (
            /* Email List */
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full overflow-y-auto"
            >
              {!selectedAccount ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8">
                  <Mail className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-center mb-4">이메일 계정을 추가하여 시작하세요</p>
                  <Button
                    variant="accent"
                    size="md"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => setIsAddModalOpen(true)}
                  >
                    계정 추가
                  </Button>
                </div>
              ) : isLoading || isSyncing ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
                </div>
              ) : emails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8">
                  <Inbox className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg">이메일이 없습니다</p>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  {/* Email Toolbar */}
                  <div className="flex items-center gap-1 px-2 py-1.5 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                    {/* Select All Checkbox */}
                    <button
                      onClick={toggleSelectAll}
                      className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <div className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                        selectedEmailIds.size === filteredEmails.length && filteredEmails.length > 0
                          ? cn(accent.bg, "border-transparent")
                          : selectedEmailIds.size > 0
                            ? cn(accent.bg, "border-transparent")
                            : "border-zinc-400 dark:border-zinc-500"
                      )}>
                        {selectedEmailIds.size === filteredEmails.length && filteredEmails.length > 0 ? (
                          <Check className="w-3 h-3 text-white" />
                        ) : selectedEmailIds.size > 0 ? (
                          <Minus className="w-3 h-3 text-white" />
                        ) : null}
                      </div>
                    </button>
                    <button className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700">
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    </button>

                    <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1" />

                    {/* Action Buttons */}
                    <button
                      onClick={handleBulkStar}
                      disabled={selectedEmailIds.size === 0}
                      className="px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Star className="w-3.5 h-3.5" />
                      중요
                    </button>
                    <button
                      onClick={handleBulkMarkRead}
                      disabled={selectedEmailIds.size === 0}
                      className="px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <MailOpen className="w-3.5 h-3.5" />
                      읽음
                    </button>

                    <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1" />

                    <button
                      disabled={selectedEmailIds.size === 0}
                      className="px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Reply className="w-3.5 h-3.5" />
                      답장
                    </button>
                    <button
                      disabled={selectedEmailIds.size === 0}
                      className="px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <ReplyAll className="w-3.5 h-3.5" />
                      전체답장
                    </button>
                    <button
                      disabled={selectedEmailIds.size === 0}
                      className="px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Forward className="w-3.5 h-3.5" />
                      전달
                    </button>

                    <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1" />

                    <button
                      onClick={handleBulkSpam}
                      disabled={selectedEmailIds.size === 0}
                      className="px-2 py-1 text-xs font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      스팸
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      disabled={selectedEmailIds.size === 0}
                      className="px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      삭제
                    </button>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Filter Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setActiveFilter('all')}
                        className={cn(
                          "px-2 py-1 text-xs font-medium rounded transition-colors",
                          activeFilter === 'all'
                            ? cn(accent.light, accent.text)
                            : "text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        )}
                      >
                        전체
                      </button>
                      <button
                        onClick={() => setActiveFilter('unread')}
                        className={cn(
                          "px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1",
                          activeFilter === 'unread'
                            ? cn(accent.light, accent.text)
                            : "text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        )}
                      >
                        <MailX className="w-3.5 h-3.5" />
                        안읽음
                      </button>
                      <button
                        onClick={() => setActiveFilter('starred')}
                        className={cn(
                          "px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1",
                          activeFilter === 'starred'
                            ? cn(accent.light, accent.text)
                            : "text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        )}
                      >
                        <Star className="w-3.5 h-3.5" />
                        중요
                      </button>
                      <button
                        onClick={() => setActiveFilter('attachments')}
                        className={cn(
                          "px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1",
                          activeFilter === 'attachments'
                            ? cn(accent.light, accent.text)
                            : "text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        )}
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        첨부
                      </button>
                      {activeFilter !== 'all' && (
                        <button
                          onClick={() => setActiveFilter('all')}
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Email List */}
                  <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredEmails.map((email) => (
                      <div
                        key={email.id}
                        onClick={() => handleSelectEmail(email)}
                        className={cn(
                          "w-full px-3 py-2.5 text-left hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer",
                          selectedEmailIds.has(email.id) && "bg-zinc-100 dark:bg-zinc-800"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {/* Checkbox */}
                          <button
                            onClick={(e) => toggleEmailSelection(email.id, e)}
                            className="flex-shrink-0"
                          >
                            <div className={cn(
                              "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                              selectedEmailIds.has(email.id)
                                ? cn(accent.bg, "border-transparent")
                                : "border-zinc-400 dark:border-zinc-500 hover:border-zinc-500 dark:hover:border-zinc-400"
                            )}>
                              {selectedEmailIds.has(email.id) && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                          </button>

                          {/* Star */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStar(email.id, !email.is_starred)
                            }}
                            className="flex-shrink-0"
                          >
                            <Star className={cn(
                              "w-4 h-4 transition-colors",
                              email.is_starred
                                ? "text-yellow-500 fill-current"
                                : "text-zinc-300 dark:text-zinc-600 hover:text-yellow-400"
                            )} />
                          </button>

                          {/* Avatar */}
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0",
                            email.is_read ? "bg-zinc-400" : accent.bg
                          )}>
                            {(email.from_name || email.from_address)[0].toUpperCase()}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <span className={cn(
                              "block truncate text-sm",
                              email.is_read
                                ? "text-zinc-600 dark:text-zinc-400"
                                : "text-zinc-900 dark:text-white font-semibold"
                            )}>
                              {email.from_name || email.from_address}
                            </span>
                            <p className={cn(
                              "text-sm truncate",
                              email.is_read
                                ? "text-zinc-500 dark:text-zinc-500"
                                : cn("font-medium", accent.text)
                            )}>
                              {email.subject || '(제목 없음)'}
                            </p>
                          </div>

                          {/* Indicators & Date */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {email.has_attachments && (
                              <Paperclip className="w-4 h-4 text-zinc-400" />
                            )}
                            <span className="text-xs text-zinc-400 min-w-[60px] text-right">
                              {formatDate(email.received_at || email.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
          </div>

          {/* Chat Sidebar */}
          <AnimatePresence>
            {isChatOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: emailSidebarWidth, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: isResizingEmail ? 0 : 0.2 }}
                className="flex-shrink-0 relative overflow-hidden"
                style={{ width: emailSidebarWidth }}
              >
                {/* Resize Handle */}
                <div
                  onMouseDown={handleChatResizeMouseDown}
                  className={cn(
                    "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 transition-colors",
                    isResizingEmail
                      ? "bg-blue-500"
                      : "bg-zinc-200 dark:bg-zinc-700 hover:bg-blue-400 dark:hover:bg-blue-500"
                  )}
                />
                <div className="h-full border-l border-zinc-200 dark:border-zinc-800">
                  <EmailSidebarChat
                    accounts={accounts}
                    selectedAccount={selectedAccount}
                    onAccountChange={setSelectedAccount}
                    onAddAccount={() => setIsAddModalOpen(true)}
                    allEmails={allEmails}
                    visibleEmails={emails}
                    currentFolder={currentFolder}
                    onFolderChange={handleFolderChange}
                    onCompose={() => setIsComposeOpen(true)}
                    onSync={syncEmails}
                    isSyncing={isSyncing}
                    selectedEmail={selectedEmail}
                    onEmailSelect={setSelectedEmail}
                    pendingAiReply={pendingAiReply}
                    isGeneratingReply={isGeneratingReply}
                    onConfirmAiReply={handleConfirmAiReply}
                    onCancelAiReply={handleCancelAiReply}
                    replyOptionsEmail={replyOptionsEmail}
                    onSelectReplyType={handleSelectReplyType}
                    onCancelReplyOptions={handleCancelReplyOptions}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Add Account Modal */}
      <EmailAccountModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddAccount}
        isLoading={isAddingAccount}
      />
    </div>
  )
}
