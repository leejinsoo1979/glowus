-- =====================================================
-- 사업계획서 자동생성 파이프라인 데이터베이스 스키마
-- Stage 0-11 전체 파이프라인 지원
-- =====================================================

-- 1. 사업계획서 템플릿 (공고문에서 추출)
CREATE TABLE IF NOT EXISTS business_plan_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES government_programs(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    -- 템플릿 메타데이터
    template_name TEXT NOT NULL,
    template_version TEXT DEFAULT '1.0',
    source_document_url TEXT,

    -- 파싱된 구조
    sections JSONB NOT NULL DEFAULT '[]',  -- [{section_id, title, required, max_chars, guidelines, order}]
    evaluation_criteria JSONB DEFAULT '[]', -- [{criterion, weight, description}]
    required_attachments JSONB DEFAULT '[]', -- [{name, format, required}]

    -- 작성요령
    writing_guidelines JSONB DEFAULT '{}',
    formatting_rules JSONB DEFAULT '{}',  -- 폰트, 여백, 페이지 제한 등

    -- 상태
    parsing_status TEXT DEFAULT 'pending' CHECK (parsing_status IN ('pending', 'processing', 'completed', 'failed')),
    parsing_error TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 사업계획서 (메인 문서)
CREATE TABLE IF NOT EXISTS business_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    program_id UUID REFERENCES government_programs(id) ON DELETE SET NULL,
    template_id UUID REFERENCES business_plan_templates(id) ON DELETE SET NULL,

    -- 기본 정보
    title TEXT NOT NULL,
    project_name TEXT,

    -- 파이프라인 상태
    pipeline_stage INTEGER DEFAULT 0 CHECK (pipeline_stage BETWEEN 0 AND 11),
    pipeline_status TEXT DEFAULT 'draft' CHECK (pipeline_status IN (
        'draft', 'collecting', 'extracting', 'mapping', 'generating',
        'validating', 'reviewing', 'approved', 'submitted', 'completed'
    )),

    -- 진행률
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
    section_completion JSONB DEFAULT '{}',  -- {section_id: percentage}

    -- AI 생성 메타데이터
    ai_model_used TEXT,
    total_tokens_used INTEGER DEFAULT 0,
    generation_cost DECIMAL(10, 4) DEFAULT 0,

    -- 평가 시뮬레이션
    simulated_score INTEGER,
    score_breakdown JSONB,

    -- 버전 관리
    version INTEGER DEFAULT 1,
    is_latest BOOLEAN DEFAULT TRUE,
    parent_version_id UUID REFERENCES business_plans(id),

    -- 협업
    assigned_to UUID,
    reviewers UUID[],

    -- 제출 정보
    submitted_at TIMESTAMPTZ,
    submission_reference TEXT,

    -- 결과 피드백 (Stage 11)
    result_status TEXT CHECK (result_status IN ('pending', 'selected', 'rejected', 'waitlist')),
    result_feedback TEXT,
    result_score INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 사업계획서 섹션
CREATE TABLE IF NOT EXISTS business_plan_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,

    -- 섹션 정보
    section_key TEXT NOT NULL,  -- 템플릿에서 정의된 키
    section_title TEXT NOT NULL,
    section_order INTEGER DEFAULT 0,

    -- 콘텐츠
    content TEXT,
    content_html TEXT,

    -- AI 생성 정보
    ai_generated BOOLEAN DEFAULT FALSE,
    generation_prompt TEXT,
    source_facts UUID[],  -- 참조한 팩트카드 IDs

    -- 검증 결과
    char_count INTEGER DEFAULT 0,
    max_char_limit INTEGER,
    validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'warning', 'invalid')),
    validation_messages JSONB DEFAULT '[]',

    -- 수동 편집
    manually_edited BOOLEAN DEFAULT FALSE,
    last_edited_by UUID,

    -- 미확정 정보
    has_placeholders BOOLEAN DEFAULT FALSE,
    placeholders JSONB DEFAULT '[]',  -- [{placeholder_id, text, question}]

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(plan_id, section_key)
);

-- 4. 팩트카드 (Company Pack)
CREATE TABLE IF NOT EXISTS company_fact_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- 팩트 분류
    category TEXT NOT NULL,  -- company_info, technology, team, finance, market, product, etc.
    subcategory TEXT,

    -- 팩트 내용
    fact_key TEXT NOT NULL,
    fact_value TEXT NOT NULL,
    fact_type TEXT DEFAULT 'text' CHECK (fact_type IN ('text', 'number', 'date', 'list', 'json')),

    -- 메타데이터
    source TEXT,  -- 데이터 출처 (manual, document, api)
    source_document_id UUID,
    confidence_score DECIMAL(3, 2) DEFAULT 1.0,

    -- 벡터 임베딩 (RAG용)
    embedding vector(1536),
    embedding_model TEXT,

    -- 유효성
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verified_by UUID,

    -- 버전
    version INTEGER DEFAULT 1,
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, category, fact_key, version)
);

-- 5. 섹션-팩트 매핑
CREATE TABLE IF NOT EXISTS section_fact_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES business_plan_sections(id) ON DELETE CASCADE,
    fact_id UUID NOT NULL REFERENCES company_fact_cards(id) ON DELETE CASCADE,

    -- 매핑 정보
    relevance_score DECIMAL(3, 2) DEFAULT 0.0,
    mapping_type TEXT DEFAULT 'auto' CHECK (mapping_type IN ('auto', 'manual', 'suggested')),

    -- 사용 정보
    used_in_generation BOOLEAN DEFAULT FALSE,
    position_in_content INTEGER,  -- 콘텐츠 내 위치

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(section_id, fact_id)
);

-- 6. 질문 (미확정 정보 보완용)
CREATE TABLE IF NOT EXISTS plan_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,
    section_id UUID REFERENCES business_plan_sections(id) ON DELETE SET NULL,

    -- 질문 내용
    question_text TEXT NOT NULL,
    question_type TEXT DEFAULT 'text' CHECK (question_type IN ('text', 'number', 'date', 'select', 'multiselect', 'file')),
    options JSONB,  -- select/multiselect용 옵션

    -- 컨텍스트
    context TEXT,  -- 왜 이 질문이 필요한지
    placeholder_id TEXT,  -- 섹션 내 플레이스홀더 ID

    -- 응답
    answer TEXT,
    answered_at TIMESTAMPTZ,
    answered_by UUID,

    -- 상태
    priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
    is_required BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'skipped', 'auto_filled')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 버전 히스토리
CREATE TABLE IF NOT EXISTS plan_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,

    -- 버전 정보
    version_number INTEGER NOT NULL,
    version_label TEXT,  -- "초안", "1차 수정", "최종본" 등

    -- 스냅샷
    sections_snapshot JSONB NOT NULL,
    metadata_snapshot JSONB,

    -- 변경 정보
    changes_summary TEXT,
    changed_by UUID,
    change_type TEXT CHECK (change_type IN ('auto_save', 'manual_save', 'review', 'submission')),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(plan_id, version_number)
);

-- 8. 성공 패턴 (Stage 0: 선정 사례 학습)
CREATE TABLE IF NOT EXISTS success_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES government_programs(id) ON DELETE SET NULL,

    -- 패턴 분류
    pattern_type TEXT NOT NULL,  -- structure, content, keywords, formatting
    category TEXT,  -- 해당 섹션 카테고리

    -- 패턴 내용
    pattern_name TEXT NOT NULL,
    pattern_description TEXT,
    pattern_data JSONB NOT NULL,

    -- 효과 분석
    success_rate DECIMAL(3, 2),
    sample_count INTEGER DEFAULT 0,

    -- 적용 가이드
    application_guide TEXT,
    example_text TEXT,

    -- 출처
    source_plans UUID[],  -- 분석에 사용된 사업계획서들

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 리뷰 및 코멘트
CREATE TABLE IF NOT EXISTS plan_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,
    section_id UUID REFERENCES business_plan_sections(id) ON DELETE SET NULL,

    -- 리뷰어
    reviewer_id UUID NOT NULL,
    reviewer_role TEXT,  -- owner, collaborator, approver

    -- 리뷰 내용
    review_type TEXT NOT NULL CHECK (review_type IN ('comment', 'suggestion', 'approval', 'rejection')),
    content TEXT,

    -- 제안된 변경
    suggested_change TEXT,
    change_applied BOOLEAN DEFAULT FALSE,

    -- 상태
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
    resolved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. 파이프라인 실행 로그
CREATE TABLE IF NOT EXISTS pipeline_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,

    -- 실행 정보
    stage INTEGER NOT NULL,
    stage_name TEXT NOT NULL,

    -- 상태
    status TEXT NOT NULL CHECK (status IN ('started', 'processing', 'completed', 'failed', 'skipped')),

    -- 성능 메트릭
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- 토큰/비용
    tokens_used INTEGER DEFAULT 0,
    cost DECIMAL(10, 4) DEFAULT 0,

    -- 결과
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 인덱스
-- =====================================================

-- 템플릿 인덱스
CREATE INDEX IF NOT EXISTS idx_templates_program ON business_plan_templates(program_id);
CREATE INDEX IF NOT EXISTS idx_templates_company ON business_plan_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_templates_status ON business_plan_templates(parsing_status);

-- 사업계획서 인덱스
CREATE INDEX IF NOT EXISTS idx_plans_company ON business_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_plans_program ON business_plans(program_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON business_plans(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_plans_stage ON business_plans(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_plans_latest ON business_plans(is_latest) WHERE is_latest = TRUE;

-- 섹션 인덱스
CREATE INDEX IF NOT EXISTS idx_sections_plan ON business_plan_sections(plan_id);
CREATE INDEX IF NOT EXISTS idx_sections_validation ON business_plan_sections(validation_status);
CREATE INDEX IF NOT EXISTS idx_sections_placeholders ON business_plan_sections(has_placeholders) WHERE has_placeholders = TRUE;

-- 팩트카드 인덱스
CREATE INDEX IF NOT EXISTS idx_facts_company ON company_fact_cards(company_id);
CREATE INDEX IF NOT EXISTS idx_facts_category ON company_fact_cards(category);
CREATE INDEX IF NOT EXISTS idx_facts_verified ON company_fact_cards(is_verified);

-- 벡터 검색 인덱스 (pgvector)
CREATE INDEX IF NOT EXISTS idx_facts_embedding ON company_fact_cards
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 질문 인덱스
CREATE INDEX IF NOT EXISTS idx_questions_plan ON plan_questions(plan_id);
CREATE INDEX IF NOT EXISTS idx_questions_status ON plan_questions(status);
CREATE INDEX IF NOT EXISTS idx_questions_priority ON plan_questions(priority);

-- 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_logs_plan ON pipeline_execution_logs(plan_id);
CREATE INDEX IF NOT EXISTS idx_logs_stage ON pipeline_execution_logs(stage);
CREATE INDEX IF NOT EXISTS idx_logs_status ON pipeline_execution_logs(status);

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

ALTER TABLE business_plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_plan_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_fact_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_fact_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE success_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_execution_logs ENABLE ROW LEVEL SECURITY;

-- 회사 멤버 기준 정책 (예시 - 실제 구현 시 조정 필요)
CREATE POLICY "company_members_templates" ON business_plan_templates
    FOR ALL USING (company_id IN (
        SELECT company_id FROM employees WHERE user_id = auth.uid()
    ));

CREATE POLICY "company_members_plans" ON business_plans
    FOR ALL USING (company_id IN (
        SELECT company_id FROM employees WHERE user_id = auth.uid()
    ));

CREATE POLICY "company_members_sections" ON business_plan_sections
    FOR ALL USING (plan_id IN (
        SELECT id FROM business_plans WHERE company_id IN (
            SELECT company_id FROM employees WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "company_members_facts" ON company_fact_cards
    FOR ALL USING (company_id IN (
        SELECT company_id FROM employees WHERE user_id = auth.uid()
    ));

-- =====================================================
-- 트리거: updated_at 자동 갱신
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON business_plan_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON business_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON business_plan_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_facts_updated_at BEFORE UPDATE ON company_fact_cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON plan_questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patterns_updated_at BEFORE UPDATE ON success_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 11. 파이프라인 Job Queue (Production)
-- =====================================================

CREATE TABLE IF NOT EXISTS pipeline_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- 실행할 스테이지
    stages INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6,7,8}',
    current_stage INTEGER DEFAULT 0,

    -- 상태
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),

    -- 스테이지별 진행률
    stage_progress JSONB DEFAULT '{}',

    -- 에러 정보
    error TEXT,

    -- 타임스탬프
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job 인덱스
CREATE INDEX IF NOT EXISTS idx_jobs_plan ON pipeline_jobs(plan_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON pipeline_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON pipeline_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON pipeline_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_running ON pipeline_jobs(company_id, status) WHERE status IN ('pending', 'running');

-- Job RLS
ALTER TABLE pipeline_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_jobs" ON pipeline_jobs
    FOR ALL USING (company_id IN (
        SELECT company_id FROM employees WHERE user_id = auth.uid()
    ));

-- =====================================================
-- business_plans 테이블에 문서 생성 컬럼 추가
-- =====================================================

ALTER TABLE business_plans
ADD COLUMN IF NOT EXISTS generated_document_url TEXT,
ADD COLUMN IF NOT EXISTS generated_document_format TEXT,
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;
