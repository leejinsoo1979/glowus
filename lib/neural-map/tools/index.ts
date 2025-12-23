/**
 * NeuraMap Coding Agent Tools
 * Cursor/Claude Code 수준의 코딩 에이전트 도구 모음
 */

// Repository Tools
export {
  repoSearch,
  repoRead,
  repoSymbols,
  repoPatch,
  repoTree,
  type SearchResult,
  type FileReadResult,
  type SymbolInfo,
  type PatchOperation,
  type PatchChange,
  type PatchResult,
} from './repo-tools'

// Terminal Tools
export {
  repoRun,
  repoRunStream,
  repoDiagnostics,
  type RunResult,
  type DiagnosticItem,
  type DiagnosticsResult,
} from './terminal-tools'

// Git Tools
export {
  gitStatus,
  gitDiff,
  gitLog,
  gitAdd,
  gitCommit,
  gitReset,
  gitStash,
  gitBranch,
  repoGit,
  type GitStatus,
  type GitCommit,
  type GitDiff,
  type GitResult,
} from './git-tools'

// Context Engine
export {
  gatherContext,
  formatContextForLLM,
  estimateTokens,
  type ContextItem,
  type ContextWindow,
  type ContextRequest,
} from './context-engine'

// ============================================
// Unified Tool Handler
// ============================================

import { repoSearch, repoRead, repoSymbols, repoPatch, repoTree } from './repo-tools'
import { repoRun, repoDiagnostics } from './terminal-tools'
import { repoGit } from './git-tools'
import { gatherContext, formatContextForLLM } from './context-engine'

export interface ToolCallParams {
  name: string
  args: Record<string, unknown>
  projectPath?: string
}

export interface ToolCallResult {
  success: boolean
  result: unknown
  error?: string
  executionTime: number
}

/**
 * Unified tool handler that routes to the appropriate tool implementation
 */
export async function handleToolCall(params: ToolCallParams): Promise<ToolCallResult> {
  const { name, args, projectPath = process.cwd() } = params
  const startTime = Date.now()

  try {
    let result: unknown

    switch (name) {
      case 'repo.search':
      case 'repo_search':
        result = await repoSearch({
          query: args.query as string,
          path: (args.path as string) || projectPath,
          type: args.type as 'file' | 'content' | 'symbol',
          maxResults: args.maxResults as number,
        })
        break

      case 'repo.read':
      case 'repo_read':
        result = await repoRead({
          file: args.file as string,
          startLine: args.startLine as number,
          endLine: args.endLine as number,
        })
        break

      case 'repo.symbols':
      case 'repo_symbols':
        result = await repoSymbols({
          file: args.file as string,
          name: args.name as string,
          kind: args.kind as string,
        })
        break

      case 'repo.patch':
      case 'repo_patch':
        result = await repoPatch({
          operations: args.operations as any[],
          dryRun: args.dryRun as boolean,
        })
        break

      case 'repo.tree':
      case 'repo_tree':
        result = await repoTree({
          path: (args.path as string) || projectPath,
          depth: args.depth as number,
        })
        break

      case 'repo.run':
      case 'repo_run':
        result = await repoRun({
          command: args.command as string,
          cwd: (args.cwd as string) || projectPath,
          timeout: args.timeout as number,
        })
        break

      case 'repo.diagnostics':
      case 'repo_diagnostics':
        result = await repoDiagnostics({
          source: args.source as any,
          cwd: projectPath,
        })
        break

      case 'repo.git':
      case 'repo_git':
        result = await repoGit({
          command: args.command as any,
          args: args.args as string[],
          cwd: projectPath,
        })
        break

      case 'context.gather':
      case 'context_gather':
        const contextWindow = await gatherContext({
          query: args.query as string,
          projectPath,
          currentFile: args.currentFile as string,
          selectedText: args.selectedText as string,
          recentFiles: args.recentFiles as string[],
          maxTokens: args.maxTokens as number,
          depth: args.depth as any,
        })
        result = {
          context: formatContextForLLM(contextWindow),
          ...contextWindow,
        }
        break

      default:
        return {
          success: false,
          result: null,
          error: `Unknown tool: ${name}`,
          executionTime: Date.now() - startTime,
        }
    }

    return {
      success: true,
      result,
      executionTime: Date.now() - startTime,
    }
  } catch (error) {
    return {
      success: false,
      result: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: Date.now() - startTime,
    }
  }
}

// ============================================
// Tool Definitions for LLM
// ============================================

export const CODING_TOOL_DEFINITIONS = [
  {
    name: 'repo.search',
    description: 'Search the codebase for files, code content, or symbols',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        type: {
          type: 'string',
          enum: ['file', 'content', 'symbol'],
          description: 'Type of search: file (filename), content (file contents), symbol (code symbols)'
        },
        maxResults: { type: 'number', description: 'Maximum results (default: 50)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'repo.read',
    description: 'Read file contents with optional line range',
    parameters: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Path to the file' },
        startLine: { type: 'number', description: 'Start line (1-indexed)' },
        endLine: { type: 'number', description: 'End line (1-indexed)' },
      },
      required: ['file'],
    },
  },
  {
    name: 'repo.symbols',
    description: 'Get symbol definitions (functions, classes, interfaces) from a file',
    parameters: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'File path' },
        name: { type: 'string', description: 'Symbol name to search for' },
        kind: { type: 'string', description: 'Filter by kind: function, class, interface, type' },
      },
    },
  },
  {
    name: 'repo.patch',
    description: 'Apply code changes: create, modify, delete, or rename files',
    parameters: {
      type: 'object',
      properties: {
        operations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              op: { type: 'string', enum: ['create', 'modify', 'delete', 'rename'] },
              path: { type: 'string' },
              content: { type: 'string', description: 'For create operation' },
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
                description: 'For modify operation',
              },
            },
            required: ['op', 'path'],
          },
        },
        dryRun: { type: 'boolean', description: 'Preview changes without applying' },
      },
      required: ['operations'],
    },
  },
  {
    name: 'repo.run',
    description: 'Execute a shell command (build, test, lint, etc.)',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' },
        timeout: { type: 'number', description: 'Timeout in ms (default: 60000)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'repo.diagnostics',
    description: 'Get build errors, lint warnings, and test results',
    parameters: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          enum: ['build', 'lint', 'test', 'typescript', 'all'],
          description: 'Source of diagnostics',
        },
      },
    },
  },
  {
    name: 'repo.git',
    description: 'Execute git operations',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          enum: ['status', 'add', 'commit', 'diff', 'log', 'branch', 'stash', 'reset'],
        },
        args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' },
      },
      required: ['command'],
    },
  },
  {
    name: 'context.gather',
    description: 'Intelligently gather relevant context from the codebase',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What context to gather' },
        currentFile: { type: 'string', description: 'Currently open file' },
        selectedText: { type: 'string', description: 'Selected text in editor' },
        depth: { type: 'string', enum: ['shallow', 'medium', 'deep'], description: 'How deep to search' },
        maxTokens: { type: 'number', description: 'Maximum tokens for context (default: 100000)' },
      },
      required: ['query'],
    },
  },
]
