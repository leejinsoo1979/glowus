'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  MessageSquare,
  Bot,
  Clock,
  Loader2,
  Trash2,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Conversation {
  id: string
  agent_id: string
  last_message_at: string
  created_at: string
  agent: {
    id: string
    name: string
    avatar_url?: string
    description?: string
  } | null
  lastMessage: {
    content: string
    role: 'user' | 'agent'
    created_at: string
  } | null
}

export default function ConversationsPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const router = useRouter()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetchConversations()
  }, [])

  const fetchConversations = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/conversations')
      if (res.ok) {
        const { data } = await res.json()
        setConversations(data || [])
      }
    } catch (err) {
      console.error('Conversations fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteConversation = async (e: React.MouseEvent, agentId: string) => {
    e.stopPropagation()
    if (!confirm('이 대화 기록을 삭제하시겠습니까?')) return

    setDeleting(agentId)
    try {
      const res = await fetch(`/api/agents/${agentId}/history`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.agent_id !== agentId))
      }
    } catch (err) {
      console.error('Delete conversation error:', err)
    } finally {
      setDeleting(null)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '방금 전'
    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  return (
    <div className={cn('min-h-screen', isDark ? 'bg-zinc-950' : 'bg-zinc-50')}>
      {/* 헤더 */}
      <div
        className={cn(
          'sticky top-0 z-10 px-4 py-3 border-b flex items-center gap-3',
          isDark ? 'bg-zinc-950/95 border-zinc-800 backdrop-blur' : 'bg-white/95 border-zinc-200 backdrop-blur'
        )}
      >
        <button
          onClick={() => router.back()}
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
          )}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
            대화 목록
          </h1>
          <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            에이전트와의 대화 기록
          </p>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : conversations.length === 0 ? (
          <div className={cn('text-center py-20', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">대화 기록이 없어요</p>
            <p className="text-sm">에이전트와 채팅을 시작해보세요!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => router.push(`/dashboard-group/agents/${conv.agent_id}?tab=chat`)}
                className={cn(
                  'p-4 rounded-xl cursor-pointer transition-all',
                  isDark
                    ? 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-800'
                    : 'bg-white hover:bg-zinc-50 border border-zinc-200'
                )}
              >
                <div className="flex items-center gap-3">
                  {/* 에이전트 아바타 */}
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden',
                      isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                    )}
                  >
                    {conv.agent?.avatar_url ? (
                      <img
                        src={conv.agent.avatar_url}
                        alt={conv.agent.name || '에이전트'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Bot className="w-6 h-6 text-accent" />
                    )}
                  </div>

                  {/* 대화 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={cn('font-medium truncate', isDark ? 'text-white' : 'text-zinc-900')}>
                        {conv.agent?.name || '알 수 없는 에이전트'}
                      </h3>
                      <span className={cn('text-xs flex-shrink-0 ml-2', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                        {formatTimeAgo(conv.last_message_at)}
                      </span>
                    </div>
                    <p className={cn('text-sm truncate', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                      {conv.lastMessage ? (
                        <>
                          {conv.lastMessage.role === 'user' ? '나: ' : ''}
                          {truncateText(conv.lastMessage.content)}
                        </>
                      ) : (
                        '대화 내용이 없습니다'
                      )}
                    </p>
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => handleDeleteConversation(e, conv.agent_id)}
                      disabled={deleting === conv.agent_id}
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                        isDark
                          ? 'hover:bg-red-500/20 text-zinc-500 hover:text-red-400'
                          : 'hover:bg-red-50 text-zinc-400 hover:text-red-500'
                      )}
                    >
                      {deleting === conv.agent_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                    <ChevronRight className={cn('w-5 h-5', isDark ? 'text-zinc-600' : 'text-zinc-300')} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
