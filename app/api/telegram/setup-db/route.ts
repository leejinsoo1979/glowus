import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    // Create telegram_users table
    const { error: error1 } = await (supabase.rpc as any)('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS telegram_users (
          id TEXT PRIMARY KEY,
          username TEXT,
          first_name TEXT,
          last_name TEXT,
          language_code TEXT,
          is_bot BOOLEAN DEFAULT FALSE,
          user_id UUID,
          agent_id TEXT,
          first_seen_at TIMESTAMPTZ DEFAULT NOW(),
          last_active_at TIMESTAMPTZ DEFAULT NOW(),
          total_messages INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    })

    if (error1 && !error1.message.includes('already exists')) {
      console.error('Error creating telegram_users:', error1)
    }

    // Create telegram_chat_sessions table
    const { error: error2 } = await (supabase.rpc as any)('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS telegram_chat_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          telegram_user_id TEXT NOT NULL,
          chat_id BIGINT NOT NULL,
          agent_id TEXT NOT NULL,
          agent_name TEXT NOT NULL,
          started_at TIMESTAMPTZ DEFAULT NOW(),
          last_message_at TIMESTAMPTZ DEFAULT NOW(),
          message_count INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(chat_id, agent_id, is_active)
        );
      `
    })

    if (error2 && !error2.message.includes('already exists')) {
      console.error('Error creating telegram_chat_sessions:', error2)
    }

    // Create telegram_chat_messages table
    const { error: error3 } = await (supabase.rpc as any)('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS telegram_chat_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id UUID NOT NULL,
          telegram_user_id TEXT NOT NULL,
          chat_id BIGINT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('user', 'model', 'system')),
          content TEXT NOT NULL,
          tool_calls JSONB,
          tool_results JSONB,
          message_index INTEGER NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    })

    if (error3 && !error3.message.includes('already exists')) {
      console.error('Error creating telegram_chat_messages:', error3)
    }

    return NextResponse.json({
      success: true,
      message: 'Telegram chat tables setup complete',
      errors: [error1, error2, error3].filter(Boolean),
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    })
  }
}
