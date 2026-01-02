// @ts-nocheck
import { NextRequest } from 'next/server'
import {
  getSupabaseClient,
  apiResponse,
  apiError,
} from '@/lib/erp/api-utils'
import type { TaskStatus } from '@/types/task-hub'

// ============================================
// POST: 일괄 작업 (위치 변경, 상태 변경 등)
// ============================================
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    const body = await request.json()
    const { action, tasks } = body

    if (!action || !tasks || !Array.isArray(tasks)) {
      return apiError('action과 tasks 배열이 필요합니다.', 400)
    }

    switch (action) {
      // ============================================
      // 위치 재정렬 (Kanban 드래그앤드롭)
      // ============================================
      case 'reorder': {
        // tasks: [{ id, status, position }]
        const updates = tasks.map((task: { id: string; status: TaskStatus; position: number }) => {
          return supabase
            .from('unified_tasks')
            .update({
              status: task.status,
              position: task.position,
            })
            .eq('id', task.id)
        })

        await Promise.all(updates)
        return apiResponse({ message: '위치가 업데이트되었습니다.', count: tasks.length })
      }

      // ============================================
      // 일괄 상태 변경
      // ============================================
      case 'update_status': {
        const { status } = body
        if (!status) {
          return apiError('status가 필요합니다.', 400)
        }

        const taskIds = tasks.map((t: { id: string }) => t.id)
        const { error } = await supabase
          .from('unified_tasks')
          .update({ status })
          .in('id', taskIds)

        if (error) {
          return apiError(error.message, 500)
        }

        return apiResponse({ message: '상태가 업데이트되었습니다.', count: taskIds.length })
      }

      // ============================================
      // 일괄 삭제
      // ============================================
      case 'delete': {
        const taskIds = tasks.map((t: { id: string }) => t.id)
        const { error } = await supabase
          .from('unified_tasks')
          .delete()
          .in('id', taskIds)

        if (error) {
          return apiError(error.message, 500)
        }

        return apiResponse({ message: 'Task가 삭제되었습니다.', count: taskIds.length })
      }

      // ============================================
      // 일괄 담당자 할당
      // ============================================
      case 'assign': {
        const { assignee_id, assignee_type } = body
        const taskIds = tasks.map((t: { id: string }) => t.id)

        const { error } = await supabase
          .from('unified_tasks')
          .update({
            assignee_id: assignee_id || null,
            assignee_type: assignee_type || 'USER',
          })
          .in('id', taskIds)

        if (error) {
          return apiError(error.message, 500)
        }

        return apiResponse({ message: '담당자가 할당되었습니다.', count: taskIds.length })
      }

      // ============================================
      // 일괄 우선순위 변경
      // ============================================
      case 'update_priority': {
        const { priority } = body
        if (!priority) {
          return apiError('priority가 필요합니다.', 400)
        }

        const taskIds = tasks.map((t: { id: string }) => t.id)
        const { error } = await supabase
          .from('unified_tasks')
          .update({ priority })
          .in('id', taskIds)

        if (error) {
          return apiError(error.message, 500)
        }

        return apiResponse({ message: '우선순위가 업데이트되었습니다.', count: taskIds.length })
      }

      default:
        return apiError(`알 수 없는 action: ${action}`, 400)
    }
  } catch (error) {
    console.error('[TaskHub] Bulk operation error:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
