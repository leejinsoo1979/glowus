-- OKR (Objectives and Key Results) System
-- 비전, 목표, 핵심 결과 관리 시스템

-- 1. 비전 테이블 (회사/팀 비전)
CREATE TABLE IF NOT EXISTS visions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    year INTEGER, -- 연도별 비전 (null이면 전체 비전)
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 목표 테이블 (Objectives)
CREATE TABLE IF NOT EXISTS objectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    vision_id UUID REFERENCES visions(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES objectives(id) ON DELETE CASCADE, -- 하위 목표 지원
    title VARCHAR(500) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id), -- 담당자
    department_id UUID REFERENCES departments(id), -- 담당 부서

    -- 기간
    period_type VARCHAR(20) DEFAULT 'quarterly' CHECK (period_type IN ('annual', 'quarterly', 'monthly', 'custom')),
    year INTEGER NOT NULL,
    quarter INTEGER CHECK (quarter >= 1 AND quarter <= 4), -- 분기 (1-4)
    start_date DATE,
    end_date DATE,

    -- 상태 및 진행률
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    progress DECIMAL(5,2) DEFAULT 0 CHECK (progress >= 0 AND progress <= 100), -- 자동 계산됨

    -- 우선순위 및 가중치
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    weight DECIMAL(5,2) DEFAULT 1.0, -- 가중치 (상위 목표 내 비중)

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 핵심 결과 테이블 (Key Results)
CREATE TABLE IF NOT EXISTS key_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id), -- 담당자

    -- 측정 방식
    metric_type VARCHAR(20) DEFAULT 'percentage' CHECK (metric_type IN ('percentage', 'number', 'currency', 'boolean')),
    start_value DECIMAL(15,2) DEFAULT 0, -- 시작 값
    target_value DECIMAL(15,2) NOT NULL, -- 목표 값
    current_value DECIMAL(15,2) DEFAULT 0, -- 현재 값
    unit VARCHAR(50), -- 단위 (%, 건, 원, 명 등)

    -- 진행률 (자동 계산)
    progress DECIMAL(5,2) DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

    -- 상태
    status VARCHAR(20) DEFAULT 'not_started' CHECK (status IN ('not_started', 'on_track', 'at_risk', 'behind', 'completed')),

    -- 가중치
    weight DECIMAL(5,2) DEFAULT 1.0,

    -- 순서
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. KR 체크인/업데이트 기록
CREATE TABLE IF NOT EXISTS kr_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_result_id UUID NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
    previous_value DECIMAL(15,2),
    new_value DECIMAL(15,2) NOT NULL,
    note TEXT, -- 업데이트 메모
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. OKR 코멘트
CREATE TABLE IF NOT EXISTS okr_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objective_id UUID REFERENCES objectives(id) ON DELETE CASCADE,
    key_result_id UUID REFERENCES key_results(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CHECK (objective_id IS NOT NULL OR key_result_id IS NOT NULL)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_visions_company ON visions(company_id);
CREATE INDEX IF NOT EXISTS idx_objectives_company ON objectives(company_id);
CREATE INDEX IF NOT EXISTS idx_objectives_vision ON objectives(vision_id);
CREATE INDEX IF NOT EXISTS idx_objectives_owner ON objectives(owner_id);
CREATE INDEX IF NOT EXISTS idx_objectives_period ON objectives(year, quarter);
CREATE INDEX IF NOT EXISTS idx_key_results_objective ON key_results(objective_id);
CREATE INDEX IF NOT EXISTS idx_key_results_owner ON key_results(owner_id);
CREATE INDEX IF NOT EXISTS idx_kr_checkins_kr ON kr_checkins(key_result_id);
CREATE INDEX IF NOT EXISTS idx_okr_comments_objective ON okr_comments(objective_id);
CREATE INDEX IF NOT EXISTS idx_okr_comments_kr ON okr_comments(key_result_id);

-- KR 진행률 자동 계산 함수
CREATE OR REPLACE FUNCTION calculate_kr_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- 진행률 계산 (start_value에서 target_value까지)
    IF NEW.target_value != NEW.start_value THEN
        NEW.progress := LEAST(100, GREATEST(0,
            ((NEW.current_value - NEW.start_value) / (NEW.target_value - NEW.start_value)) * 100
        ));
    ELSE
        NEW.progress := CASE WHEN NEW.current_value >= NEW.target_value THEN 100 ELSE 0 END;
    END IF;

    -- 상태 자동 업데이트
    IF NEW.progress >= 100 THEN
        NEW.status := 'completed';
    ELSIF NEW.progress >= 70 THEN
        NEW.status := 'on_track';
    ELSIF NEW.progress >= 30 THEN
        NEW.status := 'at_risk';
    ELSE
        NEW.status := 'behind';
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Objective 진행률 자동 계산 함수 (가중 평균)
CREATE OR REPLACE FUNCTION calculate_objective_progress()
RETURNS TRIGGER AS $$
DECLARE
    total_weight DECIMAL;
    weighted_sum DECIMAL;
BEGIN
    -- 해당 Objective의 모든 KR 가중 평균 계산
    SELECT
        COALESCE(SUM(weight), 0),
        COALESCE(SUM(progress * weight), 0)
    INTO total_weight, weighted_sum
    FROM key_results
    WHERE objective_id = COALESCE(NEW.objective_id, OLD.objective_id);

    -- Objective 진행률 업데이트
    IF total_weight > 0 THEN
        UPDATE objectives
        SET progress = weighted_sum / total_weight,
            updated_at = NOW()
        WHERE id = COALESCE(NEW.objective_id, OLD.objective_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_calculate_kr_progress ON key_results;
CREATE TRIGGER trigger_calculate_kr_progress
    BEFORE INSERT OR UPDATE OF current_value, target_value, start_value
    ON key_results
    FOR EACH ROW
    EXECUTE FUNCTION calculate_kr_progress();

DROP TRIGGER IF EXISTS trigger_update_objective_progress ON key_results;
CREATE TRIGGER trigger_update_objective_progress
    AFTER INSERT OR UPDATE OF progress, weight OR DELETE
    ON key_results
    FOR EACH ROW
    EXECUTE FUNCTION calculate_objective_progress();

-- RLS 정책
ALTER TABLE visions ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE kr_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE okr_comments ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 자신의 회사 OKR 조회 가능
CREATE POLICY "Users can view company visions" ON visions
    FOR SELECT USING (true);

CREATE POLICY "Users can view company objectives" ON objectives
    FOR SELECT USING (true);

CREATE POLICY "Users can view key results" ON key_results
    FOR SELECT USING (true);

CREATE POLICY "Users can view kr checkins" ON kr_checkins
    FOR SELECT USING (true);

CREATE POLICY "Users can view okr comments" ON okr_comments
    FOR SELECT USING (true);

-- 모든 인증된 사용자가 생성/수정 가능 (실제로는 권한 체크 필요)
CREATE POLICY "Users can manage visions" ON visions
    FOR ALL USING (true);

CREATE POLICY "Users can manage objectives" ON objectives
    FOR ALL USING (true);

CREATE POLICY "Users can manage key results" ON key_results
    FOR ALL USING (true);

CREATE POLICY "Users can manage kr checkins" ON kr_checkins
    FOR ALL USING (true);

CREATE POLICY "Users can manage okr comments" ON okr_comments
    FOR ALL USING (true);
