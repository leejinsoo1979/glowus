'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, Search, User, Bot, ChevronRight, Loader2, Users, Video } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useChatRooms } from '@/lib/hooks/use-cached-fetch'

interface Participant {
  id: string
  room_id: string
  user_id?: string
  agent_id?: string
  participant_type: 'user' | 'agent'
  user?: {
    id: string
    name: string
    avatar_url?: string
  }
  agent?: {
    id: string
    name: string
    description?: string
  }
}

interface ChatRoom {
  id: string
  name?: string
  type: 'direct' | 'group' | 'meeting'
  team_id?: string
  created_by: string
  last_message_at?: string
  participants: Participant[]
  last_message?: {
    id: string
    content: string
    message_type: string
    created_at: string
    sender_user_id?: string
    sender_agent_id?: string
  }
  unread_count: number
}

export default function ChatHistoryPage() {
  const router = useRouter()
  const { data: chatRoomsData, isLoading: loading } = useChatRooms()
  const chatRooms: ChatRoom[] = Array.isArray(chatRoomsData) ? chatRoomsData : []
  const [searchQuery, setSearchQuery] = useState('')

  // 채팅방 이름 결정
  const getRoomDisplayName = (room: ChatRoom) => {
    if (room.name) return room.name

    // 1:1 대화인 경우 상대방 이름
    if (room.type === 'direct') {
      const otherParticipant = room.participants.find(p =>
        p.agent_id || (p.user_id && p.user_id !== room.created_by)
      )
      if (otherParticipant?.agent) return otherParticipant.agent.name
      if (otherParticipant?.user) return otherParticipant.user.name
    }

    // 그룹인 경우 참여자 이름들
    const names = room.participants
      .map(p => p.user?.name || p.agent?.name)
      .filter(Boolean)
      .slice(0, 3)

    return names.join(', ') || '채팅방'
  }

  // 채팅방에 에이전트가 있는지 확인
  const hasAgent = (room: ChatRoom) => {
    return room.participants.some(p => p.agent_id)
  }

  // 참여자 수
  const getParticipantCount = (room: ChatRoom) => {
    return room.participants.length
  }

  const filteredRooms = chatRooms.filter(room => {
    const name = getRoomDisplayName(room).toLowerCase()
    return name.includes(searchQuery.toLowerCase())
  })

  const formatTime = (dateString?: string) => {
    if (!dateString) return ''
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: ko })
    } catch {
      return ''
    }
  }

  // 마지막 메시지 미리보기
  const getLastMessagePreview = (room: ChatRoom) => {
    if (!room.last_message) return '메시지가 없습니다'
    if (room.last_message.message_type === 'system') return room.last_message.content
    if (room.last_message.message_type === 'file') return '📎 파일'
    if (room.last_message.message_type === 'image') return '🖼️ 이미지'
    return room.last_message.content
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          <span className="text-sm text-zinc-500">채팅기록 불러오는 중...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">채팅기록</h1>
                <p className="text-sm text-zinc-500">{chatRooms.length}개의 대화</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mt-4 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="대화 검색..."
              className="w-full h-10 pl-10 pr-4 text-sm bg-zinc-100 dark:bg-zinc-800/50 border-0 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-shadow"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {filteredRooms.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24"
          >
            <div className="w-20 h-20 rounded-3xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <MessageSquare className="w-10 h-10 text-zinc-400" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">채팅기록이 없습니다</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
              AI 에이전트나 팀원과의 대화를 시작하면<br />여기에 기록이 표시됩니다
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {filteredRooms.map((room, idx) => {
              const displayName = getRoomDisplayName(room)
              const isAgentChat = hasAgent(room)
              const participantCount = getParticipantCount(room)

              return (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => router.push(`/dashboard-group/messenger?room=${room.id}`)}
                  className="group bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-4 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-lg cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="relative">
                      {isAgentChat ? (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                          <Bot className="w-6 h-6 text-white" />
                        </div>
                      ) : room.type === 'meeting' ? (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                          <Video className="w-6 h-6 text-white" />
                        </div>
                      ) : room.type === 'group' ? (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                          <Users className="w-6 h-6 text-white" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                          {room.participants[0]?.user?.avatar_url ? (
                            <img
                              src={room.participants[0].user.avatar_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-6 h-6 text-zinc-500" />
                          )}
                        </div>
                      )}
                      {room.unread_count > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                          <span className="text-[10px] font-bold text-white">
                            {room.unread_count > 9 ? '9+' : room.unread_count}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                          {displayName}
                        </h3>
                        {room.last_message_at && (
                          <span className="text-xs text-zinc-400 flex-shrink-0 ml-2">
                            {formatTime(room.last_message_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 truncate">
                        {getLastMessagePreview(room)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {isAgentChat && (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                            AI 에이전트
                          </span>
                        )}
                        {room.type === 'meeting' && (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            회의
                          </span>
                        )}
                        {room.type === 'group' && (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                            그룹 · {participantCount}명
                          </span>
                        )}
                        {room.type === 'direct' && !isAgentChat && (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            1:1 대화
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-5 h-5 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
