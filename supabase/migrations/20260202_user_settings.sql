-- User Settings 테이블 (Jarvis 페르소나 등 사용자별 설정)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Jarvis 페르소나 설정
  jarvis_persona JSONB DEFAULT '{
    "name": "Jarvis",
    "userTitle": "사장님",
    "personality": "친절하고 전문적이며, 약간의 유머 감각을 갖춘",
    "language": "한국어",
    "greeting": "{userTitle}, 안녕하세요! 무엇을 도와드릴까요?",
    "customInstructions": ""
  }'::jsonb,

  -- 추가 설정 (확장용)
  preferences JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 설정만 조회/수정 가능
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON user_settings FOR DELETE
  USING (auth.uid() = user_id);
