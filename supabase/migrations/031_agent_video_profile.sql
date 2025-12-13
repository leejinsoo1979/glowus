-- Add video_url column to deployed_agents for profile videos
-- Supports MP4 video uploads for agent introductions

ALTER TABLE deployed_agents ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN deployed_agents.video_url IS 'MP4 video URL for agent profile/introduction video';
