-- Agent Skill Secrets Table
-- 스킬별 API 키/시크릿 저장 (암호화)

CREATE TABLE IF NOT EXISTS agent_skill_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES agent_skills(id) ON DELETE CASCADE,

  -- API 설정
  key_name TEXT NOT NULL,
  key_value TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT true,
  default_value TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 스킬당 키 이름 유니크
  UNIQUE(skill_id, key_name)
);

CREATE INDEX IF NOT EXISTS idx_skill_secrets_skill ON agent_skill_secrets(skill_id);

ALTER TABLE agent_skill_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Skill owners can manage secrets" ON agent_skill_secrets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM agent_skills sk
      JOIN deployed_agents da ON da.id = sk.agent_id
      WHERE sk.id = agent_skill_secrets.skill_id
      AND da.owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_skill_secrets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_skill_secrets_updated_at
  BEFORE UPDATE ON agent_skill_secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_skill_secrets_updated_at();
