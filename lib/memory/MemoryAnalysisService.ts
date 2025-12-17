/**
 * MemoryAnalysisService
 *
 * 메모리 분석 서비스
 * - AI 기반 메모리 분석 (요약, 감정, 엔티티 추출 등)
 * - 분석 결과는 모델별로 분리 저장
 * - LLM 모델 변경 시 재생성 가능
 * - 일간/주간/월간 요약 생성
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>
import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'
import { JsonOutputParser } from '@langchain/core/output_parsers'
import {
  MemoryAnalysis,
  UpsertAnalysisInput,
  ImmutableMemoryRecord,
  MemoryEntity,
  MemorySentiment,
  MemoryDailySummary,
  MemoryWeeklySummary,
  MemoryMonthlySummary,
  DayStatistics,
  WeekStatistics,
  MonthStatistics,
  DEFAULT_MEMORY_CONFIG,
} from '@/types/memory'

export interface AnalysisModelConfig {
  model: string
  version?: string
  temperature?: number
}

export class MemoryAnalysisService {
  private supabase: AnySupabaseClient
  private userId: string
  private llm: ChatOpenAI
  private modelConfig: AnalysisModelConfig

  constructor(
    supabase: AnySupabaseClient,
    userId: string,
    modelConfig?: Partial<AnalysisModelConfig>
  ) {
    this.supabase = supabase
    this.userId = userId

    this.modelConfig = {
      model: modelConfig?.model || DEFAULT_MEMORY_CONFIG.analysis.model,
      version: modelConfig?.version,
      temperature: modelConfig?.temperature || 0.3,
    }

    this.llm = new ChatOpenAI({
      modelName: this.modelConfig.model,
      temperature: this.modelConfig.temperature,
    })
  }

  // ============================================
  // Analysis Generation
  // ============================================

  /**
   * 단일 메모리 분석
   */
  async analyzeMemory(memory: ImmutableMemoryRecord): Promise<MemoryAnalysis> {
    const prompt = PromptTemplate.fromTemplate(`
당신은 메모리 분석 전문가입니다. 다음 메모리 내용을 분석해주세요.

메모리 내용:
---
{content}
---

이벤트 타입: {event_type}
역할: {role}
시간: {timestamp}

다음 JSON 형식으로 분석 결과를 반환하세요:
{{
  "summary": "1-2문장의 간결한 요약",
  "key_points": ["핵심 포인트 1", "핵심 포인트 2"],
  "entities": [
    {{"type": "person|organization|location|date|product|concept|other", "value": "엔티티 값", "confidence": 0.0-1.0}}
  ],
  "sentiment": {{
    "label": "positive|negative|neutral|mixed",
    "score": -1.0에서 1.0 사이 값,
    "emotions": {{"joy": 0-1, "sadness": 0-1, "anger": 0-1, "fear": 0-1, "surprise": 0-1}}
  }},
  "importance_score": 0.0-1.0 (중요도),
  "relevance_tags": ["관련 태그들"],
  "action_items": ["필요한 후속 조치들"]
}}
`)

    const parser = new JsonOutputParser<{
      summary: string
      key_points: string[]
      entities: MemoryEntity[]
      sentiment: MemorySentiment
      importance_score: number
      relevance_tags: string[]
      action_items: string[]
    }>()

    const chain = prompt.pipe(this.llm).pipe(parser)

    const result = await chain.invoke({
      content: memory.raw_content,
      event_type: memory.event_type,
      role: memory.role,
      timestamp: memory.timestamp,
    })

    // DB에 저장
    const { data, error } = await this.supabase
      .from('memory_analysis')
      .upsert(
        {
          memory_id: memory.id,
          model_name: this.modelConfig.model,
          model_version: this.modelConfig.version,
          summary: result.summary,
          key_points: result.key_points,
          entities: result.entities,
          sentiment: result.sentiment,
          importance_score: result.importance_score,
          relevance_tags: result.relevance_tags,
          action_items: result.action_items,
        },
        {
          onConflict: 'memory_id,model_name',
        }
      )
      .select()
      .single()

    if (error) {
      throw new Error(`분석 저장 실패: ${error.message}`)
    }

    return data as MemoryAnalysis
  }

  /**
   * 여러 메모리 일괄 분석
   */
  async analyzeMemories(memories: ImmutableMemoryRecord[]): Promise<MemoryAnalysis[]> {
    const results: MemoryAnalysis[] = []

    // 순차 처리 (API 제한 고려)
    for (const memory of memories) {
      try {
        const analysis = await this.analyzeMemory(memory)
        results.push(analysis)
      } catch (error) {
        console.error(`메모리 분석 실패 (${memory.id}):`, error)
      }
    }

    return results
  }

  /**
   * 메모리 ID로 분석 결과 조회
   */
  async getAnalysisByMemoryId(memoryId: string): Promise<MemoryAnalysis | null> {
    const { data, error } = await this.supabase
      .from('memory_analysis')
      .select('*')
      .eq('memory_id', memoryId)
      .eq('model_name', this.modelConfig.model)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`분석 조회 실패: ${error.message}`)
    }

    return data as MemoryAnalysis
  }

  // ============================================
  // Summary Generation
  // ============================================

  /**
   * 일간 요약 생성
   */
  async generateDailySummary(date: string): Promise<MemoryDailySummary> {
    // 해당 날짜의 모든 메모리 가져오기
    const { data: memories, error } = await this.supabase
      .from('immutable_memory')
      .select('*')
      .eq('user_id', this.userId)
      .eq('date', date)
      .order('timestamp', { ascending: true })

    if (error) {
      throw new Error(`메모리 조회 실패: ${error.message}`)
    }

    if (!memories || memories.length === 0) {
      throw new Error(`${date}에 해당하는 메모리가 없습니다.`)
    }

    // 통계 계산
    const statistics: DayStatistics = {
      total_memories: memories.length,
      by_event_type: this.countBy(memories, 'event_type'),
      by_role: this.countBy(memories, 'role'),
    }

    // AI 요약 생성
    const summaryPrompt = PromptTemplate.fromTemplate(`
다음은 {date}에 기록된 메모리들입니다. 하루를 요약해주세요.

메모리 목록:
{memories}

통계:
- 총 메모리: {total}개
- 이벤트 타입별: {by_event_type}

다음 JSON 형식으로 요약을 반환하세요:
{{
  "summary": "하루 전체를 2-3문장으로 요약",
  "key_events": ["주요 이벤트 1", "주요 이벤트 2", "주요 이벤트 3"]
}}
`)

    const parser = new JsonOutputParser<{
      summary: string
      key_events: string[]
    }>()

    const chain = summaryPrompt.pipe(this.llm).pipe(parser)

    const memoriesText = memories
      .map((m: ImmutableMemoryRecord) => `[${m.event_type}] ${m.raw_content.substring(0, 200)}`)
      .join('\n')

    const result = await chain.invoke({
      date,
      memories: memoriesText,
      total: memories.length,
      by_event_type: JSON.stringify(statistics.by_event_type),
    })

    // DB에 저장
    const { data, error: saveError } = await this.supabase
      .from('memory_daily_summary')
      .upsert(
        {
          user_id: this.userId,
          date,
          model_name: this.modelConfig.model,
          model_version: this.modelConfig.version,
          summary: result.summary,
          key_events: result.key_events,
          statistics,
        },
        {
          onConflict: 'user_id,date,model_name',
        }
      )
      .select()
      .single()

    if (saveError) {
      throw new Error(`일간 요약 저장 실패: ${saveError.message}`)
    }

    return data as MemoryDailySummary
  }

  /**
   * 주간 요약 생성
   */
  async generateWeeklySummary(year: number, weekOfYear: number): Promise<MemoryWeeklySummary> {
    // 해당 주의 모든 메모리 가져오기
    const { data: memories, error } = await this.supabase
      .from('immutable_memory')
      .select('*')
      .eq('user_id', this.userId)
      .eq('year', year)
      .eq('week_of_year', weekOfYear)
      .order('timestamp', { ascending: true })

    if (error) {
      throw new Error(`메모리 조회 실패: ${error.message}`)
    }

    if (!memories || memories.length === 0) {
      throw new Error(`${year}년 ${weekOfYear}주차에 해당하는 메모리가 없습니다.`)
    }

    // 통계 계산
    const byDay: Record<string, number> = {}
    memories.forEach((m: ImmutableMemoryRecord) => {
      const day = ['일', '월', '화', '수', '목', '금', '토'][m.day_of_week]
      byDay[day] = (byDay[day] || 0) + 1
    })

    const statistics: WeekStatistics = {
      total_memories: memories.length,
      by_day: byDay,
      by_event_type: this.countBy(memories, 'event_type'),
      avg_daily_memories: Math.round(memories.length / 7),
    }

    // 가장 활발한 요일 찾기
    const mostActiveDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (mostActiveDay) {
      statistics.most_active_day = mostActiveDay
    }

    // AI 요약 생성
    const summaryPrompt = PromptTemplate.fromTemplate(`
다음은 {year}년 {week}주차에 기록된 메모리들입니다. 한 주를 요약해주세요.

일별 메모리 수: {by_day}
이벤트 타입별: {by_event_type}
총 메모리: {total}개

주요 메모리 샘플:
{sample_memories}

다음 JSON 형식으로 요약을 반환하세요:
{{
  "summary": "한 주 전체를 3-4문장으로 요약",
  "highlights": ["주간 하이라이트 1", "주간 하이라이트 2", "주간 하이라이트 3"],
  "trends": ["발견된 트렌드/패턴 1", "발견된 트렌드/패턴 2"]
}}
`)

    const parser = new JsonOutputParser<{
      summary: string
      highlights: string[]
      trends: string[]
    }>()

    const chain = summaryPrompt.pipe(this.llm).pipe(parser)

    // 샘플 메모리 (최대 20개)
    const sampleMemories = memories
      .slice(0, 20)
      .map((m: ImmutableMemoryRecord) => `[${m.date}] [${m.event_type}] ${m.raw_content.substring(0, 150)}`)
      .join('\n')

    const result = await chain.invoke({
      year,
      week: weekOfYear,
      by_day: JSON.stringify(byDay),
      by_event_type: JSON.stringify(statistics.by_event_type),
      total: memories.length,
      sample_memories: sampleMemories,
    })

    // DB에 저장
    const { data, error: saveError } = await this.supabase
      .from('memory_weekly_summary')
      .upsert(
        {
          user_id: this.userId,
          year,
          week_of_year: weekOfYear,
          model_name: this.modelConfig.model,
          model_version: this.modelConfig.version,
          summary: result.summary,
          highlights: result.highlights,
          trends: result.trends,
          statistics,
        },
        {
          onConflict: 'user_id,year,week_of_year,model_name',
        }
      )
      .select()
      .single()

    if (saveError) {
      throw new Error(`주간 요약 저장 실패: ${saveError.message}`)
    }

    return data as MemoryWeeklySummary
  }

  /**
   * 월간 요약 생성
   */
  async generateMonthlySummary(year: number, month: number): Promise<MemoryMonthlySummary> {
    // 해당 월의 모든 메모리 가져오기
    const { data: memories, error } = await this.supabase
      .from('immutable_memory')
      .select('*')
      .eq('user_id', this.userId)
      .eq('year', year)
      .eq('month', month)
      .order('timestamp', { ascending: true })

    if (error) {
      throw new Error(`메모리 조회 실패: ${error.message}`)
    }

    if (!memories || memories.length === 0) {
      throw new Error(`${year}년 ${month}월에 해당하는 메모리가 없습니다.`)
    }

    // 통계 계산
    const byWeek: Record<number, number> = {}
    memories.forEach((m: ImmutableMemoryRecord) => {
      byWeek[m.week_of_year] = (byWeek[m.week_of_year] || 0) + 1
    })

    const statistics: MonthStatistics = {
      total_memories: memories.length,
      by_week: byWeek,
      by_event_type: this.countBy(memories, 'event_type'),
    }

    // 가장 활발한 주 찾기
    const peakWeek = Object.entries(byWeek).sort((a, b) => b[1] - a[1])[0]
    if (peakWeek) {
      statistics.peak_activity_week = parseInt(peakWeek[0], 10)
    }

    // AI 요약 생성
    const summaryPrompt = PromptTemplate.fromTemplate(`
다음은 {year}년 {month}월에 기록된 메모리들입니다. 한 달을 요약해주세요.

주별 메모리 수: {by_week}
이벤트 타입별: {by_event_type}
총 메모리: {total}개

주요 메모리 샘플:
{sample_memories}

다음 JSON 형식으로 요약을 반환하세요:
{{
  "summary": "한 달 전체를 4-5문장으로 요약",
  "achievements": ["이번 달 성과/달성 1", "이번 달 성과/달성 2"],
  "challenges": ["이번 달 도전/어려움 1", "이번 달 도전/어려움 2"],
  "insights": ["인사이트/교훈 1", "인사이트/교훈 2"]
}}
`)

    const parser = new JsonOutputParser<{
      summary: string
      achievements: string[]
      challenges: string[]
      insights: string[]
    }>()

    const chain = summaryPrompt.pipe(this.llm).pipe(parser)

    // 샘플 메모리 (최대 30개)
    const sampleMemories = memories
      .slice(0, 30)
      .map((m: ImmutableMemoryRecord) => `[${m.date}] [${m.event_type}] ${m.raw_content.substring(0, 150)}`)
      .join('\n')

    const result = await chain.invoke({
      year,
      month,
      by_week: JSON.stringify(byWeek),
      by_event_type: JSON.stringify(statistics.by_event_type),
      total: memories.length,
      sample_memories: sampleMemories,
    })

    // DB에 저장
    const { data, error: saveError } = await this.supabase
      .from('memory_monthly_summary')
      .upsert(
        {
          user_id: this.userId,
          year,
          month,
          model_name: this.modelConfig.model,
          model_version: this.modelConfig.version,
          summary: result.summary,
          achievements: result.achievements,
          challenges: result.challenges,
          insights: result.insights,
          statistics,
        },
        {
          onConflict: 'user_id,year,month,model_name',
        }
      )
      .select()
      .single()

    if (saveError) {
      throw new Error(`월간 요약 저장 실패: ${saveError.message}`)
    }

    return data as MemoryMonthlySummary
  }

  // ============================================
  // Summary Retrieval
  // ============================================

  /**
   * 일간 요약 조회
   */
  async getDailySummary(date: string): Promise<MemoryDailySummary | null> {
    const { data, error } = await this.supabase
      .from('memory_daily_summary')
      .select('*')
      .eq('user_id', this.userId)
      .eq('date', date)
      .eq('model_name', this.modelConfig.model)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`일간 요약 조회 실패: ${error.message}`)
    }

    return data as MemoryDailySummary
  }

  /**
   * 주간 요약 조회
   */
  async getWeeklySummary(year: number, weekOfYear: number): Promise<MemoryWeeklySummary | null> {
    const { data, error } = await this.supabase
      .from('memory_weekly_summary')
      .select('*')
      .eq('user_id', this.userId)
      .eq('year', year)
      .eq('week_of_year', weekOfYear)
      .eq('model_name', this.modelConfig.model)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`주간 요약 조회 실패: ${error.message}`)
    }

    return data as MemoryWeeklySummary
  }

  /**
   * 월간 요약 조회
   */
  async getMonthlySummary(year: number, month: number): Promise<MemoryMonthlySummary | null> {
    const { data, error } = await this.supabase
      .from('memory_monthly_summary')
      .select('*')
      .eq('user_id', this.userId)
      .eq('year', year)
      .eq('month', month)
      .eq('model_name', this.modelConfig.model)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`월간 요약 조회 실패: ${error.message}`)
    }

    return data as MemoryMonthlySummary
  }

  // ============================================
  // Model Migration
  // ============================================

  /**
   * 새 모델로 모든 분석 재생성
   */
  async migrateToNewModel(
    newModelConfig: AnalysisModelConfig,
    options?: {
      batch_size?: number
      on_progress?: (progress: number) => void
      include_summaries?: boolean
    }
  ): Promise<{ analyzed: number; errors: number }> {
    const batchSize = options?.batch_size || 50
    let analyzed = 0
    let errors = 0

    // 새 분석 서비스 생성
    const newService = new MemoryAnalysisService(this.supabase, this.userId, newModelConfig)

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

      for (const memory of batch) {
        try {
          await newService.analyzeMemory(memory)
          analyzed++
        } catch (err) {
          errors++
          console.error(`메모리 분석 실패 (${memory.id}):`, err)
        }
      }

      // 진행률 콜백
      if (options?.on_progress) {
        options.on_progress(Math.round(((i + batch.length) / totalMemories) * 100))
      }
    }

    return { analyzed, errors }
  }

  /**
   * 분석이 없는 메모리에 대해 분석 생성
   */
  async backfillMissingAnalysis(
    options?: { batch_size?: number; on_progress?: (progress: number) => void }
  ): Promise<{ created: number; errors: number }> {
    const batchSize = options?.batch_size || 50
    let created = 0
    let errors = 0

    // 분석이 없는 메모리 찾기
    const { data, error } = await this.supabase.rpc('get_memories_without_analysis', {
      p_user_id: this.userId,
      p_model_name: this.modelConfig.model,
    })

    if (error) {
      throw new Error(`미싱 메모리 조회 실패: ${error.message}`)
    }

    const memoriesWithoutAnalysis = data as ImmutableMemoryRecord[]
    const totalCount = memoriesWithoutAnalysis.length

    // 배치 처리
    for (let i = 0; i < totalCount; i += batchSize) {
      const batch = memoriesWithoutAnalysis.slice(i, i + batchSize)

      for (const memory of batch) {
        try {
          await this.analyzeMemory(memory)
          created++
        } catch (err) {
          errors++
          console.error(`메모리 분석 실패 (${memory.id}):`, err)
        }
      }

      // 진행률 콜백
      if (options?.on_progress) {
        options.on_progress(Math.round(((i + batch.length) / totalCount) * 100))
      }
    }

    return { created, errors }
  }

  // ============================================
  // Helpers
  // ============================================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private countBy(items: any[], field: string): Record<string, number> {
    return items.reduce<Record<string, number>>((acc, item) => {
      const key = String(item[field])
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
  }

  // ============================================
  // Statistics
  // ============================================

  /**
   * 분석 통계 조회
   */
  async getStatistics(): Promise<{
    total_analyses: number
    by_model: Record<string, number>
    coverage_percent: number
    avg_importance_score: number
  }> {
    // 전체 메모리 수
    const { count: totalMemories } = await this.supabase
      .from('immutable_memory')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', this.userId)

    // 모델별 분석 수
    const { data: analyses, error } = await this.supabase
      .from('memory_analysis')
      .select(
        `
        model_name,
        importance_score,
        memory:memory_id!inner(user_id)
      `
      )
      .eq('memory.user_id', this.userId)

    if (error) {
      throw new Error(`분석 통계 조회 실패: ${error.message}`)
    }

    const byModel = (analyses || []).reduce<Record<string, number>>((acc, a: any) => {
      acc[a.model_name] = (acc[a.model_name] || 0) + 1
      return acc
    }, {})

    const currentModelAnalyses = (analyses || []).filter(
      (a: any) => a.model_name === this.modelConfig.model
    )
    const currentModelCount = currentModelAnalyses.length
    const coveragePercent =
      totalMemories && totalMemories > 0
        ? Math.round((currentModelCount / totalMemories) * 100)
        : 0

    // 평균 중요도 점수
    const avgImportance =
      currentModelAnalyses.length > 0
        ? currentModelAnalyses.reduce((sum: number, a: any) => sum + (a.importance_score || 0), 0) /
          currentModelAnalyses.length
        : 0

    return {
      total_analyses: analyses?.length || 0,
      by_model: byModel,
      coverage_percent: coveragePercent,
      avg_importance_score: Math.round(avgImportance * 100) / 100,
    }
  }
}

/**
 * 클라이언트용 팩토리 함수
 */
export function createMemoryAnalysisService(
  supabase: AnySupabaseClient,
  userId: string,
  modelConfig?: Partial<AnalysisModelConfig>
): MemoryAnalysisService {
  return new MemoryAnalysisService(supabase, userId, modelConfig)
}
