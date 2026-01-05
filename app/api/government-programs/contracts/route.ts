import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDevUser } from '@/lib/dev-user'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabase
      .from('program_contracts')
      .select(`
        *,
        application:program_applications(id, application_number, status),
        program:government_programs(id, title, organization, category)
      `)
      .eq('user_id', devUser.id)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: contracts, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ contracts })
  } catch (error: any) {
    console.error('Contracts fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const body = await request.json()

    const {
      application_id,
      program_id,
      contract_number,
      contract_name,
      start_date,
      end_date,
      total_amount,
      government_amount,
      self_amount,
      conditions,
      milestones
    } = body

    if (!application_id || !program_id || !contract_name) {
      return NextResponse.json({ error: 'application_id, program_id, contract_name are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('program_contracts')
      .insert({
        user_id: devUser.id,
        application_id,
        program_id,
        contract_number,
        contract_name,
        start_date,
        end_date,
        total_amount,
        government_amount,
        self_amount,
        conditions: conditions || [],
        milestones: milestones || [],
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ contract: data })
  } catch (error: any) {
    console.error('Contract create error:', error)
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

    // 서명 처리
    if (updates.status === 'signed' && !updates.signed_at) {
      updates.signed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('program_contracts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', devUser.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ contract: data })
  } catch (error: any) {
    console.error('Contract update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
