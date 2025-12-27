-- Coding Team Agent Activity 테이블
-- 5개 에이전트 (Orchestrator, Planner, Implementer, Tester, Reviewer)의 활동 기록

CREATE TABLE IF NOT EXISTS coding_team_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_role TEXT NOT NULL CHECK (agent_role IN ('orchestrator', 'planner', 'implementer', 'tester', 'reviewer')),
  map_id UUID REFERENCES neural_maps(id) ON DELETE SET NULL,

  -- 활동 정보
  message TEXT NOT NULL,
  response TEXT,
  tools_used TEXT[] DEFAULT '{}',
  actions_count INTEGER DEFAULT 0,

  -- 기여도 메트릭
  files_created INTEGER DEFAULT 0,
  files_modified INTEGER DEFAULT 0,
  nodes_created INTEGER DEFAULT 0,
  tests_run INTEGER DEFAULT 0,

  -- 메타데이터
  model TEXT,
  duration_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_coding_team_activity_user ON coding_team_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_coding_team_activity_agent ON coding_team_activity(agent_role);
CREATE INDEX IF NOT EXISTS idx_coding_team_activity_created ON coding_team_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coding_team_activity_map ON coding_team_activity(map_id);

-- RLS 정책
ALTER TABLE coding_team_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own coding team activity"
  ON coding_team_activity FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own coding team activity"
  ON coding_team_activity FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 에이전트별 통계 뷰
CREATE OR REPLACE VIEW coding_team_stats AS
SELECT
  user_id,
  agent_role,
  COUNT(*) as total_tasks,
  SUM(files_created) as total_files_created,
  SUM(files_modified) as total_files_modified,
  SUM(nodes_created) as total_nodes_created,
  SUM(tests_run) as total_tests_run,
  SUM(actions_count) as total_actions,
  COUNT(CASE WHEN success THEN 1 END) as successful_tasks,
  AVG(duration_ms)::INTEGER as avg_duration_ms,
  MAX(created_at) as last_active_at
FROM coding_team_activity
GROUP BY user_id, agent_role;

-- 코멘트
COMMENT ON TABLE coding_team_activity IS '코딩팀 에이전트(5개)의 활동 기록';
COMMENT ON VIEW coding_team_stats IS '에이전트별 통계 집계 뷰';
