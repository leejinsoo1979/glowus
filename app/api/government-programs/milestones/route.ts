import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDevUser } from '@/lib/dev-user'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const { searchParams } = new URL(request.url)
    const contractId = searchParams.get('contract_id')
    const status = searchParams.get('status')

    let query = supabase
      .from('project_milestones')
      .select(`
        *,
        contract:program_contracts(id, contract_name, program:government_programs(id, title))
      `)
      .eq('user_id', devUser.id)

    if (contractId) {
      query = query.eq('contract_id', contractId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: milestones, error } = await query.order('target_date', { ascending: true })

    if (error) throw error

    return NextResponse.json({ milestones })
  } catch (error: any) {
    console.error('Milestones fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const body = await request.json()

    const { contract_id, name, description, target_date, deliverables } = body

    if (!contract_id || !name || !target_date) {
      return NextResponse.json({ error: 'contract_id, name, target_date are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('project_milestones')
      .insert({
        user_id: devUser.id,
        contract_id,
        name,
        description,
        target_date,
        deliverables: deliverables || [],
        status: 'pending',
        progress: 0
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ milestone: data })
  } catch (error: any) {
    console.error('Milestone create error:', error)
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

    // 완료 처리
    if (updates.status === 'completed' && !updates.completed_date) {
      updates.completed_date = new Date().toISOString().split('T')[0]
      updates.progress = 100
    }

    const { data, error } = await supabase
      .from('project_milestones')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', devUser.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ milestone: data })
  } catch (error: any) {
    console.error('Milestone update error:', error)
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
      .from('project_milestones')
      .delete()
      .eq('id', id)
      .eq('user_id', devUser.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Milestone delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
