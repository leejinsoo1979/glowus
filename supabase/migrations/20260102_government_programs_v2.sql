-- 정부지원사업 AI 플랫폼 v2 스키마
-- Phase 1: 대시보드 통계 + Phase 2: 회사 프로필 + Phase 3: 사업계획서

-- =====================================================
-- 1. 통계 캐시 테이블 (대시보드용)
-- =====================================================
CREATE TABLE IF NOT EXISTS program_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 집계 기간
    period_type VARCHAR(20) NOT NULL,       -- daily/weekly/monthly
    period_date DATE NOT NULL,

    -- 카운트
    total_programs INTEGER DEFAULT 0,
    active_programs INTEGER DEFAULT 0,
    ending_soon_programs INTEGER DEFAULT 0,  -- 7일 내 마감
    upcoming_programs INTEGER DEFAULT 0,     -- 예정

    -- 출처별 분포
    source_counts JSONB DEFAULT '{}',        -- {"bizinfo": 500, "kstartup": 300, "semas": 100}

    -- 카테고리별 분포
    category_counts JSONB DEFAULT '{}',      -- {"금융": 100, "기술": 200, "창업": 150}

    -- 상태별 분포
    status_counts JSONB DEFAULT '{}',        -- {"active": 500, "ended": 200, "upcoming": 100}

    -- 월별 트렌드 (최근 12개월)
    monthly_trend JSONB DEFAULT '[]',        -- [{month: "2025-01", count: 150}, ...]

    -- 지역별 분포
    region_counts JSONB DEFAULT '{}',        -- {"서울": 200, "경기": 150, ...}

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(period_type, period_date)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_program_statistics_period
    ON program_statistics(period_type, period_date DESC);

-- =====================================================
-- 2. government_programs 테이블 확장
-- =====================================================
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS eligibility_criteria JSONB;
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS support_amount VARCHAR(200);
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS support_type VARCHAR(100);
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS application_method TEXT;
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS required_documents TEXT[];
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS application_form_url TEXT;
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS target_industries TEXT[];
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS target_regions TEXT[];
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS target_scales JSONB;
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE government_programs ADD COLUMN IF NOT EXISTS bookmark_count INTEGER DEFAULT 0;

-- =====================================================
-- 3. 회사 지원사업 프로필 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS company_support_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,

    -- 사업 분류
    industry_code VARCHAR(10),              -- KSIC 표준산업분류코드
    industry_category VARCHAR(100),         -- 업종 카테고리
    industry_subcategory VARCHAR(100),      -- 세부 업종

    -- 사업 규모
    annual_revenue DECIMAL(15,2),           -- 연 매출액
    employee_count INTEGER,                 -- 직원 수
    business_years INTEGER,                 -- 업력 (년)

    -- 사업자 유형
    entity_type VARCHAR(50),                -- 법인/개인/예비창업자
    startup_stage VARCHAR(50),              -- 예비/초기/도약/성장

    -- 지역
    region VARCHAR(50),                     -- 시/도
    city VARCHAR(50),                       -- 시/군/구

    -- 특수 조건
    is_youth_startup BOOLEAN DEFAULT false,      -- 청년창업
    is_female_owned BOOLEAN DEFAULT false,       -- 여성기업
    is_social_enterprise BOOLEAN DEFAULT false,  -- 사회적기업
    is_export_business BOOLEAN DEFAULT false,    -- 수출기업
    tech_certifications TEXT[],                  -- 기술인증 (벤처/이노비즈 등)

    -- 관심 분야
    interested_categories TEXT[],           -- 관심 분야 (금융/기술/인력 등)
    interested_keywords TEXT[],             -- 관심 키워드

    -- 메타데이터
    profile_completeness INTEGER DEFAULT 0, -- 프로필 완성도 (0-100)
    last_matched_at TIMESTAMPTZ,           -- 마지막 매칭 시간

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_company_support_profiles_user
    ON company_support_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_company_support_profiles_industry
    ON company_support_profiles(industry_category);
CREATE INDEX IF NOT EXISTS idx_company_support_profiles_region
    ON company_support_profiles(region);

-- =====================================================
-- 4. 사업계획서 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS business_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    user_id UUID NOT NULL,
    program_id UUID REFERENCES government_programs(id) ON DELETE SET NULL,

    -- 기본 정보
    title VARCHAR(500),

    -- 섹션별 내용 (JSONB)
    sections JSONB DEFAULT '{}',
    /*
    {
      "executive_summary": "...",
      "company_overview": "...",
      "problem_statement": "...",
      "solution": "...",
      "market_research": {
        "industry_trends": "...",
        "market_size": "...",
        "competitors": "...",
        "target_market": "..."
      },
      "business_model": "...",
      "revenue_plan": "...",
      "team_introduction": "...",
      "financial_plan": "...",
      "fund_usage": "...",
      "expected_outcomes": "..."
    }
    */

    -- AI 생성 메타데이터
    ai_model VARCHAR(100),
    generation_prompt TEXT,
    web_search_results JSONB,               -- 시장조사 검색 결과

    -- 버전 관리
    version INTEGER DEFAULT 1,
    parent_id UUID REFERENCES business_plans(id) ON DELETE SET NULL,

    -- 상태
    status VARCHAR(50) DEFAULT 'draft',     -- draft/in_progress/completed/submitted

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_business_plans_user ON business_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_business_plans_program ON business_plans(program_id);
CREATE INDEX IF NOT EXISTS idx_business_plans_status ON business_plans(status);

-- =====================================================
-- 5. 프로그램 신청 추적 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS program_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    user_id UUID NOT NULL,
    program_id UUID NOT NULL REFERENCES government_programs(id) ON DELETE CASCADE,
    business_plan_id UUID REFERENCES business_plans(id) ON DELETE SET NULL,

    -- 상태
    status VARCHAR(50) DEFAULT 'interested', -- interested/preparing/submitted/reviewing/approved/rejected

    -- AI 매칭 정보
    fit_score DECIMAL(5,2),                 -- 적합도 점수 (0-100)
    fit_reasons JSONB,                      -- 적합 이유 분석
    /*
    {
      "industry_match": 30,
      "scale_match": 20,
      "region_match": 15,
      "type_match": 15,
      "special_match": 20,
      "reasons": ["업종이 정확히 일치", "매출 규모 적합", ...]
    }
    */

    -- 타임라인
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    result_at TIMESTAMPTZ,

    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, program_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_program_applications_user ON program_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_program_applications_program ON program_applications(program_id);
CREATE INDEX IF NOT EXISTS idx_program_applications_status ON program_applications(status);
CREATE INDEX IF NOT EXISTS idx_program_applications_fit_score ON program_applications(fit_score DESC);

-- =====================================================
-- 6. 프로그램 북마크 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS program_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    program_id UUID NOT NULL REFERENCES government_programs(id) ON DELETE CASCADE,

    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_program_bookmarks_user ON program_bookmarks(user_id);

-- =====================================================
-- 7. RLS 정책
-- =====================================================

-- company_support_profiles
ALTER TABLE company_support_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own support profile"
    ON company_support_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own support profile"
    ON company_support_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own support profile"
    ON company_support_profiles FOR UPDATE
    USING (auth.uid() = user_id);

-- business_plans
ALTER TABLE business_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own business plans"
    ON business_plans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own business plans"
    ON business_plans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business plans"
    ON business_plans FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own business plans"
    ON business_plans FOR DELETE
    USING (auth.uid() = user_id);

-- program_applications
ALTER TABLE program_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own applications"
    ON program_applications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own applications"
    ON program_applications FOR ALL
    USING (auth.uid() = user_id);

-- program_bookmarks
ALTER TABLE program_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bookmarks"
    ON program_bookmarks FOR ALL
    USING (auth.uid() = user_id);

-- program_statistics (public read)
ALTER TABLE program_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view statistics"
    ON program_statistics FOR SELECT
    TO authenticated
    USING (true);

-- =====================================================
-- 8. 트리거: updated_at 자동 업데이트
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_company_support_profiles_updated_at ON company_support_profiles;
CREATE TRIGGER update_company_support_profiles_updated_at
    BEFORE UPDATE ON company_support_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_business_plans_updated_at ON business_plans;
CREATE TRIGGER update_business_plans_updated_at
    BEFORE UPDATE ON business_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_program_applications_updated_at ON program_applications;
CREATE TRIGGER update_program_applications_updated_at
    BEFORE UPDATE ON program_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. 초기 통계 데이터 생성 함수
-- =====================================================
CREATE OR REPLACE FUNCTION refresh_program_statistics()
RETURNS void AS $$
DECLARE
    today DATE := CURRENT_DATE;
    total_count INTEGER;
    active_count INTEGER;
    ending_soon_count INTEGER;
    upcoming_count INTEGER;
    source_json JSONB;
    category_json JSONB;
    status_json JSONB;
    trend_json JSONB;
    region_json JSONB;
BEGIN
    -- 전체 수
    SELECT COUNT(*) INTO total_count FROM government_programs WHERE archived = false OR archived IS NULL;

    -- 진행중 (apply_start_date <= today <= apply_end_date)
    SELECT COUNT(*) INTO active_count
    FROM government_programs
    WHERE (archived = false OR archived IS NULL)
      AND apply_start_date <= today
      AND apply_end_date >= today;

    -- 7일 내 마감
    SELECT COUNT(*) INTO ending_soon_count
    FROM government_programs
    WHERE (archived = false OR archived IS NULL)
      AND apply_end_date >= today
      AND apply_end_date <= today + INTERVAL '7 days';

    -- 예정 (apply_start_date > today)
    SELECT COUNT(*) INTO upcoming_count
    FROM government_programs
    WHERE (archived = false OR archived IS NULL)
      AND apply_start_date > today;

    -- 출처별 분포
    SELECT COALESCE(jsonb_object_agg(source, cnt), '{}') INTO source_json
    FROM (
        SELECT source, COUNT(*) as cnt
        FROM government_programs
        WHERE archived = false OR archived IS NULL
        GROUP BY source
    ) s;

    -- 카테고리별 분포
    SELECT COALESCE(jsonb_object_agg(category, cnt), '{}') INTO category_json
    FROM (
        SELECT COALESCE(category, '기타') as category, COUNT(*) as cnt
        FROM government_programs
        WHERE archived = false OR archived IS NULL
        GROUP BY category
    ) c;

    -- 상태별 분포
    status_json := jsonb_build_object(
        'active', active_count,
        'ending_soon', ending_soon_count,
        'upcoming', upcoming_count,
        'ended', total_count - active_count - upcoming_count
    );

    -- 월별 트렌드 (최근 12개월)
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]') INTO trend_json
    FROM (
        SELECT
            TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
            COUNT(*) as count
        FROM government_programs
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
    ) t;

    -- 통계 저장 (upsert)
    INSERT INTO program_statistics (
        period_type, period_date, total_programs, active_programs,
        ending_soon_programs, upcoming_programs, source_counts,
        category_counts, status_counts, monthly_trend
    ) VALUES (
        'daily', today, total_count, active_count,
        ending_soon_count, upcoming_count, source_json,
        category_json, status_json, trend_json
    )
    ON CONFLICT (period_type, period_date)
    DO UPDATE SET
        total_programs = EXCLUDED.total_programs,
        active_programs = EXCLUDED.active_programs,
        ending_soon_programs = EXCLUDED.ending_soon_programs,
        upcoming_programs = EXCLUDED.upcoming_programs,
        source_counts = EXCLUDED.source_counts,
        category_counts = EXCLUDED.category_counts,
        status_counts = EXCLUDED.status_counts,
        monthly_trend = EXCLUDED.monthly_trend,
        created_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 초기 통계 생성
SELECT refresh_program_statistics();
