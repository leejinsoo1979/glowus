// Apply Agent Memory System Migration
// Run: node scripts/apply-memory-migration.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function applyMigration() {
  console.log('🚀 Starting Agent Memory System Migration...\n')

  const migrations = [
    {
      name: 'Enable pgvector extension',
      sql: `CREATE EXTENSION IF NOT EXISTS vector;`
    },
    {
      name: 'Create agent_work_logs table',
      sql: `
        CREATE TABLE IF NOT EXISTS public.agent_work_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id UUID NOT NULL REFERENCES public.deployed_agents(id) ON DELETE CASCADE,
          log_type TEXT NOT NULL CHECK (log_type IN (
            'conversation', 'task_work', 'decision', 'analysis',
            'learning', 'collaboration', 'error', 'milestone'
          )),
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          summary TEXT,
          room_id UUID REFERENCES public.chat_rooms(id) ON DELETE SET NULL,
          task_id UUID,
          project_id UUID,
          related_agent_ids UUID[] DEFAULT '{}',
          importance INTEGER DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
          tags TEXT[] DEFAULT '{}',
          metadata JSONB DEFAULT '{}',
          embedding vector(1536),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    },
    {
      name: 'Create agent_work_logs indexes',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_agent_work_logs_agent_id ON public.agent_work_logs(agent_id);
        CREATE INDEX IF NOT EXISTS idx_agent_work_logs_room_id ON public.agent_work_logs(room_id);
        CREATE INDEX IF NOT EXISTS idx_agent_work_logs_log_type ON public.agent_work_logs(log_type);
        CREATE INDEX IF NOT EXISTS idx_agent_work_logs_created_at ON public.agent_work_logs(created_at DESC);
      `
    },
    {
      name: 'Create agent_commits table',
      sql: `
        CREATE TABLE IF NOT EXISTS public.agent_commits (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id UUID NOT NULL REFERENCES public.deployed_agents(id) ON DELETE CASCADE,
          commit_type TEXT NOT NULL CHECK (commit_type IN (
            'hourly', 'daily', 'weekly', 'monthly', 'milestone'
          )),
          period_start TIMESTAMPTZ NOT NULL,
          period_end TIMESTAMPTZ NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          stats JSONB DEFAULT '{}'::jsonb,
          log_ids UUID[] DEFAULT '{}',
          learnings TEXT[] DEFAULT '{}',
          insights TEXT[] DEFAULT '{}',
          embedding vector(1536),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    },
    {
      name: 'Create agent_commits indexes',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_agent_commits_agent_id ON public.agent_commits(agent_id);
        CREATE INDEX IF NOT EXISTS idx_agent_commits_commit_type ON public.agent_commits(commit_type);
        CREATE INDEX IF NOT EXISTS idx_agent_commits_period_end ON public.agent_commits(period_end DESC);
      `
    },
    {
      name: 'Create agent_knowledge table',
      sql: `
        CREATE TABLE IF NOT EXISTS public.agent_knowledge (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id UUID NOT NULL REFERENCES public.deployed_agents(id) ON DELETE CASCADE,
          knowledge_type TEXT NOT NULL CHECK (knowledge_type IN (
            'project', 'team', 'domain', 'preference',
            'procedure', 'decision_rule', 'lesson_learned'
          )),
          subject TEXT NOT NULL,
          content TEXT NOT NULL,
          project_id UUID,
          team_id UUID,
          confidence DECIMAL(3,2) DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
          tags TEXT[] DEFAULT '{}',
          embedding vector(1536),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    },
    {
      name: 'Create agent_knowledge indexes',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_agent_knowledge_agent_id ON public.agent_knowledge(agent_id);
        CREATE INDEX IF NOT EXISTS idx_agent_knowledge_type ON public.agent_knowledge(knowledge_type);
      `
    },
    {
      name: 'Create agent_identity table',
      sql: `
        CREATE TABLE IF NOT EXISTS public.agent_identity (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id UUID NOT NULL REFERENCES public.deployed_agents(id) ON DELETE CASCADE,
          core_values TEXT[] DEFAULT '{}',
          personality_traits TEXT[] DEFAULT '{}',
          communication_style TEXT,
          expertise_areas JSONB DEFAULT '[]'::jsonb,
          working_style TEXT,
          strengths TEXT[] DEFAULT '{}',
          growth_areas TEXT[] DEFAULT '{}',
          self_summary TEXT,
          recent_focus TEXT,
          total_conversations INTEGER DEFAULT 0,
          total_tasks_completed INTEGER DEFAULT 0,
          total_decisions_made INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(agent_id)
        );
      `
    },
    {
      name: 'Create match_agent_knowledge function',
      sql: `
        CREATE OR REPLACE FUNCTION public.match_agent_knowledge(
          agent_id_input UUID,
          query_embedding vector(1536),
          match_threshold FLOAT DEFAULT 0.7,
          match_count INT DEFAULT 5
        )
        RETURNS TABLE (
          id UUID,
          agent_id UUID,
          knowledge_type TEXT,
          subject TEXT,
          content TEXT,
          confidence DECIMAL(3,2),
          tags TEXT[],
          similarity FLOAT
        )
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RETURN QUERY
          SELECT
            ak.id,
            ak.agent_id,
            ak.knowledge_type,
            ak.subject,
            ak.content,
            ak.confidence,
            ak.tags,
            1 - (ak.embedding <=> query_embedding) AS similarity
          FROM public.agent_knowledge ak
          WHERE
            ak.agent_id = agent_id_input
            AND ak.embedding IS NOT NULL
            AND 1 - (ak.embedding <=> query_embedding) > match_threshold
          ORDER BY ak.embedding <=> query_embedding
          LIMIT match_count;
        END;
        $$;
      `
    },
    {
      name: 'Create match_agent_logs function',
      sql: `
        CREATE OR REPLACE FUNCTION public.match_agent_logs(
          agent_id_input UUID,
          query_embedding vector(1536),
          match_threshold FLOAT DEFAULT 0.7,
          match_count INT DEFAULT 10
        )
        RETURNS TABLE (
          id UUID,
          agent_id UUID,
          log_type TEXT,
          title TEXT,
          content TEXT,
          summary TEXT,
          room_id UUID,
          importance INTEGER,
          created_at TIMESTAMPTZ,
          similarity FLOAT
        )
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RETURN QUERY
          SELECT
            al.id,
            al.agent_id,
            al.log_type,
            al.title,
            al.content,
            al.summary,
            al.room_id,
            al.importance,
            al.created_at,
            1 - (al.embedding <=> query_embedding) AS similarity
          FROM public.agent_work_logs al
          WHERE
            al.agent_id = agent_id_input
            AND al.embedding IS NOT NULL
            AND 1 - (al.embedding <=> query_embedding) > match_threshold
          ORDER BY al.embedding <=> query_embedding
          LIMIT match_count;
        END;
        $$;
      `
    },
    {
      name: 'Enable RLS on agent_work_logs',
      sql: `
        ALTER TABLE public.agent_work_logs ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Agent work logs select" ON public.agent_work_logs;
        CREATE POLICY "Agent work logs select"
          ON public.agent_work_logs FOR SELECT
          TO authenticated
          USING (true);

        DROP POLICY IF EXISTS "Agent work logs insert" ON public.agent_work_logs;
        CREATE POLICY "Agent work logs insert"
          ON public.agent_work_logs FOR INSERT
          TO authenticated
          WITH CHECK (true);
      `
    },
    {
      name: 'Enable RLS on agent_commits',
      sql: `
        ALTER TABLE public.agent_commits ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Agent commits select" ON public.agent_commits;
        CREATE POLICY "Agent commits select"
          ON public.agent_commits FOR SELECT
          TO authenticated
          USING (true);

        DROP POLICY IF EXISTS "Agent commits insert" ON public.agent_commits;
        CREATE POLICY "Agent commits insert"
          ON public.agent_commits FOR INSERT
          TO authenticated
          WITH CHECK (true);
      `
    },
    {
      name: 'Enable RLS on agent_knowledge',
      sql: `
        ALTER TABLE public.agent_knowledge ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Agent knowledge select" ON public.agent_knowledge;
        CREATE POLICY "Agent knowledge select"
          ON public.agent_knowledge FOR SELECT
          TO authenticated
          USING (true);

        DROP POLICY IF EXISTS "Agent knowledge insert" ON public.agent_knowledge;
        CREATE POLICY "Agent knowledge insert"
          ON public.agent_knowledge FOR INSERT
          TO authenticated
          WITH CHECK (true);

        DROP POLICY IF EXISTS "Agent knowledge update" ON public.agent_knowledge;
        CREATE POLICY "Agent knowledge update"
          ON public.agent_knowledge FOR UPDATE
          TO authenticated
          USING (true);
      `
    },
    {
      name: 'Enable RLS on agent_identity',
      sql: `
        ALTER TABLE public.agent_identity ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Agent identity select" ON public.agent_identity;
        CREATE POLICY "Agent identity select"
          ON public.agent_identity FOR SELECT
          TO authenticated
          USING (true);

        DROP POLICY IF EXISTS "Agent identity insert" ON public.agent_identity;
        CREATE POLICY "Agent identity insert"
          ON public.agent_identity FOR INSERT
          TO authenticated
          WITH CHECK (true);

        DROP POLICY IF EXISTS "Agent identity update" ON public.agent_identity;
        CREATE POLICY "Agent identity update"
          ON public.agent_identity FOR UPDATE
          TO authenticated
          USING (true);
      `
    },
    {
      name: 'Create updated_at trigger function',
      sql: `
        CREATE OR REPLACE FUNCTION public.update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `
    },
    {
      name: 'Create triggers for updated_at',
      sql: `
        DROP TRIGGER IF EXISTS update_agent_knowledge_updated_at ON public.agent_knowledge;
        CREATE TRIGGER update_agent_knowledge_updated_at
          BEFORE UPDATE ON public.agent_knowledge
          FOR EACH ROW
          EXECUTE FUNCTION public.update_updated_at_column();

        DROP TRIGGER IF EXISTS update_agent_identity_updated_at ON public.agent_identity;
        CREATE TRIGGER update_agent_identity_updated_at
          BEFORE UPDATE ON public.agent_identity
          FOR EACH ROW
          EXECUTE FUNCTION public.update_updated_at_column();
      `
    }
  ]

  let successCount = 0
  let failCount = 0

  for (const migration of migrations) {
    try {
      console.log(`📦 ${migration.name}...`)

      const { error } = await supabase.rpc('exec_sql', { sql: migration.sql })

      if (error) {
        // Try direct query if rpc fails
        const { error: directError } = await supabase
          .from('_migrations')
          .select('*')
          .limit(0)

        // Just log and continue - some operations might fail if already exist
        console.log(`   ⚠️  ${error.message}`)
        failCount++
      } else {
        console.log(`   ✅ Success`)
        successCount++
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`)
      failCount++
    }
  }

  console.log(`\n📊 Migration Summary:`)
  console.log(`   ✅ Success: ${successCount}`)
  console.log(`   ❌ Failed: ${failCount}`)
  console.log(`\n⚠️  Note: If migrations failed, please run the SQL manually in Supabase Dashboard`)
  console.log(`   Go to: https://supabase.com/dashboard/project/zcykttygjglzyyxotzct/sql/new`)
}

applyMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
