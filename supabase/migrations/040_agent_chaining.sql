-- Agent Chaining System: 에이전트 간 자동 업무 전달 시스템
-- 에이전트 A 완료 → 에이전트 B 자동 시작 → 에이전트 C 자동 시작...

-- 1. deployed_agents에 체이닝 관련 필드 추가
ALTER TABLE deployed_agents
ADD COLUMN IF NOT EXISTS next_agent_id UUID REFERENCES deployed_agents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS chain_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS chain_order INTEGER DEFAULT 0;

-- chain_config 예시:
-- {
--   "auto_trigger": true,           // 이전 에이전트 완료 시 자동 실행
--   "input_mapping": "full",        // full: 전체 결과, summary: 요약만, custom: 커스텀
--   "delay_seconds": 0,             // 지연 시간 (초)
--   "condition": null               // 조건부 실행 (null이면 항상)
-- }

COMMENT ON COLUMN deployed_agents.next_agent_id IS '완료 후 결과를 전달할 다음 에이전트';
COMMENT ON COLUMN deployed_agents.chain_config IS '체이닝 설정 (자동실행, 입력매핑 등)';
COMMENT ON COLUMN deployed_agents.chain_order IS '체인 내 순서 (0부터 시작)';

-- 2. 에이전트 체인 (파이프라인) 정의 테이블
CREATE TABLE IF NOT EXISTS agent_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- 체인 설정
  start_agent_id UUID REFERENCES deployed_agents(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,

  -- 메타데이터
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE agent_chains IS '에이전트 체인 (파이프라인) 정의';

-- 3. 체인 실행 기록 테이블
CREATE TABLE IF NOT EXISTS chain_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id UUID REFERENCES agent_chains(id) ON DELETE CASCADE,

  -- 실행 상태
  status TEXT DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  current_agent_id UUID REFERENCES deployed_agents(id),

  -- 입력/출력
  initial_input JSONB,           -- 최초 입력
  final_output JSONB,            -- 최종 출력

  -- 각 단계별 결과 기록
  step_results JSONB DEFAULT '[]',
  -- [
  --   { "agent_id": "...", "agent_name": "...", "output": "...", "completed_at": "..." },
  --   { "agent_id": "...", "agent_name": "...", "output": "...", "completed_at": "..." }
  -- ]

  -- 타임스탬프
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- 에러 정보
  error TEXT
);

COMMENT ON TABLE chain_runs IS '체인 실행 기록';

-- 4. agent_tasks에 체인 관련 필드 추가
ALTER TABLE agent_tasks
ADD COLUMN IF NOT EXISTS chain_run_id UUID REFERENCES chain_runs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS previous_agent_output JSONB,
ADD COLUMN IF NOT EXISTS is_chain_task BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN agent_tasks.chain_run_id IS '체인 실행 ID (체인의 일부인 경우)';
COMMENT ON COLUMN agent_tasks.previous_agent_output IS '이전 에이전트의 출력 (입력으로 사용)';
COMMENT ON COLUMN agent_tasks.is_chain_task IS '체인 태스크 여부';

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_deployed_agents_next_agent ON deployed_agents(next_agent_id);
CREATE INDEX IF NOT EXISTS idx_deployed_agents_chain_order ON deployed_agents(chain_order);
CREATE INDEX IF NOT EXISTS idx_chain_runs_chain_id ON chain_runs(chain_id);
CREATE INDEX IF NOT EXISTS idx_chain_runs_status ON chain_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_chain_run ON agent_tasks(chain_run_id);

-- 6. RLS 정책
ALTER TABLE agent_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE chain_runs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 체인을 볼 수 있음 (개발 모드)
CREATE POLICY "Allow all access to agent_chains" ON agent_chains FOR ALL USING (true);
CREATE POLICY "Allow all access to chain_runs" ON chain_runs FOR ALL USING (true);
