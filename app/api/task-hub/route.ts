// @ts-nocheck
import { NextRequest } from 'next/server'
import {
  getSupabaseClient,
  apiResponse,
  apiError,
  parsePaginationParams,
  getCurrentCompanyId,
} from '@/lib/erp/api-utils'
import type {
  Task,
  TaskWithDetails,
  CreateTaskRequest,
  TaskFilters,
  TaskStatus,
  TaskPriority,
} from '@/types/task-hub'

// DEV 모드 설정
const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true'
const DEV_USER_ID = process.env.DEV_USER_ID || '00000000-0000-0000-0000-000000000001'

// project_tasks 상태를 Task Hub 상태로 매핑
const STATUS_MAP: Record<string, TaskStatus> = {
  'BACKLOG': 'BACKLOG',
  'TODO': 'TODO',
  'IN_PROGRESS': 'IN_PROGRESS',
  'REVIEW': 'IN_REVIEW',
  'DONE': 'DONE',
  'CANCELLED': 'CANCELLED',
}

// Task Hub 상태를 project_tasks 상태로 역매핑
const REVERSE_STATUS_MAP: Record<TaskStatus, string> = {
  'BACKLOG': 'BACKLOG',
  'TODO': 'TODO',
  'IN_PROGRESS': 'IN_PROGRESS',
  'IN_REVIEW': 'REVIEW',
  'DONE': 'DONE',
  'CANCELLED': 'CANCELLED',
}

// project_tasks를 TaskWithDetails로 변환
function mapProjectTaskToTask(pt: any): TaskWithDetails {
  return {
    id: pt.id,
    title: pt.title,
    description: pt.description,
    status: STATUS_MAP[pt.status] || 'TODO',
    priority: pt.priority || 'MEDIUM',
    type: 'PROJECT',
    company_id: null,
    project_id: pt.project_id,
    parent_task_id: null,
    assignee_id: pt.assignee_agent_id || pt.assignee_user_id,
    assignee_type: pt.assignee_type === 'agent' ? 'AGENT' : 'USER',
    created_by: pt.created_by || DEV_USER_ID,
    created_by_type: 'USER',
    due_date: pt.due_date,
    start_date: pt.start_date,
    completed_at: pt.completed_at,
    estimated_hours: pt.estimated_hours,
    actual_hours: pt.actual_hours,
    tags: pt.tags || [],
    labels: [],
    position: pt.position || 0,
    metadata: {
      agent_result: pt.agent_result,
      category: pt.category,
    },
    source: 'MANUAL',
    source_id: null,
    created_at: pt.created_at,
    updated_at: pt.updated_at,
    project_name: pt.project?.name,
  }
}

// ============================================
// GET: Task 목록 조회 (project_tasks 테이블 사용)
// ============================================
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    const { searchParams } = new URL(request.url)

    // 페이지네이션
    const { page, limit, sort_by, sort_order } = parsePaginationParams(searchParams)
    const from = (page - 1) * limit
    const to = from + limit - 1

    // 필터 파라미터
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const assignee_id = searchParams.get('assignee_id')
    const project_id = searchParams.get('project_id')
    const search = searchParams.get('search')
    const tags = searchParams.get('tags')
    const due_date_from = searchParams.get('due_date_from')
    const due_date_to = searchParams.get('due_date_to')
    const view = searchParams.get('view') // 'kanban' | 'list' | 'calendar'

    // 기본 쿼리 - project_tasks 테이블 사용
    let query = supabase
      .from('project_tasks')
      .select('*, project:projects(name)', { count: 'exact' })

    // 상태 필터 (Task Hub 상태를 project_tasks 상태로 변환)
    if (status) {
      const statuses = status.split(',') as TaskStatus[]
      const mappedStatuses = statuses.map(s => REVERSE_STATUS_MAP[s]).filter(Boolean)
      if (mappedStatuses.length === 1) {
        query = query.eq('status', mappedStatuses[0])
      } else if (mappedStatuses.length > 1) {
        query = query.in('status', [...new Set(mappedStatuses)])
      }
    }

    // 우선순위 필터
    if (priority) {
      const priorities = priority.split(',') as TaskPriority[]
      if (priorities.length === 1) {
        query = query.eq('priority', priorities[0])
      } else {
        query = query.in('priority', priorities)
      }
    }

    // 담당자 필터
    if (assignee_id) {
      query = query.or(`assignee_user_id.eq.${assignee_id},assignee_agent_id.eq.${assignee_id}`)
    }

    // 프로젝트 필터
    if (project_id) {
      query = query.eq('project_id', project_id)
    }

    // 태그 필터
    if (tags) {
      const tagList = tags.split(',')
      query = query.overlaps('tags', tagList)
    }

    // 마감일 범위 필터
    if (due_date_from) {
      query = query.gte('due_date', due_date_from)
    }
    if (due_date_to) {
      query = query.lte('due_date', due_date_to)
    }

    // 검색 (제목, 설명)
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // 정렬
    if (view === 'kanban') {
      query = query
        .order('status', { ascending: true })
        .order('position', { ascending: true })
    } else {
      const validSortFields = ['created_at', 'updated_at', 'due_date', 'priority', 'position', 'title']
      const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at'
      query = query.order(sortField, { ascending: sort_order === 'asc' })
    }

    // 페이지네이션
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('[TaskHub] GET error:', error)
      return apiError(error.message, 500)
    }

    // project_tasks를 TaskWithDetails 형식으로 변환
    const mappedData = (data || []).map(mapProjectTaskToTask)

    return apiResponse({
      data: mappedData,
      total: count || 0,
      page,
      limit,
    })
  } catch (error) {
    console.error('[TaskHub] GET exception:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

// ============================================
// POST: Task 생성 (project_tasks 테이블 사용)
// ============================================
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    const body: CreateTaskRequest = await request.json()

    // 필수 필드 검증
    if (!body.title?.trim()) {
      return apiError('제목은 필수입니다.', 400)
    }

    // 프로젝트 ID 필수 (project_tasks 테이블)
    let project_id = body.project_id
    if (!project_id) {
      // 기본 프로젝트 조회
      const { data: defaultProject } = await supabase
        .from('projects')
        .select('id')
        .limit(1)
        .single()

      if (defaultProject) {
        project_id = defaultProject.id
      } else {
        return apiError('프로젝트를 선택해주세요.', 400)
      }
    }

    // 생성자 ID
    const created_by = DEV_MODE ? DEV_USER_ID : body.metadata?.user_id as string

    // 같은 프로젝트의 Task 중 최대 position 조회
    const { data: maxPosData } = await supabase
      .from('project_tasks')
      .select('position')
      .eq('project_id', project_id)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const newPosition = (maxPosData?.position ?? -1) + 1

    // Task Hub 상태를 project_tasks 상태로 변환
    const mappedStatus = REVERSE_STATUS_MAP[body.status || 'TODO'] || 'TODO'

    // project_tasks 데이터 준비
    const taskData: Record<string, unknown> = {
      title: body.title.trim(),
      description: body.description?.trim() || null,
      status: mappedStatus,
      priority: body.priority || 'MEDIUM',
      project_id,
      position: newPosition,
      due_date: body.due_date || null,
      start_date: body.start_date || null,
      estimated_hours: body.estimated_hours || null,
      tags: body.tags || [],
      category: body.metadata?.category || null,
      created_by: created_by || null,
    }

    // 담당자 설정
    if (body.assignee_id) {
      if (body.assignee_type === 'AGENT') {
        taskData.assignee_type = 'agent'
        taskData.assignee_agent_id = body.assignee_id
        taskData.assignee_user_id = null
      } else {
        taskData.assignee_type = 'user'
        taskData.assignee_user_id = body.assignee_id
        taskData.assignee_agent_id = null
      }
    }

    // Task 생성
    const { data: task, error } = await supabase
      .from('project_tasks')
      .insert(taskData)
      .select('*, project:projects(name)')
      .single()

    if (error) {
      console.error('[TaskHub] POST error:', error)
      return apiError(error.message, 500)
    }

    // 변환 후 반환
    const mappedTask = mapProjectTaskToTask(task)

    return apiResponse(mappedTask, 201)
  } catch (error) {
    console.error('[TaskHub] POST exception:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
