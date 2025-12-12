-- 회의 시간 설정 필드 추가
ALTER TABLE chat_rooms
ADD COLUMN IF NOT EXISTS meeting_duration_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS meeting_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS meeting_end_time TIMESTAMPTZ;

COMMENT ON COLUMN chat_rooms.meeting_duration_minutes IS '회의 예정 시간 (분 단위, 기본 30분)';
COMMENT ON COLUMN chat_rooms.meeting_started_at IS '회의 시작 시간';
COMMENT ON COLUMN chat_rooms.meeting_end_time IS '회의 종료 예정 시간';
