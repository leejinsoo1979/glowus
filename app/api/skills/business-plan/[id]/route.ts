// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
const getGeminiModel = () => genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

export const dynamic = 'force-dynamic'

/**
 * GET: 특정 사업계획서 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const { data: plan, error } = await adminSupabase
      .from('business_plans')
      .select('*, government_programs(id, title, organization, category)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !plan) {
      return NextResponse.json(
        { error: '사업계획서를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      business_plan: plan
    })

  } catch (error: any) {
    console.error('[BusinessPlan GET] Error:', error)
    return NextResponse.json(
      { error: error.message || '조회 실패' },
      { status: 500 }
    )
  }
}

/**
 * PUT: 사업계획서 업데이트
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const body = await request.json()
    const { section_key, content, title, status } = body

    // 기존 사업계획서 조회
    const { data: existingPlan, error: fetchError } = await adminSupabase
      .from('business_plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingPlan) {
      return NextResponse.json(
        { error: '사업계획서를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const updateData: any = { updated_at: new Date().toISOString() }

    // 섹션 업데이트
    if (section_key && content !== undefined) {
      const sections = existingPlan.sections || {}
      sections[section_key] = {
        ...sections[section_key],
        content,
        edited: true,
        edited_at: new Date().toISOString()
      }
      updateData.sections = sections
    }

    // 제목 업데이트
    if (title) {
      updateData.title = title
    }

    // 상태 업데이트
    if (status) {
      updateData.status = status
      if (status === 'submitted') {
        updateData.submitted_at = new Date().toISOString()
      }
    }

    const { data: updatedPlan, error: updateError } = await adminSupabase
      .from('business_plans')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      business_plan: updatedPlan,
      message: '사업계획서가 업데이트되었습니다.'
    })

  } catch (error: any) {
    console.error('[BusinessPlan PUT] Error:', error)
    return NextResponse.json(
      { error: error.message || '업데이트 실패' },
      { status: 500 }
    )
  }
}

/**
 * POST: 특정 섹션 재생성
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const body = await request.json()
    const { section_key, additional_instructions } = body

    if (!section_key) {
      return NextResponse.json(
        { error: 'section_key가 필요합니다.' },
        { status: 400 }
      )
    }

    // 기존 사업계획서 조회
    const { data: plan, error: planError } = await adminSupabase
      .from('business_plans')
      .select('*, government_programs(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: '사업계획서를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 프로필 조회
    const { data: profile } = await adminSupabase
      .from('company_support_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // 기존 섹션 정보
    const existingSection = plan.sections?.[section_key]

    // Gemini로 재생성
    const model = getGeminiModel()

    const systemPrompt = `당신은 정부지원사업 사업계획서 작성 전문가입니다.
기존 작성된 내용을 개선하거나, 추가 지시사항을 반영해 수정해주세요.

## 작성 원칙
1. 구체성: 정량적 수치와 사례 제시
2. 일관성: 섹션 간 논리적 연결
3. 차별화: 경쟁사 대비 명확한 차별점
4. 실현가능성: 현실적 목표 설정`

    let userPrompt = `
섹션: ${existingSection?.title || section_key}

회사 정보:
- 업종: ${profile?.industry_category || '미설정'}
- 사업자 유형: ${profile?.entity_type || '미설정'}
- 지역: ${profile?.region || '미설정'}

지원사업: ${plan.government_programs?.title || ''}

기존 작성 내용:
${existingSection?.content || '(없음)'}

`

    if (additional_instructions) {
      userPrompt += `\n추가 요청사항:\n${additional_instructions}\n`
    }

    userPrompt += `\n위 내용을 바탕으로 ${existingSection?.title || section_key} 섹션을 ${existingSection?.content ? '개선' : '작성'}해주세요.`

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`
    const response = await model.generateContent(fullPrompt)
    const newContent = response.response.text() || ''

    // 섹션 업데이트
    const sections = plan.sections || {}
    sections[section_key] = {
      ...existingSection,
      content: newContent,
      regenerated_at: new Date().toISOString(),
      edited: false
    }

    await adminSupabase
      .from('business_plans')
      .update({
        sections,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      section: sections[section_key],
      message: '섹션이 재생성되었습니다.'
    })

  } catch (error: any) {
    console.error('[BusinessPlan Regenerate] Error:', error)
    return NextResponse.json(
      { error: error.message || '재생성 실패' },
      { status: 500 }
    )
  }
}

/**
 * DELETE: 사업계획서 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const { error } = await adminSupabase
      .from('business_plans')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: '사업계획서가 삭제되었습니다.'
    })

  } catch (error: any) {
    console.error('[BusinessPlan DELETE] Error:', error)
    return NextResponse.json(
      { error: error.message || '삭제 실패' },
      { status: 500 }
    )
  }
}
