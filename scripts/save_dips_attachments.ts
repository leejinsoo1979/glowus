/**
 * DIPS 첨부파일 URL 수동 저장
 * K-Startup 페이지에서 확인된 첨부파일 목록
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// DIPS 첨부파일 목록 (K-Startup 공고 페이지에서 확인)
const attachments = {
  // 주요 첨부파일 (공고문, 사업계획서 양식 등)
  attachments_primary: [
    {
      name: '2026년 초격차 스타트업 프로젝트(DIPS) 창업기업 모집공고문.pdf',
      url: 'https://www.k-startup.go.kr/afile/fileDownload/SqhRY'
    },
    {
      name: '(별첨1) 2026년 초격차 스타트업 프로젝트(DIPS) 창업기업 사업계획서.hwp',
      url: 'https://www.k-startup.go.kr/afile/fileDownload/SqiLn'
    }
  ],
  // 추가 첨부파일 (증빙, 지침 등)
  attachments_extra: [
    {
      name: '(별첨2) 2026년 초격차 스타트업 프로젝트(DIPS) 창업기업 기타증빙자료.hwp',
      url: 'https://www.k-startup.go.kr/afile/fileDownload/SqiNn'
    },
    {
      name: '(별첨3) 정부지원금 예산 세부항목 작성사례.hwp',
      url: 'https://www.k-startup.go.kr/afile/fileDownload/SqiHn'
    },
    {
      name: '(별첨4) 민간자금 예산 세부항목 작성사례.hwp',
      url: 'https://www.k-startup.go.kr/afile/fileDownload/SqiFn'
    },
    {
      name: '(별첨5) 2026년 초격차 스타트업 프로젝트(DIPS) 창업기업 사업비 관리지침.hwp',
      url: 'https://www.k-startup.go.kr/afile/fileDownload/SqiJn'
    },
    {
      name: '(별첨6) 2026년 초격차 스타트업 프로젝트(DIPS) 창업기업 사업비 통합관리지침(계상기준).hwp',
      url: 'https://www.k-startup.go.kr/afile/fileDownload/SqiDn'
    },
    {
      name: '(별첨7) 2026년 DIPS 창업기업 신청양식 작성 가이드.pdf',
      url: 'https://www.k-startup.go.kr/afile/fileDownload/SqiBn'
    },
    {
      name: '(별첨8) 공정경쟁규약 이행 동의서.hwp',
      url: 'https://www.k-startup.go.kr/afile/fileDownload/SqiPn'
    },
    {
      name: '(별첨9) 신청자격요건 적합판정 동의서.hwp',
      url: 'https://www.k-startup.go.kr/afile/fileDownload/Sqzhn'
    },
    {
      name: '(별첨10) 외국인 참여 동의서.hwp',
      url: 'https://www.k-startup.go.kr/afile/fileDownload/Sqzjn'
    }
  ]
}

async function main() {
  console.log('=== DIPS 첨부파일 URL 저장 ===\n')

  // 1. DIPS 프로그램 조회
  const { data: programs, error } = await supabase
    .from('government_programs')
    .select('id, title')
    .ilike('title', '%초격차%')
    .limit(1)

  if (error || !programs?.length) {
    console.error('DIPS 프로그램을 찾을 수 없습니다:', error)
    return
  }

  const program = programs[0]
  console.log(`프로그램: ${program.title}`)
  console.log(`ID: ${program.id}\n`)

  // 2. 첨부파일 URL 저장
  console.log('첨부파일 저장 중...')
  console.log(`- Primary: ${attachments.attachments_primary.length}개`)
  console.log(`- Extra: ${attachments.attachments_extra.length}개`)

  const { error: updateError } = await supabase
    .from('government_programs')
    .update({
      attachments_primary: attachments.attachments_primary,
      attachments_extra: attachments.attachments_extra,
      attachments_fetched_at: new Date().toISOString()
    })
    .eq('id', program.id)

  if (updateError) {
    console.error('\n저장 실패:', updateError)
    return
  }

  console.log('\n✅ 저장 완료!')

  // 3. 저장된 데이터 확인
  const { data: updated } = await supabase
    .from('government_programs')
    .select('attachments_primary, attachments_extra')
    .eq('id', program.id)
    .single()

  console.log('\n저장된 첨부파일:')
  console.log('\n[Primary]')
  for (const att of (updated?.attachments_primary || [])) {
    console.log(`  - ${att.name}`)
  }
  console.log('\n[Extra]')
  for (const att of (updated?.attachments_extra || [])) {
    console.log(`  - ${att.name}`)
  }
}

main().catch(console.error)
