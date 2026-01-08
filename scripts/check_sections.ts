// 섹션 및 템플릿 확인 스크립트
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const planId = process.argv[2] || '2e9ca382-a214-4a97-bbc4-48f811d92f26'

async function checkSections() {
  console.log('=== 섹션 확인 ===\n')
  console.log('Plan ID:', planId)

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })

  // 1. Plan 조회
  console.log('\n1. Plan 조회...')
  const { data: plan, error: planError } = await supabase
    .from('business_plans')
    .select('id, title, template_id')
    .eq('id', planId)
    .single()

  if (planError) {
    console.error('   Plan 오류:', planError.message)
    return
  }
  console.log('   template_id:', plan?.template_id)

  // 2. Template 조회
  if (plan?.template_id) {
    console.log('\n2. Template 조회...')
    const { data: template, error: templateError } = await supabase
      .from('business_plan_templates')
      .select('id, name, sections, section_structure')
      .eq('id', plan.template_id)
      .single()

    if (templateError) {
      console.error('   Template 오류:', templateError.message)
    } else {
      console.log('   Template name:', template?.name)
      console.log('   sections 필드:', template?.sections ? `${(template.sections as any[]).length}개` : 'null')
      console.log('   section_structure 필드:', template?.section_structure ? `${(template.section_structure as any[]).length}개` : 'null')

      // 섹션 상세
      const sections = template?.sections || template?.section_structure || []
      if (Array.isArray(sections) && sections.length > 0) {
        console.log('\n   섹션 목록:')
        sections.forEach((s: any, i: number) => {
          console.log(`   ${i+1}. ${s.title || s.section_id} (order: ${s.order})`)
        })
      }
    }
  }

  // 3. business_plan_sections 조회
  console.log('\n3. business_plan_sections 조회...')
  const { data: planSections, error: sectionsError } = await supabase
    .from('business_plan_sections')
    .select('id, section_key, section_title, section_order, content')
    .eq('plan_id', planId)
    .order('section_order')

  if (sectionsError) {
    console.error('   Sections 오류:', sectionsError.message)
  } else {
    console.log(`   총 ${planSections?.length || 0}개 섹션`)
    planSections?.forEach((s, i) => {
      console.log(`   ${i+1}. [${s.section_key}] ${s.section_title} - ${s.content ? s.content.length + '자' : '내용 없음'}`)
    })
  }

  // 4. section_fact_mappings 조회
  console.log('\n4. section_fact_mappings 조회...')
  const sectionIds = planSections?.map(s => s.id) || []
  if (sectionIds.length > 0) {
    const { data: mappings } = await supabase
      .from('section_fact_mappings')
      .select('section_id, fact_id, relevance_score')
      .in('section_id', sectionIds)

    console.log(`   총 ${mappings?.length || 0}개 매핑`)
  } else {
    console.log('   섹션이 없어서 매핑도 없음')
  }

  console.log('\n=== 완료 ===')
}

checkSections().catch(console.error)
