-- Jarvis Long-term Memory System
-- 팩트와 추론을 구분하는 메모리 시스템

-- Jarvis 메모리 테이블
CREATE TABLE IF NOT EXISTS jarvis_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 메모리 타입: FACT(사실), PREFERENCE(선호도), SUMMARY(AI요약)
  memory_type TEXT NOT NULL CHECK (memory_type IN ('FACT', 'PREFERENCE', 'SUMMARY')),

  -- 공통 필드
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',

  -- FACT 전용: 원본 출처 정보
  source_type TEXT CHECK (source_type IN ('email', 'meeting', 'file', 'chat', 'task', 'calendar', 'manual', NULL)),
  source_id TEXT,           -- 원본 문서/레코드 ID
  source_timestamp TIMESTAMPTZ,  -- 원본 생성 시점

  -- PREFERENCE 전용
  pref_category TEXT CHECK (pref_category IN ('work_style', 'tech_stack', 'communication', 'schedule', 'project', 'other', NULL)),
  pref_key TEXT,            -- 예: "preferred_framework"
  pref_value TEXT,          -- 예: "React"
  confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  learned_from TEXT,        -- 어떻게 알게 됐는지

  -- SUMMARY 전용
  based_on UUID[],          -- 참조한 FACT ID들
  generated_by TEXT,        -- 생성한 모델명

  -- 메타
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_jarvis_memories_user ON jarvis_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_jarvis_memories_type ON jarvis_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_jarvis_memories_tags ON jarvis_memories USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_jarvis_memories_pref ON jarvis_memories(pref_category, pref_key) WHERE memory_type = 'PREFERENCE';
CREATE INDEX IF NOT EXISTS idx_jarvis_memories_source ON jarvis_memories(source_type, source_id) WHERE memory_type = 'FACT';

-- 전문 검색 (한국어)
ALTER TABLE jarvis_memories ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;
CREATE INDEX IF NOT EXISTS idx_jarvis_memories_fts ON jarvis_memories USING GIN(content_tsv);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_jarvis_memories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS jarvis_memories_updated_at ON jarvis_memories;
CREATE TRIGGER jarvis_memories_updated_at
  BEFORE UPDATE ON jarvis_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_jarvis_memories_updated_at();

-- RLS 정책
ALTER TABLE jarvis_memories ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 메모리만 접근 가능
CREATE POLICY "Users can view own memories" ON jarvis_memories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memories" ON jarvis_memories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memories" ON jarvis_memories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories" ON jarvis_memories
  FOR DELETE USING (auth.uid() = user_id);

-- 서비스 롤은 모든 접근 가능 (MCP 서버용)
CREATE POLICY "Service role full access" ON jarvis_memories
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
