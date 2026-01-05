-- =====================================================
-- Phase 6: 알림 시스템 스키마
-- 앱 내 에이전트 알림 + 선택적 외부 채널 지원
-- =====================================================

-- 1. 알림 채널 설정 테이블
CREATE TABLE IF NOT EXISTS notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    -- 채널 타입 (in_app = 앱 내 에이전트 알림)
    channel_type VARCHAR(20) NOT NULL,  -- in_app, discord, telegram, kakao, email, slack

    -- 채널별 설정
    channel_config JSONB NOT NULL DEFAULT '{}',
    /*
    In-App: { "preferred_agent_id": "..." }
    Discord: { "webhook_url": "https://discord.com/api/webhooks/..." }
    Telegram: { "bot_token": "...", "chat_id": "..." }
    Kakao: { "access_token": "...", "template_id": "..." }
    Slack: { "webhook_url": "https://hooks.slack.com/..." }
    Email: { "email": "user@example.com" }
    */

    -- 알림 조건 설정
    notification_settings JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "min_score": 50,
        "categories": [],
        "keywords": [],
        "notify_new_programs": true,
        "notify_ending_soon": true,
        "notify_high_match": true,
        "quiet_hours": null,
        "preferred_agent_id": null
    }'::jsonb,

    -- 상태
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    last_test_at TIMESTAMPTZ,
    last_notification_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, channel_type)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_notification_channels_user ON notification_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_channels_type ON notification_channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_notification_channels_active ON notification_channels(is_active);

-- 2. 알림 발송 이력 테이블
CREATE TABLE IF NOT EXISTS notification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES notification_channels(id) ON DELETE CASCADE,  -- NULL = in_app
    user_id UUID NOT NULL,

    -- 알림 내용
    notification_type VARCHAR(50) NOT NULL,  -- new_program, high_match, ending_soon, daily_digest
    program_id UUID REFERENCES government_programs(id) ON DELETE SET NULL,

    -- 메시지 내용
    title VARCHAR(500),
    message TEXT,
    payload JSONB,  -- 전체 알림 데이터

    -- 발송 결과
    status VARCHAR(20) DEFAULT 'pending',  -- pending, sent, failed, skipped
    error_message TEXT,
    response_data JSONB,

    -- 타임스탬프
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_notification_history_channel ON notification_history(channel_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_user ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_program ON notification_history(program_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status);
CREATE INDEX IF NOT EXISTS idx_notification_history_created ON notification_history(created_at DESC);

-- 3. 알림 큐 테이블 (배치 처리용 + 실시간 Realtime 구독)
CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 대상 (channel_id는 외부 채널용, NULL이면 in_app 알림)
    channel_id UUID REFERENCES notification_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,

    -- 알림 내용
    notification_type VARCHAR(50) NOT NULL,
    program_id UUID REFERENCES government_programs(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    /*
    In-App payload 구조:
    {
      "agentId": "...",
      "generatedTitle": "...",
      "generatedMessage": "...",
      "notificationType": "info|alert|task|greeting",
      "title": "...",
      "score": 85,
      "url": "..."
    }
    */

    -- 처리 상태
    status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    priority INTEGER DEFAULT 0,  -- 높을수록 우선

    -- 스케줄링
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_channel ON notification_queue(channel_id);

-- 4. 알림 템플릿 테이블
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    channel_type VARCHAR(20) NOT NULL,
    notification_type VARCHAR(50) NOT NULL,

    -- 템플릿 내용
    template_name VARCHAR(100) NOT NULL,
    title_template TEXT,
    body_template TEXT NOT NULL,

    -- 카카오 알림톡용
    kakao_template_code VARCHAR(50),

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(channel_type, notification_type)
);

-- 5. RLS 정책
ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- 사용자별 채널 관리
DROP POLICY IF EXISTS "Users can manage own channels" ON notification_channels;
CREATE POLICY "Users can manage own channels" ON notification_channels
    FOR ALL USING (auth.uid() = user_id);

-- 사용자별 알림 이력
DROP POLICY IF EXISTS "Users can view own history" ON notification_history;
CREATE POLICY "Users can view own history" ON notification_history
    FOR SELECT USING (auth.uid() = user_id);

-- 템플릿은 모두 읽기 가능
DROP POLICY IF EXISTS "Anyone can view templates" ON notification_templates;
CREATE POLICY "Anyone can view templates" ON notification_templates
    FOR SELECT USING (is_active = true);

-- 6. 트리거
DROP TRIGGER IF EXISTS update_notification_channels_updated_at ON notification_channels;
CREATE TRIGGER update_notification_channels_updated_at
    BEFORE UPDATE ON notification_channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. 기본 템플릿 삽입
INSERT INTO notification_templates (channel_type, notification_type, template_name, title_template, body_template) VALUES
-- Discord 템플릿
('discord', 'new_program', '신규 공고 알림',
 '🆕 새로운 정부지원사업',
 '**{{title}}**\n\n📊 관련지수: {{score}}점\n📅 마감일: {{deadline}}\n🏢 주관: {{organization}}\n\n📝 선정 근거:\n{{reason}}\n\n🔗 [상세보기]({{url}})'),

('discord', 'high_match', '높은 적합도 알림',
 '⭐ 우리 회사에 딱 맞는 지원사업!',
 '**{{title}}**\n\n🎯 **적합도 {{score}}점** - 강력 추천!\n📅 마감일: {{deadline}}\n🏢 주관: {{organization}}\n\n💡 추천 이유:\n{{reason}}\n\n🔗 [지금 신청하기]({{url}})'),

('discord', 'ending_soon', '마감 임박 알림',
 '⏰ 마감 임박 공고',
 '**{{title}}**\n\n⚠️ **{{days_left}}일 후 마감!**\n📊 관련지수: {{score}}점\n🏢 주관: {{organization}}\n\n🔗 [서둘러 확인하기]({{url}})'),

-- Telegram 템플릿
('telegram', 'new_program', '신규 공고 알림',
 '🆕 새로운 정부지원사업',
 '🆕 *새로운 정부지원사업*\n\n*{{title}}*\n\n📊 관련지수: {{score}}점\n📅 마감일: {{deadline}}\n🏢 주관: {{organization}}\n\n📝 선정 근거:\n{{reason}}\n\n[상세보기]({{url}})'),

('telegram', 'high_match', '높은 적합도 알림',
 '⭐ 추천 지원사업',
 '⭐ *우리 회사에 딱 맞는 지원사업!*\n\n*{{title}}*\n\n🎯 *적합도 {{score}}점*\n📅 마감일: {{deadline}}\n🏢 주관: {{organization}}\n\n💡 추천 이유:\n{{reason}}\n\n[지금 신청하기]({{url}})'),

-- Kakao 템플릿 (실제 알림톡은 카카오 비즈니스에서 등록 필요)
('kakao', 'new_program', '신규 공고 알림',
 '새로운 정부지원사업',
 '[GlowUS] 새로운 지원사업이 등록되었습니다.\n\n{{title}}\n\n관련지수: {{score}}점\n마감일: {{deadline}}\n\n상세보기: {{url}}')

ON CONFLICT (channel_type, notification_type) DO NOTHING;

-- 8. 통계 뷰
CREATE OR REPLACE VIEW notification_stats AS
SELECT
    nc.user_id,
    nc.channel_type,
    COUNT(nh.id) as total_sent,
    COUNT(nh.id) FILTER (WHERE nh.status = 'sent') as successful,
    COUNT(nh.id) FILTER (WHERE nh.status = 'failed') as failed,
    MAX(nh.sent_at) as last_sent_at
FROM notification_channels nc
LEFT JOIN notification_history nh ON nc.id = nh.channel_id
GROUP BY nc.user_id, nc.channel_type;

-- 9. Realtime 활성화 (notification_queue 구독용)
-- Supabase에서 Realtime 활성화 필요
-- ALTER publication supabase_realtime ADD TABLE notification_queue;
CREATE INDEX IF NOT EXISTS idx_notification_queue_user ON notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_status ON notification_queue(user_id, status);

-- 10. 사용자 in_app 알림 채널 초기화 함수
CREATE OR REPLACE FUNCTION init_user_notification_channel(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_channel_id UUID;
BEGIN
    -- 이미 in_app 채널이 있는지 확인
    SELECT id INTO v_channel_id
    FROM notification_channels
    WHERE user_id = p_user_id AND channel_type = 'in_app';

    IF v_channel_id IS NULL THEN
        -- 없으면 생성
        INSERT INTO notification_channels (
            user_id,
            channel_type,
            channel_config,
            notification_settings,
            is_active,
            is_verified
        ) VALUES (
            p_user_id,
            'in_app',
            '{}',
            '{
                "enabled": true,
                "min_score": 50,
                "categories": [],
                "keywords": [],
                "notify_new_programs": true,
                "notify_ending_soon": true,
                "notify_high_match": true,
                "quiet_hours": null,
                "preferred_agent_id": null
            }'::jsonb,
            true,
            true
        )
        RETURNING id INTO v_channel_id;
    END IF;

    RETURN v_channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. 새 사용자 가입 시 자동 알림 채널 생성 트리거
CREATE OR REPLACE FUNCTION on_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM init_user_notification_channel(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거가 있으면 삭제 후 재생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- 참고: auth.users 트리거는 Supabase Dashboard에서 직접 설정 필요

-- 12. 알림 큐 정리 함수 (오래된 완료 알림 삭제)
CREATE OR REPLACE FUNCTION cleanup_notification_queue(days_old INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notification_queue
    WHERE status = 'completed'
    AND created_at < NOW() - (days_old || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
