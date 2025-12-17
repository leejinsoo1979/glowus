/**
 * ImmutableMemoryService
 *
 * 불변 메모리 저장소 서비스
 * - 데이터는 한번 저장되면 절대 수정/삭제되지 않음
 * - LLM 모델이 변경되어도 원본 데이터는 영구 보존
 * - 읽기와 추가만 가능 (Append-Only)
 */

import { SupabaseClient } from '@supabase/supabase-js'
import {
  ImmutableMemoryRecord,
  CreateMemoryInput,
  TemporalQuery,
  HybridSearchQuery,
  MemorySearchResult,
  MemorySearchResponse,
  TimelineGroup,
  TimelineResponse,
  MemoryEventType,
  MemoryRole,
} from '@/types/memory'

export class ImmutableMemoryService {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  // ============================================
  // Write Operations (Append-Only)
  // ============================================

  /**
   * 새 메모리 추가 (불변 - 수정/삭제 불가)
   */
  async append(input: CreateMemoryInput): Promise<ImmutableMemoryRecord> {
    const { data, error } = await this.supabase
      .from('immutable_memory')
      .insert({
        user_id: this.userId,
        raw_content: input.raw_content,
        event_type: input.event_type,
        role: input.role,
        source_agent: input.source_agent,
        source_model: input.source_model,
        session_id: input.session_id,
        parent_id: input.parent_id,
        context: input.context || {},
        timestamp: input.timestamp || new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      throw new Error(`메모리 저장 실패: ${error.message}`)
    }

    return data as ImmutableMemoryRecord
  }

  /**
   * 여러 메모리 일괄 추가
   */
  async appendBatch(inputs: CreateMemoryInput[]): Promise<ImmutableMemoryRecord[]> {
    const records = inputs.map((input) => ({
      user_id: this.userId,
      raw_content: input.raw_content,
      event_type: input.event_type,
      role: input.role,
      source_agent: input.source_agent,
      source_model: input.source_model,
      session_id: input.session_id,
      parent_id: input.parent_id,
      context: input.context || {},
      timestamp: input.timestamp || new Date().toISOString(),
    }))

    const { data, error } = await this.supabase
      .from('immutable_memory')
      .insert(records)
      .select()

    if (error) {
      throw new Error(`일괄 메모리 저장 실패: ${error.message}`)
    }

    return data as ImmutableMemoryRecord[]
  }

  /**
   * 대화 체인 추가 (parent_id로 연결)
   */
  async appendConversation(
    messages: Array<{ content: string; role: MemoryRole }>,
    sessionId: string,
    sourceAgent?: string,
    sourceModel?: string
  ): Promise<ImmutableMemoryRecord[]> {
    const results: ImmutableMemoryRecord[] = []
    let parentId: string | undefined

    for (const msg of messages) {
      const memory = await this.append({
        raw_content: msg.content,
        event_type: 'conversation',
        role: msg.role,
        session_id: sessionId,
        parent_id: parentId,
        source_agent: sourceAgent,
        source_model: sourceModel,
      })
      results.push(memory)
      parentId = memory.id
    }

    return results
  }

  // ============================================
  // Read Operations
  // ============================================

  /**
   * ID로 메모리 조회
   */
  async getById(id: string): Promise<ImmutableMemoryRecord | null> {
    const { data, error } = await this.supabase
      .from('immutable_memory')
      .select('*')
      .eq('id', id)
      .eq('user_id', this.userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`메모리 조회 실패: ${error.message}`)
    }

    return data as ImmutableMemoryRecord
  }

  /**
   * 여러 ID로 메모리 조회
   */
  async getByIds(ids: string[]): Promise<ImmutableMemoryRecord[]> {
    const { data, error } = await this.supabase
      .from('immutable_memory')
      .select('*')
      .in('id', ids)
      .eq('user_id', this.userId)

    if (error) {
      throw new Error(`메모리 조회 실패: ${error.message}`)
    }

    return data as ImmutableMemoryRecord[]
  }

  /**
   * 세션 ID로 대화 체인 조회
   */
  async getBySessionId(sessionId: string): Promise<ImmutableMemoryRecord[]> {
    const { data, error } = await this.supabase
      .from('immutable_memory')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', this.userId)
      .order('timestamp', { ascending: true })

    if (error) {
      throw new Error(`세션 메모리 조회 실패: ${error.message}`)
    }

    return data as ImmutableMemoryRecord[]
  }

  /**
   * 대화 체인 조회 (parent_id 따라가기)
   */
  async getConversationChain(memoryId: string): Promise<ImmutableMemoryRecord[]> {
    const chain: ImmutableMemoryRecord[] = []
    let currentId: string | null = memoryId

    // 현재 메모리부터 시작해서 루트까지 올라가기
    while (currentId) {
      const memory = await this.getById(currentId)
      if (!memory) break
      chain.unshift(memory)
      currentId = memory.parent_id || null
    }

    return chain
  }

  // ============================================
  // Temporal Query Operations
  // ============================================

  /**
   * 자연어 시간 표현 파싱
   */
  private parseNaturalTime(natural: string): { start: Date; end: Date } {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const patterns: Record<string, () => { start: Date; end: Date }> = {
      '오늘': () => ({
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      }),
      '어제': () => ({
        start: new Date(today.getTime() - 24 * 60 * 60 * 1000),
        end: today,
      }),
      '이번주': () => {
        const dayOfWeek = now.getDay()
        const start = new Date(today.getTime() - dayOfWeek * 24 * 60 * 60 * 1000)
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
        return { start, end }
      },
      '지난주': () => {
        const dayOfWeek = now.getDay()
        const thisWeekStart = new Date(today.getTime() - dayOfWeek * 24 * 60 * 60 * 1000)
        const start = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000)
        const end = thisWeekStart
        return { start, end }
      },
      '이번달': () => ({
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      }),
      '지난달': () => ({
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 1),
      }),
      '올해': () => ({
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear() + 1, 0, 1),
      }),
      '작년': () => ({
        start: new Date(now.getFullYear() - 1, 0, 1),
        end: new Date(now.getFullYear(), 0, 1),
      }),
    }

    // N일 전 패턴
    const daysAgoMatch = natural.match(/(\d+)일\s*전/)
    if (daysAgoMatch) {
      const days = parseInt(daysAgoMatch[1], 10)
      const start = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
      return { start, end }
    }

    // 최근 N일 패턴
    const recentDaysMatch = natural.match(/최근\s*(\d+)일/)
    if (recentDaysMatch) {
      const days = parseInt(recentDaysMatch[1], 10)
      const start = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)
      return { start, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    }

    const handler = patterns[natural]
    if (handler) {
      return handler()
    }

    // 기본값: 최근 7일
    return {
      start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    }
  }

  /**
   * 시간 기반 쿼리
   */
  async queryByTime(temporal: TemporalQuery): Promise<ImmutableMemoryRecord[]> {
    let query = this.supabase
      .from('immutable_memory')
      .select('*')
      .eq('user_id', this.userId)

    // 자연어 시간 표현 처리
    if (temporal.natural) {
      const { start, end } = this.parseNaturalTime(temporal.natural)
      query = query
        .gte('timestamp', start.toISOString())
        .lt('timestamp', end.toISOString())
    } else {
      // 명시적 날짜 범위
      if (temporal.start_date) {
        query = query.gte('date', temporal.start_date)
      }
      if (temporal.end_date) {
        query = query.lte('date', temporal.end_date)
      }
    }

    // 특정 시간대 필터
    if (temporal.hour !== undefined) {
      query = query.eq('hour', temporal.hour)
    }
    if (temporal.day_of_week !== undefined) {
      query = query.eq('day_of_week', temporal.day_of_week)
    }
    if (temporal.week_of_year !== undefined) {
      query = query.eq('week_of_year', temporal.week_of_year)
    }
    if (temporal.month !== undefined) {
      query = query.eq('month', temporal.month)
    }
    if (temporal.year !== undefined) {
      query = query.eq('year', temporal.year)
    }

    const { data, error } = await query.order('timestamp', { ascending: false })

    if (error) {
      throw new Error(`시간 기반 쿼리 실패: ${error.message}`)
    }

    return data as ImmutableMemoryRecord[]
  }

  /**
   * 특정 날짜의 메모리 조회
   */
  async getByDate(date: string): Promise<ImmutableMemoryRecord[]> {
    return this.queryByTime({ start_date: date, end_date: date })
  }

  /**
   * 특정 날짜 범위의 메모리 조회
   */
  async getByDateRange(startDate: string, endDate: string): Promise<ImmutableMemoryRecord[]> {
    return this.queryByTime({ start_date: startDate, end_date: endDate })
  }

  // ============================================
  // Filter Operations
  // ============================================

  /**
   * 이벤트 타입으로 필터링
   */
  async filterByEventType(
    eventTypes: MemoryEventType[],
    options?: { limit?: number; offset?: number }
  ): Promise<ImmutableMemoryRecord[]> {
    let query = this.supabase
      .from('immutable_memory')
      .select('*')
      .eq('user_id', this.userId)
      .in('event_type', eventTypes)
      .order('timestamp', { ascending: false })

    if (options?.limit) {
      query = query.limit(options.limit)
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`이벤트 타입 필터링 실패: ${error.message}`)
    }

    return data as ImmutableMemoryRecord[]
  }

  /**
   * 에이전트로 필터링
   */
  async filterByAgent(
    agentName: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ImmutableMemoryRecord[]> {
    let query = this.supabase
      .from('immutable_memory')
      .select('*')
      .eq('user_id', this.userId)
      .eq('source_agent', agentName)
      .order('timestamp', { ascending: false })

    if (options?.limit) {
      query = query.limit(options.limit)
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`에이전트 필터링 실패: ${error.message}`)
    }

    return data as ImmutableMemoryRecord[]
  }

  // ============================================
  // Timeline Operations
  // ============================================

  /**
   * 일별 타임라인 조회
   */
  async getDailyTimeline(
    startDate: string,
    endDate: string
  ): Promise<TimelineResponse> {
    const { data, error } = await this.supabase
      .from('immutable_memory')
      .select('*')
      .eq('user_id', this.userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('timestamp', { ascending: false })

    if (error) {
      throw new Error(`타임라인 조회 실패: ${error.message}`)
    }

    const memories = data as ImmutableMemoryRecord[]

    // 날짜별로 그룹화
    const groupedByDate = memories.reduce<Record<string, ImmutableMemoryRecord[]>>(
      (acc, memory) => {
        const date = memory.date
        if (!acc[date]) acc[date] = []
        acc[date].push(memory)
        return acc
      },
      {}
    )

    // TimelineGroup 배열로 변환
    const groups: TimelineGroup[] = Object.entries(groupedByDate)
      .map(([date, dateMemories]) => ({
        period: date,
        period_type: 'day' as const,
        memories: dateMemories,
        statistics: {
          count: dateMemories.length,
          by_event_type: this.countBy(dateMemories, 'event_type'),
          by_role: this.countBy(dateMemories, 'role'),
        },
      }))
      .sort((a, b) => b.period.localeCompare(a.period))

    return {
      groups,
      total_memories: memories.length,
      date_range: { start: startDate, end: endDate },
    }
  }

  /**
   * 필드별 카운트 헬퍼
   */
  private countBy<T extends Record<string, unknown>>(
    items: T[],
    field: keyof T
  ): Record<string, number> {
    return items.reduce<Record<string, number>>((acc, item) => {
      const key = String(item[field])
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
  }

  // ============================================
  // Statistics Operations
  // ============================================

  /**
   * 전체 통계 조회
   */
  async getStatistics(): Promise<{
    total_memories: number
    by_event_type: Record<string, number>
    by_role: Record<string, number>
    by_agent: Record<string, number>
    date_range: { earliest: string; latest: string } | null
  }> {
    const { data, error } = await this.supabase
      .from('immutable_memory')
      .select('event_type, role, source_agent, timestamp')
      .eq('user_id', this.userId)

    if (error) {
      throw new Error(`통계 조회 실패: ${error.message}`)
    }

    const memories = data as Array<{
      event_type: string
      role: string
      source_agent: string | null
      timestamp: string
    }>

    if (memories.length === 0) {
      return {
        total_memories: 0,
        by_event_type: {},
        by_role: {},
        by_agent: {},
        date_range: null,
      }
    }

    const timestamps = memories.map((m) => new Date(m.timestamp).getTime())

    return {
      total_memories: memories.length,
      by_event_type: this.countBy(memories, 'event_type'),
      by_role: this.countBy(memories, 'role'),
      by_agent: this.countBy(
        memories.filter((m) => m.source_agent),
        'source_agent'
      ),
      date_range: {
        earliest: new Date(Math.min(...timestamps)).toISOString(),
        latest: new Date(Math.max(...timestamps)).toISOString(),
      },
    }
  }

  /**
   * 기간별 통계 조회
   */
  async getStatisticsByPeriod(
    startDate: string,
    endDate: string
  ): Promise<{
    total: number
    by_date: Record<string, number>
    by_event_type: Record<string, number>
  }> {
    const { data, error } = await this.supabase
      .from('immutable_memory')
      .select('date, event_type')
      .eq('user_id', this.userId)
      .gte('date', startDate)
      .lte('date', endDate)

    if (error) {
      throw new Error(`기간별 통계 조회 실패: ${error.message}`)
    }

    const memories = data as Array<{ date: string; event_type: string }>

    return {
      total: memories.length,
      by_date: this.countBy(memories, 'date'),
      by_event_type: this.countBy(memories, 'event_type'),
    }
  }

  // ============================================
  // Search Operations (Basic - without embeddings)
  // ============================================

  /**
   * 텍스트 검색 (전문 검색)
   */
  async searchByText(
    searchText: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ImmutableMemoryRecord[]> {
    const { data, error } = await this.supabase
      .from('immutable_memory')
      .select('*')
      .eq('user_id', this.userId)
      .ilike('raw_content', `%${searchText}%`)
      .order('timestamp', { ascending: false })
      .limit(options?.limit || 20)

    if (error) {
      throw new Error(`텍스트 검색 실패: ${error.message}`)
    }

    return data as ImmutableMemoryRecord[]
  }

  /**
   * 최근 메모리 조회
   */
  async getRecent(limit: number = 20): Promise<ImmutableMemoryRecord[]> {
    const { data, error } = await this.supabase
      .from('immutable_memory')
      .select('*')
      .eq('user_id', this.userId)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`최근 메모리 조회 실패: ${error.message}`)
    }

    return data as ImmutableMemoryRecord[]
  }
}

/**
 * 클라이언트용 팩토리 함수
 */
export function createImmutableMemoryService(
  supabase: SupabaseClient,
  userId: string
): ImmutableMemoryService {
  return new ImmutableMemoryService(supabase, userId)
}
