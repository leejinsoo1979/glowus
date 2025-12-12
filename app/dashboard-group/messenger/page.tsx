'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  Search, Send, Paperclip, MoreVertical, Phone, Video, Info,
  Image as ImageIcon, Smile, Plus, Users, Bot, ChevronLeft, Loader2,
  FileText, Download, X, UserPlus, LogOut, Trash2, Settings,
  ChevronRight, UserMinus, PanelRightClose, PanelRightOpen,
  Clock, Play, Square, Timer
} from 'lucide-react'
import { Button } from '@/components/ui'
import { useChatRooms, useChatRoom, usePresence, useMeeting } from '@/hooks/useChat'
import { ChatRoom, ChatMessage, ChatParticipant } from '@/types/chat'
import { DEV_USER, isDevMode } from '@/lib/dev-user'

// 참여자별 고유 색상 팔레트
const AVATAR_COLORS = [
  'from-rose-500 to-pink-600',
  'from-orange-500 to-amber-600',
  'from-emerald-500 to-teal-600',
  'from-cyan-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-fuchsia-500 to-pink-600',
  'from-lime-500 to-green-600',
  'from-sky-500 to-indigo-600',
  'from-amber-500 to-yellow-600',
  'from-red-500 to-rose-600',
]

// ID 기반으로 일관된 색상 반환
function getColorForId(id: string, isAgent: boolean = false): string {
  if (!id) return AVATAR_COLORS[0]
  // ID의 문자 코드 합계로 인덱스 결정
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export default function MessengerPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [inputText, setInputText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showRoomSettings, setShowRoomSettings] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showRightSidebar, setShowRightSidebar] = useState(true)
  const [confirmKick, setConfirmKick] = useState<{ participantId: string; name: string } | null>(null)
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [isNearBottom, setIsNearBottom] = useState(true) // 스크롤이 아래쪽인지
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 채팅 훅 사용
  const { rooms, loading: roomsLoading, createRoom, fetchRooms } = useChatRooms()
  const {
    room: activeRoom,
    messages,
    loading: messagesLoading,
    sending,
    typingUsers,
    agentTyping,
    sendMessage,
    handleTyping
  } = useChatRoom(activeRoomId)
  const { onlineUsers } = usePresence(activeRoomId)
  const { meetingStatus, loading: meetingLoading, startMeeting, endMeeting } = useMeeting(activeRoomId)

  // 필터링된 채팅방
  const filteredRooms = rooms.filter(room => {
    if (!searchQuery) return true
    const roomName = getRoomDisplayName(room)
    return roomName.toLowerCase().includes(searchQuery.toLowerCase())
  })

  // 스크롤 위치 감지 (사용자가 위로 스크롤했는지)
  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    // 하단에서 100px 이내면 "아래쪽"으로 간주
    const nearBottom = scrollHeight - scrollTop - clientHeight < 100
    setIsNearBottom(nearBottom)
  }

  // 스크롤 최신 메시지로 (아래쪽에 있을 때만)
  useEffect(() => {
    if (scrollRef.current && messages.length > 0 && isNearBottom) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isNearBottom])

  // 방 변경 시 스크롤 초기화
  useEffect(() => {
    setIsNearBottom(true)
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activeRoomId])

  // 에이전트 멘션 (프로필 클릭 시)
  const mentionAgent = (agentName: string) => {
    const mention = `/${agentName} `
    // 이미 같은 멘션이 있으면 추가하지 않음
    if (!inputText.startsWith(mention)) {
      setInputText(mention + inputText.replace(/^\/\S+\s*/, ''))  // 기존 멘션 제거 후 새 멘션 추가
    }
    inputRef.current?.focus()
  }

  // 메시지에서 에이전트 멘션 파싱
  const parseAgentMention = (text: string): { targetAgentName: string | null; content: string } => {
    const mentionMatch = text.match(/^\/(\S+)\s+([\s\S]*)$/)
    if (mentionMatch) {
      return {
        targetAgentName: mentionMatch[1],
        content: mentionMatch[2].trim()
      }
    }
    return { targetAgentName: null, content: text }
  }

  // 메시지 전송
  const handleSendMessage = async () => {
    if (!inputText.trim() || sending) return

    // 에이전트 멘션 파싱
    const { targetAgentName, content } = parseAgentMention(inputText.trim())

    // 멘션만 있고 내용이 없으면 전송하지 않음
    if (targetAgentName && !content) {
      return
    }

    try {
      // 멘션이 있으면 메타데이터에 target_agent_name 추가
      if (targetAgentName) {
        await sendMessage(content, {
          metadata: { target_agent_name: targetAgentName }
        })
      } else {
        await sendMessage(inputText)
      }
      setInputText('')
    } catch (err) {
      console.error('Failed to send message:', err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // 파일 업로드 핸들러
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'file' | 'image') => {
    const file = e.target.files?.[0]
    if (!file || !activeRoomId) return

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('roomId', activeRoomId)

      const res = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Upload failed')
      }

      const { url, fileName, fileSize, fileType, isImage } = await res.json()

      // 메시지로 전송
      await sendMessage(isImage ? '이미지를 공유했습니다' : `파일을 공유했습니다: ${fileName}`, {
        message_type: isImage ? 'image' : 'file',
        metadata: {
          url,
          fileName,
          fileSize,
          fileType,
        },
      })
    } catch (err) {
      console.error('File upload failed:', err)
      alert(err instanceof Error ? err.message : '파일 업로드에 실패했습니다')
    } finally {
      setUploading(false)
      // input 초기화
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  // 채팅방 나가기
  const handleLeaveRoom = async () => {
    if (!activeRoomId) return
    try {
      const res = await fetch(`/api/chat/rooms/${activeRoomId}/participants`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to leave room')
      }
      setActiveRoomId(null)
      setConfirmLeave(false)
      await fetchRooms()
    } catch (err) {
      console.error('Failed to leave room:', err)
      alert(err instanceof Error ? err.message : '채팅방 나가기에 실패했습니다')
    }
  }

  // 채팅방 삭제
  const handleDeleteRoom = async () => {
    if (!activeRoomId) return
    try {
      const res = await fetch(`/api/chat/rooms/${activeRoomId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete room')
      }
      setActiveRoomId(null)
      setConfirmDelete(false)
      await fetchRooms()
    } catch (err) {
      console.error('Failed to delete room:', err)
      alert(err instanceof Error ? err.message : '채팅방 삭제에 실패했습니다')
    }
  }

  // 현재 사용자가 방장인지 확인
  const isRoomOwner = () => {
    if (!activeRoom) return false
    const currentUserId = isDevMode() ? DEV_USER.id : null
    return activeRoom.created_by === currentUserId
  }

  // 참여자 강퇴
  const handleKickParticipant = async () => {
    if (!activeRoomId || !confirmKick) return
    const kickedName = confirmKick.name
    try {
      const res = await fetch(`/api/chat/rooms/${activeRoomId}/participants?participant_id=${confirmKick.participantId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to kick participant')
      }

      // 강퇴 시스템 메시지 전송
      await fetch(`/api/chat/rooms/${activeRoomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `${kickedName}님이 강퇴당하셨습니다.`,
          message_type: 'system',
        }),
      })

      setConfirmKick(null)
      // 채팅방 정보 새로고침을 위해 activeRoomId를 잠시 null로 설정 후 복원
      const roomId = activeRoomId
      setActiveRoomId(null)
      setTimeout(() => setActiveRoomId(roomId), 100)
    } catch (err) {
      console.error('Failed to kick participant:', err)
      alert(err instanceof Error ? err.message : '강퇴에 실패했습니다')
    }
  }

  // 파일 크기 포맷
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
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
              className="w-full py-2.5 pl-10 pr-4 bg-transparent text-sm placeholder:text-zinc-500 no-focus-ring"
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
                    {/* 채팅방 ID 기반 고유 색상 */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br ${getColorForId(room.id)} text-white shadow-lg`}>
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
                {/* 채팅방 ID 기반 고유 색상 */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br ${getColorForId(activeRoom.id)} text-white`}>
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
            {/* 회의 컨트롤 - 에이전트가 1명 이상이면 표시 */}
            {activeRoom && activeRoom.participants && activeRoom.participants.some(p => p.participant_type === 'agent' || p.agent) && (
              <>
                {meetingStatus?.is_meeting_active ? (
                  // 회의 진행 중 표시 (간단하게 - 타이머는 상단 배너에)
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-red-500">LIVE</span>
                  </div>
                ) : (
                  // 회의 시작 버튼
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-3 text-purple-500 hover:text-purple-600 hover:bg-purple-500/10"
                    onClick={() => setShowMeetingModal(true)}
                    disabled={meetingLoading}
                  >
                    <Play className="w-4 h-4 mr-1.5" />
                    회의 시작
                  </Button>
                )}
                <div className={`w-px h-6 mx-1 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}></div>
              </>
            )}

            <Button size="icon" variant="ghost" className="text-zinc-500 hover:text-accent">
              <Phone className="w-5 h-5" />
            </Button>
            <Button size="icon" variant="ghost" className="text-zinc-500 hover:text-accent">
              <Video className="w-5 h-5" />
            </Button>
            <div className={`w-px h-6 mx-2 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}></div>

            {/* 채팅방 설정 드롭다운 */}
            <div className="relative">
              <Button
                size="icon"
                variant="ghost"
                className="text-zinc-500 hover:text-accent"
                onClick={() => setShowRoomSettings(!showRoomSettings)}
              >
                <MoreVertical className="w-5 h-5" />
              </Button>

              <AnimatePresence>
                {showRoomSettings && activeRoom && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl border z-50 ${
                      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                    }`}
                  >
                    <div className="py-2">
                      <button
                        onClick={() => {
                          setShowRoomSettings(false)
                          setShowInviteModal(true)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                          isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                        }`}
                      >
                        <UserPlus className="w-4 h-4 text-blue-500" />
                        <span>참여자 초대</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowRoomSettings(false)
                          setConfirmLeave(true)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                          isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                        }`}
                      >
                        <LogOut className="w-4 h-4 text-orange-500" />
                        <span>채팅방 나가기</span>
                      </button>

                      {isRoomOwner() && (
                        <>
                          <div className={`mx-4 my-2 h-px ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
                          <button
                            onClick={() => {
                              setShowRoomSettings(false)
                              setConfirmDelete(true)
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 transition-colors ${
                              isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>채팅방 삭제</span>
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 우측 사이드바 토글 */}
            <Button
              size="icon"
              variant="ghost"
              className="text-zinc-500 hover:text-accent"
              onClick={() => setShowRightSidebar(!showRightSidebar)}
            >
              {showRightSidebar ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Content Column */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Meeting Timer Banner */}
            {meetingStatus?.is_meeting_active && (() => {
              // 진행자 정보 찾기
              const facilitatorAgent = meetingStatus.meeting_facilitator_id
                ? activeRoom?.participants?.find(p => p.agent_id === meetingStatus.meeting_facilitator_id)?.agent
                : null

              return (
                <div className={`flex items-center justify-center gap-4 py-3 px-4 border-b ${
                  isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className={`text-sm font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      회의 진행 중
                    </span>
                  </div>

                  {/* Big Timer Display */}
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20">
                    <Timer className="w-5 h-5 text-red-500" />
                    <span className="text-2xl font-mono font-bold text-red-500 tabular-nums tracking-wider">
                      {formatMeetingTime(meetingStatus.remaining_seconds || 0)}
                    </span>
                  </div>

                  {/* 진행자 표시 */}
                  {facilitatorAgent && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <span className="text-amber-500">👑</span>
                      <span className={`text-sm font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                        {facilitatorAgent.name}
                      </span>
                      <span className={`text-xs ${isDark ? 'text-amber-500/60' : 'text-amber-700/60'}`}>
                        진행자
                      </span>
                    </div>
                  )}

                  {meetingStatus.meeting_topic && meetingStatus.meeting_topic !== '자유 토론' && (
                    <div className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>
                      <span className="opacity-60">주제:</span>{' '}
                      <span className="font-medium">{meetingStatus.meeting_topic}</span>
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-3 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={endMeeting}
                    disabled={meetingLoading}
                  >
                    <Square className="w-4 h-4 mr-1.5" />
                    회의 종료
                  </Button>
                </div>
              )
            })()}

            {/* Message List */}
            <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${isDark ? 'bg-zinc-950' : 'bg-white'}`} ref={scrollRef} onScroll={handleScroll}>
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
              // DEV 모드에서는 DEV_USER.id와 비교, 아니면 room creator와 비교 (임시)
              const currentUserId = isDevMode() ? DEV_USER.id : activeRoom?.created_by
              const isMe = msg.sender_type === 'user' && msg.sender_user_id === currentUserId
              const isAgent = msg.sender_type === 'agent'
              const senderName = msg.sender_user?.name || msg.sender_agent?.name || '알 수 없음'
              const senderAvatar = senderName.slice(0, 2).toUpperCase()
              // 발신자 ID 기반 고유 색상
              const senderId = msg.sender_user_id || msg.sender_agent_id || ''
              const senderColor = getColorForId(senderId)

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {!isMe && (
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold bg-gradient-to-br ${senderColor} text-white mt-1`}>
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

                    {msg.message_type === 'image' && msg.metadata?.url ? (
                      <div className={`p-2 rounded-2xl ${isMe ? 'bg-accent/10 border border-accent/20' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                        <a href={msg.metadata.url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={msg.metadata.url}
                            alt={msg.metadata.fileName || '이미지'}
                            className="max-w-[300px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                              const parent = (e.target as HTMLImageElement).parentElement
                              if (parent) {
                                parent.innerHTML = '<div class="w-48 h-32 bg-zinc-200 dark:bg-zinc-700 rounded-lg flex items-center justify-center text-zinc-400"><span>이미지 로드 실패</span></div>'
                              }
                            }}
                          />
                        </a>
                        {msg.metadata.fileName && (
                          <p className="text-xs text-zinc-500 mt-1 truncate">{msg.metadata.fileName}</p>
                        )}
                      </div>
                    ) : msg.message_type === 'file' && msg.metadata?.url ? (
                      <div className={`p-3 rounded-2xl ${isMe ? 'bg-accent/10 border border-accent/20' : isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-zinc-100 border border-zinc-200'}`}>
                        <a
                          href={msg.metadata.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-zinc-700' : 'bg-zinc-200'}`}>
                            <FileText className="w-5 h-5 text-zinc-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                              {msg.metadata.fileName || '파일'}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {msg.metadata.fileSize ? formatFileSize(msg.metadata.fileSize) : ''}
                            </p>
                          </div>
                          <Download className="w-4 h-4 text-zinc-400" />
                        </a>
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

          {/* Agent Typing Indicator - 실제 타이핑 중인 에이전트 표시 */}
          <AnimatePresence>
            {agentTyping && typingUsers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-2"
              >
                {/* 타이핑 중인 각 에이전트 표시 */}
                {typingUsers.map((typingParticipant: any) => {
                  const agentId = typingParticipant?.agent_id || typingParticipant?.id || ''
                  const agentName = typingParticipant?.agent?.name || 'AI 에이전트'
                  const typingColor = getColorForId(agentId, true)
                  return (
                    <div key={agentId} className="flex gap-3">
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold bg-gradient-to-br ${typingColor} text-white mt-1`}>
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-xs text-zinc-500 px-1 flex items-center gap-1">
                          <Bot className="w-3 h-3" />
                          {agentName}
                        </span>
                        <div className={`px-4 py-3 rounded-2xl rounded-tl-sm ${isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-white border border-zinc-200'}`}>
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-sm text-zinc-500">답변 생성 중...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* User Typing Indicator */}
          <AnimatePresence>
            {typingUsers.length > 0 && !agentTyping && (
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
              {/* 숨겨진 파일 입력 */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileUpload(e, 'file')}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                className="hidden"
              />
              <input
                type="file"
                ref={imageInputRef}
                onChange={(e) => handleFileUpload(e, 'image')}
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
              />

              <div className="flex pb-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Paperclip className="w-5 h-5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploading}
                >
                  <ImageIcon className="w-5 h-5" />
                </Button>
              </div>

              {uploading ? (
                <div className="flex-1 flex items-center gap-2 py-2.5 px-2">
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  <span className="text-sm text-zinc-500">파일 업로드 중...</span>
                </div>
              ) : (
                <input
                  ref={inputRef}
                  type="text"
                  id="chat-message-input"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={inputText.startsWith('/') ? '멘션된 에이전트에게 메시지...' : '메시지를 입력하세요...'}
                  autoComplete="off"
                  className={`flex-1 py-2.5 px-2 bg-transparent text-sm placeholder:text-zinc-400 no-focus-ring ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}
                />
              )}

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

          {/* Right Sidebar - 참여자 목록 */}
          <AnimatePresence>
            {showRightSidebar && activeRoom && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 280, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex-shrink-0 border-l overflow-hidden ${
                  isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50/50'
                }`}
              >
                <div className="w-[280px] h-full flex flex-col">
                  {/* 사이드바 헤더 */}
                  <div className={`p-4 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        참여자 ({activeRoom.participants?.length || 0})
                      </h3>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-blue-500 hover:text-blue-600"
                        onClick={() => setShowInviteModal(true)}
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        초대
                      </Button>
                    </div>
                  </div>

                  {/* 참여자 목록 */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {activeRoom.participants?.map((participant) => {
                      const isUser = participant.participant_type === 'user' || participant.user
                      const isAgentParticipant = participant.participant_type === 'agent' || participant.agent
                      const name = participant.user?.name || participant.agent?.name || '알 수 없음'
                      const avatar = name.slice(0, 2).toUpperCase()
                      const isOwner = participant.user_id === activeRoom.created_by
                      const currentUserId = isDevMode() ? DEV_USER.id : null
                      const isMe = participant.user_id === currentUserId

                      return (
                        <div
                          key={participant.id}
                          className={`flex items-center gap-3 p-2 rounded-xl ${
                            isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                          } group transition-colors ${isAgentParticipant ? 'cursor-pointer' : ''}`}
                          onClick={() => {
                            // 에이전트 클릭 시 멘션 추가
                            if (isAgentParticipant && participant.agent?.name) {
                              mentionAgent(participant.agent.name)
                            }
                          }}
                        >
                          <div className="relative">
                            {/* 참여자 ID 기반 고유 색상 */}
                            {(() => {
                              const participantId = participant.user_id || participant.agent_id || participant.id || ''
                              const participantColor = getColorForId(participantId)
                              return (
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br ${participantColor} text-white`}>
                                  {isAgentParticipant ? <Bot className="w-5 h-5" /> : avatar}
                                </div>
                              )
                            })()}
                            {/* 온라인 상태 */}
                            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${
                              isDark ? 'border-zinc-900' : 'border-white'
                            } ${isAgentParticipant || onlineUsers.includes(participant.user_id || '') ? 'bg-green-500' : 'bg-zinc-400'}`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{name}</span>
                              {isOwner && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-medium">
                                  방장
                                </span>
                              )}
                              {isMe && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-500 font-medium">
                                  나
                                </span>
                              )}
                              {/* 진행자 표시 */}
                              {isAgentParticipant && meetingStatus?.is_meeting_active &&
                               meetingStatus?.meeting_facilitator_id === participant.agent_id && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-medium flex items-center gap-1">
                                  👑 진행자
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-zinc-500">
                              {isAgentParticipant ? 'AI 에이전트' : participant.user?.email || ''}
                            </span>
                          </div>

                          {/* 강퇴 버튼 (방장만, 본인 제외) */}
                          {isRoomOwner() && !isMe && !isOwner && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="opacity-0 group-hover:opacity-100 h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              onClick={(e) => {
                                e.stopPropagation()  // 부모 클릭 이벤트 방지
                                setConfirmKick({ participantId: participant.id, name })
                              }}
                            >
                              <UserMinus className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* 사이드바 푸터 */}
                  <div className={`p-3 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                      onClick={() => setConfirmLeave(true)}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      채팅방 나가기
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* New Chat Modal */}
      <AnimatePresence>
        {showNewChat && (
          <NewChatModal
            isDark={isDark}
            onClose={() => setShowNewChat(false)}
            onCreateRoom={async (data) => {
              const { topic, duration, facilitator_id, ...roomData } = data
              const room = await createRoom(roomData)
              setActiveRoomId(room.id)
              setShowNewChat(false)

              // 주제가 있으면 회의 시작 및 첫 메시지 전송
              if (room?.id) {
                // 약간의 딜레이 후 회의 시작 (방이 완전히 로드되도록)
                setTimeout(async () => {
                  try {
                    // 회의 시작 (진행자 포함)
                    const meetingRes = await fetch(`/api/chat/rooms/${room.id}/meeting`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        topic: topic || '자유 토론',
                        duration_minutes: duration || 5,
                        facilitator_id: facilitator_id || null,
                      }),
                    })
                    const meetingData = await meetingRes.json()
                    console.log('[Messenger] Meeting started:', meetingData)

                    // DB 저장 완료를 위한 딜레이
                    await new Promise(resolve => setTimeout(resolve, 500))

                    // 첫 메시지 전송하여 대화 트리거
                    const startMessage = topic
                      ? `회의를 시작합니다. 주제: "${topic}" (${duration}분)\n\n이 주제에 대해 토론해주세요.`
                      : `회의를 시작합니다. 자유롭게 대화해주세요. (${duration}분)`

                    await fetch(`/api/chat/rooms/${room.id}/messages`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ content: startMessage }),
                    })
                  } catch (err) {
                    console.error('Failed to start meeting:', err)
                  }
                }, 500)
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && activeRoomId && (
          <InviteModal
            isDark={isDark}
            roomId={activeRoomId}
            onClose={() => setShowInviteModal(false)}
            onInvited={async () => {
              setShowInviteModal(false)
            }}
          />
        )}
      </AnimatePresence>

      {/* Leave Room Confirmation */}
      <AnimatePresence>
        {confirmLeave && (
          <ConfirmModal
            isDark={isDark}
            title="채팅방 나가기"
            message="정말 이 채팅방을 나가시겠습니까?"
            confirmText="나가기"
            confirmColor="orange"
            onClose={() => setConfirmLeave(false)}
            onConfirm={handleLeaveRoom}
          />
        )}
      </AnimatePresence>

      {/* Delete Room Confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <ConfirmModal
            isDark={isDark}
            title="채팅방 삭제"
            message="채팅방을 삭제하면 모든 메시지가 영구적으로 삭제됩니다. 계속하시겠습니까?"
            confirmText="삭제"
            confirmColor="red"
            onClose={() => setConfirmDelete(false)}
            onConfirm={handleDeleteRoom}
          />
        )}
      </AnimatePresence>

      {/* Kick Participant Confirmation */}
      <AnimatePresence>
        {confirmKick && (
          <ConfirmModal
            isDark={isDark}
            title="참여자 강퇴"
            message={`"${confirmKick.name}"님을 채팅방에서 강퇴하시겠습니까?`}
            confirmText="강퇴"
            confirmColor="red"
            onClose={() => setConfirmKick(null)}
            onConfirm={handleKickParticipant}
          />
        )}
      </AnimatePresence>

      {/* Meeting Start Modal */}
      <AnimatePresence>
        {showMeetingModal && (
          <MeetingModal
            isDark={isDark}
            onClose={() => setShowMeetingModal(false)}
            onStart={async (topic, duration) => {
              await startMeeting(topic, duration)
              // 회의 시작 후 첫 메시지 전송하여 대화 트리거
              await sendMessage(`회의를 시작합니다. 주제: ${topic || '자유 토론'} (${duration}분)`)
            }}
          />
        )}
      </AnimatePresence>

      {/* Click outside to close dropdown */}
      {showRoomSettings && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowRoomSettings(false)}
        />
      )}
    </div>
  )
}

// 회의 시작 모달
function MeetingModal({
  isDark,
  onClose,
  onStart
}: {
  isDark: boolean
  onClose: () => void
  onStart: (topic: string, duration: number) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [topic, setTopic] = useState('')
  const [duration, setDuration] = useState(5) // 기본 5분

  const durationOptions = [
    { value: 3, label: '3분' },
    { value: 5, label: '5분' },
    { value: 10, label: '10분' },
    { value: 15, label: '15분' },
    { value: 30, label: '30분' },
  ]

  const handleStart = async () => {
    setLoading(true)
    try {
      await onStart(topic || '자유 토론', duration)
      onClose()
    } catch (err) {
      console.error('Failed to start meeting:', err)
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
        className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-zinc-900' : 'bg-white'} shadow-xl`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
            <Play className="w-5 h-5 text-purple-500" />
          </div>
          <h2 className="text-xl font-bold">회의 시작</h2>
        </div>

        <p className={`mb-4 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
          에이전트들이 설정된 시간 동안 서로 대화합니다. 중간에 메시지를 보내거나 종료 버튼을 누르면 대화가 중단됩니다.
        </p>

        {/* 주제 입력 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">회의 주제 (선택)</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="자유 토론"
            className={`w-full px-4 py-2.5 rounded-xl no-focus-ring ${
              isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900'
            }`}
          />
        </div>

        {/* 시간 선택 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">회의 시간</label>
          <div className="grid grid-cols-5 gap-2">
            {durationOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDuration(opt.value)}
                className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                  duration === opt.value
                    ? 'bg-purple-500 text-white'
                    : isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button
            onClick={handleStart}
            disabled={loading}
            className="flex-1 bg-purple-500 hover:bg-purple-600 text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '시작하기'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// 회의 시간 포맷팅 (초 → MM:SS)
function formatMeetingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
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
  onCreateRoom: (data: any) => Promise<{ id: string } | void>
}) {
  const [loading, setLoading] = useState(false)
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [selectedParticipants, setSelectedParticipants] = useState<{ type: 'user' | 'agent'; id: string }[]>([])
  const [roomName, setRoomName] = useState('')
  const [topic, setTopic] = useState('')
  const [duration, setDuration] = useState(5)
  const [facilitatorId, setFacilitatorId] = useState<string | null>(null) // 진행자 ID

  const durationOptions = [
    { value: 3, label: '3분' },
    { value: 5, label: '5분' },
    { value: 10, label: '10분' },
    { value: 15, label: '15분' },
    { value: 30, label: '30분' },
  ]

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

  // 선택된 에이전트 수
  const selectedAgentCount = selectedParticipants.filter(p => p.type === 'agent').length

  const handleCreate = async () => {
    if (!roomName.trim()) {
      alert('채팅방 이름을 입력해주세요')
      return
    }
    if (selectedParticipants.length === 0) {
      alert('참여자를 선택해주세요')
      return
    }
    setLoading(true)
    try {
      await onCreateRoom({
        name: roomName,
        type: 'meeting',
        participant_ids: selectedParticipants,
        topic: topic.trim() || null,
        duration: duration,
        facilitator_id: facilitatorId, // 진행자 ID
      })
    } catch (err) {
      console.error('Failed to create room:', err)
    } finally {
      setLoading(false)
    }
  }

  // 선택된 에이전트 목록 (진행자 선택용)
  const selectedAgents = selectedParticipants
    .filter(p => p.type === 'agent')
    .map(p => agents.find(a => a.id === p.id))
    .filter(Boolean)

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
        className={`w-full max-w-md rounded-2xl p-6 ${isDark ? 'bg-zinc-900' : 'bg-white'} shadow-xl max-h-[90vh] overflow-y-auto`}
      >
        <h2 className="text-xl font-bold mb-4">새 대화 시작</h2>

        {/* 채팅방 이름 (필수) */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            채팅방 이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="예: 마케팅 전략 회의"
            className={`w-full px-4 py-2.5 rounded-xl no-focus-ring ${
              isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900'
            }`}
          />
        </div>

        {/* 토론 주제 (선택) */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            토론 주제 <span className="text-zinc-400 text-xs">(선택)</span>
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="예: 2024년 신규 고객 유치 방안"
            className={`w-full px-4 py-2.5 rounded-xl no-focus-ring ${
              isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900'
            }`}
          />
          <p className="text-xs text-zinc-500 mt-1">
            주제를 입력하면 에이전트들이 해당 주제로 토론합니다
          </p>
        </div>

        {/* 회의 시간 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">회의 시간</label>
          <div className="grid grid-cols-5 gap-2">
            {durationOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDuration(opt.value)}
                className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                  duration === opt.value
                    ? 'bg-purple-500 text-white'
                    : isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 참여자 선택 */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2 text-zinc-500">팀원</h3>
          <div className="space-y-2 max-h-32 overflow-y-auto">
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
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getColorForId(member.id)} flex items-center justify-center text-white text-xs font-bold`}>
                    {member.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm">{member.name}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2 text-zinc-500">
            AI 에이전트 {selectedAgentCount > 0 && <span className="text-purple-500">({selectedAgentCount}명 선택)</span>}
          </h3>
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
                      ? 'bg-purple-500/10 border border-purple-500'
                      : isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getColorForId(agent.id)} flex items-center justify-center text-white`}>
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="text-left flex-1">
                    <span className="text-sm block">{agent.name}</span>
                    <span className="text-xs text-zinc-500">{agent.description}</span>
                  </div>
                  {selectedParticipants.some(p => p.type === 'agent' && p.id === agent.id) && (
                    <span className="text-purple-500 text-xs font-medium">선택됨</span>
                  )}
                </button>
              ))
            )}
          </div>
          {selectedAgentCount >= 2 && (
            <p className="text-xs text-purple-500 mt-2">
              에이전트 2명 이상 선택 시 서로 토론합니다
            </p>
          )}
        </div>

        {/* 진행자 선택 (에이전트 2명 이상일 때) */}
        {selectedAgents.length >= 2 && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              회의 진행자 <span className="text-zinc-400 text-xs">(선택)</span>
            </label>
            <p className="text-xs text-zinc-500 mb-2">
              진행자는 회의를 이끌고, 주제에서 벗어나면 지적합니다
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFacilitatorId(null)}
                className={`p-2 rounded-xl text-sm transition-all ${
                  facilitatorId === null
                    ? 'bg-zinc-500/20 border border-zinc-500'
                    : isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                }`}
              >
                없음
              </button>
              {selectedAgents.map((agent: any) => (
                <button
                  key={agent.id}
                  onClick={() => setFacilitatorId(agent.id)}
                  className={`flex items-center gap-2 p-2 rounded-xl text-sm transition-all ${
                    facilitatorId === agent.id
                      ? 'bg-amber-500/20 border border-amber-500'
                      : isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  <span className="truncate">{agent.name}</span>
                  {facilitatorId === agent.id && (
                    <span className="text-amber-500 text-xs">👑</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!roomName.trim() || selectedParticipants.length === 0 || loading}
            className="flex-1 bg-purple-500 hover:bg-purple-600 text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '시작하기'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// 참여자 초대 모달
function InviteModal({
  isDark,
  roomId,
  onClose,
  onInvited
}: {
  isDark: boolean
  roomId: string
  onClose: () => void
  onInvited: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [invitables, setInvitables] = useState<{ users: any[]; agents: any[] }>({ users: [], agents: [] })
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)

  // 초대 가능한 목록 조회
  useEffect(() => {
    async function fetchInvitables() {
      try {
        const res = await fetch(`/api/chat/invitables?room_id=${roomId}&type=all`)
        if (res.ok) {
          const data = await res.json()
          setInvitables(data)
        }
      } catch (err) {
        console.error('Failed to fetch invitables:', err)
      }
    }
    fetchInvitables()
  }, [roomId])

  const handleInvite = async () => {
    if (!selectedUser && !selectedAgent) return
    setLoading(true)
    try {
      const body: any = {}
      if (selectedUser) body.user_id = selectedUser
      if (selectedAgent) body.agent_id = selectedAgent

      const res = await fetch(`/api/chat/rooms/${roomId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to invite')
      }

      onInvited()
    } catch (err) {
      console.error('Failed to invite:', err)
      alert(err instanceof Error ? err.message : '초대에 실패했습니다')
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
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold">참여자 초대</h2>
        </div>

        {/* 사용자 목록 */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2 text-zinc-500">사용자</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {invitables.users.length === 0 ? (
              <p className="text-sm text-zinc-400">초대할 수 있는 사용자가 없습니다</p>
            ) : (
              invitables.users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    setSelectedUser(selectedUser === user.id ? null : user.id)
                    setSelectedAgent(null)
                  }}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${
                    selectedUser === user.id
                      ? 'bg-accent/10 border border-accent'
                      : isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getColorForId(user.id)} flex items-center justify-center text-white text-xs font-bold`}>
                    {user.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <span className="text-sm block">{user.name}</span>
                    <span className="text-xs text-zinc-500">{user.email}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 에이전트 목록 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2 text-zinc-500">AI 에이전트</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {invitables.agents.length === 0 ? (
              <p className="text-sm text-zinc-400">초대할 수 있는 에이전트가 없습니다</p>
            ) : (
              invitables.agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    setSelectedAgent(selectedAgent === agent.id ? null : agent.id)
                    setSelectedUser(null)
                  }}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${
                    selectedAgent === agent.id
                      ? 'bg-accent/10 border border-accent'
                      : isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getColorForId(agent.id)} flex items-center justify-center text-white`}>
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
            onClick={handleInvite}
            disabled={(!selectedUser && !selectedAgent) || loading}
            className="flex-1"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '초대하기'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// 확인 모달
function ConfirmModal({
  isDark,
  title,
  message,
  confirmText,
  confirmColor = 'red',
  onClose,
  onConfirm
}: {
  isDark: boolean
  title: string
  message: string
  confirmText: string
  confirmColor?: 'red' | 'orange'
  onClose: () => void
  onConfirm: () => void
}) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
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
        className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-zinc-900' : 'bg-white'} shadow-xl`}
      >
        <div className="flex flex-col items-center text-center mb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
            confirmColor === 'red'
              ? isDark ? 'bg-red-500/20' : 'bg-red-100'
              : isDark ? 'bg-orange-500/20' : 'bg-orange-100'
          }`}>
            {confirmColor === 'red' ? (
              <Trash2 className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
            ) : (
              <LogOut className={`w-6 h-6 ${isDark ? 'text-orange-400' : 'text-orange-500'}`} />
            )}
          </div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{title}</h2>
        </div>

        <p className={`mb-6 text-sm text-center ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
          {message}
        </p>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 ${
              confirmColor === 'red'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-orange-500 hover:bg-orange-600'
            } text-white`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmText}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
