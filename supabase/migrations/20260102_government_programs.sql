-- 정부지원사업 공고 테이블
CREATE TABLE IF NOT EXISTS government_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 기본 정보
    program_id VARCHAR(100) UNIQUE NOT NULL,  -- 기업마당 공고 ID
    title TEXT NOT NULL,                       -- 공고 제목
    content TEXT,                              -- 공고 내용 요약

    -- 분류
    category VARCHAR(50),                      -- 분야 (금융, 기술, 인력, 수출, 내수, 창업, 경영, 기타)
    hashtags TEXT[],                           -- 해시태그

    -- 기관 정보
    organization VARCHAR(200),                 -- 소관기관
    executing_agency VARCHAR(200),             -- 수행기관
    reception_agency VARCHAR(200),             -- 접수기관

    -- 일정
    apply_start_date DATE,                     -- 신청 시작일
    apply_end_date DATE,                       -- 신청 종료일

    -- 링크
    detail_url TEXT,                           -- 상세 URL

    -- 데이터 소스
    source VARCHAR(50) DEFAULT 'bizinfo',      -- 데이터 출처 (bizinfo, k-startup, gov24 등)

    -- 메타
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    fetched_at TIMESTAMPTZ DEFAULT NOW()       -- API에서 가져온 시간
);

-- 인덱스
CREATE INDEX idx_government_programs_category ON government_programs(category);
CREATE INDEX idx_government_programs_apply_end_date ON government_programs(apply_end_date);
CREATE INDEX idx_government_programs_source ON government_programs(source);
CREATE INDEX idx_government_programs_created_at ON government_programs(created_at DESC);

-- 사용자별 알림 설정 테이블
CREATE TABLE IF NOT EXISTS government_program_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 구독 설정
    categories TEXT[] DEFAULT '{}',            -- 구독 분야 (빈 배열이면 전체)
    keywords TEXT[] DEFAULT '{}',              -- 관심 키워드

    -- 알림 설정
    push_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT false,

    -- 메타
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id)
);

-- 알림 히스토리 테이블
CREATE TABLE IF NOT EXISTS government_program_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES government_programs(id) ON DELETE CASCADE,

    -- 알림 상태
    is_read BOOLEAN DEFAULT false,
    notified_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,

    UNIQUE(user_id, program_id)
);

CREATE INDEX idx_program_notifications_user ON government_program_notifications(user_id, is_read);

-- RLS 정책
ALTER TABLE government_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE government_program_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE government_program_notifications ENABLE ROW LEVEL SECURITY;

-- 공고는 모든 인증된 사용자가 조회 가능
CREATE POLICY "Anyone can view programs" ON government_programs
    FOR SELECT USING (true);

-- 구독 설정은 본인만
CREATE POLICY "Users can manage own subscriptions" ON government_program_subscriptions
    FOR ALL USING (auth.uid() = user_id);

-- 알림은 본인만
CREATE POLICY "Users can manage own notifications" ON government_program_notifications
    FOR ALL USING (auth.uid() = user_id);

-- Updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_government_programs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_government_programs_updated_at
    BEFORE UPDATE ON government_programs
    FOR EACH ROW
    EXECUTE FUNCTION update_government_programs_updated_at();
