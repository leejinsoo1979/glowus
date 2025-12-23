/**
 * NeuraMap Coding Agent API Route
 * Cursor/Claude Code 수준의 코딩 에이전트 실행 엔드포인트
 *
 * Features:
 * - SSE streaming for real-time updates
 * - Real tool execution (file system, terminal, git)
 * - Intelligent context gathering
 * - Agentic Loop: Plan → Modify → Verify → Commit
 */

import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  handleToolCall,
  gatherContext,
  formatContextForLLM,
  CODING_TOOL_DEFINITIONS,
  type ToolCallResult,
} from '@/lib/neural-map/tools'
import type { AgentState, AgentPlan, AgentTask } from '@/lib/neural-map/types'

// ============================================
// SSE Helper
// ============================================

function createSSEStream() {
  let controller: ReadableStreamDefaultController<Uint8Array>
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl
    },
  })

  const send = (type: string, data: unknown) => {
    const event = { type, data, timestamp: Date.now() }
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
  }

  const close = () => {
    try {
      controller.close()
    } catch {
      // Already closed
    }
  }

  return { stream, send, close }
}

// ============================================
// Tool Definitions for Claude
// ============================================

const CLAUDE_TOOLS: Anthropic.Tool[] = CODING_TOOL_DEFINITIONS.map((def) => ({
  name: def.name.replace('.', '_'), // Claude doesn't like dots
  description: def.description,
  input_schema: def.parameters as Anthropic.Tool['input_schema'],
}))

// ============================================
// System Prompts
// ============================================

const CODING_AGENT_SYSTEM = `You are NeuraMap, an advanced AI coding agent that surpasses Cursor and Claude Code.

## Your Capabilities
- Search and analyze codebases using repo.search, repo.read, repo.symbols
- Modify code with surgical precision using repo.patch
- Execute commands, builds, and tests using repo.run
- Manage git operations using repo.git
- Diagnose issues using repo.diagnostics
- Gather intelligent context using context.gather

## Core Principles
1. **Context First**: Always gather sufficient context before making changes
2. **Minimal Changes**: Make the smallest change that solves the problem
3. **Verify Everything**: Test and validate after every modification
4. **Explain Reasoning**: Explain your thought process clearly

## Workflow (Agentic Loop)
1. **PLAN**: Understand the request, gather context, create a structured plan
2. **MODIFY**: Execute the plan with precise code changes
3. **VERIFY**: Build, lint, and test to ensure correctness
4. **COMMIT**: Commit changes with meaningful messages

## Output Format
- Use code blocks with language tags for code
- Use diffs when showing changes: \`\`\`diff
- Structure responses with clear sections
- Show file paths: \`path/to/file.ts:lineNumber\`

## Important Rules
- NEVER hallucinate file contents - always use repo.read first
- ALWAYS show the diff before applying changes
- Check for type errors with repo.diagnostics after modifications
- Explain WHY you're making each change`

const PLAN_SYSTEM = `You are analyzing a coding request to create a structured plan.

Given the user's request and the codebase context, create a plan with:
1. Clear, actionable tasks
2. Files that will be affected
3. Risk assessment for each task
4. Estimated complexity

Respond in this exact JSON format:
{
  "understanding": "Brief summary of what the user wants",
  "tasks": [
    {
      "id": "task-1",
      "description": "What to do",
      "files": ["path/to/file.ts"],
      "estimatedRisk": "low|medium|high",
      "requiredApproval": true|false,
      "reasoning": "Why this task is needed"
    }
  ],
  "commitMessage": "feat|fix|refactor: Short description",
  "dependencies": ["Any external dependencies needed"],
  "warnings": ["Potential issues to watch for"]
}`

// ============================================
// Main Execution Handler
// ============================================

export async function POST(req: NextRequest) {
  const { input, imageDataUrl, state } = (await req.json()) as {
    input: string
    imageDataUrl?: string
    state: AgentState
  }

  // Handle approval signals
  if (input.startsWith('__APPROVAL__:')) {
    const status = input.split(':')[1]
    if (status === 'rejected') {
      return Response.json({ success: true, status: 'rejected' })
    }
    // Continue with approved plan
  }

  const { stream, send, close } = createSSEStream()

  // Process asynchronously
  ;(async () => {
    try {
      const client = new Anthropic()
      const projectPath = state.metadata.projectPath || process.cwd()

      // ============================================
      // Phase 1: PLAN
      // ============================================
      if (input !== '__APPROVAL__:approved' || !state.plan) {
        send('stage_change', { stage: 'plan', previousStage: 'idle' })

        // Step 1.1: Gather context intelligently
        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '🔍 Analyzing codebase and gathering context...',
          timestamp: Date.now(),
        })

        const contextWindow = await gatherContext({
          query: input,
          projectPath,
          currentFile: state.context.files[0]?.path,
          depth: 'medium',
          maxTokens: 80000,
        })

        const contextForLLM = formatContextForLLM(contextWindow)

        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `📊 Context gathered: ${contextWindow.items.length} items, ${contextWindow.totalTokens.toLocaleString()} tokens (${(contextWindow.utilization * 100).toFixed(1)}% utilization)`,
          timestamp: Date.now(),
        })

        // Step 1.2: Generate plan with LLM
        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '🧠 Analyzing request and creating execution plan...',
          timestamp: Date.now(),
        })

        const planMessages: Anthropic.MessageParam[] = [
          {
            role: 'user',
            content: imageDataUrl
              ? [
                  {
                    type: 'image' as const,
                    source: {
                      type: 'base64' as const,
                      media_type: 'image/png' as const,
                      data: imageDataUrl.replace(/^data:image\/\w+;base64,/, ''),
                    },
                  },
                  {
                    type: 'text' as const,
                    text: `User Request: ${input}\n\n${contextForLLM}`,
                  },
                ]
              : `User Request: ${input}\n\n${contextForLLM}`,
          },
        ]

        const planResponse = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: PLAN_SYSTEM,
          messages: planMessages,
        })

        const planContent = planResponse.content[0]
        if (planContent.type !== 'text') {
          throw new Error('Unexpected response type')
        }

        // Parse plan
        const jsonMatch = planContent.text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error('Failed to parse plan')
        }

        const parsed = JSON.parse(jsonMatch[0])
        const tasks: AgentTask[] = parsed.tasks.map((t: any, i: number) => ({
          id: t.id || `task-${i + 1}`,
          description: t.description,
          status: 'pending' as const,
          files: t.files || [],
          estimatedRisk: t.estimatedRisk || 'low',
          requiredApproval: Boolean(t.requiredApproval),
        }))

        const plan: AgentPlan = {
          tasks,
          currentTaskIndex: 0,
          approvalStatus: 'pending',
          commitMessage: parsed.commitMessage || 'chore: Apply changes',
          files: tasks.flatMap((t) => t.files),
          generatedAt: Date.now(),
        }

        send('plan', plan)

        // Send plan summary
        const planSummary = `## 📋 Execution Plan

**Understanding**: ${parsed.understanding}

### Tasks:
${tasks.map((t, i) => `${i + 1}. **${t.description}**
   - Files: ${t.files.join(', ') || 'TBD'}
   - Risk: ${t.estimatedRisk}
   ${t.requiredApproval ? '   - ⚠️ Requires approval' : ''}`).join('\n')}

${parsed.warnings?.length ? `### ⚠️ Warnings:\n${parsed.warnings.map((w: string) => `- ${w}`).join('\n')}` : ''}

**Commit Message**: \`${plan.commitMessage}\`

---
*Please review and click **Approve** to proceed or **Reject** to cancel.*`

        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: planSummary,
          timestamp: Date.now(),
        })

        send('complete', { waitingForApproval: true, plan })
        close()
        return
      }

      // ============================================
      // Phase 2: MODIFY (Approved)
      // ============================================
      send('stage_change', { stage: 'modify', previousStage: 'plan' })

      const currentPlan = state.plan!
      const modifyMessages: Anthropic.MessageParam[] = [...state.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))]

      // Execute each task with agentic loop
      for (let taskIdx = currentPlan.currentTaskIndex; taskIdx < currentPlan.tasks.length; taskIdx++) {
        const task = currentPlan.tasks[taskIdx]

        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `\n## 🔧 Task ${taskIdx + 1}/${currentPlan.tasks.length}: ${task.description}`,
          timestamp: Date.now(),
        })

        // Have Claude execute the task with tools
        const taskMessages: Anthropic.MessageParam[] = [
          ...modifyMessages,
          {
            role: 'user',
            content: `Execute Task ${taskIdx + 1}: ${task.description}\n\nFiles to modify: ${task.files.join(', ')}\n\nUse the available tools to read files, make changes, and verify your work.`,
          },
        ]

        let continueLoop = true
        while (continueLoop) {
          const taskResponse = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8192,
            system: CODING_AGENT_SYSTEM,
            tools: CLAUDE_TOOLS,
            messages: taskMessages,
          })

          // Process response
          for (const block of taskResponse.content) {
            if (block.type === 'text') {
              send('message', {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: block.text,
                timestamp: Date.now(),
              })
              taskMessages.push({ role: 'assistant', content: [block] })
            } else if (block.type === 'tool_use') {
              // Execute tool
              const toolCallId = block.id
              const toolName = block.name.replace('_', '.')
              const toolArgs = block.input as Record<string, unknown>

              send('tool_call', {
                id: toolCallId,
                name: toolName,
                args: toolArgs,
              })

              const toolResult = await handleToolCall({
                name: toolName,
                args: toolArgs,
                projectPath,
              })

              send('tool_result', {
                id: toolCallId,
                name: toolName,
                success: toolResult.success,
                result: toolResult.result,
                error: toolResult.error,
                executionTime: toolResult.executionTime,
              })

              // Add to messages for context
              taskMessages.push({ role: 'assistant', content: [block] })
              taskMessages.push({
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: toolCallId,
                    content: JSON.stringify(toolResult.result),
                  },
                ],
              })
            }
          }

          // Check if we should continue the loop
          if (taskResponse.stop_reason === 'end_turn') {
            continueLoop = false
          } else if (taskResponse.stop_reason !== 'tool_use') {
            continueLoop = false
          }
        }
      }

      // ============================================
      // Phase 3: VERIFY
      // ============================================
      send('stage_change', { stage: 'verify', previousStage: 'modify' })

      send('message', {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '## ✅ Verification Phase\n\nRunning build and type checks...',
        timestamp: Date.now(),
      })

      // Run TypeScript check
      const tscResult = await handleToolCall({
        name: 'repo.diagnostics',
        args: { source: 'typescript' },
        projectPath,
      })

      send('tool_result', {
        id: crypto.randomUUID(),
        name: 'repo.diagnostics',
        success: tscResult.success,
        result: tscResult.result,
        executionTime: tscResult.executionTime,
      })

      const diagnostics = tscResult.result as any
      const hasErrors = diagnostics?.summary?.errors > 0

      if (hasErrors) {
        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `⚠️ **Verification found issues:**\n\nErrors: ${diagnostics.summary.errors}\nWarnings: ${diagnostics.summary.warnings}\n\n${diagnostics.items?.slice(0, 5).map((d: any) => `- ${d.file}:${d.line} - ${d.message}`).join('\n')}`,
          timestamp: Date.now(),
        })

        // In a full implementation, we would loop back to MODIFY here
        send('error', 'Verification failed. Please review the errors.')
        send('complete', { success: false, diagnostics })
        close()
        return
      }

      send('message', {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `✅ **Verification passed!**\n\n- Errors: 0\n- Warnings: ${diagnostics?.summary?.warnings || 0}`,
        timestamp: Date.now(),
      })

      // ============================================
      // Phase 4: COMMIT
      // ============================================
      send('stage_change', { stage: 'commit', previousStage: 'verify' })

      send('message', {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '## 📦 Commit Phase\n\nCreating git commit...',
        timestamp: Date.now(),
      })

      // Git add
      const addResult = await handleToolCall({
        name: 'repo.git',
        args: { command: 'add', args: ['.'] },
        projectPath,
      })

      // Git commit
      const commitResult = await handleToolCall({
        name: 'repo.git',
        args: {
          command: 'commit',
          args: ['-m', currentPlan.commitMessage || 'chore: Apply changes'],
        },
        projectPath,
      })

      if (commitResult.success) {
        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `✅ **Commit successful!**\n\n\`\`\`\n${currentPlan.commitMessage}\n\`\`\``,
          timestamp: Date.now(),
        })
      } else {
        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `ℹ️ No changes to commit or commit skipped.\n\n${(commitResult.result as any)?.error || ''}`,
          timestamp: Date.now(),
        })
      }

      // ============================================
      // Complete
      // ============================================
      send('message', {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `\n---\n\n## 🎉 All tasks completed!\n\n${currentPlan.tasks.map((t, i) => `- [x] Task ${i + 1}: ${t.description}`).join('\n')}`,
        timestamp: Date.now(),
      })

      send('complete', { success: true })
    } catch (error) {
      console.error('Execution error:', error)
      send('error', error instanceof Error ? error.message : 'Unknown error')
      send('complete', { success: false })
    } finally {
      close()
    }
  })()

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
