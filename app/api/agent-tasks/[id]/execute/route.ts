import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { executeAgentWithTools } from '@/lib/agent/executor'
import { handleAgentCompletion } from '@/lib/agent/chain-orchestrator'
import { saveResultToDocument } from '@/lib/agent/document-saver'
import type { DeployedAgent, AgentTask } from '@/types/database'

// POST: Execute an agent task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { project_task_id, project_id: directProjectId } = body

    // Get the agent task
    const { data: agentTask, error: taskError } = await (adminClient as any)
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (taskError || !agentTask) {
      return NextResponse.json({ error: '태스크를 찾을 수 없습니다' }, { status: 404 })
    }

    // Get the agent
    const { data: agent, error: agentError } = await (adminClient as any)
      .from('deployed_agents')
      .select('*')
      .eq('id', agentTask.assignee_agent_id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: '에이전트를 찾을 수 없습니다' }, { status: 404 })
    }

    // Update status to IN_PROGRESS
    await (adminClient as any)
      .from('agent_tasks')
      .update({
        status: 'IN_PROGRESS',
        started_at: new Date().toISOString()
      })
      .eq('id', taskId)

    // Update project task if provided
    if (project_task_id) {
      await (adminClient as any)
        .from('project_tasks')
        .update({
          status: 'IN_PROGRESS',
          agent_executed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', project_task_id)
    }

    // Execute the task with MCP tools
    const result = await executeAgentWithTools(agent as DeployedAgent, agentTask as AgentTask)

    // Update agent task with result
    await (adminClient as any)
      .from('agent_tasks')
      .update({
        status: result.success ? 'COMPLETED' : 'FAILED',
        result: result.output,
        error: result.error || null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId)

    // Update project task with result if provided
    if (project_task_id) {
      const projectTaskUpdate: Record<string, unknown> = {
        agent_result: {
          output: result.output,
          executed_at: new Date().toISOString(),
          success: result.success,
          sources: result.sources || [],
          toolsUsed: result.toolsUsed || [],
        },
        updated_at: new Date().toISOString(),
      }

      if (result.success) {
        projectTaskUpdate.status = 'REVIEW'
      } else {
        projectTaskUpdate.agent_error = result.error
      }

      await (adminClient as any)
        .from('project_tasks')
        .update(projectTaskUpdate)
        .eq('id', project_task_id)
    }

    // Get updated task
    const { data: updatedTask } = await (adminClient as any)
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    // 📄 결과물을 프로젝트 문서로 저장
    let documentSaveResult = null
    if (result.success) {
      // Get project_id - from direct param, project_task, or task metadata
      let projectIdForDoc = directProjectId || null

      if (!projectIdForDoc && project_task_id) {
        const { data: projectTask } = await (adminClient as any)
          .from('project_tasks')
          .select('project_id')
          .eq('id', project_task_id)
          .single()
        projectIdForDoc = projectTask?.project_id
      }

      documentSaveResult = await saveResultToDocument({
        agent: agent as DeployedAgent,
        task: { ...agentTask, project_id: projectIdForDoc } as AgentTask,
        result,
        projectId: projectIdForDoc || undefined,
        existingProjectTaskId: project_task_id || undefined,
      })

      if (documentSaveResult.success) {
        console.log(`📄 Document saved: ${documentSaveResult.documentId}`)
      }
    }

    // 🔗 에이전트 체이닝: 성공 시 다음 에이전트로 자동 전달
    let chainTriggerResult = null
    if (result.success && agent.next_agent_id) {
      console.log(`🔗 Checking chain trigger for agent: ${agent.name}`)
      chainTriggerResult = await handleAgentCompletion(
        agent.id,
        taskId,
        result,
        agentTask.chain_run_id ? {
          chainRunId: agentTask.chain_run_id,
          previousOutput: agentTask.previous_agent_output?.output,
          stepIndex: (agentTask.previous_agent_output ? 1 : 0),
        } : undefined
      )

      if (chainTriggerResult.triggered) {
        console.log(`✅ Next agent triggered: ${chainTriggerResult.nextTaskId}`)
      }
    }

    return NextResponse.json({
      ...(updatedTask || {}),
      execution_result: result,
      chain_triggered: chainTriggerResult?.triggered || false,
      next_task_id: chainTriggerResult?.nextTaskId,
      document_saved: documentSaveResult?.success || false,
      document_id: documentSaveResult?.documentId || null,
    })
  } catch (error) {
    console.error('Task execute error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
