import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient, apiResponse, apiError, getCurrentCompanyId } from '@/lib/erp/api-utils'

// GET: 대시보드 통계 (최적화 버전)
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    const companyId = await getCurrentCompanyId(request)

    if (!companyId) {
      return apiError('회사를 찾을 수 없습니다.', 404)
    }

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd = new Date(year, month, 0).toISOString().split('T')[0]
    const today = now.toISOString().split('T')[0]

    // 6개월 전 날짜 계산
    const sixMonthsAgo = new Date(year, month - 7, 1)
    const sixMonthStart = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`

    // 모든 쿼리 병렬 실행
    const [
      employeeStats,
      salesData,
      purchaseData,
      pendingExpenses,
      approvedExpenseData,
      pendingLeaves,
      receivableData,
      payableData,
      recentTransactions,
      todayAttendance,
      trendSalesData,
      trendPurchaseData
    ] = await Promise.all([
      // 직원 현황 (단일 쿼리로 통합)
      supabase
        .from('employees')
        .select('status')
        .eq('company_id', companyId),

      // 월별 매출
      supabase
        .from('transactions')
        .select('total_amount')
        .eq('company_id', companyId)
        .eq('transaction_type', 'sales')
        .neq('status', 'cancelled')
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd),

      // 월별 매입
      supabase
        .from('transactions')
        .select('total_amount')
        .eq('company_id', companyId)
        .eq('transaction_type', 'purchase')
        .neq('status', 'cancelled')
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd),

      // 대기 경비
      supabase
        .from('expense_requests')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'pending'),

      // 승인된 경비
      supabase
        .from('expense_requests')
        .select('amount')
        .eq('company_id', companyId)
        .eq('status', 'approved')
        .gte('expense_date', monthStart)
        .lte('expense_date', monthEnd),

      // 대기 휴가
      supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'pending'),

      // 미수금
      supabase
        .from('transactions')
        .select('total_amount, paid_amount')
        .eq('company_id', companyId)
        .eq('transaction_type', 'sales')
        .neq('payment_status', 'paid')
        .neq('status', 'cancelled'),

      // 미지급금
      supabase
        .from('transactions')
        .select('total_amount, paid_amount')
        .eq('company_id', companyId)
        .eq('transaction_type', 'purchase')
        .neq('payment_status', 'paid')
        .neq('status', 'cancelled'),

      // 최근 거래
      supabase
        .from('transactions')
        .select(`
          id,
          transaction_number,
          transaction_type,
          transaction_date,
          total_amount,
          status,
          partner:business_partners(name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5),

      // 오늘 출근
      supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('work_date', today),

      // 6개월 매출 트렌드 (단일 쿼리)
      supabase
        .from('transactions')
        .select('transaction_date, total_amount')
        .eq('company_id', companyId)
        .eq('transaction_type', 'sales')
        .neq('status', 'cancelled')
        .gte('transaction_date', sixMonthStart)
        .lte('transaction_date', monthEnd),

      // 6개월 매입 트렌드 (단일 쿼리)
      supabase
        .from('transactions')
        .select('transaction_date, total_amount')
        .eq('company_id', companyId)
        .eq('transaction_type', 'purchase')
        .neq('status', 'cancelled')
        .gte('transaction_date', sixMonthStart)
        .lte('transaction_date', monthEnd),
    ])

    // 직원 통계 계산
    const employees = employeeStats.data || []
    const totalEmployees = employees.length
    const activeEmployees = employees.filter(e => e.status === 'active').length
    const onLeaveEmployees = employees.filter(e => e.status === 'on_leave').length

    // 매출/매입 계산
    const monthlySales = salesData.data?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0
    const monthlyPurchases = purchaseData.data?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0
    const monthlyProfit = monthlySales - monthlyPurchases

    // 경비 계산
    const approvedExpenses = approvedExpenseData.data?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

    // 미수금/미지급금 계산
    const totalReceivable = receivableData.data?.reduce((sum, t) => sum + (t.total_amount - t.paid_amount), 0) || 0
    const totalPayable = payableData.data?.reduce((sum, t) => sum + (t.total_amount - t.paid_amount), 0) || 0

    // 월별 트렌드 데이터 집계
    const monthlySalesMap = new Map<string, number>()
    const monthlyPurchaseMap = new Map<string, number>()

    for (const t of trendSalesData.data || []) {
      const monthKey = t.transaction_date?.substring(0, 7)
      if (monthKey) {
        monthlySalesMap.set(monthKey, (monthlySalesMap.get(monthKey) || 0) + (t.total_amount || 0))
      }
    }

    for (const t of trendPurchaseData.data || []) {
      const monthKey = t.transaction_date?.substring(0, 7)
      if (monthKey) {
        monthlyPurchaseMap.set(monthKey, (monthlyPurchaseMap.get(monthKey) || 0) + (t.total_amount || 0))
      }
    }

    const monthlySalesData = []
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(year, month - 1 - i, 1)
      const targetYear = targetDate.getFullYear()
      const targetMonth = targetDate.getMonth() + 1
      const monthKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`

      monthlySalesData.push({
        month: monthKey,
        sales: monthlySalesMap.get(monthKey) || 0,
        purchases: monthlyPurchaseMap.get(monthKey) || 0,
      })
    }

    return apiResponse({
      employees: {
        total: totalEmployees,
        active: activeEmployees,
        on_leave: onLeaveEmployees,
        today_attendance: todayAttendance.count || 0,
      },
      financials: {
        monthly_sales: monthlySales,
        monthly_purchases: monthlyPurchases,
        monthly_profit: monthlyProfit,
        total_receivable: totalReceivable,
        total_payable: totalPayable,
      },
      expenses: {
        pending: pendingExpenses.count || 0,
        approved_this_month: approvedExpenses,
      },
      leaves: {
        pending: pendingLeaves.count || 0,
      },
      recent_transactions: recentTransactions.data || [],
      monthly_trend: monthlySalesData,
    })
  } catch (error) {
    console.error('[ERP Dashboard] GET error:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
