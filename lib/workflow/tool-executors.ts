/**
 * Workflow Tool Executors
 * 워크플로우에서 사용하는 도구 실행 함수들
 */

import { createAdminClient } from '@/lib/supabase/admin'

// 도구 실행 컨텍스트
interface ToolContext {
  companyId?: string
  agentId?: string
  userId?: string
}

// 도구 실행 함수 매핑
export const toolExecutors: Record<string, (params: any, context: ToolContext) => Promise<any>> = {
  // ===== HR/인사 도구 =====
  get_employees: async (params, context) => {
    const supabase = createAdminClient()
    let query = (supabase as any).from('employees').select('*')

    if (context.companyId) {
      query = query.eq('company_id', context.companyId)
    }
    if (params.department) {
      query = query.eq('department', params.department)
    }
    if (params.status) {
      query = query.eq('status', params.status)
    }

    const { data, error } = await query.limit(params.limit || 50)
    if (error) throw error
    return { employees: data || [], count: data?.length || 0 }
  },

  get_employee_detail: async (params, context) => {
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('employees')
      .select('*')
      .eq('id', params.employeeId)
      .single()
    if (error) throw error
    return { employee: data }
  },

  // ===== 거래/재무 도구 =====
  get_transactions: async (params, context) => {
    const supabase = createAdminClient()
    let query = (supabase as any).from('transactions').select('*')

    if (context.companyId) {
      query = query.eq('company_id', context.companyId)
    }
    if (params.type) {
      query = query.eq('type', params.type)
    }
    if (params.category) {
      query = query.eq('category', params.category)
    }
    if (params.startDate) {
      query = query.gte('date', params.startDate)
    }
    if (params.endDate) {
      query = query.lte('date', params.endDate)
    }

    // period 처리
    if (params.period === 'this_month') {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      query = query.gte('date', firstDay.toISOString().split('T')[0])
    } else if (params.period === 'this_week') {
      const now = new Date()
      const firstDay = new Date(now.setDate(now.getDate() - now.getDay()))
      query = query.gte('date', firstDay.toISOString().split('T')[0])
    }

    const { data, error } = await query.order('date', { ascending: false }).limit(params.limit || 100)
    if (error) throw error
    return { transactions: data || [], count: data?.length || 0 }
  },

  aggregate_transactions: async (params, context) => {
    const transactions = params.transactions || []

    // 카테고리별 집계
    const byCategory: Record<string, { income: number; expense: number; count: number }> = {}

    for (const tx of transactions) {
      const cat = tx.category || 'uncategorized'
      if (!byCategory[cat]) {
        byCategory[cat] = { income: 0, expense: 0, count: 0 }
      }
      if (tx.type === 'income') {
        byCategory[cat].income += tx.amount || 0
      } else {
        byCategory[cat].expense += tx.amount || 0
      }
      byCategory[cat].count++
    }

    const totalIncome = Object.values(byCategory).reduce((sum, c) => sum + c.income, 0)
    const totalExpense = Object.values(byCategory).reduce((sum, c) => sum + c.expense, 0)

    return {
      byCategory,
      totalIncome,
      totalExpense,
      netAmount: totalIncome - totalExpense,
      transactionCount: transactions.length,
    }
  },

  check_budget_overrun: async (params, context) => {
    const aggregated = params.aggregated
    const threshold = params.threshold || 100 // 100%

    // 예산 데이터 조회 (있다면)
    const supabase = createAdminClient()
    const { data: budgetsData } = await (supabase as any)
      .from('budgets')
      .select('*')
      .eq('company_id', context.companyId)

    const budgets = budgetsData as any[] | null
    const overruns: any[] = []
    let hasOverrun = false

    if (budgets && aggregated?.byCategory) {
      for (const budget of budgets) {
        const category = budget.category as string
        const spent = aggregated.byCategory[category]?.expense || 0
        const limit = budget.amount || 0

        if (limit > 0) {
          const percentage = (spent / limit) * 100
          if (percentage >= threshold) {
            hasOverrun = true
            overruns.push({
              category,
              budgetLimit: limit,
              spent,
              percentage: Math.round(percentage),
            })
          }
        }
      }
    }

    return { hasOverrun, overruns, threshold }
  },

  // ===== 태스크 도구 =====
  get_tasks: async (params, context) => {
    const supabase = createAdminClient()
    let query = (supabase as any).from('company_tasks').select('*')

    if (context.companyId) {
      query = query.eq('company_id', context.companyId)
    }
    if (params.status && params.status !== 'all') {
      query = query.eq('status', params.status)
    }
    if (params.assignee) {
      query = query.eq('assignee_id', params.assignee)
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(params.limit || 50)
    if (error) throw error
    return { tasks: data || [], count: data?.length || 0 }
  },

  create_task: async (params, context) => {
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('company_tasks')
      .insert({
        title: params.title,
        description: params.description,
        status: params.status || 'pending',
        priority: params.priority || 'medium',
        assignee_id: params.assigneeId,
        due_date: params.dueDate,
        company_id: context.companyId,
      })
      .select()
      .single()

    if (error) throw error
    return { task: data, message: '태스크가 생성되었습니다' }
  },

  update_task_status: async (params, context) => {
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('company_tasks')
      .update({ status: params.status })
      .eq('id', params.taskId)
      .select()
      .single()

    if (error) throw error
    return { task: data, message: '태스크 상태가 업데이트되었습니다' }
  },

  analyze_task_progress: async (params, context) => {
    const tasks = params.tasks || []

    const total = tasks.length
    const completed = tasks.filter((t: any) => t.status === 'completed').length
    const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length
    const pending = tasks.filter((t: any) => t.status === 'pending').length
    const blocked = tasks.filter((t: any) => t.status === 'blocked').length

    return {
      total,
      completed,
      inProgress,
      pending,
      blocked,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    }
  },

  identify_blockers: async (params, context) => {
    const tasks = params.tasks || []
    const blockers = tasks.filter((t: any) => t.status === 'blocked' || t.is_blocked)

    return {
      blockers: blockers.map((t: any) => ({
        id: t.id,
        title: t.title,
        blockReason: t.block_reason || '이유 미기재',
      })),
      count: blockers.length,
    }
  },

  // ===== 캘린더 도구 =====
  get_calendar_events: async (params, context) => {
    const supabase = createAdminClient()
    let query = (supabase as any).from('calendar_events').select('*')

    if (context.companyId) {
      query = query.eq('company_id', context.companyId)
    }
    if (params.startDate) {
      query = query.gte('start_time', params.startDate)
    }
    if (params.endDate) {
      query = query.lte('end_time', params.endDate)
    }

    const { data, error } = await query.order('start_time', { ascending: true }).limit(params.limit || 50)
    if (error) throw error
    return { events: data || [], count: data?.length || 0 }
  },

  create_calendar_event: async (params, context) => {
    const supabase = createAdminClient()

    // duration을 기반으로 종료 시간 계산
    const startTime = params.startTime ? new Date(params.startTime) : new Date()
    const durationDays = params.duration || 1
    const endTime = new Date(startTime.getTime() + durationDays * 24 * 60 * 60 * 1000)

    const { data, error } = await (supabase as any)
      .from('calendar_events')
      .insert({
        title: params.title,
        description: params.description,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        location: params.location,
        company_id: context.companyId,
      })
      .select()
      .single()

    if (error) throw error
    return { event: data, message: '일정이 생성되었습니다' }
  },

  // ===== 보고서 도구 =====
  generate_report: async (params, context) => {
    const reportType = params.type || 'summary'
    const reportData: any = { generatedAt: new Date().toISOString(), type: reportType }

    switch (reportType) {
      case 'monthly_summary':
        reportData.title = '월간 요약 보고서'
        reportData.content = '이번 달 업무 요약 보고서입니다.'
        break
      case 'daily_summary':
        reportData.title = '일일 요약 보고서'
        reportData.content = '오늘의 업무 요약 보고서입니다.'
        break
      case 'budget_alert':
        reportData.title = '예산 초과 알림'
        reportData.content = '예산 초과 항목이 발견되었습니다.'
        reportData.alert = true
        break
      default:
        reportData.title = '일반 보고서'
        reportData.content = '보고서가 생성되었습니다.'
    }

    return { report: reportData }
  },

  // ===== 알림 도구 =====
  send_notification: async (params, context) => {
    console.log('[Notification]', params)
    return {
      sent: true,
      channel: params.channel || 'system',
      recipient: params.recipient,
      message: params.message || params.template,
    }
  },

  // ===== 회사 정보 도구 =====
  get_company_info: async (params, context) => {
    if (!context.companyId) {
      return { error: '회사 정보가 없습니다' }
    }

    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('companies')
      .select('*')
      .eq('id', context.companyId)
      .single()

    if (error) throw error
    return { company: data }
  },

  // ===== 유틸리티 도구 =====
  get_current_time: async () => {
    return {
      timestamp: new Date().toISOString(),
      formatted: new Date().toLocaleString('ko-KR'),
    }
  },

  delay: async (params) => {
    const ms = params.ms || params.delayMs || 1000
    await new Promise(resolve => setTimeout(resolve, ms))
    return { delayed: ms }
  },
}

/**
 * 도구 실행기 생성
 */
export function createWorkflowToolExecutor(companyId?: string, agentId?: string, userId?: string) {
  const context: ToolContext = { companyId, agentId, userId }

  return async (toolName: string, params: Record<string, any>) => {
    console.log(`[Workflow] Executing tool: ${toolName}`, params)

    const executor = toolExecutors[toolName]
    if (!executor) {
      throw new Error(`알 수 없는 도구: ${toolName}`)
    }

    // _context에서 추가 정보 추출
    const mergedContext = {
      ...context,
      ...(params._context || {}),
    }

    // _context 제거하고 실행
    const { _context, ...cleanParams } = params

    return await executor(cleanParams, mergedContext)
  }
}

/**
 * 사용 가능한 도구 목록 반환
 */
export function getAvailableTools() {
  const descriptions: Record<string, string> = {
    get_employees: '직원 목록 조회',
    get_employee_detail: '직원 상세 정보 조회',
    get_transactions: '거래 내역 조회',
    aggregate_transactions: '거래 내역 집계',
    check_budget_overrun: '예산 초과 확인',
    get_tasks: '태스크 목록 조회',
    create_task: '태스크 생성',
    update_task_status: '태스크 상태 변경',
    analyze_task_progress: '태스크 진행률 분석',
    identify_blockers: '블로커 식별',
    get_calendar_events: '캘린더 일정 조회',
    create_calendar_event: '캘린더 일정 생성',
    generate_report: '보고서 생성',
    send_notification: '알림 발송',
    get_company_info: '회사 정보 조회',
    get_current_time: '현재 시간 조회',
    delay: '지연 (대기)',
  }

  return Object.keys(toolExecutors).map(name => ({
    name,
    description: descriptions[name] || '설명 없음',
  }))
}
