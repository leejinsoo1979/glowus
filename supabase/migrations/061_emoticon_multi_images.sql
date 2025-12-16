-- Emoticon Multi-Images Migration
-- 이모티콘 카드당 최대 3개 GIF 등록 지원

-- 기존 image_url을 image_urls 배열로 변환
ALTER TABLE user_emoticons
ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- 기존 image_url 데이터를 image_urls로 마이그레이션
UPDATE user_emoticons
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL);

-- 주석 업데이트
COMMENT ON COLUMN user_emoticons.image_urls IS '이모티콘 이미지 URL 배열 (최대 3개)';
COMMENT ON COLUMN user_emoticons.image_url IS '(deprecated) 기존 단일 이미지 URL - image_urls 사용 권장';
