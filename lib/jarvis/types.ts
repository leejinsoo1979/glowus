/**
 * Jarvis 타입 정의
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
export type ExecutionStatus = 'SUCCESS' | 'FAILED' | 'CANCELLED'

// 도구 카테고리
export type ToolCategory = 'glowus' | 'pc' | 'file' | 'system' | 'browser'

// 승인 요청
export interface ApprovalRequest {
  id: string
  userId: string
  toolName: string
  actionDescription: string
  fullCommand?: string
  args: Record<string, any>
  riskLevel: RiskLevel
  status: ApprovalStatus
  respondedAt?: Date
  rejectedReason?: string
  expiresAt: Date
  createdAt: Date
}

// 실행 로그
export interface ExecutionLog {
  id: string
  userId: string
  requestId?: string
  toolName: string
  action: string
  args: Record<string, any>
  status: ExecutionStatus
  result: Record<string, any>
  error?: string
  durationMs?: number
  createdAt: Date
}

// 도구 정의
export interface JarvisTool {
  name: string
  description: string
  category: ToolCategory
  riskLevel: RiskLevel
  requiresApproval: boolean
  handler: (args: Record<string, any>) => Promise<any>
}

// 도구 실행 요청
export interface ToolExecutionRequest {
  toolName: string
  args: Record<string, any>
  userId: string
  skipApproval?: boolean
}

// 도구 실행 결과
export interface ToolExecutionResult {
  success: boolean
  data?: any
  error?: string
  requiresApproval?: boolean
  approvalId?: string
}
