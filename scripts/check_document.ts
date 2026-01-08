import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const planId = process.argv[2] || '5a973e34-cf69-41a9-a5ef-0f6efa3adc75'

async function check() {
  console.log('=== 문서 확인 ===\n')
  console.log('Plan ID:', planId)

  // 1. Plan 정보 확인
  const { data: plan } = await supabase
    .from('business_plans')
    .select('id, title, generated_document_url, pipeline_stage, pipeline_status')
    .eq('id', planId)
    .single()

  console.log('\n1. Plan 정보:')
  console.log('   - Title:', plan?.title)
  console.log('   - Stage:', plan?.pipeline_stage)
  console.log('   - Status:', plan?.pipeline_status)
  console.log('   - Document URL:', plan?.generated_document_url || '없음')

  // 2. Storage에서 문서 확인
  const { data: files, error: listError } = await supabase.storage
    .from('documents')
    .list('business-plans/' + planId)

  console.log('\n2. Storage 파일:')
  if (listError) {
    console.log('   오류:', listError.message)
  } else if (!files || files.length === 0) {
    console.log('   파일 없음')
  } else {
    for (const file of files) {
      console.log('   -', file.name)

      // URL 생성
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl('business-plans/' + planId + '/' + file.name)

      console.log('     URL:', urlData.publicUrl)

      // 다운로드 테스트
      try {
        const res = await fetch(urlData.publicUrl)
        if (res.ok) {
          const blob = await res.blob()
          console.log('     Size:', blob.size, 'bytes')
        } else {
          console.log('     다운로드 실패:', res.status)
        }
      } catch (e: any) {
        console.log('     다운로드 오류:', e.message)
      }
    }
  }

  console.log('\n=== 완료 ===')
}

check().catch(console.error)
