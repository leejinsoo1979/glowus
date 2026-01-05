import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDevUser } from '@/lib/dev-user'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const { searchParams } = new URL(request.url)
    const contractId = searchParams.get('contract_id')
    const budgetId = searchParams.get('budget_id')
    const status = searchParams.get('status')

    let query = supabase
      .from('project_expenses')
      .select(`
        *,
        budget:project_budgets(id, name, category),
        contract:program_contracts(id, contract_name)
      `)
      .eq('user_id', devUser.id)

    if (contractId) {
      query = query.eq('contract_id', contractId)
    }

    if (budgetId) {
      query = query.eq('budget_id', budgetId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: expenses, error } = await query.order('expense_date', { ascending: false })

    if (error) throw error

    return NextResponse.json({ expenses })
  } catch (error: any) {
    console.error('Expenses fetch error:', error)
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
      budget_id,
      expense_date,
      description,
      amount,
      vendor,
      payment_method,
      receipt_file_url,
      receipt_number,
      notes
    } = body

    if (!contract_id || !expense_date || !description || amount === undefined) {
      return NextResponse.json({ error: 'contract_id, expense_date, description, amount are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('project_expenses')
      .insert({
        user_id: devUser.id,
        contract_id,
        budget_id,
        expense_date,
        description,
        amount,
        vendor,
        payment_method,
        receipt_file_url,
        receipt_number,
        notes,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error

    // 예산 항목의 집행금액 업데이트
    if (budget_id) {
      await supabase.rpc('increment_budget_executed', {
        budget_id,
        amount
      }).catch(() => {
        // RPC가 없으면 직접 업데이트
        supabase
          .from('project_budgets')
          .select('executed_amount')
          .eq('id', budget_id)
          .single()
          .then(({ data: budget }) => {
            if (budget) {
              supabase
                .from('project_budgets')
                .update({
                  executed_amount: (Number(budget.executed_amount) || 0) + Number(amount)
                })
                .eq('id', budget_id)
            }
          })
      })
    }

    return NextResponse.json({ expense: data })
  } catch (error: any) {
    console.error('Expense create error:', error)
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

    // 승인 처리
    if (updates.status === 'approved' && !updates.approved_at) {
      updates.approved_at = new Date().toISOString()
      updates.approved_by = devUser.id
    }

    const { data, error } = await supabase
      .from('project_expenses')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', devUser.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ expense: data })
  } catch (error: any) {
    console.error('Expense update error:', error)
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
      .from('project_expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', devUser.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Expense delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
