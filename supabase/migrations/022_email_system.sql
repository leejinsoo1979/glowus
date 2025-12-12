-- Email System Schema
-- Supports Gmail and Whois mail integration via IMAP/SMTP

-- Email Accounts (stores user's email account credentials)
CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

  -- Account info
  email_address TEXT NOT NULL,
  display_name TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'whois', 'custom')),

  -- IMAP settings (for receiving)
  imap_host TEXT NOT NULL,
  imap_port INTEGER NOT NULL DEFAULT 993,
  imap_secure BOOLEAN DEFAULT true,

  -- SMTP settings (for sending)
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_secure BOOLEAN DEFAULT true,

  -- Credentials (encrypted)
  encrypted_password TEXT NOT NULL,

  -- OAuth tokens (for Gmail)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, email_address)
);

-- Email Messages (cached emails from IMAP)
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,

  -- Email identifiers
  message_id TEXT NOT NULL, -- RFC Message-ID
  uid INTEGER NOT NULL, -- IMAP UID
  folder TEXT NOT NULL DEFAULT 'INBOX',

  -- Email headers
  subject TEXT,
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_addresses JSONB DEFAULT '[]', -- [{email, name}]
  cc_addresses JSONB DEFAULT '[]',
  bcc_addresses JSONB DEFAULT '[]',
  reply_to TEXT,

  -- Email content
  body_text TEXT,
  body_html TEXT,
  snippet TEXT, -- Preview text (first 200 chars)

  -- Attachments
  has_attachments BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]', -- [{filename, contentType, size, cid}]

  -- Threading
  thread_id TEXT,
  in_reply_to TEXT,
  references_list JSONB DEFAULT '[]',

  -- Status flags
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_draft BOOLEAN DEFAULT false,
  is_sent BOOLEAN DEFAULT false,
  is_spam BOOLEAN DEFAULT false,
  is_trash BOOLEAN DEFAULT false,

  -- AI analysis
  ai_summary TEXT,
  ai_priority TEXT CHECK (ai_priority IN ('urgent', 'high', 'normal', 'low')),
  ai_category TEXT, -- e.g., 'meeting', 'invoice', 'newsletter', 'personal'
  ai_sentiment TEXT CHECK (ai_sentiment IN ('positive', 'neutral', 'negative')),
  ai_action_required BOOLEAN DEFAULT false,
  ai_analyzed_at TIMESTAMPTZ,

  -- Timestamps
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(account_id, message_id)
);

-- Email Drafts (AI-generated or user drafts)
CREATE TABLE IF NOT EXISTS email_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Reply context
  reply_to_message_id UUID REFERENCES email_messages(id) ON DELETE SET NULL,
  is_reply BOOLEAN DEFAULT false,
  is_forward BOOLEAN DEFAULT false,

  -- Draft content
  subject TEXT,
  to_addresses JSONB DEFAULT '[]',
  cc_addresses JSONB DEFAULT '[]',
  bcc_addresses JSONB DEFAULT '[]',
  body_text TEXT,
  body_html TEXT,

  -- AI generation info
  ai_generated BOOLEAN DEFAULT false,
  ai_prompt TEXT, -- User's instruction to AI
  ai_context TEXT, -- Context used for generation

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Daily Summaries (AI-generated reports)
CREATE TABLE IF NOT EXISTS email_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL,

  -- Summary type
  summary_type TEXT NOT NULL CHECK (summary_type IN ('daily', 'weekly', 'custom')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Summary content
  total_emails INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,
  urgent_count INTEGER DEFAULT 0,

  -- AI-generated summary
  summary_text TEXT NOT NULL,
  key_highlights JSONB DEFAULT '[]', -- [{subject, from, priority, action}]
  action_items JSONB DEFAULT '[]', -- [{description, email_id, due_date}]

  -- Categories breakdown
  categories_breakdown JSONB DEFAULT '{}', -- {meeting: 5, invoice: 3, ...}

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Agent Tasks (AI bot actions)
CREATE TABLE IF NOT EXISTS email_agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,

  -- Task type
  task_type TEXT NOT NULL CHECK (task_type IN (
    'sync_inbox',
    'analyze_email',
    'generate_reply',
    'send_email',
    'generate_summary',
    'categorize_emails'
  )),

  -- Task parameters
  params JSONB DEFAULT '{}',

  -- Execution
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  result JSONB,
  error_message TEXT,

  -- Timing
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_accounts_user ON email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_team ON email_accounts(team_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_account ON email_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_folder ON email_messages(account_id, folder);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_received ON email_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_priority ON email_messages(ai_priority) WHERE ai_priority IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_drafts_account ON email_drafts(account_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_user ON email_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_summaries_user ON email_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_email_agent_tasks_status ON email_agent_tasks(status, scheduled_at);

-- Full-text search for emails
CREATE INDEX IF NOT EXISTS idx_email_messages_search ON email_messages
  USING gin(to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body_text, '')));

-- RLS Policies
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_agent_tasks ENABLE ROW LEVEL SECURITY;

-- Email Accounts: Users can only access their own accounts
CREATE POLICY "Users can view own email accounts"
  ON email_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email accounts"
  ON email_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email accounts"
  ON email_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email accounts"
  ON email_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Email Messages: Users can access messages from their accounts
CREATE POLICY "Users can view own email messages"
  ON email_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM email_accounts
      WHERE email_accounts.id = email_messages.account_id
      AND email_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own email messages"
  ON email_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM email_accounts
      WHERE email_accounts.id = email_messages.account_id
      AND email_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own email messages"
  ON email_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM email_accounts
      WHERE email_accounts.id = email_messages.account_id
      AND email_accounts.user_id = auth.uid()
    )
  );

-- Email Drafts: Users can only access their own drafts
CREATE POLICY "Users can view own drafts"
  ON email_drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drafts"
  ON email_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drafts"
  ON email_drafts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drafts"
  ON email_drafts FOR DELETE
  USING (auth.uid() = user_id);

-- Email Summaries: Users can only access their own summaries
CREATE POLICY "Users can view own summaries"
  ON email_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own summaries"
  ON email_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Email Agent Tasks: Users can only access their own tasks
CREATE POLICY "Users can view own agent tasks"
  ON email_agent_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agent tasks"
  ON email_agent_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agent tasks"
  ON email_agent_tasks FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_email_accounts_updated_at
  BEFORE UPDATE ON email_accounts
  FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();

CREATE TRIGGER update_email_messages_updated_at
  BEFORE UPDATE ON email_messages
  FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();

CREATE TRIGGER update_email_drafts_updated_at
  BEFORE UPDATE ON email_drafts
  FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();
