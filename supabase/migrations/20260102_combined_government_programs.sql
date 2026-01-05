-- =====================================================
-- 정부지원사업 AI 플랫폼 통합 마이그레이션
-- =====================================================

-- 1. 정부지원사업 공고 테이블
CREATE TABLE IF NOT EXISTS government_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id VARCHAR(100) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    category VARCHAR(50),
    hashtags TEXT[],
    organization VARCHAR(200),
    executing_agency VARCHAR(200),
    reception_agency VARCHAR(200),
    apply_start_date DATE,
    apply_end_date DATE,
    detail_url TEXT,
    source VARCHAR(50) DEFAULT 'bizinfo',
    archived BOOLEAN DEFAULT false,
    eligibility_criteria JSONB,
    support_amount VARCHAR(200),
    support_type VARCHAR(100),
    application_method TEXT,
    required_documents TEXT[],
    application_form_url TEXT,
    ai_summary TEXT,
    target_industries TEXT[],
    target_regions TEXT[],
    target_scales JSONB,
    view_count INTEGER DEFAULT 0,
    bookmark_count INTEGER DEFAULT 0,
    contact_phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_government_programs_category ON government_programs(category);
CREATE INDEX IF NOT EXISTS idx_government_programs_apply_end_date ON government_programs(apply_end_date);
CREATE INDEX IF NOT EXISTS idx_government_programs_source ON government_programs(source);
CREATE INDEX IF NOT EXISTS idx_government_programs_created_at ON government_programs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_government_programs_archived ON government_programs(archived);

-- 2. 통계 캐시 테이블
CREATE TABLE IF NOT EXISTS program_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_type VARCHAR(20) NOT NULL,
    period_date DATE NOT NULL,
    total_programs INTEGER DEFAULT 0,
    active_programs INTEGER DEFAULT 0,
    ending_soon_programs INTEGER DEFAULT 0,
    upcoming_programs INTEGER DEFAULT 0,
    source_counts JSONB DEFAULT '{}',
    category_counts JSONB DEFAULT '{}',
    status_counts JSONB DEFAULT '{}',
    monthly_trend JSONB DEFAULT '[]',
    region_counts JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_type, period_date)
);

CREATE INDEX IF NOT EXISTS idx_program_statistics_period ON program_statistics(period_type, period_date DESC);

-- 3. 회사 지원사업 프로필 테이블
CREATE TABLE IF NOT EXISTS company_support_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    industry_code VARCHAR(10),
    industry_category VARCHAR(100),
    industry_subcategory VARCHAR(100),
    annual_revenue DECIMAL(15,2),
    employee_count INTEGER,
    business_years INTEGER,
    entity_type VARCHAR(50),
    startup_stage VARCHAR(50),
    region VARCHAR(50),
    city VARCHAR(50),
    is_youth_startup BOOLEAN DEFAULT false,
    is_female_owned BOOLEAN DEFAULT false,
    is_social_enterprise BOOLEAN DEFAULT false,
    is_export_business BOOLEAN DEFAULT false,
    tech_certifications TEXT[],
    interested_categories TEXT[],
    interested_keywords TEXT[],
    profile_completeness INTEGER DEFAULT 0,
    last_matched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_support_profiles_user ON company_support_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_company_support_profiles_industry ON company_support_profiles(industry_category);
CREATE INDEX IF NOT EXISTS idx_company_support_profiles_region ON company_support_profiles(region);

-- 4. 사업계획서 테이블
CREATE TABLE IF NOT EXISTS business_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    user_id UUID NOT NULL,
    program_id UUID REFERENCES government_programs(id) ON DELETE SET NULL,
    title VARCHAR(500),
    status VARCHAR(50) DEFAULT 'draft',
    version INTEGER DEFAULT 1,
    parent_id UUID,
    sections JSONB DEFAULT '{}'::jsonb,
    ai_model VARCHAR(100),
    generation_prompt TEXT,
    ai_generation_log JSONB DEFAULT '[]'::jsonb,
    web_search_results JSONB DEFAULT '[]'::jsonb,
    is_template BOOLEAN DEFAULT false,
    template_name VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_business_plans_user ON business_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_business_plans_program ON business_plans(program_id);
CREATE INDEX IF NOT EXISTS idx_business_plans_status ON business_plans(status);
CREATE INDEX IF NOT EXISTS idx_business_plans_created_at ON business_plans(created_at DESC);

-- 5. 프로그램 신청 추적 테이블
CREATE TABLE IF NOT EXISTS program_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    user_id UUID NOT NULL,
    program_id UUID NOT NULL REFERENCES government_programs(id) ON DELETE CASCADE,
    business_plan_id UUID REFERENCES business_plans(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'interested',
    fit_score DECIMAL(5,2),
    fit_reasons JSONB DEFAULT '{}'::jsonb,
    application_number VARCHAR(100),
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    result_at TIMESTAMPTZ,
    result_announced_at TIMESTAMPTZ,
    notes TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_program_applications_user ON program_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_program_applications_program ON program_applications(program_id);
CREATE INDEX IF NOT EXISTS idx_program_applications_status ON program_applications(status);
CREATE INDEX IF NOT EXISTS idx_program_applications_fit_score ON program_applications(fit_score DESC);

-- 6. 프로그램 북마크 테이블
CREATE TABLE IF NOT EXISTS program_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    program_id UUID NOT NULL REFERENCES government_programs(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_program_bookmarks_user ON program_bookmarks(user_id);

-- 7. 사용자별 알림 설정 테이블
CREATE TABLE IF NOT EXISTS government_program_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    categories TEXT[] DEFAULT '{}',
    keywords TEXT[] DEFAULT '{}',
    push_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 8. 알림 히스토리 테이블
CREATE TABLE IF NOT EXISTS government_program_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    program_id UUID NOT NULL REFERENCES government_programs(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT false,
    notified_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    UNIQUE(user_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_program_notifications_user ON government_program_notifications(user_id, is_read);

-- 9. Cron 작업 로그 테이블
CREATE TABLE IF NOT EXISTS cron_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_logs_job_name ON cron_logs(job_name, created_at DESC);

-- 10. 사업계획서 섹션 템플릿
CREATE TABLE IF NOT EXISTS business_plan_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    section_structure JSONB NOT NULL,
    target_program_types TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. 시장조사 캐시 테이블
CREATE TABLE IF NOT EXISTS market_research_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry_code VARCHAR(20),
    keywords TEXT[],
    search_hash VARCHAR(64) UNIQUE,
    research_data JSONB NOT NULL,
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_market_research_cache_hash ON market_research_cache(search_hash);
CREATE INDEX IF NOT EXISTS idx_market_research_cache_expires ON market_research_cache(expires_at);

-- =====================================================
-- RLS 정책
-- =====================================================

ALTER TABLE government_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_support_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE government_program_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE government_program_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_research_cache ENABLE ROW LEVEL SECURITY;

-- 공고는 모든 인증된 사용자가 조회 가능
DROP POLICY IF EXISTS "Anyone can view programs" ON government_programs;
CREATE POLICY "Anyone can view programs" ON government_programs FOR SELECT USING (true);

-- 통계는 인증된 사용자가 조회 가능
DROP POLICY IF EXISTS "Anyone can view statistics" ON program_statistics;
CREATE POLICY "Anyone can view statistics" ON program_statistics FOR SELECT TO authenticated USING (true);

-- 지원 프로필은 본인만
DROP POLICY IF EXISTS "Users can view own support profile" ON company_support_profiles;
CREATE POLICY "Users can view own support profile" ON company_support_profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own support profile" ON company_support_profiles;
CREATE POLICY "Users can insert own support profile" ON company_support_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own support profile" ON company_support_profiles;
CREATE POLICY "Users can update own support profile" ON company_support_profiles FOR UPDATE USING (auth.uid() = user_id);

-- 사업계획서는 본인만
DROP POLICY IF EXISTS "Users can view own business plans" ON business_plans;
CREATE POLICY "Users can view own business plans" ON business_plans FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own business plans" ON business_plans;
CREATE POLICY "Users can insert own business plans" ON business_plans FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own business plans" ON business_plans;
CREATE POLICY "Users can update own business plans" ON business_plans FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own business plans" ON business_plans;
CREATE POLICY "Users can delete own business plans" ON business_plans FOR DELETE USING (auth.uid() = user_id);

-- 신청 추적은 본인만
DROP POLICY IF EXISTS "Users can view own applications" ON program_applications;
CREATE POLICY "Users can view own applications" ON program_applications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own applications" ON program_applications;
CREATE POLICY "Users can manage own applications" ON program_applications FOR ALL USING (auth.uid() = user_id);

-- 북마크는 본인만
DROP POLICY IF EXISTS "Users can manage own bookmarks" ON program_bookmarks;
CREATE POLICY "Users can manage own bookmarks" ON program_bookmarks FOR ALL USING (auth.uid() = user_id);

-- 구독 설정은 본인만
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON government_program_subscriptions;
CREATE POLICY "Users can manage own subscriptions" ON government_program_subscriptions FOR ALL USING (auth.uid() = user_id);

-- 알림은 본인만
DROP POLICY IF EXISTS "Users can manage own notifications" ON government_program_notifications;
CREATE POLICY "Users can manage own notifications" ON government_program_notifications FOR ALL USING (auth.uid() = user_id);

-- 템플릿은 활성화된 것만 조회 가능
DROP POLICY IF EXISTS "Anyone can view active templates" ON business_plan_templates;
CREATE POLICY "Anyone can view active templates" ON business_plan_templates FOR SELECT USING (is_active = true);

-- 시장조사 캐시는 유효기간 내만
DROP POLICY IF EXISTS "Anyone can read cache" ON market_research_cache;
CREATE POLICY "Anyone can read cache" ON market_research_cache FOR SELECT USING (expires_at > NOW());

-- =====================================================
-- 트리거 함수
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
-- 통계 갱신 함수
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
BEGIN
    SELECT COUNT(*) INTO total_count FROM government_programs WHERE archived = false OR archived IS NULL;

    SELECT COUNT(*) INTO active_count
    FROM government_programs
    WHERE (archived = false OR archived IS NULL)
      AND apply_start_date <= today
      AND apply_end_date >= today;

    SELECT COUNT(*) INTO ending_soon_count
    FROM government_programs
    WHERE (archived = false OR archived IS NULL)
      AND apply_end_date >= today
      AND apply_end_date <= today + INTERVAL '7 days';

    SELECT COUNT(*) INTO upcoming_count
    FROM government_programs
    WHERE (archived = false OR archived IS NULL)
      AND apply_start_date > today;

    SELECT COALESCE(jsonb_object_agg(source, cnt), '{}') INTO source_json
    FROM (
        SELECT source, COUNT(*) as cnt
        FROM government_programs
        WHERE archived = false OR archived IS NULL
        GROUP BY source
    ) s;

    SELECT COALESCE(jsonb_object_agg(category, cnt), '{}') INTO category_json
    FROM (
        SELECT COALESCE(category, '기타') as category, COUNT(*) as cnt
        FROM government_programs
        WHERE archived = false OR archived IS NULL
        GROUP BY category
    ) c;

    status_json := jsonb_build_object(
        'active', active_count,
        'ending_soon', ending_soon_count,
        'upcoming', upcoming_count,
        'ended', total_count - active_count - upcoming_count
    );

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

-- =====================================================
-- 기본 템플릿 삽입
-- =====================================================

INSERT INTO business_plan_templates (name, description, section_structure, target_program_types) VALUES
(
    '중소기업 지원사업 기본 템플릿',
    '중소벤처기업부 지원사업 신청용 기본 사업계획서 템플릿',
    '[
      {"key": "executive_summary", "title": "사업 요약", "subtitle": "Executive Summary", "required": true, "max_chars": 2000, "order": 1},
      {"key": "company_overview", "title": "회사 개요", "subtitle": "Company Overview", "required": true, "max_chars": 3000, "order": 2},
      {"key": "problem_statement", "title": "문제 정의", "subtitle": "Problem Statement", "required": true, "max_chars": 2000, "order": 3},
      {"key": "solution", "title": "해결책", "subtitle": "Solution", "required": true, "max_chars": 3000, "order": 4},
      {"key": "market_research", "title": "시장 분석", "subtitle": "Market Research", "required": true, "max_chars": 4000, "order": 5},
      {"key": "business_model", "title": "비즈니스 모델", "subtitle": "Business Model", "required": true, "max_chars": 2500, "order": 6},
      {"key": "team_introduction", "title": "팀 소개", "subtitle": "Team", "required": true, "max_chars": 2000, "order": 7},
      {"key": "financial_plan", "title": "재무 계획", "subtitle": "Financial Plan", "required": true, "max_chars": 3000, "order": 8},
      {"key": "fund_usage", "title": "자금 사용 계획", "subtitle": "Fund Usage", "required": true, "max_chars": 2000, "order": 9},
      {"key": "expected_outcomes", "title": "기대 효과", "subtitle": "Expected Outcomes", "required": true, "max_chars": 2000, "order": 10}
    ]'::jsonb,
    ARRAY['창업지원', '기술개발', 'R&D', '스케일업']
),
(
    '예비창업자 간소화 템플릿',
    '예비창업패키지 등 예비창업자용 간소화 템플릿',
    '[
      {"key": "executive_summary", "title": "사업 아이디어", "subtitle": "Business Idea", "required": true, "max_chars": 1500, "order": 1},
      {"key": "problem_statement", "title": "문제 인식", "subtitle": "Problem", "required": true, "max_chars": 1500, "order": 2},
      {"key": "solution", "title": "해결 방안", "subtitle": "Solution", "required": true, "max_chars": 2000, "order": 3},
      {"key": "market_research", "title": "목표 시장", "subtitle": "Target Market", "required": true, "max_chars": 2000, "order": 4},
      {"key": "business_model", "title": "수익 모델", "subtitle": "Revenue Model", "required": true, "max_chars": 1500, "order": 5},
      {"key": "fund_usage", "title": "자금 계획", "subtitle": "Budget", "required": true, "max_chars": 1500, "order": 6},
      {"key": "expected_outcomes", "title": "목표 성과", "subtitle": "Goals", "required": true, "max_chars": 1000, "order": 7}
    ]'::jsonb,
    ARRAY['예비창업', '청년창업']
)
ON CONFLICT DO NOTHING;
