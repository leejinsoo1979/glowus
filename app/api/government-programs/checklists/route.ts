import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDevUser } from '@/lib/dev-user'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const { searchParams } = new URL(request.url)
    const programId = searchParams.get('program_id')
    const templateOnly = searchParams.get('templates') === 'true'

    // 템플릿만 조회
    if (templateOnly) {
      const { data: templates, error } = await supabase
        .from('application_checklist_templates')
        .select('*')
        .order('program_type', { ascending: true })

      if (error) throw error
      return NextResponse.json({ templates })
    }

    // 사용자 체크리스트 조회
    let query = supabase
      .from('application_checklists')
      .select(`
        *,
        program:government_programs(id, title, organization),
        template:application_checklist_templates(id, name, program_type)
      `)
      .eq('user_id', devUser.id)

    if (programId) {
      query = query.eq('program_id', programId)
    }

    const { data: checklists, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ checklists })
  } catch (error: any) {
    console.error('Checklists fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const body = await request.json()

    const { program_id, template_id, name, items } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    let checklistItems = items || []

    // 템플릿에서 항목 가져오기
    if (template_id && !items) {
      const { data: template } = await supabase
        .from('application_checklist_templates')
        .select('items')
        .eq('id', template_id)
        .single()

      if (template?.items) {
        checklistItems = (template.items as any[]).map((item: any) => ({
          ...item,
          completed: false,
          completed_at: null
        }))
      }
    }

    const { data, error } = await supabase
      .from('application_checklists')
      .insert({
        user_id: devUser.id,
        program_id,
        template_id,
        name,
        items: checklistItems,
        status: 'in_progress'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ checklist: data })
  } catch (error: any) {
    console.error('Checklist create error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const body = await request.json()

    const { id, items, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // 항목 업데이트 시 완료 상태 체크
    let finalUpdates: any = { ...updates, updated_at: new Date().toISOString() }

    if (items) {
      finalUpdates.items = items
      const allCompleted = items.every((item: any) => item.completed)
      finalUpdates.status = allCompleted ? 'completed' : 'in_progress'
    }

    const { data, error } = await supabase
      .from('application_checklists')
      .update(finalUpdates)
      .eq('id', id)
      .eq('user_id', devUser.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ checklist: data })
  } catch (error: any) {
    console.error('Checklist update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('application_checklists')
      .delete()
      .eq('id', id)
      .eq('user_id', devUser.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Checklist delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
