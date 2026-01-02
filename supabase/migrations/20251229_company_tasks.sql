-- =====================================================
-- Company Tasks Migration
-- 에이전트가 업무를 생성/관리할 수 있는 태스크 테이블
-- =====================================================

-- 1. 회사 태스크 테이블
CREATE TABLE IF NOT EXISTS company_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

    -- 태스크 정보
    title VARCHAR(500) NOT NULL,
    description TEXT,

    -- 상태 및 우선순위
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    priority VARCHAR(50) DEFAULT 'medium', -- low, medium, high, urgent

    -- 담당자
    assignee_id UUID REFERENCES employees(id) ON DELETE SET NULL,

    -- 날짜
    due_date DATE,
    completed_at TIMESTAMPTZ,

    -- 생성자 (사용자 또는 에이전트)
    created_by VARCHAR(100), -- user_id 또는 agent_id
    created_by_type VARCHAR(50) DEFAULT 'user', -- user, agent

    -- 메타데이터
    tags TEXT[],
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_company_tasks_company ON company_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_company_tasks_assignee ON company_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_company_tasks_status ON company_tasks(status);
CREATE INDEX IF NOT EXISTS idx_company_tasks_priority ON company_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_company_tasks_due_date ON company_tasks(due_date);

-- 3. RLS 활성화
ALTER TABLE company_tasks ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 (서비스 역할용 - 에이전트 접근)
CREATE POLICY "Service role can manage all company_tasks"
    ON company_tasks
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. updated_at 트리거
CREATE OR REPLACE FUNCTION update_company_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_company_tasks_updated_at
    BEFORE UPDATE ON company_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_company_tasks_updated_at();

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ Company Tasks migration complete!';
  RAISE NOTICE '   - company_tasks table created';
  RAISE NOTICE '   - Indexes and RLS policies added';
END $$;
