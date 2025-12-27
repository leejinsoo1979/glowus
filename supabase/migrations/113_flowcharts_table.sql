-- =============================================
-- Flowcharts 테이블 (에이전트가 제어하는 Flowchart 데이터)
-- =============================================

CREATE TABLE IF NOT EXISTS flowcharts (
  id TEXT PRIMARY KEY,
  project_path TEXT,
  nodes JSONB DEFAULT '[]'::jsonb,
  edges JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_flowcharts_project_path ON flowcharts(project_path);
CREATE INDEX IF NOT EXISTS idx_flowcharts_updated_at ON flowcharts(updated_at DESC);

-- RLS 활성화
ALTER TABLE flowcharts ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 모든 사용자가 읽기/쓰기 가능 (나중에 user_id 추가 시 수정)
CREATE POLICY "flowcharts_all_access" ON flowcharts
  FOR ALL USING (true) WITH CHECK (true);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE flowcharts;

-- =============================================
-- Agent Call Logs 테이블 (에이전트 호출 로그)
-- =============================================

CREATE TABLE IF NOT EXISTS agent_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_agent_id TEXT NOT NULL,
  target_agent TEXT NOT NULL,
  task TEXT NOT NULL,
  context TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_call_logs_caller ON agent_call_logs(caller_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_call_logs_target ON agent_call_logs(target_agent);
CREATE INDEX IF NOT EXISTS idx_agent_call_logs_status ON agent_call_logs(status);
CREATE INDEX IF NOT EXISTS idx_agent_call_logs_created ON agent_call_logs(created_at DESC);

-- RLS 활성화
ALTER TABLE agent_call_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "agent_call_logs_all_access" ON agent_call_logs
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE flowcharts IS '에이전트가 제어하는 Flowchart 데이터 (ReactFlow 노드/엣지)';
COMMENT ON TABLE agent_call_logs IS 'Orchestrator의 에이전트 호출 로그';
