export { useAuth } from './useAuth'
export { useRealtime } from './useRealtime'
export { usePythonTools, usePythonToolsByCategory } from './usePythonTools'
export type { PythonTool, PythonToolCategory } from './usePythonTools'
export { useMcpBridge, resetMcpConnection } from './useMcpBridge'

// Claude Code Agent Hooks
export {
  useClaudeCode,
  useDocumentAgent,
  useResearchAgent,
  useCodingAgent,
  checkClaudeCodeHealth,
  createClaudeCodeHook,
} from './useClaudeCode'
export type {
  AgentRole as ClaudeCodeAgentRole,
  ModelType,
  ToolName,
  ClaudeCodeOptions,
  ClaudeCodeResult,
  UseClaudeCodeReturn,
} from './useClaudeCode'

// Terminal Hooks
export {
  useTerminal,
  useDeveloperTerminal,
  useResearchTerminal,
  useAdminTerminal,
  getAvailableCommands,
} from './useTerminal'
export type {
  AgentRole as TerminalAgentRole,
  DiagnosticSource,
  TerminalResult,
  DiagnosticIssue,
  DiagnosticResult,
  UseTerminalOptions,
  UseTerminalReturn,
} from './useTerminal'

// AI App Sync Hooks
export { useAIAppSync } from './useAIAppSync'
export type { AIAppType, AIAppMessage, AIAppThread } from './useAIAppSync'
export { useAIThreadSync } from './useAIThreadSync'

// Jarvis Hooks
export { useJarvis } from './useJarvis'
export type { PermissionRequest, JarvisOptions } from './useJarvis'
export { useJarvisTools } from './useJarvisTools'
export type {
  JarvisTool,
  ApprovalRequest as JarvisApprovalRequest,
  ExecutionResult as JarvisExecutionResult,
  ExecutionLog as JarvisExecutionLog,
} from './useJarvisTools'
