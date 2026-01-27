-- AI Studio 세션 저장 테이블
CREATE TABLE IF NOT EXISTS ai_studio_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID,

  -- 세션 정보
  title TEXT NOT NULL,
  type TEXT NOT NULL, -- 'audio-overview', 'video-overview', 'slides', 'report' 등
  status TEXT DEFAULT 'completed',

  -- 콘텐츠
  content TEXT,
  sources JSONB DEFAULT '[]'::jsonb, -- 사용된 소스들
  metadata JSONB DEFAULT '{}'::jsonb, -- 추가 메타데이터 (audioUrl, slides 등)

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ai_studio_sessions_user_id ON ai_studio_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_studio_sessions_company_id ON ai_studio_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_studio_sessions_created_at ON ai_studio_sessions(created_at DESC);

-- RLS 정책
ALTER TABLE ai_studio_sessions ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 세션만 접근 가능
CREATE POLICY "Users can view own sessions" ON ai_studio_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON ai_studio_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON ai_studio_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON ai_studio_sessions
  FOR DELETE USING (auth.uid() = user_id);
