/**
 * Claude Code Browser Automation Tool
 *
 * Agent can delegate complex coding tasks to Claude Code (Max subscription)
 * via browser automation using Stagehand
 */

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

export interface ClaudeCodeRequest {
  task: string
  context?: string
  projectPath?: string
  files?: string[]
}

export interface ClaudeCodeResult {
  success: boolean
  output: string
  filesModified?: string[]
  gitCommit?: string
  error?: string
}

/**
 * Execute coding task via Claude Code browser automation
 */
async function executeWithClaudeCode(request: ClaudeCodeRequest): Promise<ClaudeCodeResult> {
  try {
    const stagehendUrl = process.env.STAGEHAND_SERVER_URL || 'http://localhost:45679'

    // Check if Stagehand server is running
    try {
      await fetch(`${stagehendUrl}/health`, { method: 'GET' })
    } catch (error) {
      return {
        success: false,
        output: '',
        error: 'Stagehand server not running. Please start it with: node server/stagehand-server.js'
      }
    }

    // Execute browser automation
    const response = await fetch(`${stagehendUrl}/claude-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: request.task,
        context: request.context,
        projectPath: request.projectPath,
        files: request.files,
        timeout: 300000, // 5 minutes
      })
    })

    if (!response.ok) {
      const error = await response.text()
      return {
        success: false,
        output: '',
        error: `Claude Code execution failed: ${error}`
      }
    }

    const result = await response.json()
    return result

  } catch (error) {
    console.error('[Claude Code Tool] Error:', error)
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Create Claude Code tool for LangChain agent
 */
export function createClaudeCodeTool(): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'use_claude_code',
    description: `
Delegate complex coding tasks to Claude Code (Opus 4.5 via browser automation).

Use this tool when:
- Need to refactor large codebases
- Implement new features with multiple files
- Fix complex bugs requiring deep code understanding
- Generate boilerplate code
- Migrate code to new frameworks

DO NOT use for:
- Simple file read/write (use read_file/write_file instead)
- Running terminal commands (use run_terminal instead)
- Quick text replacements (use edit_file instead)

Examples:
- "Refactor the authentication system to use JWT"
- "Add dark mode support to the entire application"
- "Migrate from Redux to Zustand state management"
- "Implement a real-time chat feature with WebSocket"
`.trim(),
    schema: z.object({
      task: z.string().describe('Detailed coding task description for Claude Code'),
      context: z.string().optional().describe('Additional context: current file structure, dependencies, requirements'),
      projectPath: z.string().optional().describe('Project directory path (default: current working directory)'),
      files: z.array(z.string()).optional().describe('Specific files to focus on (paths relative to project root)'),
    }),
    func: async ({ task, context, projectPath, files }) => {
      console.log('[use_claude_code] Executing:', task.substring(0, 100) + '...')

      const result = await executeWithClaudeCode({
        task,
        context,
        projectPath,
        files,
      })

      if (result.success) {
        let output = `✅ Claude Code completed the task!\n\n`
        output += `📝 Summary:\n${result.output}\n\n`

        if (result.filesModified && result.filesModified.length > 0) {
          output += `📁 Modified Files (${result.filesModified.length}):\n`
          output += result.filesModified.map(f => `  - ${f}`).join('\n')
          output += '\n\n'
        }

        if (result.gitCommit) {
          output += `🔖 Git Commit: ${result.gitCommit}\n`
        }

        return output
      } else {
        return `❌ Claude Code execution failed:\n${result.error || 'Unknown error'}`
      }
    },
  })
}

/**
 * Check if Claude Code is available
 */
export async function isClaudeCodeAvailable(): Promise<boolean> {
  try {
    const stagehendUrl = process.env.STAGEHAND_SERVER_URL || 'http://localhost:45679'
    const response = await fetch(`${stagehendUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    })
    return response.ok
  } catch {
    return false
  }
}
