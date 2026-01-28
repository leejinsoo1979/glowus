#!/usr/bin/env node
/**
 * Telegram Memory Migration Script
 * 마지막 프로젝트 및 작업 기록 테이블 추가
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://zcykttygjglzyyxotzct.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjeWt0dHlnamdsenl5eG90emN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTMzODkxNSwiZXhwIjoyMDgwOTE0OTE1fQ.SovGgYnnamWGIza0fiG0uYCzW8p4c5bG3qAeBRAz0UU'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function runMigration() {
  console.log('🚀 Running Telegram Memory Migration...\n')

  // 1. Add columns to telegram_users
  console.log('1. Adding last_project columns to telegram_users...')

  // Try to insert a test value to check if column exists, then alter if needed
  const testQueries = [
    `ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS last_project TEXT`,
    `ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS last_project_path TEXT`,
    `ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS last_project_at TIMESTAMPTZ`,
  ]

  // Since we can't run raw SQL directly, let's use a workaround
  // We'll test by selecting the column first
  const { data: testData, error: testError } = await supabase
    .from('telegram_users')
    .select('last_project')
    .limit(1)

  if (testError && testError.message.includes('column "last_project" does not exist')) {
    console.log('❌ last_project column does not exist. Please run this SQL manually:')
    console.log(`
    ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS last_project TEXT;
    ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS last_project_path TEXT;
    ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS last_project_at TIMESTAMPTZ;
    `)
  } else if (!testError) {
    console.log('✅ last_project column already exists')
  }

  // 2. Create telegram_work_history table
  console.log('\n2. Creating telegram_work_history table...')

  const { data: workHistoryTest, error: workHistoryError } = await supabase
    .from('telegram_work_history')
    .select('id')
    .limit(1)

  if (workHistoryError && workHistoryError.message.includes('does not exist')) {
    console.log('❌ telegram_work_history table does not exist. Please run the SQL manually.')
  } else if (!workHistoryError) {
    console.log('✅ telegram_work_history table already exists')
  }

  // 3. Create telegram_agent_learnings table
  console.log('\n3. Creating telegram_agent_learnings table...')

  const { data: learningsTest, error: learningsError } = await supabase
    .from('telegram_agent_learnings')
    .select('id')
    .limit(1)

  if (learningsError && learningsError.message.includes('does not exist')) {
    console.log('❌ telegram_agent_learnings table does not exist. Please run the SQL manually.')
  } else if (!learningsError) {
    console.log('✅ telegram_agent_learnings table already exists')
  }

  console.log('\n📋 Summary:')
  console.log('If any tables/columns are missing, please run the SQL in:')
  console.log('supabase/migrations/20260129_telegram_work_memory.sql')
  console.log('\nOr copy-paste the SQL in Supabase Dashboard > SQL Editor')
}

runMigration().catch(console.error)
