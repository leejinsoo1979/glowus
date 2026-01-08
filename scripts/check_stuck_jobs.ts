import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function check() {
  // 모든 running/pending 상태 Job 확인
  const { data: jobs } = await supabase
    .from('pipeline_jobs')
    .select('*')
    .in('status', ['running', 'pending'])
    .order('created_at', { ascending: false })

  console.log('=== 실행 중/대기 중인 Job ===')
  if (!jobs || jobs.length === 0) {
    console.log('없음')
  } else {
    for (const job of jobs) {
      console.log('Job ID:', job.id)
      console.log('  Plan ID:', job.plan_id)
      console.log('  Status:', job.status)
      console.log('  Current Stage:', job.current_stage)
      console.log('  Progress:', job.progress + '%')
      console.log('  Started:', job.started_at)
      console.log('  Stage Progress:', JSON.stringify(job.stage_progress))
      console.log('')
    }
  }

  // running 상태 Plan 찾기
  const { data: stuckPlans } = await supabase
    .from('business_plans')
    .select('id, title, pipeline_stage, pipeline_status, created_at')
    .eq('pipeline_status', 'running')

  console.log('=== running 상태 Plan ===')
  if (!stuckPlans || stuckPlans.length === 0) {
    console.log('없음')
  } else {
    for (const p of stuckPlans) {
      console.log('Plan:', p.id)
      console.log('  Title:', p.title)
      console.log('  Stage:', p.pipeline_stage)
    }
  }

  // Stage 1에서 멈춘 로그 확인
  const { data: logs } = await supabase
    .from('pipeline_execution_logs')
    .select('*')
    .eq('stage', 1)
    .eq('status', 'running')
    .order('created_at', { ascending: false })
    .limit(5)

  console.log('\n=== Stage 1 running 로그 ===')
  if (!logs || logs.length === 0) {
    console.log('없음')
  } else {
    for (const log of logs) {
      console.log('Log:', log.id)
      console.log('  Plan:', log.plan_id)
      console.log('  Message:', log.message)
      console.log('  Created:', log.created_at)
    }
  }
}

check().catch(console.error)
