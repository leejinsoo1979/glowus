-- =============================================
-- 앱 연동 시스템 (App Integrations)
-- Google Drive, Notion, Slack, GitHub 등 외부 앱 연동
-- =============================================

-- 지원하는 앱 프로바이더 목록
CREATE TABLE IF NOT EXISTS app_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('oauth2', 'api_key', 'webhook')),
  oauth_config JSONB, -- client_id, auth_url, token_url, scopes 등
  capabilities JSONB, -- 지원하는 기능들 (read, write, sync 등)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용자별 앱 연동 상태
CREATE TABLE IF NOT EXISTS user_app_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES app_providers(id),
  status TEXT DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'expired', 'error')),

  -- OAuth 토큰 정보 (암호화 필요)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- API Key 방식
  api_key TEXT,

  -- 연동 메타데이터
  account_info JSONB, -- 연결된 계정 정보 (email, name 등)
  permissions JSONB, -- 부여된 권한들
  settings JSONB, -- 사용자별 설정

  last_synced_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, provider_id)
);

-- 에이전트별 앱 연동 (에이전트가 사용할 수 있는 앱)
CREATE TABLE IF NOT EXISTS agent_app_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES deployed_agents(id) ON DELETE CASCADE,
  user_connection_id UUID NOT NULL REFERENCES user_app_connections(id) ON DELETE CASCADE,

  -- 에이전트에게 허용된 기능
  allowed_capabilities JSONB, -- ['read_files', 'search', 'create_doc' 등]

  -- 자동 동기화 설정
  auto_sync BOOLEAN DEFAULT false,
  sync_config JSONB, -- 동기화 설정 (폴더, 필터 등)

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(agent_id, user_connection_id)
);

-- 연동된 리소스 (파일, 문서, 채널 등)
CREATE TABLE IF NOT EXISTS synced_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_connection_id UUID NOT NULL REFERENCES agent_app_connections(id) ON DELETE CASCADE,

  -- 리소스 정보
  resource_type TEXT NOT NULL, -- 'file', 'folder', 'page', 'channel', 'repo'
  resource_id TEXT NOT NULL, -- 외부 서비스의 ID
  resource_name TEXT NOT NULL,
  resource_path TEXT, -- 경로 (폴더 구조)
  resource_url TEXT, -- 원본 URL

  -- 메타데이터
  mime_type TEXT,
  size_bytes BIGINT,
  metadata JSONB,

  -- 동기화 상태
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'error')),
  last_synced_at TIMESTAMPTZ,
  content_hash TEXT, -- 변경 감지용

  -- 지식베이스 연결
  knowledge_document_id TEXT, -- document_embeddings의 document_id와 연결

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(agent_connection_id, resource_id)
);

-- OAuth 상태 토큰 (CSRF 방지)
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  state_token TEXT NOT NULL UNIQUE,
  redirect_uri TEXT,
  metadata JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 앱 프로바이더 추가
INSERT INTO app_providers (id, name, description, icon_url, auth_type, oauth_config, capabilities) VALUES
('google_drive', 'Google Drive', '구글 드라이브에서 파일과 문서를 가져옵니다', '/icons/google-drive.svg', 'oauth2',
  '{"auth_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token", "scopes": ["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/drive.metadata.readonly"]}'::jsonb,
  '{"read_files": true, "list_folders": true, "search": true, "watch_changes": true}'::jsonb),

('notion', 'Notion', '노션 페이지와 데이터베이스를 연동합니다', '/icons/notion.svg', 'oauth2',
  '{"auth_url": "https://api.notion.com/v1/oauth/authorize", "token_url": "https://api.notion.com/v1/oauth/token"}'::jsonb,
  '{"read_pages": true, "read_databases": true, "search": true}'::jsonb),

('slack', 'Slack', '슬랙 채널의 메시지를 가져옵니다', '/icons/slack.svg', 'oauth2',
  '{"auth_url": "https://slack.com/oauth/v2/authorize", "token_url": "https://slack.com/api/oauth.v2.access", "scopes": ["channels:history", "channels:read", "users:read"]}'::jsonb,
  '{"read_messages": true, "list_channels": true, "send_messages": false}'::jsonb),

('github', 'GitHub', '깃허브 저장소와 이슈를 연동합니다', '/icons/github.svg', 'oauth2',
  '{"auth_url": "https://github.com/login/oauth/authorize", "token_url": "https://github.com/login/oauth/access_token", "scopes": ["repo", "read:user"]}'::jsonb,
  '{"read_repos": true, "read_issues": true, "read_code": true}'::jsonb),

('linear', 'Linear', '리니어 이슈와 프로젝트를 연동합니다', '/icons/linear.svg', 'oauth2',
  '{"auth_url": "https://linear.app/oauth/authorize", "token_url": "https://api.linear.app/oauth/token", "scopes": ["read"]}'::jsonb,
  '{"read_issues": true, "read_projects": true}'::jsonb),

('confluence', 'Confluence', '컨플루언스 문서를 가져옵니다', '/icons/confluence.svg', 'oauth2',
  '{"auth_url": "https://auth.atlassian.com/authorize", "token_url": "https://auth.atlassian.com/oauth/token", "scopes": ["read:confluence-content.all"]}'::jsonb,
  '{"read_pages": true, "search": true}'::jsonb),

('dropbox', 'Dropbox', '드롭박스 파일을 연동합니다', '/icons/dropbox.svg', 'oauth2',
  '{"auth_url": "https://www.dropbox.com/oauth2/authorize", "token_url": "https://api.dropboxapi.com/oauth2/token"}'::jsonb,
  '{"read_files": true, "list_folders": true}'::jsonb)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  oauth_config = EXCLUDED.oauth_config,
  capabilities = EXCLUDED.capabilities;

-- RLS 정책
ALTER TABLE user_app_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_app_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE synced_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- user_app_connections: 본인 연동만 접근
CREATE POLICY "Users can view own connections" ON user_app_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connections" ON user_app_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections" ON user_app_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections" ON user_app_connections
  FOR DELETE USING (auth.uid() = user_id);

-- agent_app_connections: 에이전트 소유자만 접근
CREATE POLICY "Agent owners can manage agent connections" ON agent_app_connections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM deployed_agents da
      WHERE da.id = agent_app_connections.agent_id
      AND da.owner_id = auth.uid()
    )
  );

-- synced_resources: 에이전트 소유자만 접근
CREATE POLICY "Agent owners can view synced resources" ON synced_resources
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agent_app_connections aac
      JOIN deployed_agents da ON da.id = aac.agent_id
      WHERE aac.id = synced_resources.agent_connection_id
      AND da.owner_id = auth.uid()
    )
  );

-- oauth_states: 본인만 접근
CREATE POLICY "Users can manage own oauth states" ON oauth_states
  FOR ALL USING (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_app_connections_user ON user_app_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_app_connections_provider ON user_app_connections(provider_id);
CREATE INDEX IF NOT EXISTS idx_agent_app_connections_agent ON agent_app_connections(agent_id);
CREATE INDEX IF NOT EXISTS idx_synced_resources_connection ON synced_resources(agent_connection_id);
CREATE INDEX IF NOT EXISTS idx_synced_resources_type ON synced_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_oauth_states_token ON oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- 만료된 OAuth 상태 자동 삭제 함수
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- updated_at 트리거
CREATE OR REPLACE FUNCTION update_app_connection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_app_connections_timestamp
  BEFORE UPDATE ON user_app_connections
  FOR EACH ROW EXECUTE FUNCTION update_app_connection_timestamp();

CREATE TRIGGER update_synced_resources_timestamp
  BEFORE UPDATE ON synced_resources
  FOR EACH ROW EXECUTE FUNCTION update_app_connection_timestamp();
