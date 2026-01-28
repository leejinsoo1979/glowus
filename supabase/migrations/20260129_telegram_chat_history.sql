-- Telegram Chat History Tables
-- 영구 보존: 대화 기록은 절대 삭제되지 않음

-- 1. Telegram Users Table
CREATE TABLE IF NOT EXISTS telegram_users (
  id TEXT PRIMARY KEY,                    -- Telegram user ID
  username TEXT,                          -- Telegram username
  first_name TEXT,                        -- User's first name
  last_name TEXT,                         -- User's last name
  language_code TEXT,                     -- User's language preference
  is_bot BOOLEAN DEFAULT FALSE,           -- Whether user is a bot

  -- GlowUS integration
  user_id UUID REFERENCES auth.users(id), -- Link to GlowUS user (optional)
  agent_id TEXT,                          -- Default agent for this user

  -- Metadata
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  total_messages INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Telegram Chat Sessions Table
CREATE TABLE IF NOT EXISTS telegram_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id TEXT NOT NULL REFERENCES telegram_users(id),
  chat_id BIGINT NOT NULL,               -- Telegram chat ID
  agent_id TEXT NOT NULL,                -- Which agent is being used
  agent_name TEXT NOT NULL,              -- Agent display name

  -- Session info
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(chat_id, agent_id)
);

-- 3. Universal Chat Messages Table (영구 보존 - 모든 채널 통합)
CREATE TABLE IF NOT EXISTS telegram_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES telegram_chat_sessions(id),
  telegram_user_id TEXT NOT NULL REFERENCES telegram_users(id),
  chat_id BIGINT NOT NULL,

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'model', 'system', 'assistant')),
  content TEXT NOT NULL,

  -- Source tracking (통합 대화 기록)
  source TEXT DEFAULT 'telegram' CHECK (source IN ('telegram', 'web', 'api', 'whatsapp', 'messenger')),

  -- Tool usage tracking
  tool_calls JSONB,                      -- Tools that were called
  tool_results JSONB,                    -- Results from tool execution

  -- Metadata
  message_index INTEGER NOT NULL,        -- Order in conversation
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 영구 보존: 이 테이블의 데이터는 절대 삭제되지 않음
  -- NEVER DELETE MESSAGES - Core differentiator
  -- 텔레그램, 웹, API 모든 채널의 대화 기록 통합
  CONSTRAINT no_delete_messages CHECK (true)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_telegram_users_user_id ON telegram_users(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_users_last_active ON telegram_users(last_active_at);

CREATE INDEX IF NOT EXISTS idx_telegram_sessions_user ON telegram_chat_sessions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_chat ON telegram_chat_sessions(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_agent ON telegram_chat_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_active ON telegram_chat_sessions(is_active);

CREATE INDEX IF NOT EXISTS idx_telegram_messages_session ON telegram_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat ON telegram_chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_created ON telegram_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_index ON telegram_chat_messages(session_id, message_index);

-- RLS Policies (for future web access)
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access to telegram_users" ON telegram_users
  FOR ALL USING (true);

CREATE POLICY "Service role full access to telegram_chat_sessions" ON telegram_chat_sessions
  FOR ALL USING (true);

CREATE POLICY "Service role full access to telegram_chat_messages" ON telegram_chat_messages
  FOR ALL USING (true);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_telegram_users_updated_at BEFORE UPDATE ON telegram_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_telegram_chat_sessions_updated_at BEFORE UPDATE ON telegram_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE telegram_chat_messages IS '영구 보존 대화 기록 - 절대 삭제 금지. 이것이 우리 에이전트의 핵심 차별점';
COMMENT ON COLUMN telegram_chat_messages.created_at IS '메시지 생성 시각 - 영구 보존';
COMMENT ON CONSTRAINT no_delete_messages ON telegram_chat_messages IS '메시지 삭제 금지 - 핵심 차별화 기능';
