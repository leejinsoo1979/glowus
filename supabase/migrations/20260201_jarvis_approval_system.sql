-- ============================================
-- Jarvis 승인 시스템 테이블
-- ============================================

-- 1. 승인 요청 테이블
CREATE TABLE IF NOT EXISTS jarvis_approval_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 요청 정보
  tool_name TEXT NOT NULL,
  action_description TEXT NOT NULL,
  full_command TEXT,
  args JSONB DEFAULT '{}',

  -- 위험도
  risk_level TEXT DEFAULT 'MEDIUM' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),

  -- 상태
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),

  -- 승인/거부 정보
  responded_at TIMESTAMPTZ,
  rejected_reason TEXT,

  -- 만료
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes'),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 실행 로그 테이블
CREATE TABLE IF NOT EXISTS jarvis_execution_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID REFERENCES jarvis_approval_requests(id) ON DELETE SET NULL,

  -- 실행 정보
  tool_name TEXT NOT NULL,
  action TEXT NOT NULL,
  args JSONB DEFAULT '{}',

  -- 결과
  status TEXT DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED', 'CANCELLED')),
  result JSONB DEFAULT '{}',
  error TEXT,

  -- 메타
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_jarvis_approval_user ON jarvis_approval_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_jarvis_approval_status ON jarvis_approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_jarvis_approval_created ON jarvis_approval_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jarvis_execution_user ON jarvis_execution_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_jarvis_execution_created ON jarvis_execution_logs(created_at DESC);

-- ============================================
-- RLS
-- ============================================

ALTER TABLE jarvis_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE jarvis_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jarvis_approval_own" ON jarvis_approval_requests
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "jarvis_execution_own" ON jarvis_execution_logs
  FOR ALL USING (user_id = auth.uid());
