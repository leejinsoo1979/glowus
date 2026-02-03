INSERT INTO app_providers (id, name, description, icon_url, auth_type, oauth_config, capabilities) VALUES
('telegram-bot', 'Telegram', '텔레그램 봇으로 메시지를 보내고 받습니다', '/icons/telegram.svg', 'api_key',
  '{"setup_url": "https://core.telegram.org/bots"}'::jsonb,
  '{"send_message": true, "receive_message": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, auth_type = EXCLUDED.auth_type;

INSERT INTO app_providers (id, name, description, icon_url, auth_type, oauth_config, capabilities) VALUES
('discord', 'Discord', '디스코드 채널에 메시지를 보냅니다', '/icons/discord.svg', 'webhook',
  '{"setup_url": "https://support.discord.com"}'::jsonb,
  '{"send_message": true, "send_embed": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, auth_type = EXCLUDED.auth_type;

INSERT INTO app_providers (id, name, description, icon_url, auth_type, oauth_config, capabilities) VALUES
('whatsapp', 'WhatsApp', 'WhatsApp Business API로 메시지를 보냅니다', '/icons/whatsapp.svg', 'api_key',
  '{"setup_url": "https://developers.facebook.com/docs/whatsapp"}'::jsonb,
  '{"send_message": true, "send_template": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, auth_type = EXCLUDED.auth_type;

INSERT INTO app_providers (id, name, description, icon_url, auth_type, oauth_config, capabilities) VALUES
('microsoft-teams', 'Microsoft Teams', 'Teams 채널에 메시지를 보냅니다', '/icons/teams.svg', 'webhook',
  '{"setup_url": "https://docs.microsoft.com"}'::jsonb,
  '{"send_message": true, "send_card": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, auth_type = EXCLUDED.auth_type;
