-- Add voice_settings column to deployed_agents
ALTER TABLE deployed_agents
ADD COLUMN IF NOT EXISTS voice_settings JSONB DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN deployed_agents.voice_settings IS 'Voice settings for agent: { voice, conversation_style, vad_sensitivity }';
