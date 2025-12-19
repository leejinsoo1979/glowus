'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import { useSessionSync } from '@/hooks/useSessionSync'
import {
  buildContextPack,
  injectContextToPrompt,
  extractEvidenceFromResponse,
  validateAgentResponse
} from '@/lib/session/context-pack'
import {
  MeetingProtocol,
  DebateProtocol,
  PresentationProtocol,
  FreeProtocol
} from '@/lib/session/protocol-manager'

type SessionMode = 'meeting' | 'presentation' | 'debate' | 'free'

export default function SessionRoomPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const roomId = params.roomId as string
  const initialMode = (searchParams.get('mode') as SessionMode) || 'meeting'

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { user: authUser } = useAuth()

  // Protocol refs
  const meetingProtocol = useRef<MeetingProtocol | null>(null)
  const debateProtocol = useRef<DebateProtocol | null>(null)
  const presentationProtocol = useRef<PresentationProtocol | null>(null)
  const freeProtocol = useRef<FreeProtocol | null>(null)

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
    setSession,
    addDecision,
    addActionItem,
    addRisk
  } = useSessionStore()

  // Session sync hook
  const { broadcastFocus, broadcastTyping, broadcastMessage } = useSessionSync({
    sessionId: roomId,
    userId: currentUserId || '',
    onFocusChange: (focus, fromUserId) => {
      console.log('[Sync] Focus changed by:', fromUserId)
    },
    onNewMessage: (message) => {
      console.log('[Sync] New message:', message.id)
    }
  })

  // Initialize protocols based on mode
  useEffect(() => {
    switch (mode) {
      case 'meeting':
        meetingProtocol.current = new MeetingProtocol(300) // 5 min timebox
        break
      case 'debate':
        const teamA = participants.filter(p => p.role === '찬성').map(p => p.id)
        const teamB = participants.filter(p => p.role === '반대').map(p => p.id)
        debateProtocol.current = new DebateProtocol(teamA, teamB)
        break
      case 'presentation':
        const presenter = participants.find(p => p.role === '발표자')
        if (presenter) {
          presentationProtocol.current = new PresentationProtocol(presenter.id)
        }
        break
      case 'free':
        freeProtocol.current = new FreeProtocol()
        break
    }
  }, [mode, participants])

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
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.png,.jpg,.jpeg,.gif,.mp4,.webm,.mov'

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      let type: 'pdf' | 'image' | 'video' = 'pdf'
      if (file.type.startsWith('image/')) type = 'image'
      else if (file.type.startsWith('video/')) type = 'video'

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

  // Handle focus change with sync
  const handleFocusChange = useCallback((newFocus: ViewerFocus) => {
    setFocus(newFocus)
    if (syncEnabled) {
      broadcastFocus(newFocus)
    }
  }, [setFocus, syncEnabled, broadcastFocus])

  // Handle evidence click (jump viewer to evidence location)
  const handleEvidenceClick = useCallback((evidence: Evidence) => {
    const artifact = artifacts.find(a =>
      a.id === evidence.artifactId ||
      a.name.toLowerCase().includes(evidence.artifactName.toLowerCase())
    )

    if (artifact) {
      const newFocus: ViewerFocus = {
        artifactId: artifact.id,
        page: evidence.page,
        region: evidence.region,
        timestamp: evidence.timestamp
      }
      setFocus(newFocus)

      if (syncEnabled) {
        broadcastFocus(newFocus)
      }
    }
  }, [artifacts, setFocus, syncEnabled, broadcastFocus])

  // Handle send message with context injection
  const handleSendMessage = useCallback(async (content: string, evidenceFromInput?: Evidence[]) => {
    if (!currentUserId) return

    setSending(true)

    // Add user message
    const userMessage: SessionMessage = {
      id: `msg-${Date.now()}`,
      participantId: currentUserId,
      content,
      timestamp: new Date(),
      evidence: evidenceFromInput
    }
    addMessage(userMessage)
    broadcastMessage(userMessage)

    // Process through protocol
    let protocolResult: { allowed: boolean; suggestion?: string; forceConclusion?: boolean } = { allowed: true }

    if (mode === 'meeting' && meetingProtocol.current) {
      protocolResult = meetingProtocol.current.processMessage(userMessage)
    } else if (mode === 'free' && freeProtocol.current) {
      const result = freeProtocol.current.processMessage(userMessage)
      if (result.warning) {
        protocolResult.suggestion = result.warning
      }
    }

    // Build context pack for agent
    const contextPack = await buildContextPack(artifacts, focus, {
      includeContextPages: true,
      extractText: true
    })

    // Inject context into prompt
    const enrichedPrompt = injectContextToPrompt(content, contextPack, mode)

    try {
      // Call agent API
      const response = await fetch('/api/chat/rooms/' + roomId + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: enrichedPrompt,
          mode,
          contextPack,
          forceConclusion: protocolResult.forceConclusion
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()
      const agentContent = data.content || data.message?.content || `${content}에 대한 응답입니다.`

      // Extract evidence from agent response
      const extractedEvidence = extractEvidenceFromResponse(agentContent, artifacts)

      // Validate response (Pretend prevention)
      const validation = validateAgentResponse(agentContent, extractedEvidence)

      const agentMessage: SessionMessage = {
        id: `msg-${Date.now() + 1}`,
        participantId: 'agent-rachel',
        content: agentContent,
        timestamp: new Date(),
        evidence: extractedEvidence,
        confidence: validation.isValid ? 0.9 : 0.6
      }

      // Add warning if validation failed
      if (!validation.isValid) {
        console.warn('[Validation]', validation.warnings)
      }

      addMessage(agentMessage)
      broadcastMessage(agentMessage)

      // Handle protocol suggestion
      if (protocolResult.suggestion) {
        addMessage({
          id: `msg-${Date.now() + 2}`,
          participantId: 'system',
          content: protocolResult.suggestion,
          timestamp: new Date(),
          isSystemMessage: true
        })
      }

    } catch (error) {
      console.error('Send message error:', error)

      // Fallback response
      const agentMessage: SessionMessage = {
        id: `msg-${Date.now() + 1}`,
        participantId: 'agent-rachel',
        content: `${content}에 대해 검토하겠습니다. 현재 자료를 분석 중입니다.`,
        timestamp: new Date(),
        confidence: 0.7
      }
      addMessage(agentMessage)
    }

    setSending(false)
  }, [currentUserId, addMessage, setSending, artifacts, focus, mode, roomId, broadcastMessage])

  // Handle conclude request
  const handleConcludeRequest = useCallback(async () => {
    addMessage({
      id: `msg-${Date.now()}`,
      participantId: 'system',
      content: '결론 도출을 시작합니다...',
      timestamp: new Date(),
      isSystemMessage: true
    })

    setSending(true)

    let conclusionPrompt = ''

    if (mode === 'meeting' && meetingProtocol.current) {
      conclusionPrompt = meetingProtocol.current.generateConclusionPrompt()
    } else if (mode === 'debate' && debateProtocol.current) {
      conclusionPrompt = debateProtocol.current.generateSynthesisPrompt()
    } else if (mode === 'presentation' && presentationProtocol.current) {
      conclusionPrompt = presentationProtocol.current.generateSummaryPrompt()
    }

    // Build context for conclusion
    const contextPack = await buildContextPack(artifacts, focus, {
      includeContextPages: true,
      extractText: true
    })

    try {
      const response = await fetch('/api/chat/rooms/' + roomId + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: conclusionPrompt,
          mode,
          contextPack,
          isConclusion: true
        })
      })

      if (!response.ok) throw new Error('Failed to generate conclusion')

      const data = await response.json()
      const conclusionContent = data.content || data.message?.content || '결론을 도출하지 못했습니다.'

      // Extract outputs from conclusion
      if (mode === 'meeting' && meetingProtocol.current) {
        const outputs = meetingProtocol.current.extractOutputs(conclusionContent)
        outputs.decisions.forEach(d => addDecision(d))
        outputs.actionItems.forEach(a => addActionItem(a))
        outputs.risks.forEach(r => addRisk(r))
      }

      const extractedEvidence = extractEvidenceFromResponse(conclusionContent, artifacts)

      addMessage({
        id: `msg-${Date.now() + 1}`,
        participantId: 'agent-rachel',
        content: conclusionContent,
        timestamp: new Date(),
        evidence: extractedEvidence,
        role: 'conclusion',
        confidence: 0.95
      })

    } catch (error) {
      console.error('Conclusion error:', error)
      addMessage({
        id: `msg-${Date.now() + 1}`,
        participantId: 'agent-rachel',
        content: '결론 도출 중 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date()
      })
    }

    setSending(false)
  }, [addMessage, setSending, mode, artifacts, focus, roomId, addDecision, addActionItem, addRisk])

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
