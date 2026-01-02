-- Add detailed business information fields to company_support_profiles
ALTER TABLE company_support_profiles
ADD COLUMN IF NOT EXISTS business_description TEXT,
ADD COLUMN IF NOT EXISTS main_products TEXT,
ADD COLUMN IF NOT EXISTS core_technologies TEXT;

-- Add comments
COMMENT ON COLUMN company_support_profiles.business_description IS '사업 내용 설명';
COMMENT ON COLUMN company_support_profiles.main_products IS '주요 제품/서비스';
COMMENT ON COLUMN company_support_profiles.core_technologies IS '핵심 기술/전문 분야';
