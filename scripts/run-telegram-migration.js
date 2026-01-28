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

const supabase = createClient(supabaseUrl, supabaseKey)

const sqlFile = path.join(__dirname, '../supabase/migrations/20260129_telegram_chat_history.sql')
const sql = fs.readFileSync(sqlFile, 'utf8')

async function runMigration() {
  try {
    console.log('🚀 Executing SQL migration...')

    // Split SQL by statement boundaries (CREATE, ALTER, etc.)
    const statements = sql
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'))

    console.log(`Found ${statements.length} SQL statements`)

    for (const statement of statements) {
      const preview = statement.substring(0, 80).replace(/\n/g, ' ')
      console.log(`\nExecuting: ${preview}...`)

      // Execute using raw SQL query through Supabase
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' })

      if (error) {
        console.error(`❌ Error: ${error.message}`)

        // If RPC method doesn't exist, try direct execution
        if (error.message.includes('exec_sql')) {
          console.log('⚠️  RPC method not available, trying direct SQL execution...')

          // For tables, use from() with insert
          if (statement.includes('CREATE TABLE')) {
            console.log('📝 Cannot create tables via client. Please use Supabase Dashboard SQL Editor:')
            console.log('   https://supabase.com/dashboard/project/zcykttygjglzyyxotzct/sql')
            console.log('\nSQL to execute:')
            console.log('=' .repeat(80))
            console.log(sql)
            console.log('=' .repeat(80))
            process.exit(1)
          }
        }
      } else {
        console.log('✅ Success')
      }
    }

    console.log('\n✅ Migration completed!')

    // Verify tables exist
    console.log('\n🔍 Verifying tables...')
    const { data: users, error: usersError } = await supabase
      .from('telegram_users')
      .select('count', { count: 'exact', head: true })

    if (!usersError) {
      console.log('✅ telegram_users table exists')
    } else {
      console.log('❌ telegram_users table missing:', usersError.message)
    }

  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

runMigration()
