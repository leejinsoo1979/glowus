-- Add permissions and agent_type columns to deployed_agents
-- Super Agent 생성 시 권한 및 타입 저장용

-- Add permissions column (JSONB for storing permission settings)
ALTER TABLE deployed_agents
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

COMMENT ON COLUMN deployed_agents.permissions IS 'Agent permissions: { canRead, canWrite, canDelete, canExecute, canAccessInternet, canAccessCalendar, canAccessEmail, canAccessFiles, canAccessContacts }';

-- Add agent_type column
ALTER TABLE deployed_agents
ADD COLUMN IF NOT EXISTS agent_type TEXT DEFAULT 'general';

COMMENT ON COLUMN deployed_agents.agent_type IS 'Agent type: general, assistant, specialist, super_agent, etc.';

-- Create index for agent_type
CREATE INDEX IF NOT EXISTS idx_deployed_agents_agent_type ON deployed_agents(agent_type);
