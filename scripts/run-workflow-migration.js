/**
 * Run Workflow System Migration using direct SQL
 */

async function runMigration() {
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjeWt0dHlnamdsenl5eG90emN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTMzODkxNSwiZXhwIjoyMDgwOTE0OTE1fQ.SovGgYnnamWGIza0fiG0uYCzW8p4c5bG3qAeBRAz0UU'

  const tables = [
    {
      name: 'workflow_definitions',
      sql: `CREATE TABLE IF NOT EXISTS workflow_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
        input_schema JSONB,
        steps JSONB NOT NULL,
        start_step_id VARCHAR(100) NOT NULL,
        tags TEXT[],
        category VARCHAR(50),
        is_template BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        company_id UUID,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'workflow_executions',
      sql: `CREATE TABLE IF NOT EXISTS workflow_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID,
        workflow_version VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'running',
        current_step_id VARCHAR(100),
        inputs JSONB DEFAULT '{}',
        outputs JSONB,
        step_results JSONB DEFAULT '{}',
        error TEXT,
        agent_id UUID,
        company_id UUID,
        user_id UUID,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}'
      )`
    },
    {
      name: 'workflow_execution_logs',
      sql: `CREATE TABLE IF NOT EXISTS workflow_execution_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        execution_id UUID,
        event_type VARCHAR(50) NOT NULL,
        step_id VARCHAR(100),
        data JSONB,
        error TEXT,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'workflow_templates',
      sql: `CREATE TABLE IF NOT EXISTS workflow_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL,
        workflow_definition JSONB NOT NULL,
        variables JSONB,
        usage_count INT DEFAULT 0,
        is_public BOOLEAN DEFAULT true,
        company_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'workflow_schedules',
      sql: `CREATE TABLE IF NOT EXISTS workflow_schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID,
        name VARCHAR(255),
        schedule_type VARCHAR(20) NOT NULL,
        cron_expression VARCHAR(100),
        scheduled_at TIMESTAMPTZ,
        inputs JSONB DEFAULT '{}',
        agent_id UUID,
        company_id UUID,
        is_active BOOLEAN DEFAULT true,
        last_run_at TIMESTAMPTZ,
        next_run_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    }
  ]

  console.log('Running workflow migration via Supabase Query API...\n')

  for (const table of tables) {
    try {
      const response = await fetch('https://zcykttygjglzyyxotzct.supabase.co/rest/v1/rpc/query', {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ sql: table.sql })
      })

      if (!response.ok) {
        // Try direct pg endpoint
        const pgResponse = await fetch(`https://zcykttygjglzyyxotzct.supabase.co/pg`, {
          method: 'POST',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: table.sql })
        })

        if (!pgResponse.ok) {
          console.log(`⚠ ${table.name}: Need to run SQL manually in Supabase Dashboard`)
        } else {
          console.log(`✓ ${table.name} created`)
        }
      } else {
        console.log(`✓ ${table.name} created`)
      }
    } catch (err) {
      console.log(`⚠ ${table.name}: ${err.message}`)
    }
  }

  console.log('\n===========================================')
  console.log('If tables were not created, please run the SQL')
  console.log('manually in Supabase Dashboard -> SQL Editor:')
  console.log('File: supabase/migrations/20251229_workflow_system.sql')
  console.log('===========================================')
}

runMigration().catch(console.error)
