-- Emoticon Library Migration
-- 사용자 이모티콘 라이브러리 테이블

-- 이모티콘 테이블
CREATE TABLE IF NOT EXISTS user_emoticons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  category TEXT DEFAULT 'default',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_emoticons_user_id ON user_emoticons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_emoticons_category ON user_emoticons(user_id, category);

-- RLS 정책
ALTER TABLE user_emoticons ENABLE ROW LEVEL SECURITY;

-- 본인 이모티콘 읽기
CREATE POLICY "Users can read own emoticons"
  ON user_emoticons FOR SELECT
  USING (auth.uid() = user_id);

-- 본인 이모티콘 생성
CREATE POLICY "Users can create own emoticons"
  ON user_emoticons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 이모티콘 수정
CREATE POLICY "Users can update own emoticons"
  ON user_emoticons FOR UPDATE
  USING (auth.uid() = user_id);

-- 본인 이모티콘 삭제
CREATE POLICY "Users can delete own emoticons"
  ON user_emoticons FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_user_emoticons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_emoticons_updated_at
  BEFORE UPDATE ON user_emoticons
  FOR EACH ROW
  EXECUTE FUNCTION update_user_emoticons_updated_at();

COMMENT ON TABLE user_emoticons IS '사용자 이모티콘 라이브러리';
COMMENT ON COLUMN user_emoticons.name IS '이모티콘 이름';
COMMENT ON COLUMN user_emoticons.image_url IS '이모티콘 이미지 URL';
COMMENT ON COLUMN user_emoticons.category IS '이모티콘 카테고리';
COMMENT ON COLUMN user_emoticons.sort_order IS '정렬 순서';
