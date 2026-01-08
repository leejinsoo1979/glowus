/**
 * 사업계획서 HWP 파일 생성
 * - DB에서 사업계획서 조회
 * - 회사 정보와 섹션 내용을 HWP 템플릿 플레이스홀더에 매핑
 * - hwp-filler.jar로 HWP 파일 생성
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// HWP Filler 경로
const HWP_FILLER_JAR = path.join(__dirname, '../lib/bin/hwp-filler.jar')
const HWP_TEMPLATE = path.join(__dirname, '../templates/startup_package_template.hwp')
const JAVA_PATH = '/opt/homebrew/opt/openjdk/bin/java'

interface CompanyProfile {
  company_name?: string
  ceo_name?: string
  ceo_birth_date?: string
  phone?: string
  email?: string
  address?: string
  region?: string
  city?: string
  business_registration_date?: string
  business_type?: string
  industry_category?: string
  business_description?: string
  main_products?: string
  core_technologies?: string
  employee_count?: number
  annual_revenue?: number
  tech_certifications?: string[]
}

interface BusinessPlanSection {
  section_id: string
  title: string
  content?: string
  status?: string
}

interface BusinessPlan {
  id: string
  title: string
  sections: BusinessPlanSection[]
  company_id: string
}

/**
 * HWP 템플릿 플레이스홀더 매핑 생성
 */
function createPlaceholderMapping(
  company: CompanyProfile,
  plan: BusinessPlan
): Record<string, string> {
  const mapping: Record<string, string> = {}

  // 1. 기본 회사 정보
  if (company.main_products || company.business_description) {
    mapping['OO기술이 적용된 OO기능의 OO제품·서비스 등'] =
      company.main_products || company.business_description || ''
  }

  if (company.ceo_name) {
    mapping['OOO'] = company.ceo_name
  }

  if (company.ceo_birth_date) {
    // YYYY-MM-DD → YYYY.MM.DD 형식 변환
    const date = new Date(company.ceo_birth_date)
    mapping['0000.00.00'] = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  }

  if (company.phone) {
    mapping['000-0000-0000'] = company.phone
  }

  if (company.company_name) {
    mapping['OOOOO'] = company.company_name
  }

  if (company.business_registration_date) {
    const date = new Date(company.business_registration_date)
    mapping['0000년 00월 00일'] = `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, '0')}월 ${String(date.getDate()).padStart(2, '0')}일`
  }

  if (company.region && company.city) {
    mapping['OO도 OO시·군'] = `${company.region} ${company.city}`
  }

  // 2. 직원 수
  if (company.employee_count) {
    // 현재 재직 인원
    mapping['현재 재직 인원(대표자 제외) | 00'] =
      `현재 재직 인원(대표자 제외) | ${company.employee_count}`
  }

  // 3. 섹션별 내용을 플레이스홀더에 매핑
  // 템플릿의 "◦ " 마커를 AI 생성 내용으로 교체
  const sections = plan.sections || []

  for (const section of sections) {
    if (section.content && section.content.length > 50) {
      // 섹션 ID별 플레이스홀더 매핑
      const sectionPlaceholders: Record<string, string[]> = {
        '4': ['◦ \n\n   -'], // 창업아이템 개요
        '5': ['◦ \n\n   - '], // 기술성
        '6': ['◦ \n\n   -'], // 시장성
        '7': ['◦ \n\n   -'], // 사업성
        '8': ['◦ \n\n   -'], // 팀 역량
      }

      const placeholders = sectionPlaceholders[section.section_id]
      if (placeholders) {
        // 내용의 첫 500자만 사용 (문단 길이 제한)
        const contentPreview = section.content.substring(0, 500).replace(/\n/g, ' ')
        for (const placeholder of placeholders) {
          mapping[placeholder] = `◦ ${contentPreview}`
        }
      }
    }
  }

  return mapping
}

/**
 * 섹션 매핑 생성 (fill-sections용)
 */
function createSectionMapping(plan: BusinessPlan): Array<{header: string, content: string}> {
  const sections = plan.sections || []
  const mapping: Array<{header: string, content: string}> = []

  // 섹션 ID → HWP 헤더 매핑
  const sectionHeaders: Record<string, string> = {
    '8': '1-1.',   // 대표자 현황 및 보유역량
    '9': '1-2.',   // 기업 현황 및 팀 보유역량
    '4': '2-1.',   // 창업아이템의 개발 동기 및 목적
    '5': '2-2.',   // 창업아이템 차별성 (기술성)
    '7': '2-3.',   // 비즈니스 모델 (사업성)
    '10': '2-4.',  // 개선과제 및 기술 고도화계획
    '6': '3-1.',   // 시장 진출 현황 및 계획 (시장성)
  }

  for (const section of sections) {
    const header = sectionHeaders[section.section_id]
    if (header && section.content && section.content.length > 50) {
      mapping.push({
        header,
        content: section.content
      })
    }
  }

  return mapping
}

/**
 * HWP 파일 생성
 */
async function generateHWP(planId: string, outputPath?: string): Promise<string> {
  console.log('=== HWP 사업계획서 생성 ===\n')

  // 1. 사업계획서 조회
  console.log('📄 사업계획서 조회 중...')
  const { data: plan, error: planError } = await supabase
    .from('business_plans')
    .select('*')
    .eq('id', planId)
    .single()

  if (planError || !plan) {
    throw new Error(`사업계획서 조회 실패: ${planError?.message}`)
  }

  console.log(`   제목: ${plan.title}`)

  // 2. 회사 정보 조회 (중복 시 최신 데이터 사용)
  console.log('🏢 회사 정보 조회 중...')
  const { data: companies, error: companyError } = await supabase
    .from('company_support_profiles')
    .select('*')
    .eq('company_id', plan.company_id)
    .order('updated_at', { ascending: false })
    .limit(1)

  const company = companies?.[0]

  if (companyError) {
    console.warn(`   회사 정보 조회 경고: ${companyError.message}`)
  }

  const companyName = company?.company_name || company?.main_products || '회사명'
  console.log(`   회사: ${companyName}`)

  // 3. 플레이스홀더 매핑 생성
  console.log('\n🔄 HWP 매핑 생성 중...')
  const mapping = createPlaceholderMapping(company || {}, plan)

  console.log('   매핑 항목:')
  for (const [key, value] of Object.entries(mapping)) {
    const displayKey = key.length > 30 ? key.substring(0, 30) + '...' : key
    const displayValue = value.length > 30 ? value.substring(0, 30) + '...' : value
    console.log(`   - "${displayKey}" → "${displayValue}"`)
  }

  // 4. 임시 JSON 파일 생성
  const tempJsonPath = path.join('/tmp', `hwp_data_${planId}.json`)
  fs.writeFileSync(tempJsonPath, JSON.stringify(mapping, null, 2))
  console.log(`\n📝 매핑 파일: ${tempJsonPath}`)

  // 5. 출력 파일 경로
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
  const safeCompanyName = companyName.replace(/[^a-zA-Z0-9가-힣]/g, '_')
  const defaultOutputPath = path.join('/tmp', `사업계획서_${safeCompanyName}_${timestamp}.hwp`)
  const finalOutputPath = outputPath || defaultOutputPath

  // 6. 섹션 매핑 생성
  console.log('\n📝 섹션 내용 매핑 중...')
  const sectionMapping = createSectionMapping(plan)
  console.log(`   섹션 수: ${sectionMapping.length}개`)

  const tempSectionsPath = path.join('/tmp', `hwp_sections_${planId}.json`)
  fs.writeFileSync(tempSectionsPath, JSON.stringify(sectionMapping, null, 2))

  // 7. hwp-filler.jar 실행 (2단계)
  console.log('\n🔧 HWP 파일 생성 중...')
  console.log(`   템플릿: ${HWP_TEMPLATE}`)
  console.log(`   출력: ${finalOutputPath}`)

  // Step 1: 기본 정보 채우기
  const tempStep1Path = path.join('/tmp', `hwp_step1_${planId}.hwp`)
  try {
    console.log('\n   [1/2] 기본 정보 채우기...')
    const cmd1 = `"${JAVA_PATH}" -jar "${HWP_FILLER_JAR}" fill "${HWP_TEMPLATE}" "${tempStep1Path}" "${tempJsonPath}"`
    execSync(cmd1, { encoding: 'utf-8' })
  } catch (error: any) {
    throw new Error(`기본 정보 채우기 실패: ${error.message}`)
  }

  // Step 2: 섹션 내용 채우기
  try {
    console.log('   [2/2] 섹션 내용 채우기...')
    const cmd2 = `"${JAVA_PATH}" -jar "${HWP_FILLER_JAR}" fill-sections "${tempStep1Path}" "${finalOutputPath}" "${tempSectionsPath}"`
    const output = execSync(cmd2, { encoding: 'utf-8' })
    console.log('\n   ' + output.split('\n').filter(l => l.includes('section') || l.includes('Total') || l.includes('Successfully')).join('\n   '))
  } catch (error: any) {
    throw new Error(`섹션 채우기 실패: ${error.message}`)
  }

  // 임시 파일 정리
  try { fs.unlinkSync(tempStep1Path) } catch {}

  // 7. 결과 확인
  if (fs.existsSync(finalOutputPath)) {
    const stats = fs.statSync(finalOutputPath)
    console.log(`\n✅ HWP 파일 생성 완료!`)
    console.log(`   경로: ${finalOutputPath}`)
    console.log(`   크기: ${(stats.size / 1024).toFixed(1)} KB`)
    return finalOutputPath
  } else {
    throw new Error('HWP 파일이 생성되지 않았습니다.')
  }
}

/**
 * 메인 실행
 */
async function main() {
  const planId = process.argv[2]
  const outputPath = process.argv[3]

  if (!planId) {
    console.log('사용법: npx tsx scripts/generate_hwp_from_plan.ts <plan_id> [output_path]')
    console.log('')
    console.log('예시:')
    console.log('  npx tsx scripts/generate_hwp_from_plan.ts cb2b2230-3495-4616-b330-f5a3a37e4b2a')
    console.log('  npx tsx scripts/generate_hwp_from_plan.ts cb2b2230-3495-4616-b330-f5a3a37e4b2a ./output.hwp')
    process.exit(1)
  }

  try {
    const result = await generateHWP(planId, outputPath)
    console.log(`\n🎉 완료: ${result}`)
  } catch (error: any) {
    console.error(`\n❌ 오류: ${error.message}`)
    process.exit(1)
  }
}

main()
