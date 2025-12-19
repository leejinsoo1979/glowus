'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/sessionStore'
import {
  SessionLayout,
  SessionTopBar,
  ViewerPanel,
  ChatPanel
} from '@/components/session-room'
import type { Artifact, ViewerFocus } from '@/components/session-room/ViewerPanel'
import type { SessionMessage, SessionParticipant } from '@/components/session-room/ChatPanel'
import type { Evidence } from '@/components/session-room/ChatPanel/EvidenceTag'
import { useAuth } from '@/hooks/useAuth'
import { DEV_USER, isDevMode } from '@/lib/dev-user'

type SessionMode = 'meeting' | 'presentation' | 'debate' | 'free'

export default function SessionRoomPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const roomId = params.roomId as string
  const initialMode = (searchParams.get('mode') as SessionMode) || 'meeting'

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { user: authUser } = useAuth()

  // Session store
  const {
    mode,
    setMode,
    participants,
    addParticipant,
    currentUserId,
    setCurrentUser,
    artifacts,
    addArtifact,
    removeArtifact,
    focus,
    setFocus,
    syncEnabled,
    presenterId,
    messages,
    addMessage,
    isLoading,
    isSending,
    setSending,
    typingParticipants,
    timerSeconds,
    isTimerRunning,
    startTimer,
    pauseTimer,
    resetTimer,
    setTimerSeconds,
    setSession
  } = useSessionStore()

  // Timer effect
  useEffect(() => {
    if (!isTimerRunning) return

    const interval = setInterval(() => {
      setTimerSeconds(timerSeconds + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isTimerRunning, timerSeconds, setTimerSeconds])

  // Initialize session
  useEffect(() => {
    const userId = isDevMode() ? DEV_USER.id : authUser?.id
    if (userId) {
      setCurrentUser(userId)
    }

    setSession(roomId, '세션 룸', initialMode)

    // Add demo participants
    addParticipant({
      id: userId || 'user-1',
      name: isDevMode() ? DEV_USER.name : authUser?.email?.split('@')[0] || 'User',
      type: 'user'
    })

    addParticipant({
      id: 'agent-rachel',
      name: 'Rachel',
      type: 'agent',
      role: '진행자'
    })

    addParticipant({
      id: 'agent-analyst',
      name: 'Analyst',
      type: 'agent',
      role: '분석가'
    })
  }, [roomId, initialMode, authUser])

  // Handle artifact add
  const handleArtifactAdd = useCallback(() => {
    // Open file picker
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.png,.jpg,.jpeg,.gif,.mp4,.webm,.mov'

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      // Determine type
      let type: 'pdf' | 'image' | 'video' = 'pdf'
      if (file.type.startsWith('image/')) type = 'image'
      else if (file.type.startsWith('video/')) type = 'video'

      // Create object URL
      const url = URL.createObjectURL(file)

      addArtifact({
        id: `artifact-${Date.now()}`,
        type,
        name: file.name,
        url
      })
    }

    input.click()
  }, [addArtifact])

  // Handle focus change
  const handleFocusChange = useCallback((newFocus: ViewerFocus) => {
    setFocus(newFocus)
    // TODO: Sync focus via WebSocket/Realtime
  }, [setFocus])

  // Handle evidence click (jump viewer to evidence location)
  const handleEvidenceClick = useCallback((evidence: Evidence) => {
    const artifact = artifacts.find(a =>
      a.id === evidence.artifactId ||
      a.name.toLowerCase().includes(evidence.artifactName.toLowerCase())
    )

    if (artifact) {
      setFocus({
        artifactId: artifact.id,
        page: evidence.page,
        region: evidence.region,
        timestamp: evidence.timestamp
      })
    }
  }, [artifacts, setFocus])

  // Handle send message
  const handleSendMessage = useCallback(async (content: string, evidence?: Evidence[]) => {
    if (!currentUserId) return

    setSending(true)

    // Add user message
    const userMessage: SessionMessage = {
      id: `msg-${Date.now()}`,
      participantId: currentUserId,
      content,
      timestamp: new Date(),
      evidence
    }
    addMessage(userMessage)

    // Simulate agent response (TODO: Replace with actual API call)
    setTimeout(() => {
      const agentMessage: SessionMessage = {
        id: `msg-${Date.now() + 1}`,
        participantId: 'agent-rachel',
        content: `${content}에 대한 응답입니다. 현재 자료를 검토하고 있습니다.`,
        timestamp: new Date(),
        confidence: 0.85
      }
      addMessage(agentMessage)
      setSending(false)
    }, 1500)
  }, [currentUserId, addMessage, setSending])

  // Handle conclude request
  const handleConcludeRequest = useCallback(() => {
    // TODO: Implement conclusion generation
    addMessage({
      id: `msg-${Date.now()}`,
      participantId: 'agent-rachel',
      content: '회의 결론을 도출하겠습니다...',
      timestamp: new Date(),
      isSystemMessage: true
    })
  }, [addMessage])

  return (
    <div className={cn(
      'h-screen',
      isDark ? 'bg-neutral-950' : 'bg-neutral-50'
    )}>
      <SessionLayout
        topBar={
          <SessionTopBar
            title="세션 룸"
            mode={mode}
            onModeChange={setMode}
            participantCount={participants.length}
            timerSeconds={timerSeconds}
            isTimerRunning={isTimerRunning}
            onTimerToggle={() => isTimerRunning ? pauseTimer() : startTimer()}
            onTimerReset={resetTimer}
            onShare={() => {/* TODO */}}
            onSettings={() => {/* TODO */}}
          />
        }
        viewer={
          <ViewerPanel
            artifacts={artifacts}
            focus={focus}
            onFocusChange={handleFocusChange}
            onArtifactAdd={handleArtifactAdd}
            onArtifactRemove={removeArtifact}
            syncEnabled={syncEnabled}
            isPresenter={presenterId === currentUserId}
          />
        }
        chat={
          <ChatPanel
            messages={messages}
            participants={participants}
            currentUserId={currentUserId || ''}
            mode={mode}
            isLoading={isLoading}
            isSending={isSending}
            onSendMessage={handleSendMessage}
            onEvidenceClick={handleEvidenceClick}
            typingParticipants={typingParticipants}
            onConcludeRequest={handleConcludeRequest}
          />
        }
      />
    </div>
  )
}
