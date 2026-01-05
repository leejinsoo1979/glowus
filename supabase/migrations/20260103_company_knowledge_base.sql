-- =====================================================
-- 회사 지식베이스 시스템 (Company Knowledge Base)
-- 사업계획서 자동생성을 위한 실제 회사 데이터 저장소
-- =====================================================

-- 1. 회사 지식베이스 메인 테이블 (자유형식 데이터)
CREATE TABLE IF NOT EXISTS company_knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    -- 카테고리 분류
    category VARCHAR(50) NOT NULL,  -- company_info, product, team, achievement, financial, market, etc.
    subcategory VARCHAR(100),       -- 세부 분류

    -- 콘텐츠
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,          -- 본문 내용
    summary TEXT,                   -- AI 요약본

    -- 메타데이터
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',    -- 추가 구조화 데이터

    -- 소스 정보
    source_type VARCHAR(50),        -- manual, document, url, ai_extracted
    source_url TEXT,
    source_file_path TEXT,

    -- 상태
    is_verified BOOLEAN DEFAULT false,
    verification_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,

    -- 임베딩 (RAG용)
    embedding vector(1536),

    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 팀 멤버 프로필 테이블
CREATE TABLE IF NOT EXISTS company_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    -- 기본 정보
    name VARCHAR(100) NOT NULL,
    position VARCHAR(100),          -- 직책
    role VARCHAR(100),              -- 역할 (CEO, CTO, 개발팀장 등)
    department VARCHAR(100),

    -- 경력/학력
    career_history JSONB DEFAULT '[]',  -- [{company, position, period, description}]
    education JSONB DEFAULT '[]',       -- [{school, degree, major, year}]

    -- 전문성
    expertise TEXT[],               -- 전문 분야 키워드
    skills TEXT[],                  -- 보유 스킬
    certifications JSONB DEFAULT '[]',  -- [{name, issuer, date}]

    -- 실적
    achievements TEXT,              -- 주요 성과
    publications TEXT[],            -- 논문/저서
    patents TEXT[],                 -- 보유 특허

    -- 연락처 (선택)
    email VARCHAR(200),
    linkedin_url TEXT,

    -- 프로필
    bio TEXT,                       -- 간단 소개
    photo_url TEXT,

    -- 상태
    is_key_member BOOLEAN DEFAULT false,  -- 핵심 인력 여부
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 제품/서비스 정보 테이블
CREATE TABLE IF NOT EXISTS company_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    -- 기본 정보
    name VARCHAR(200) NOT NULL,
    product_type VARCHAR(50),       -- product, service, solution, platform
    category VARCHAR(100),          -- 제품 분야

    -- 상세 정보
    description TEXT,               -- 제품 설명
    key_features JSONB DEFAULT '[]',  -- 핵심 기능 리스트
    target_customers TEXT,          -- 타겟 고객
    use_cases TEXT[],               -- 활용 사례

    -- 기술 정보
    core_technology TEXT,           -- 핵심 기술
    tech_stack TEXT[],              -- 사용 기술 스택
    patents TEXT[],                 -- 관련 특허

    -- 비즈니스 정보
    pricing_model VARCHAR(100),     -- 가격 모델 (구독, 일회성, 프리미엄 등)
    price_range VARCHAR(100),       -- 가격대
    launch_date DATE,               -- 출시일
    development_stage VARCHAR(50),  -- 개발단계 (idea, mvp, beta, launched)

    -- 실적
    user_count INTEGER,
    revenue_contribution DECIMAL(5,2),  -- 매출 기여도 %
    customer_testimonials JSONB DEFAULT '[]',

    -- 미디어
    product_images JSONB DEFAULT '[]',
    demo_url TEXT,
    documentation_url TEXT,

    -- 상태
    is_flagship BOOLEAN DEFAULT false,  -- 주력 제품 여부
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 회사 성과/수상 테이블
CREATE TABLE IF NOT EXISTS company_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    -- 성과 유형
    achievement_type VARCHAR(50) NOT NULL,  -- award, certification, partnership, milestone, media, patent

    -- 기본 정보
    title VARCHAR(300) NOT NULL,
    description TEXT,

    -- 상세 정보
    issuer VARCHAR(200),            -- 수여 기관
    date DATE,
    expiry_date DATE,               -- 만료일 (인증의 경우)

    -- 관련 정보
    related_product_id UUID REFERENCES company_products(id),
    related_project VARCHAR(200),

    -- 증빙
    certificate_url TEXT,
    news_url TEXT,
    evidence_files JSONB DEFAULT '[]',

    -- 카테고리
    category VARCHAR(100),          -- 분야 (기술, 경영, 사회공헌 등)
    tags TEXT[],

    -- 중요도
    importance_level INTEGER DEFAULT 1,  -- 1-5
    is_featured BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 재무 정보 테이블
CREATE TABLE IF NOT EXISTS company_financials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    -- 기간
    fiscal_year INTEGER NOT NULL,
    fiscal_quarter INTEGER,         -- null이면 연간

    -- 손익
    revenue DECIMAL(15,2),          -- 매출액
    operating_profit DECIMAL(15,2), -- 영업이익
    net_profit DECIMAL(15,2),       -- 순이익

    -- 비용 구조
    cost_breakdown JSONB DEFAULT '{}',  -- {인건비: x, 운영비: y, ...}

    -- 자산
    total_assets DECIMAL(15,2),
    total_liabilities DECIMAL(15,2),
    equity DECIMAL(15,2),

    -- 투자
    investments_received JSONB DEFAULT '[]',  -- [{investor, amount, date, round}]

    -- 성장률
    yoy_revenue_growth DECIMAL(5,2),
    yoy_profit_growth DECIMAL(5,2),

    -- 기타 지표
    employee_count INTEGER,
    customer_count INTEGER,

    -- 검증
    is_audited BOOLEAN DEFAULT false,
    auditor VARCHAR(200),

    -- 메모
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, fiscal_year, fiscal_quarter)
);

-- 6. 지원사업 요구사항 분석 테이블
CREATE TABLE IF NOT EXISTS program_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES government_programs(id) ON DELETE CASCADE,

    -- 파싱된 요구사항
    eligibility_criteria JSONB DEFAULT '{}',  -- 지원 자격 조건
    /*
    {
        "business_type": ["법인", "개인사업자"],
        "business_age": {"min": 0, "max": 7},
        "employee_count": {"min": 1, "max": 50},
        "revenue_cap": 10000000000,
        "region": ["전국"],
        "industry": ["제조업", "서비스업"],
        "exclusions": ["상장기업", "휴폐업"]
    }
    */

    -- 평가 기준
    evaluation_criteria JSONB DEFAULT '[]',  -- 평가 항목 및 배점
    /*
    [
        {"category": "기술성", "weight": 30, "items": [...]},
        {"category": "사업성", "weight": 25, "items": [...]},
        {"category": "성장성", "weight": 25, "items": [...]},
        {"category": "대표자역량", "weight": 20, "items": [...]}
    ]
    */

    -- 필요 서류
    required_documents JSONB DEFAULT '[]',
    /*
    [
        {"name": "사업계획서", "required": true, "format": "hwp/pdf", "max_pages": 20},
        {"name": "사업자등록증", "required": true},
        ...
    ]
    */

    -- 사업계획서 형식 요건
    plan_format_requirements JSONB DEFAULT '{}',
    /*
    {
        "max_pages": 20,
        "font_size": 11,
        "line_spacing": 160,
        "required_sections": ["사업개요", "시장분석", "재무계획"],
        "template_url": "..."
    }
    */

    -- 작성 팁/가이드
    writing_tips JSONB DEFAULT '[]',

    -- 우수 사례
    success_case_keywords TEXT[],

    -- 주의사항
    cautions TEXT[],

    -- AI 분석 메타데이터
    parsed_at TIMESTAMPTZ DEFAULT NOW(),
    parsed_by VARCHAR(100),         -- ai_model or manual
    confidence_score DECIMAL(5,2),
    source_urls TEXT[],

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(program_id)
);

-- 7. 시장 조사 데이터 (회사별)
CREATE TABLE IF NOT EXISTS company_market_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    -- 시장 정보
    industry_code VARCHAR(20),
    industry_name VARCHAR(200),

    -- 시장 규모
    tam DECIMAL(15,2),              -- Total Addressable Market (억원)
    sam DECIMAL(15,2),              -- Serviceable Addressable Market
    som DECIMAL(15,2),              -- Serviceable Obtainable Market
    market_size_year INTEGER,       -- 기준 연도

    -- 성장률
    market_growth_rate DECIMAL(5,2),  -- 연평균 성장률 %

    -- 경쟁 분석
    competitors JSONB DEFAULT '[]',
    /*
    [
        {
            "name": "경쟁사A",
            "market_share": 25.5,
            "strengths": [...],
            "weaknesses": [...],
            "products": [...]
        }
    ]
    */

    -- SWOT 분석
    swot_analysis JSONB DEFAULT '{}',

    -- 트렌드
    market_trends TEXT[],
    opportunities TEXT[],
    threats TEXT[],

    -- 데이터 소스
    data_sources JSONB DEFAULT '[]',  -- [{name, url, date}]

    -- 유효성
    data_as_of DATE,
    expires_at DATE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 인덱스
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_user ON company_knowledge_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_company ON company_knowledge_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_category ON company_knowledge_entries(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_active ON company_knowledge_entries(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_team_members_company ON company_team_members(company_id);
CREATE INDEX IF NOT EXISTS idx_team_members_key ON company_team_members(is_key_member) WHERE is_key_member = true;

CREATE INDEX IF NOT EXISTS idx_products_company ON company_products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_flagship ON company_products(is_flagship) WHERE is_flagship = true;

CREATE INDEX IF NOT EXISTS idx_achievements_company ON company_achievements(company_id);
CREATE INDEX IF NOT EXISTS idx_achievements_type ON company_achievements(achievement_type);

CREATE INDEX IF NOT EXISTS idx_financials_company_year ON company_financials(company_id, fiscal_year DESC);

CREATE INDEX IF NOT EXISTS idx_program_requirements_program ON program_requirements(program_id);

CREATE INDEX IF NOT EXISTS idx_market_data_company ON company_market_data(company_id);
CREATE INDEX IF NOT EXISTS idx_market_data_industry ON company_market_data(industry_code);

-- =====================================================
-- RLS 정책
-- =====================================================

ALTER TABLE company_knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_market_data ENABLE ROW LEVEL SECURITY;

-- 지식베이스 RLS
CREATE POLICY "Users can manage own knowledge entries"
    ON company_knowledge_entries FOR ALL
    USING (auth.uid() = user_id);

-- 팀 멤버 RLS
CREATE POLICY "Users can manage own team members"
    ON company_team_members FOR ALL
    USING (auth.uid() = user_id);

-- 제품 RLS
CREATE POLICY "Users can manage own products"
    ON company_products FOR ALL
    USING (auth.uid() = user_id);

-- 성과 RLS
CREATE POLICY "Users can manage own achievements"
    ON company_achievements FOR ALL
    USING (auth.uid() = user_id);

-- 재무 RLS
CREATE POLICY "Users can manage own financials"
    ON company_financials FOR ALL
    USING (auth.uid() = user_id);

-- 프로그램 요구사항은 모두 읽기 가능
CREATE POLICY "Anyone can read program requirements"
    ON program_requirements FOR SELECT
    USING (true);

-- 시장 데이터 RLS
CREATE POLICY "Users can manage own market data"
    ON company_market_data FOR ALL
    USING (auth.uid() = user_id);

-- =====================================================
-- 트리거
-- =====================================================

CREATE OR REPLACE FUNCTION update_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_knowledge_entries_updated
    BEFORE UPDATE ON company_knowledge_entries
    FOR EACH ROW EXECUTE FUNCTION update_knowledge_updated_at();

CREATE TRIGGER trigger_team_members_updated
    BEFORE UPDATE ON company_team_members
    FOR EACH ROW EXECUTE FUNCTION update_knowledge_updated_at();

CREATE TRIGGER trigger_products_updated
    BEFORE UPDATE ON company_products
    FOR EACH ROW EXECUTE FUNCTION update_knowledge_updated_at();

CREATE TRIGGER trigger_achievements_updated
    BEFORE UPDATE ON company_achievements
    FOR EACH ROW EXECUTE FUNCTION update_knowledge_updated_at();

CREATE TRIGGER trigger_financials_updated
    BEFORE UPDATE ON company_financials
    FOR EACH ROW EXECUTE FUNCTION update_knowledge_updated_at();

CREATE TRIGGER trigger_market_data_updated
    BEFORE UPDATE ON company_market_data
    FOR EACH ROW EXECUTE FUNCTION update_knowledge_updated_at();

-- =====================================================
-- 헬퍼 함수
-- =====================================================

-- 회사의 지식베이스 완성도 계산
CREATE OR REPLACE FUNCTION get_knowledge_base_completeness(p_company_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    total_score INTEGER := 0;
    max_score INTEGER := 100;
BEGIN
    SELECT jsonb_build_object(
        'has_team_members', EXISTS(SELECT 1 FROM company_team_members WHERE company_id = p_company_id AND is_active = true),
        'has_products', EXISTS(SELECT 1 FROM company_products WHERE company_id = p_company_id AND is_active = true),
        'has_achievements', EXISTS(SELECT 1 FROM company_achievements WHERE company_id = p_company_id),
        'has_financials', EXISTS(SELECT 1 FROM company_financials WHERE company_id = p_company_id),
        'has_market_data', EXISTS(SELECT 1 FROM company_market_data WHERE company_id = p_company_id),
        'team_count', (SELECT COUNT(*) FROM company_team_members WHERE company_id = p_company_id AND is_active = true),
        'product_count', (SELECT COUNT(*) FROM company_products WHERE company_id = p_company_id AND is_active = true),
        'achievement_count', (SELECT COUNT(*) FROM company_achievements WHERE company_id = p_company_id),
        'knowledge_entry_count', (SELECT COUNT(*) FROM company_knowledge_entries WHERE company_id = p_company_id AND is_active = true)
    ) INTO result;

    -- 완성도 점수 계산
    IF (result->>'has_team_members')::boolean THEN total_score := total_score + 20; END IF;
    IF (result->>'has_products')::boolean THEN total_score := total_score + 20; END IF;
    IF (result->>'has_achievements')::boolean THEN total_score := total_score + 15; END IF;
    IF (result->>'has_financials')::boolean THEN total_score := total_score + 25; END IF;
    IF (result->>'has_market_data')::boolean THEN total_score := total_score + 20; END IF;

    result := result || jsonb_build_object(
        'completeness_score', total_score,
        'max_score', max_score,
        'percentage', ROUND((total_score::decimal / max_score) * 100, 1)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 사업계획서 생성을 위한 회사 컨텍스트 조회
CREATE OR REPLACE FUNCTION get_company_context_for_plan(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    v_company_id UUID;
BEGIN
    -- 회사 ID 조회
    SELECT company_id INTO v_company_id
    FROM company_support_profiles
    WHERE user_id = p_user_id
    LIMIT 1;

    SELECT jsonb_build_object(
        -- 기본 프로필
        'profile', (
            SELECT row_to_json(p.*)::jsonb
            FROM company_support_profiles p
            WHERE user_id = p_user_id
        ),

        -- 팀 정보
        'team_members', (
            SELECT COALESCE(jsonb_agg(row_to_json(t.*)), '[]'::jsonb)
            FROM company_team_members t
            WHERE t.company_id = v_company_id AND t.is_active = true
            ORDER BY t.is_key_member DESC, t.display_order
        ),

        -- 제품 정보
        'products', (
            SELECT COALESCE(jsonb_agg(row_to_json(pr.*)), '[]'::jsonb)
            FROM company_products pr
            WHERE pr.company_id = v_company_id AND pr.is_active = true
            ORDER BY pr.is_flagship DESC, pr.display_order
        ),

        -- 주요 성과
        'achievements', (
            SELECT COALESCE(jsonb_agg(row_to_json(a.*)), '[]'::jsonb)
            FROM company_achievements a
            WHERE a.company_id = v_company_id
            ORDER BY a.importance_level DESC, a.date DESC
            LIMIT 10
        ),

        -- 최근 재무 정보
        'financials', (
            SELECT COALESCE(jsonb_agg(row_to_json(f.*)), '[]'::jsonb)
            FROM company_financials f
            WHERE f.company_id = v_company_id
            ORDER BY f.fiscal_year DESC, f.fiscal_quarter DESC NULLS LAST
            LIMIT 3
        ),

        -- 시장 데이터
        'market_data', (
            SELECT row_to_json(m.*)::jsonb
            FROM company_market_data m
            WHERE m.company_id = v_company_id
            ORDER BY m.created_at DESC
            LIMIT 1
        ),

        -- 추가 지식베이스 엔트리
        'knowledge_entries', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'category', k.category,
                    'title', k.title,
                    'content', k.content,
                    'tags', k.tags
                )
            ), '[]'::jsonb)
            FROM company_knowledge_entries k
            WHERE k.company_id = v_company_id AND k.is_active = true
            LIMIT 20
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;
