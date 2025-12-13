-- 에이전트별 LLM 제공자 선택 기능
-- 각 에이전트가 다른 AI 모델을 사용할 수 있게 함

-- llm_provider 컬럼 추가
ALTER TABLE deployed_agents
ADD COLUMN IF NOT EXISTS llm_provider TEXT DEFAULT 'ollama';

-- 기본 모델을 ollama로 변경 (기존 gpt-4 → qwen2.5:3b)
ALTER TABLE deployed_agents
ALTER COLUMN model SET DEFAULT 'qwen2.5:3b';

-- 코멘트
COMMENT ON COLUMN deployed_agents.llm_provider IS 'LLM 제공자 (openai, grok, gemini, qwen, ollama)';
COMMENT ON COLUMN deployed_agents.model IS 'LLM 모델 ID (예: gpt-4o, grok-4-fast, gemini-2.0-flash)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_deployed_agents_llm_provider ON deployed_agents(llm_provider);
