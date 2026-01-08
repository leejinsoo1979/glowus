/**
 * 파싱된 DIPS 템플릿으로 사업계획서 생성 테스트
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const DIPS_PROGRAM_ID = 'b5ba0abf-8fb6-47ee-ab0c-d450207be9c3'
const DIPS_TEMPLATE_ID = '5103ae9b-ab66-4f62-afb8-b3ca8b2241a2'

async function main() {
  console.log('=== DIPS 사업계획서 생성 테스트 ===\n')

  // 1. 테스트용 회사 정보 확인
  console.log('--- 1. 회사 정보 확인 ---\n')

  const { data: companies, error: companyError } = await supabase
    .from('company_support_profiles')
    .select('id, company_id, user_id, company_name, industry_category, employee_count, business_description, main_products, core_technologies, ceo_name')
    .limit(5)

  if (companyError) {
    console.error('회사 조회 실패:', companyError)
    return
  }

  console.log(`등록된 회사: ${companies?.length || 0}개`)
  for (const c of companies || []) {
    const name = c.company_name || c.main_products || '이름 없음'
    console.log(`  - ${name} (${c.industry_category || '업종 미지정'})`)
    console.log(`    사업: ${c.business_description || '-'}`)
  }

  if (!companies?.length) {
    console.log('\n테스트용 회사가 없습니다. 기존 회사 사용 시도...')

    // null이 아닌 회사가 없으면 첫 번째 회사 사용
    const { data: anyCompany } = await supabase
      .from('company_support_profiles')
      .select('id, company_name')
      .limit(1)
      .single()

    if (anyCompany) {
      (companies as any[])?.push({
        ...anyCompany,
        company_name: anyCompany.company_name || 'AI테크솔루션 (테스트)'
      })
    } else {
      console.error('회사 정보가 없습니다.')
      return
    }
  }

  const testCompany = companies![0]
  const companyName = testCompany.company_name || testCompany.main_products || 'AI테크솔루션'
  console.log(`\n테스트 회사: ${companyName} (ID: ${testCompany.id})`)

  // 2. DIPS 템플릿 확인
  console.log('\n--- 2. DIPS 템플릿 확인 ---\n')

  const { data: template, error: templateError } = await supabase
    .from('business_plan_templates')
    .select('*')
    .eq('id', DIPS_TEMPLATE_ID)
    .single()

  if (templateError || !template) {
    console.error('템플릿 조회 실패:', templateError)
    return
  }

  console.log(`템플릿명: ${template.template_name || template.name}`)
  console.log(`섹션 수: ${template.sections?.length}`)
  console.log('\n섹션 목록:')
  for (const section of template.sections || []) {
    console.log(`  ${section.section_id}. ${section.title}`)
  }

  // 3. 기존 사업계획서 확인
  console.log('\n--- 3. 기존 사업계획서 확인 ---\n')

  const { data: existingPlans, error: planError } = await supabase
    .from('business_plans')
    .select('id, title, status, program_id, created_at')
    .eq('program_id', DIPS_PROGRAM_ID)
    .limit(5)

  console.log(`DIPS 관련 사업계획서: ${existingPlans?.length || 0}개`)
  for (const p of existingPlans || []) {
    console.log(`  - ${p.title} (${p.status}) - ${new Date(p.created_at).toLocaleDateString()}`)
  }

  // 4. 새 사업계획서 생성 테스트
  console.log('\n--- 4. 새 사업계획서 생성 ---\n')

  // 초기 섹션 생성 (템플릿 기반)
  const initialSections = (template.sections || []).map((section: any) => ({
    section_id: section.section_id,
    title: section.title,
    content: '',
    status: 'pending',
    guidelines: section.guidelines,
    max_chars: section.max_chars,
    subsections: section.subsections
  }))

  const { data: newPlan, error: createPlanError } = await supabase
    .from('business_plans')
    .insert({
      title: `2026 DIPS 사업계획서 - ${companyName}`,
      user_id: testCompany.user_id,
      company_id: testCompany.company_id,
      program_id: DIPS_PROGRAM_ID,
      template_id: DIPS_TEMPLATE_ID,
      template_name: template.template_name || template.name,
      status: 'draft',
      sections: initialSections,
      pipeline_stage: 0,
      pipeline_status: 'draft',
      completion_percentage: 0,
      is_latest: true,
      project_name: 'DIPS 2026'
    })
    .select()
    .single()

  if (createPlanError) {
    console.error('사업계획서 생성 실패:', createPlanError)
    return
  }

  console.log(`✅ 사업계획서 생성 완료!`)
  console.log(`   ID: ${newPlan.id}`)
  console.log(`   제목: ${newPlan.title}`)
  console.log(`   상태: ${newPlan.status}`)
  console.log(`   섹션 수: ${newPlan.sections?.length}`)

  // 5. 섹션 내용 확인
  console.log('\n--- 5. 생성된 섹션 확인 ---\n')

  for (const section of newPlan.sections || []) {
    console.log(`[${section.section_id}] ${section.title}`)
    console.log(`    상태: ${section.status}`)
    console.log(`    가이드: ${section.guidelines?.substring(0, 50) || '없음'}...`)
    if (section.subsections?.length) {
      console.log(`    세부항목: ${section.subsections.map((s: any) => s.title).join(', ')}`)
    }
    console.log()
  }

  console.log('=== 테스트 완료 ===')
  console.log(`\n다음 단계: 각 섹션 AI 자동 생성 테스트`)
  console.log(`사업계획서 ID: ${newPlan.id}`)
}

main().catch(console.error)
