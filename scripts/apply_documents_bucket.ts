// documents 스토리지 버킷 생성 스크립트
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function createDocumentsBucket() {
  console.log('=== Documents 버킷 생성 ===\n')

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })

  // 기존 버킷 확인
  console.log('1. 기존 버킷 목록 확인...')
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()

  if (listError) {
    console.error('   버킷 목록 조회 실패:', listError.message)
  } else {
    console.log('   기존 버킷:', buckets?.map(b => b.name).join(', ') || '없음')
  }

  // documents 버킷 존재 확인
  const documentsExists = buckets?.some(b => b.id === 'documents')

  if (documentsExists) {
    console.log('\n✅ documents 버킷이 이미 존재합니다!')
  } else {
    // 버킷 생성
    console.log('\n2. documents 버킷 생성 중...')
    const { data, error: createError } = await supabase.storage.createBucket('documents', {
      public: true,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/html'
      ]
    })

    if (createError) {
      console.error('   버킷 생성 실패:', createError.message)
    } else {
      console.log('   ✅ documents 버킷 생성 완료!')
    }
  }

  // 버킷 목록 다시 확인
  console.log('\n3. 최종 버킷 목록 확인...')
  const { data: finalBuckets } = await supabase.storage.listBuckets()
  console.log('   버킷:', finalBuckets?.map(b => `${b.name} (public: ${b.public})`).join(', '))

  // 테스트 업로드
  console.log('\n4. 테스트 파일 업로드...')
  const testContent = 'Test document content'
  const testPath = 'test/test.txt'

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(testPath, testContent, {
      contentType: 'text/plain',
      upsert: true
    })

  if (uploadError) {
    console.error('   테스트 업로드 실패:', uploadError.message)
  } else {
    console.log('   ✅ 테스트 파일 업로드 성공!')

    // URL 확인
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(testPath)
    console.log('   URL:', urlData.publicUrl)

    // 테스트 파일 삭제
    await supabase.storage.from('documents').remove([testPath])
    console.log('   테스트 파일 삭제 완료')
  }

  console.log('\n=== 완료 ===')
}

createDocumentsBucket().catch(console.error)
