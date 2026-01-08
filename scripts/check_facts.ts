// 팩트카드 확인 스크립트
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const planId = process.argv[2] || '2e9ca382-a214-4a97-bbc4-48f811d92f26'

async function check() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })

  // company_id 조회
  const { data: plan } = await supabase
    .from('business_plans')
    .select('company_id')
    .eq('id', planId)
    .single()

  console.log('Company ID:', plan?.company_id)

  // 팩트카드 조회
  const { data: facts } = await supabase
    .from('company_fact_cards')
    .select('id, fact_key, category')
    .eq('company_id', plan?.company_id)

  console.log('Facts count:', facts?.length || 0)
  if (facts && facts.length > 0) {
    facts.slice(0, 10).forEach(f => console.log(' -', f.category, ':', f.fact_key))
  }
}

check()
