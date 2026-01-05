-- =====================================================
-- Phase 5: 첨부파일 시스템 스키마
-- =====================================================

-- 1. government_programs 테이블 확장
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS attachments_primary JSONB DEFAULT '[]'::jsonb;
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS attachments_extra JSONB DEFAULT '[]'::jsonb;
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS plan_template_url TEXT;
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS plan_template_pdf_url TEXT;
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS match_score DECIMAL(5,2);
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS match_reason JSONB;
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS attachments_fetched_at TIMESTAMPTZ;

-- attachments 구조 예시:
-- attachments_primary: [
--   {"name": "모집공고문.pdf", "url": "https://...", "storage_path": "attachments/xxx.pdf", "size": 1234567}
-- ]

-- 2. 첨부파일 메타데이터 테이블 (상세 관리용)
CREATE TABLE IF NOT EXISTS program_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES government_programs(id) ON DELETE CASCADE,

    -- 파일 정보
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),                -- primary, extra, template, template_pdf
    original_url TEXT,                     -- 원본 URL
    storage_path TEXT,                     -- Supabase Storage 경로

    -- 메타데이터
    file_size INTEGER,
    mime_type VARCHAR(100),
    page_count INTEGER,                    -- PDF인 경우

    -- 상태
    status VARCHAR(20) DEFAULT 'pending',  -- pending, downloading, completed, failed
    error_message TEXT,

    -- 파싱 결과 (양식 파일인 경우)
    parsed_structure JSONB,                -- 양식 구조 파싱 결과

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_program_attachments_program ON program_attachments(program_id);
CREATE INDEX IF NOT EXISTS idx_program_attachments_type ON program_attachments(file_type);
CREATE INDEX IF NOT EXISTS idx_program_attachments_status ON program_attachments(status);

-- RLS
ALTER TABLE program_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view attachments" ON program_attachments;
CREATE POLICY "Anyone can view attachments" ON program_attachments
    FOR SELECT USING (true);

-- 3. 첨부파일 다운로드 작업 큐
CREATE TABLE IF NOT EXISTS attachment_download_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES government_programs(id) ON DELETE CASCADE,
    attachment_id UUID REFERENCES program_attachments(id) ON DELETE CASCADE,

    original_url TEXT NOT NULL,
    file_type VARCHAR(50),

    -- 작업 상태
    status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    error_message TEXT,

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_queue_status ON attachment_download_queue(status);
CREATE INDEX IF NOT EXISTS idx_download_queue_created ON attachment_download_queue(created_at);

-- 4. 트리거: updated_at 자동 업데이트
DROP TRIGGER IF EXISTS update_program_attachments_updated_at ON program_attachments;
CREATE TRIGGER update_program_attachments_updated_at
    BEFORE UPDATE ON program_attachments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. 통계용 뷰
CREATE OR REPLACE VIEW attachment_stats AS
SELECT
    COUNT(*) as total_attachments,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    SUM(file_size) FILTER (WHERE status = 'completed') as total_size_bytes,
    COUNT(DISTINCT program_id) as programs_with_attachments
FROM program_attachments;
