-- =====================================================
-- 사업계획서 자동생성 시스템 스키마
-- Phase 3: Business Plan Generator
-- =====================================================

-- 사업계획서 테이블
CREATE TABLE IF NOT EXISTS business_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    user_id UUID NOT NULL,
    program_id UUID REFERENCES government_programs(id) ON DELETE SET NULL,

    -- 기본 정보
    title VARCHAR(500) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',  -- draft, generating, completed, submitted
    version INTEGER DEFAULT 1,

    -- 섹션별 내용 (JSONB)
    sections JSONB DEFAULT '{}'::jsonb,
    /*
    {
      "executive_summary": {
        "content": "...",
        "generated_at": "2026-01-02T...",
        "edited": false
      },
      "company_overview": {...},
      "problem_statement": {...},
      "solution": {...},
      "market_research": {
        "content": "...",
        "data_sources": [...],
        "statistics": {...}
      },
      "business_model": {...},
      "team_introduction": {...},
      "financial_plan": {...},
      "fund_usage": {...},
      "expected_outcomes": {...}
    }
    */

    -- AI 생성 메타데이터
    ai_model VARCHAR(100),
    ai_generation_log JSONB DEFAULT '[]'::jsonb,
    web_search_results JSONB DEFAULT '[]'::jsonb,

    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,

    -- 인덱스용 컬럼
    is_template BOOLEAN DEFAULT false,
    template_name VARCHAR(200)
);

-- 프로그램 신청 테이블 (기존 테이블 확장)
CREATE TABLE IF NOT EXISTS program_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    program_id UUID NOT NULL REFERENCES government_programs(id) ON DELETE CASCADE,
    business_plan_id UUID REFERENCES business_plans(id) ON DELETE SET NULL,

    -- 상태 관리
    status VARCHAR(50) DEFAULT 'interested',  -- interested, preparing, submitted, accepted, rejected

    -- 적합도 분석
    fit_score DECIMAL(5,2),
    fit_reasons JSONB DEFAULT '{}'::jsonb,

    -- 신청 정보
    application_number VARCHAR(100),
    submitted_at TIMESTAMPTZ,
    result_announced_at TIMESTAMPTZ,

    -- 메모 및 파일
    notes TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,

    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 중복 신청 방지
    UNIQUE(user_id, program_id)
);

-- 사업계획서 섹션 템플릿
CREATE TABLE IF NOT EXISTS business_plan_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- 섹션 구조 정의
    section_structure JSONB NOT NULL,
    /*
    [
      {
        "key": "executive_summary",
        "title": "사업 요약",
        "required": true,
        "max_chars": 2000,
        "prompt_template": "...",
        "order": 1
      },
      ...
    ]
    */

    -- 대상 프로그램 유형
    target_program_types TEXT[] DEFAULT '{}',

    -- 메타데이터
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 시장조사 캐시 테이블
CREATE TABLE IF NOT EXISTS market_research_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 검색 키
    industry_code VARCHAR(20),
    keywords TEXT[],
    search_hash VARCHAR(64) UNIQUE,  -- SHA-256 해시

    -- 캐시된 데이터
    research_data JSONB NOT NULL,
    /*
    {
      "market_size": {...},
      "growth_rate": {...},
      "competitors": [...],
      "trends": [...],
      "statistics": [...],
      "sources": [...]
    }
    */

    -- 유효기간
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),

    -- 사용 추적
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMPTZ
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_business_plans_user_id ON business_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_business_plans_program_id ON business_plans(program_id);
CREATE INDEX IF NOT EXISTS idx_business_plans_status ON business_plans(status);
CREATE INDEX IF NOT EXISTS idx_business_plans_created_at ON business_plans(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_program_applications_user_id ON program_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_program_applications_program_id ON program_applications(program_id);
CREATE INDEX IF NOT EXISTS idx_program_applications_status ON program_applications(status);

CREATE INDEX IF NOT EXISTS idx_market_research_cache_hash ON market_research_cache(search_hash);
CREATE INDEX IF NOT EXISTS idx_market_research_cache_expires ON market_research_cache(expires_at);

-- RLS 정책
ALTER TABLE business_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_research_cache ENABLE ROW LEVEL SECURITY;

-- 사업계획서 RLS
CREATE POLICY "Users can view own business plans"
    ON business_plans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own business plans"
    ON business_plans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business plans"
    ON business_plans FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own business plans"
    ON business_plans FOR DELETE
    USING (auth.uid() = user_id);

-- 프로그램 신청 RLS
CREATE POLICY "Users can view own applications"
    ON program_applications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own applications"
    ON program_applications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own applications"
    ON program_applications FOR UPDATE
    USING (auth.uid() = user_id);

-- 템플릿 RLS (모든 사용자 읽기 가능)
CREATE POLICY "Anyone can view active templates"
    ON business_plan_templates FOR SELECT
    USING (is_active = true);

-- 시장조사 캐시 RLS (모든 사용자 읽기 가능)
CREATE POLICY "Anyone can read cache"
    ON market_research_cache FOR SELECT
    USING (expires_at > NOW());

-- 기본 템플릿 삽입
INSERT INTO business_plan_templates (name, description, section_structure, target_program_types) VALUES
(
    '중소기업 지원사업 기본 템플릿',
    '중소벤처기업부 지원사업 신청용 기본 사업계획서 템플릿',
    '[
      {"key": "executive_summary", "title": "사업 요약", "subtitle": "Executive Summary", "required": true, "max_chars": 2000, "order": 1, "description": "사업의 핵심 내용을 1페이지 내로 요약"},
      {"key": "company_overview", "title": "회사 개요", "subtitle": "Company Overview", "required": true, "max_chars": 3000, "order": 2, "description": "회사 연혁, 조직 구성, 주요 실적"},
      {"key": "problem_statement", "title": "문제 정의", "subtitle": "Problem Statement", "required": true, "max_chars": 2000, "order": 3, "description": "해결하고자 하는 시장의 문제점"},
      {"key": "solution", "title": "해결책", "subtitle": "Solution", "required": true, "max_chars": 3000, "order": 4, "description": "제안하는 제품/서비스의 핵심 가치"},
      {"key": "market_research", "title": "시장 분석", "subtitle": "Market Research", "required": true, "max_chars": 4000, "order": 5, "description": "TAM/SAM/SOM, 경쟁사 분석, 시장 트렌드"},
      {"key": "business_model", "title": "비즈니스 모델", "subtitle": "Business Model", "required": true, "max_chars": 2500, "order": 6, "description": "수익 모델, 가격 전략, 판매 채널"},
      {"key": "team_introduction", "title": "팀 소개", "subtitle": "Team", "required": true, "max_chars": 2000, "order": 7, "description": "핵심 인력의 역량과 경험"},
      {"key": "financial_plan", "title": "재무 계획", "subtitle": "Financial Plan", "required": true, "max_chars": 3000, "order": 8, "description": "3~5년 추정 재무제표, 손익분기점"},
      {"key": "fund_usage", "title": "자금 사용 계획", "subtitle": "Fund Usage", "required": true, "max_chars": 2000, "order": 9, "description": "지원금 항목별 세부 내역"},
      {"key": "expected_outcomes", "title": "기대 효과", "subtitle": "Expected Outcomes", "required": true, "max_chars": 2000, "order": 10, "description": "정량적 성과 목표, 사회적 가치"}
    ]'::jsonb,
    ARRAY['창업지원', '기술개발', 'R&D', '스케일업']
),
(
    '예비창업자 간소화 템플릿',
    '예비창업패키지 등 예비창업자용 간소화 템플릿',
    '[
      {"key": "executive_summary", "title": "사업 아이디어", "subtitle": "Business Idea", "required": true, "max_chars": 1500, "order": 1, "description": "핵심 아이디어와 차별점"},
      {"key": "problem_statement", "title": "문제 인식", "subtitle": "Problem", "required": true, "max_chars": 1500, "order": 2, "description": "해결하려는 문제"},
      {"key": "solution", "title": "해결 방안", "subtitle": "Solution", "required": true, "max_chars": 2000, "order": 3, "description": "제안하는 솔루션"},
      {"key": "market_research", "title": "목표 시장", "subtitle": "Target Market", "required": true, "max_chars": 2000, "order": 4, "description": "타겟 고객과 시장 규모"},
      {"key": "business_model", "title": "수익 모델", "subtitle": "Revenue Model", "required": true, "max_chars": 1500, "order": 5, "description": "어떻게 돈을 벌 것인지"},
      {"key": "fund_usage", "title": "자금 계획", "subtitle": "Budget", "required": true, "max_chars": 1500, "order": 6, "description": "지원금 사용 계획"},
      {"key": "expected_outcomes", "title": "목표 성과", "subtitle": "Goals", "required": true, "max_chars": 1000, "order": 7, "description": "1년 내 달성 목표"}
    ]'::jsonb,
    ARRAY['예비창업', '청년창업']
)
ON CONFLICT DO NOTHING;

-- Updated_at 트리거
CREATE OR REPLACE FUNCTION update_business_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_business_plans_updated_at
    BEFORE UPDATE ON business_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_business_plans_updated_at();

CREATE TRIGGER trigger_program_applications_updated_at
    BEFORE UPDATE ON program_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_business_plans_updated_at();

-- 템플릿 사용 카운트 증가 함수
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE business_plan_templates
    SET usage_count = usage_count + 1, updated_at = NOW()
    WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;
