/**
 * Immutable Memory System Types
 *
 * 이 타입들은 불변 메모리 시스템을 위한 것입니다.
 * 원본 데이터는 절대 수정/삭제되지 않으며, LLM 모델이 변경되어도
 * 메모리는 영구적으로 유지됩니다.
 */

// ============================================
// Core Memory Types (Immutable)
// ============================================

/**
 * 이벤트 타입 - 메모리에 저장되는 이벤트 종류
 */
export type MemoryEventType =
  | 'conversation'      // 대화
  | 'task_created'      // 태스크 생성
  | 'task_completed'    // 태스크 완료
  | 'document_created'  // 문서 생성
  | 'document_updated'  // 문서 수정
  | 'email_sent'        // 이메일 발송
  | 'email_received'    // 이메일 수신
  | 'meeting'           // 회의
  | 'decision'          // 의사결정
  | 'milestone'         // 마일스톤
  | 'insight'           // AI 인사이트
  | 'error'             // 에러
  | 'system'            // 시스템 이벤트
  | 'custom'            // 커스텀 이벤트

/**
 * 메모리 역할 - 누가 생성한 메모리인지
 */
export type MemoryRole = 'user' | 'assistant' | 'system' | 'agent'

/**
 * 불변 메모리 레코드 (원본 데이터)
 * 이 데이터는 한번 저장되면 절대 수정/삭제되지 않습니다.
 */
export interface ImmutableMemoryRecord {
  id: string
  user_id: string

  // 시간 정보 (자동 생성)
  timestamp: string
  date: string           // YYYY-MM-DD
  hour: number           // 0-23
  day_of_week: number    // 0(일) - 6(토)
  week_of_year: number   // 1-53
  month: number          // 1-12
  year: number           // YYYY

  // 원본 컨텐츠 (불변)
  raw_content: string
  event_type: MemoryEventType
  role: MemoryRole

  // 출처 정보
  source_agent?: string   // 생성한 에이전트 이름
  source_model?: string   // 생성 당시 사용된 LLM 모델
  session_id?: string     // 세션 ID
  parent_id?: string      // 부모 메모리 ID (대화 체인용)

  // 추가 컨텍스트 (메타데이터)
  context: MemoryContext

  created_at: string
}

/**
 * 메모리 컨텍스트 - 추가 메타데이터
 */
export interface MemoryContext {
  // 대화 관련
  conversation_id?: string
  message_index?: number

  // 태스크 관련
  task_id?: string
  project_id?: string

  // 문서 관련
  document_id?: string
  document_type?: string

  // 이메일 관련
  email_id?: string
  email_subject?: string

  // 회의 관련
  meeting_id?: string
  participants?: string[]

  // 태그 및 분류
  tags?: string[]
  category?: string

  // 감정/톤 (저장 시점의 원본)
  original_sentiment?: string
  original_importance?: 'low' | 'medium' | 'high' | 'critical'

  // 기타 커스텀 데이터
  [key: string]: unknown
}

/**
 * 새 메모리 생성 입력
 */
export interface CreateMemoryInput {
  raw_content: string
  event_type: MemoryEventType
  role: MemoryRole
  source_agent?: string
  source_model?: string
  session_id?: string
  parent_id?: string
  context?: Partial<MemoryContext>
  timestamp?: string  // 지정하지 않으면 현재 시간
}

// ============================================
// Embedding Types (Model-Specific, Regeneratable)
// ============================================

/**
 * 메모리 임베딩 - 모델별로 재생성 가능
 */
export interface MemoryEmbedding {
  id: string
  memory_id: string
  model_name: string        // 'text-embedding-3-small', 'text-embedding-ada-002' 등
  model_version?: string    // 모델 버전
  embedding: number[]       // 벡터 (1536차원)
  created_at: string
}

/**
 * 임베딩 생성/업데이트 입력
 */
export interface UpsertEmbeddingInput {
  memory_id: string
  model_name: string
  model_version?: string
  embedding: number[]
}

// ============================================
// Analysis Types (Model-Specific, Regeneratable)
// ============================================

/**
 * 메모리 분석 결과 - 모델별로 재생성 가능
 */
export interface MemoryAnalysis {
  id: string
  memory_id: string
  model_name: string
  model_version?: string

  // 분석 결과
  summary?: string
  key_points?: string[]
  entities?: MemoryEntity[]
  sentiment?: MemorySentiment
  importance_score?: number      // 0-1
  relevance_tags?: string[]
  action_items?: string[]

  // 연관 관계
  related_memory_ids?: string[]

  // 분석 메타데이터
  analysis_metadata?: Record<string, unknown>

  created_at: string
}

/**
 * 추출된 엔티티
 */
export interface MemoryEntity {
  type: 'person' | 'organization' | 'location' | 'date' | 'product' | 'concept' | 'other'
  value: string
  confidence?: number  // 0-1
}

/**
 * 감정 분석 결과
 */
export interface MemorySentiment {
  label: 'positive' | 'negative' | 'neutral' | 'mixed'
  score: number  // -1 to 1
  emotions?: {
    joy?: number
    sadness?: number
    anger?: number
    fear?: number
    surprise?: number
  }
}

/**
 * 분석 생성/업데이트 입력
 */
export interface UpsertAnalysisInput {
  memory_id: string
  model_name: string
  model_version?: string
  summary?: string
  key_points?: string[]
  entities?: MemoryEntity[]
  sentiment?: MemorySentiment
  importance_score?: number
  relevance_tags?: string[]
  action_items?: string[]
  related_memory_ids?: string[]
  analysis_metadata?: Record<string, unknown>
}

// ============================================
// Summary Types (Model-Specific, Regeneratable)
// ============================================

/**
 * 일간 요약
 */
export interface MemoryDailySummary {
  id: string
  user_id: string
  date: string
  model_name: string
  model_version?: string

  summary: string
  key_events?: string[]
  statistics?: DayStatistics
  created_at: string
}

/**
 * 일간 통계
 */
export interface DayStatistics {
  total_memories: number
  by_event_type: Record<string, number>
  by_role: Record<string, number>
  avg_importance?: number
  top_entities?: Array<{ entity: string; count: number }>
}

/**
 * 주간 요약
 */
export interface MemoryWeeklySummary {
  id: string
  user_id: string
  year: number
  week_of_year: number
  model_name: string
  model_version?: string

  summary: string
  highlights?: string[]
  statistics?: WeekStatistics
  trends?: string[]
  created_at: string
}

/**
 * 주간 통계
 */
export interface WeekStatistics {
  total_memories: number
  by_day: Record<string, number>  // 요일별
  by_event_type: Record<string, number>
  most_active_day?: string
  avg_daily_memories?: number
}

/**
 * 월간 요약
 */
export interface MemoryMonthlySummary {
  id: string
  user_id: string
  year: number
  month: number
  model_name: string
  model_version?: string

  summary: string
  achievements?: string[]
  challenges?: string[]
  statistics?: MonthStatistics
  insights?: string[]
  created_at: string
}

/**
 * 월간 통계
 */
export interface MonthStatistics {
  total_memories: number
  by_week: Record<number, number>
  by_event_type: Record<string, number>
  growth_from_last_month?: number  // 퍼센트
  peak_activity_week?: number
}

// ============================================
// Search & Query Types
// ============================================

/**
 * 시간 범위 쿼리
 */
export interface TemporalQuery {
  // 자연어 시간 표현
  natural?: string  // '어제', '지난주', '이번달' 등

  // 명시적 범위
  start_date?: string
  end_date?: string

  // 특정 시간대
  hour?: number
  day_of_week?: number
  week_of_year?: number
  month?: number
  year?: number
}

/**
 * 하이브리드 검색 쿼리
 */
export interface HybridSearchQuery {
  // 시맨틱 검색
  query_text?: string
  query_embedding?: number[]

  // 시간 검색
  temporal?: TemporalQuery

  // 필터
  event_types?: MemoryEventType[]
  roles?: MemoryRole[]
  source_agents?: string[]
  tags?: string[]

  // 정렬 및 페이지네이션
  sort_by?: 'timestamp' | 'relevance' | 'importance'
  sort_order?: 'asc' | 'desc'
  limit?: number
  offset?: number

  // 검색 가중치
  weights?: {
    semantic?: number   // 0-1, 시맨틱 유사도 가중치
    temporal?: number   // 0-1, 시간 근접성 가중치
    importance?: number // 0-1, 중요도 가중치
  }
}

/**
 * 검색 결과
 */
export interface MemorySearchResult {
  memory: ImmutableMemoryRecord
  embedding?: MemoryEmbedding
  analysis?: MemoryAnalysis

  // 검색 점수
  scores: {
    semantic_similarity?: number
    temporal_recency?: number
    importance?: number
    combined: number
  }
}

/**
 * 검색 응답
 */
export interface MemorySearchResponse {
  results: MemorySearchResult[]
  total_count: number
  query_time_ms: number

  // 페이지네이션
  limit: number
  offset: number
  has_more: boolean
}

// ============================================
// Timeline & Aggregation Types
// ============================================

/**
 * 타임라인 그룹
 */
export interface TimelineGroup {
  period: string  // '2024-01-15', '2024-W03', '2024-01' 등
  period_type: 'day' | 'week' | 'month' | 'year'
  memories: ImmutableMemoryRecord[]
  summary?: string
  statistics: {
    count: number
    by_event_type: Record<string, number>
    by_role: Record<string, number>
  }
}

/**
 * 타임라인 응답
 */
export interface TimelineResponse {
  groups: TimelineGroup[]
  total_memories: number
  date_range: {
    start: string
    end: string
  }
}

// ============================================
// Service Configuration Types
// ============================================

/**
 * 메모리 서비스 설정
 */
export interface MemoryServiceConfig {
  // 임베딩 설정
  embedding: {
    model: string
    version?: string
    dimensions: number
  }

  // 분석 설정
  analysis: {
    model: string
    version?: string
    enable_sentiment: boolean
    enable_entities: boolean
    enable_action_items: boolean
  }

  // 요약 설정
  summary: {
    model: string
    version?: string
    daily_enabled: boolean
    weekly_enabled: boolean
    monthly_enabled: boolean
  }

  // 검색 설정
  search: {
    default_limit: number
    max_limit: number
    default_weights: {
      semantic: number
      temporal: number
      importance: number
    }
  }
}

/**
 * 기본 서비스 설정
 */
export const DEFAULT_MEMORY_CONFIG: MemoryServiceConfig = {
  embedding: {
    model: 'text-embedding-3-small',
    dimensions: 1536,
  },
  analysis: {
    model: 'gpt-4o-mini',
    enable_sentiment: true,
    enable_entities: true,
    enable_action_items: true,
  },
  summary: {
    model: 'gpt-4o-mini',
    daily_enabled: true,
    weekly_enabled: true,
    monthly_enabled: true,
  },
  search: {
    default_limit: 20,
    max_limit: 100,
    default_weights: {
      semantic: 0.5,
      temporal: 0.3,
      importance: 0.2,
    },
  },
}
