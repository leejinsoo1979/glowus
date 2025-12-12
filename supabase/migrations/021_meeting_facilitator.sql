-- 회의 진행자(퍼실리테이터) 필드 추가
ALTER TABLE chat_rooms
ADD COLUMN IF NOT EXISTS meeting_facilitator_id UUID REFERENCES deployed_agents(id) ON DELETE SET NULL;

COMMENT ON COLUMN chat_rooms.meeting_facilitator_id IS '회의 진행자 에이전트 ID (선택사항)';
