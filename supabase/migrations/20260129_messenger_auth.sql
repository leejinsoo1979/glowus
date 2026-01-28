-- Messenger Authentication & Session Management
-- 텔레그램/왓츠앱과 GlowUS 사용자 연동

-- 메신저 연결 테이블
CREATE TABLE IF NOT EXISTS messenger_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 메신저 정보
  platform TEXT NOT NULL CHECK (platform IN ('telegram', 'whatsapp', 'slack', 'discord')),
  external_id TEXT NOT NULL, -- Telegram chat_id 또는 WhatsApp phone number
  username TEXT, -- @username (선택)
  display_name TEXT,

  -- 인증 정보
  auth_token TEXT, -- 일회용 인증 토큰
  auth_token_expires_at TIMESTAMPTZ,
  verified BOOLEAN DEFAULT FALSE,

  -- 설정
  notifications_enabled BOOLEAN DEFAULT TRUE,
  default_agent_id UUID REFERENCES deployed_agents(id) ON DELETE SET NULL,

  -- 메타데이터
  last_message_at TIMESTAMPTZ,
  total_messages INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 유니크 제약: 플랫폼 + 외부 ID는 유일
  UNIQUE(platform, external_id)
);

-- 메신저 대화 세션 테이블
CREATE TABLE IF NOT EXISTS messenger_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES messenger_connections(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES deployed_agents(id) ON DELETE CASCADE,

  -- 세션 정보
  title TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),

  -- 대화 컨텍스트
  conversation_history JSONB DEFAULT '[]'::jsonb, -- [{role, content, timestamp}]
  context TEXT, -- 현재 작업 컨텍스트

  -- 통계
  message_count INTEGER DEFAULT 0,
  tool_calls INTEGER DEFAULT 0,

  -- 타임스탬프
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 메신저 메시지 로그 (선택적)
CREATE TABLE IF NOT EXISTS messenger_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES messenger_sessions(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES messenger_connections(id) ON DELETE CASCADE,

  -- 메시지 정보
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- text, image, file, etc.

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_messenger_connections_user ON messenger_connections(user_id);
CREATE INDEX idx_messenger_connections_platform_external ON messenger_connections(platform, external_id);
CREATE INDEX idx_messenger_connections_verified ON messenger_connections(verified) WHERE verified = TRUE;

CREATE INDEX idx_messenger_sessions_connection ON messenger_sessions(connection_id);
CREATE INDEX idx_messenger_sessions_agent ON messenger_sessions(agent_id);
CREATE INDEX idx_messenger_sessions_status ON messenger_sessions(status);
CREATE INDEX idx_messenger_sessions_last_activity ON messenger_sessions(last_activity_at DESC);

CREATE INDEX idx_messenger_messages_session ON messenger_messages(session_id);
CREATE INDEX idx_messenger_messages_connection ON messenger_messages(connection_id);
CREATE INDEX idx_messenger_messages_created ON messenger_messages(created_at DESC);

-- RLS 정책
ALTER TABLE messenger_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_messages ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 연결만 볼 수 있음
CREATE POLICY "Users can view their own messenger connections"
  ON messenger_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own messenger connections"
  ON messenger_connections FOR UPDATE
  USING (auth.uid() = user_id);

-- 사용자는 자신의 세션만 볼 수 있음
CREATE POLICY "Users can view their own messenger sessions"
  ON messenger_sessions FOR SELECT
  USING (
    connection_id IN (
      SELECT id FROM messenger_connections WHERE user_id = auth.uid()
    )
  );

-- 사용자는 자신의 메시지만 볼 수 있음
CREATE POLICY "Users can view their own messenger messages"
  ON messenger_messages FOR SELECT
  USING (
    connection_id IN (
      SELECT id FROM messenger_connections WHERE user_id = auth.uid()
    )
  );

-- Admin/Service role은 모든 접근 가능 (for webhooks)
CREATE POLICY "Service role has full access to messenger_connections"
  ON messenger_connections FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to messenger_sessions"
  ON messenger_sessions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to messenger_messages"
  ON messenger_messages FOR ALL
  USING (auth.role() = 'service_role');

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_messenger_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messenger_connections_updated_at
  BEFORE UPDATE ON messenger_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_messenger_updated_at();

CREATE TRIGGER messenger_sessions_updated_at
  BEFORE UPDATE ON messenger_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_messenger_updated_at();

-- 함수: 인증 토큰 생성
CREATE OR REPLACE FUNCTION generate_messenger_auth_token(
  p_platform TEXT,
  p_external_id TEXT,
  p_username TEXT DEFAULT NULL
)
RETURNS TABLE (
  auth_token TEXT,
  auth_url TEXT
) AS $$
DECLARE
  v_token TEXT;
  v_expires_at TIMESTAMPTZ;
  v_app_url TEXT;
BEGIN
  -- 랜덤 토큰 생성 (32자)
  v_token := encode(gen_random_bytes(24), 'base64');
  v_token := replace(replace(v_token, '+', ''), '/', '');
  v_expires_at := NOW() + INTERVAL '1 hour';

  -- 기존 연결 확인
  INSERT INTO messenger_connections (
    user_id,
    platform,
    external_id,
    username,
    auth_token,
    auth_token_expires_at,
    verified
  ) VALUES (
    NULL, -- 아직 연결 안됨
    p_platform,
    p_external_id,
    p_username,
    v_token,
    v_expires_at,
    FALSE
  )
  ON CONFLICT (platform, external_id) DO UPDATE
  SET
    auth_token = v_token,
    auth_token_expires_at = v_expires_at,
    verified = FALSE;

  -- 인증 URL 생성
  v_app_url := current_setting('app.settings.app_url', TRUE);
  IF v_app_url IS NULL THEN
    v_app_url := 'http://localhost:3000';
  END IF;

  RETURN QUERY SELECT
    v_token,
    v_app_url || '/auth-group/messenger-auth?token=' || v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE messenger_connections IS '메신저 플랫폼과 GlowUS 사용자 연동';
COMMENT ON TABLE messenger_sessions IS '메신저 대화 세션 관리';
COMMENT ON TABLE messenger_messages IS '메신저 메시지 로그 (선택적)';
