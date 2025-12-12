'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  Search, Send, Paperclip, MoreVertical, Phone, Video, Info,
  Image as ImageIcon, Smile, Plus, Users, Bot, ChevronLeft, Loader2
} from 'lucide-react'
import { Button } from '@/components/ui'
import { useChatRooms, useChatRoom, usePresence } from '@/hooks/useChat'
import { ChatRoom, ChatMessage, ChatParticipant } from '@/types/chat'

export default function MessengerPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [inputText, setInputText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 채팅 훅 사용
  const { rooms, loading: roomsLoading, createRoom } = useChatRooms()
  const {
    room: activeRoom,
    messages,
    loading: messagesLoading,
    sending,
    typingUsers,
    sendMessage,
    handleTyping
  } = useChatRoom(activeRoomId)
  const { onlineUsers } = usePresence(activeRoomId)

  // 필터링된 채팅방
  const filteredRooms = rooms.filter(room => {
    if (!searchQuery) return true
    const roomName = getRoomDisplayName(room)
    return roomName.toLowerCase().includes(searchQuery.toLowerCase())
  })

  // 스크롤 최신 메시지로
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // 메시지 전송
  const handleSendMessage = async () => {
    if (!inputText.trim() || sending) return
    try {
      await sendMessage(inputText)
      setInputText('')
    } catch (err) {
      console.error('Failed to send message:', err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value)
    handleTyping()
  }

  // 채팅방 표시 이름 가져오기
  function getRoomDisplayName(room: ChatRoom): string {
    if (room.name) return room.name
    // 1:1 채팅일 경우 상대방 이름
    const otherParticipant = room.participants?.find(p =>
      p.user?.id !== room.created_by || p.agent
    )
    return otherParticipant?.user?.name || otherParticipant?.agent?.name || '채팅방'
  }

  // 참여자 아바타 가져오기
  function getParticipantAvatar(participant: ChatParticipant): string {
    if (participant.user) {
      return participant.user.name?.slice(0, 2).toUpperCase() || 'U'
    }
    if (participant.agent) {
      return participant.agent.name?.slice(0, 2).toUpperCase() || 'AI'
    }
    return '?'
  }

  // 온라인 상태 확인
  function isOnline(participant: ChatParticipant): boolean {
    if (participant.agent) return true // 에이전트는 항상 온라인
    return participant.user_id ? onlineUsers.includes(participant.user_id) : false
  }

  return (
    <div className={`flex h-[calc(100vh-4rem)] overflow-hidden ${isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900'}`}>

      {/* Sidebar (Contact List) */}
      <div className={`w-full lg:w-80 flex-shrink-0 flex flex-col border-r ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50/50'} ${activeRoomId ? 'hidden lg:flex' : 'flex'}`}>

        {/* Header */}
        <div className={`p-4 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'} flex items-center justify-between`}>
          <h1 className="text-xl font-bold">Messages</h1>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
            onClick={() => setShowNewChat(true)}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className={`relative rounded-xl overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-white border border-zinc-200'}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className={`w-full py-2.5 pl-10 pr-4 bg-transparent outline-none text-sm placeholder:text-zinc-500`}
            />
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-1">
          {roomsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">채팅이 없습니다</p>
              <p className="text-xs mt-1">새 채팅을 시작해보세요</p>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const displayName = getRoomDisplayName(room)
              const avatar = displayName.slice(0, 2).toUpperCase()
              const isAgent = room.participants?.some(p => p.agent && !p.user)
              const hasUnread = (room.unread_count || 0) > 0

              return (
                <motion.button
                  key={room.id}
                  onClick={() => setActiveRoomId(room.id)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                    activeRoomId === room.id
                      ? isDark ? 'bg-zinc-800 shadow-md' : 'bg-white shadow-md ring-1 ring-zinc-200'
                      : isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-100'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${
                      isAgent
                        ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                        : room.type === 'group' || room.type === 'meeting'
                          ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                          : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                    } text-white shadow-lg`}>
                      {isAgent ? <Bot className="w-5 h-5" /> : avatar}
                    </div>
                    <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 ${
                      isDark ? 'border-zinc-900' : 'border-white'
                    } bg-green-500`}></span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className={`font-semibold truncate ${activeRoomId === room.id ? 'text-accent' : ''}`}>
                        {displayName}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {room.last_message?.created_at
                          ? formatTime(room.last_message.created_at)
                          : ''}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate pr-2">
                        {room.last_message?.content || '메시지가 없습니다'}
                      </p>
                      {hasUnread && (
                        <span className="min-w-[1.25rem] h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center px-1.5">
                          {room.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              )
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${!activeRoomId ? 'hidden lg:flex' : 'flex'}`}>

        {/* Chat Header */}
        <div className={`h-16 px-6 border-b flex items-center justify-between flex-shrink-0 backdrop-blur-md z-10 ${
          isDark ? 'border-zinc-800 bg-zinc-900/80' : 'border-zinc-200 bg-white/80'
        }`}>
          {activeRoom ? (
            <div className="flex items-center gap-4">
              <Button
                size="icon"
                variant="ghost"
                className="lg:hidden -ml-2 mr-2"
                onClick={() => setActiveRoomId(null)}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="relative">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br from-emerald-500 to-teal-600 text-white`}>
                  {getRoomDisplayName(activeRoom).slice(0, 2).toUpperCase()}
                </div>
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 ${
                  isDark ? 'border-zinc-900' : 'border-white'
                } bg-green-500`}></span>
              </div>
              <div>
                <h2 className="font-bold leading-none">{getRoomDisplayName(activeRoom)}</h2>
                <span className="text-xs text-zinc-500">
                  {activeRoom.participants?.length || 0}명 참여 중
                  {typingUsers.length > 0 && (
                    <span className="ml-2 text-accent">
                      {typingUsers.map(p => p.user?.name || p.agent?.name).join(', ')} 입력 중...
                    </span>
                  )}
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full text-center text-zinc-500">대화를 선택하세요</div>
          )}

          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="text-zinc-500 hover:text-accent">
              <Phone className="w-5 h-5" />
            </Button>
            <Button size="icon" variant="ghost" className="text-zinc-500 hover:text-accent">
              <Video className="w-5 h-5" />
            </Button>
            <div className={`w-px h-6 mx-2 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}></div>
            <Button size="icon" variant="ghost" className="text-zinc-500 hover:text-accent">
              <Info className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Message List */}
        <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${isDark ? 'bg-zinc-950' : 'bg-white'}`} ref={scrollRef}>
          {messagesLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <Send className="w-12 h-12 mb-4 opacity-50" />
              <p>아직 메시지가 없습니다</p>
              <p className="text-sm mt-1">첫 메시지를 보내보세요!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_type === 'user' && msg.sender_user_id === activeRoom?.created_by
              const isAgent = msg.sender_type === 'agent'
              const senderName = msg.sender_user?.name || msg.sender_agent?.name || '알 수 없음'
              const senderAvatar = senderName.slice(0, 2).toUpperCase()

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {!isMe && (
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                      isAgent
                        ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                        : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                    } text-white mt-1`}>
                      {isAgent ? <Bot className="w-4 h-4" /> : senderAvatar}
                    </div>
                  )}

                  <div className={`max-w-[70%] space-y-1 ${isMe ? 'items-end flex flex-col' : 'items-start flex flex-col'}`}>
                    {!isMe && (
                      <span className="text-xs text-zinc-500 px-1 flex items-center gap-1">
                        {isAgent && <Bot className="w-3 h-3" />}
                        {senderName}
                      </span>
                    )}

                    {msg.message_type === 'image' ? (
                      <div className={`p-2 rounded-2xl ${isMe ? 'bg-accent/10 border border-accent/20' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                        <div className="w-48 h-32 bg-zinc-200 dark:bg-zinc-700 rounded-lg flex items-center justify-center text-zinc-400">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                      </div>
                    ) : msg.message_type === 'system' ? (
                      <div className="w-full text-center">
                        <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                          {msg.content}
                        </span>
                      </div>
                    ) : (
                      <div className={`px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                        isMe
                          ? 'bg-accent text-white rounded-tr-sm'
                          : isDark
                            ? 'bg-zinc-800 text-zinc-100 rounded-tl-sm border border-zinc-700'
                            : 'bg-white text-zinc-900 rounded-tl-sm border border-zinc-200'
                      }`}>
                        {msg.content}
                      </div>
                    )}
                    <span className="text-[11px] text-zinc-400 px-1">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                </motion.div>
              )
            })
          )}

          {/* Typing Indicator */}
          <AnimatePresence>
            {typingUsers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex gap-3"
              >
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold bg-gradient-to-br from-zinc-400 to-zinc-500 text-white mt-1">
                  ...
                </div>
                <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-3 rounded-2xl rounded-tl-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Area */}
        {activeRoomId && (
          <div className={`p-4 border-t flex-shrink-0 ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
            <div className={`flex items-end gap-2 p-2 rounded-2xl border transition-all ${
              isDark
                ? 'bg-zinc-950 border-zinc-800 focus-within:border-zinc-700'
                : 'bg-zinc-50 border-zinc-200 focus-within:border-zinc-300 shadow-sm'
            }`}>
              <div className="flex pb-1">
                <Button size="icon" variant="ghost" className="rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  <Paperclip className="w-5 h-5" />
                </Button>
                <Button size="icon" variant="ghost" className="rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  <ImageIcon className="w-5 h-5" />
                </Button>
              </div>

              <textarea
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요..."
                className={`flex-1 max-h-32 py-2.5 bg-transparent resize-none outline-none text-sm placeholder:text-zinc-400 scrollbar-hide`}
                rows={1}
                style={{ minHeight: '44px' }}
              />

              <div className="flex pb-1 gap-1">
                <Button size="icon" variant="ghost" className="rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  <Smile className="w-5 h-5" />
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || sending}
                  className={`rounded-xl w-10 h-10 p-0 flex items-center justify-center transition-all ${
                    inputText.trim() && !sending
                      ? 'bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/25'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                  }`}
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 ml-0.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <AnimatePresence>
        {showNewChat && (
          <NewChatModal
            isDark={isDark}
            onClose={() => setShowNewChat(false)}
            onCreateRoom={async (data) => {
              const room = await createRoom(data)
              setActiveRoomId(room.id)
              setShowNewChat(false)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// 시간 포맷팅
function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const dayDiff = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (dayDiff === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (dayDiff === 1) {
    return 'Yesterday'
  } else if (dayDiff < 7) {
    return `${dayDiff} days ago`
  } else {
    return date.toLocaleDateString()
  }
}

// 새 채팅 모달
function NewChatModal({
  isDark,
  onClose,
  onCreateRoom
}: {
  isDark: boolean
  onClose: () => void
  onCreateRoom: (data: any) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [selectedParticipants, setSelectedParticipants] = useState<{ type: 'user' | 'agent'; id: string }[]>([])
  const [roomType, setRoomType] = useState<'direct' | 'group' | 'meeting'>('direct')
  const [roomName, setRoomName] = useState('')

  // 팀원 및 에이전트 목록 조회
  useEffect(() => {
    async function fetchData() {
      try {
        // 팀원 조회 (API가 있다면)
        const membersRes = await fetch('/api/teams/members')
        if (membersRes.ok) {
          const members = await membersRes.json()
          setTeamMembers(members)
        }

        // 에이전트 조회
        const agentsRes = await fetch('/api/agents')
        if (agentsRes.ok) {
          const agentsList = await agentsRes.json()
          setAgents(agentsList)
        }
      } catch (err) {
        console.error('Failed to fetch participants:', err)
      }
    }
    fetchData()
  }, [])

  const toggleParticipant = (type: 'user' | 'agent', id: string) => {
    setSelectedParticipants(prev => {
      const exists = prev.some(p => p.type === type && p.id === id)
      if (exists) {
        return prev.filter(p => !(p.type === type && p.id === id))
      }
      return [...prev, { type, id }]
    })
  }

  const handleCreate = async () => {
    if (selectedParticipants.length === 0) return
    setLoading(true)
    try {
      await onCreateRoom({
        name: roomType !== 'direct' ? roomName : undefined,
        type: roomType,
        participant_ids: selectedParticipants,
      })
    } catch (err) {
      console.error('Failed to create room:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl p-6 ${isDark ? 'bg-zinc-900' : 'bg-white'} shadow-xl`}
      >
        <h2 className="text-xl font-bold mb-4">새 대화 시작</h2>

        {/* 채팅 유형 선택 */}
        <div className="flex gap-2 mb-4">
          {(['direct', 'group', 'meeting'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setRoomType(type)}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                roomType === type
                  ? 'bg-accent text-white'
                  : isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'
              }`}
            >
              {type === 'direct' ? '1:1' : type === 'group' ? '그룹' : '미팅'}
            </button>
          ))}
        </div>

        {/* 채팅방 이름 (그룹/미팅) */}
        {roomType !== 'direct' && (
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="채팅방 이름"
            className={`w-full mb-4 px-4 py-2.5 rounded-xl ${
              isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900'
            } outline-none`}
          />
        )}

        {/* 참여자 선택 */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2 text-zinc-500">팀원</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {teamMembers.length === 0 ? (
              <p className="text-sm text-zinc-400">팀원이 없습니다</p>
            ) : (
              teamMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => toggleParticipant('user', member.id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${
                    selectedParticipants.some(p => p.type === 'user' && p.id === member.id)
                      ? 'bg-accent/10 border border-accent'
                      : isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                    {member.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm">{member.name}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2 text-zinc-500">AI 에이전트</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {agents.length === 0 ? (
              <p className="text-sm text-zinc-400">에이전트가 없습니다</p>
            ) : (
              agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => toggleParticipant('agent', agent.id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${
                    selectedParticipants.some(p => p.type === 'agent' && p.id === agent.id)
                      ? 'bg-accent/10 border border-accent'
                      : isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm block">{agent.name}</span>
                    <span className="text-xs text-zinc-500">{agent.description}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button
            onClick={handleCreate}
            disabled={selectedParticipants.length === 0 || loading}
            className="flex-1"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '시작하기'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
