-- =====================================================
-- AI 매칭 결과 테이블
-- 공고별 회사 적합도 분석 결과 저장
-- =====================================================

CREATE TABLE IF NOT EXISTS match_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 연결
    program_id UUID NOT NULL REFERENCES government_programs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    company_profile_id UUID REFERENCES company_support_profiles(id) ON DELETE SET NULL,

    -- 프로필 스냅샷 (매칭 당시 회사 정보)
    profile_snapshot JSONB,

    -- 매칭 점수 (0-100)
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),

    -- 추천 액션
    action VARCHAR(20) NOT NULL CHECK (action IN ('apply', 'watch', 'skip')),

    -- 선정 근거
    reasons JSONB NOT NULL DEFAULT '[]',
    /*
    [
      {"title": "정책목표 적합", "detail": "AI 기술 개발 사업으로 정부 디지털 전환 정책에 부합"},
      {"title": "자격요건 충족", "detail": "창업 3년 미만 기술기반 스타트업 조건 충족"}
    ]
    */

    -- 리스크/부적합 요소
    risks JSONB NOT NULL DEFAULT '[]',
    /*
    [
      {"title": "업력 제한 근접", "detail": "2년 6개월 경과로 마감 전 신청 필요"},
      {"title": "매출 증빙 필요", "detail": "최근 3개년 재무제표 준비 필요"}
    ]
    */

    -- 다음 단계 액션
    next_actions JSONB NOT NULL DEFAULT '[]',
    /*
    [
      "필수서류: 사업자등록증, 재무제표, 기술설명서",
      "보완사항: 특허/인증 서류 준비",
      "마감일: 2026-01-31까지 온라인 접수"
    ]
    */

    -- 세부 점수 (가중치 계산용)
    score_breakdown JSONB DEFAULT '{}',
    /*
    {
      "industry_match": 25,
      "scale_match": 20,
      "region_match": 15,
      "type_match": 15,
      "special_conditions": 15,
      "timing": 10
    }
    */

    -- AI 메타데이터
    ai_model VARCHAR(100),
    ai_prompt_version VARCHAR(50),

    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 사용자당 프로그램당 하나의 매칭 결과
    UNIQUE(user_id, program_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_match_results_user ON match_results(user_id);
CREATE INDEX IF NOT EXISTS idx_match_results_program ON match_results(program_id);
CREATE INDEX IF NOT EXISTS idx_match_results_score ON match_results(score DESC);
CREATE INDEX IF NOT EXISTS idx_match_results_action ON match_results(action);
CREATE INDEX IF NOT EXISTS idx_match_results_created ON match_results(created_at DESC);

-- 고적합 공고 빠른 조회
CREATE INDEX IF NOT EXISTS idx_match_results_high_score
    ON match_results(user_id, score DESC)
    WHERE score >= 70;

-- RLS 정책
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own match results"
    ON match_results FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own match results"
    ON match_results FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own match results"
    ON match_results FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own match results"
    ON match_results FOR DELETE
    USING (auth.uid() = user_id);

-- updated_at 트리거
DROP TRIGGER IF EXISTS update_match_results_updated_at ON match_results;
CREATE TRIGGER update_match_results_updated_at
    BEFORE UPDATE ON match_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- program_statistics 확장 (매칭 통계)
-- =====================================================
ALTER TABLE program_statistics
    ADD COLUMN IF NOT EXISTS latest_programs INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS event_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS high_match_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS deadline_trend JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS deadline_by_year JSONB DEFAULT '{}';

-- =====================================================
-- 뷰: 공고 + 매칭 결과 조인
-- =====================================================
CREATE OR REPLACE VIEW programs_with_match AS
SELECT
    p.*,
    m.score AS match_score,
    m.action AS match_action,
    m.reasons AS match_reasons,
    m.risks AS match_risks,
    m.next_actions AS match_next_actions,
    m.created_at AS matched_at
FROM government_programs p
LEFT JOIN match_results m ON p.id = m.program_id;

COMMENT ON VIEW programs_with_match IS '공고와 매칭 결과를 함께 조회하는 뷰';
