/**
 * Unified Agent Memory - Cross-Platform Conversation History
 *
 * 핵심 차별점: 플랫폼 독립적 영구 메모리
 * - Telegram에서 대화한 내용 → GlowUS 웹에서 기억
 * - GlowUS 웹에서 대화한 내용 → Telegram에서 기억
 * - 어떤 플랫폼이든 같은 에이전트와의 대화는 통합
 */

import { SupabaseClient } from '@supabase/supabase-js'

export type MessageSource = 'telegram' | 'web' | 'api' | 'whatsapp' | 'messenger'
export type MessageRole = 'user' | 'assistant' | 'system' | 'model'

export interface UnifiedMessage {
  id: string
  source: MessageSource
  role: MessageRole
  content: string
  agentId: string
  agentName?: string
  createdAt: Date
  metadata?: Record<string, any>
}

export interface UnifiedMemoryOptions {
  /** Supabase user ID (auth.users.id) */
  userId?: string
  /** Telegram user ID */
  telegramUserId?: string
  /** Agent ID (deployed_agents.id) */
  agentId?: string
  /** Limit number of messages */
  limit?: number
  /** Include messages from all platforms */
  crossPlatform?: boolean
}

/**
 * 통합 에이전트 메모리 서비스
 */
export class UnifiedAgentMemory {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 크로스 플랫폼 대화 기록 조회
   * Telegram + GlowUS Web + API 모든 소스에서 통합
   */
  async getConversationHistory(options: UnifiedMemoryOptions): Promise<UnifiedMessage[]> {
    const { userId, telegramUserId, agentId, limit = 50, crossPlatform = true } = options
    const messages: UnifiedMessage[] = []

    // 1. Telegram 메시지 조회 (telegram_chat_messages)
    if (telegramUserId || crossPlatform) {
      const telegramMessages = await this.getTelegramMessages({
        telegramUserId,
        userId,
        agentId,
        limit
      })
      messages.push(...telegramMessages)
    }

    // 2. GlowUS Web 메시지 조회 (agent_messages)
    if (userId || crossPlatform) {
      const webMessages = await this.getWebMessages({
        userId,
        telegramUserId,
        agentId,
        limit
      })
      messages.push(...webMessages)
    }

    // 3. 시간순 정렬 및 중복 제거
    const uniqueMessages = this.deduplicateMessages(messages)
    uniqueMessages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    // 4. 최신 N개만 반환
    return uniqueMessages.slice(-limit)
  }

  /**
   * Telegram 메시지 조회
   */
  private async getTelegramMessages(options: {
    telegramUserId?: string
    userId?: string
    agentId?: string
    limit: number
  }): Promise<UnifiedMessage[]> {
    let telegramUserId = options.telegramUserId

    // userId로 telegramUserId 조회 (연결된 경우)
    if (!telegramUserId && options.userId) {
      const { data: telegramUser } = await this.supabase
        .from('telegram_users')
        .select('id')
        .eq('user_id', options.userId)
        .single()

      if (telegramUser) {
        telegramUserId = telegramUser.id
      }
    }

    if (!telegramUserId) {
      return []
    }

    // 세션 조회
    let sessionQuery = this.supabase
      .from('telegram_chat_sessions')
      .select('id, agent_id, agent_name')
      .eq('telegram_user_id', telegramUserId)

    if (options.agentId) {
      sessionQuery = sessionQuery.eq('agent_id', options.agentId)
    }

    const { data: sessions, error: sessionError } = await sessionQuery

    if (sessionError || !sessions?.length) {
      return []
    }

    const sessionIds = sessions.map(s => s.id)
    const sessionMap = new Map(sessions.map(s => [s.id, s]))

    // 메시지 조회
    const { data: messages, error: msgError } = await this.supabase
      .from('telegram_chat_messages')
      .select('*')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false })
      .limit(options.limit)

    if (msgError || !messages) {
      console.warn('[UnifiedMemory] Telegram messages error:', msgError?.message)
      return []
    }

    return messages.map(msg => {
      const session = sessionMap.get(msg.session_id)
      return {
        id: msg.id,
        source: (msg.source || 'telegram') as MessageSource,
        role: this.normalizeRole(msg.role),
        content: msg.content,
        agentId: session?.agent_id || '',
        agentName: session?.agent_name,
        createdAt: new Date(msg.created_at),
        metadata: {
          sessionId: msg.session_id,
          toolCalls: msg.tool_calls,
          toolResults: msg.tool_results
        }
      }
    })
  }

  /**
   * GlowUS Web 메시지 조회 (agent_messages)
   */
  private async getWebMessages(options: {
    userId?: string
    telegramUserId?: string
    agentId?: string
    limit: number
  }): Promise<UnifiedMessage[]> {
    let userId = options.userId

    // telegramUserId로 userId 조회 (연결된 경우)
    if (!userId && options.telegramUserId) {
      const { data: telegramUser } = await this.supabase
        .from('telegram_users')
        .select('user_id')
        .eq('id', options.telegramUserId)
        .single()

      if (telegramUser?.user_id) {
        userId = telegramUser.user_id
      }
    }

    if (!userId) {
      return []
    }

    // 대화 조회
    let convQuery = this.supabase
      .from('agent_conversations')
      .select('id, agent_ids, title')
      .eq('user_id', userId)

    if (options.agentId) {
      convQuery = convQuery.contains('agent_ids', [options.agentId])
    }

    const { data: conversations, error: convError } = await convQuery

    if (convError || !conversations?.length) {
      return []
    }

    const convIds = conversations.map(c => c.id)

    // 메시지 조회
    const { data: messages, error: msgError } = await this.supabase
      .from('agent_messages')
      .select(`
        id,
        content,
        sender_type,
        sender_agent_id,
        receiver_agent_id,
        created_at,
        metadata,
        sender_agent:deployed_agents!sender_agent_id(id, name)
      `)
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
      .limit(options.limit)

    if (msgError || !messages) {
      console.warn('[UnifiedMemory] Web messages error:', msgError?.message)
      return []
    }

    return messages.map(msg => ({
      id: msg.id,
      source: 'web' as MessageSource,
      role: msg.sender_type === 'USER' ? 'user' as const : 'assistant' as const,
      content: msg.content,
      agentId: msg.sender_agent_id || msg.receiver_agent_id || '',
      agentName: (msg.sender_agent as any)?.name,
      createdAt: new Date(msg.created_at),
      metadata: msg.metadata as Record<string, any>
    }))
  }

  /**
   * 메시지 저장 (통합 형식)
   */
  async saveMessage(options: {
    source: MessageSource
    role: MessageRole
    content: string
    agentId: string
    agentName?: string
    /** Telegram specific */
    telegramUserId?: string
    chatId?: number
    sessionId?: string
    /** GlowUS specific */
    userId?: string
    conversationId?: string
    /** Metadata */
    toolCalls?: any
    toolResults?: any
  }): Promise<string | null> {
    const { source } = options

    // 소스에 따라 적절한 테이블에 저장
    if (source === 'telegram' || source === 'whatsapp' || source === 'messenger') {
      return this.saveTelegramMessage(options)
    } else {
      return this.saveWebMessage(options)
    }
  }

  /**
   * Telegram 메시지 저장
   */
  private async saveTelegramMessage(options: {
    source: MessageSource
    role: MessageRole
    content: string
    telegramUserId?: string
    chatId?: number
    sessionId?: string
    toolCalls?: any
    toolResults?: any
  }): Promise<string | null> {
    if (!options.sessionId || !options.telegramUserId) {
      console.warn('[UnifiedMemory] Missing sessionId or telegramUserId')
      return null
    }

    // 메시지 인덱스 계산
    const { count } = await this.supabase
      .from('telegram_chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', options.sessionId)

    const { data, error } = await this.supabase
      .from('telegram_chat_messages')
      .insert({
        session_id: options.sessionId,
        telegram_user_id: options.telegramUserId,
        chat_id: options.chatId,
        role: options.role,
        content: options.content,
        source: options.source,
        tool_calls: options.toolCalls,
        tool_results: options.toolResults,
        message_index: (count || 0) + 1
      })
      .select('id')
      .single()

    if (error) {
      console.warn('[UnifiedMemory] Save telegram message error:', error.message)
      return null
    }

    return data?.id || null
  }

  /**
   * GlowUS Web 메시지 저장
   */
  private async saveWebMessage(options: {
    source: MessageSource
    role: MessageRole
    content: string
    agentId: string
    userId?: string
    conversationId?: string
  }): Promise<string | null> {
    if (!options.conversationId || !options.userId) {
      console.warn('[UnifiedMemory] Missing conversationId or userId')
      return null
    }

    const { data, error } = await this.supabase
      .from('agent_messages')
      .insert({
        conversation_id: options.conversationId,
        sender_type: options.role === 'user' ? 'USER' : 'AGENT',
        sender_user_id: options.role === 'user' ? options.userId : null,
        sender_agent_id: options.role !== 'user' ? options.agentId : null,
        receiver_type: options.role === 'user' ? 'AGENT' : 'USER',
        receiver_user_id: options.role !== 'user' ? options.userId : null,
        receiver_agent_id: options.role === 'user' ? options.agentId : null,
        message_type: options.role === 'user' ? 'USER_TO_AGENT' : 'AGENT_TO_USER',
        content: options.content,
        metadata: { source: options.source }
      })
      .select('id')
      .single()

    if (error) {
      console.warn('[UnifiedMemory] Save web message error:', error.message)
      return null
    }

    return data?.id || null
  }

  /**
   * Telegram 사용자와 GlowUS 사용자 연결
   */
  async linkTelegramUser(telegramUserId: string, glowusUserId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('telegram_users')
      .update({ user_id: glowusUserId })
      .eq('id', telegramUserId)

    if (error) {
      console.warn('[UnifiedMemory] Link user error:', error.message)
      return false
    }

    console.log(`[UnifiedMemory] ✅ Linked Telegram ${telegramUserId} → GlowUS ${glowusUserId}`)
    return true
  }

  /**
   * 연결된 GlowUS 사용자 ID 조회
   */
  async getLinkedGlowusUser(telegramUserId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('telegram_users')
      .select('user_id')
      .eq('id', telegramUserId)
      .single()

    if (error || !data?.user_id) {
      return null
    }

    return data.user_id
  }

  /**
   * 연결된 Telegram 사용자 ID 조회
   */
  async getLinkedTelegramUser(glowusUserId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('telegram_users')
      .select('id')
      .eq('user_id', glowusUserId)
      .single()

    if (error || !data?.id) {
      return null
    }

    return data.id
  }

  /**
   * Role 정규화
   */
  private normalizeRole(role: string): MessageRole {
    const roleMap: Record<string, MessageRole> = {
      'user': 'user',
      'human': 'user',
      'assistant': 'assistant',
      'model': 'assistant',
      'ai': 'assistant',
      'system': 'system'
    }
    return roleMap[role.toLowerCase()] || 'user'
  }

  /**
   * 중복 메시지 제거 (같은 내용, 비슷한 시간)
   */
  private deduplicateMessages(messages: UnifiedMessage[]): UnifiedMessage[] {
    const seen = new Map<string, UnifiedMessage>()

    for (const msg of messages) {
      // 내용 + 역할 + 시간(분 단위)로 키 생성
      const timeKey = Math.floor(msg.createdAt.getTime() / 60000)
      const key = `${msg.role}:${msg.content.substring(0, 100)}:${timeKey}`

      if (!seen.has(key)) {
        seen.set(key, msg)
      }
    }

    return Array.from(seen.values())
  }

  /**
   * LangChain 형식으로 변환 (HumanMessage/AIMessage 호환)
   */
  toLangChainFormat(messages: UnifiedMessage[]): Array<{ role: string; content: string }> {
    return messages.map(msg => ({
      role: msg.role === 'user' ? 'human' : msg.role === 'assistant' ? 'ai' : 'system',
      content: msg.content
    }))
  }

  /**
   * Gemini 형식으로 변환
   */
  toGeminiFormat(messages: UnifiedMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }))
  }
}

/**
 * 싱글톤 인스턴스 생성 헬퍼
 */
export function createUnifiedMemory(supabase: SupabaseClient): UnifiedAgentMemory {
  return new UnifiedAgentMemory(supabase)
}
