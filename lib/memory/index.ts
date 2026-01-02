/**
 * Memory Services - AI 에이전트 메모리 시스템 모듈
 *
 * 이 모듈은 AI 에이전트를 위한 메모리 시스템을 제공합니다.
 *
 * === Agent OS v2.0 (신규) ===
 * PRD v2.0 기반 메모리 & 성장 시스템
 * - 5가지 메모리 타입 (Private, Meeting, Team, Injected, Execution)
 * - 관계 관리 (친밀도, 신뢰도, 소통 스타일)
 * - 학습 시스템 (인사이트 추출, 패턴 학습)
 * - 능력치 시스템 (분석력, 소통력, 창의성, 리더십)
 *
 * === Legacy System ===
 * 불변 장기 메모리 시스템 (immutable_memory 테이블 사용)
 * - ImmutableMemoryService: 원본 메모리 저장/조회 (Append-Only)
 * - MemoryEmbeddingService: 모델별 임베딩 관리 (Regeneratable)
 * - MemoryAnalysisService: 모델별 분석 관리 (Regeneratable)
 */

// ============================================
// Agent OS v2.0 (신규)
// ============================================
export * from './agent-os'

// 🧠 JARVIS Long-term Memory (RAG)
export {
  buildJarvisContext,
  saveConversationMessage,
  getRecentConversations,
  searchRelevantMemories,
  searchEpisodes,
  saveEpisode,
  getOrCreateUserProfile,
  updateUserProfile,
  addImportantFact,
  analyzeAndLearn,
  type UserProfile,
  type ConversationMessage,
  type JarvisContext,
  type SaveMessageParams,
} from './jarvis-memory-manager'

// Agent Memory Search Service (Phase 2.3)
export {
  searchMemories,
  hybridSearch,
  fulltextSearch,
  filterByPermission,
  getAccessibleMemories,
  searchKnowledgeBase,
  getLinkedMemories,
  getMemoryGraphData,
  buildConversationContext,
  formatMemoriesForContext,
  type VectorSearchParams,
  type HybridSearchParams,
  type SearchResultWithScores,
  type PermissionCheckResult,
  type MemoryGraphData,
  type KnowledgeSearchParams,
  type KnowledgeSearchResult,
} from './agent-memory-search-service'

// Agent Style Adapter (Phase 3.2)
export {
  createStyleConfigFromRelationship,
  adaptStyleRuleBased,
  adaptStyleWithLLM,
  adaptStyle,
  generateContextualGreeting,
  generateContextualClosing,
  detectStyle,
  checkStyleConsistency,
  STYLE_GUIDELINES,
  type StyleConfig,
  type AgentPersonality,
  type StyleTransformResult,
} from './agent-style-adapter'

// Agent Experience Collector (Phase 4.2)
export {
  collectExperience,
  getAgentLearnings,
  getPersonLearnings,
  getDomainLearnings,
  formatLearningsForPrompt,
  getLearningStats,
  type LearningCategory,
  type AgentLearning,
  type ExperienceEvent,
  type ExtractedInsight,
  type ExperienceAnalysis,
} from './agent-experience-collector'

// Agent Behavior Modifier (Phase 4.4)
export {
  generateBehaviorProfile,
  generateBehaviorModification,
  buildBehaviorSystemPrompt,
  buildQuickBehaviorPrompt,
  type BehaviorProfile,
  type BehaviorContext,
  type BehaviorModification,
} from './agent-behavior-modifier'

// Agent Knowledge Service (Phase 5)
export {
  uploadDocument,
  uploadFromUrl,
  searchKnowledge,
  getFullDocument,
  listKnowledgeDocuments,
  deleteDocument,
  getKnowledgeStats,
  buildKnowledgeContext,
  formatKnowledgeForPrompt,
  type AccessLevel,
  type KnowledgeDocument,
  type UploadDocumentParams,
  type UploadResult,
  type KnowledgeSearchParams as KnowledgeUploadSearchParams,
  type KnowledgeSearchResult as KnowledgeUploadSearchResult,
} from './agent-knowledge-service'

// ============================================
// Legacy: Immutable Memory System
// ============================================
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
