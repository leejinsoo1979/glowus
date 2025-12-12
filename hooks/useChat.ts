'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChatRoom, ChatMessage, ChatParticipant } from '@/types/chat'
import { RealtimeChannel } from '@supabase/supabase-js'

// 채팅방 목록 훅
export function useChatRooms() {
  console.log('[useChat] useChatRooms 훅 실행')
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchRooms = useCallback(async () => {
    console.log('[useChat] fetchRooms 시작')
    try {
      setLoading(true)
      console.log('[useChat] API 호출 시작: /api/chat/rooms')
      const res = await fetch('/api/chat/rooms')
      console.log('[useChat] API 응답:', res.status)
      const data = await res.json()

      if (!res.ok) {
        // 인증 안됨 - 빈 배열로 처리
        if (res.status === 401) {
          setRooms([])
          setError(null)
          return
        }
        throw new Error(data.error || 'Failed to fetch rooms')
      }

      // data가 배열인지 확인
      setRooms(Array.isArray(data) ? data : [])
      setError(null)
    } catch (err) {
      console.error('Chat rooms fetch error:', err)
      setRooms([])
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  // 실시간 업데이트 구독
  useEffect(() => {
    let channel: RealtimeChannel | null = null

    try {
      channel = supabase
        .channel('chat_rooms_updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_rooms',
          },
          () => {
            fetchRooms()
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
          },
          () => {
            fetchRooms() // 새 메시지 시 목록 갱신
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('Chat realtime subscription error')
          }
        })
    } catch (err) {
      console.warn('Chat realtime setup failed:', err)
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [supabase, fetchRooms])

  const createRoom = async (data: {
    name?: string
    type: 'direct' | 'group' | 'meeting'
    participant_ids: { type: 'user' | 'agent'; id: string }[]
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
  const [agentTyping, setAgentTyping] = useState(false) // 에이전트 응답 생성 중

  const supabase = createClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  // 메시지 조회
  const fetchMessages = useCallback(async (before?: string) => {
    if (!roomId) return
    try {
      setLoading(true)
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
      setLoading(false)
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

  // 실시간 메시지 구독
  useEffect(() => {
    if (!roomId) return

    let isSubscribed = true
    let pollingInterval: NodeJS.Timeout | null = null

    const channel = supabase
      .channel(`room:${roomId}:${Date.now()}`) // 고유한 채널 이름
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          if (isSubscribed) {
            // 새 메시지 - 전체 다시 가져오기 (sender 정보 포함)
            fetchMessages()
            // 에이전트 타이핑 상태 해제
            setAgentTyping(false)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_participants',
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          if (!isSubscribed) return
          // 타이핑 상태 변경 시 참여자 정보 갱신
          await fetchRoom()
          // 타이핑 중인 사용자 필터링
          if (room?.participants) {
            const typing = room.participants.filter((p) => p.is_typing)
            setTypingUsers(typing)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // 실시간 연결 성공하면 폴링 중지
          if (pollingInterval) {
            clearInterval(pollingInterval)
            pollingInterval = null
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // 실시간 실패 시 폴링 시작 (3초마다)
          if (!pollingInterval) {
            pollingInterval = setInterval(() => {
              if (isSubscribed) {
                fetchMessages()
              }
            }, 3000)
          }
        }
      })

    channelRef.current = channel

    // 초기 폴링 시작 (realtime이 연결될 때까지)
    pollingInterval = setInterval(() => {
      if (isSubscribed) {
        fetchMessages()
      }
    }, 5000)

    return () => {
      isSubscribed = false
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
      supabase.removeChannel(channel)
    }
  }, [roomId, supabase, fetchMessages, fetchRoom, room?.participants])

  // 메시지 전송
  const sendMessage = async (content: string, options?: {
    message_type?: 'text' | 'image' | 'file'
    metadata?: Record<string, any>
    reply_to_id?: string
  }) => {
    if (!roomId || !content.trim()) return

    // 채팅방에 에이전트가 있는지 확인
    const hasAgent = room?.participants?.some(p => p.participant_type === 'agent' || p.agent)

    try {
      setSending(true)

      // 에이전트가 있으면 타이핑 상태 설정
      if (hasAgent) {
        setAgentTyping(true)
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

      // 에이전트 응답 대기 후 메시지 갱신 (Realtime 안될 경우 대비)
      const checkForAgentResponse = async () => {
        await fetchMessages()
        // 새 메시지가 에이전트로부터 왔는지 확인
        const latestMessages = await fetch(`/api/chat/rooms/${roomId}/messages`).then(r => r.json())
        const hasNewAgentMessage = latestMessages.some((m: any) =>
          m.sender_type === 'agent' && new Date(m.created_at) > new Date(newMessage.created_at)
        )
        if (hasNewAgentMessage) {
          setAgentTyping(false)
        }
        return hasNewAgentMessage
      }

      // 점진적으로 체크 (더 자주, 더 오래)
      const intervals = [500, 1000, 1500, 2000, 3000, 4000, 6000, 8000, 10000, 15000]
      for (const delay of intervals) {
        setTimeout(async () => {
          const found = await checkForAgentResponse()
          if (found) return
        }, delay)
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

// 온라인 상태 관리 훅
export function usePresence(roomId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!roomId) return

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
  }, [roomId, supabase])

  return { onlineUsers }
}
