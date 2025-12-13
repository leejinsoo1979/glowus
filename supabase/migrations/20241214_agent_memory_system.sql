-- Agent Memory System Tables
-- 에이전트가 사람처럼 기억하고 학습하는 시스템

-- Enable pgvector extension (for embedding search)
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- 1. agent_work_logs - 에이전트 업무 로그
-- =====================================================
CREATE TABLE IF NOT EXISTS public.agent_work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.deployed_agents(id) ON DELETE CASCADE,

  -- 로그 타입
  log_type TEXT NOT NULL CHECK (log_type IN (
    'conversation',    -- 대화 참여
    'task_work',       -- 태스크 작업
    'decision',        -- 의사결정
    'analysis',        -- 분석 수행
    'learning',        -- 학습/깨달음
    'collaboration',   -- 다른 에이전트와 협업
    'error',           -- 오류 발생
    'milestone'        -- 이정표 달성
  )),

  -- 내용
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,

  -- 관계
  room_id UUID REFERENCES public.chat_rooms(id) ON DELETE SET NULL,
  task_id UUID,
  project_id UUID,
  related_agent_ids UUID[] DEFAULT '{}',

  -- 메타데이터
  importance INTEGER DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',

  -- 임베딩 (semantic search용)
  embedding vector(1536),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_work_logs_agent_id ON public.agent_work_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_work_logs_room_id ON public.agent_work_logs(room_id);
CREATE INDEX IF NOT EXISTS idx_agent_work_logs_log_type ON public.agent_work_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_agent_work_logs_created_at ON public.agent_work_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_work_logs_importance ON public.agent_work_logs(importance DESC);

-- =====================================================
-- 2. agent_commits - 에이전트 업무 커밋 (기간별 요약)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.agent_commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.deployed_agents(id) ON DELETE CASCADE,

  -- 커밋 타입
  commit_type TEXT NOT NULL CHECK (commit_type IN (
    'hourly',     -- 시간별
    'daily',      -- 일별
    'weekly',     -- 주별
    'monthly',    -- 월별
    'milestone'   -- 이정표
  )),

  -- 기간
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- 내용
  title TEXT NOT NULL,
  summary TEXT NOT NULL,

  -- 통계
  stats JSONB DEFAULT '{}'::jsonb,
  -- 예: {"conversations": 10, "tasks_completed": 3, "decisions_made": 5, "key_topics": ["기획", "개발"]}

  -- 관련 로그
  log_ids UUID[] DEFAULT '{}',

  -- 인사이트
  learnings TEXT[] DEFAULT '{}',
  insights TEXT[] DEFAULT '{}',

  -- 임베딩
  embedding vector(1536),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_commits_agent_id ON public.agent_commits(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_commits_commit_type ON public.agent_commits(commit_type);
CREATE INDEX IF NOT EXISTS idx_agent_commits_period_end ON public.agent_commits(period_end DESC);

-- =====================================================
-- 3. agent_knowledge - 에이전트 지식 베이스
-- =====================================================
CREATE TABLE IF NOT EXISTS public.agent_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.deployed_agents(id) ON DELETE CASCADE,

  -- 지식 타입
  knowledge_type TEXT NOT NULL CHECK (knowledge_type IN (
    'project',         -- 프로젝트 관련
    'team',            -- 팀/조직 관련
    'domain',          -- 도메인 지식
    'preference',      -- 사용자 선호
    'procedure',       -- 절차/방법
    'decision_rule',   -- 의사결정 규칙
    'lesson_learned'   -- 교훈
  )),

  -- 내용
  subject TEXT NOT NULL,
  content TEXT NOT NULL,

  -- 관계
  project_id UUID,
  team_id UUID,

  -- 메타데이터
  confidence DECIMAL(3,2) DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
  tags TEXT[] DEFAULT '{}',

  -- 임베딩
  embedding vector(1536),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_agent_id ON public.agent_knowledge(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_type ON public.agent_knowledge(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_project_id ON public.agent_knowledge(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_confidence ON public.agent_knowledge(confidence DESC);

-- =====================================================
-- 4. agent_identity - 에이전트 정체성/성격
-- =====================================================
CREATE TABLE IF NOT EXISTS public.agent_identity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.deployed_agents(id) ON DELETE CASCADE,

  -- 핵심 정체성
  core_values TEXT[] DEFAULT '{}',
  personality_traits TEXT[] DEFAULT '{}',
  communication_style TEXT,

  -- 전문성
  expertise_areas JSONB DEFAULT '[]'::jsonb,
  -- 예: [{"area": "프론트엔드", "level": 0.9, "experienceCount": 50}]

  -- 작업 스타일
  working_style TEXT,
  strengths TEXT[] DEFAULT '{}',
  growth_areas TEXT[] DEFAULT '{}',

  -- 자기 인식
  self_summary TEXT,
  recent_focus TEXT,

  -- 누적 통계
  total_conversations INTEGER DEFAULT 0,
  total_tasks_completed INTEGER DEFAULT 0,
  total_decisions_made INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(agent_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_identity_agent_id ON public.agent_identity(agent_id);

-- =====================================================
-- 5. RPC Function: 시맨틱 지식 검색
-- =====================================================
CREATE OR REPLACE FUNCTION public.match_agent_knowledge(
  agent_id_input UUID,
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  agent_id UUID,
  knowledge_type TEXT,
  subject TEXT,
  content TEXT,
  confidence DECIMAL(3,2),
  tags TEXT[],
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ak.id,
    ak.agent_id,
    ak.knowledge_type,
    ak.subject,
    ak.content,
    ak.confidence,
    ak.tags,
    1 - (ak.embedding <=> query_embedding) AS similarity
  FROM public.agent_knowledge ak
  WHERE
    ak.agent_id = agent_id_input
    AND ak.embedding IS NOT NULL
    AND 1 - (ak.embedding <=> query_embedding) > match_threshold
  ORDER BY ak.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================================================
-- 6. RPC Function: 시맨틱 로그 검색
-- =====================================================
CREATE OR REPLACE FUNCTION public.match_agent_logs(
  agent_id_input UUID,
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  agent_id UUID,
  log_type TEXT,
  title TEXT,
  content TEXT,
  summary TEXT,
  room_id UUID,
  importance INTEGER,
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.agent_id,
    al.log_type,
    al.title,
    al.content,
    al.summary,
    al.room_id,
    al.importance,
    al.created_at,
    1 - (al.embedding <=> query_embedding) AS similarity
  FROM public.agent_work_logs al
  WHERE
    al.agent_id = agent_id_input
    AND al.embedding IS NOT NULL
    AND 1 - (al.embedding <=> query_embedding) > match_threshold
  ORDER BY al.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================================================
-- 7. RLS Policies
-- =====================================================

-- agent_work_logs
ALTER TABLE public.agent_work_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent work logs are viewable by authenticated users"
  ON public.agent_work_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agent work logs are insertable by authenticated users"
  ON public.agent_work_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- agent_commits
ALTER TABLE public.agent_commits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent commits are viewable by authenticated users"
  ON public.agent_commits FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agent commits are insertable by authenticated users"
  ON public.agent_commits FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- agent_knowledge
ALTER TABLE public.agent_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent knowledge is viewable by authenticated users"
  ON public.agent_knowledge FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agent knowledge is insertable by authenticated users"
  ON public.agent_knowledge FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Agent knowledge is updatable by authenticated users"
  ON public.agent_knowledge FOR UPDATE
  TO authenticated
  USING (true);

-- agent_identity
ALTER TABLE public.agent_identity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent identity is viewable by authenticated users"
  ON public.agent_identity FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agent identity is insertable by authenticated users"
  ON public.agent_identity FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Agent identity is updatable by authenticated users"
  ON public.agent_identity FOR UPDATE
  TO authenticated
  USING (true);

-- =====================================================
-- 8. Trigger: updated_at 자동 업데이트
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_knowledge_updated_at
  BEFORE UPDATE ON public.agent_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_identity_updated_at
  BEFORE UPDATE ON public.agent_identity
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
