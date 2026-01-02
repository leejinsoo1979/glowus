// @ts-nocheck
// TODO: unified_tasks, task_activities 테이블 타입 생성 후 제거
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiResponse, apiError } from '@/lib/erp/api-utils'
import type { TaskStatus, TaskPriority, CreateTaskRequest } from '@/types/task-hub'

/**
 * Agent Task Hub API
 * Agent가 Task를 생성/조회/수정할 수 있는 전용 API
 */

// ============================================
// GET: Agent가 할당받은 Task 조회
// ============================================
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)

    const agent_id = searchParams.get('agent_id')
    const status = searchParams.get('status')
    const include_created = searchParams.get('include_created') === 'true'

    if (!agent_id) {
      return apiError('agent_id가 필요합니다.', 400)
    }

    // Agent에게 할당된 Task 조회
    let query = supabase
      .from('task_hub_view')
      .select('*')
      .eq('assignee_id', agent_id)
      .eq('assignee_type', 'AGENT')

    if (status) {
      const statuses = status.split(',') as TaskStatus[]
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0])
      } else {
        query = query.in('status', statuses)
      }
    } else {
      // 기본: 완료/취소 제외
      query = query.not('status', 'in', '("DONE","CANCELLED")')
    }

    query = query.order('priority', { ascending: false })
      .order('due_date', { ascending: true, nullsFirst: false })

    const { data: assignedTasks, error } = await query

    if (error) {
      console.error('[TaskHub Agent] GET assigned error:', error)
      return apiError(error.message, 500)
    }

    // Agent가 생성한 Task도 포함
    let createdTasks: any[] = []
    if (include_created) {
      const { data, error: createdError } = await supabase
        .from('task_hub_view')
        .select('*')
        .eq('created_by', agent_id)
        .eq('created_by_type', 'AGENT')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!createdError && data) {
        createdTasks = data
      }
    }

    return apiResponse({
      assigned: assignedTasks || [],
      created: createdTasks,
      total_assigned: assignedTasks?.length || 0,
      total_created: createdTasks.length,
    })
  } catch (error) {
    console.error('[TaskHub Agent] GET exception:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

// ============================================
// POST: Agent가 Task 생성
// ============================================
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()

    const {
      agent_id,           // 생성하는 Agent ID (필수)
      title,              // Task 제목 (필수)
      description,
      status = 'TODO',
      priority = 'MEDIUM',
      type = 'AGENT',
      company_id,
      project_id,
      parent_task_id,
      assignee_id,        // 담당자 (User ID 또는 Agent ID)
      assignee_type = 'USER',  // 'USER' | 'AGENT'
      due_date,
      estimated_hours,
      tags = [],
      metadata = {},
      source = 'CONVERSATION',  // Agent는 주로 대화에서 생성
      source_id,          // conversation_id 등
    } = body

    // 필수 필드 검증
    if (!agent_id) {
      return apiError('agent_id가 필요합니다.', 400)
    }
    if (!title?.trim()) {
      return apiError('title이 필요합니다.', 400)
    }

    // Agent 존재 확인
    const { data: agent, error: agentError } = await supabase
      .from('deployed_agents')
      .select('id, name, owner_id')
      .eq('id', agent_id)
      .single() as { data: { id: string; name: string; owner_id: string } | null; error: any }

    if (agentError || !agent) {
      return apiError('Agent를 찾을 수 없습니다.', 404)
    }

    // 같은 상태의 Task 중 최대 position 조회
    const { data: maxPosData } = await supabase
      .from('unified_tasks')
      .select('position')
      .eq('status', status)
      .eq('company_id', company_id || '')
      .order('position', { ascending: false })
      .limit(1)
      .single() as { data: { position: number } | null }

    const newPosition = (maxPosData?.position ?? -1) + 1

    // Task 데이터 준비
    const taskData = {
      title: title.trim(),
      description: description?.trim() || null,
      status,
      priority,
      type,
      company_id: company_id || null,
      project_id: project_id || null,
      parent_task_id: parent_task_id || null,
      assignee_id: assignee_id || null,
      assignee_type: assignee_id ? assignee_type : 'USER',
      created_by: agent_id,
      created_by_type: 'AGENT',
      due_date: due_date || null,
      estimated_hours: estimated_hours || null,
      tags,
      labels: [],
      position: newPosition,
      metadata: {
        ...metadata,
        created_by_agent_name: agent.name,
      },
      source,
      source_id: source_id || null,
    }

    // Task 생성 (테이블 타입 미생성)
    const { data: task, error: taskError } = await (supabase as any)
      .from('unified_tasks')
      .insert(taskData)
      .select()
      .single()

    if (taskError) {
      console.error('[TaskHub Agent] POST error:', taskError)
      return apiError(taskError.message, 500)
    }

    // 활동 로그 생성
    await (supabase as any).from('task_activities').insert({
      task_id: task.id,
      action: 'CREATED',
      actor_id: agent_id,
      actor_type: 'AGENT',
      comment: `${agent.name}이(가) Task를 생성했습니다.`,
    })

    return apiResponse(task, 201)
  } catch (error) {
    console.error('[TaskHub Agent] POST exception:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

// ============================================
// PATCH: Agent가 Task 상태 업데이트
// ============================================
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()

    const {
      agent_id,     // 업데이트하는 Agent ID (필수)
      task_id,      // 업데이트할 Task ID (필수)
      status,
      progress,     // 진행률 (0-100)
      result,       // 작업 결과
      error: taskError,  // 에러 메시지
      actual_hours,
      metadata,
    } = body

    if (!agent_id || !task_id) {
      return apiError('agent_id와 task_id가 필요합니다.', 400)
    }

    // Task 존재 및 권한 확인
    const { data: existingTask, error: fetchError } = await supabase
      .from('unified_tasks')
      .select('*')
      .eq('id', task_id)
      .single()

    if (fetchError || !existingTask) {
      return apiError('Task를 찾을 수 없습니다.', 404)
    }

    // Agent가 담당자이거나 생성자인 경우만 수정 가능
    const isAssignee = existingTask.assignee_id === agent_id && existingTask.assignee_type === 'AGENT'
    const isCreator = existingTask.created_by === agent_id && existingTask.created_by_type === 'AGENT'

    if (!isAssignee && !isCreator) {
      return apiError('이 Task를 수정할 권한이 없습니다.', 403)
    }

    // 업데이트 필드 준비
    const updateFields: Record<string, unknown> = {}

    if (status) updateFields.status = status
    if (actual_hours !== undefined) updateFields.actual_hours = actual_hours

    // 메타데이터에 진행 정보 추가
    const newMetadata = {
      ...existingTask.metadata,
      ...metadata,
    }

    if (progress !== undefined) {
      newMetadata.progress = progress
      newMetadata.last_progress_update = new Date().toISOString()
    }

    if (result) {
      newMetadata.result = result
      newMetadata.result_at = new Date().toISOString()
    }

    if (taskError) {
      newMetadata.error = taskError
      newMetadata.error_at = new Date().toISOString()
    }

    updateFields.metadata = newMetadata

    // Task 업데이트
    const { data: updatedTask, error: updateError } = await supabase
      .from('unified_tasks')
      .update(updateFields)
      .eq('id', task_id)
      .select()
      .single()

    if (updateError) {
      console.error('[TaskHub Agent] PATCH error:', updateError)
      return apiError(updateError.message, 500)
    }

    // 활동 로그
    if (status && status !== existingTask.status) {
      await supabase.from('task_activities').insert({
        task_id,
        action: 'STATUS_CHANGED',
        actor_id: agent_id,
        actor_type: 'AGENT',
        field_name: 'status',
        old_value: existingTask.status,
        new_value: status,
      })
    }

    return apiResponse(updatedTask)
  } catch (error) {
    console.error('[TaskHub Agent] PATCH exception:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
