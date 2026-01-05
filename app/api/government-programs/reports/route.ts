import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDevUser } from '@/lib/dev-user'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const { searchParams } = new URL(request.url)
    const contractId = searchParams.get('contract_id')
    const reportType = searchParams.get('report_type')

    let query = supabase
      .from('project_reports')
      .select(`
        *,
        contract:program_contracts(id, contract_name, program:government_programs(id, title))
      `)
      .eq('user_id', devUser.id)

    if (contractId) {
      query = query.eq('contract_id', contractId)
    }

    if (reportType) {
      query = query.eq('report_type', reportType)
    }

    const { data: reports, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ reports })
  } catch (error: any) {
    console.error('Reports fetch error:', error)
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
      report_type,
      report_period_start,
      report_period_end,
      title,
      content,
      attachments
    } = body

    if (!contract_id || !report_type || !title) {
      return NextResponse.json({ error: 'contract_id, report_type, title are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('project_reports')
      .insert({
        user_id: devUser.id,
        contract_id,
        report_type,
        report_period_start,
        report_period_end,
        title,
        content: content || {},
        attachments: attachments || [],
        status: 'draft'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ report: data })
  } catch (error: any) {
    console.error('Report create error:', error)
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

    // 검토 처리
    if (updates.status === 'approved' && !updates.reviewed_at) {
      updates.reviewed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('project_reports')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', devUser.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ report: data })
  } catch (error: any) {
    console.error('Report update error:', error)
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

    // draft 상태만 삭제 가능
    const { data: report } = await supabase
      .from('project_reports')
      .select('status')
      .eq('id', id)
      .single()

    if (report?.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft reports can be deleted' }, { status: 400 })
    }

    const { error } = await supabase
      .from('project_reports')
      .delete()
      .eq('id', id)
      .eq('user_id', devUser.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Report delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
