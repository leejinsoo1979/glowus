-- 회의록 저장 테이블
CREATE TABLE IF NOT EXISTS meeting_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  room_name TEXT,
  topic TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,
  participant_count INTEGER DEFAULT 0,
  agent_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  facilitator_id UUID REFERENCES deployed_agents(id) ON DELETE SET NULL,
  -- AI 요약 관련
  summary TEXT,
  key_points JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  decisions JSONB DEFAULT '[]'::jsonb,
  -- 메타데이터
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_meeting_records_room_id ON meeting_records(room_id);
CREATE INDEX IF NOT EXISTS idx_meeting_records_started_at ON meeting_records(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_records_created_by ON meeting_records(created_by);

-- 코멘트
COMMENT ON TABLE meeting_records IS '완료된 회의 기록 및 AI 요약';
COMMENT ON COLUMN meeting_records.summary IS 'AI가 생성한 회의 요약';
COMMENT ON COLUMN meeting_records.key_points IS '주요 논의 사항 목록';
COMMENT ON COLUMN meeting_records.action_items IS '액션 아이템 목록';
COMMENT ON COLUMN meeting_records.decisions IS '결정 사항 목록';

-- RLS 활성화
ALTER TABLE meeting_records ENABLE ROW LEVEL SECURITY;

-- 정책: 채팅방 참여자만 회의록 조회 가능
CREATE POLICY "meeting_records_select_policy" ON meeting_records
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM chat_participants WHERE user_id = auth.uid()
    )
  );

-- 정책: 채팅방 참여자만 회의록 생성 가능
CREATE POLICY "meeting_records_insert_policy" ON meeting_records
  FOR INSERT WITH CHECK (
    room_id IN (
      SELECT room_id FROM chat_participants WHERE user_id = auth.uid()
    )
  );

-- 정책: 생성자만 회의록 수정 가능
CREATE POLICY "meeting_records_update_policy" ON meeting_records
  FOR UPDATE USING (created_by = auth.uid());
