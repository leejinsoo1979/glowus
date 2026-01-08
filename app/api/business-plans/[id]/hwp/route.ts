// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const HWP_FILLER_JAR = path.join(process.cwd(), 'lib/bin/hwp-filler.jar')
const HWP_TEMPLATE = path.join(process.cwd(), 'templates/startup_package_template.hwp')
const JAVA_PATH = '/opt/homebrew/opt/openjdk/bin/java'

/**
 * GET: 사업계획서 HWP 파일 생성 및 다운로드
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 사업계획서 조회
    const { data: plan, error: planError } = await adminSupabase
      .from('business_plans')
      .select('*, program:government_programs(title, organization)')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: '사업계획서를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 회사 정보 조회
    const { data: companies } = await adminSupabase
      .from('company_support_profiles')
      .select('*')
      .eq('company_id', plan.company_id)
      .order('updated_at', { ascending: false })
      .limit(1)

    const company = companies?.[0] || {}

    // 플레이스홀더 매핑 생성
    const mapping: Record<string, string> = {}

    if (company.main_products || company.business_description) {
      mapping['OO기술이 적용된 OO기능의 OO제품·서비스 등'] =
        company.main_products || company.business_description || ''
    }
    if (company.ceo_name) {
      mapping['OOO'] = company.ceo_name
    }
    if (company.ceo_birth_date) {
      const date = new Date(company.ceo_birth_date)
      mapping['0000.00.00'] = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
    }
    if (company.company_name) {
      mapping['OOOOO'] = company.company_name
    }
    if (company.region && company.city) {
      mapping['OO도 OO시·군'] = `${company.region} ${company.city}`
    }
    if (company.employee_count) {
      mapping['현재 재직 인원(대표자 제외) | 00'] =
        `현재 재직 인원(대표자 제외) | ${company.employee_count}`
    }

    // 섹션 매핑 생성 - 두 가지 형식 지원
    // 1. Skills API 형식: { executive_summary: { content: '...' }, ... }
    // 2. Pipeline 형식: [{ section_id: '1', content: '...' }, ...]

    const skillsKeyToHeader: Record<string, string> = {
      'team_introduction': '1-1.',
      'company_overview': '1-2.',
      'problem_statement': '2-1.',
      'solution': '2-2.',
      'business_model': '2-3.',
      'expected_outcomes': '2-4.',
      'market_research': '3-1.',
      'executive_summary': '0.',
      'financial_plan': '4-1.',
      'fund_usage': '4-2.',
    }

    const pipelineIdToHeader: Record<string, string> = {
      '1': '0.',      // 신청현황
      '2': '0-1.',    // 신청 분야
      '3': '1-1.',    // 기업 일반현황
      '4': '2-1.',    // 창업아이템 개요
      '5': '2-2.',    // 기술성
      '6': '3-1.',    // 시장성
      '7': '2-3.',    // 사업성
      '8': '1-2.',    // 대표자 및 팀 역량
      '9': '4-1.',    // 사업비 계획
      '10': '2-4.',   // 추진일정
    }

    const sectionMapping: Array<{header: string, content: string}> = []
    const sections = plan.sections

    if (Array.isArray(sections)) {
      // Pipeline 형식 (배열)
      for (const section of sections) {
        const header = pipelineIdToHeader[section.section_id]
        if (header && section.content && section.content.length > 50) {
          sectionMapping.push({ header, content: section.content })
        }
      }
    } else if (sections && typeof sections === 'object') {
      // Skills API 형식 (객체)
      for (const [key, section] of Object.entries(sections)) {
        const header = skillsKeyToHeader[key]
        const sectionData = section as any
        if (header && sectionData?.content && sectionData.content.length > 50) {
          sectionMapping.push({ header, content: sectionData.content })
        }
      }
    }

    // 임시 파일 생성
    const tempJsonPath = path.join('/tmp', `hwp_data_${planId}.json`)
    const tempSectionsPath = path.join('/tmp', `hwp_sections_${planId}.json`)
    fs.writeFileSync(tempJsonPath, JSON.stringify(mapping, null, 2))
    fs.writeFileSync(tempSectionsPath, JSON.stringify(sectionMapping, null, 2))

    // 출력 파일 경로
    const companyName = (company.company_name || '사업계획서').replace(/[^a-zA-Z0-9가-힣]/g, '_')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
    const outputPath = path.join('/tmp', `사업계획서_${companyName}_${timestamp}.hwp`)

    // HWP 생성 (기본 정보만 채우기 - fill 명령만 지원됨)
    try {
      // Step 1: 기본 정보 채우기 (fill 명령)
      const cmd1 = `"${JAVA_PATH}" -jar "${HWP_FILLER_JAR}" fill "${HWP_TEMPLATE}" "${outputPath}" "${tempJsonPath}"`
      const result = execSync(cmd1, { encoding: 'utf-8' })
      console.log('[HWP] Fill result:', result)

      // 참고: 섹션 내용은 현재 JAR가 지원하지 않음
      // 추후 HWPX 또는 Apache POI 기반 솔루션으로 개선 필요
      if (sectionMapping.length > 0) {
        console.log('[HWP] Sections prepared but not inserted (JAR limitation):', sectionMapping.length)
      }
    } catch (cmdError: any) {
      console.error('[HWP] Generation failed:', cmdError.message)
      console.error('[HWP] Command error details:', cmdError.stderr || cmdError.stdout)
      return NextResponse.json({ error: 'HWP 생성 실패: ' + cmdError.message }, { status: 500 })
    }

    // 임시 파일 정리
    try { fs.unlinkSync(tempJsonPath) } catch {}
    try { fs.unlinkSync(tempSectionsPath) } catch {}

    // 파일 읽기 및 반환
    if (!fs.existsSync(outputPath)) {
      return NextResponse.json({ error: 'HWP 파일이 생성되지 않았습니다.' }, { status: 500 })
    }

    const fileBuffer = fs.readFileSync(outputPath)
    const fileName = `사업계획서_${companyName}.hwp`

    // 임시 파일 정리
    try { fs.unlinkSync(outputPath) } catch {}

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/x-hwp',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })

  } catch (error: any) {
    console.error('[HWP] Error:', error)
    return NextResponse.json({ error: error.message || 'HWP 생성 실패' }, { status: 500 })
  }
}
