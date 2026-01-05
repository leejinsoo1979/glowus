import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDevUser } from '@/lib/dev-user'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const { searchParams } = new URL(request.url)
    const contractId = searchParams.get('contract_id')
    const publicationType = searchParams.get('publication_type')

    let query = supabase
      .from('project_publications')
      .select(`
        *,
        contract:program_contracts(id, contract_name, program:government_programs(id, title))
      `)
      .eq('user_id', devUser.id)

    if (contractId) {
      query = query.eq('contract_id', contractId)
    }

    if (publicationType) {
      query = query.eq('publication_type', publicationType)
    }

    const { data: publications, error } = await query.order('publication_date', { ascending: false })

    if (error) throw error

    return NextResponse.json({ publications })
  } catch (error: any) {
    console.error('Publications fetch error:', error)
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
      publication_type,
      title,
      authors,
      journal_name,
      conference_name,
      publisher,
      publication_date,
      volume,
      issue,
      pages,
      doi,
      url,
      is_sci,
      is_scopus,
      impact_factor
    } = body

    if (!publication_type || !title) {
      return NextResponse.json({ error: 'publication_type, title are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('project_publications')
      .insert({
        user_id: devUser.id,
        contract_id,
        publication_type,
        title,
        authors: authors || [],
        journal_name,
        conference_name,
        publisher,
        publication_date,
        volume,
        issue,
        pages,
        doi,
        url,
        is_sci: is_sci || false,
        is_scopus: is_scopus || false,
        impact_factor
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ publication: data })
  } catch (error: any) {
    console.error('Publication create error:', error)
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
      .from('project_publications')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', devUser.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ publication: data })
  } catch (error: any) {
    console.error('Publication update error:', error)
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
      .from('project_publications')
      .delete()
      .eq('id', id)
      .eq('user_id', devUser.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Publication delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
