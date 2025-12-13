import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { AssignTaskInput } from '@/types/database'

// POST: Assign task to human or agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: projectId, taskId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body: AssignTaskInput = await request.json()

    if (!body.assignee_type) {
      return NextResponse.json({ error: '할당 유형(human/agent)이 필요합니다' }, { status: 400 })
    }

    // Validate assignee based on type
    if (body.assignee_type === 'human' && !body.assignee_user_id) {
      return NextResponse.json({ error: '사람에게 할당할 경우 사용자 ID가 필요합니다' }, { status: 400 })
    }

    if (body.assignee_type === 'agent' && !body.assignee_agent_id) {
      return NextResponse.json({ error: '에이전트에게 할당할 경우 에이전트 ID가 필요합니다' }, { status: 400 })
    }

    // Update task with assignment
    const updates: Record<string, unknown> = {
      assignee_type: body.assignee_type,
      assignee_user_id: body.assignee_type === 'human' ? body.assignee_user_id : null,
      assignee_agent_id: body.assignee_type === 'agent' ? body.assignee_agent_id : null,
      updated_at: new Date().toISOString(),
    }

    // If assigning to agent and task is TODO, change to IN_PROGRESS
    if (body.assignee_type === 'agent') {
      const { data: currentTask } = await adminClient
        .from('project_tasks')
        .select('status')
        .eq('id', taskId)
        .single()

      if (currentTask?.status === 'TODO') {
        updates.status = 'IN_PROGRESS'
      }
    }

    const { data: updatedTask, error } = await adminClient
      .from('project_tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('project_id', projectId)
      .select(`
        *,
        assignee_user:users!project_tasks_assignee_user_id_fkey(id, name, email, avatar_url),
        assignee_agent:deployed_agents!project_tasks_assignee_agent_id_fkey(id, name, description, avatar_url, status, capabilities, system_prompt, model)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If auto_execute is true and assigned to agent, trigger execution
    if (body.auto_execute && body.assignee_type === 'agent' && body.assignee_agent_id) {
      try {
        // Create an agent task for execution
        const { data: agentTask, error: taskError } = await adminClient
          .from('agent_tasks')
          .insert({
            title: updatedTask.title,
            description: updatedTask.description,
            instructions: `프로젝트 태스크를 수행해주세요:

제목: ${updatedTask.title}
설명: ${updatedTask.description || '없음'}
우선순위: ${updatedTask.priority}
마감일: ${updatedTask.due_date || '없음'}

태스크를 완료하고 결과를 상세히 보고해주세요.`,
            assigner_type: 'USER',
            assigner_user_id: user.id,
            assignee_agent_id: body.assignee_agent_id,
            status: 'PENDING',
          })
          .select()
          .single()

        if (taskError) {
          console.error('Failed to create agent task:', taskError)
        } else {
          // Trigger agent execution via existing API
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          fetch(`${baseUrl}/api/agent-tasks/${agentTask.id}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_task_id: taskId }),
          }).catch(err => console.error('Agent execution trigger failed:', err))
        }
      } catch (execError) {
        console.error('Auto-execute error:', execError)
        // Don't fail the assignment if auto-execute fails
      }
    }

    return NextResponse.json({
      ...updatedTask,
      auto_execute_triggered: body.auto_execute && body.assignee_type === 'agent',
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// DELETE: Unassign task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: projectId, taskId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { data, error } = await adminClient
      .from('project_tasks')
      .update({
        assignee_type: null,
        assignee_user_id: null,
        assignee_agent_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('project_id', projectId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
