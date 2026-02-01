/**
 * Jarvis 도구 실행 엔진
 * 승인 확인 후 도구 실행
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getToolByName, requiresApproval, getToolRiskLevel } from './tool-registry'
import { executeHandler } from './tool-handlers'
import type { ApprovalRequest, ToolExecutionResult, RiskLevel } from './types'

// ============================================
// 승인 요청 생성
// ============================================

export async function createApprovalRequest(
  userId: string,
  toolName: string,
  args: Record<string, any>
): Promise<ApprovalRequest> {
  const tool = getToolByName(toolName)
  const supabase = createAdminClient()

  const { data, error } = await (supabase as any)
    .from('jarvis_approval_requests')
    .insert({
      user_id: userId,
      tool_name: toolName,
      action_description: tool?.description || toolName,
      args,
      risk_level: tool?.riskLevel || 'HIGH',
      status: 'PENDING',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  return {
    id: data.id,
    userId: data.user_id,
    toolName: data.tool_name,
    actionDescription: data.action_description,
    args: data.args,
    riskLevel: data.risk_level,
    status: data.status,
    expiresAt: new Date(data.expires_at),
    createdAt: new Date(data.created_at),
  }
}

// ============================================
// 승인 상태 확인
// ============================================

export async function checkApprovalStatus(requestId: string): Promise<ApprovalRequest | null> {
  const supabase = createAdminClient()

  const { data, error } = await (supabase as any)
    .from('jarvis_approval_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    userId: data.user_id,
    toolName: data.tool_name,
    actionDescription: data.action_description,
    args: data.args,
    riskLevel: data.risk_level,
    status: data.status,
    respondedAt: data.responded_at ? new Date(data.responded_at) : undefined,
    rejectedReason: data.rejected_reason,
    expiresAt: new Date(data.expires_at),
    createdAt: new Date(data.created_at),
  }
}

// ============================================
// 승인 처리
// ============================================

export async function approveRequest(requestId: string): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await (supabase as any)
    .from('jarvis_approval_requests')
    .update({
      status: 'APPROVED',
      responded_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (error) throw new Error(error.message)
}

export async function rejectRequest(requestId: string, reason?: string): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await (supabase as any)
    .from('jarvis_approval_requests')
    .update({
      status: 'REJECTED',
      responded_at: new Date().toISOString(),
      rejected_reason: reason || '사용자가 거부함',
    })
    .eq('id', requestId)

  if (error) throw new Error(error.message)
}

// ============================================
// 실행 로그 저장
// ============================================

async function logExecution(
  userId: string,
  toolName: string,
  args: Record<string, any>,
  result: any,
  requestId?: string,
  error?: string
): Promise<void> {
  const supabase = createAdminClient()

  await (supabase as any)
    .from('jarvis_execution_logs')
    .insert({
      user_id: userId,
      request_id: requestId,
      tool_name: toolName,
      action: toolName,
      args,
      status: error ? 'FAILED' : 'SUCCESS',
      result: result || {},
      error,
    })
}

// ============================================
// 도구 실행
// ============================================

export async function executeTool(
  userId: string,
  toolName: string,
  args: Record<string, any>,
  approvalId?: string
): Promise<ToolExecutionResult> {
  const tool = getToolByName(toolName)

  // 승인 필요 여부 확인
  if (requiresApproval(toolName) && !approvalId) {
    // 승인 요청 생성
    const request = await createApprovalRequest(userId, toolName, args)
    return {
      success: false,
      requiresApproval: true,
      approvalId: request.id,
    }
  }

  // 승인 ID가 있으면 상태 확인
  if (approvalId) {
    const approval = await checkApprovalStatus(approvalId)
    if (!approval) {
      return { success: false, error: '승인 요청을 찾을 수 없습니다' }
    }
    if (approval.status === 'REJECTED') {
      return { success: false, error: `거부됨: ${approval.rejectedReason}` }
    }
    if (approval.status === 'PENDING') {
      return { success: false, error: '아직 승인 대기 중입니다' }
    }
    if (approval.status === 'EXPIRED') {
      return { success: false, error: '승인 요청이 만료되었습니다' }
    }
  }

  // 도구 실행
  const startTime = Date.now()
  try {
    const result = await executeHandler(toolName, { ...args, userId })
    const duration = Date.now() - startTime

    // 로그 저장
    await logExecution(userId, toolName, args, result, approvalId)

    return {
      success: true,
      data: result,
    }
  } catch (err: any) {
    const duration = Date.now() - startTime

    // 에러 로그 저장
    await logExecution(userId, toolName, args, null, approvalId, err.message)

    return {
      success: false,
      error: err.message,
    }
  }
}

// ============================================
// 대기 중인 승인 요청 목록
// ============================================

export async function getPendingApprovals(userId: string): Promise<ApprovalRequest[]> {
  const supabase = createAdminClient()

  const { data, error } = await (supabase as any)
    .from('jarvis_approval_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'PENDING')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) return []

  return (data || []).map((d: any) => ({
    id: d.id,
    userId: d.user_id,
    toolName: d.tool_name,
    actionDescription: d.action_description,
    args: d.args,
    riskLevel: d.risk_level,
    status: d.status,
    expiresAt: new Date(d.expires_at),
    createdAt: new Date(d.created_at),
  }))
}

// ============================================
// 실행 로그 조회
// ============================================

export async function getExecutionLogs(userId: string, limit = 50) {
  const supabase = createAdminClient()

  const { data, error } = await (supabase as any)
    .from('jarvis_execution_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return data
}
