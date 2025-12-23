import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type {
  AgentState,
  AgentMessage,
  AgentPlan,
  AgentTask,
  AgentExecutionStage,
  FileContext,
  SymbolInfo,
  AgentDiagnostic,
} from '@/lib/neural-map/types'

// SSE Helper
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
    } catch (e) {
      // Already closed
    }
  }

  return { stream, send, close }
}

// Tool definitions for the coding agent
const CODING_TOOLS: Anthropic.Tool[] = [
  {
    name: 'repo_search',
    description: 'Search the codebase for files matching a pattern or containing specific text',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (glob pattern or text to search for)',
        },
        path: {
          type: 'string',
          description: 'Directory to search in (default: project root)',
        },
        type: {
          type: 'string',
          enum: ['file', 'content', 'symbol'],
          description: 'Type of search: file (filename), content (file contents), symbol (code symbols)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'repo_read',
    description: 'Read the contents of a file',
    input_schema: {
      type: 'object' as const,
      properties: {
        file: {
          type: 'string',
          description: 'Path to the file to read',
        },
        startLine: {
          type: 'number',
          description: 'Start line (1-indexed, optional)',
        },
        endLine: {
          type: 'number',
          description: 'End line (1-indexed, optional)',
        },
      },
      required: ['file'],
    },
  },
  {
    name: 'repo_symbols',
    description: 'Get symbol definitions (functions, classes, variables) from a file or search for a symbol',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Symbol name to search for',
        },
        file: {
          type: 'string',
          description: 'File path to get symbols from',
        },
        kind: {
          type: 'string',
          enum: ['function', 'class', 'variable', 'interface', 'type', 'method'],
          description: 'Filter by symbol kind',
        },
      },
      required: [],
    },
  },
  {
    name: 'repo_patch',
    description: 'Apply patches to modify files. Use this to create, modify, or delete files.',
    input_schema: {
      type: 'object' as const,
      properties: {
        operations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              op: {
                type: 'string',
                enum: ['create', 'modify', 'delete', 'rename'],
              },
              path: { type: 'string' },
              oldPath: { type: 'string' },
              content: { type: 'string' },
              changes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    oldText: { type: 'string' },
                    newText: { type: 'string' },
                  },
                  required: ['oldText', 'newText'],
                },
              },
            },
            required: ['op', 'path'],
          },
          description: 'Array of patch operations to apply',
        },
      },
      required: ['operations'],
    },
  },
  {
    name: 'repo_run',
    description: 'Execute a shell command in the project directory',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: {
          type: 'string',
          description: 'Command to execute',
        },
        cwd: {
          type: 'string',
          description: 'Working directory (default: project root)',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 60000)',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'repo_diagnostics',
    description: 'Get build errors, lint warnings, and test results',
    input_schema: {
      type: 'object' as const,
      properties: {
        source: {
          type: 'string',
          enum: ['build', 'lint', 'test', 'all'],
          description: 'Source of diagnostics to retrieve',
        },
      },
      required: [],
    },
  },
  {
    name: 'repo_git',
    description: 'Execute git commands',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: {
          type: 'string',
          enum: ['status', 'add', 'commit', 'diff', 'log', 'branch'],
          description: 'Git command to execute',
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Arguments for the git command',
        },
      },
      required: ['command'],
    },
  },
]

// Mock tool handlers (these would connect to real implementations)
async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  projectPath: string
): Promise<{ success: boolean; result: unknown; error?: string }> {
  // In production, these would connect to:
  // - Terminal server for repo_run
  // - File system for repo_read, repo_patch
  // - LSP server for repo_symbols
  // - Git for repo_git

  try {
    switch (name) {
      case 'repo_search':
        // Mock search result
        return {
          success: true,
          result: {
            files: [
              { path: 'src/auth/login.ts', matches: 3 },
              { path: 'src/auth/index.ts', matches: 1 },
            ],
            totalMatches: 4,
          },
        }

      case 'repo_read':
        // Mock file read
        return {
          success: true,
          result: {
            path: args.file,
            content: '// File content would be here',
            language: 'typescript',
            lines: 100,
          },
        }

      case 'repo_symbols':
        // Mock symbols
        return {
          success: true,
          result: {
            symbols: [
              {
                name: 'validateLogin',
                kind: 'function',
                location: { file: 'src/auth/login.ts', line: 15, column: 1 },
              },
            ],
          },
        }

      case 'repo_patch':
        // Mock patch application
        return {
          success: true,
          result: {
            applied: true,
            filesModified: (args.operations as unknown[]).length,
          },
        }

      case 'repo_run':
        // Mock command execution
        return {
          success: true,
          result: {
            exitCode: 0,
            stdout: 'Command executed successfully',
            stderr: '',
            executionTime: 1500,
          },
        }

      case 'repo_diagnostics':
        // Mock diagnostics
        return {
          success: true,
          result: {
            summary: { errors: 0, warnings: 2, infos: 5 },
            items: [],
          },
        }

      case 'repo_git':
        // Mock git
        return {
          success: true,
          result: {
            output: 'On branch main\nnothing to commit, working tree clean',
          },
        }

      default:
        return {
          success: false,
          result: null,
          error: `Unknown tool: ${name}`,
        }
    }
  } catch (error) {
    return {
      success: false,
      result: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Generate plan from user request
async function generatePlan(
  client: Anthropic,
  userMessage: string,
  context: string,
  imageDataUrl?: string
): Promise<{ plan: AgentPlan; explanation: string }> {
  const messages: Anthropic.MessageParam[] = [
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
              text: `Based on this screenshot and the following request, create a detailed plan.

User Request: ${userMessage}

Context:
${context}

Create a structured plan with specific tasks. Each task should include:
1. A clear description
2. The files that will be affected
3. The estimated risk level (low/medium/high)
4. Whether it requires user approval

Respond in this JSON format:
{
  "tasks": [
    {
      "id": "task-1",
      "description": "Description of what to do",
      "files": ["path/to/file.ts"],
      "estimatedRisk": "low",
      "requiredApproval": false
    }
  ],
  "commitMessage": "feat: Short description of the changes",
  "explanation": "Brief explanation of the plan"
}`,
            },
          ]
        : `Based on the following request, create a detailed plan.

User Request: ${userMessage}

Context:
${context}

Create a structured plan with specific tasks. Each task should include:
1. A clear description
2. The files that will be affected
3. The estimated risk level (low/medium/high)
4. Whether it requires user approval

Respond in this JSON format:
{
  "tasks": [
    {
      "id": "task-1",
      "description": "Description of what to do",
      "files": ["path/to/file.ts"],
      "estimatedRisk": "low",
      "requiredApproval": false
    }
  ],
  "commitMessage": "feat: Short description of the changes",
  "explanation": "Brief explanation of the plan"
}`,
    },
  ]

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages,
  })

  // Parse the response
  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type')
  }

  // Extract JSON from response
  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse plan from response')
  }

  const parsed = JSON.parse(jsonMatch[0])

  const tasks: AgentTask[] = parsed.tasks.map((t: Record<string, unknown>, i: number) => ({
    id: t.id || `task-${i + 1}`,
    description: t.description as string,
    status: 'pending' as const,
    files: (t.files as string[]) || [],
    estimatedRisk: (t.estimatedRisk as 'low' | 'medium' | 'high') || 'low',
    requiredApproval: Boolean(t.requiredApproval),
  }))

  return {
    plan: {
      tasks,
      currentTaskIndex: 0,
      approvalStatus: 'pending',
      commitMessage: parsed.commitMessage,
      files: tasks.flatMap((t) => t.files),
      generatedAt: Date.now(),
    },
    explanation: parsed.explanation,
  }
}

export async function POST(req: NextRequest) {
  const { input, imageDataUrl, state } = await req.json() as {
    input: string
    imageDataUrl?: string
    state: AgentState
  }

  // Handle approval signals
  if (input.startsWith('__APPROVAL__:')) {
    const status = input.split(':')[1]
    if (status === 'rejected') {
      return NextResponse.json({ success: true, status: 'rejected' })
    }
    // For 'approved', continue with execution below
  }

  const { stream, send, close } = createSSEStream()

  // Process in background
  ;(async () => {
    try {
      const client = new Anthropic()
      const projectPath = state.metadata.projectPath || process.cwd()

      // Phase 1: PLAN
      send('stage_change', { stage: 'plan', previousStage: 'idle' })

      // If this is an approval, skip to modify
      if (input === '__APPROVAL__:approved' && state.plan) {
        send('stage_change', { stage: 'modify', previousStage: 'plan' })
      } else {
        // Generate plan
        const { plan, explanation } = await generatePlan(
          client,
          input,
          'No context yet', // Would gather from repo.search, repo.read
          imageDataUrl
        )

        send('plan', plan)
        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `I've analyzed your request and created a plan:\n\n${explanation}\n\nPlease review the plan and approve to proceed.`,
          timestamp: Date.now(),
        })

        // Wait for approval (in real implementation, this would be handled via a separate endpoint)
        // For now, we'll stop here and let the client call again with approval
        send('complete', { waitingForApproval: true })
        close()
        return
      }

      // Phase 2: MODIFY
      send('stage_change', { stage: 'modify', previousStage: 'plan' })

      const currentPlan = state.plan!
      for (let i = currentPlan.currentTaskIndex; i < currentPlan.tasks.length; i++) {
        const task = currentPlan.tasks[i]

        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Working on task ${i + 1}/${currentPlan.tasks.length}: ${task.description}`,
          timestamp: Date.now(),
        })

        // Mock tool calls for the task
        const toolCallId = crypto.randomUUID()
        send('tool_call', {
          id: toolCallId,
          name: 'repo_patch',
          args: { operations: task.operations || [] },
        })

        const result = await handleToolCall(
          'repo_patch',
          { operations: task.operations || [] },
          projectPath
        )

        send('tool_result', {
          id: toolCallId,
          name: 'repo_patch',
          success: result.success,
          result: result.result,
          error: result.error,
          executionTime: 500,
        })
      }

      // Phase 3: VERIFY
      send('stage_change', { stage: 'verify', previousStage: 'modify' })

      send('message', {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Running verification checks...',
        timestamp: Date.now(),
      })

      // Run build
      const buildId = crypto.randomUUID()
      send('tool_call', { id: buildId, name: 'repo_run', args: { command: 'npm run build' } })
      const buildResult = await handleToolCall('repo_run', { command: 'npm run build' }, projectPath)
      send('tool_result', {
        id: buildId,
        name: 'repo_run',
        success: buildResult.success,
        result: buildResult.result,
        executionTime: 2000,
      })

      // Run tests
      const testId = crypto.randomUUID()
      send('tool_call', { id: testId, name: 'repo_run', args: { command: 'npm test' } })
      const testResult = await handleToolCall('repo_run', { command: 'npm test' }, projectPath)
      send('tool_result', {
        id: testId,
        name: 'repo_run',
        success: testResult.success,
        result: testResult.result,
        executionTime: 3000,
      })

      const allPassed = buildResult.success && testResult.success

      if (!allPassed) {
        send('error', 'Verification failed. Please review the errors.')
        send('complete', { success: false })
        close()
        return
      }

      // Phase 4: COMMIT
      send('stage_change', { stage: 'commit', previousStage: 'verify' })

      send('message', {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'All checks passed! Creating commit...',
        timestamp: Date.now(),
      })

      // Git add and commit
      const addId = crypto.randomUUID()
      send('tool_call', { id: addId, name: 'repo_git', args: { command: 'add', args: ['.'] } })
      await handleToolCall('repo_git', { command: 'add', args: ['.'] }, projectPath)
      send('tool_result', {
        id: addId,
        name: 'repo_git',
        success: true,
        result: { output: 'Files staged' },
        executionTime: 100,
      })

      const commitId = crypto.randomUUID()
      const commitMessage = currentPlan.commitMessage || 'chore: Apply changes'
      send('tool_call', {
        id: commitId,
        name: 'repo_git',
        args: { command: 'commit', args: ['-m', commitMessage] },
      })
      const commitResult = await handleToolCall(
        'repo_git',
        { command: 'commit', args: ['-m', commitMessage] },
        projectPath
      )
      send('tool_result', {
        id: commitId,
        name: 'repo_git',
        success: commitResult.success,
        result: commitResult.result,
        executionTime: 200,
      })

      send('message', {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `All tasks completed successfully! Changes have been committed with message: "${commitMessage}"`,
        timestamp: Date.now(),
      })

      send('complete', { success: true, commitSha: 'abc123' })
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
