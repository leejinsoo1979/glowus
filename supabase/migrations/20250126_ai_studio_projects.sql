-- AI Studio 프로젝트 테이블 (기존 sessions 테이블 대체)
-- 프로젝트 = 소스들 + 생성된 콘텐츠들 전체를 하나로 묶음

-- 기존 테이블 삭제 (데이터 없음)
DROP TABLE IF EXISTS ai_studio_sessions CASCADE;

-- 새 프로젝트 테이블
CREATE TABLE ai_studio_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID,

  -- 프로젝트 정보
  title TEXT NOT NULL,

  -- 전체 상태 저장 (소스, 생성된 콘텐츠, 채팅 등)
  sources JSONB DEFAULT '[]'::jsonb,           -- 업로드된 소스들
  generated_contents JSONB DEFAULT '[]'::jsonb, -- 생성된 콘텐츠들 (video, report, mindmap 등)
  audio_overviews JSONB DEFAULT '[]'::jsonb,   -- 오디오 오버뷰들
  chat_messages JSONB DEFAULT '[]'::jsonb,     -- 채팅 기록

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_ai_studio_projects_user_id ON ai_studio_projects(user_id);
CREATE INDEX idx_ai_studio_projects_company_id ON ai_studio_projects(company_id);
CREATE INDEX idx_ai_studio_projects_created_at ON ai_studio_projects(created_at DESC);
CREATE INDEX idx_ai_studio_projects_updated_at ON ai_studio_projects(updated_at DESC);

-- RLS 정책
ALTER TABLE ai_studio_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" ON ai_studio_projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" ON ai_studio_projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON ai_studio_projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON ai_studio_projects
  FOR DELETE USING (auth.uid() = user_id);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_ai_studio_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_studio_projects_updated_at
  BEFORE UPDATE ON ai_studio_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_studio_projects_updated_at();
