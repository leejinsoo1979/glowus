import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDevUser } from '@/lib/dev-user'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const { searchParams } = new URL(request.url)
    const programId = searchParams.get('program_id')
    const checklistId = searchParams.get('checklist_id')
    const documentType = searchParams.get('document_type')
    const status = searchParams.get('status')

    let query = supabase
      .from('required_documents')
      .select(`
        *,
        program:government_programs(id, title),
        checklist:application_checklists(id, name)
      `)
      .eq('user_id', devUser.id)

    if (programId) {
      query = query.eq('program_id', programId)
    }

    if (checklistId) {
      query = query.eq('checklist_id', checklistId)
    }

    if (documentType) {
      query = query.eq('document_type', documentType)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: documents, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    // 유효기간 만료 체크
    const now = new Date().toISOString().split('T')[0]
    const docsWithExpiry = documents?.map((doc: any) => ({
      ...doc,
      is_expired: doc.expiry_date && doc.expiry_date < now
    }))

    return NextResponse.json({ documents: docsWithExpiry })
  } catch (error: any) {
    console.error('Documents fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const body = await request.json()

    const {
      program_id,
      checklist_id,
      name,
      description,
      document_type,
      file_url,
      file_name,
      file_size,
      expiry_date,
      notes
    } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('required_documents')
      .insert({
        user_id: devUser.id,
        program_id,
        checklist_id,
        name,
        description,
        document_type,
        file_url,
        file_name,
        file_size,
        expiry_date,
        notes,
        status: file_url ? 'uploaded' : 'pending'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ document: data })
  } catch (error: any) {
    console.error('Document create error:', error)
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

    // 파일 업로드 시 상태 변경
    if (updates.file_url && !updates.status) {
      updates.status = 'uploaded'
    }

    const { data, error } = await supabase
      .from('required_documents')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', devUser.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ document: data })
  } catch (error: any) {
    console.error('Document update error:', error)
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
      .from('required_documents')
      .delete()
      .eq('id', id)
      .eq('user_id', devUser.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Document delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
