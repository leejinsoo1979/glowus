// documents 버킷 파일 목록 확인 스크립트
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function checkDocumentsBucket() {
  console.log('=== Documents 버킷 파일 목록 ===\n')

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })

  // 루트 폴더 확인
  console.log('1. 루트 폴더 확인...')
  const { data: rootFiles, error: rootError } = await supabase.storage
    .from('documents')
    .list('', { limit: 100 })

  if (rootError) {
    console.error('   오류:', rootError.message)
  } else {
    console.log('   파일/폴더:', rootFiles?.map(f => f.name).join(', ') || '없음')
  }

  // business-plans 폴더 확인
  console.log('\n2. business-plans 폴더 확인...')
  const { data: bpFiles, error: bpError } = await supabase.storage
    .from('documents')
    .list('business-plans', { limit: 100 })

  if (bpError) {
    console.error('   오류:', bpError.message)
  } else {
    console.log('   Plan IDs:', bpFiles?.map(f => f.name).join(', ') || '없음')
  }

  // 가장 최근 플랜 폴더 확인
  if (bpFiles && bpFiles.length > 0) {
    const latestPlanId = bpFiles[0].name
    console.log(`\n3. 최근 플랜 폴더 (${latestPlanId}) 확인...`)

    const { data: planFiles, error: planError } = await supabase.storage
      .from('documents')
      .list(`business-plans/${latestPlanId}`, { limit: 100 })

    if (planError) {
      console.error('   오류:', planError.message)
    } else {
      console.log('   파일 목록:')
      for (const f of planFiles || []) {
        console.log(`   - ${f.name} (${f.metadata?.size || 'unknown'} bytes)`)

        // URL 생성
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(`business-plans/${latestPlanId}/${f.name}`)
        console.log(`     URL: ${urlData.publicUrl}`)
      }
    }
  }

  // 특정 플랜 ID로 직접 확인
  const planId = 'fc49cbb3-ed4b-49d5-b66c-adf6afef65d1'
  console.log(`\n4. 특정 플랜 (${planId}) 확인...`)

  const { data: specificFiles, error: specificError } = await supabase.storage
    .from('documents')
    .list(`business-plans/${planId}`, { limit: 100 })

  if (specificError) {
    console.error('   오류:', specificError.message)
  } else if (!specificFiles || specificFiles.length === 0) {
    console.log('   파일 없음')
  } else {
    console.log('   파일 목록:')
    for (const f of specificFiles || []) {
      console.log(`   - ${f.name}`)

      // 다운로드 URL 생성
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(`business-plans/${planId}/${f.name}`)
      console.log(`     Public URL: ${urlData.publicUrl}`)

      // 파일 다운로드 시도
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(`business-plans/${planId}/${f.name}`)

      if (downloadError) {
        console.log(`     다운로드 오류: ${downloadError.message}`)
      } else {
        console.log(`     다운로드 성공: ${fileData?.size || 0} bytes`)
      }
    }
  }

  console.log('\n=== 완료 ===')
}

checkDocumentsBucket().catch(console.error)
