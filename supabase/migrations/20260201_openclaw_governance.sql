-- ============================================
-- OpenClaw Governance System Tables
-- Governance, Memory, Cost Tracking for OpenClaw Bridge
-- ============================================

-- 1. Agent Policies (Governance 정책)
CREATE TABLE IF NOT EXISTS agent_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES deployed_agents(id) ON DELETE CASCADE,

  -- 비용 제한
  max_cost DECIMAL(10,2) DEFAULT 100.00,
  daily_cost_limit DECIMAL(10,2) DEFAULT 500.00,
  monthly_cost_limit DECIMAL(10,2) DEFAULT 5000.00,

  -- 스킬 접근 제어
  allowed_skills TEXT[] DEFAULT '{}',  -- 빈 배열이면 모두 허용
  blocked_skills TEXT[] DEFAULT '{}',  -- 차단된 스킬
  require_approval TEXT[] DEFAULT '{}', -- 승인 필요한 스킬

  -- 작업 제한
  max_concurrent_tasks INT DEFAULT 5,
  max_task_duration_minutes INT DEFAULT 30,

  -- 메타데이터
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(agent_id)
);

-- 2. Agent Approval Requests (HITL 승인 요청)
CREATE TABLE IF NOT EXISTS agent_approval_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES deployed_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 요청 정보
  skill_name TEXT NOT NULL,
  params JSONB DEFAULT '{}',
  reason TEXT,
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'critical')),

  -- 상태
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),

  -- 승인 정보
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- 만료 시간
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Agent Audit Logs (감사 로그)
CREATE TABLE IF NOT EXISTS agent_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES deployed_agents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- 작업 정보
  action TEXT NOT NULL,  -- 'skill_execute', 'message_send', 'approval_request' 등
  skill_name TEXT,
  params JSONB DEFAULT '{}',
  result JSONB DEFAULT '{}',

  -- 성능 메트릭
  duration_ms INT,
  cost DECIMAL(10,4) DEFAULT 0,
  success BOOLEAN DEFAULT true,
  error TEXT,

  -- 컨텍스트
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Agent Execution Memory (실행 기록)
CREATE TABLE IF NOT EXISTS agent_execution_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES deployed_agents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- 실행 정보
  skill_name TEXT NOT NULL,
  params JSONB DEFAULT '{}',
  result JSONB DEFAULT '{}',
  success BOOLEAN DEFAULT true,

  -- 세션 정보
  session_id TEXT,
  execution_id TEXT,

  -- 메타데이터
  duration_ms INT,
  tokens_used INT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Agent Cost Records (비용 기록)
CREATE TABLE IF NOT EXISTS agent_cost_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES deployed_agents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- 비용 정보
  skill_name TEXT NOT NULL,
  cost DECIMAL(10,4) NOT NULL DEFAULT 0,

  -- 상세 정보
  cost_type TEXT DEFAULT 'skill' CHECK (cost_type IN ('skill', 'token', 'api', 'storage', 'other')),
  tokens_input INT DEFAULT 0,
  tokens_output INT DEFAULT 0,

  -- 세션 정보
  session_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

-- agent_policies
CREATE INDEX IF NOT EXISTS idx_agent_policies_agent_id ON agent_policies(agent_id);

-- agent_approval_requests
CREATE INDEX IF NOT EXISTS idx_agent_approval_requests_agent_id ON agent_approval_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_approval_requests_user_id ON agent_approval_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_approval_requests_status ON agent_approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_agent_approval_requests_created_at ON agent_approval_requests(created_at DESC);

-- agent_audit_logs
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_agent_id ON agent_audit_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_user_id ON agent_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_action ON agent_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_created_at ON agent_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_skill_name ON agent_audit_logs(skill_name);

-- agent_execution_memory
CREATE INDEX IF NOT EXISTS idx_agent_execution_memory_agent_id ON agent_execution_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_memory_user_id ON agent_execution_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_memory_skill_name ON agent_execution_memory(skill_name);
CREATE INDEX IF NOT EXISTS idx_agent_execution_memory_created_at ON agent_execution_memory(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_execution_memory_session_id ON agent_execution_memory(session_id);

-- agent_cost_records
CREATE INDEX IF NOT EXISTS idx_agent_cost_records_agent_id ON agent_cost_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_cost_records_user_id ON agent_cost_records(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_cost_records_created_at ON agent_cost_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_cost_records_skill_name ON agent_cost_records(skill_name);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE agent_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_execution_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_cost_records ENABLE ROW LEVEL SECURITY;

-- agent_policies: 에이전트 소유자만 접근
CREATE POLICY "agent_policies_owner_access" ON agent_policies
  FOR ALL USING (
    agent_id IN (
      SELECT id FROM deployed_agents WHERE user_id = auth.uid()
    )
  );

-- agent_approval_requests: 요청자 또는 에이전트 소유자
CREATE POLICY "agent_approval_requests_access" ON agent_approval_requests
  FOR ALL USING (
    user_id = auth.uid() OR
    agent_id IN (
      SELECT id FROM deployed_agents WHERE user_id = auth.uid()
    )
  );

-- agent_audit_logs: 에이전트 소유자만 읽기
CREATE POLICY "agent_audit_logs_owner_read" ON agent_audit_logs
  FOR SELECT USING (
    agent_id IN (
      SELECT id FROM deployed_agents WHERE user_id = auth.uid()
    )
  );

-- agent_execution_memory: 에이전트 소유자 또는 해당 사용자
CREATE POLICY "agent_execution_memory_access" ON agent_execution_memory
  FOR ALL USING (
    user_id = auth.uid() OR
    agent_id IN (
      SELECT id FROM deployed_agents WHERE user_id = auth.uid()
    )
  );

-- agent_cost_records: 에이전트 소유자만 읽기
CREATE POLICY "agent_cost_records_owner_read" ON agent_cost_records
  FOR SELECT USING (
    agent_id IN (
      SELECT id FROM deployed_agents WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Triggers
-- ============================================

-- updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_policies_updated_at
  BEFORE UPDATE ON agent_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_approval_requests_updated_at
  BEFORE UPDATE ON agent_approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Helper Functions
-- ============================================

-- 에이전트의 오늘 총 비용 조회
CREATE OR REPLACE FUNCTION get_agent_daily_cost(p_agent_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  total_cost DECIMAL;
BEGIN
  SELECT COALESCE(SUM(cost), 0) INTO total_cost
  FROM agent_cost_records
  WHERE agent_id = p_agent_id
    AND created_at >= CURRENT_DATE;

  RETURN total_cost;
END;
$$ LANGUAGE plpgsql;

-- 에이전트의 이번 달 총 비용 조회
CREATE OR REPLACE FUNCTION get_agent_monthly_cost(p_agent_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  total_cost DECIMAL;
BEGIN
  SELECT COALESCE(SUM(cost), 0) INTO total_cost
  FROM agent_cost_records
  WHERE agent_id = p_agent_id
    AND created_at >= DATE_TRUNC('month', CURRENT_DATE);

  RETURN total_cost;
END;
$$ LANGUAGE plpgsql;

-- 에이전트 정책 가져오기 (없으면 기본값 생성)
CREATE OR REPLACE FUNCTION get_or_create_agent_policy(p_agent_id UUID)
RETURNS agent_policies AS $$
DECLARE
  policy agent_policies;
BEGIN
  SELECT * INTO policy
  FROM agent_policies
  WHERE agent_id = p_agent_id;

  IF NOT FOUND THEN
    INSERT INTO agent_policies (agent_id)
    VALUES (p_agent_id)
    RETURNING * INTO policy;
  END IF;

  RETURN policy;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE agent_policies IS 'OpenClaw Governance - 에이전트별 실행 정책 및 제한';
COMMENT ON TABLE agent_approval_requests IS 'HITL 승인 요청 - 민감한 작업에 대한 사용자 승인';
COMMENT ON TABLE agent_audit_logs IS '감사 로그 - 모든 에이전트 작업 기록';
COMMENT ON TABLE agent_execution_memory IS '실행 메모리 - 스킬 실행 결과 저장';
COMMENT ON TABLE agent_cost_records IS '비용 기록 - 스킬별 비용 추적';
