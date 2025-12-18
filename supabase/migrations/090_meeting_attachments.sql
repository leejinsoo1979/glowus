-- 회의 자료 첨부 기능 추가
-- chat_rooms 테이블에 meeting_attachments 컬럼 추가

ALTER TABLE chat_rooms
ADD COLUMN IF NOT EXISTS meeting_attachments JSONB DEFAULT NULL;

-- 카테고리 컬럼 추가
ALTER TABLE chat_rooms
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL;

-- 코멘트 추가
COMMENT ON COLUMN chat_rooms.meeting_attachments IS '회의 첨부 자료 [{name, content, type}]';
COMMENT ON COLUMN chat_rooms.category IS '회의 카테고리 (marketing, product, development, design, hr, finance, sales, general)';
