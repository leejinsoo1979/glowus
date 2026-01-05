// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, getAuthUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET: 미완료 질문 목록 조회
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'

    let query = supabase
      .from('plan_questions')
      .select(`
        *,
        section:business_plan_sections(id, section_title)
      `)
      .eq('plan_id', id)
      .order('priority')
      .order('created_at')

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: questions, error } = await query

    if (error) throw error

    return NextResponse.json({ questions })
  } catch (error: any) {
    console.error('[Questions] GET Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch questions' },
      { status: 500 }
    )
  }
}

/**
 * POST: 질문에 답변
 */
export async function POST(
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
    const { question_id, answer } = body

    if (!question_id || answer === undefined) {
      return NextResponse.json(
        { error: 'question_id and answer are required' },
        { status: 400 }
      )
    }

    // 질문 조회
    const { data: question } = await supabase
      .from('plan_questions')
      .select('*, section:business_plan_sections(*)')
      .eq('id', question_id)
      .eq('plan_id', id)
      .single()

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // 질문 상태 업데이트
    const { error: updateError } = await supabase
      .from('plan_questions')
      .update({
        answer,
        answered_at: new Date().toISOString(),
        answered_by: user.id,
        status: 'answered'
      })
      .eq('id', question_id)

    if (updateError) throw updateError

    // 섹션 내용에서 플레이스홀더 교체
    if (question.section && question.placeholder_id) {
      const section = question.section
      const placeholderPattern = new RegExp(
        `\\{\\{미확정:\\s*${escapeRegex(question.question_text.replace(/^\[.*?\]\s*/, ''))}\\}\\}`,
        'g'
      )

      const updatedContent = section.content.replace(placeholderPattern, answer)

      // 남은 플레이스홀더 확인
      const remainingPlaceholders = (updatedContent.match(/\{\{미확정:[^}]+\}\}/g) || []).map(
        (text: string, index: number) => ({
          placeholder_id: `ph_${Date.now()}_${index}`,
          text,
          question: text.match(/\{\{미확정:\s*([^}]+)\}\}/)?.[1] || ''
        })
      )

      await supabase
        .from('business_plan_sections')
        .update({
          content: updatedContent,
          char_count: updatedContent.length,
          has_placeholders: remainingPlaceholders.length > 0,
          placeholders: remainingPlaceholders
        })
        .eq('id', section.id)
    }

    return NextResponse.json({
      success: true,
      question: {
        ...question,
        answer,
        status: 'answered'
      }
    })
  } catch (error: any) {
    console.error('[Questions] POST Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to answer question' },
      { status: 500 }
    )
  }
}

/**
 * PUT: 질문 건너뛰기
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
    const { question_id, action } = body

    if (!question_id) {
      return NextResponse.json({ error: 'question_id is required' }, { status: 400 })
    }

    const newStatus = action === 'skip' ? 'skipped' : 'pending'

    const { data: question, error } = await supabase
      .from('plan_questions')
      .update({ status: newStatus })
      .eq('id', question_id)
      .eq('plan_id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ question })
  } catch (error: any) {
    console.error('[Questions] PUT Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update question' },
      { status: 500 }
    )
  }
}

function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
