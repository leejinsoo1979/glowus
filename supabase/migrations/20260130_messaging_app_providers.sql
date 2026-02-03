-- =============================================
-- 메시징 앱 프로바이더 추가 (Telegram, Discord, WhatsApp)
-- 에이전트가 메시지를 보내고 받을 수 있도록 지원
-- =============================================

-- Telegram Bot 프로바이더
INSERT INTO app_providers (id, name, description, icon_url, auth_type, oauth_config, capabilities) VALUES
('telegram-bot', 'Telegram Bot', '텔레그램 봇으로 메시지를 보내고 받습니다', '/icons/telegram.svg', 'api_key',
  '{"setup_url": "https://core.telegram.org/bots#how-do-i-create-a-bot", "docs_url": "https://core.telegram.org/bots/api"}'::jsonb,
  '{"send_message": true, "receive_message": true, "send_photo": true, "send_document": true, "get_updates": true}'::jsonb),

-- Discord Webhook 프로바이더
('discord', 'Discord', '디스코드 채널에 메시지를 보냅니다', '/icons/discord.svg', 'webhook',
  '{"setup_url": "https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks", "docs_url": "https://discord.com/developers/docs/resources/webhook"}'::jsonb,
  '{"send_message": true, "send_embed": true, "send_file": true}'::jsonb),

-- WhatsApp Business 프로바이더
('whatsapp', 'WhatsApp', 'WhatsApp Business API로 메시지를 보냅니다', '/icons/whatsapp.svg', 'api_key',
  '{"setup_url": "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started", "docs_url": "https://developers.facebook.com/docs/whatsapp/cloud-api"}'::jsonb,
  '{"send_message": true, "send_template": true, "send_media": true}'::jsonb),

-- Microsoft Teams Webhook 프로바이더
('microsoft-teams', 'Microsoft Teams', 'Teams 채널에 메시지를 보냅니다', '/icons/teams.svg', 'webhook',
  '{"setup_url": "https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook", "docs_url": "https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/connectors-using"}'::jsonb,
  '{"send_message": true, "send_card": true}'::jsonb)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon_url = EXCLUDED.icon_url,
  auth_type = EXCLUDED.auth_type,
  oauth_config = EXCLUDED.oauth_config,
  capabilities = EXCLUDED.capabilities;
