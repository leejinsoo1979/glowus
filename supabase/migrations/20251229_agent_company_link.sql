-- =====================================================
-- Agent-Company Link Migration
-- 에이전트가 소속 회사 정보를 볼 수 있도록 연결
-- =====================================================

-- 1. deployed_agents에 company_id 컬럼 추가
ALTER TABLE deployed_agents
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_deployed_agents_company
ON deployed_agents(company_id);

-- 3. 기존 에이전트들을 기본 회사에 연결 (유에이블코퍼레이션)
UPDATE deployed_agents
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- 4. 회사 정보 조회 함수
CREATE OR REPLACE FUNCTION get_agent_company_context(p_agent_id UUID)
RETURNS TABLE (
  company_id UUID,
  company_name TEXT,
  business_number TEXT,
  ceo_name TEXT,
  address TEXT,
  business_type TEXT,
  business_category TEXT,
  website TEXT,
  email TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.business_number,
    c.ceo_name,
    c.address,
    c.business_type,
    c.business_category,
    c.website,
    c.email
  FROM deployed_agents a
  JOIN companies c ON a.company_id = c.id
  WHERE a.id = p_agent_id;
END;
$$;

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ Agent-Company link migration complete!';
  RAISE NOTICE '   - company_id column added to deployed_agents';
  RAISE NOTICE '   - All agents linked to default company';
  RAISE NOTICE '   - get_agent_company_context function created';
END $$;
