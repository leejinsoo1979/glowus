import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// KPI metric types
const KPI_TYPES = [
  'mrr', // Monthly Recurring Revenue
  'arr', // Annual Recurring Revenue
  'customers', // Customer count
  'churn_rate', // Customer churn rate
  'dau', // Daily Active Users
  'mau', // Monthly Active Users
  'cac', // Customer Acquisition Cost
  'ltv', // Lifetime Value
  'nps', // Net Promoter Score
  'burn_rate', // Monthly Burn Rate
  'runway', // Runway in months
  'revenue', // Total Revenue
  'gmv', // Gross Merchandise Value
  'conversion_rate', // Conversion Rate
  'retention_rate', // Retention Rate
  'other' // Custom metric
] as const

// GET /api/kpis - List KPI metrics for a startup
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const startupId = searchParams.get('startup_id')
    const metricType = searchParams.get('metric_type')
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')

    if (!startupId) {
      return NextResponse.json({ error: 'startup_id가 필요합니다.' }, { status: 400 })
    }

    let query = supabase
      .from('kpi_metrics')
      .select('*')
      .eq('startup_id', startupId)
      .order('period_end', { ascending: false })

    if (metricType) {
      query = query.eq('metric_type', metricType)
    }

    if (fromDate) {
      query = query.gte('period_start', fromDate)
    }

    if (toDate) {
      query = query.lte('period_end', toDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('KPI fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, kpiTypes: KPI_TYPES })
  } catch (error) {
    console.error('KPI API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/kpis - Create new KPI metric
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { startup_id, metric_type, metric_value, metric_unit, period_start, period_end } = body

    if (!startup_id || !metric_type || metric_value === undefined || !period_start || !period_end) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // Check if user is founder or team member of this startup
    const { data: startup } = await supabase
      .from('startups')
      .select('founder_id')
      .eq('id', startup_id)
      .single()

    if (!startup) {
      return NextResponse.json({ error: '스타트업을 찾을 수 없습니다.' }, { status: 404 })
    }

    const { data: teamMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('startup_id', startup_id)
      .eq('user_id', user.id)
      .single()

    if (startup.founder_id !== user.id && !teamMember) {
      return NextResponse.json(
        { error: 'KPI를 추가할 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // Create KPI metric
    const { data, error } = await supabase
      .from('kpi_metrics')
      .insert({
        startup_id,
        metric_type,
        metric_value,
        metric_unit: metric_unit || null,
        period_start,
        period_end,
      })
      .select()
      .single()

    if (error) {
      console.error('KPI create error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('KPI create API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// DELETE /api/kpis - Delete KPI metric
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const kpiId = searchParams.get('id')
    const startupId = searchParams.get('startup_id')

    if (!kpiId || !startupId) {
      return NextResponse.json({ error: 'id와 startup_id가 필요합니다.' }, { status: 400 })
    }

    // Check if user is founder
    const { data: startup } = await supabase
      .from('startups')
      .select('founder_id')
      .eq('id', startupId)
      .single()

    if (!startup || startup.founder_id !== user.id) {
      return NextResponse.json(
        { error: 'KPI를 삭제할 권한이 없습니다.' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('kpi_metrics')
      .delete()
      .eq('id', kpiId)
      .eq('startup_id', startupId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('KPI delete API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
