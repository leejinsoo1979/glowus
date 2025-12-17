/**
 * MemoryEmbeddingService
 *
 * 메모리 임베딩 관리 서비스
 * - 임베딩은 모델별로 분리 저장
 * - LLM 모델 변경 시 재생성 가능
 * - 원본 메모리 데이터와 독립적
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>
import { OpenAIEmbeddings } from '@langchain/openai'
import {
  MemoryEmbedding,
  UpsertEmbeddingInput,
  ImmutableMemoryRecord,
  HybridSearchQuery,
  MemorySearchResult,
  MemorySearchResponse,
  DEFAULT_MEMORY_CONFIG,
} from '@/types/memory'

export interface EmbeddingModelConfig {
  model: string
  version?: string
  dimensions: number
}

export class MemoryEmbeddingService {
  private supabase: AnySupabaseClient
  private userId: string
  private embeddings: OpenAIEmbeddings
  private modelConfig: EmbeddingModelConfig

  constructor(
    supabase: AnySupabaseClient,
    userId: string,
    modelConfig?: Partial<EmbeddingModelConfig>
  ) {
    this.supabase = supabase
    this.userId = userId

    this.modelConfig = {
      model: modelConfig?.model || DEFAULT_MEMORY_CONFIG.embedding.model,
      version: modelConfig?.version || DEFAULT_MEMORY_CONFIG.embedding.version,
      dimensions: modelConfig?.dimensions || DEFAULT_MEMORY_CONFIG.embedding.dimensions,
    }

    this.embeddings = new OpenAIEmbeddings({
      modelName: this.modelConfig.model,
    })
  }

  // ============================================
  // Embedding Generation
  // ============================================

  /**
   * 텍스트를 임베딩 벡터로 변환
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const embedding = await this.embeddings.embedQuery(text)
    return embedding
  }

  /**
   * 여러 텍스트를 일괄 임베딩
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings = await this.embeddings.embedDocuments(texts)
    return embeddings
  }

  // ============================================
  // Embedding Storage
  // ============================================

  /**
   * 메모리에 대한 임베딩 생성 및 저장
   */
  async createEmbeddingForMemory(memory: ImmutableMemoryRecord): Promise<MemoryEmbedding> {
    const embedding = await this.generateEmbedding(memory.raw_content)

    const { data, error } = await this.supabase
      .from('memory_embeddings')
      .upsert(
        {
          memory_id: memory.id,
          model_name: this.modelConfig.model,
          model_version: this.modelConfig.version,
          embedding: embedding,
        },
        {
          onConflict: 'memory_id,model_name',
        }
      )
      .select()
      .single()

    if (error) {
      throw new Error(`임베딩 저장 실패: ${error.message}`)
    }

    return data as MemoryEmbedding
  }

  /**
   * 여러 메모리에 대한 임베딩 일괄 생성
   */
  async createEmbeddingsForMemories(
    memories: ImmutableMemoryRecord[]
  ): Promise<MemoryEmbedding[]> {
    const texts = memories.map((m) => m.raw_content)
    const embeddings = await this.generateEmbeddings(texts)

    const records = memories.map((memory, index) => ({
      memory_id: memory.id,
      model_name: this.modelConfig.model,
      model_version: this.modelConfig.version,
      embedding: embeddings[index],
    }))

    const { data, error } = await this.supabase
      .from('memory_embeddings')
      .upsert(records, {
        onConflict: 'memory_id,model_name',
      })
      .select()

    if (error) {
      throw new Error(`일괄 임베딩 저장 실패: ${error.message}`)
    }

    return data as MemoryEmbedding[]
  }

  /**
   * 메모리 ID로 임베딩 조회
   */
  async getEmbeddingByMemoryId(memoryId: string): Promise<MemoryEmbedding | null> {
    const { data, error } = await this.supabase
      .from('memory_embeddings')
      .select('*')
      .eq('memory_id', memoryId)
      .eq('model_name', this.modelConfig.model)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`임베딩 조회 실패: ${error.message}`)
    }

    return data as MemoryEmbedding
  }

  /**
   * 특정 모델의 모든 임베딩 삭제 (모델 변경 시)
   */
  async deleteEmbeddingsByModel(modelName: string): Promise<number> {
    // 먼저 해당 유저의 메모리 ID 목록 가져오기
    const { data: memories, error: memError } = await this.supabase
      .from('immutable_memory')
      .select('id')
      .eq('user_id', this.userId)

    if (memError) {
      throw new Error(`메모리 조회 실패: ${memError.message}`)
    }

    const memoryIds = memories.map((m: { id: string }) => m.id)

    const { error, count } = await this.supabase
      .from('memory_embeddings')
      .delete()
      .eq('model_name', modelName)
      .in('memory_id', memoryIds)

    if (error) {
      throw new Error(`임베딩 삭제 실패: ${error.message}`)
    }

    return count || 0
  }

  // ============================================
  // Semantic Search
  // ============================================

  /**
   * 시맨틱 검색 (벡터 유사도 기반)
   */
  async semanticSearch(
    queryText: string,
    options?: {
      limit?: number
      similarity_threshold?: number
    }
  ): Promise<Array<{ memory_id: string; similarity: number }>> {
    const queryEmbedding = await this.generateEmbedding(queryText)

    const { data, error } = await this.supabase.rpc('search_memories_by_embedding', {
      p_user_id: this.userId,
      p_query_embedding: queryEmbedding,
      p_model_name: this.modelConfig.model,
      p_match_threshold: options?.similarity_threshold || 0.7,
      p_match_count: options?.limit || 20,
    })

    if (error) {
      throw new Error(`시맨틱 검색 실패: ${error.message}`)
    }

    return data as Array<{ memory_id: string; similarity: number }>
  }

  /**
   * 하이브리드 검색 (시맨틱 + 시간 + 중요도)
   */
  async hybridSearch(query: HybridSearchQuery): Promise<MemorySearchResponse> {
    const startTime = Date.now()
    const limit = query.limit || DEFAULT_MEMORY_CONFIG.search.default_limit
    const offset = query.offset || 0

    const weights = {
      semantic: query.weights?.semantic ?? DEFAULT_MEMORY_CONFIG.search.default_weights.semantic,
      temporal: query.weights?.temporal ?? DEFAULT_MEMORY_CONFIG.search.default_weights.temporal,
      importance:
        query.weights?.importance ?? DEFAULT_MEMORY_CONFIG.search.default_weights.importance,
    }

    // 1. 시맨틱 검색 (쿼리 텍스트가 있는 경우)
    let semanticResults: Map<string, number> = new Map()
    if (query.query_text) {
      const results = await this.semanticSearch(query.query_text, {
        limit: limit * 3, // 더 많이 가져와서 필터링
        similarity_threshold: 0.5,
      })
      results.forEach((r) => semanticResults.set(r.memory_id, r.similarity))
    }

    // 2. 기본 필터 쿼리 구성
    let dbQuery = this.supabase
      .from('immutable_memory')
      .select(
        `
        *,
        memory_embeddings!inner(similarity:1),
        memory_analysis(importance_score)
      `
      )
      .eq('user_id', this.userId)

    // 시간 필터
    if (query.temporal) {
      if (query.temporal.start_date) {
        dbQuery = dbQuery.gte('date', query.temporal.start_date)
      }
      if (query.temporal.end_date) {
        dbQuery = dbQuery.lte('date', query.temporal.end_date)
      }
      if (query.temporal.hour !== undefined) {
        dbQuery = dbQuery.eq('hour', query.temporal.hour)
      }
      if (query.temporal.day_of_week !== undefined) {
        dbQuery = dbQuery.eq('day_of_week', query.temporal.day_of_week)
      }
    }

    // 이벤트 타입 필터
    if (query.event_types && query.event_types.length > 0) {
      dbQuery = dbQuery.in('event_type', query.event_types)
    }

    // 역할 필터
    if (query.roles && query.roles.length > 0) {
      dbQuery = dbQuery.in('role', query.roles)
    }

    // 에이전트 필터
    if (query.source_agents && query.source_agents.length > 0) {
      dbQuery = dbQuery.in('source_agent', query.source_agents)
    }

    const { data: memories, error, count } = await dbQuery

    if (error) {
      throw new Error(`하이브리드 검색 실패: ${error.message}`)
    }

    // 3. 점수 계산 및 정렬
    const now = Date.now()
    const DAY_MS = 24 * 60 * 60 * 1000

    const scoredResults: MemorySearchResult[] = (memories || []).map((memory: any) => {
      // 시맨틱 점수
      const semanticScore = semanticResults.get(memory.id) || 0

      // 시간 근접성 점수 (최근일수록 높음, 30일 기준)
      const memoryTime = new Date(memory.timestamp).getTime()
      const daysDiff = (now - memoryTime) / DAY_MS
      const temporalScore = Math.max(0, 1 - daysDiff / 30)

      // 중요도 점수
      const importanceScore = memory.memory_analysis?.[0]?.importance_score || 0.5

      // 가중 합산 점수
      const combinedScore =
        semanticScore * weights.semantic +
        temporalScore * weights.temporal +
        importanceScore * weights.importance

      return {
        memory: {
          id: memory.id,
          user_id: memory.user_id,
          timestamp: memory.timestamp,
          date: memory.date,
          hour: memory.hour,
          day_of_week: memory.day_of_week,
          week_of_year: memory.week_of_year,
          month: memory.month,
          year: memory.year,
          raw_content: memory.raw_content,
          event_type: memory.event_type,
          role: memory.role,
          source_agent: memory.source_agent,
          source_model: memory.source_model,
          session_id: memory.session_id,
          parent_id: memory.parent_id,
          context: memory.context,
          created_at: memory.created_at,
        },
        scores: {
          semantic_similarity: semanticScore,
          temporal_recency: temporalScore,
          importance: importanceScore,
          combined: combinedScore,
        },
      }
    })

    // 정렬
    scoredResults.sort((a, b) => {
      if (query.sort_by === 'timestamp') {
        const aTime = new Date(a.memory.timestamp).getTime()
        const bTime = new Date(b.memory.timestamp).getTime()
        return query.sort_order === 'asc' ? aTime - bTime : bTime - aTime
      }
      if (query.sort_by === 'importance') {
        return query.sort_order === 'asc'
          ? (a.scores.importance || 0) - (b.scores.importance || 0)
          : (b.scores.importance || 0) - (a.scores.importance || 0)
      }
      // 기본: relevance (combined score)
      return b.scores.combined - a.scores.combined
    })

    // 페이지네이션
    const paginatedResults = scoredResults.slice(offset, offset + limit)

    return {
      results: paginatedResults,
      total_count: scoredResults.length,
      query_time_ms: Date.now() - startTime,
      limit,
      offset,
      has_more: offset + limit < scoredResults.length,
    }
  }

  /**
   * 유사한 메모리 찾기
   */
  async findSimilarMemories(
    memoryId: string,
    options?: { limit?: number; similarity_threshold?: number }
  ): Promise<Array<{ memory_id: string; similarity: number }>> {
    // 해당 메모리의 임베딩 가져오기
    const embedding = await this.getEmbeddingByMemoryId(memoryId)
    if (!embedding) {
      throw new Error('해당 메모리의 임베딩이 없습니다.')
    }

    const { data, error } = await this.supabase.rpc('search_memories_by_embedding', {
      p_user_id: this.userId,
      p_query_embedding: embedding.embedding,
      p_model_name: this.modelConfig.model,
      p_match_threshold: options?.similarity_threshold || 0.7,
      p_match_count: (options?.limit || 10) + 1, // 자기 자신 제외 위해 +1
    })

    if (error) {
      throw new Error(`유사 메모리 검색 실패: ${error.message}`)
    }

    // 자기 자신 제외
    return (data as Array<{ memory_id: string; similarity: number }>).filter(
      (r) => r.memory_id !== memoryId
    )
  }

  // ============================================
  // Model Migration
  // ============================================

  /**
   * 새 모델로 모든 임베딩 재생성
   */
  async migrateToNewModel(
    newModelConfig: EmbeddingModelConfig,
    options?: { batch_size?: number; on_progress?: (progress: number) => void }
  ): Promise<{ migrated: number; errors: number }> {
    const batchSize = options?.batch_size || 100
    let migrated = 0
    let errors = 0

    // 새 임베딩 서비스 생성
    const newService = new MemoryEmbeddingService(this.supabase, this.userId, newModelConfig)

    // 해당 유저의 모든 메모리 가져오기
    const { data: allMemories, error } = await this.supabase
      .from('immutable_memory')
      .select('*')
      .eq('user_id', this.userId)
      .order('timestamp', { ascending: true })

    if (error) {
      throw new Error(`메모리 조회 실패: ${error.message}`)
    }

    const totalMemories = allMemories?.length || 0

    // 배치 처리
    for (let i = 0; i < totalMemories; i += batchSize) {
      const batch = allMemories!.slice(i, i + batchSize) as ImmutableMemoryRecord[]

      try {
        await newService.createEmbeddingsForMemories(batch)
        migrated += batch.length
      } catch (err) {
        errors += batch.length
        console.error(`배치 처리 실패 (${i}-${i + batchSize}):`, err)
      }

      // 진행률 콜백
      if (options?.on_progress) {
        options.on_progress(Math.round(((i + batch.length) / totalMemories) * 100))
      }
    }

    return { migrated, errors }
  }

  /**
   * 임베딩이 없는 메모리에 대해 임베딩 생성
   */
  async backfillMissingEmbeddings(
    options?: { batch_size?: number; on_progress?: (progress: number) => void }
  ): Promise<{ created: number; errors: number }> {
    const batchSize = options?.batch_size || 100
    let created = 0
    let errors = 0

    // 임베딩이 없는 메모리 찾기
    const { data, error } = await this.supabase.rpc('get_memories_without_embeddings', {
      p_user_id: this.userId,
      p_model_name: this.modelConfig.model,
    })

    if (error) {
      throw new Error(`미싱 메모리 조회 실패: ${error.message}`)
    }

    const memoriesWithoutEmbeddings = data as ImmutableMemoryRecord[]
    const totalCount = memoriesWithoutEmbeddings.length

    // 배치 처리
    for (let i = 0; i < totalCount; i += batchSize) {
      const batch = memoriesWithoutEmbeddings.slice(i, i + batchSize)

      try {
        await this.createEmbeddingsForMemories(batch)
        created += batch.length
      } catch (err) {
        errors += batch.length
        console.error(`배치 처리 실패 (${i}-${i + batchSize}):`, err)
      }

      // 진행률 콜백
      if (options?.on_progress) {
        options.on_progress(Math.round(((i + batch.length) / totalCount) * 100))
      }
    }

    return { created, errors }
  }

  // ============================================
  // Statistics
  // ============================================

  /**
   * 임베딩 통계 조회
   */
  async getStatistics(): Promise<{
    total_embeddings: number
    by_model: Record<string, number>
    coverage_percent: number
  }> {
    // 전체 메모리 수
    const { count: totalMemories } = await this.supabase
      .from('immutable_memory')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', this.userId)

    // 모델별 임베딩 수
    const { data: embeddings, error } = await this.supabase
      .from('memory_embeddings')
      .select(
        `
        model_name,
        memory:memory_id!inner(user_id)
      `
      )
      .eq('memory.user_id', this.userId)

    if (error) {
      throw new Error(`임베딩 통계 조회 실패: ${error.message}`)
    }

    const byModel = (embeddings || []).reduce<Record<string, number>>((acc, e: any) => {
      acc[e.model_name] = (acc[e.model_name] || 0) + 1
      return acc
    }, {})

    const currentModelCount = byModel[this.modelConfig.model] || 0
    const coveragePercent =
      totalMemories && totalMemories > 0
        ? Math.round((currentModelCount / totalMemories) * 100)
        : 0

    return {
      total_embeddings: embeddings?.length || 0,
      by_model: byModel,
      coverage_percent: coveragePercent,
    }
  }
}

/**
 * 클라이언트용 팩토리 함수
 */
export function createMemoryEmbeddingService(
  supabase: AnySupabaseClient,
  userId: string,
  modelConfig?: Partial<EmbeddingModelConfig>
): MemoryEmbeddingService {
  return new MemoryEmbeddingService(supabase, userId, modelConfig)
}
