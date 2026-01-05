// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface ProgramRequirements {
  eligibility_criteria: {
    business_type?: string[]
    business_age?: { min?: number; max?: number }
    employee_count?: { min?: number; max?: number }
    revenue_cap?: number
    region?: string[]
    industry?: string[]
    exclusions?: string[]
    special_conditions?: string[]
  }
  evaluation_criteria: Array<{
    category: string
    weight: number
    items: string[]
    tips?: string
  }>
  required_documents: Array<{
    name: string
    required: boolean
    format?: string
    max_pages?: number
    notes?: string
  }>
  plan_format_requirements: {
    max_pages?: number
    font_size?: number
    line_spacing?: number
    required_sections?: string[]
    template_url?: string
    format?: string
  }
  writing_tips: string[]
  cautions: string[]
}

const REQUIREMENTS_PARSER_PROMPT = `당신은 정부지원사업 공고문 분석 전문가입니다.
주어진 공고 내용을 분석하여 다음 정보를 JSON 형식으로 추출해주세요:

1. eligibility_criteria (지원 자격):
   - business_type: 사업자 유형 (법인, 개인사업자, 예비창업자 등)
   - business_age: 업력 요건 {min, max} 년
   - employee_count: 직원수 요건 {min, max}
   - revenue_cap: 매출 상한 (원)
   - region: 지역 요건
   - industry: 업종 요건
   - exclusions: 지원 제외 대상
   - special_conditions: 특수 조건 (청년창업, 여성기업 등)

2. evaluation_criteria (평가 기준):
   - category: 평가 분야 (기술성, 사업성, 성장성 등)
   - weight: 배점 (%)
   - items: 세부 평가 항목
   - tips: 고득점 팁

3. required_documents (제출 서류):
   - name: 서류명
   - required: 필수 여부
   - format: 파일 형식
   - max_pages: 최대 페이지
   - notes: 비고

4. plan_format_requirements (사업계획서 형식 요건):
   - max_pages: 최대 페이지
   - font_size: 글자 크기
   - required_sections: 필수 섹션
   - format: 파일 형식

5. writing_tips: 작성 팁 리스트
6. cautions: 주의사항 리스트

공고 내용에서 명시적으로 확인되지 않는 항목은 null로 표시하세요.
반드시 유효한 JSON만 출력하세요.`

/**
 * GET: 프로그램 요구사항 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminSupabase = createAdminClient()
    const programId = params.id

    // 기존 파싱된 요구사항 조회
    const { data: requirements, error } = await adminSupabase
      .from('program_requirements')
      .select('*')
      .eq('program_id', programId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    if (!requirements) {
      return NextResponse.json({
        success: true,
        parsed: false,
        message: '아직 파싱되지 않은 프로그램입니다. POST 요청으로 파싱하세요.'
      })
    }

    return NextResponse.json({
      success: true,
      parsed: true,
      requirements
    })

  } catch (error: any) {
    console.error('[Program Requirements GET] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST: 프로그램 요구사항 파싱 (AI)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    const programId = params.id
    const body = await request.json().catch(() => ({}))
    const forceReparse = body.force === true

    // 프로그램 정보 조회
    const { data: program, error: programError } = await adminSupabase
      .from('government_programs')
      .select('*')
      .eq('id', programId)
      .single()

    if (programError || !program) {
      return NextResponse.json({ error: '프로그램을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 기존 요구사항 확인
    const { data: existing } = await adminSupabase
      .from('program_requirements')
      .select('id, parsed_at')
      .eq('program_id', programId)
      .single()

    if (existing && !forceReparse) {
      return NextResponse.json({
        success: true,
        message: '이미 파싱된 프로그램입니다. force: true로 재파싱 가능합니다.',
        requirements_id: existing.id
      })
    }

    // 프로그램 내용 구성
    const programContent = `
[공고명] ${program.title}

[주관기관] ${program.organization || '미상'}

[지원분야] ${program.category || ''}

[지원대상] ${program.target_audience || ''}

[지원금액] ${program.support_amount || ''}

[신청기간] ${program.apply_start_date} ~ ${program.apply_end_date}

[공고내용]
${program.content || program.description || '내용 없음'}

[상세링크] ${program.detail_url || ''}
`.trim()

    // OpenAI로 파싱
    const openai = new OpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: REQUIREMENTS_PARSER_PROMPT },
        { role: 'user', content: programContent }
      ]
    })

    const parsedContent = response.choices[0]?.message?.content || '{}'
    let requirements: ProgramRequirements

    try {
      requirements = JSON.parse(parsedContent)
    } catch (e) {
      console.error('JSON 파싱 실패:', parsedContent)
      return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 })
    }

    // 데이터베이스에 저장
    const upsertData = {
      program_id: programId,
      eligibility_criteria: requirements.eligibility_criteria || {},
      evaluation_criteria: requirements.evaluation_criteria || [],
      required_documents: requirements.required_documents || [],
      plan_format_requirements: requirements.plan_format_requirements || {},
      writing_tips: requirements.writing_tips || [],
      cautions: requirements.cautions || [],
      parsed_at: new Date().toISOString(),
      parsed_by: 'gpt-4o',
      confidence_score: 0.8,
      source_urls: [program.detail_url].filter(Boolean)
    }

    let result
    if (existing) {
      const { data, error } = await adminSupabase
        .from('program_requirements')
        .update(upsertData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      result = data
    } else {
      const { data, error } = await adminSupabase
        .from('program_requirements')
        .insert(upsertData)
        .select()
        .single()

      if (error) throw error
      result = data
    }

    return NextResponse.json({
      success: true,
      message: '프로그램 요구사항이 파싱되었습니다.',
      requirements: result,
      tokens_used: {
        prompt: response.usage?.prompt_tokens,
        completion: response.usage?.completion_tokens
      }
    })

  } catch (error: any) {
    console.error('[Program Requirements POST] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
