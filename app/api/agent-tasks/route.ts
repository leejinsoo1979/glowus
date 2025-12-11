import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import type { DeployedAgent, AgentTask } from '@/types/database'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// GET: List agent tasks
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agent_id')
    const status = searchParams.get('status')

    // Get all agents owned by user
    const { data: userAgents } = await (supabase as any)
      .from('deployed_agents')
      .select('id')
      .eq('owner_id', user.id)

    if (!userAgents || userAgents.length === 0) {
      return NextResponse.json([])
    }

    const agentIds = userAgents.map((a: any) => a.id)

    let query = (supabase as any)
      .from('agent_tasks')
      .select(`
        *,
        assignee:deployed_agents!assignee_agent_id(id, name, avatar_url),
        assigner_agent:deployed_agents!assigner_agent_id(id, name, avatar_url)
      `)
      .in('assignee_agent_id', agentIds)
      .order('created_at', { ascending: false })

    if (agentId) {
      query = query.eq('assignee_agent_id', agentId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('업무 조회 오류:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('업무 API 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// POST: Assign a task to an agent
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      description,
      instructions,
      assignee_agent_id,
      assigner_agent_id,
      conversation_id,
      startup_id,
      auto_execute = true,
    } = body

    if (!title || !instructions || !assignee_agent_id) {
      return NextResponse.json(
        { error: 'title, instructions, assignee_agent_id가 필요합니다' },
        { status: 400 }
      )
    }

    // Verify assignee agent exists and belongs to user
    const { data: assigneeAgent } = await (supabase as any)
      .from('deployed_agents')
      .select('*')
      .eq('id', assignee_agent_id)
      .eq('owner_id', user.id)
      .single()

    if (!assigneeAgent) {
      return NextResponse.json(
        { error: '에이전트를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // If assigner is an agent, verify it exists
    let assignerAgent: DeployedAgent | null = null
    if (assigner_agent_id) {
      const { data } = await (supabase as any)
        .from('deployed_agents')
        .select('*')
        .eq('id', assigner_agent_id)
        .eq('owner_id', user.id)
        .single()
      assignerAgent = data
    }

    // Create the task
    const taskData = {
      title,
      description: description || null,
      instructions,
      assigner_type: assigner_agent_id ? 'AGENT' : 'USER',
      assigner_user_id: assigner_agent_id ? null : user.id,
      assigner_agent_id: assigner_agent_id || null,
      assignee_agent_id,
      status: 'PENDING',
      conversation_id: conversation_id || null,
      startup_id: startup_id || null,
    }

    const { data: task, error: taskError } = await (supabase as any)
      .from('agent_tasks')
      .insert(taskData)
      .select()
      .single()

    if (taskError) {
      console.error('업무 생성 오류:', taskError)
      return NextResponse.json({ error: taskError.message }, { status: 500 })
    }

    // Auto-execute if requested
    if (auto_execute) {
      // Update status to IN_PROGRESS
      await (supabase as any)
        .from('agent_tasks')
        .update({ status: 'IN_PROGRESS', started_at: new Date().toISOString() })
        .eq('id', task.id)

      // Execute the task
      const result = await executeAgentTask(
        assigneeAgent as DeployedAgent,
        task as AgentTask,
        assignerAgent as DeployedAgent | null
      )

      // Update task with result
      await (supabase as any)
        .from('agent_tasks')
        .update({
          status: result.success ? 'COMPLETED' : 'FAILED',
          result: result.output,
          error: result.error || null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', task.id)

      // If there's a conversation, add the result as a message
      if (conversation_id) {
        const taskMessage = {
          conversation_id,
          sender_type: 'AGENT',
          sender_user_id: null,
          sender_agent_id: assignee_agent_id,
          receiver_type: assigner_agent_id ? 'AGENT' : 'USER',
          receiver_user_id: assigner_agent_id ? null : user.id,
          receiver_agent_id: assigner_agent_id || null,
          message_type: assigner_agent_id ? 'AGENT_TO_AGENT' : 'AGENT_TO_USER',
          content: `[작업 완료: ${title}]\n\n${result.output}`,
          metadata: { task_id: task.id, task_result: result.success },
          task_id: task.id,
        }

        await (supabase as any).from('agent_messages').insert(taskMessage)
      }

      // Return updated task
      const { data: updatedTask } = await (supabase as any)
        .from('agent_tasks')
        .select('*')
        .eq('id', task.id)
        .single()

      return NextResponse.json(updatedTask, { status: 201 })
    }

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('업무 할당 API 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// Helper: Execute an agent task
async function executeAgentTask(
  agent: DeployedAgent,
  task: AgentTask,
  assignerAgent: DeployedAgent | null
): Promise<{ success: boolean; output: string; error?: string }> {
  const systemPrompt = `${agent.system_prompt || `당신은 ${agent.name}입니다.`}

현재 업무를 수행 중입니다:
- 제목: ${task.title}
- 설명: ${task.description || '없음'}
- 지시사항: ${task.instructions}
${assignerAgent ? `- 할당자: ${assignerAgent.name} (AI 에이전트)` : '- 할당자: 사용자'}

업무를 완료하고 결과를 보고해주세요.`

  try {
    const completion = await openai.chat.completions.create({
      model: agent.model || 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: task.instructions },
      ],
      temperature: agent.temperature || 0.7,
      max_tokens: 2000,
    })

    const output = completion.choices[0]?.message?.content || '작업을 완료했습니다.'

    return {
      success: true,
      output,
    }
  } catch (error) {
    console.error('업무 실행 오류:', error)
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    }
  }
}
