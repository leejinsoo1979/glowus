-- Add path column to neural_files for folder structure support
-- path stores the relative path within a folder (e.g., "docs/images/logo.png")

ALTER TABLE neural_files ADD COLUMN IF NOT EXISTS path TEXT;

-- Create index for path-based queries
CREATE INDEX IF NOT EXISTS idx_neural_files_path ON neural_files(path);

COMMENT ON COLUMN neural_files.path IS '폴더 업로드 시 상대 경로 (예: docs/images/logo.png)';
