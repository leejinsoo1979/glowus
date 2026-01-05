-- Add missing columns for program details
-- These columns store scraped content from original announcement pages

ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS target TEXT;
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS description TEXT;

-- Add comments
COMMENT ON COLUMN government_programs.target IS '지원 대상';
COMMENT ON COLUMN government_programs.region IS '지역';
COMMENT ON COLUMN government_programs.description IS '상세 설명 (크롤링)';
