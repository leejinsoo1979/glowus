import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDevUser } from '@/lib/dev-user'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const { searchParams } = new URL(request.url)
    const contractId = searchParams.get('contract_id')
    const patentType = searchParams.get('patent_type')

    let query = supabase
      .from('project_patents')
      .select(`
        *,
        contract:program_contracts(id, contract_name, program:government_programs(id, title))
      `)
      .eq('user_id', devUser.id)

    if (contractId) {
      query = query.eq('contract_id', contractId)
    }

    if (patentType) {
      query = query.eq('patent_type', patentType)
    }

    const { data: patents, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ patents })
  } catch (error: any) {
    console.error('Patents fetch error:', error)
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
      patent_type,
      title,
      description,
      application_number,
      application_date,
      inventors,
      applicant
    } = body

    if (!patent_type || !title) {
      return NextResponse.json({ error: 'patent_type, title are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('project_patents')
      .insert({
        user_id: devUser.id,
        contract_id,
        patent_type,
        title,
        description,
        application_number,
        application_date,
        inventors: inventors || [],
        applicant,
        status: application_number ? 'applied' : 'pending'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ patent: data })
  } catch (error: any) {
    console.error('Patent create error:', error)
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
      .from('project_patents')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', devUser.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ patent: data })
  } catch (error: any) {
    console.error('Patent update error:', error)
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
      .from('project_patents')
      .delete()
      .eq('id', id)
      .eq('user_id', devUser.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Patent delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
