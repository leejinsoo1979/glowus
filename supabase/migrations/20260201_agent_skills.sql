-- Agent Skills Table
-- 에이전트별 스킬 관리를 위한 전담 테이블

CREATE TABLE IF NOT EXISTS agent_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES deployed_agents(id) ON DELETE CASCADE,

  -- 스킬 기본 정보
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,  -- SKILL.md 전체 내용

  -- 스킬 타입 및 분류
  skill_type TEXT DEFAULT 'custom',  -- 'custom', 'hub', 'system'
  source TEXT,  -- 스킬 출처 (예: 'skill-hub', 'local', 'marketplace')
  category TEXT,  -- 스킬 카테고리 (예: 'research', 'coding', 'writing')
  keywords TEXT[] DEFAULT '{}',

  -- 폴더 업로드 시 추가 파일들
  files JSONB DEFAULT '[]',  -- [{name: 'example.md', content: '...', type: 'markdown'}]

  -- 상태
  enabled BOOLEAN DEFAULT true,
  version TEXT DEFAULT '1.0.0',

  -- 통계
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- 메타데이터 (SKILL.md frontmatter 파싱 결과)
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 에이전트당 스킬 이름 유니크
  UNIQUE(agent_id, name)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_skills_agent ON agent_skills(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_name ON agent_skills(name);
CREATE INDEX IF NOT EXISTS idx_agent_skills_enabled ON agent_skills(agent_id, enabled);
CREATE INDEX IF NOT EXISTS idx_agent_skills_keywords ON agent_skills USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_agent_skills_category ON agent_skills(category);

-- RLS 정책
ALTER TABLE agent_skills ENABLE ROW LEVEL SECURITY;

-- 에이전트 소유자만 스킬 관리 가능
CREATE POLICY "Agent owners can manage skills" ON agent_skills
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM deployed_agents da
      WHERE da.id = agent_skills.agent_id
      AND da.owner_id = auth.uid()
    )
  );

-- 공개 에이전트의 스킬은 누구나 조회 가능
CREATE POLICY "Public agent skills are viewable" ON agent_skills
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deployed_agents da
      WHERE da.id = agent_skills.agent_id
      AND da.status = 'ACTIVE'
    )
  );

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_agent_skills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agent_skills_updated_at
  BEFORE UPDATE ON agent_skills
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_skills_updated_at();

-- 코멘트
COMMENT ON TABLE agent_skills IS '에이전트별 커스텀 스킬 저장 테이블';
COMMENT ON COLUMN agent_skills.content IS 'SKILL.md 전체 내용';
COMMENT ON COLUMN agent_skills.files IS '스킬 폴더에 포함된 추가 파일들 (JSON 배열)';
COMMENT ON COLUMN agent_skills.metadata IS 'SKILL.md frontmatter에서 파싱된 메타데이터';
COMMENT ON COLUMN agent_skills.skill_type IS 'custom: 직접 작성, hub: 스킬허브에서 다운로드, system: 시스템 제공';
