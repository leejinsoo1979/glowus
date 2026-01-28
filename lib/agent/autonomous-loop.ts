/**
 * Autonomous Agent Loop
 *
 * Enables agents to work independently through:
 * Plan → Execute → Verify → Fix → Commit
 *
 * This is the core of truly autonomous AI agents that can:
 * - Plan their own workflows
 * - Execute complex tasks
 * - Verify results and catch errors
 * - Fix issues autonomously
 * - Commit changes to version control
 */

import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { DeployedAgent, AgentTask } from '@/types/database'
import { executeAgentWithTools } from './executor'
import { createAdminClient } from '@/lib/supabase/admin'

export interface AutonomousLoopConfig {
  maxIterations?: number // Max iterations for fix loop (default: 3)
  verificationTimeout?: number // Timeout for verification (default: 30s)
  autoCommit?: boolean // Auto-commit on success (default: true)
  saveToNeuralMap?: boolean // Save results to Neural Map (default: true)
}

export interface AutonomousLoopResult {
  success: boolean
  output: string
  plan?: string
  executionSteps: Array<{
    step: number
    phase: 'plan' | 'execute' | 'verify' | 'fix' | 'commit'
    result: string
    success: boolean
    error?: string
  }>
  finalCommit?: string
  neuralMapNodeId?: string
  error?: string
}

/**
 * Execute agent task with autonomous loop
 */
export async function executeWithAutonomousLoop(
  agent: DeployedAgent,
  task: AgentTask,
  config: AutonomousLoopConfig = {}
): Promise<AutonomousLoopResult> {
  const {
    maxIterations = 3,
    verificationTimeout = 30000,
    autoCommit = true,
    saveToNeuralMap = true,
  } = config

  const executionSteps: AutonomousLoopResult['executionSteps'] = []
  let stepNumber = 0

  try {
    // Phase 1: Plan
    console.log('[Autonomous Loop] Phase 1: Planning...')
    const planResult = await planTask(agent, task)
    executionSteps.push({
      step: ++stepNumber,
      phase: 'plan',
      result: planResult.plan,
      success: planResult.success,
      error: planResult.error,
    })

    if (!planResult.success) {
      return {
        success: false,
        output: '',
        executionSteps,
        error: `Planning failed: ${planResult.error}`,
      }
    }

    // Phase 2: Execute
    console.log('[Autonomous Loop] Phase 2: Executing...')
    const executeResult = await executeTask(agent, task, planResult.plan)
    executionSteps.push({
      step: ++stepNumber,
      phase: 'execute',
      result: executeResult.output,
      success: executeResult.success,
      error: executeResult.error,
    })

    if (!executeResult.success) {
      return {
        success: false,
        output: executeResult.output,
        plan: planResult.plan,
        executionSteps,
        error: `Execution failed: ${executeResult.error}`,
      }
    }

    // Phase 3: Verify (with fix loop)
    console.log('[Autonomous Loop] Phase 3: Verifying...')
    let verifyResult = await verifyExecution(agent, task, executeResult.output)
    executionSteps.push({
      step: ++stepNumber,
      phase: 'verify',
      result: verifyResult.message,
      success: verifyResult.success,
      error: verifyResult.issues?.join(', '),
    })

    // Phase 4: Fix (if needed)
    let fixIterations = 0
    while (!verifyResult.success && fixIterations < maxIterations) {
      console.log(`[Autonomous Loop] Phase 4: Fixing (iteration ${fixIterations + 1}/${maxIterations})...`)

      const fixResult = await fixIssues(agent, task, verifyResult.issues || [])
      executionSteps.push({
        step: ++stepNumber,
        phase: 'fix',
        result: fixResult.output,
        success: fixResult.success,
        error: fixResult.error,
      })

      if (!fixResult.success) {
        break // Cannot fix, stop loop
      }

      // Re-verify after fix
      verifyResult = await verifyExecution(agent, task, fixResult.output)
      executionSteps.push({
        step: ++stepNumber,
        phase: 'verify',
        result: verifyResult.message,
        success: verifyResult.success,
        error: verifyResult.issues?.join(', '),
      })

      fixIterations++
    }

    // Phase 5: Commit (if verification passed and autoCommit enabled)
    let finalCommit: string | undefined
    if (verifyResult.success && autoCommit) {
      console.log('[Autonomous Loop] Phase 5: Committing...')
      const commitResult = await commitChanges(agent, task, executeResult.output)
      executionSteps.push({
        step: ++stepNumber,
        phase: 'commit',
        result: commitResult.message,
        success: commitResult.success,
        error: commitResult.error,
      })
      finalCommit = commitResult.commitHash
    }

    // Save to Neural Map (if enabled)
    let neuralMapNodeId: string | undefined
    if (saveToNeuralMap && verifyResult.success) {
      neuralMapNodeId = await saveResultToNeuralMap(agent, task, executeResult.output)
    }

    return {
      success: verifyResult.success,
      output: executeResult.output,
      plan: planResult.plan,
      executionSteps,
      finalCommit,
      neuralMapNodeId,
    }

  } catch (error) {
    console.error('[Autonomous Loop] Unexpected error:', error)
    return {
      success: false,
      output: '',
      executionSteps,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Phase 1: Plan the task
 */
async function planTask(
  agent: DeployedAgent,
  task: AgentTask
): Promise<{ success: boolean; plan: string; error?: string }> {
  try {
    // Use Gemini 2.0 Flash for cheap planning
    const llm = new ChatOpenAI({
      modelName: 'gemini-2.0-flash',
      temperature: 0.3,
      apiKey: process.env.GOOGLE_API_KEY,
      configuration: { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' },
    })

    const systemPrompt = `You are an autonomous AI agent planner. Break down the task into actionable steps.

Task: ${task.instructions}

Create a detailed execution plan with:
1. Clear steps (numbered)
2. Required tools/resources
3. Expected outcomes
4. Verification criteria

Format:
## Execution Plan
1. [Step description]
   - Tools: [tool1, tool2]
   - Expected: [outcome]

Keep it concise but comprehensive.`

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage('Create the execution plan.'),
    ])

    const plan = response.content.toString()

    return {
      success: true,
      plan,
    }
  } catch (error) {
    console.error('[Plan Phase] Error:', error)
    return {
      success: false,
      plan: '',
      error: error instanceof Error ? error.message : 'Planning failed',
    }
  }
}

/**
 * Phase 2: Execute the task
 */
async function executeTask(
  agent: DeployedAgent,
  task: AgentTask,
  plan: string
): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    // Add plan to task context
    const taskWithPlan = {
      ...task,
      instructions: `${task.instructions}\n\n## Execution Plan:\n${plan}`,
    }

    // Execute with tools (uses agent's configured LLM)
    const result = await executeAgentWithTools(agent, taskWithPlan)

    return {
      success: result.success,
      output: result.output,
      error: result.error,
    }
  } catch (error) {
    console.error('[Execute Phase] Error:', error)
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Execution failed',
    }
  }
}

/**
 * Phase 3: Verify execution results
 */
async function verifyExecution(
  agent: DeployedAgent,
  task: AgentTask,
  output: string
): Promise<{ success: boolean; message: string; issues?: string[] }> {
  try {
    // Use Gemini 2.0 Flash for cheap verification
    const llm = new ChatOpenAI({
      modelName: 'gemini-2.0-flash',
      temperature: 0.1,
      apiKey: process.env.GOOGLE_API_KEY,
      configuration: { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' },
    })

    const systemPrompt = `You are an autonomous AI agent verifier. Verify if the task was completed successfully.

Task: ${task.instructions}

Execution Output:
${output.substring(0, 2000)}${output.length > 2000 ? '...' : ''}

Check for:
1. Task completion (all requirements met)
2. No errors or failures mentioned
3. Expected outputs present
4. Code quality (if applicable)

Respond in JSON format:
{
  "success": true/false,
  "message": "verification summary",
  "issues": ["issue1", "issue2"] // empty array if no issues
}`

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage('Verify the execution results.'),
    ])

    const content = response.content.toString()

    // Try to parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const verification = JSON.parse(jsonMatch[0])
      return {
        success: verification.success,
        message: verification.message,
        issues: verification.issues || [],
      }
    }

    // Fallback: manual parsing
    const success = content.toLowerCase().includes('"success": true')
    return {
      success,
      message: success ? 'Verification passed' : 'Verification failed',
      issues: success ? [] : ['Could not parse verification response'],
    }

  } catch (error) {
    console.error('[Verify Phase] Error:', error)
    return {
      success: false,
      message: 'Verification error',
      issues: [error instanceof Error ? error.message : 'Unknown error'],
    }
  }
}

/**
 * Phase 4: Fix issues autonomously
 */
async function fixIssues(
  agent: DeployedAgent,
  task: AgentTask,
  issues: string[]
): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    // Create fix task
    const fixTask = {
      ...task,
      instructions: `${task.instructions}\n\n## Issues to Fix:\n${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}\n\nFix these issues.`,
    }

    // Execute fix with tools
    const result = await executeAgentWithTools(agent, fixTask)

    return {
      success: result.success,
      output: result.output,
      error: result.error,
    }
  } catch (error) {
    console.error('[Fix Phase] Error:', error)
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Fix failed',
    }
  }
}

/**
 * Phase 5: Commit changes to Git
 */
async function commitChanges(
  agent: DeployedAgent,
  task: AgentTask,
  output: string
): Promise<{ success: boolean; message: string; commitHash?: string; error?: string }> {
  try {
    // Use Gemini to generate commit message
    const llm = new ChatOpenAI({
      modelName: 'gemini-2.0-flash',
      temperature: 0.1,
      apiKey: process.env.GOOGLE_API_KEY,
      configuration: { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' },
    })

    const systemPrompt = `Generate a conventional commit message.

Task: ${task.instructions}
Output: ${output.substring(0, 500)}...

Format: <type>: <description>

Types: feat, fix, docs, style, refactor, test, chore

Example: feat: add user authentication system

Keep it concise (max 72 chars).`

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage('Generate commit message.'),
    ])

    const commitMessage = response.content.toString().trim()

    // TODO: Actually execute git commit via tools
    // For now, just return success with generated message
    console.log(`[Commit Phase] Generated message: ${commitMessage}`)

    return {
      success: true,
      message: commitMessage,
      commitHash: `mock-${Date.now()}`, // Mock commit hash
    }

  } catch (error) {
    console.error('[Commit Phase] Error:', error)
    return {
      success: false,
      message: '',
      error: error instanceof Error ? error.message : 'Commit failed',
    }
  }
}

/**
 * Save execution result to Neural Map
 */
async function saveResultToNeuralMap(
  agent: DeployedAgent,
  task: AgentTask,
  output: string
): Promise<string | undefined> {
  try {
    const adminClient = createAdminClient()

    // Create Neural Map node for this execution
    const nodeData = {
      type: 'agent_execution',
      label: task.title || task.instructions.substring(0, 50),
      content: output,
      metadata: {
        agent_id: agent.id,
        agent_name: agent.name,
        task_id: task.id,
        executed_at: new Date().toISOString(),
      },
    }

    console.log('[Neural Map] Saving execution result...')
    // TODO: Actually save to neural_map_nodes table
    // For now, just log
    console.log('[Neural Map] Node data:', nodeData)

    return `mock-node-${Date.now()}`
  } catch (error) {
    console.error('[Neural Map] Save error:', error)
    return undefined
  }
}
