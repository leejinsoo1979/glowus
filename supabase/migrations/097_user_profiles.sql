-- User Profiles 테이블 (마이페이지 전체 데이터)
-- 기존 users 테이블과 1:1 관계

CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

    -- 기본 프로필 정보
    title TEXT,                           -- 직함 (CEO & Founder)
    birthday DATE,                        -- 생년월일
    location TEXT,                        -- 위치 (서울시 강남구)

    -- 소셜 링크
    github_url TEXT,
    twitter_url TEXT,
    linkedin_url TEXT,
    website_url TEXT,

    -- About 섹션
    bio TEXT[],                           -- 자기소개 (여러 문단)
    services JSONB DEFAULT '[]',          -- 서비스/전문분야 [{icon, title, description}]
    achievements JSONB DEFAULT '[]',      -- 성과 [{label, value}]

    -- Resume 섹션
    education JSONB DEFAULT '[]',         -- 학력 [{title, period, description}]
    experience JSONB DEFAULT '[]',        -- 경력 [{title, company, period, description}]
    skills JSONB DEFAULT '[]',            -- 스킬 [{name, level}]

    -- Portfolio 섹션
    portfolio JSONB DEFAULT '[]',         -- 포트폴리오 [{title, category, image, description, status}]

    -- Contact 섹션
    calendly_url TEXT,
    contact_email TEXT,                   -- 별도 연락용 이메일 (users.email과 다를 수 있음)
    contact_phone TEXT,                   -- 별도 연락처
    contact_address TEXT,                 -- 상세 주소

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);

-- RLS 활성화
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view any profile"
    ON public.user_profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile"
    ON public.user_profiles FOR DELETE
    USING (auth.uid() = user_id);

-- updated_at 트리거
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 새 유저 가입 시 빈 프로필 자동 생성
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created_create_profile
    AFTER INSERT ON public.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_profile();
