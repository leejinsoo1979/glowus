'use client'

import { useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSessionStore } from '@/stores/sessionStore'
import type { ViewerFocus } from '@/components/session-room/ViewerPanel'
import type { SessionMessage, SessionParticipant } from '@/components/session-room/ChatPanel'

interface SessionSyncOptions {
  sessionId: string
  userId: string
  onFocusChange?: (focus: ViewerFocus, fromUserId: string) => void
  onParticipantJoin?: (participant: SessionParticipant) => void
  onParticipantLeave?: (participantId: string) => void
  onNewMessage?: (message: SessionMessage) => void
  onTypingChange?: (participantId: string, isTyping: boolean) => void
}

export function useSessionSync({
  sessionId,
  userId,
  onFocusChange,
  onParticipantJoin,
  onParticipantLeave,
  onNewMessage,
  onTypingChange
}: SessionSyncOptions) {
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const {
    setFocus,
    addParticipant,
    removeParticipant,
    addMessage,
    setTyping,
    syncEnabled,
    presenterId
  } = useSessionStore()

  // Broadcast focus change
  const broadcastFocus = useCallback((focus: ViewerFocus) => {
    if (!channelRef.current) return

    channelRef.current.send({
      type: 'broadcast',
      event: 'focus',
      payload: {
        focus,
        userId,
        timestamp: Date.now()
      }
    })
  }, [userId])

  // Broadcast typing status
  const broadcastTyping = useCallback((isTyping: boolean) => {
    if (!channelRef.current) return

    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId,
        isTyping,
        timestamp: Date.now()
      }
    })
  }, [userId])

  // Broadcast new message
  const broadcastMessage = useCallback((message: SessionMessage) => {
    if (!channelRef.current) return

    channelRef.current.send({
      type: 'broadcast',
      event: 'message',
      payload: {
        message,
        timestamp: Date.now()
      }
    })
  }, [])

  // Setup channel subscription
  useEffect(() => {
    if (!sessionId || !userId) return

    const channel = supabase.channel(`session:${sessionId}`, {
      config: {
        presence: {
          key: userId
        }
      }
    })

    // Handle focus broadcasts
    channel.on('broadcast', { event: 'focus' }, ({ payload }) => {
      const { focus, userId: fromUserId } = payload

      // Only apply focus if sync is enabled and we're not the presenter
      // or if the focus comes from the presenter
      if (syncEnabled && (presenterId === fromUserId || !presenterId)) {
        setFocus(focus)
        onFocusChange?.(focus, fromUserId)
      }
    })

    // Handle typing broadcasts
    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      const { userId: typingUserId, isTyping } = payload
      if (typingUserId !== userId) {
        setTyping(typingUserId, isTyping)
        onTypingChange?.(typingUserId, isTyping)
      }
    })

    // Handle new message broadcasts
    channel.on('broadcast', { event: 'message' }, ({ payload }) => {
      const { message } = payload
      // Don't add our own messages (they're already added locally)
      if (message.participantId !== userId) {
        addMessage(message)
        onNewMessage?.(message)
      }
    })

    // Handle presence
    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      const presence = newPresences[0]
      if (presence && key !== userId) {
        const participant: SessionParticipant = {
          id: key,
          name: presence.name || 'Unknown',
          type: presence.type || 'user',
          role: presence.role,
          isActive: true
        }
        addParticipant(participant)
        onParticipantJoin?.(participant)
      }
    })

    channel.on('presence', { event: 'leave' }, ({ key }) => {
      if (key !== userId) {
        removeParticipant(key)
        onParticipantLeave?.(key)
      }
    })

    // Subscribe and track presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          id: userId,
          online_at: new Date().toISOString()
        })
      }
    })

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [
    sessionId,
    userId,
    supabase,
    syncEnabled,
    presenterId,
    setFocus,
    setTyping,
    addMessage,
    addParticipant,
    removeParticipant,
    onFocusChange,
    onTypingChange,
    onNewMessage,
    onParticipantJoin,
    onParticipantLeave
  ])

  return {
    broadcastFocus,
    broadcastTyping,
    broadcastMessage
  }
}

// Hook for synced focus updates
export function useSyncedFocus(sessionId: string, userId: string) {
  const { focus, setFocus, syncEnabled } = useSessionStore()
  const { broadcastFocus } = useSessionSync({ sessionId, userId })

  const updateFocus = useCallback((newFocus: ViewerFocus) => {
    setFocus(newFocus)
    if (syncEnabled) {
      broadcastFocus(newFocus)
    }
  }, [setFocus, syncEnabled, broadcastFocus])

  return { focus, updateFocus }
}
