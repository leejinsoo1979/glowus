// @ts-nocheck
// TODO: unified_tasks 테이블 타입 생성 후 제거
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiResponse, apiError } from '@/lib/erp/api-utils'
import {
  parseTaskFromMessage,
  parseTasksFromConversation,
  convertToTaskRequest,
  type ParsedTask,
} from '@/lib/task-hub/conversation-parser'

/**
 * Task Extraction API
 * 대화 내용에서 Task를 자동 추출하고 선택적으로 생성
 */

// ============================================
// POST: 대화에서 Task 추출 (및 선택적 생성)
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      // 단일 메시지 추출
      message,
      // 또는 여러 메시지 추출
      messages,
      // 컨텍스트
      conversation_id,
      agent_id,
      company_id,
      project_id,
      // 옵션
      auto_create = false,  // true면 추출 후 바로 Task 생성
      min_confidence = 0.3,  // 최소 신뢰도
    } = body

    // 입력 검증
    if (!message && (!messages || !Array.isArray(messages))) {
      return apiError('message 또는 messages 배열이 필요합니다.', 400)
    }

    let parsedTasks: ParsedTask[] = []

    // 단일 메시지 처리
    if (message) {
      const parsed = parseTaskFromMessage(message, { agent_id, project_id })
      if (parsed && parsed.confidence >= min_confidence) {
        parsedTasks.push(parsed)
      }
    }

    // 여러 메시지 처리
    if (messages && messages.length > 0) {
      const parsed = parseTasksFromConversation(messages, { agent_id, project_id })
      parsedTasks.push(...parsed.filter(t => t.confidence >= min_confidence))
    }

    // 추출된 Task가 없으면 빈 배열 반환
    if (parsedTasks.length === 0) {
      return apiResponse({
        extracted: [],
        created: [],
        message: 'Task를 추출할 수 없습니다.',
      })
    }

    // 자동 생성 옵션이 활성화된 경우
    const createdTasks: any[] = []

    if (auto_create && agent_id) {
      const supabase = createAdminClient()

      for (const parsed of parsedTasks) {
        // ParsedTask를 CreateTaskRequest로 변환
        const taskRequest = convertToTaskRequest(parsed, {
          company_id,
          project_id,
          created_by: agent_id,
          created_by_type: 'AGENT',
          source_id: conversation_id,
        })

        // 담당자 힌트가 있으면 실제 ID로 변환 시도
        if (parsed.assignee_hint) {
          const assigneeId = await resolveAssigneeId(
            supabase,
            parsed.assignee_hint,
            parsed.assignee_type || 'USER',
            company_id
          )

          if (assigneeId) {
            taskRequest.assignee_id = assigneeId
            taskRequest.assignee_type = parsed.assignee_type
          }
        }

        // 같은 상태의 Task 중 최대 position 조회
        const { data: maxPosData } = await supabase
          .from('unified_tasks')
          .select('position')
          .eq('status', 'TODO')
          .eq('company_id', company_id || '')
          .order('position', { ascending: false })
          .limit(1)
          .single()

        const newPosition = (maxPosData?.position ?? -1) + 1

        // Task 생성
        const { data: task, error } = await supabase
          .from('unified_tasks')
          .insert({
            ...taskRequest,
            position: newPosition,
            created_by_type: 'AGENT',
          })
          .select()
          .single()

        if (!error && task) {
          createdTasks.push(task)

          // 활동 로그
          await supabase.from('task_activities').insert({
            task_id: task.id,
            action: 'CREATED',
            actor_id: agent_id,
            actor_type: 'AGENT',
            comment: `대화에서 자동 추출되어 생성됨 (신뢰도: ${(parsed.confidence * 100).toFixed(0)}%)`,
          })
        }
      }
    }

    return apiResponse({
      extracted: parsedTasks.map(t => ({
        ...t,
        confidence_percent: Math.round(t.confidence * 100),
      })),
      created: createdTasks,
      auto_create,
      total_extracted: parsedTasks.length,
      total_created: createdTasks.length,
    })
  } catch (error) {
    console.error('[TaskHub Extract] POST exception:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

// ============================================
// 담당자 힌트를 실제 ID로 변환
// ============================================
async function resolveAssigneeId(
  supabase: any,
  hint: string,
  type: 'USER' | 'AGENT',
  companyId?: string
): Promise<string | null> {
  try {
    if (type === 'AGENT') {
      // Agent 이름으로 검색
      const agentName = hint.replace(/^(agent-|에이전트-)/i, '')
      const { data } = await supabase
        .from('deployed_agents')
        .select('id')
        .ilike('name', `%${agentName}%`)
        .limit(1)
        .single()

      return data?.id || null
    } else {
      // User (직원) 이름으로 검색
      let query = supabase
        .from('employees')
        .select('user_id')
        .ilike('name', `%${hint}%`)

      if (companyId) {
        query = query.eq('company_id', companyId)
      }

      const { data } = await query.limit(1).single()
      return data?.user_id || null
    }
  } catch {
    return null
  }
}
