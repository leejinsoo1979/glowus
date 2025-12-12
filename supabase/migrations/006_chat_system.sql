-- =============================================
-- Chat System for Team + AI Agent Messaging
-- =============================================

-- 채팅방 타입
CREATE TYPE chat_room_type AS ENUM ('direct', 'group', 'meeting');

-- 참여자 타입
CREATE TYPE participant_type AS ENUM ('user', 'agent');

-- 메시지 타입
CREATE TYPE message_type AS ENUM ('text', 'image', 'file', 'system');

-- =============================================
-- 채팅방 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT, -- 그룹채팅/회의용 이름 (1:1은 null)
    type chat_room_type NOT NULL DEFAULT 'direct',
    team_id UUID REFERENCES startups(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    is_meeting_active BOOLEAN DEFAULT FALSE, -- 회의 모드 활성화 여부
    meeting_topic TEXT, -- 회의 주제
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 채팅방 참여자 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS chat_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    participant_type participant_type NOT NULL DEFAULT 'user',
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES deployed_agents(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    is_typing BOOLEAN DEFAULT FALSE,
    -- user_id 또는 agent_id 중 하나는 반드시 있어야 함
    CONSTRAINT participant_reference CHECK (
        (participant_type = 'user' AND user_id IS NOT NULL AND agent_id IS NULL) OR
        (participant_type = 'agent' AND agent_id IS NOT NULL AND user_id IS NULL)
    ),
    -- 같은 방에 같은 참여자 중복 방지
    UNIQUE(room_id, user_id),
    UNIQUE(room_id, agent_id)
);

-- =============================================
-- 메시지 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_type participant_type NOT NULL,
    sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_agent_id UUID REFERENCES deployed_agents(id) ON DELETE SET NULL,
    message_type message_type NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}', -- 파일 정보, 이미지 URL 등
    is_ai_response BOOLEAN DEFAULT FALSE,
    reply_to_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- sender 검증
    CONSTRAINT sender_reference CHECK (
        (sender_type = 'user' AND sender_user_id IS NOT NULL AND sender_agent_id IS NULL) OR
        (sender_type = 'agent' AND sender_agent_id IS NOT NULL AND sender_user_id IS NULL)
    )
);

-- =============================================
-- 메시지 읽음 상태 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS message_read_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- =============================================
-- 인덱스
-- =============================================
CREATE INDEX IF NOT EXISTS idx_chat_rooms_team ON chat_rooms(team_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_message ON chat_rooms(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_participants_room ON chat_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_agent ON chat_participants(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_read_status_message ON message_read_status(message_id);

-- =============================================
-- RLS 정책
-- =============================================
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_status ENABLE ROW LEVEL SECURITY;

-- 채팅방: 참여자만 접근 가능
CREATE POLICY "Users can view rooms they participate in"
    ON chat_rooms FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_participants
            WHERE chat_participants.room_id = chat_rooms.id
            AND chat_participants.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create rooms"
    ON chat_rooms FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Room creators can update"
    ON chat_rooms FOR UPDATE
    USING (created_by = auth.uid());

-- 참여자: 같은 방 참여자만 조회 가능
CREATE POLICY "Users can view participants in their rooms"
    ON chat_participants FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_participants cp
            WHERE cp.room_id = chat_participants.room_id
            AND cp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can add participants to rooms they created"
    ON chat_participants FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_rooms
            WHERE chat_rooms.id = room_id
            AND chat_rooms.created_by = auth.uid()
        )
        OR user_id = auth.uid()
    );

-- 메시지: 참여자만 조회/작성 가능
CREATE POLICY "Users can view messages in their rooms"
    ON chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_participants
            WHERE chat_participants.room_id = chat_messages.room_id
            AND chat_participants.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can send messages to their rooms"
    ON chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_participants
            WHERE chat_participants.room_id = room_id
            AND chat_participants.user_id = auth.uid()
        )
    );

-- 읽음 상태: 본인 것만
CREATE POLICY "Users can manage their read status"
    ON message_read_status FOR ALL
    USING (user_id = auth.uid());

-- =============================================
-- Realtime 활성화
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_participants;

-- =============================================
-- 트리거: 마지막 메시지 시간 업데이트
-- =============================================
CREATE OR REPLACE FUNCTION update_room_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_rooms
    SET last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.room_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_new_message
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_room_last_message();
