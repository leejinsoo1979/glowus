import { create } from 'zustand'
import type { Artifact, ViewerFocus } from '@/components/session-room/ViewerPanel'
import type { SessionParticipant, SessionMessage } from '@/components/session-room/ChatPanel'
import type { Evidence } from '@/components/session-room/ChatPanel/EvidenceTag'

type SessionMode = 'meeting' | 'presentation' | 'debate' | 'free'
type SessionStatus = 'scheduled' | 'active' | 'paused' | 'completed'

interface ProtocolState {
  // 회의 모드
  agenda?: string[]
  currentAgendaIndex?: number
  decisions?: string[]
  actionItems?: { task: string; assignee?: string; deadline?: string }[]
  risks?: string[]

  // 발표 모드
  presenterId?: string
  currentSlide?: number
  qaPending?: string[]

  // 토론 모드
  teamA?: string[] // participant IDs
  teamB?: string[]
  currentRound?: 'opening' | 'cross' | 'rebuttal' | 'synthesis'
  scores?: { teamA: number; teamB: number }
}

interface SessionState {
  // Session Info
  sessionId: string | null
  title: string
  mode: SessionMode
  status: SessionStatus

  // Participants
  participants: SessionParticipant[]
  currentUserId: string | null
  typingParticipants: string[]

  // Artifacts & Focus
  artifacts: Artifact[]
  focus: ViewerFocus | null
  syncEnabled: boolean
  presenterId: string | null // who controls focus

  // Messages
  messages: SessionMessage[]
  isLoading: boolean
  isSending: boolean

  // Timer
  timerSeconds: number
  isTimerRunning: boolean
  timeLimit?: number // optional time limit in seconds

  // Protocol
  protocol: ProtocolState

  // Actions
  setSession: (sessionId: string, title: string, mode: SessionMode) => void
  setMode: (mode: SessionMode) => void
  setStatus: (status: SessionStatus) => void

  addParticipant: (participant: SessionParticipant) => void
  removeParticipant: (id: string) => void
  setCurrentUser: (id: string) => void
  setTyping: (participantId: string, isTyping: boolean) => void

  addArtifact: (artifact: Artifact) => void
  removeArtifact: (id: string) => void
  setFocus: (focus: ViewerFocus | null) => void
  setSyncEnabled: (enabled: boolean) => void
  setPresenter: (id: string | null) => void

  addMessage: (message: SessionMessage) => void
  setMessages: (messages: SessionMessage[]) => void
  setLoading: (loading: boolean) => void
  setSending: (sending: boolean) => void

  setTimerSeconds: (seconds: number) => void
  startTimer: () => void
  pauseTimer: () => void
  resetTimer: () => void

  updateProtocol: (updates: Partial<ProtocolState>) => void
  addDecision: (decision: string) => void
  addActionItem: (item: { task: string; assignee?: string; deadline?: string }) => void
  addRisk: (risk: string) => void

  reset: () => void
}

const initialState = {
  sessionId: null,
  title: '',
  mode: 'meeting' as SessionMode,
  status: 'scheduled' as SessionStatus,
  participants: [],
  currentUserId: null,
  typingParticipants: [],
  artifacts: [],
  focus: null,
  syncEnabled: true,
  presenterId: null,
  messages: [],
  isLoading: false,
  isSending: false,
  timerSeconds: 0,
  isTimerRunning: false,
  timeLimit: undefined,
  protocol: {}
}

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialState,

  setSession: (sessionId, title, mode) => set({
    sessionId,
    title,
    mode,
    status: 'active'
  }),

  setMode: (mode) => set({ mode }),
  setStatus: (status) => set({ status }),

  addParticipant: (participant) => set((state) => ({
    participants: [...state.participants.filter(p => p.id !== participant.id), participant]
  })),

  removeParticipant: (id) => set((state) => ({
    participants: state.participants.filter(p => p.id !== id)
  })),

  setCurrentUser: (id) => set({ currentUserId: id }),

  setTyping: (participantId, isTyping) => set((state) => ({
    typingParticipants: isTyping
      ? [...state.typingParticipants.filter(id => id !== participantId), participantId]
      : state.typingParticipants.filter(id => id !== participantId)
  })),

  addArtifact: (artifact) => set((state) => ({
    artifacts: [...state.artifacts.filter(a => a.id !== artifact.id), artifact]
  })),

  removeArtifact: (id) => set((state) => ({
    artifacts: state.artifacts.filter(a => a.id !== id),
    focus: state.focus?.artifactId === id ? null : state.focus
  })),

  setFocus: (focus) => set({ focus }),
  setSyncEnabled: (enabled) => set({ syncEnabled: enabled }),
  setPresenter: (id) => set({ presenterId: id }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  setMessages: (messages) => set({ messages }),
  setLoading: (loading) => set({ isLoading: loading }),
  setSending: (sending) => set({ isSending: sending }),

  setTimerSeconds: (seconds) => set({ timerSeconds: seconds }),

  startTimer: () => {
    set({ isTimerRunning: true })
  },

  pauseTimer: () => set({ isTimerRunning: false }),

  resetTimer: () => set({
    timerSeconds: 0,
    isTimerRunning: false
  }),

  updateProtocol: (updates) => set((state) => ({
    protocol: { ...state.protocol, ...updates }
  })),

  addDecision: (decision) => set((state) => ({
    protocol: {
      ...state.protocol,
      decisions: [...(state.protocol.decisions || []), decision]
    }
  })),

  addActionItem: (item) => set((state) => ({
    protocol: {
      ...state.protocol,
      actionItems: [...(state.protocol.actionItems || []), item]
    }
  })),

  addRisk: (risk) => set((state) => ({
    protocol: {
      ...state.protocol,
      risks: [...(state.protocol.risks || []), risk]
    }
  })),

  reset: () => set(initialState)
}))

// Timer effect hook
export function useSessionTimer() {
  const { isTimerRunning, timerSeconds, setTimerSeconds, timeLimit, pauseTimer } = useSessionStore()

  // This should be called in a useEffect in the component
  const tick = () => {
    if (!isTimerRunning) return

    setTimerSeconds(timerSeconds + 1)

    // Check time limit
    if (timeLimit && timerSeconds + 1 >= timeLimit) {
      pauseTimer()
    }
  }

  return { tick, isTimerRunning, timerSeconds }
}
