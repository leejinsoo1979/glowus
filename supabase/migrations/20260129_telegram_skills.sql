-- Telegram 스킬 저장소
-- Rachel이 Claude Code로 개발한 스킬을 저장하고 재사용

CREATE TABLE IF NOT EXISTS telegram_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  keywords TEXT[] NOT NULL,
  prompt_template TEXT NOT NULL,
  skill_type TEXT DEFAULT 'claude_code', -- 'claude_code', 'applescript', 'api'
  example_input TEXT, -- 예시 입력
  example_output TEXT, -- 예시 출력
  created_by TEXT, -- telegram user id
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 키워드 검색용 인덱스
CREATE INDEX IF NOT EXISTS idx_telegram_skills_keywords ON telegram_skills USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_telegram_skills_name ON telegram_skills(name);

-- RLS 정책
ALTER TABLE telegram_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read skills" ON telegram_skills
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert skills" ON telegram_skills
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update skills" ON telegram_skills
  FOR UPDATE USING (true);

-- 스킬 사용 로그
CREATE TABLE IF NOT EXISTS telegram_skill_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID REFERENCES telegram_skills(id),
  telegram_user_id TEXT,
  chat_id BIGINT,
  input_text TEXT,
  output_text TEXT,
  success BOOLEAN DEFAULT true,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_skill_logs_skill ON telegram_skill_logs(skill_id);

ALTER TABLE telegram_skill_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read skill logs" ON telegram_skill_logs
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert skill logs" ON telegram_skill_logs
  FOR INSERT WITH CHECK (true);
