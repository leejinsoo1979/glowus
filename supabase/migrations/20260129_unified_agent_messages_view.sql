-- Unified Agent Messages View
-- 크로스 플랫폼 통합 메시지 뷰 (Telegram + GlowUS Web + API)
-- 모든 플랫폼의 대화를 통합 조회 가능

-- 1. Unified Messages View
CREATE OR REPLACE VIEW unified_agent_messages AS
-- Telegram Messages
SELECT
  tcm.id,
  'telegram' as source,
  tu.user_id as glowus_user_id,        -- 연결된 GlowUS 사용자
  tcm.telegram_user_id,
  tcs.agent_id,
  tcs.agent_name,
  tcm.role,
  tcm.content,
  tcm.tool_calls,
  tcm.tool_results,
  tcm.created_at
FROM telegram_chat_messages tcm
JOIN telegram_chat_sessions tcs ON tcm.session_id = tcs.id
JOIN telegram_users tu ON tcm.telegram_user_id = tu.id

UNION ALL

-- GlowUS Web Messages
SELECT
  am.id,
  'web' as source,
  ac.user_id as glowus_user_id,
  tu.id as telegram_user_id,           -- 연결된 Telegram 사용자
  COALESCE(am.sender_agent_id, am.receiver_agent_id) as agent_id,
  da.name as agent_name,
  CASE WHEN am.sender_type = 'USER' THEN 'user' ELSE 'assistant' END as role,
  am.content,
  NULL as tool_calls,
  NULL as tool_results,
  am.created_at
FROM agent_messages am
JOIN agent_conversations ac ON am.conversation_id = ac.id
LEFT JOIN deployed_agents da ON da.id = COALESCE(am.sender_agent_id, am.receiver_agent_id)
LEFT JOIN telegram_users tu ON tu.user_id = ac.user_id;

-- 2. Function to get unified conversation history
CREATE OR REPLACE FUNCTION get_unified_conversation(
  p_glowus_user_id UUID DEFAULT NULL,
  p_telegram_user_id TEXT DEFAULT NULL,
  p_agent_id TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  source TEXT,
  agent_id TEXT,
  agent_name TEXT,
  role TEXT,
  content TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (uam.created_at, uam.id)
    uam.id,
    uam.source,
    uam.agent_id,
    uam.agent_name,
    uam.role,
    uam.content,
    uam.created_at
  FROM unified_agent_messages uam
  WHERE (
    -- GlowUS User ID로 조회
    (p_glowus_user_id IS NOT NULL AND uam.glowus_user_id = p_glowus_user_id)
    OR
    -- Telegram User ID로 조회
    (p_telegram_user_id IS NOT NULL AND uam.telegram_user_id = p_telegram_user_id)
  )
  AND (
    -- Agent ID 필터 (선택적)
    p_agent_id IS NULL OR uam.agent_id = p_agent_id
  )
  ORDER BY uam.created_at DESC, uam.id
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Index for performance
CREATE INDEX IF NOT EXISTS idx_telegram_users_user_id_for_join ON telegram_users(user_id);

-- 4. Comments
COMMENT ON VIEW unified_agent_messages IS '크로스 플랫폼 통합 메시지 뷰 - Telegram + GlowUS Web';
COMMENT ON FUNCTION get_unified_conversation IS '통합 대화 기록 조회 - 어떤 플랫폼이든 같은 에이전트 대화 통합';
