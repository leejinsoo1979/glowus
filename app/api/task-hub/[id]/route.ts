// @ts-nocheck
import { NextRequest } from 'next/server'
import {
  getSupabaseClient,
  apiResponse,
  apiError,
} from '@/lib/erp/api-utils'
import type { UpdateTaskRequest, TaskStatus } from '@/types/task-hub'

// DEV 모드 설정
const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true'
const DEV_USER_ID = process.env.DEV_USER_ID || '00000000-0000-0000-0000-000000000001'

// Task Hub 상태를 project_tasks 상태로 역매핑
const REVERSE_STATUS_MAP: Record<TaskStatus, string> = {
  'BACKLOG': 'BACKLOG',
  'TODO': 'TODO',
  'IN_PROGRESS': 'IN_PROGRESS',
  'IN_REVIEW': 'REVIEW',
  'DONE': 'DONE',
  'CANCELLED': 'CANCELLED',
}

// project_tasks 상태를 Task Hub 상태로 매핑
const STATUS_MAP: Record<string, TaskStatus> = {
  'BACKLOG': 'BACKLOG',
  'TODO': 'TODO',
  'IN_PROGRESS': 'IN_PROGRESS',
  'REVIEW': 'IN_REVIEW',
  'DONE': 'DONE',
  'CANCELLED': 'CANCELLED',
}

// ============================================
// GET: 단일 Task 조회
// ============================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabaseClient()

    // Task 조회 (project_tasks 테이블 사용)
    const { data: task, error } = await supabase
      .from('project_tasks')
      .select('*, project:projects(name)')
      .eq('id', id)
      .single()

    if (error || !task) {
      return apiError('Task를 찾을 수 없습니다.', 404)
    }

    // Task Hub 형식으로 매핑
    const mappedTask = {
      ...task,
      status: STATUS_MAP[task.status] || 'TODO',
      project_name: task.project?.name,
    }

    return apiResponse(mappedTask)
  } catch (error) {
    console.error('[TaskHub] GET single error:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

// ============================================
// PATCH: Task 수정
// ============================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabaseClient()
    const body: UpdateTaskRequest = await request.json()

    // 기존 Task 조회 (project_tasks 테이블)
    const { data: existingTask, error: fetchError } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existingTask) {
      return apiError('Task를 찾을 수 없습니다.', 404)
    }

    // 수정 가능한 필드만 추출
    const updateFields: Record<string, unknown> = {}
    const allowedFields = [
      'title', 'description', 'priority',
      'project_id', 'due_date', 'start_date', 'estimated_hours', 'actual_hours',
      'tags', 'position', 'category'
    ]

    allowedFields.forEach(field => {
      if (body[field as keyof UpdateTaskRequest] !== undefined) {
        updateFields[field] = body[field as keyof UpdateTaskRequest]
      }
    })

    // 상태 변경 처리 (Task Hub 상태를 project_tasks 상태로 변환)
    if (body.status) {
      const mappedStatus = REVERSE_STATUS_MAP[body.status as TaskStatus]
      if (mappedStatus) {
        updateFields.status = mappedStatus
      }
    }

    // 담당자 변경 처리
    if (body.assignee_id !== undefined) {
      if (body.assignee_type === 'AGENT') {
        updateFields.assignee_type = 'agent'
        updateFields.assignee_agent_id = body.assignee_id
        updateFields.assignee_user_id = null
      } else {
        updateFields.assignee_type = 'user'
        updateFields.assignee_user_id = body.assignee_id
        updateFields.assignee_agent_id = null
      }
    }

    // 빈 객체면 수정할 것 없음
    if (Object.keys(updateFields).length === 0) {
      return apiResponse(existingTask)
    }

    // 상태 변경 시 position 조정
    if (updateFields.status && updateFields.status !== existingTask.status) {
      const { data: maxPosData } = await supabase
        .from('project_tasks')
        .select('position')
        .eq('status', updateFields.status as string)
        .eq('project_id', existingTask.project_id)
        .order('position', { ascending: false })
        .limit(1)
        .single()

      updateFields.position = (maxPosData?.position ?? -1) + 1
    }

    // Task 수정
    const { data: updatedTask, error: updateError } = await supabase
      .from('project_tasks')
      .update(updateFields)
      .eq('id', id)
      .select('*, project:projects(name)')
      .single()

    if (updateError) {
      console.error('[TaskHub] PATCH error:', updateError)
      return apiError(updateError.message, 500)
    }

    // 매핑된 응답 반환
    const mappedTask = {
      ...updatedTask,
      status: STATUS_MAP[updatedTask.status] || 'TODO',
      project_name: updatedTask.project?.name,
    }

    return apiResponse(mappedTask)
  } catch (error) {
    console.error('[TaskHub] PATCH exception:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

// ============================================
// DELETE: Task 삭제
// ============================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabaseClient()

    // Task 존재 확인 (project_tasks 테이블)
    const { data: existingTask, error: fetchError } = await supabase
      .from('project_tasks')
      .select('id, title')
      .eq('id', id)
      .single()

    if (fetchError || !existingTask) {
      return apiError('Task를 찾을 수 없습니다.', 404)
    }

    // Task 삭제
    const { error: deleteError } = await supabase
      .from('project_tasks')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[TaskHub] DELETE error:', deleteError)
      return apiError(deleteError.message, 500)
    }

    return apiResponse({ message: 'Task가 삭제되었습니다.', id })
  } catch (error) {
    console.error('[TaskHub] DELETE exception:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
