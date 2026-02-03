-- API 사용량 로그 테이블
-- GlowUS 내부에서 모든 LLM API 호출 추적

CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 제공자 및 모델 정보
  provider TEXT NOT NULL, -- openai, google, xai, mistral, groq
  model TEXT NOT NULL, -- gpt-4o, gemini-1.5-pro, etc.

  -- 토큰 사용량
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,

  -- 비용 계산 (USD, 소수점 6자리)
  cost_usd DECIMAL(12, 6) NOT NULL DEFAULT 0,

  -- 요청 정보
  request_type TEXT, -- chat, vision, embedding, agent, etc.
  agent_id UUID REFERENCES deployed_agents(id) ON DELETE SET NULL,

  -- 메타데이터
  metadata JSONB DEFAULT '{}',

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_id ON api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_provider ON api_usage_logs(provider);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_date ON api_usage_logs(user_id, created_at);

-- 일별 집계 뷰 (성능 최적화)
CREATE OR REPLACE VIEW api_usage_daily AS
SELECT
  user_id,
  provider,
  DATE(created_at) as date,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost_usd,
  COUNT(*) as request_count
FROM api_usage_logs
GROUP BY user_id, provider, DATE(created_at);

-- 월별 집계 뷰
CREATE OR REPLACE VIEW api_usage_monthly AS
SELECT
  user_id,
  provider,
  DATE_TRUNC('month', created_at) as month,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost_usd,
  COUNT(*) as request_count
FROM api_usage_logs
GROUP BY user_id, provider, DATE_TRUNC('month', created_at);

-- RLS 정책
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage logs"
  ON api_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert usage logs"
  ON api_usage_logs FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE api_usage_logs IS 'LLM API 사용량 로그 - 모든 API 호출 추적';
