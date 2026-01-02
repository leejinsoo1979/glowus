-- Blueprint Execution System
-- Neural Map에서 Agent가 Blueprint를 실행할 때 상태 추적

-- ============================================
-- Blueprint 실행 세션 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS neural_blueprint_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES neural_maps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 실행 상태
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'paused', 'completed', 'error')),

  -- 현재 진행 중인 노드
  current_node_id UUID REFERENCES neural_nodes(id) ON DELETE SET NULL,

  -- 진행률
  total_nodes INTEGER DEFAULT 0,
  completed_nodes INTEGER DEFAULT 0,

  -- 실행 로그
  logs JSONB DEFAULT '[]',

  -- 에러 정보
  error_message TEXT,

  -- 타임스탬프
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 인덱스
-- ============================================

CREATE INDEX IF NOT EXISTS idx_blueprint_executions_map ON neural_blueprint_executions(map_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_executions_user ON neural_blueprint_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_executions_status ON neural_blueprint_executions(status);

-- ============================================
-- 업데이트 트리거
-- ============================================

CREATE OR REPLACE FUNCTION update_blueprint_execution_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS blueprint_executions_updated ON neural_blueprint_executions;
CREATE TRIGGER blueprint_executions_updated
  BEFORE UPDATE ON neural_blueprint_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_blueprint_execution_timestamp();

-- ============================================
-- RLS 정책
-- ============================================

ALTER TABLE neural_blueprint_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_executions" ON neural_blueprint_executions
  FOR ALL USING (user_id = auth.uid());

-- ============================================
-- neural_nodes type 확장 (Brain Core Types 추가)
-- ============================================

-- 기존 CHECK 제약 조건 삭제 후 새로 추가
ALTER TABLE neural_nodes DROP CONSTRAINT IF EXISTS neural_nodes_type_check;

ALTER TABLE neural_nodes ADD CONSTRAINT neural_nodes_type_check
  CHECK (type IN (
    -- 기존 타입
    'self', 'concept', 'project', 'doc', 'idea', 'decision', 'memory', 'task', 'person', 'insight',
    -- Brain Core 타입 (NEW)
    'rule', 'identity', 'preference', 'playbook',
    -- 기타
    'folder', 'file', 'agent'
  ));

-- ============================================
-- Realtime 활성화
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE neural_blueprint_executions;
