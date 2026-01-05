import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDevUser } from '@/lib/dev-user'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const { searchParams } = new URL(request.url)
    const contractId = searchParams.get('contract_id')

    let query = supabase
      .from('project_budgets')
      .select(`
        *,
        contract:program_contracts(id, contract_name, total_amount)
      `)
      .eq('user_id', devUser.id)

    if (contractId) {
      query = query.eq('contract_id', contractId)
    }

    const { data: budgets, error } = await query.order('category', { ascending: true })

    if (error) throw error

    // 카테고리별 집계
    const summary = budgets?.reduce((acc: any, budget: any) => {
      if (!acc[budget.category]) {
        acc[budget.category] = { planned: 0, executed: 0 }
      }
      acc[budget.category].planned += Number(budget.planned_amount) || 0
      acc[budget.category].executed += Number(budget.executed_amount) || 0
      return acc
    }, {})

    const totalPlanned = budgets?.reduce((sum: number, b: any) => sum + (Number(b.planned_amount) || 0), 0) || 0
    const totalExecuted = budgets?.reduce((sum: number, b: any) => sum + (Number(b.executed_amount) || 0), 0) || 0

    return NextResponse.json({
      budgets,
      summary: {
        byCategory: summary,
        total: {
          planned: totalPlanned,
          executed: totalExecuted,
          remaining: totalPlanned - totalExecuted,
          executionRate: totalPlanned > 0 ? ((totalExecuted / totalPlanned) * 100).toFixed(1) : 0
        }
      }
    })
  } catch (error: any) {
    console.error('Budgets fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const body = await request.json()

    const { contract_id, category, subcategory, name, planned_amount, notes } = body

    if (!contract_id || !category || !name || planned_amount === undefined) {
      return NextResponse.json({ error: 'contract_id, category, name, planned_amount are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('project_budgets')
      .insert({
        user_id: devUser.id,
        contract_id,
        category,
        subcategory,
        name,
        planned_amount,
        executed_amount: 0,
        notes
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ budget: data })
  } catch (error: any) {
    console.error('Budget create error:', error)
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
      .from('project_budgets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', devUser.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ budget: data })
  } catch (error: any) {
    console.error('Budget update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
