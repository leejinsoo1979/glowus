import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDevUser } from '@/lib/dev-user'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const { searchParams } = new URL(request.url)
    const contractId = searchParams.get('contract_id')
    const role = searchParams.get('role')

    let query = supabase
      .from('project_researchers')
      .select(`
        *,
        contract:program_contracts(id, contract_name, program:government_programs(id, title))
      `)
      .eq('user_id', devUser.id)

    if (contractId) {
      query = query.eq('contract_id', contractId)
    }

    if (role) {
      query = query.eq('role', role)
    }

    const { data: researchers, error } = await query.order('role', { ascending: true })

    if (error) throw error

    return NextResponse.json({ researchers })
  } catch (error: any) {
    console.error('Researchers fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const body = await request.json()

    const {
      contract_id,
      name,
      role,
      affiliation,
      department,
      position,
      email,
      phone,
      participation_rate,
      start_date,
      end_date,
      expertise
    } = body

    if (!contract_id || !name || !role) {
      return NextResponse.json({ error: 'contract_id, name, role are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('project_researchers')
      .insert({
        user_id: devUser.id,
        contract_id,
        name,
        role,
        affiliation,
        department,
        position,
        email,
        phone,
        participation_rate,
        start_date,
        end_date,
        expertise: expertise || [],
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ researcher: data })
  } catch (error: any) {
    console.error('Researcher create error:', error)
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

    const { data, error } = await supabase
      .from('project_researchers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', devUser.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ researcher: data })
  } catch (error: any) {
    console.error('Researcher update error:', error)
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
      .from('project_researchers')
      .delete()
      .eq('id', id)
      .eq('user_id', devUser.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Researcher delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
