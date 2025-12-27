-- Add project_id to neural_maps table
-- Links neural maps to projects for project-specific data isolation

ALTER TABLE neural_maps
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Index for faster project-based queries
CREATE INDEX IF NOT EXISTS idx_neural_maps_project ON neural_maps(project_id);

-- Comment
COMMENT ON COLUMN neural_maps.project_id IS 'Links this neural map to a specific project';
