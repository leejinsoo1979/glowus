-- Chat Main GIF Migration
-- 채팅 메인 화면용 GIF/이미지 컬럼 추가

ALTER TABLE deployed_agents
ADD COLUMN IF NOT EXISTS chat_main_gif TEXT;

COMMENT ON COLUMN deployed_agents.chat_main_gif IS '채팅 시작 화면에 표시될 대표 GIF/이미지 URL';
