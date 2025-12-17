-- ============================================
-- IMMUTABLE MEMORY SYSTEM
-- 절대 불변 메모리 - LLM 모델이 바뀌어도 유지
-- ============================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 1. 불변 메모리 테이블 (원본 데이터)
-- ============================================

CREATE TABLE IF NOT EXISTS public.immutable_memory (
  -- ID (절대 변경 불가)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 소유자 (절대 변경 불가)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 시간 (절대 변경 불가)
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 자동 생성 시간 필드 (검색 최적화)
  date DATE GENERATED ALWAYS AS (timestamp::DATE) STORED,
  hour INT GENERATED ALWAYS AS (EXTRACT(HOUR FROM timestamp)::INT) STORED,
  day_of_week INT GENERATED ALWAYS AS (EXTRACT(DOW FROM timestamp)::INT) STORED,
  week_of_year INT GENERATED ALWAYS AS (EXTRACT(WEEK FROM timestamp)::INT) STORED,
  month INT GENERATED ALWAYS AS (EXTRACT(MONTH FROM timestamp)::INT) STORED,
  year INT GENERATED ALWAYS AS (EXTRACT(YEAR FROM timestamp)::INT) STORED,

  -- 원본 데이터 (절대 변경 불가)
  raw_content TEXT NOT NULL,

  -- 이벤트 타입 (절대 변경 불가)
  event_type TEXT NOT NULL CHECK (event_type IN (
    'conversation',       -- 대화
    'task_created',       -- 태스크 생성
    'task_completed',     -- 태스크 완료
    'document_created',   -- 문서 생성
    'document_updated',   -- 문서 수정
    'email_sent',         -- 이메일 발송
    'email_received',     -- 이메일 수신
    'meeting',            -- 회의
    'decision',           -- 의사결정
    'milestone',          -- 마일스톤
    'insight',            -- AI 인사이트
    'error',              -- 에러
    'system',             -- 시스템 이벤트
    'custom'              -- 커스텀 이벤트
  )),

  -- 역할 (절대 변경 불가)
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'agent')),

  -- 소스 정보 (참고용, 절대 변경 불가)
  source_agent TEXT,
  source_model TEXT,

  -- 세션/컨텍스트 (절대 변경 불가)
  session_id UUID,
  parent_id UUID REFERENCES public.immutable_memory(id),
  context JSONB NOT NULL DEFAULT '{}',

  -- 생성 시점 (절대 변경 불가)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. 임베딩 테이블 (모델별, 재생성 가능)
-- ============================================

CREATE TABLE IF NOT EXISTS public.memory_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES public.immutable_memory(id) ON DELETE CASCADE,

  -- 임베딩 모델 정보
  model_name TEXT NOT NULL,
  model_version TEXT,

  -- 임베딩 벡터
  embedding vector(1536),

  -- 생성 시점
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 모델별 하나의 임베딩
  UNIQUE(memory_id, model_name)
);

-- ============================================
-- 3. 분석 테이블 (모델별, 재생성 가능)
-- ============================================

CREATE TABLE IF NOT EXISTS public.memory_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES public.immutable_memory(id) ON DELETE CASCADE,

  -- 분석 모델 정보
  model_name TEXT NOT NULL,
  model_version TEXT,

  -- 분석 결과 (TypeScript 타입과 일치)
  summary TEXT,
  key_points JSONB DEFAULT '[]',
  entities JSONB DEFAULT '[]',
  sentiment JSONB,
  importance_score FLOAT DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
  relevance_tags JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',
  related_memory_ids JSONB DEFAULT '[]',
  analysis_metadata JSONB DEFAULT '{}',

  -- 생성 시점
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(memory_id, model_name)
);

-- ============================================
-- 4. 시간별 요약 테이블 (모델별, 재생성 가능)
-- ============================================

-- 일별 요약
CREATE TABLE IF NOT EXISTS public.memory_daily_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  date DATE NOT NULL,

  -- 분석 모델 정보
  model_name TEXT NOT NULL,
  model_version TEXT,

  -- 요약 내용 (TypeScript 타입과 일치)
  summary TEXT NOT NULL,
  key_events JSONB DEFAULT '[]',
  statistics JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, date, model_name)
);

-- 주별 요약
CREATE TABLE IF NOT EXISTS public.memory_weekly_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  year INT NOT NULL,
  week_of_year INT NOT NULL,

  -- 분석 모델 정보
  model_name TEXT NOT NULL,
  model_version TEXT,

  -- 요약 내용 (TypeScript 타입과 일치)
  summary TEXT NOT NULL,
  highlights JSONB DEFAULT '[]',
  statistics JSONB DEFAULT '{}',
  trends JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, year, week_of_year, model_name)
);

-- 월별 요약
CREATE TABLE IF NOT EXISTS public.memory_monthly_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  year INT NOT NULL,
  month INT NOT NULL,

  -- 분석 모델 정보
  model_name TEXT NOT NULL,
  model_version TEXT,

  -- 요약 내용 (TypeScript 타입과 일치)
  summary TEXT NOT NULL,
  achievements JSONB DEFAULT '[]',
  challenges JSONB DEFAULT '[]',
  statistics JSONB DEFAULT '{}',
  insights JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, year, month, model_name)
);

-- ============================================
-- 5. 인덱스
-- ============================================

-- 불변 메모리 인덱스
CREATE INDEX IF NOT EXISTS idx_immutable_memory_user_time
  ON public.immutable_memory(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_immutable_memory_date
  ON public.immutable_memory(user_id, date);
CREATE INDEX IF NOT EXISTS idx_immutable_memory_year_month
  ON public.immutable_memory(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_immutable_memory_year_week
  ON public.immutable_memory(user_id, year, week_of_year);
CREATE INDEX IF NOT EXISTS idx_immutable_memory_dow
  ON public.immutable_memory(user_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_immutable_memory_hour
  ON public.immutable_memory(user_id, hour);
CREATE INDEX IF NOT EXISTS idx_immutable_memory_event_type
  ON public.immutable_memory(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_immutable_memory_session
  ON public.immutable_memory(session_id);

-- 임베딩 인덱스
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_memory
  ON public.memory_embeddings(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_model
  ON public.memory_embeddings(model_name);

-- 분석 인덱스
CREATE INDEX IF NOT EXISTS idx_memory_analysis_memory
  ON public.memory_analysis(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_analysis_model
  ON public.memory_analysis(model_name);
CREATE INDEX IF NOT EXISTS idx_memory_analysis_importance
  ON public.memory_analysis(importance_score DESC);

-- 요약 인덱스
CREATE INDEX IF NOT EXISTS idx_memory_daily_summary_user_date
  ON public.memory_daily_summary(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_memory_weekly_summary_user
  ON public.memory_weekly_summary(user_id, year DESC, week_of_year DESC);
CREATE INDEX IF NOT EXISTS idx_memory_monthly_summary_user
  ON public.memory_monthly_summary(user_id, year DESC, month DESC);

-- ============================================
-- 6. 불변성 보호 트리거
-- ============================================

-- UPDATE 방지 함수
CREATE OR REPLACE FUNCTION public.prevent_immutable_memory_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'immutable_memory 테이블은 수정이 금지되어 있습니다. 원본 데이터는 불변입니다.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- DELETE 방지 함수
CREATE OR REPLACE FUNCTION public.prevent_immutable_memory_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'immutable_memory 테이블은 삭제가 금지되어 있습니다. 원본 데이터는 영구 보존됩니다.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- UPDATE 트리거
DROP TRIGGER IF EXISTS immutable_memory_no_update ON public.immutable_memory;
CREATE TRIGGER immutable_memory_no_update
  BEFORE UPDATE ON public.immutable_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_immutable_memory_update();

-- DELETE 트리거
DROP TRIGGER IF EXISTS immutable_memory_no_delete ON public.immutable_memory;
CREATE TRIGGER immutable_memory_no_delete
  BEFORE DELETE ON public.immutable_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_immutable_memory_delete();

-- ============================================
-- 7. RPC 함수: 임베딩 기반 시맨틱 검색
-- ============================================

CREATE OR REPLACE FUNCTION public.search_memories_by_embedding(
  p_user_id UUID,
  p_query_embedding vector(1536),
  p_model_name TEXT,
  p_match_threshold FLOAT DEFAULT 0.7,
  p_match_count INT DEFAULT 20
)
RETURNS TABLE (
  memory_id UUID,
  similarity FLOAT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    e.memory_id,
    (1 - (e.embedding <=> p_query_embedding))::FLOAT AS similarity
  FROM public.memory_embeddings e
  JOIN public.immutable_memory m ON m.id = e.memory_id
  WHERE m.user_id = p_user_id
    AND e.model_name = p_model_name
    AND (1 - (e.embedding <=> p_query_embedding)) >= p_match_threshold
  ORDER BY e.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;

-- ============================================
-- 8. RPC 함수: 임베딩 없는 메모리 조회
-- ============================================

CREATE OR REPLACE FUNCTION public.get_memories_without_embeddings(
  p_user_id UUID,
  p_model_name TEXT
)
RETURNS SETOF public.immutable_memory
LANGUAGE SQL
STABLE
AS $$
  SELECT m.*
  FROM public.immutable_memory m
  LEFT JOIN public.memory_embeddings e
    ON e.memory_id = m.id AND e.model_name = p_model_name
  WHERE m.user_id = p_user_id
    AND e.id IS NULL
  ORDER BY m.timestamp ASC;
$$;

-- ============================================
-- 9. RPC 함수: 분석 없는 메모리 조회
-- ============================================

CREATE OR REPLACE FUNCTION public.get_memories_without_analysis(
  p_user_id UUID,
  p_model_name TEXT
)
RETURNS SETOF public.immutable_memory
LANGUAGE SQL
STABLE
AS $$
  SELECT m.*
  FROM public.immutable_memory m
  LEFT JOIN public.memory_analysis a
    ON a.memory_id = m.id AND a.model_name = p_model_name
  WHERE m.user_id = p_user_id
    AND a.id IS NULL
  ORDER BY m.timestamp ASC;
$$;

-- ============================================
-- 10. RPC 함수: 날짜별 메모리 조회
-- ============================================

CREATE OR REPLACE FUNCTION public.get_memories_by_date(
  p_user_id UUID,
  p_date DATE
)
RETURNS TABLE (
  id UUID,
  timestamp TIMESTAMPTZ,
  event_type TEXT,
  role TEXT,
  raw_content TEXT,
  source_agent TEXT,
  session_id UUID
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    id, timestamp, event_type, role, raw_content, source_agent, session_id
  FROM public.immutable_memory
  WHERE user_id = p_user_id
    AND date = p_date
  ORDER BY timestamp ASC;
$$;

-- ============================================
-- 11. RPC 함수: 날짜 범위 메모리 조회
-- ============================================

CREATE OR REPLACE FUNCTION public.get_memories_by_range(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_event_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  timestamp TIMESTAMPTZ,
  date DATE,
  event_type TEXT,
  role TEXT,
  raw_content TEXT,
  source_agent TEXT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    id, timestamp, date, event_type, role, raw_content, source_agent
  FROM public.immutable_memory
  WHERE user_id = p_user_id
    AND date BETWEEN p_start_date AND p_end_date
    AND (p_event_types IS NULL OR event_type = ANY(p_event_types))
  ORDER BY timestamp ASC;
$$;

-- ============================================
-- 12. RPC 함수: 최근 N일 메모리 조회
-- ============================================

CREATE OR REPLACE FUNCTION public.get_recent_memories(
  p_user_id UUID,
  p_days INT DEFAULT 7,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  timestamp TIMESTAMPTZ,
  date DATE,
  event_type TEXT,
  raw_content TEXT,
  source_agent TEXT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    id, timestamp, date, event_type, raw_content, source_agent
  FROM public.immutable_memory
  WHERE user_id = p_user_id
    AND timestamp >= NOW() - (p_days || ' days')::INTERVAL
  ORDER BY timestamp DESC
  LIMIT p_limit;
$$;

-- ============================================
-- 13. RPC 함수: 시간+의미 하이브리드 검색
-- ============================================

CREATE OR REPLACE FUNCTION public.search_memories_hybrid(
  p_embedding vector(1536),
  p_user_id UUID,
  p_model_name TEXT,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_recency_weight FLOAT DEFAULT 0.3,
  p_semantic_weight FLOAT DEFAULT 0.7,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  timestamp TIMESTAMPTZ,
  raw_content TEXT,
  event_type TEXT,
  semantic_score FLOAT,
  recency_score FLOAT,
  combined_score FLOAT,
  date DATE
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  max_age FLOAT;
BEGIN
  -- 최대 나이 계산
  SELECT GREATEST(EXTRACT(EPOCH FROM (NOW() - MIN(m.timestamp))) / 86400.0, 1)
  INTO max_age
  FROM public.immutable_memory m
  WHERE m.user_id = p_user_id;

  RETURN QUERY
  SELECT
    m.id,
    m.timestamp,
    m.raw_content,
    m.event_type,
    (1 - (e.embedding <=> p_embedding))::FLOAT AS semantic_score,
    (1 - EXTRACT(EPOCH FROM (NOW() - m.timestamp)) / 86400.0 / max_age)::FLOAT AS recency_score,
    (
      (1 - (e.embedding <=> p_embedding)) * p_semantic_weight +
      (1 - EXTRACT(EPOCH FROM (NOW() - m.timestamp)) / 86400.0 / max_age) * p_recency_weight
    )::FLOAT AS combined_score,
    m.date
  FROM public.immutable_memory m
  JOIN public.memory_embeddings e ON e.memory_id = m.id AND e.model_name = p_model_name
  WHERE m.user_id = p_user_id
    AND (p_start_date IS NULL OR m.date >= p_start_date)
    AND (p_end_date IS NULL OR m.date <= p_end_date)
  ORDER BY combined_score DESC
  LIMIT p_limit;
END;
$$;

-- ============================================
-- 14. RPC 함수: 분석과 함께 메모리 조회
-- ============================================

CREATE OR REPLACE FUNCTION public.get_memories_with_analysis(
  p_user_id UUID,
  p_model_name TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  timestamp TIMESTAMPTZ,
  raw_content TEXT,
  event_type TEXT,
  summary TEXT,
  key_points JSONB,
  entities JSONB,
  importance_score FLOAT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    m.id,
    m.timestamp,
    m.raw_content,
    m.event_type,
    a.summary,
    a.key_points,
    a.entities,
    a.importance_score
  FROM public.immutable_memory m
  LEFT JOIN public.memory_analysis a ON a.memory_id = m.id AND a.model_name = p_model_name
  WHERE m.user_id = p_user_id
    AND m.date BETWEEN p_start_date AND p_end_date
  ORDER BY m.timestamp DESC
  LIMIT p_limit;
$$;

-- ============================================
-- 15. RLS 정책
-- ============================================

-- immutable_memory
ALTER TABLE public.immutable_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own memories" ON public.immutable_memory;
CREATE POLICY "Users can view own memories"
  ON public.immutable_memory FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own memories" ON public.immutable_memory;
CREATE POLICY "Users can insert own memories"
  ON public.immutable_memory FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE/DELETE 정책 없음 = 불가능

-- memory_embeddings
ALTER TABLE public.memory_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own memory embeddings" ON public.memory_embeddings;
CREATE POLICY "Users can manage own memory embeddings"
  ON public.memory_embeddings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.immutable_memory m
      WHERE m.id = memory_id AND m.user_id = auth.uid()
    )
  );

-- memory_analysis
ALTER TABLE public.memory_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own memory analysis" ON public.memory_analysis;
CREATE POLICY "Users can manage own memory analysis"
  ON public.memory_analysis FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.immutable_memory m
      WHERE m.id = memory_id AND m.user_id = auth.uid()
    )
  );

-- memory_daily_summary
ALTER TABLE public.memory_daily_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own daily summaries" ON public.memory_daily_summary;
CREATE POLICY "Users can manage own daily summaries"
  ON public.memory_daily_summary FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- memory_weekly_summary
ALTER TABLE public.memory_weekly_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own weekly summaries" ON public.memory_weekly_summary;
CREATE POLICY "Users can manage own weekly summaries"
  ON public.memory_weekly_summary FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- memory_monthly_summary
ALTER TABLE public.memory_monthly_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own monthly summaries" ON public.memory_monthly_summary;
CREATE POLICY "Users can manage own monthly summaries"
  ON public.memory_monthly_summary FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- 16. 벡터 인덱스 (성능 최적화)
-- ============================================

-- 임베딩 벡터 인덱스 (대용량 데이터용)
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_vector
  ON public.memory_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
