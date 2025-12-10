'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import {
  Mail,
  Send,
  Inbox,
  Star,
  Trash2,
  Plus,
  X,
  Paperclip,
  Search,
  MoreVertical,
  Reply,
  Forward,
  Archive,
  Clock,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react'

type EmailTab = 'inbox' | 'sent' | 'starred' | 'drafts' | 'trash' | 'spam'

interface Email {
  id: string
  from: string
  fromName: string
  to: string
  toName: string
  subject: string
  body: string
  date: string
  isRead: boolean
  isStarred: boolean
  hasAttachments?: boolean
  label?: string
  type: 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam'
}

// Mock data re-use and expansion
const MOCK_EMAILS: Email[] = [
  {
    id: '1',
    from: 'investor@vc.com',
    fromName: 'James Kim',
    to: 'me@startup.com',
    toName: 'Me',
    subject: 'Follow-up on Seed Round Discussion',
    body: 'Hi Jinsoo,\n\nI enjoyed our conversation yesterday. I wanted to follow up regarding the valuation cap we discussed. Could you send over the updated financial projections?\n\nBest,\nJames',
    date: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    isRead: false,
    isStarred: true,
    type: 'inbox',
    label: 'Investment'
  },
  {
    id: '2',
    from: 'support@aws.com',
    fromName: 'AWS Billing',
    to: 'billing@startup.com',
    toName: 'Billing Team',
    subject: 'Invoice for November 2025',
    body: 'Your invoice for the period of November 1 - November 30 is now available. Total amount: $1,240.50.\n\nPlease log in to the console to view details.',
    date: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    isRead: true,
    isStarred: false,
    type: 'inbox',
    label: 'Finance'
  },
  {
    id: '3',
    from: 'newsletter@techcrunch.com',
    fromName: 'TechCrunch',
    to: 'me@startup.com',
    toName: 'Me',
    subject: 'Daily Crunch: The biggest startup news',
    body: "Here's what happened in the startup world today...",
    date: new Date(Date.now() - 86400000 * 3).toISOString(),
    isRead: true,
    isStarred: false,
    type: 'inbox',
    label: 'News'
  },
  {
    id: '4',
    from: 'me@startup.com',
    fromName: 'Me',
    to: 'team@startup.com',
    toName: 'Team',
    subject: 'Q1 Goals Review',
    body: 'Hey Team,\n\nGreat work this quarter. Let\'s review our Q1 goals this Friday. Please prepare your slide decks.',
    date: new Date(Date.now() - 172800000).toISOString(),
    isRead: true,
    isStarred: false,
    type: 'sent',
  },
  {
    id: '5',
    from: 'designer@startup.com',
    fromName: 'Sarah Lee',
    to: 'me@startup.com',
    toName: 'Me',
    subject: 'New UI Kits are ready',
    body: 'I have uploaded the new component library to Figma. Please check it out when you have a moment.',
    date: new Date(Date.now() - 300000).toISOString(), // 5 mins ago
    isRead: false,
    isStarred: false,
    hasAttachments: true,
    type: 'inbox',
    label: 'Design'
  }
]

export default function EmailPage() {
  const { user } = useAuthStore()
  const { resolvedTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<EmailTab>('inbox')
  const [emails, setEmails] = useState<Email[]>(MOCK_EMAILS)
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isComposeOpen, setIsComposeOpen] = useState(false)

  const selectedEmail = emails.find(e => e.id === selectedEmailId)
  const isDark = resolvedTheme === 'dark'

  // Filter Logic
  const filteredEmails = emails.filter(email => {
    // 1. Tab Filter
    let matchesTab = false
    if (activeTab === 'starred') matchesTab = email.isStarred
    else matchesTab = email.type === activeTab

    // 2. Search Filter
    const query = searchQuery.toLowerCase()
    const matchesSearch =
      email.subject.toLowerCase().includes(query) ||
      email.fromName.toLowerCase().includes(query) ||
      email.body.toLowerCase().includes(query)

    return matchesTab && matchesSearch
  })

  // Format Date Logic
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 86400000) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } else if (diff < 604800000) { // < 7 days
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Handlers
  const handleToggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setEmails(prev => prev.map(email =>
      email.id === id ? { ...email, isStarred: !email.isStarred } : email
    ))
  }

  const handleDelete = (id: string) => {
    setEmails(prev => prev.filter(email => email.id !== id))
    if (selectedEmailId === id) setSelectedEmailId(null)
  }

  const handleMarkRead = (id: string) => {
    setEmails(prev => prev.map(email =>
      email.id === id ? { ...email, isRead: true } : email
    ))
  }

  const tabs = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: emails.filter(e => e.type === 'inbox' && !e.isRead).length },
    { id: 'sent', label: 'Sent', icon: Send, count: 0 },
    { id: 'starred', label: 'Starred', icon: Star, count: emails.filter(e => e.isStarred).length },
    { id: 'drafts', label: 'Drafts', icon: FileText, count: 0 },
    { id: 'trash', label: 'Trash', icon: Trash2, count: 0 },
  ]

  return (
    <div className={`flex h-[calc(100vh-4rem)] overflow-hidden ${isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900'}`}>

      {/* Pane 1: Navigation Sidebar (240px) */}
      <div className={`w-60 flex-shrink-0 border-r flex flex-col ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50/50'}`}>
        <div className={`p-4 h-16 flex items-center border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
          <div className="flex items-center gap-2 font-semibold">
            <div className="w-8 h-8 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <span>Mailbox</span>
          </div>
        </div>

        <div className="p-3">
          <Button
            className="w-full justify-start mb-6"
            onClick={() => setIsComposeOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Message
          </Button>

          <div className="space-y-1">
            {tabs.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as EmailTab)
                    setSelectedEmailId(null) // Reset selection when changing tabs
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                    ? isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-black'
                    : isDark ? 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </div>
                  {tab.count > 0 && (
                    <span className={`text-xs ${isActive ? '' : 'text-zinc-500'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Storage or Labels could go here */}
        <div className="mt-auto p-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>1.2 GB of 15 GB used</span>
            <span className="cursor-pointer hover:underline">Clean up</span>
          </div>
          <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full mt-2 overflow-hidden">
            <div className="w-[8%] h-full bg-accent rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Pane 2: Email List (320px - 400px) */}
      <div className={`w-[25rem] flex-shrink-0 border-r flex flex-col ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
        <div className={`p-4 h-16 border-b flex items-center gap-2 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
          <div className={`relative flex-1 rounded-lg overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mail..."
              className="w-full py-2 pl-9 pr-4 bg-transparent outline-none text-sm placeholder:text-zinc-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filteredEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-500 text-sm mt-10">
              <Inbox className="w-10 h-10 mb-2 opacity-20" />
              <p>No messages found</p>
            </div>
          ) : (
            filteredEmails.map(email => (
              <button
                key={email.id}
                onClick={() => {
                  setSelectedEmailId(email.id)
                  handleMarkRead(email.id)
                }}
                className={`w-full text-left p-4 border-b transition-colors relative group ${isDark ? 'border-zinc-800 hover:bg-zinc-800/50' : 'border-zinc-100 hover:bg-zinc-50'
                  } ${selectedEmailId === email.id ? isDark ? 'bg-zinc-800' : 'bg-zinc-100' : ''}`}
              >
                {!email.isRead && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
                )}
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-sm truncate ${email.isRead ? isDark ? 'font-normal text-zinc-300' : 'font-normal text-zinc-700' : 'font-semibold'}`}>
                      {activeTab === 'sent' ? `To: ${email.toName}` : email.fromName}
                    </span>
                  </div>
                  <span className={`text-xs whitespace-nowrap ml-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    {formatDate(email.date)}
                  </span>
                </div>

                <div className={`text-sm mb-1 truncate ${email.isRead ? isDark ? 'font-normal text-zinc-400' : 'font-normal text-zinc-600' : 'font-medium'}`}>
                  {email.subject}
                </div>

                <div className={`text-xs truncate line-clamp-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  {email.body}
                </div>

                <div className="flex items-center gap-2 mt-2">
                  {email.label && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-white border-zinc-200 text-zinc-500'
                      }`}>
                      {email.label}
                    </span>
                  )}
                  {email.hasAttachments && <Paperclip className="w-3 h-3 text-zinc-500" />}
                  {email.isStarred && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500 ml-auto" />}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Pane 3: Reading Pane (Flex Grow) */}
      <div className={`flex-1 flex flex-col min-w-0 ${isDark ? 'bg-zinc-950' : 'bg-white'}`}>
        {selectedEmail ? (
          <>
            {/* Toolbar */}
            <div className={`h-16 px-6 border-b flex items-center justify-between flex-shrink-0 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" className="text-zinc-500">
                  <Archive className="w-5 h-5" />
                </Button>
                <Button size="icon" variant="ghost" className="text-zinc-500">
                  <AlertCircle className="w-5 h-5" />
                </Button>
                <Button
                  size="icon" variant="ghost"
                  className="text-zinc-500 hover:text-red-500"
                  onClick={() => handleDelete(selectedEmail.id)}
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
                <div className={`w-px h-6 mx-2 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}></div>
                <Button size="icon" variant="ghost" className="text-zinc-500">
                  <Clock className="w-5 h-5" />
                </Button>
                <Button size="icon" variant="ghost" className="text-zinc-500">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">
                  1 of {filteredEmails.length}
                </span>
                <div className="flex">
                  <Button size="icon" variant="ghost" disabled>
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button size="icon" variant="ghost">
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
              {/* Header */}
              <div className="flex items-start justify-between mb-8">
                <h1 className="text-2xl font-bold leading-tight">{selectedEmail.subject}</h1>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" leftIcon={<Reply className="w-4 h-4" />}>
                    Reply
                  </Button>
                  <Button size="sm" variant="outline" leftIcon={<Forward className="w-4 h-4" />}>
                    Forward
                  </Button>
                </div>
              </div>

              {/* Sender Info */}
              <div className="flex items-center gap-4 mb-8">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${isDark ? 'bg-zinc-700' : 'bg-zinc-900'
                  }`}>
                  {selectedEmail.fromName.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{selectedEmail.fromName}</span>
                    <span className="text-xs text-zinc-500">{new Date(selectedEmail.date).toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-zinc-500">{`<${selectedEmail.from}>`}</div>
                </div>
              </div>

              {/* Body */}
              <div className={`prose max-w-none whitespace-pre-line ${isDark ? 'prose-invert' : ''} text-sm leading-relaxed`}>
                {selectedEmail.body}
              </div>

              {/* Attachments Placeholder */}
              {selectedEmail.hasAttachments && (
                <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                  <h4 className="text-sm font-medium mb-3">1 Attachment</h4>
                  <div className={`flex items-center gap-3 p-3 border rounded-xl w-64 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${isDark ? 'border-zinc-800' : 'border-zinc-200'
                    }`}>
                    <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium truncate">Q1_Financials.pdf</p>
                      <p className="text-xs text-zinc-500">2.4 MB</p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <Mail className="w-16 h-16 mb-4 opacity-10" />
            <p className="text-lg font-medium">Select an item to read</p>
            <p className="text-sm">Nothing is selected</p>
          </div>
        )}
      </div>

      {/* Compose Modal (Simple Overlay) */}
      <AnimatePresence>
        {isComposeOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center lg:items-end lg:justify-end lg:p-8">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-2xl h-[80vh] lg:h-[600px] lg:w-[600px] shadow-2xl flex flex-col overflow-hidden rounded-t-xl lg:rounded-xl ring-1 ring-black/10 ${isDark ? 'bg-zinc-900' : 'bg-white'
                }`}
            >
              <div className={`flex items-center justify-between p-3 border-b ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-100 border-zinc-200'}`}>
                <span className="font-semibold px-2">New Message</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsComposeOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 flex flex-col">
                <input
                  className={`px-4 py-3 border-b outline-none text-sm ${isDark ? 'bg-transparent border-zinc-800' : 'bg-transparent border-zinc-100'}`}
                  placeholder="Recipients"
                />
                <input
                  className={`px-4 py-3 border-b outline-none text-sm font-medium ${isDark ? 'bg-transparent border-zinc-800' : 'bg-transparent border-zinc-100'}`}
                  placeholder="Subject"
                />
                <textarea
                  className="flex-1 p-4 outline-none resize-none text-sm bg-transparent"
                  placeholder="Type your message..."
                />
              </div>
              <div className={`p-3 border-t flex items-center justify-between ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost"><Paperclip className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost"><ImageIcon className="w-4 h-4" /></Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setIsComposeOpen(false)}>Discard</Button>
                  <Button onClick={() => setIsComposeOpen(false)} leftIcon={<Send className="w-4 h-4" />}>Send</Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
