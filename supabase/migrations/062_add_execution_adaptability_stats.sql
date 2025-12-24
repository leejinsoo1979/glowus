-- Add execution and adaptability columns to agent_stats table
-- These stats were shown in UI but missing from database schema

ALTER TABLE agent_stats
ADD COLUMN IF NOT EXISTS execution INTEGER DEFAULT 0 CHECK (execution BETWEEN 0 AND 100),
ADD COLUMN IF NOT EXISTS adaptability INTEGER DEFAULT 0 CHECK (adaptability BETWEEN 0 AND 100);

-- Add comments for documentation
COMMENT ON COLUMN agent_stats.execution IS '실행력 - 업무 완료 능력 (0-100)';
COMMENT ON COLUMN agent_stats.adaptability IS '적응력 - 새로운 상황 대응 능력 (0-100)';

-- Update existing records to have initial values (20 for new stats)
UPDATE agent_stats
SET execution = 20, adaptability = 20
WHERE execution IS NULL OR adaptability IS NULL;
