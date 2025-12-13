-- Agent Emotion System Migration
-- Adds emotion_avatars and custom_emotions columns to deployed_agents

-- Add emotion_avatars column (JSONB for storing emotion -> image URL mapping)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deployed_agents' AND column_name = 'emotion_avatars'
  ) THEN
    ALTER TABLE deployed_agents ADD COLUMN emotion_avatars JSONB DEFAULT '{}';
    COMMENT ON COLUMN deployed_agents.emotion_avatars IS 'Maps emotion types to avatar image URLs';
  END IF;
END $$;

-- Add custom_emotions column (JSONB array for user-defined emotion types)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deployed_agents' AND column_name = 'custom_emotions'
  ) THEN
    ALTER TABLE deployed_agents ADD COLUMN custom_emotions JSONB DEFAULT '[]';
    COMMENT ON COLUMN deployed_agents.custom_emotions IS 'Array of custom emotion types with id, label, emoji, description, keywords';
  END IF;
END $$;
