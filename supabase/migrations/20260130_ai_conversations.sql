-- AI Conversations Migration
-- GlowCode/Claude Code 등 AI 어시스턴트와의 대화 기록 저장

-- AI 대화 스레드 테이블
CREATE TABLE IF NOT EXISTS ai_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  -- 대화 타입: glow_code, chat, agent 등
  thread_type TEXT NOT NULL DEFAULT 'glow_code',
  -- 메타데이터 (모델, 프로젝트 경로 등)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI 대화 메시지 테이블
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES ai_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  -- 도구 호출 기록
  tool_calls JSONB,
  -- 메타데이터 (토큰 수, 모델 등)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ai_threads_user_id ON ai_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_threads_type ON ai_threads(thread_type);
CREATE INDEX IF NOT EXISTS idx_ai_threads_updated_at ON ai_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_thread_id ON ai_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON ai_messages(created_at);

-- RLS 정책
ALTER TABLE ai_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- ai_threads 정책
CREATE POLICY "Users can read own threads"
  ON ai_threads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own threads"
  ON ai_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own threads"
  ON ai_threads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own threads"
  ON ai_threads FOR DELETE
  USING (auth.uid() = user_id);

-- ai_messages 정책
CREATE POLICY "Users can read own thread messages"
  ON ai_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_threads
      WHERE id = ai_messages.thread_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own threads"
  ON ai_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_threads
      WHERE id = ai_messages.thread_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages in own threads"
  ON ai_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM ai_threads
      WHERE id = ai_messages.thread_id
      AND user_id = auth.uid()
    )
  );

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_ai_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_threads SET updated_at = NOW() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_thread_timestamp
  AFTER INSERT ON ai_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_thread_timestamp();

COMMENT ON TABLE ai_threads IS 'AI 어시스턴트와의 대화 스레드';
COMMENT ON TABLE ai_messages IS 'AI 대화 메시지';
