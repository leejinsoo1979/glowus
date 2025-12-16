-- Emoticon Keywords Migration
-- 이모티콘에 키워드 필드 추가 (연관 단어로 랜덤 표시용)

-- keywords 컬럼 추가 (TEXT 배열)
ALTER TABLE user_emoticons
ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';

-- 키워드 검색을 위한 GIN 인덱스
CREATE INDEX IF NOT EXISTS idx_user_emoticons_keywords
ON user_emoticons USING GIN (keywords);

COMMENT ON COLUMN user_emoticons.keywords IS '이모티콘 연관 키워드 (예: ["ㅋㅋ", "웃음", "ㅎㅎ"])';
