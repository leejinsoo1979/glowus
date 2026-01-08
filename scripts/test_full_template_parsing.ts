/**
 * DIPS 템플릿 전체 파싱 테스트
 * - HWP 다운로드
 * - 텍스트 추출
 * - AI 구조 추출
 * - DB 저장
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { parseAttachmentTemplate } from '../lib/business-plan/attachment-parser'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const DIPS_PROGRAM_ID = 'b5ba0abf-8fb6-47ee-ab0c-d450207be9c3'

async function main() {
  console.log('=== DIPS 템플릿 전체 파싱 테스트 ===\n')

  // 1. 프로그램 정보 확인
  const { data: program } = await supabase
    .from('government_programs')
    .select('id, title, attachments_primary, attachments_extra')
    .eq('id', DIPS_PROGRAM_ID)
    .single()

  if (!program) {
    console.error('프로그램을 찾을 수 없습니다')
    return
  }

  console.log(`프로그램: ${program.title}`)
  console.log(`첨부파일:`)
  console.log(`  - Primary: ${program.attachments_primary?.length || 0}개`)
  console.log(`  - Extra: ${program.attachments_extra?.length || 0}개`)

  // 2. 템플릿 파싱 실행
  console.log('\n--- 템플릿 파싱 시작 ---\n')

  const result = await parseAttachmentTemplate(DIPS_PROGRAM_ID, { forceRefresh: true })

  if (!result.success) {
    console.error('❌ 파싱 실패:', result.error)
    return
  }

  console.log('✅ 파싱 성공!')
  console.log(`   템플릿 ID: ${result.templateId}`)
  console.log(`   섹션 수: ${result.template?.sections?.length}`)

  // 3. 저장된 템플릿 확인
  console.log('\n--- 저장된 템플릿 확인 ---\n')

  const { data: savedTemplate } = await supabase
    .from('business_plan_templates')
    .select('*')
    .eq('id', result.templateId)
    .single()

  if (savedTemplate) {
    console.log(`템플릿명: ${savedTemplate.template_name || savedTemplate.name}`)
    console.log(`소스 파일: ${savedTemplate.source_file}`)
    console.log(`파싱 상태: ${savedTemplate.parsing_status}`)
    console.log(`섹션 수: ${savedTemplate.sections?.length}`)

    console.log('\n섹션 목록:')
    for (const section of savedTemplate.sections || []) {
      console.log(`  ${section.section_id}. ${section.title}`)
      console.log(`     가이드: ${section.guidelines?.substring(0, 50)}...`)
      if (section.subsections?.length) {
        for (const sub of section.subsections) {
          console.log(`     - ${sub.title}`)
        }
      }
    }

    if (savedTemplate.writing_guidelines?.length) {
      console.log('\n작성 가이드라인:')
      for (const guideline of savedTemplate.writing_guidelines.slice(0, 3)) {
        console.log(`  - ${guideline.substring(0, 60)}...`)
      }
    }

    if (savedTemplate.evaluation_criteria?.length) {
      console.log('\n평가 기준:')
      for (const criterion of savedTemplate.evaluation_criteria) {
        console.log(`  - ${criterion.category}: ${criterion.weight}%`)
      }
    }
  }

  console.log('\n=== 테스트 완료 ===')
}

main().catch(console.error)
