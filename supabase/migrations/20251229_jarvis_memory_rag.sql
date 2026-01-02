-- =====================================================
-- JARVIS Long-term Memory System with RAG
-- Per-user conversation memory with vector search
--
-- NOTE: 기존 agent_memories 테이블을 재사용
-- 새로 추가: agent_user_profiles, agent_episodes
-- =====================================================

-- Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- 1. Agent User Profiles (에이전트가 학습한 사용자 정보)
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  user_id UUID NOT NULL,

  -- 기본 정보
  display_name TEXT,
  avatar_url TEXT,

  -- 학습된 선호도
  preferences JSONB DEFAULT '{
    "language": "ko",
    "communication_style": "casual",
    "response_length": "medium",
    "emoji_usage": true
  }'::jsonb,

  -- 업무 패턴
  work_patterns JSONB DEFAULT '{
    "active_hours": "09:00-18:00",
    "timezone": "Asia/Seoul",
    "response_urgency": "normal"
  }'::jsonb,

  -- 에이전트가 기억해야 할 중요 사실들
  important_facts TEXT[] DEFAULT '{}',

  -- 관계 및 권한
  relationship TEXT DEFAULT 'user' CHECK (relationship IN ('owner', 'admin', 'team_member', 'client', 'user')),
  trust_level FLOAT DEFAULT 0.5 CHECK (trust_level >= 0 AND trust_level <= 1),

  -- 통계
  total_conversations INT DEFAULT 0,
  last_interaction_at TIMESTAMPTZ,

  -- 시간
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(agent_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_user_profiles_agent ON agent_user_profiles(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_user_profiles_user ON agent_user_profiles(user_id);

-- =====================================================
-- 2. Agent Episodes (중요 이벤트/에피소드 메모리)
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,

  -- 이벤트 정보
  title TEXT NOT NULL,
  summary TEXT,
  detailed_content TEXT,

  -- 관련된 사람들
  participants UUID[] DEFAULT '{}',

  -- 벡터 임베딩
  embedding vector(1536),

  -- 메타데이터
  event_type TEXT DEFAULT 'general' CHECK (event_type IN (
    'project_start', 'project_complete', 'milestone',
    'decision', 'problem_solved', 'learning',
    'user_feedback', 'general'
  )),
  importance FLOAT DEFAULT 0.7 CHECK (importance >= 0 AND importance <= 1),
  tags TEXT[] DEFAULT '{}',

  -- 관련 데이터
  related_data JSONB DEFAULT '{}',

  -- 시간
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_episodes_agent ON agent_episodes(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_episodes_type ON agent_episodes(event_type);
CREATE INDEX IF NOT EXISTS idx_agent_episodes_occurred ON agent_episodes(occurred_at DESC);

-- =====================================================
-- 3. 에피소드 검색 함수
-- =====================================================
CREATE OR REPLACE FUNCTION search_agent_episodes(
  p_query_embedding vector(1536),
  p_agent_id UUID,
  p_match_count INT DEFAULT 5,
  p_match_threshold FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  summary TEXT,
  event_type TEXT,
  importance FLOAT,
  participants UUID[],
  similarity FLOAT,
  occurred_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.summary,
    e.event_type,
    e.importance,
    e.participants,
    1 - (e.embedding <=> p_query_embedding) AS similarity,
    e.occurred_at
  FROM agent_episodes e
  WHERE e.agent_id = p_agent_id
    AND e.embedding IS NOT NULL
    AND 1 - (e.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY e.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- =====================================================
-- 4. 메모리 통계 함수
-- =====================================================
CREATE OR REPLACE FUNCTION get_jarvis_memory_stats(p_agent_id UUID)
RETURNS TABLE (
  total_user_profiles BIGINT,
  total_episodes BIGINT,
  users_list JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM agent_user_profiles WHERE agent_id = p_agent_id),
    (SELECT COUNT(*) FROM agent_episodes WHERE agent_id = p_agent_id),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'user_id', user_id,
      'display_name', display_name,
      'relationship', relationship,
      'total_conversations', total_conversations
    )), '[]'::jsonb)
     FROM agent_user_profiles
     WHERE agent_id = p_agent_id);
END;
$$;

-- =====================================================
-- 5. 프로필 대화 카운트 업데이트 트리거
-- =====================================================
CREATE OR REPLACE FUNCTION increment_user_conversation_count()
RETURNS TRIGGER AS $$
BEGIN
  -- agent_memories 테이블에 새 메시지가 추가될 때
  -- relationship_id를 user_id로 사용하여 프로필 업데이트
  IF NEW.relationship_id IS NOT NULL AND NEW.memory_type = 'private' THEN
    INSERT INTO agent_user_profiles (agent_id, user_id, total_conversations, last_interaction_at)
    VALUES (NEW.agent_id, NEW.relationship_id, 1, NOW())
    ON CONFLICT (agent_id, user_id)
    DO UPDATE SET
      total_conversations = agent_user_profiles.total_conversations + 1,
      last_interaction_at = NOW(),
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (기존 agent_memories 테이블에)
DROP TRIGGER IF EXISTS trigger_increment_conversation ON agent_memories;
CREATE TRIGGER trigger_increment_conversation
  AFTER INSERT ON agent_memories
  FOR EACH ROW
  EXECUTE FUNCTION increment_user_conversation_count();

-- =====================================================
-- 6. RLS 정책 (보안)
-- =====================================================
ALTER TABLE agent_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_episodes ENABLE ROW LEVEL SECURITY;

-- 에이전트 소유자만 프로필 접근 가능
DROP POLICY IF EXISTS "Agent owners can access user profiles" ON agent_user_profiles;
CREATE POLICY "Agent owners can access user profiles"
  ON agent_user_profiles
  FOR ALL
  USING (
    agent_id IN (
      SELECT id FROM deployed_agents
      WHERE owner_id = auth.uid()
    )
  );

-- 에이전트 소유자만 에피소드 접근 가능
DROP POLICY IF EXISTS "Agent owners can access episodes" ON agent_episodes;
CREATE POLICY "Agent owners can access episodes"
  ON agent_episodes
  FOR ALL
  USING (
    agent_id IN (
      SELECT id FROM deployed_agents
      WHERE owner_id = auth.uid()
    )
  );

-- =====================================================
-- 완료 메시지
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ JARVIS Memory System tables created successfully!';
  RAISE NOTICE '   - agent_user_profiles: Per-user learned preferences';
  RAISE NOTICE '   - agent_episodes: Important events/milestones';
  RAISE NOTICE '   - search_agent_episodes: Vector search for episodes';
  RAISE NOTICE '   - Trigger for conversation counting active';
END $$;
