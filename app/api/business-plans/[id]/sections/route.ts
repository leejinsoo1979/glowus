// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, getAuthUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET: 섹션 목록 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: sections, error } = await supabase
      .from('business_plan_sections')
      .select(`
        *,
        mappings:section_fact_mappings(
          id,
          relevance_score,
          fact:company_fact_cards(id, category, fact_key, fact_value)
        )
      `)
      .eq('plan_id', id)
      .order('section_order')

    if (error) throw error

    return NextResponse.json({ sections })
  } catch (error: any) {
    console.error('[Sections] GET Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sections' },
      { status: 500 }
    )
  }
}

/**
 * PUT: 섹션 내용 수정
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { section_id, content } = body

    if (!section_id || content === undefined) {
      return NextResponse.json(
        { error: 'section_id and content are required' },
        { status: 400 }
      )
    }

    // 섹션 업데이트
    const { data: section, error } = await supabase
      .from('business_plan_sections')
      .update({
        content,
        char_count: content.length,
        manually_edited: true,
        last_edited_by: user.id,
        // 플레이스홀더 재검사
        has_placeholders: /\{\{미확정:[^}]+\}\}/.test(content),
        placeholders: extractPlaceholders(content)
      })
      .eq('id', section_id)
      .eq('plan_id', id)
      .select()
      .single()

    if (error) throw error

    // 전체 완성도 재계산
    await recalculateCompletion(supabase, id)

    return NextResponse.json({ section })
  } catch (error: any) {
    console.error('[Sections] PUT Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update section' },
      { status: 500 }
    )
  }
}

// 플레이스홀더 추출
function extractPlaceholders(content: string) {
  const placeholders: { placeholder_id: string; text: string; question: string }[] = []
  const regex = /\{\{미확정:\s*([^}]+)\}\}/g
  let match
  while ((match = regex.exec(content)) !== null) {
    placeholders.push({
      placeholder_id: `ph_${Date.now()}_${placeholders.length}`,
      text: match[0],
      question: match[1]
    })
  }
  return placeholders
}

// 완성도 재계산
async function recalculateCompletion(supabase: any, planId: string) {
  const { data: sections } = await supabase
    .from('business_plan_sections')
    .select('*')
    .eq('plan_id', planId)

  if (!sections || sections.length === 0) return

  let totalCompletion = 0
  const sectionCompletion: Record<string, number> = {}

  for (const section of sections) {
    let completion = 0
    if (section.content && section.char_count > 200) {
      completion = 50
      if (!section.has_placeholders) completion += 30
      if (section.validation_status === 'valid') completion += 20
    }
    sectionCompletion[section.section_key] = completion
    totalCompletion += completion
  }

  const avgCompletion = Math.round(totalCompletion / sections.length)

  await supabase
    .from('business_plans')
    .update({
      completion_percentage: avgCompletion,
      section_completion: sectionCompletion
    })
    .eq('id', planId)
}
