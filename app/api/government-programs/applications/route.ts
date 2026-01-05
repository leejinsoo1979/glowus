import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDevUser } from '@/lib/dev-user'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const programId = searchParams.get('program_id')

    let query = supabase
      .from('program_applications')
      .select(`
        *,
        program:government_programs(id, title, organization, category),
        business_plan:business_plans(id, title)
      `)
      .eq('user_id', devUser.id)

    if (status) {
      query = query.eq('status', status)
    }

    if (programId) {
      query = query.eq('program_id', programId)
    }

    const { data: applications, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ applications })
  } catch (error: any) {
    console.error('Applications fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const body = await request.json()

    const { program_id, business_plan_id, form_data, documents } = body

    if (!program_id) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('program_applications')
      .insert({
        user_id: devUser.id,
        program_id,
        business_plan_id,
        form_data: form_data || {},
        documents: documents || [],
        status: 'draft'
      })
      .select(`
        *,
        program:government_programs(id, title, organization)
      `)
      .single()

    if (error) throw error

    return NextResponse.json({ application: data })
  } catch (error: any) {
    console.error('Application create error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const body = await request.json()

    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // 제출 처리
    if (updates.status === 'submitted' && !updates.submitted_at) {
      updates.submitted_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('program_applications')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', devUser.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ application: data })
  } catch (error: any) {
    console.error('Application update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
