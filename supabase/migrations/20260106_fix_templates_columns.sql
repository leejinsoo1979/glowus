-- =====================================================
-- Fix business_plan_templates 테이블 누락 컬럼 추가
-- 20260102 마이그레이션과 20260105 마이그레이션 사이의
-- 스키마 차이를 해결
-- =====================================================

-- program_id 컬럼 추가 (기존에 없으면)
ALTER TABLE business_plan_templates
ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES government_programs(id) ON DELETE CASCADE;

-- company_id 컬럼 추가 (기존에 없으면)
ALTER TABLE business_plan_templates
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- template_name 컬럼 추가 (name과 다름)
ALTER TABLE business_plan_templates
ADD COLUMN IF NOT EXISTS template_name TEXT;

-- name이 있으면 template_name으로 복사
UPDATE business_plan_templates
SET template_name = name
WHERE template_name IS NULL AND name IS NOT NULL;

-- template_version 컬럼 추가
ALTER TABLE business_plan_templates
ADD COLUMN IF NOT EXISTS template_version TEXT DEFAULT '1.0';

-- source_document_url 컬럼 추가
ALTER TABLE business_plan_templates
ADD COLUMN IF NOT EXISTS source_document_url TEXT;

-- sections 컬럼이 section_structure라면 추가
-- (구버전 스키마는 section_structure, 신버전은 sections)
ALTER TABLE business_plan_templates
ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT '[]'::jsonb;

-- 기존 section_structure 데이터를 sections로 복사
UPDATE business_plan_templates
SET sections = section_structure
WHERE sections = '[]'::jsonb
  AND section_structure IS NOT NULL
  AND section_structure != '[]'::jsonb;

-- evaluation_criteria 컬럼 추가
ALTER TABLE business_plan_templates
ADD COLUMN IF NOT EXISTS evaluation_criteria JSONB DEFAULT '[]'::jsonb;

-- required_attachments 컬럼 추가
ALTER TABLE business_plan_templates
ADD COLUMN IF NOT EXISTS required_attachments JSONB DEFAULT '[]'::jsonb;

-- writing_guidelines 컬럼 추가
ALTER TABLE business_plan_templates
ADD COLUMN IF NOT EXISTS writing_guidelines JSONB DEFAULT '{}'::jsonb;

-- formatting_rules 컬럼 추가 (핵심!)
ALTER TABLE business_plan_templates
ADD COLUMN IF NOT EXISTS formatting_rules JSONB DEFAULT '{}'::jsonb;

-- parsing_status 컬럼 추가
ALTER TABLE business_plan_templates
ADD COLUMN IF NOT EXISTS parsing_status TEXT DEFAULT 'pending';

-- parsing_error 컬럼 추가
ALTER TABLE business_plan_templates
ADD COLUMN IF NOT EXISTS parsing_error TEXT;

-- 인덱스 추가 (없으면)
CREATE INDEX IF NOT EXISTS idx_templates_program ON business_plan_templates(program_id);
CREATE INDEX IF NOT EXISTS idx_templates_company ON business_plan_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_templates_status ON business_plan_templates(parsing_status);

-- 확인용 코멘트
COMMENT ON COLUMN business_plan_templates.formatting_rules IS '문서 형식 규칙 (폰트, 여백, 페이지 제한 등)';
