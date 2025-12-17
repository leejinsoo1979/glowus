/**
 * Memory Services - 불변 메모리 시스템 모듈
 *
 * 이 모듈은 AI 에이전트를 위한 불변 장기 메모리 시스템을 제공합니다.
 *
 * 핵심 원칙:
 * 1. 불변성: 원본 데이터는 절대 수정/삭제되지 않음
 * 2. 모델 독립성: LLM 모델 변경 시에도 메모리는 영구 보존
 * 3. 재생성 가능: 임베딩과 분석은 모델별로 재생성 가능
 *
 * 구조:
 * - ImmutableMemoryService: 원본 메모리 저장/조회 (Append-Only)
 * - MemoryEmbeddingService: 모델별 임베딩 관리 (Regeneratable)
 * - MemoryAnalysisService: 모델별 분석 관리 (Regeneratable)
 */

export {
  ImmutableMemoryService,
  createImmutableMemoryService,
} from './ImmutableMemoryService'

export {
  MemoryEmbeddingService,
  createMemoryEmbeddingService,
  type EmbeddingModelConfig,
} from './MemoryEmbeddingService'

export {
  MemoryAnalysisService,
  createMemoryAnalysisService,
  type AnalysisModelConfig,
} from './MemoryAnalysisService'

// Re-export types
export type {
  ImmutableMemoryRecord,
  CreateMemoryInput,
  MemoryEventType,
  MemoryRole,
  MemoryContext,
  MemoryEmbedding,
  UpsertEmbeddingInput,
  MemoryAnalysis,
  UpsertAnalysisInput,
  MemoryEntity,
  MemorySentiment,
  MemoryDailySummary,
  MemoryWeeklySummary,
  MemoryMonthlySummary,
  DayStatistics,
  WeekStatistics,
  MonthStatistics,
  TemporalQuery,
  HybridSearchQuery,
  MemorySearchResult,
  MemorySearchResponse,
  TimelineGroup,
  TimelineResponse,
  MemoryServiceConfig,
} from '@/types/memory'

export { DEFAULT_MEMORY_CONFIG } from '@/types/memory'
