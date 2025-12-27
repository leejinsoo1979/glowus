-- Add metadata column to projects table
-- This column stores additional project metadata as JSONB

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN public.projects.metadata IS 'Additional project metadata (settings, preferences, etc.)';
