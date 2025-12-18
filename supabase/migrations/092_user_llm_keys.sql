-- =====================================================
-- User LLM API Keys Management
-- 사용자별 LLM 제공자 API 키 관리
-- =====================================================

-- 사용자 LLM API 키 테이블
CREATE TABLE IF NOT EXISTS public.user_llm_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'openai', 'anthropic', 'google', 'xai', 'mistral', 'groq'
    api_key TEXT NOT NULL, -- 암호화된 API 키
    display_name TEXT, -- 사용자 지정 이름 (예: "개인 OpenAI", "회사 Claude")
    is_default BOOLEAN DEFAULT FALSE, -- 해당 제공자의 기본 키 여부
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 같은 제공자에 여러 키 등록 가능 (개인용, 회사용 등)
    UNIQUE(user_id, provider, display_name)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_llm_keys_user_id ON public.user_llm_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_llm_keys_provider ON public.user_llm_keys(provider);
CREATE INDEX IF NOT EXISTS idx_user_llm_keys_is_default ON public.user_llm_keys(user_id, provider, is_default) WHERE is_default = TRUE;

-- RLS 활성화
ALTER TABLE public.user_llm_keys ENABLE ROW LEVEL SECURITY;

-- 정책: 본인의 키만 조회 가능
CREATE POLICY "user_llm_keys_select" ON public.user_llm_keys
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- 정책: 본인만 키 추가 가능
CREATE POLICY "user_llm_keys_insert" ON public.user_llm_keys
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- 정책: 본인만 키 수정 가능
CREATE POLICY "user_llm_keys_update" ON public.user_llm_keys
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

-- 정책: 본인만 키 삭제 가능
CREATE POLICY "user_llm_keys_delete" ON public.user_llm_keys
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_user_llm_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_llm_keys_updated_at ON public.user_llm_keys;
CREATE TRIGGER trigger_user_llm_keys_updated_at
    BEFORE UPDATE ON public.user_llm_keys
    FOR EACH ROW EXECUTE FUNCTION update_user_llm_keys_updated_at();

-- =====================================================
-- 에이전트 API 도구 연결 (기존 테이블 확장)
-- =====================================================

-- agent_api_connections에 tool_type 컬럼 추가 (없으면)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'agent_api_connections'
                   AND column_name = 'tool_type') THEN
        ALTER TABLE public.agent_api_connections
        ADD COLUMN tool_type TEXT DEFAULT 'custom';
        -- 'search', 'weather', 'calendar', 'email', 'database', 'custom'
    END IF;
END
$$;

-- 에이전트가 사용 가능한 도구 카탈로그
CREATE TABLE IF NOT EXISTS public.api_tool_catalog (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 'search', 'productivity', 'data', 'communication', 'ai'
    provider TEXT, -- 'google', 'serper', 'tavily', 'notion', 'slack'
    auth_type TEXT NOT NULL DEFAULT 'api_key', -- 'api_key', 'oauth2', 'bearer'
    base_url TEXT,
    documentation_url TEXT,
    icon_url TEXT,
    required_fields JSONB DEFAULT '[]', -- 필요한 설정 필드
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 도구 카탈로그 추가
INSERT INTO public.api_tool_catalog (id, name, description, category, provider, auth_type, base_url, documentation_url, required_fields) VALUES
-- 검색
('serper', 'Serper (Google Search)', 'Google 검색 결과를 API로 가져옵니다', 'search', 'serper', 'api_key', 'https://google.serper.dev', 'https://serper.dev/docs', '["api_key"]'),
('tavily', 'Tavily Search', 'AI 최적화 검색 엔진', 'search', 'tavily', 'api_key', 'https://api.tavily.com', 'https://docs.tavily.com', '["api_key"]'),
('brave_search', 'Brave Search', 'Brave 검색 API', 'search', 'brave', 'api_key', 'https://api.search.brave.com', 'https://brave.com/search/api/', '["api_key"]'),

-- 날씨
('openweather', 'OpenWeather', '날씨 정보 API', 'data', 'openweather', 'api_key', 'https://api.openweathermap.org', 'https://openweathermap.org/api', '["api_key"]'),

-- 생산성
('notion', 'Notion', 'Notion 페이지 및 데이터베이스 연동', 'productivity', 'notion', 'bearer', 'https://api.notion.com', 'https://developers.notion.com', '["api_key"]'),
('airtable', 'Airtable', 'Airtable 데이터베이스 연동', 'productivity', 'airtable', 'bearer', 'https://api.airtable.com', 'https://airtable.com/developers/web/api', '["api_key", "base_id"]'),

-- 커뮤니케이션
('slack_webhook', 'Slack Webhook', 'Slack 채널에 메시지 전송', 'communication', 'slack', 'webhook', '', 'https://api.slack.com/messaging/webhooks', '["webhook_url"]'),
('discord_webhook', 'Discord Webhook', 'Discord 채널에 메시지 전송', 'communication', 'discord', 'webhook', '', 'https://discord.com/developers/docs/resources/webhook', '["webhook_url"]'),

-- AI 서비스
('replicate', 'Replicate', '다양한 AI 모델 실행', 'ai', 'replicate', 'bearer', 'https://api.replicate.com', 'https://replicate.com/docs', '["api_key"]'),
('huggingface', 'Hugging Face', 'Hugging Face 모델 추론', 'ai', 'huggingface', 'bearer', 'https://api-inference.huggingface.co', 'https://huggingface.co/docs/api-inference', '["api_key"]')

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    base_url = EXCLUDED.base_url,
    documentation_url = EXCLUDED.documentation_url,
    required_fields = EXCLUDED.required_fields;
