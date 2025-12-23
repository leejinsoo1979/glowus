-- Add folder_path column to projects table
-- This stores the local file system path for the project

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS folder_path TEXT;

-- Comment for documentation
COMMENT ON COLUMN public.projects.folder_path IS 'Local file system path for the project workspace';

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_folder_path ON public.projects(folder_path) WHERE folder_path IS NOT NULL;
