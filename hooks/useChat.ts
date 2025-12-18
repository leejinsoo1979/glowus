'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChatRoom, ChatMessage, ChatParticipant } from '@/types/chat'
import { RealtimeChannel } from '@supabase/supabase-js'

// 채팅방 목록 훅
export function useChatRooms() {
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())
  const fetchingRef = useRef(false)

  const fetchRooms = useCallback(async () => {
    // 이미 fetch 중이면 스킵
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      setLoading(true)
      const res = await fetch('/api/chat/rooms')
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          setRooms([])
          setError(null)
          return
        }
        throw new Error(data.error || 'Failed to fetch rooms')
      }

      setRooms(Array.isArray(data) ? data : [])
      setError(null)
    } catch (err) {
      console.error('Chat rooms fetch error:', err)
      setRooms([])
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  // 초기 로드 - 한 번만 실행
  useEffect(() => {
    fetchRooms()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 실시간 업데이트 구독 - 비활성화 (무한 루프 방지)
  // Realtime subscription이 fetchRooms()를 반복 호출하여 무한 로딩 발생
  // 대신 polling 방식으로 5초마다 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRooms()
    }, 5000)

    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const createRoom = async (data: {
    name?: string
    type: 'direct' | 'group' | 'meeting'
    participant_ids: { type: 'user' | 'agent'; id: string }[]
    category?: string | null
    attachments?: { name: string; content: string; type: string }[] | null
  }) => {
    const res = await fetch('/api/chat/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create room')
    const room = await res.json()
    await fetchRooms()
    return room
  }

  return { rooms, loading, error, fetchRooms, createRoom }
}

// 채팅방 상세 및 메시지 훅
export function useChatRoom(roomId: string | null) {
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typingUsers, setTypingUsers] = useState<ChatParticipant[]>([])
  const [agentTyping, setAgentTyping] = useState(false)

  const supabaseRef = useRef(createClient())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasAgentRef = useRef<boolean>(false)
  const lastMessageIdRef = useRef<string | null>(null)

  // room 변경 시 에이전트 존재 여부 업데이트
  useEffect(() => {
    const hasAgent = room?.participants?.some(p =>
      p.participant_type === 'agent' ||
      p.agent ||
      p.agent_id
    ) ?? false
    hasAgentRef.current = hasAgent
    console.log('[useChat] Room updated - hasAgent:', hasAgent, 'participants:', room?.participants?.map(p => ({
      type: p.participant_type,
      agent_id: p.agent_id,
      agent: p.agent?.name
    })))
  }, [room])

  // 채팅방 정보 조회
  const fetchRoom = useCallback(async () => {
    if (!roomId) return
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}`)
      if (!res.ok) throw new Error('Failed to fetch room')
      const data = await res.json()
      setRoom(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [roomId])

  // 메시지 조회 (showLoading: 로딩 표시 여부)
  const fetchMessages = useCallback(async (before?: string, showLoading = true) => {
    if (!roomId) return
    try {
      if (showLoading) setLoading(true)
      const url = before
        ? `/api/chat/rooms/${roomId}/messages?before=${before}`
        : `/api/chat/rooms/${roomId}/messages`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch messages')
      const data = await res.json()

      if (before) {
        setMessages((prev) => [...data, ...prev])
      } else {
        setMessages(data)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [roomId])

  // 초기 로드
  useEffect(() => {
    if (roomId) {
      fetchRoom()
      fetchMessages()
    } else {
      setLoading(false)
      setRoom(null)
      setMessages([])
    }
  }, [roomId, fetchRoom, fetchMessages])

  // 메시지 polling (3초마다, 로딩 표시 없음)
  useEffect(() => {
    if (!roomId) return

    const interval = setInterval(() => {
      fetchMessages(undefined, false)  // showLoading = false
    }, 3000)

    return () => clearInterval(interval)
  }, [roomId, fetchMessages])

  // 에이전트 타이핑 상태 polling (1초마다)
  useEffect(() => {
    if (!roomId) return

    const checkTypingStatus = async () => {
      try {
        const res = await fetch(`/api/chat/rooms/${roomId}`)
        if (!res.ok) return
        const data = await res.json()

        // 에이전트 참여자 중 타이핑 중인 에이전트 확인
        const typingAgents = data.participants?.filter((p: any) =>
          p.participant_type === 'agent' && p.is_typing
        ) || []

        if (typingAgents.length > 0) {
          setAgentTyping(true)
          // 타이핑 중인 에이전트 참여자 저장 (UI에서 표시용)
          setTypingUsers(typingAgents)
        } else {
          // 타이핑 중인 에이전트가 없으면 해제
          if (agentTyping) {
            setAgentTyping(false)
            setTypingUsers([])
          }
        }
      } catch (err) {
        // 에러 무시
      }
    }

    const interval = setInterval(checkTypingStatus, 1000)
    checkTypingStatus() // 초기 체크

    return () => clearInterval(interval)
  }, [roomId, agentTyping])

  // 새 에이전트 메시지 감지시 타이핑 해제
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      // 새로운 메시지인지 확인
      if (lastMsg.id !== lastMessageIdRef.current) {
        lastMessageIdRef.current = lastMsg.id
        // 에이전트 메시지이고 타이핑 중이면 해제
        if (lastMsg.sender_type === 'agent' && agentTyping) {
          console.log('[useChat] New agent message received:', lastMsg.id, 'setting agentTyping to false')
          setAgentTyping(false)
        }
      }
    }
  }, [messages, agentTyping])

  // 메시지 전송
  const sendMessage = async (content: string, options?: {
    message_type?: 'text' | 'image' | 'file'
    metadata?: Record<string, any>
    reply_to_id?: string
  }) => {
    if (!roomId || !content.trim()) return

    // 채팅방에 에이전트가 있는지 확인 (ref에서 가져옴 - 항상 최신 값)
    const hasAgent = hasAgentRef.current

    console.log('[useChat] sendMessage - hasAgent:', hasAgent, '(from ref)')

    try {
      setSending(true)

      // 에이전트가 있으면 타이핑 상태 설정
      if (hasAgent) {
        console.log('[useChat] Setting agentTyping to TRUE - waiting for agent response')
        setAgentTyping(true)
      } else {
        console.log('[useChat] No agent in room, skipping agentTyping')
      }

      const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          ...options,
        }),
      })
      if (!res.ok) throw new Error('Failed to send message')

      // 응답에서 메시지 가져와서 바로 추가 (optimistic update)
      const newMessage = await res.json()
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === newMessage.id)
        if (exists) return prev
        return [...prev, newMessage]
      })

      // 에이전트 응답 타임아웃 (15초 후 타이핑 상태 해제)
      if (hasAgent) {
        setTimeout(() => {
          console.log('[useChat] Agent typing timeout reached, setting agentTyping to false')
          setAgentTyping(false)
        }, 15000)
      }

      // 타이핑 상태 해제
      await setTyping(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setAgentTyping(false) // 에러 시 타이핑 해제
      throw err
    } finally {
      setSending(false)
    }
  }

  // 타이핑 상태 설정
  const setTyping = async (isTyping: boolean) => {
    if (!roomId) return

    try {
      await fetch(`/api/chat/rooms/${roomId}/typing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_typing: isTyping }),
      })
    } catch (err) {
      console.error('Failed to set typing status:', err)
    }
  }

  // 타이핑 핸들러 (debounced)
  const handleTyping = useCallback(() => {
    setTyping(true)

    // 이전 타임아웃 취소
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // 3초 후 타이핑 상태 해제
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false)
    }, 3000)
  }, [roomId])

  // 정리
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  return {
    room,
    messages,
    loading,
    sending,
    error,
    typingUsers,
    agentTyping,
    sendMessage,
    handleTyping,
    fetchMessages,
    fetchRoom,
  }
}

// 회의 상태 관리 훅
export function useMeeting(roomId: string | null) {
  const [meetingStatus, setMeetingStatus] = useState<{
    is_meeting_active: boolean
    meeting_topic: string | null
    meeting_duration_minutes: number | null
    meeting_started_at: string | null
    meeting_end_time: string | null
    remaining_seconds: number | null
    meeting_facilitator_id: string | null  // 진행자 ID 추가
  } | null>(null)
  const [loading, setLoading] = useState(false)

  // 회의 상태 조회
  const fetchMeetingStatus = useCallback(async () => {
    if (!roomId) return
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/meeting`)
      if (!res.ok) return
      const data = await res.json()
      setMeetingStatus(data)
    } catch (err) {
      console.error('Failed to fetch meeting status:', err)
    }
  }, [roomId])

  // 회의 시작
  const startMeeting = async (topic: string, durationMinutes: number, facilitatorId?: string | null) => {
    if (!roomId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/meeting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          duration_minutes: durationMinutes,
          facilitator_id: facilitatorId || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to start meeting')
      const data = await res.json()
      setMeetingStatus(data)
      return data
    } catch (err) {
      console.error('Failed to start meeting:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 회의 종료
  const endMeeting = async () => {
    if (!roomId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/meeting`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to end meeting')
      const data = await res.json()
      setMeetingStatus(data)
      return data
    } catch (err) {
      console.error('Failed to end meeting:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 초기 로드
  useEffect(() => {
    if (roomId) {
      fetchMeetingStatus()
    } else {
      setMeetingStatus(null)
    }
  }, [roomId, fetchMeetingStatus])

  // 회의 중일 때 1초마다 상태 업데이트
  useEffect(() => {
    if (!roomId || !meetingStatus?.is_meeting_active) return

    const interval = setInterval(() => {
      fetchMeetingStatus()
    }, 1000)

    return () => clearInterval(interval)
  }, [roomId, meetingStatus?.is_meeting_active, fetchMeetingStatus])

  return {
    meetingStatus,
    loading,
    startMeeting,
    endMeeting,
    fetchMeetingStatus,
  }
}

// 온라인 상태 관리 훅
export function usePresence(roomId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (!roomId) return

    const supabase = supabaseRef.current
    const channel = supabase.channel(`presence:${roomId}`)

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const userIds = Object.values(state)
          .flat()
          .map((p: any) => p.user_id)
        setOnlineUsers(Array.from(new Set(userIds)))
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await channel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            })
          }
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { onlineUsers }
}
