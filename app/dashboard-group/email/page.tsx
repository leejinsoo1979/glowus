'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Plus,
  Inbox,
  Star,
  Send,
  Trash2,
  Bot,
  FileText,
  RefreshCw,
  ChevronDown,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import { Button } from '@/components/ui/Button'
import { EmailAccountModal, EmailAccountFormData } from '@/components/email/EmailAccountModal'
import { EmailList } from '@/components/email/EmailList'
import { EmailViewer } from '@/components/email/EmailViewer'
import type { EmailAccount, EmailMessage, EmailSummary } from '@/types/email'

type Folder = 'inbox' | 'starred' | 'sent' | 'trash'

export default function EmailPage() {
  const { accentColor } = useThemeStore()
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null)
  const [emails, setEmails] = useState<EmailMessage[]>([])
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null)
  const [currentFolder, setCurrentFolder] = useState<Folder>('inbox')
  const [summary, setSummary] = useState<EmailSummary | null>(null)

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isAddingAccount, setIsAddingAccount] = useState(false)
  const [isGeneratingReply, setIsGeneratingReply] = useState(false)
  const [generatedReply, setGeneratedReply] = useState<{
    subject: string
    body_text: string
    body_html: string
  } | null>(null)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)

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
      const params = new URLSearchParams({
        account_id: selectedAccount.id,
      })

      const res = await fetch(`/api/email/messages?${params}`)
      if (res.ok) {
        let data = await res.json()

        // Client-side filtering
        if (currentFolder === 'starred') {
          data = data.filter((e: EmailMessage) => e.is_starred)
        } else if (currentFolder === 'sent') {
          data = data.filter((e: EmailMessage) => e.is_sent)
        } else if (currentFolder === 'trash') {
          data = data.filter((e: EmailMessage) => e.is_trash)
        } else {
          data = data.filter((e: EmailMessage) => !e.is_trash && !e.is_sent)
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
    } catch (error) {
      console.error('Failed to mark email:', error)
    }
  }

  // Generate AI reply
  const handleGenerateReply = async (email: EmailMessage) => {
    setIsGeneratingReply(true)
    setGeneratedReply(null)

    try {
      const res = await fetch('/api/email/ai/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: email.id }),
      })

      if (res.ok) {
        const data = await res.json()
        setGeneratedReply(data)
      }
    } catch (error) {
      console.error('Failed to generate reply:', error)
    } finally {
      setIsGeneratingReply(false)
    }
  }

  // Generate daily summary
  const handleGenerateSummary = async () => {
    if (!selectedAccount) return

    setIsGeneratingSummary(true)
    try {
      const res = await fetch('/api/email/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: selectedAccount.id }),
      })

      if (res.ok) {
        const data = await res.json()
        setSummary(data)
      }
    } catch (error) {
      console.error('Failed to generate summary:', error)
    } finally {
      setIsGeneratingSummary(false)
    }
  }

  // Select email and mark as read
  const handleSelectEmail = (email: EmailMessage) => {
    setSelectedEmail(email)
    setGeneratedReply(null)
    if (!email.is_read) {
      handleMarkRead(email.id, true)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    fetchEmails()
  }, [fetchEmails])

  const folders = [
    { id: 'inbox' as Folder, label: '받은편지함', icon: Inbox },
    { id: 'starred' as Folder, label: '중요', icon: Star },
    { id: 'sent' as Folder, label: '보낸편지함', icon: Send },
    { id: 'trash' as Folder, label: '휴지통', icon: Trash2 },
  ]

  const unreadCount = emails.filter((e) => !e.is_read && !e.is_trash && !e.is_sent).length

  return (
    <div className="h-[calc(100vh-64px)] flex bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
        {/* Account Selector */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
          {accounts.length > 0 ? (
            <div className="relative">
              <select
                value={selectedAccount?.id || ''}
                onChange={(e) => {
                  const account = accounts.find((a) => a.id === e.target.value)
                  if (account) setSelectedAccount(account)
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 appearance-none cursor-pointer"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.email_address}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>
          ) : (
            <p className="text-sm text-zinc-500 text-center">
              이메일 계정이 없습니다
            </p>
          )}
        </div>

        {/* Add Account Button */}
        <div className="p-4">
          <Button
            variant="accent"
            size="md"
            className="w-full"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            계정 추가
          </Button>
        </div>

        {/* Folders */}
        <nav className="flex-1 px-2 py-2">
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => {
                setCurrentFolder(folder.id)
                setSelectedEmail(null)
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-1",
                currentFolder === folder.id
                  ? cn(accent.light, accent.text)
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              <folder.icon className="w-5 h-5" />
              <span className="flex-1 text-left">{folder.label}</span>
              {folder.id === 'inbox' && unreadCount > 0 && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium text-white",
                  accent.bg
                )}>
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* AI Summary Button */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
          <Button
            variant="ghost"
            size="md"
            className="w-full justify-start"
            leftIcon={isGeneratingSummary ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            onClick={handleGenerateSummary}
            disabled={isGeneratingSummary || !selectedAccount}
          >
            AI 일일 요약
          </Button>
        </div>
      </div>

      {/* Email List */}
      <div className="w-96 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
        {selectedAccount ? (
          <EmailList
            emails={emails}
            selectedEmail={selectedEmail}
            onSelectEmail={handleSelectEmail}
            onRefresh={syncEmails}
            onStar={handleStar}
            onDelete={handleDelete}
            onMarkRead={handleMarkRead}
            isLoading={isLoading || isSyncing}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8">
            <Mail className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-center mb-4">
              이메일 계정을 추가하여<br />시작하세요
            </p>
            <Button
              variant="accent"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsAddModalOpen(true)}
            >
              계정 추가
            </Button>
          </div>
        )}
      </div>

      {/* Email Viewer / Summary */}
      <div className="flex-1 bg-white dark:bg-zinc-900">
        <AnimatePresence mode="wait">
          {selectedEmail ? (
            <EmailViewer
              key={selectedEmail.id}
              email={selectedEmail}
              onClose={() => setSelectedEmail(null)}
              onReply={(e) => console.log('Reply to:', e)}
              onForward={(e) => console.log('Forward:', e)}
              onDelete={handleDelete}
              onStar={handleStar}
              onGenerateReply={handleGenerateReply}
              isGeneratingReply={isGeneratingReply}
              generatedReply={generatedReply}
            />
          ) : summary ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full p-6 overflow-y-auto"
            >
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", accent.light)}>
                    <Bot className={cn("w-6 h-6", accent.text)} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                      AI 일일 요약
                    </h2>
                    <p className="text-sm text-zinc-500">
                      {new Date(summary.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                      {summary.total_emails}
                    </p>
                    <p className="text-sm text-zinc-500">전체 이메일</p>
                  </div>
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {summary.unread_count}
                    </p>
                    <p className="text-sm text-zinc-500">읽지 않음</p>
                  </div>
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {summary.urgent_count}
                    </p>
                    <p className="text-sm text-zinc-500">긴급</p>
                  </div>
                </div>

                {/* Summary Text */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl mb-6">
                  <p className="text-zinc-700 dark:text-zinc-300">
                    {summary.summary_text}
                  </p>
                </div>

                {/* Key Highlights */}
                {summary.key_highlights && summary.key_highlights.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-zinc-500 mb-3">주요 이메일</h3>
                    <div className="space-y-2">
                      {summary.key_highlights.map((highlight, i) => (
                        <div
                          key={i}
                          className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl"
                        >
                          <p className="font-medium text-zinc-900 dark:text-white">
                            {highlight.subject}
                          </p>
                          <p className="text-sm text-zinc-500">
                            {highlight.from}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Items */}
                {summary.action_items && summary.action_items.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-zinc-500 mb-3">조치 필요</h3>
                    <div className="space-y-2">
                      {summary.action_items.map((item, i) => (
                        <div
                          key={i}
                          className="p-3 bg-orange-50 dark:bg-orange-500/10 rounded-xl border border-orange-200 dark:border-orange-500/20"
                        >
                          <p className="text-orange-700 dark:text-orange-400">
                            {item.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setSummary(null)}
                  className="mt-6 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-zinc-400"
            >
              <FileText className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">이메일을 선택하세요</p>
            </motion.div>
          )}
        </AnimatePresence>
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
