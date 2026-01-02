-- Add business_registration_url column to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS business_registration_url VARCHAR(500);

COMMENT ON COLUMN companies.business_registration_url IS '사업자등록증 이미지 URL';
