/**
 * Agent Business Tools - 백엔드에서 실제 실행되는 업무용 도구
 *
 * 에이전트가 실제 업무를 수행할 수 있도록 하는 도구 모음
 * - 데이터베이스 조회/수정
 * - HR 업무 (직원 정보, 근태)
 * - 재무 업무 (거래내역, 비용)
 * - 캘린더 (일정 관리)
 * - 태스크 관리
 */

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================
// Context 타입 - 에이전트 실행 컨텍스트
// ============================================
export interface AgentExecutionContext {
  agentId: string
  companyId?: string
  userId?: string
  projectPath?: string
}

// 전역 컨텍스트 (런타임에 설정)
let executionContext: AgentExecutionContext = {
  agentId: '',
}

export function setAgentExecutionContext(ctx: AgentExecutionContext) {
  executionContext = ctx
}

export function getAgentExecutionContext(): AgentExecutionContext {
  return executionContext
}

// ============================================
// 1. 직원 조회 도구
// ============================================
export const queryEmployeesTool = new DynamicStructuredTool({
  name: 'query_employees',
  description: `회사 직원 목록을 조회합니다. 필터를 사용해 특정 부서, 직급의 직원을 검색할 수 있습니다.

사용 예시:
- "직원 목록 보여줘" → 전체 조회
- "개발팀 직원 누구야?" → department="개발팀"
- "매니저급 직원" → position="매니저"`,
  schema: z.object({
    department: z.string().optional().describe('부서 필터 (예: 개발팀, 마케팅팀)'),
    position: z.string().optional().describe('직급 필터 (예: 대리, 과장, 매니저)'),
    status: z.enum(['active', 'inactive', 'all']).optional().describe('재직 상태'),
    limit: z.number().optional().describe('최대 결과 수 (기본: 20)'),
  }),
  func: async (params) => {
    const ctx = getAgentExecutionContext()
    const supabase = createAdminClient()

    try {
      let query = supabase
        .from('employees')
        .select('id, name, email, department, position, hire_date, status, phone')

      // 회사 필터 (컨텍스트에서)
      if (ctx.companyId) {
        query = query.eq('company_id', ctx.companyId)
      }

      // 부서 필터
      if (params.department) {
        query = query.ilike('department', `%${params.department}%`)
      }

      // 직급 필터
      if (params.position) {
        query = query.ilike('position', `%${params.position}%`)
      }

      // 상태 필터
      if (params.status && params.status !== 'all') {
        query = query.eq('status', params.status)
      }

      // 정렬 및 제한
      query = query.order('name').limit(params.limit || 20)

      const { data, error } = await query

      if (error) {
        return JSON.stringify({ success: false, error: error.message })
      }

      return JSON.stringify({
        success: true,
        count: data?.length || 0,
        employees: (data as any[])?.map(emp => ({
          id: emp.id,
          이름: emp.name,
          이메일: emp.email,
          부서: emp.department,
          직급: emp.position,
          입사일: emp.hire_date,
          상태: emp.status === 'active' ? '재직중' : '퇴사',
          연락처: emp.phone,
        })) || [],
      })
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message })
    }
  },
})

// ============================================
// 2. 직원 상세 조회 도구
// ============================================
export const getEmployeeDetailTool = new DynamicStructuredTool({
  name: 'get_employee_detail',
  description: '특정 직원의 상세 정보를 조회합니다.',
  schema: z.object({
    employeeId: z.string().optional().describe('직원 ID'),
    name: z.string().optional().describe('직원 이름으로 검색'),
    email: z.string().optional().describe('이메일로 검색'),
  }),
  func: async (params) => {
    const ctx = getAgentExecutionContext()
    const supabase = createAdminClient()

    try {
      let query = supabase
        .from('employees')
        .select('*')

      if (params.employeeId) {
        query = query.eq('id', params.employeeId)
      } else if (params.name) {
        query = query.ilike('name', `%${params.name}%`)
      } else if (params.email) {
        query = query.eq('email', params.email)
      } else {
        return JSON.stringify({ success: false, error: '검색 조건을 입력해주세요.' })
      }

      if (ctx.companyId) {
        query = query.eq('company_id', ctx.companyId)
      }

      const { data, error } = await query.single()

      if (error) {
        return JSON.stringify({ success: false, error: '직원을 찾을 수 없습니다.' })
      }

      const emp = data as any
      return JSON.stringify({
        success: true,
        employee: {
          id: emp.id,
          이름: emp.name,
          이메일: emp.email,
          부서: emp.department,
          직급: emp.position,
          입사일: emp.hire_date,
          상태: emp.status === 'active' ? '재직중' : '퇴사',
          연락처: emp.phone,
          주소: emp.address,
          생년월일: emp.birth_date,
          급여: emp.salary ? `${emp.salary.toLocaleString()}원` : null,
        },
      })
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message })
    }
  },
})

// ============================================
// 3. 거래내역 조회 도구
// ============================================
export const queryTransactionsTool = new DynamicStructuredTool({
  name: 'query_transactions',
  description: `회사 거래내역을 조회합니다. 날짜, 유형, 금액으로 필터링할 수 있습니다.

사용 예시:
- "이번 달 거래내역" → startDate/endDate 설정
- "입금 내역" → type="income"
- "100만원 이상 지출" → type="expense", minAmount=1000000`,
  schema: z.object({
    startDate: z.string().optional().describe('시작 날짜 (YYYY-MM-DD)'),
    endDate: z.string().optional().describe('종료 날짜 (YYYY-MM-DD)'),
    type: z.enum(['income', 'expense', 'all']).optional().describe('거래 유형'),
    minAmount: z.number().optional().describe('최소 금액'),
    maxAmount: z.number().optional().describe('최대 금액'),
    category: z.string().optional().describe('카테고리'),
    limit: z.number().optional().describe('최대 결과 수'),
  }),
  func: async (params) => {
    const ctx = getAgentExecutionContext()
    const supabase = createAdminClient()

    try {
      let query = supabase
        .from('transactions')
        .select('*')

      if (ctx.companyId) {
        query = query.eq('company_id', ctx.companyId)
      }

      if (params.startDate) {
        query = query.gte('transaction_date', params.startDate)
      }
      if (params.endDate) {
        query = query.lte('transaction_date', params.endDate)
      }
      if (params.type && params.type !== 'all') {
        query = query.eq('type', params.type)
      }
      if (params.minAmount) {
        query = query.gte('amount', params.minAmount)
      }
      if (params.maxAmount) {
        query = query.lte('amount', params.maxAmount)
      }
      if (params.category) {
        query = query.ilike('category', `%${params.category}%`)
      }

      query = query.order('transaction_date', { ascending: false }).limit(params.limit || 50)

      const { data, error } = await query

      if (error) {
        return JSON.stringify({ success: false, error: error.message })
      }

      // 합계 계산
      const txns = (data || []) as any[]
      const totalIncome = txns.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0)
      const totalExpense = txns.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0)

      return JSON.stringify({
        success: true,
        summary: {
          총_거래건수: txns.length,
          총_수입: `${totalIncome.toLocaleString()}원`,
          총_지출: `${totalExpense.toLocaleString()}원`,
          순이익: `${(totalIncome - totalExpense).toLocaleString()}원`,
        },
        transactions: txns.map(t => ({
          id: t.id,
          날짜: t.transaction_date,
          유형: t.type === 'income' ? '수입' : '지출',
          금액: `${t.amount?.toLocaleString()}원`,
          카테고리: t.category,
          설명: t.description,
          거래처: t.counterparty,
        })),
      })
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message })
    }
  },
})

// ============================================
// 4. 프로젝트 조회 도구
// ============================================
export const queryProjectsTool = new DynamicStructuredTool({
  name: 'query_projects',
  description: '회사 프로젝트 목록을 조회합니다.',
  schema: z.object({
    status: z.enum(['active', 'completed', 'paused', 'all']).optional().describe('프로젝트 상태'),
    priority: z.enum(['low', 'medium', 'high', 'urgent', 'all']).optional().describe('우선순위'),
    search: z.string().optional().describe('프로젝트명 검색'),
  }),
  func: async (params) => {
    const ctx = getAgentExecutionContext()
    const supabase = createAdminClient()

    try {
      let query = supabase
        .from('projects')
        .select('*')

      if (ctx.companyId) {
        query = query.eq('company_id', ctx.companyId)
      }
      if (params.status && params.status !== 'all') {
        query = query.eq('status', params.status)
      }
      if (params.priority && params.priority !== 'all') {
        query = query.eq('priority', params.priority)
      }
      if (params.search) {
        query = query.ilike('name', `%${params.search}%`)
      }

      query = query.order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) {
        return JSON.stringify({ success: false, error: error.message })
      }

      const statusMap: Record<string, string> = {
        active: '진행중',
        completed: '완료',
        paused: '일시중지',
        planning: '계획중',
      }
      const priorityMap: Record<string, string> = {
        low: '낮음',
        medium: '보통',
        high: '높음',
        urgent: '긴급',
      }

      const projects = (data || []) as any[]
      return JSON.stringify({
        success: true,
        count: projects.length,
        projects: projects.map(p => ({
          id: p.id,
          프로젝트명: p.name,
          설명: p.description,
          상태: statusMap[p.status] || p.status,
          우선순위: priorityMap[p.priority] || p.priority,
          시작일: p.start_date,
          마감일: p.deadline,
          진행률: p.progress ? `${p.progress}%` : '0%',
        })),
      })
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message })
    }
  },
})

// ============================================
// 5. 태스크 생성 도구 (실제 DB 저장)
// ============================================
export const createTaskInDBTool = new DynamicStructuredTool({
  name: 'create_task_db',
  description: `데이터베이스에 새 태스크를 생성합니다.

사용 예시:
- "회의록 작성 태스크 만들어줘"
- "김철수에게 보고서 작성 업무 할당"`,
  schema: z.object({
    title: z.string().describe('태스크 제목'),
    description: z.string().optional().describe('태스크 설명'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('우선순위'),
    dueDate: z.string().optional().describe('마감일 (YYYY-MM-DD)'),
    assigneeName: z.string().optional().describe('담당자 이름'),
    projectId: z.string().optional().describe('프로젝트 ID'),
  }),
  func: async (params) => {
    const ctx = getAgentExecutionContext()
    const supabase = createAdminClient()

    try {
      // 담당자 검색 (이름으로)
      let assigneeId = null
      if (params.assigneeName && ctx.companyId) {
        const { data: employee } = await supabase
          .from('employees')
          .select('id, name')
          .eq('company_id', ctx.companyId)
          .ilike('name', `%${params.assigneeName}%`)
          .single()

        if (employee) {
          assigneeId = (employee as any).id
        }
      }

      const { data, error } = await (supabase
        .from('company_tasks') as any)
        .insert({
          title: params.title,
          description: params.description,
          priority: params.priority || 'medium',
          status: 'pending',
          due_date: params.dueDate,
          assignee_id: assigneeId,
          project_id: params.projectId,
          company_id: ctx.companyId,
          created_by: ctx.agentId,
          created_by_type: 'agent',
        })
        .select()
        .single()

      if (error) {
        return JSON.stringify({ success: false, error: error.message })
      }

      const task = data as any
      return JSON.stringify({
        success: true,
        message: `태스크 "${params.title}"가 생성되었습니다.`,
        task: {
          id: task.id,
          제목: task.title,
          설명: task.description,
          우선순위: task.priority,
          마감일: task.due_date,
          담당자: params.assigneeName || '미지정',
        },
      })
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message })
    }
  },
})

// ============================================
// 6. 태스크 목록 조회 도구
// ============================================
export const queryTasksTool = new DynamicStructuredTool({
  name: 'query_tasks',
  description: '태스크 목록을 조회합니다.',
  schema: z.object({
    status: z.enum(['pending', 'in_progress', 'completed', 'all']).optional().describe('상태'),
    priority: z.enum(['low', 'medium', 'high', 'urgent', 'all']).optional().describe('우선순위'),
    assigneeName: z.string().optional().describe('담당자 이름'),
    projectId: z.string().optional().describe('프로젝트 ID'),
  }),
  func: async (params) => {
    const ctx = getAgentExecutionContext()
    const supabase = createAdminClient()

    try {
      let query = (supabase
        .from('company_tasks') as any)
        .select(`
          *,
          assignee:employees!assignee_id(name),
          project:projects!project_id(name)
        `)

      if (ctx.companyId) {
        query = query.eq('company_id', ctx.companyId)
      }
      if (params.status && params.status !== 'all') {
        query = query.eq('status', params.status)
      }
      if (params.priority && params.priority !== 'all') {
        query = query.eq('priority', params.priority)
      }
      if (params.projectId) {
        query = query.eq('project_id', params.projectId)
      }

      query = query.order('created_at', { ascending: false }).limit(50)

      const { data, error } = await query

      if (error) {
        return JSON.stringify({ success: false, error: error.message })
      }

      const statusMap: Record<string, string> = {
        pending: '대기중',
        in_progress: '진행중',
        completed: '완료',
        cancelled: '취소됨',
      }

      const priorityMap: Record<string, string> = {
        low: '낮음',
        medium: '보통',
        high: '높음',
        urgent: '긴급',
      }

      const tasks = (data || []) as any[]
      return JSON.stringify({
        success: true,
        count: tasks.length,
        tasks: tasks.map(t => ({
          id: t.id,
          제목: t.title,
          설명: t.description,
          상태: statusMap[t.status] || t.status,
          우선순위: priorityMap[t.priority] || t.priority,
          담당자: t.assignee?.name || '미지정',
          프로젝트: t.project?.name || '없음',
          마감일: t.due_date,
          생성일: t.created_at,
        })),
      })
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message })
    }
  },
})

// ============================================
// 7. 태스크 상태 업데이트 도구
// ============================================
export const updateTaskStatusTool = new DynamicStructuredTool({
  name: 'update_task_status',
  description: '태스크의 상태를 업데이트합니다.',
  schema: z.object({
    taskId: z.string().describe('태스크 ID'),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).describe('새 상태'),
    comment: z.string().optional().describe('상태 변경 코멘트'),
  }),
  func: async (params) => {
    const supabase = createAdminClient()

    try {
      const updateData: any = {
        status: params.status,
        updated_at: new Date().toISOString(),
      }

      // 완료 상태로 변경 시 완료 시간 기록
      if (params.status === 'completed') {
        updateData.completed_at = new Date().toISOString()
      }

      const { data, error } = await (supabase
        .from('company_tasks') as any)
        .update(updateData)
        .eq('id', params.taskId)
        .select()
        .single()

      if (error) {
        return JSON.stringify({ success: false, error: error.message })
      }

      const statusMap: Record<string, string> = {
        pending: '대기중',
        in_progress: '진행중',
        completed: '완료',
        cancelled: '취소됨',
      }

      const task = data as any
      return JSON.stringify({
        success: true,
        message: `태스크 "${task.title}"의 상태가 "${statusMap[params.status]}"로 변경되었습니다.`,
      })
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message })
    }
  },
})

// ============================================
// 8. 일정/이벤트 조회 도구
// ============================================
export const queryCalendarEventsTool = new DynamicStructuredTool({
  name: 'query_calendar',
  description: `캘린더 일정을 조회합니다.

사용 예시:
- "오늘 일정" → 오늘 날짜
- "이번 주 회의" → startDate~endDate
- "다음 달 중요 일정"`,
  schema: z.object({
    startDate: z.string().optional().describe('시작 날짜 (YYYY-MM-DD)'),
    endDate: z.string().optional().describe('종료 날짜 (YYYY-MM-DD)'),
    search: z.string().optional().describe('일정 제목 검색'),
  }),
  func: async (params) => {
    const ctx = getAgentExecutionContext()
    const supabase = createAdminClient()

    try {
      // 기본값: 오늘부터 7일
      const today = new Date()
      const startDate = params.startDate || today.toISOString().split('T')[0]
      const endDate = params.endDate || new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      let query = supabase
        .from('calendar_events')
        .select(`
          *,
          attendees:event_attendees(user_id, name, response_status)
        `)
        .gte('start_time', startDate)
        .lte('start_time', endDate + 'T23:59:59')

      // 검색어 필터
      if (params.search) {
        query = query.ilike('title', `%${params.search}%`)
      }

      query = query.order('start_time', { ascending: true })

      const { data, error } = await query

      if (error) {
        return JSON.stringify({ success: false, error: error.message })
      }

      const statusMap: Record<string, string> = {
        tentative: '미확정',
        confirmed: '확정',
        cancelled: '취소됨',
      }

      const events = (data || []) as any[]
      return JSON.stringify({
        success: true,
        period: `${startDate} ~ ${endDate}`,
        count: events.length,
        events: events.map(e => ({
          id: e.id,
          제목: e.title,
          상태: statusMap[e.status] || e.status,
          시작: e.start_time,
          종료: e.end_time,
          장소: e.location,
          설명: e.description,
          종일: e.all_day ? '예' : '아니오',
          참석자: e.attendees?.map((a: any) => a.name).filter(Boolean).join(', ') || '',
        })),
      })
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message })
    }
  },
})

// ============================================
// 9. 일정 생성 도구
// ============================================
export const createCalendarEventTool = new DynamicStructuredTool({
  name: 'create_calendar_event',
  description: '새 캘린더 일정을 생성합니다.',
  schema: z.object({
    title: z.string().describe('일정 제목'),
    startTime: z.string().describe('시작 시간 (YYYY-MM-DD HH:mm 또는 YYYY-MM-DDTHH:mm)'),
    endTime: z.string().optional().describe('종료 시간 (YYYY-MM-DD HH:mm)'),
    location: z.string().optional().describe('장소'),
    description: z.string().optional().describe('설명'),
    allDay: z.boolean().optional().describe('종일 일정 여부'),
  }),
  func: async (params) => {
    const ctx = getAgentExecutionContext()
    const supabase = createAdminClient()

    try {
      // 시간 형식 파싱
      const parseTime = (timeStr: string) => {
        // "2025-12-29 14:00" → "2025-12-29T14:00:00+09:00"
        if (timeStr.includes(' ')) {
          return timeStr.replace(' ', 'T') + ':00+09:00'
        }
        if (!timeStr.includes('T')) {
          return timeStr + 'T00:00:00+09:00'
        }
        return timeStr
      }

      const startTime = parseTime(params.startTime)
      const endTime = params.endTime ? parseTime(params.endTime) : startTime

      // user_id는 필수이므로 ctx.userId 사용
      if (!ctx.userId) {
        return JSON.stringify({ success: false, error: '사용자 인증이 필요합니다.' })
      }

      const { data, error } = await (supabase
        .from('calendar_events') as any)
        .insert({
          user_id: ctx.userId,
          title: params.title,
          start_time: startTime,
          end_time: endTime,
          location: params.location,
          description: params.description,
          all_day: params.allDay || false,
          status: 'confirmed',
          timezone: 'Asia/Seoul',
        })
        .select()
        .single()

      if (error) {
        return JSON.stringify({ success: false, error: error.message })
      }

      const event = data as any
      return JSON.stringify({
        success: true,
        message: `일정 "${params.title}"가 생성되었습니다.`,
        event: {
          id: event.id,
          제목: event.title,
          시작: event.start_time,
          종료: event.end_time,
          장소: event.location,
        },
      })
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message })
    }
  },
})

// ============================================
// 10. 회사 정보 조회 도구
// ============================================
export const getCompanyInfoTool = new DynamicStructuredTool({
  name: 'get_company_info',
  description: '에이전트가 소속된 회사 정보를 조회합니다.',
  schema: z.object({}),
  func: async () => {
    const ctx = getAgentExecutionContext()
    const supabase = createAdminClient()

    try {
      if (!ctx.companyId) {
        return JSON.stringify({ success: false, error: '회사 정보가 연결되어 있지 않습니다.' })
      }

      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', ctx.companyId)
        .single()

      if (error) {
        return JSON.stringify({ success: false, error: error.message })
      }

      const company = data as any
      return JSON.stringify({
        success: true,
        company: {
          회사명: company.name,
          사업자번호: company.business_number,
          대표이사: company.ceo_name || company.representative,
          업종: company.business_type,
          업태: company.business_category,
          주소: `${company.address}${company.address_detail ? ' ' + company.address_detail : ''}`,
          전화: company.phone,
          이메일: company.email,
          웹사이트: company.website,
          설립일: company.establishment_date,
        },
      })
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message })
    }
  },
})

// ============================================
// 11. 통계/대시보드 도구
// ============================================
export const getBusinessStatsTool = new DynamicStructuredTool({
  name: 'get_business_stats',
  description: `회사 업무 통계를 조회합니다. 직원 수, 프로젝트 현황, 태스크 현황 등 대시보드 데이터를 제공합니다.`,
  schema: z.object({
    period: z.enum(['today', 'week', 'month', 'year']).optional().describe('조회 기간'),
  }),
  func: async (params) => {
    const ctx = getAgentExecutionContext()
    const supabase = createAdminClient()

    try {
      const stats: Record<string, any> = {}

      // 직원 수
      const { count: employeeCount } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', ctx.companyId || '')
        .eq('status', 'active')

      stats.직원수 = employeeCount || 0

      // 프로젝트 현황
      const { data: projectsData } = await supabase
        .from('projects')
        .select('status')
        .eq('company_id', ctx.companyId || '')

      const projects = (projectsData || []) as any[]
      const projectStats = {
        전체: projects.length,
        진행중: projects.filter(p => p.status === 'active').length,
        완료: projects.filter(p => p.status === 'completed').length,
      }
      stats.프로젝트 = projectStats

      // 태스크 현황
      const { data: tasksData } = await (supabase
        .from('company_tasks') as any)
        .select('status')
        .eq('company_id', ctx.companyId || '')

      const tasks = (tasksData || []) as any[]
      const taskStats = {
        전체: tasks.length,
        대기중: tasks.filter(t => t.status === 'pending').length,
        진행중: tasks.filter(t => t.status === 'in_progress').length,
        완료: tasks.filter(t => t.status === 'completed').length,
      }
      stats.태스크 = taskStats

      return JSON.stringify({
        success: true,
        조회기간: params.period || '전체',
        통계: stats,
      })
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message })
    }
  },
})

// ============================================
// 12. 현재 날짜/시간 도구
// ============================================
export const getCurrentDateTimeTool = new DynamicStructuredTool({
  name: 'get_current_datetime',
  description: '현재 날짜와 시간을 조회합니다.',
  schema: z.object({}),
  func: async () => {
    const now = new Date()
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000) // KST

    const dayNames = ['일', '월', '화', '수', '목', '금', '토']

    return JSON.stringify({
      success: true,
      현재시각: {
        날짜: kst.toISOString().split('T')[0],
        시간: kst.toISOString().split('T')[1].substring(0, 5),
        요일: dayNames[kst.getDay()] + '요일',
        전체: kst.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      },
    })
  },
})

// ============================================
// 모든 비즈니스 도구 내보내기
// ============================================
export const AGENT_BUSINESS_TOOLS = {
  query_employees: queryEmployeesTool,
  get_employee_detail: getEmployeeDetailTool,
  query_transactions: queryTransactionsTool,
  query_projects: queryProjectsTool,
  create_task_db: createTaskInDBTool,
  query_tasks: queryTasksTool,
  update_task_status: updateTaskStatusTool,
  query_calendar: queryCalendarEventsTool,
  create_calendar_event: createCalendarEventTool,
  get_company_info: getCompanyInfoTool,
  get_business_stats: getBusinessStatsTool,
  get_current_datetime: getCurrentDateTimeTool,
}

export function getAgentBusinessTools(): DynamicStructuredTool[] {
  return Object.values(AGENT_BUSINESS_TOOLS)
}

export function getAllBusinessToolNames(): string[] {
  return Object.keys(AGENT_BUSINESS_TOOLS)
}
