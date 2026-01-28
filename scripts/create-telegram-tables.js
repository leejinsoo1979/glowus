#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTables() {
  console.log('🚀 Creating Telegram chat history tables...')

  const sql = `
-- 1. Telegram Users Table
CREATE TABLE IF NOT EXISTS telegram_users (
  id TEXT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  language_code TEXT,
  is_bot BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES auth.users(id),
  agent_id TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  total_messages INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Telegram Chat Sessions Table
CREATE TABLE IF NOT EXISTS telegram_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id TEXT NOT NULL REFERENCES telegram_users(id),
  chat_id BIGINT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chat_id, agent_id)
);

-- 3. Telegram Chat Messages Table
CREATE TABLE IF NOT EXISTS telegram_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES telegram_chat_sessions(id),
  telegram_user_id TEXT NOT NULL REFERENCES telegram_users(id),
  chat_id BIGINT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'model', 'system', 'assistant')),
  content TEXT NOT NULL,
  source TEXT DEFAULT 'telegram' CHECK (source IN ('telegram', 'web', 'api', 'whatsapp', 'messenger')),
  tool_calls JSONB,
  tool_results JSONB,
  message_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_telegram_users_user_id ON telegram_users(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_users_last_active ON telegram_users(last_active_at);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_user ON telegram_chat_sessions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_chat ON telegram_chat_sessions(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_agent ON telegram_chat_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_active ON telegram_chat_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_session ON telegram_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat ON telegram_chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_created ON telegram_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_index ON telegram_chat_messages(session_id, message_index);

-- RLS Policies
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role full access to telegram_users" ON telegram_users FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Service role full access to telegram_chat_sessions" ON telegram_chat_sessions FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Service role full access to telegram_chat_messages" ON telegram_chat_messages FOR ALL USING (true);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_telegram_users_updated_at BEFORE UPDATE ON telegram_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_telegram_chat_sessions_updated_at BEFORE UPDATE ON telegram_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`

  try {
    // Execute SQL using Supabase RPC
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      console.error('❌ Error creating tables:', error.message)

      // Try alternative method: direct REST API call
      console.log('🔄 Trying alternative method...')
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ sql_query: sql })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to execute SQL: ${errorText}`)
      }

      console.log('✅ Tables created successfully (alternative method)')
    } else {
      console.log('✅ Tables created successfully')
      console.log('📊 Result:', data)
    }

    // Verify tables exist
    const { data: tables, error: tablesError } = await supabase
      .from('telegram_users')
      .select('count', { count: 'exact', head: true })

    if (!tablesError) {
      console.log('✅ Verified: telegram_users table exists')
    }

  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

createTables()
