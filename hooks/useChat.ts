'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChatRoom, ChatMessage, ChatParticipant } from '@/types/chat'
import { RealtimeChannel } from '@supabase/supabase-js'

// 채팅방 목록 훅
export function useChatRooms() {
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/chat/rooms')
      if (!res.ok) throw new Error('Failed to fetch rooms')
      const data = await res.json()
      setRooms(data)
      setError(null)
    } catch (err) {
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
    const channel = supabase
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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
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
      setRoom(null)
      setMessages([])
    }
  }, [roomId, fetchRoom, fetchMessages])

  // 실시간 메시지 구독
  useEffect(() => {
    if (!roomId) return

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          // 새 메시지 추가 (중복 방지)
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === payload.new.id)
            if (exists) return prev
            return [...prev, payload.new as ChatMessage]
          })
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
          // 타이핑 상태 변경 시 참여자 정보 갱신
          await fetchRoom()
          // 타이핑 중인 사용자 필터링
          if (room?.participants) {
            const typing = room.participants.filter((p) => p.is_typing)
            setTypingUsers(typing)
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, supabase, room?.participants, fetchRoom])

  // 메시지 전송
  const sendMessage = async (content: string, options?: {
    message_type?: 'text' | 'image' | 'file'
    metadata?: Record<string, any>
    reply_to_id?: string
  }) => {
    if (!roomId || !content.trim()) return

    try {
      setSending(true)
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          ...options,
        }),
      })
      if (!res.ok) throw new Error('Failed to send message')

      // 타이핑 상태 해제
      await setTyping(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
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
        setOnlineUsers([...new Set(userIds)])
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
