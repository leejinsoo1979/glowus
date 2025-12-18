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
