// Chat System Types

export type ChatRoomType = 'direct' | 'group' | 'meeting'
export type ParticipantType = 'user' | 'agent'
export type MessageType = 'text' | 'image' | 'file' | 'system'

// 회의 첨부 자료
export interface MeetingAttachment {
  name: string
  content: string
  type: string
}

// 채팅방
export interface ChatRoom {
  id: string
  name: string | null
  type: ChatRoomType
  team_id: string | null
  created_by: string
  is_meeting_active: boolean
  meeting_topic: string | null
  category: string | null
  meeting_attachments: MeetingAttachment[] | null
  last_message_at: string
  created_at: string
  updated_at: string
  // 조인된 데이터
  participants?: ChatParticipant[]
  last_message?: ChatMessage
  unread_count?: number
}

// 참여자
export interface ChatParticipant {
  id: string
  room_id: string
  participant_type: ParticipantType
  user_id: string | null
  agent_id: string | null
  joined_at: string
  last_read_at: string
  is_typing: boolean
  // 조인된 데이터
  user?: {
    id: string
    name: string
    email: string
    avatar_url: string | null
  }
  agent?: {
    id: string
    name: string
    description: string | null
    capabilities: string[]
    status: string
  }
}

// 메시지
export interface ChatMessage {
  id: string
  room_id: string
  sender_type: ParticipantType
  sender_user_id: string | null
  sender_agent_id: string | null
  message_type: MessageType
  content: string
  metadata: Record<string, any>
  is_ai_response: boolean
  reply_to_id: string | null
  created_at: string
  updated_at: string
  // 조인된 데이터
  sender_user?: {
    id: string
    name: string
    avatar_url: string | null
  }
  sender_agent?: {
    id: string
    name: string
  }
  reply_to?: ChatMessage
}

// 회의 설정 타입 (확장된 구조화 회의)
export interface MeetingConfig {
  // =====================
  // WHY: MISSION BRIEFING
  // =====================
  purpose?: 'strategic_decision' | 'problem_analysis' | 'action_planning' | 'idea_expansion' | 'risk_validation'

  // 오늘 반드시 결정할 것 (1문장)
  decisionStatement?: string

  // 성공 기준 (끝나면 남아야 하는 것)
  successCriteria?: string

  // 선택지 (Options, 2~5개)
  optionsPool?: string

  // 선택 기준 (가중치 포함 권장)
  decisionCriteria?: string

  // 제약/레드라인 (절대 조건)
  constraints?: string

  // =====================
  // HOW: DISCUSSION PROTOCOL
  // =====================
  discussionMode?: 'quick' | 'balanced' | 'deep' | 'brainstorm'
  allowDebate?: boolean  // AI 간 상호 반박
  failureResolution?: 'majority' | 'leader' | 'defer'  // 합의 실패 시 처리

  // 반복 발언 감지 (유사도 높으면 재작성)
  repetitionGuard?: boolean

  // 레드라인 자동 감시
  constraintEnforce?: boolean

  // =====================
  // WHO: 에이전트별 역할/성향 설정
  // =====================
  agentConfigs?: {
    id: string
    role?: 'strategist' | 'analyst' | 'executor' | 'critic' | 'mediator'
    tendency?: 'aggressive' | 'conservative' | 'creative' | 'data-driven'
    canDecide?: boolean
    customMission?: string  // 커스텀 미션
    customKpis?: string[]   // 커스텀 KPI
  }[]

  // =====================
  // CONTEXT: 입력 자료
  // =====================
  linkedProject?: string | null
  memoryScope?: 'organization' | 'project' | 'none'

  // 현재 사실 (What's true now)
  currentTruths?: string

  // 용어 정의
  definitions?: string

  // =====================
  // OUTPUT: 산출물
  // =====================
  outputs?: {
    summary?: boolean        // 의사결정 요약
    actionItems?: boolean    // 실행 태스크 생성
    decision?: boolean       // 최종 결정사항
    nextAgenda?: boolean     // 다음 회의 안건
    boardReflection?: boolean // 에이전트별 의견 정리
    riskRegister?: boolean   // 반대/리스크 요약
  }
}

// API Request/Response Types
export interface CreateRoomRequest {
  name?: string
  type: ChatRoomType
  team_id?: string
  category?: string
  attachments?: MeetingAttachment[]
  participant_ids: {
    type: ParticipantType
    id: string
  }[]
  meeting_config?: MeetingConfig  // 회의 설정
}

export interface SendMessageRequest {
  content: string
  message_type?: MessageType
  metadata?: Record<string, any>
  reply_to_id?: string
}

// Realtime Event Types
export interface RealtimeMessageEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  message: ChatMessage
}

export interface RealtimeTypingEvent {
  room_id: string
  participant_id: string
  participant_type: ParticipantType
  is_typing: boolean
}

// 공유 뷰어 타입
export type SharedMediaType = 'pdf' | 'image' | 'video'

export interface SharedViewerState {
  id: string
  room_id: string
  media_type: SharedMediaType
  media_url: string
  media_name: string
  current_page?: number      // PDF 현재 페이지
  total_pages?: number       // PDF 총 페이지
  current_time?: number      // 비디오 현재 시간 (초)
  duration?: number          // 비디오 총 길이 (초)
  is_playing?: boolean       // 비디오 재생 중 여부
  zoom_level?: number        // 확대 레벨
  presenter_id?: string      // 현재 제어권을 가진 사용자/에이전트
  presenter_type?: ParticipantType
  created_at: string
  updated_at: string
}

export interface SharedViewerControl {
  action: 'page_change' | 'seek' | 'play' | 'pause' | 'zoom' | 'take_control' | 'release_control'
  page?: number
  time?: number
  zoom?: number
}
