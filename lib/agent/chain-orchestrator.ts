/**
 * Agent Chain Orchestrator
 * 에이전트 완전체들 간의 자동 업무 전달 시스템
 *
 * 개념: 각 에이전트는 완전한 기능 단위 (자료수집, 분석, 리포트 등 모두 가능)
 * 이 완전체들이 n8n 스타일로 연결되어 자동으로 다음 에이전트에게 결과를 전달
 */

import { createClient } from '@supabase/supabase-js'
import { executeAgentWithTools, ExecutionResult } from './executor'
import type { DeployedAgent, AgentTask, ChainConfig, ChainRun, ChainStepResult } from '@/types/database'

// Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface ChainExecutionContext {
  chainRunId?: string
  previousOutput?: string
  previousSources?: string[]
  previousToolsUsed?: string[]
  stepIndex: number
}

/**
 * 에이전트 작업 완료 후 다음 에이전트로 자동 전달
 */
export async function handleAgentCompletion(
  completedAgentId: string,
  taskId: string,
  result: ExecutionResult,
  context?: ChainExecutionContext
): Promise<{ triggered: boolean; nextTaskId?: string; error?: string }> {
  try {
    // 1. 완료된 에이전트 정보 조회
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('deployed_agents')
      .select('*, next_agent:next_agent_id(*)')
      .eq('id', completedAgentId)
      .single()

    if (agentError || !agent) {
      console.log('Agent not found or no chain config:', completedAgentId)
      return { triggered: false }
    }

    // 2. 다음 에이전트가 있는지 확인
    if (!agent.next_agent_id) {
      console.log('No next agent configured for:', agent.name)

      // 체인 실행 중이었다면 완료 처리
      if (context?.chainRunId) {
        await completeChainRun(context.chainRunId, result.output)
      }

      return { triggered: false }
    }

    // 3. 체인 설정 확인
    const chainConfig: ChainConfig = agent.chain_config || {
      auto_trigger: true,
      input_mapping: 'full',
      delay_seconds: 0,
    }

    // auto_trigger가 false면 자동 실행 안 함
    if (!chainConfig.auto_trigger) {
      console.log('Auto trigger disabled for agent:', agent.name)
      return { triggered: false }
    }

    // 4. 조건부 실행 체크 (있으면)
    if (chainConfig.condition) {
      const shouldTrigger = evaluateCondition(chainConfig.condition, result)
      if (!shouldTrigger) {
        console.log('Condition not met for chain trigger:', chainConfig.condition)
        return { triggered: false }
      }
    }

    // 5. 딜레이 적용 (있으면)
    if (chainConfig.delay_seconds > 0) {
      console.log(`Delaying next agent execution by ${chainConfig.delay_seconds}s`)
      await new Promise(resolve => setTimeout(resolve, chainConfig.delay_seconds * 1000))
    }

    // 6. 다음 에이전트 정보 조회
    const { data: nextAgent, error: nextAgentError } = await supabaseAdmin
      .from('deployed_agents')
      .select('*')
      .eq('id', agent.next_agent_id)
      .single()

    if (nextAgentError || !nextAgent) {
      console.error('Next agent not found:', agent.next_agent_id)
      return { triggered: false, error: 'Next agent not found' }
    }

    // 7. 입력 데이터 매핑
    const inputForNextAgent = mapInputForNextAgent(result, chainConfig, agent.name)

    // 8. 원본 태스크 정보 조회 (프로젝트 ID 등)
    const { data: originalTask } = await supabaseAdmin
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    // 9. 다음 에이전트를 위한 새 태스크 생성
    const { data: newTask, error: taskError } = await supabaseAdmin
      .from('agent_tasks')
      .insert({
        assignee_agent_id: nextAgent.id,
        assigner_type: 'AGENT',
        assigner_agent_id: completedAgentId,
        title: `[체인] ${nextAgent.name} - ${originalTask?.title || '연속 작업'}`,
        description: `이전 에이전트(${agent.name})의 결과를 기반으로 한 연속 작업`,
        instructions: inputForNextAgent,
        status: 'PENDING',
        chain_run_id: context?.chainRunId,
        previous_agent_output: {
          agent_name: agent.name,
          output: result.output,
          sources: result.sources,
          tools_used: result.toolsUsed,
        },
        is_chain_task: true,
      })
      .select()
      .single()

    if (taskError || !newTask) {
      console.error('Failed to create chain task:', taskError)
      return { triggered: false, error: 'Failed to create chain task' }
    }

    // 10. 체인 실행 기록 업데이트 (있으면)
    if (context?.chainRunId) {
      await updateChainRunProgress(context.chainRunId, nextAgent.id, {
        agent_id: agent.id,
        agent_name: agent.name,
        output: result.output,
        sources: result.sources,
        tools_used: result.toolsUsed,
        completed_at: new Date().toISOString(),
      })
    }

    // 11. 자동 실행 트리거
    console.log(`🔗 Chain trigger: ${agent.name} → ${nextAgent.name}`)

    // 비동기로 다음 에이전트 실행 (현재 응답 차단 안 함)
    triggerNextAgentExecution(newTask.id, nextAgent, {
      chainRunId: context?.chainRunId,
      previousOutput: result.output,
      previousSources: result.sources,
      previousToolsUsed: result.toolsUsed,
      stepIndex: (context?.stepIndex || 0) + 1,
    }).catch(err => {
      console.error('Failed to trigger next agent:', err)
    })

    return { triggered: true, nextTaskId: newTask.id }
  } catch (error) {
    console.error('Chain orchestration error:', error)
    return { triggered: false, error: String(error) }
  }
}

/**
 * 체인 실행 시작 (첫 번째 에이전트부터)
 */
export async function startChainExecution(
  chainId: string,
  initialInput: string
): Promise<{ success: boolean; chainRunId?: string; error?: string }> {
  try {
    // 1. 체인 정보 조회
    const { data: chain, error: chainError } = await supabaseAdmin
      .from('agent_chains')
      .select('*, start_agent:start_agent_id(*)')
      .eq('id', chainId)
      .single()

    if (chainError || !chain) {
      return { success: false, error: 'Chain not found' }
    }

    if (!chain.start_agent_id) {
      return { success: false, error: 'No start agent configured' }
    }

    // 2. 체인 실행 기록 생성
    const { data: chainRun, error: runError } = await supabaseAdmin
      .from('chain_runs')
      .insert({
        chain_id: chainId,
        status: 'RUNNING',
        current_agent_id: chain.start_agent_id,
        initial_input: { input: initialInput },
        step_results: [],
      })
      .select()
      .single()

    if (runError || !chainRun) {
      return { success: false, error: 'Failed to create chain run' }
    }

    // 3. 첫 번째 에이전트 태스크 생성
    const startAgent = chain.start_agent as DeployedAgent
    const { data: task, error: taskError } = await supabaseAdmin
      .from('agent_tasks')
      .insert({
        assignee_agent_id: startAgent.id,
        assigner_type: 'USER',
        title: `[체인 시작] ${startAgent.name}`,
        description: chain.description || '체인 실행',
        instructions: initialInput,
        status: 'PENDING',
        chain_run_id: chainRun.id,
        is_chain_task: true,
      })
      .select()
      .single()

    if (taskError || !task) {
      // 롤백
      await supabaseAdmin.from('chain_runs').delete().eq('id', chainRun.id)
      return { success: false, error: 'Failed to create start task' }
    }

    // 4. 첫 번째 에이전트 실행
    triggerNextAgentExecution(task.id, startAgent, {
      chainRunId: chainRun.id,
      stepIndex: 0,
    }).catch(err => {
      console.error('Failed to start chain execution:', err)
    })

    console.log(`🚀 Chain started: ${chain.name} (${chainRun.id})`)
    return { success: true, chainRunId: chainRun.id }
  } catch (error) {
    console.error('Start chain error:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * 다음 에이전트 실행 트리거
 */
async function triggerNextAgentExecution(
  taskId: string,
  agent: DeployedAgent,
  context: ChainExecutionContext
): Promise<void> {
  try {
    // 태스크 상태 업데이트
    await supabaseAdmin
      .from('agent_tasks')
      .update({ status: 'in_progress' })
      .eq('id', taskId)

    // 태스크 정보 조회
    const { data: task } = await supabaseAdmin
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (!task) {
      throw new Error('Task not found')
    }

    // 에이전트 실행
    const result = await executeAgentWithTools(agent, task as AgentTask)

    // 결과 저장
    await supabaseAdmin
      .from('agent_tasks')
      .update({
        status: result.success ? 'completed' : 'failed',
        result: {
          output: result.output,
          sources: result.sources,
          tools_used: result.toolsUsed,
          error: result.error,
        },
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId)

    // 성공하면 다음 에이전트로 전달
    if (result.success) {
      await handleAgentCompletion(agent.id, taskId, result, context)
    } else {
      // 실패하면 체인 실패 처리
      if (context.chainRunId) {
        await failChainRun(context.chainRunId, result.error || 'Agent execution failed')
      }
    }
  } catch (error) {
    console.error('Trigger next agent error:', error)
    if (context.chainRunId) {
      await failChainRun(context.chainRunId, String(error))
    }
  }
}

/**
 * 입력 데이터 매핑
 */
function mapInputForNextAgent(
  result: ExecutionResult,
  config: ChainConfig,
  previousAgentName: string
): string {
  switch (config.input_mapping) {
    case 'summary':
      // 요약만 전달
      const lines = result.output.split('\n')
      const summary = lines.slice(0, Math.min(10, lines.length)).join('\n')
      return `[이전 에이전트 "${previousAgentName}" 결과 요약]\n${summary}\n\n위 내용을 기반으로 작업을 진행하세요.`

    case 'custom':
      // 커스텀 프롬프트 사용
      if (config.custom_prompt) {
        return config.custom_prompt
          .replace('{{output}}', result.output)
          .replace('{{sources}}', result.sources.join(', '))
          .replace('{{agent_name}}', previousAgentName)
      }
      // fallthrough to full

    case 'full':
    default:
      // 전체 결과 전달
      return `[이전 에이전트 "${previousAgentName}" 작업 결과]

${result.output}

---
출처: ${result.sources.length > 0 ? result.sources.join(', ') : '없음'}
사용 도구: ${result.toolsUsed.join(', ')}

위 결과를 기반으로 당신의 업무를 수행하세요.`
  }
}

/**
 * 조건 평가 (간단한 조건문)
 */
function evaluateCondition(condition: string, result: ExecutionResult): boolean {
  // 간단한 조건들
  if (condition === 'success') return result.success
  if (condition === 'has_sources') return result.sources.length > 0
  if (condition === 'has_output') return result.output.length > 100

  // 키워드 포함 체크
  if (condition.startsWith('contains:')) {
    const keyword = condition.replace('contains:', '').trim()
    return result.output.toLowerCase().includes(keyword.toLowerCase())
  }

  // 기본: 항상 실행
  return true
}

/**
 * 체인 실행 진행 상황 업데이트
 */
async function updateChainRunProgress(
  chainRunId: string,
  currentAgentId: string,
  stepResult: ChainStepResult
): Promise<void> {
  const { data: chainRun } = await supabaseAdmin
    .from('chain_runs')
    .select('step_results')
    .eq('id', chainRunId)
    .single()

  const stepResults = [...(chainRun?.step_results || []), stepResult]

  await supabaseAdmin
    .from('chain_runs')
    .update({
      current_agent_id: currentAgentId,
      step_results: stepResults,
    })
    .eq('id', chainRunId)
}

/**
 * 체인 실행 완료
 */
async function completeChainRun(chainRunId: string, finalOutput: string): Promise<void> {
  await supabaseAdmin
    .from('chain_runs')
    .update({
      status: 'COMPLETED',
      final_output: { output: finalOutput },
      completed_at: new Date().toISOString(),
    })
    .eq('id', chainRunId)

  console.log(`✅ Chain run completed: ${chainRunId}`)
}

/**
 * 체인 실행 실패
 */
async function failChainRun(chainRunId: string, error: string): Promise<void> {
  await supabaseAdmin
    .from('chain_runs')
    .update({
      status: 'FAILED',
      error,
      completed_at: new Date().toISOString(),
    })
    .eq('id', chainRunId)

  console.log(`❌ Chain run failed: ${chainRunId} - ${error}`)
}

/**
 * 체인에 속한 에이전트들 조회 (순서대로)
 */
export async function getChainAgents(startAgentId: string): Promise<DeployedAgent[]> {
  const agents: DeployedAgent[] = []
  let currentId: string | null = startAgentId
  const visited = new Set<string>()

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)

    const { data } = await supabaseAdmin
      .from('deployed_agents')
      .select('*')
      .eq('id', currentId)
      .single()

    const agent = data as DeployedAgent | null
    if (agent) {
      agents.push(agent)
      currentId = agent.next_agent_id
    } else {
      break
    }
  }

  return agents
}
