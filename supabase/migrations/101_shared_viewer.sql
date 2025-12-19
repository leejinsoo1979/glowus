-- 공유 뷰어 상태 테이블
-- 채팅방에서 PDF/이미지/비디오를 실시간으로 공유할 때 사용

CREATE TABLE IF NOT EXISTS shared_viewer_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,

  -- 미디어 정보
  media_type TEXT NOT NULL CHECK (media_type IN ('pdf', 'image', 'video')),
  media_url TEXT NOT NULL,
  media_name TEXT NOT NULL,

  -- PDF 상태
  current_page INTEGER DEFAULT 1,
  total_pages INTEGER,

  -- 비디오 상태
  current_time DECIMAL DEFAULT 0,
  duration DECIMAL,
  is_playing BOOLEAN DEFAULT false,

  -- 공통
  zoom_level DECIMAL DEFAULT 1.0,

  -- 제어권 (누가 컨트롤하고 있는지)
  presenter_id UUID,
  presenter_type TEXT CHECK (presenter_type IN ('user', 'agent')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 룸당 하나의 활성 뷰어만 허용
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_viewer_room ON shared_viewer_state(room_id);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_shared_viewer_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shared_viewer_updated ON shared_viewer_state;
CREATE TRIGGER shared_viewer_updated
  BEFORE UPDATE ON shared_viewer_state
  FOR EACH ROW
  EXECUTE FUNCTION update_shared_viewer_timestamp();

-- RLS 정책
ALTER TABLE shared_viewer_state ENABLE ROW LEVEL SECURITY;

-- 참여자만 조회 가능
CREATE POLICY "shared_viewer_select" ON shared_viewer_state
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_participants.room_id = shared_viewer_state.room_id
      AND chat_participants.user_id = auth.uid()
    )
  );

-- 참여자만 삽입 가능
CREATE POLICY "shared_viewer_insert" ON shared_viewer_state
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_participants.room_id = shared_viewer_state.room_id
      AND chat_participants.user_id = auth.uid()
    )
  );

-- 참여자만 업데이트 가능
CREATE POLICY "shared_viewer_update" ON shared_viewer_state
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_participants.room_id = shared_viewer_state.room_id
      AND chat_participants.user_id = auth.uid()
    )
  );

-- 참여자만 삭제 가능
CREATE POLICY "shared_viewer_delete" ON shared_viewer_state
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_participants.room_id = shared_viewer_state.room_id
      AND chat_participants.user_id = auth.uid()
    )
  );

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE shared_viewer_state;
