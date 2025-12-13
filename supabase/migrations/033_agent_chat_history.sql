-- Agent Chat History Migration
-- 에이전트 1:1 채팅 기록 저장

-- 대화 세션 테이블
CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES deployed_agents(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, agent_id)
);

-- 채팅 메시지 테이블
CREATE TABLE IF NOT EXISTS agent_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'agent')),
  content TEXT NOT NULL,
  image_url TEXT,
  emotion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_id ON agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent_id ON agent_conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_last_message ON agent_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_chat_messages_conversation_id ON agent_chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_chat_messages_created_at ON agent_chat_messages(created_at);

-- RLS 정책
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_chat_messages ENABLE ROW LEVEL SECURITY;

-- agent_conversations 정책
CREATE POLICY "Users can read own conversations"
  ON agent_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
  ON agent_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON agent_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON agent_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- agent_chat_messages 정책 (conversation 소유자만 접근)
CREATE POLICY "Users can read own conversation messages"
  ON agent_chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agent_conversations
      WHERE id = agent_chat_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own conversations"
  ON agent_chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_conversations
      WHERE id = agent_chat_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages in own conversations"
  ON agent_chat_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM agent_conversations
      WHERE id = agent_chat_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

COMMENT ON TABLE agent_conversations IS '에이전트와의 1:1 대화 세션';
COMMENT ON TABLE agent_chat_messages IS '에이전트 채팅 메시지';
