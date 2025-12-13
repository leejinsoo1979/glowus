-- Agent API Connections Schema
-- 에이전트가 외부 API를 연결하여 정보를 수집할 수 있도록 하는 스키마

-- API 연결 테이블
CREATE TABLE IF NOT EXISTS agent_api_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES deployed_agents(id) ON DELETE CASCADE,

  -- 기본 정보
  name TEXT NOT NULL,
  description TEXT,
  provider_type TEXT NOT NULL DEFAULT 'custom', -- 'preset' | 'custom' | 'openapi'

  -- API 설정
  base_url TEXT NOT NULL,

  -- 인증
  auth_type TEXT NOT NULL DEFAULT 'none', -- 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth2'
  auth_config JSONB DEFAULT '{}',
  -- auth_config 예시:
  -- api_key: { "header_name": "X-API-Key", "key": "encrypted_key" }
  -- bearer: { "token": "encrypted_token" }
  -- basic: { "username": "user", "password": "encrypted_pass" }
  -- oauth2: { "client_id": "...", "client_secret": "...", "token_url": "..." }

  -- 엔드포인트 정의
  endpoints JSONB DEFAULT '[]',
  -- endpoints 예시:
  -- [
  --   {
  --     "id": "search",
  --     "name": "검색",
  --     "method": "GET",
  --     "path": "/search",
  --     "description": "데이터 검색",
  --     "parameters": [
  --       { "name": "query", "type": "string", "required": true, "description": "검색어" },
  --       { "name": "limit", "type": "number", "required": false, "default": 10 }
  --     ],
  --     "response_format": "json"
  --   }
  -- ]

  -- 헤더 설정
  default_headers JSONB DEFAULT '{}',

  -- 상태
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  last_error TEXT,

  -- 메타데이터
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_api_connections_agent_id ON agent_api_connections(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_api_connections_provider_type ON agent_api_connections(provider_type);
CREATE INDEX IF NOT EXISTS idx_agent_api_connections_is_active ON agent_api_connections(is_active);

-- Updated at 트리거
CREATE OR REPLACE FUNCTION update_agent_api_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_agent_api_connections_updated_at ON agent_api_connections;
CREATE TRIGGER trigger_agent_api_connections_updated_at
  BEFORE UPDATE ON agent_api_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_api_connections_updated_at();

-- API 호출 로그 테이블 (디버깅 및 모니터링용)
CREATE TABLE IF NOT EXISTS agent_api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES agent_api_connections(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES deployed_agents(id) ON DELETE CASCADE,

  -- 요청 정보
  endpoint_id TEXT,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  request_headers JSONB,
  request_body JSONB,

  -- 응답 정보
  status_code INTEGER,
  response_headers JSONB,
  response_body JSONB,
  response_time_ms INTEGER,

  -- 에러 정보
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_api_logs_connection_id ON agent_api_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_agent_api_logs_agent_id ON agent_api_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_api_logs_created_at ON agent_api_logs(created_at);

-- RLS 정책
ALTER TABLE agent_api_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_api_logs ENABLE ROW LEVEL SECURITY;

-- API 연결 정책
CREATE POLICY "Users can view their agent's API connections"
  ON agent_api_connections FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM deployed_agents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create API connections for their agents"
  ON agent_api_connections FOR INSERT
  WITH CHECK (
    agent_id IN (
      SELECT id FROM deployed_agents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their agent's API connections"
  ON agent_api_connections FOR UPDATE
  USING (
    agent_id IN (
      SELECT id FROM deployed_agents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their agent's API connections"
  ON agent_api_connections FOR DELETE
  USING (
    agent_id IN (
      SELECT id FROM deployed_agents WHERE user_id = auth.uid()
    )
  );

-- API 로그 정책
CREATE POLICY "Users can view their agent's API logs"
  ON agent_api_logs FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM deployed_agents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert API logs"
  ON agent_api_logs FOR INSERT
  WITH CHECK (true);

-- 공공 API 프리셋 테이블
CREATE TABLE IF NOT EXISTS public_api_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'government' | 'startup' | 'finance' | 'weather' | 'news' | 'social'
  logo_url TEXT,

  -- API 설정 템플릿
  base_url TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'api_key',
  auth_config_template JSONB DEFAULT '{}',
  endpoints JSONB NOT NULL DEFAULT '[]',
  default_headers JSONB DEFAULT '{}',

  -- 도움말
  setup_guide TEXT,
  api_key_url TEXT, -- API 키 발급 URL
  documentation_url TEXT,

  -- 상태
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 공공 API 프리셋 데이터 삽입
INSERT INTO public_api_presets (id, name, description, category, base_url, auth_type, auth_config_template, endpoints, setup_guide, api_key_url, documentation_url) VALUES
-- 공공데이터포털
('data_go_kr', '공공데이터포털', '대한민국 정부 공공데이터 API', 'government', 'https://apis.data.go.kr', 'api_key',
 '{"param_name": "serviceKey", "param_type": "query"}',
 '[
   {"id": "search", "name": "데이터 검색", "method": "GET", "path": "/search", "description": "공공데이터 검색", "parameters": [{"name": "query", "type": "string", "required": true}]}
 ]',
 '1. 공공데이터포털 회원가입\n2. 원하는 API 활용신청\n3. 마이페이지에서 API 키 복사',
 'https://www.data.go.kr/index.do',
 'https://www.data.go.kr/dataset/fileDownload.do?atchFileId=FILE_000000001'
),

-- K-Startup
('k_startup', 'K-Startup', '창업진흥원 스타트업 정보 API', 'startup', 'https://www.k-startup.go.kr/api', 'api_key',
 '{"header_name": "Authorization", "prefix": "Bearer"}',
 '[
   {"id": "startup_list", "name": "스타트업 목록", "method": "GET", "path": "/startups", "description": "등록된 스타트업 목록 조회"},
   {"id": "support_programs", "name": "지원사업 목록", "method": "GET", "path": "/programs", "description": "정부 지원사업 목록 조회"},
   {"id": "investors", "name": "투자자 목록", "method": "GET", "path": "/investors", "description": "투자자 정보 조회"}
 ]',
 '1. K-Startup 회원가입\n2. API 서비스 신청\n3. 승인 후 API 키 발급',
 'https://www.k-startup.go.kr',
 'https://www.k-startup.go.kr/api-docs'
),

-- 정부24
('gov24', '정부24', '정부24 민원 및 행정정보 API', 'government', 'https://api.gov24.go.kr', 'api_key',
 '{"header_name": "X-API-Key"}',
 '[
   {"id": "services", "name": "민원서비스 조회", "method": "GET", "path": "/services", "description": "민원서비스 목록 조회"},
   {"id": "documents", "name": "행정문서 조회", "method": "GET", "path": "/documents", "description": "행정문서 정보 조회"}
 ]',
 '1. 정부24 회원가입\n2. 오픈API 신청\n3. 승인 후 인증키 발급',
 'https://www.gov.kr/portal/openApi',
 'https://www.gov.kr/portal/openApi/apiInfo'
),

-- 기상청
('kma_weather', '기상청 날씨', '기상청 날씨 정보 API', 'weather', 'http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0', 'api_key',
 '{"param_name": "serviceKey", "param_type": "query"}',
 '[
   {"id": "forecast", "name": "단기예보", "method": "GET", "path": "/getVilageFcst", "description": "단기 날씨 예보 조회", "parameters": [{"name": "base_date", "type": "string", "required": true}, {"name": "base_time", "type": "string", "required": true}, {"name": "nx", "type": "number", "required": true}, {"name": "ny", "type": "number", "required": true}]},
   {"id": "ultra_forecast", "name": "초단기예보", "method": "GET", "path": "/getUltraSrtFcst", "description": "초단기 날씨 예보 조회"}
 ]',
 '1. 공공데이터포털에서 기상청 API 신청\n2. 활용신청 승인 대기\n3. API 키 발급',
 'https://www.data.go.kr/data/15084084/openapi.do',
 'https://www.data.go.kr/data/15084084/openapi.do'
),

-- 금융위원회 기업정보
('fss_corp', '금융감독원 기업정보', '금융감독원 기업공시 API', 'finance', 'https://opendart.fss.or.kr/api', 'api_key',
 '{"param_name": "crtfc_key", "param_type": "query"}',
 '[
   {"id": "company_info", "name": "기업개황", "method": "GET", "path": "/company.json", "description": "기업 기본정보 조회", "parameters": [{"name": "corp_code", "type": "string", "required": true}]},
   {"id": "disclosure", "name": "공시검색", "method": "GET", "path": "/list.json", "description": "공시 목록 검색"}
 ]',
 '1. OpenDART 회원가입\n2. API 인증키 신청\n3. 인증키 발급 (즉시)',
 'https://opendart.fss.or.kr/',
 'https://opendart.fss.or.kr/guide/main.do'
),

-- 네이버 검색
('naver_search', '네이버 검색', '네이버 검색 API', 'search', 'https://openapi.naver.com/v1/search', 'api_key',
 '{"header_name": "X-Naver-Client-Id", "header_name_secret": "X-Naver-Client-Secret"}',
 '[
   {"id": "news", "name": "뉴스 검색", "method": "GET", "path": "/news.json", "description": "네이버 뉴스 검색", "parameters": [{"name": "query", "type": "string", "required": true}, {"name": "display", "type": "number", "default": 10}]},
   {"id": "blog", "name": "블로그 검색", "method": "GET", "path": "/blog.json", "description": "네이버 블로그 검색"},
   {"id": "webkr", "name": "웹문서 검색", "method": "GET", "path": "/webkr.json", "description": "웹문서 검색"}
 ]',
 '1. 네이버 개발자센터 가입\n2. 애플리케이션 등록\n3. Client ID/Secret 발급',
 'https://developers.naver.com/apps/#/register',
 'https://developers.naver.com/docs/serviceapi/search/news/news.md'
),

-- 카카오 검색
('kakao_search', '카카오 검색', '카카오 검색 API', 'search', 'https://dapi.kakao.com/v2/search', 'api_key',
 '{"header_name": "Authorization", "prefix": "KakaoAK "}',
 '[
   {"id": "web", "name": "웹문서 검색", "method": "GET", "path": "/web", "description": "카카오 웹문서 검색", "parameters": [{"name": "query", "type": "string", "required": true}]},
   {"id": "blog", "name": "블로그 검색", "method": "GET", "path": "/blog", "description": "블로그 검색"},
   {"id": "cafe", "name": "카페 검색", "method": "GET", "path": "/cafe", "description": "카페글 검색"}
 ]',
 '1. 카카오 개발자 사이트 가입\n2. 애플리케이션 등록\n3. REST API 키 발급',
 'https://developers.kakao.com/console/app',
 'https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  endpoints = EXCLUDED.endpoints,
  setup_guide = EXCLUDED.setup_guide;

-- 프리셋 조회 함수
CREATE OR REPLACE FUNCTION get_public_api_presets(p_category TEXT DEFAULT NULL)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  description TEXT,
  category TEXT,
  logo_url TEXT,
  base_url TEXT,
  auth_type TEXT,
  endpoints JSONB,
  setup_guide TEXT,
  api_key_url TEXT,
  documentation_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.description,
    p.category,
    p.logo_url,
    p.base_url,
    p.auth_type,
    p.endpoints,
    p.setup_guide,
    p.api_key_url,
    p.documentation_url
  FROM public_api_presets p
  WHERE p.is_active = true
    AND (p_category IS NULL OR p.category = p_category)
  ORDER BY p.category, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
