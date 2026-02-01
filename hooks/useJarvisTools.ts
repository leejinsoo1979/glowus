/**
 * useJarvisTools - Jarvis 도구 시스템 훅
 *
 * 도구 실행, 승인 관리, 로그 조회를 위한 React 훅
 */

import { useState, useCallback, useEffect } from 'react'

// Types
export interface JarvisTool {
  name: string
  description: string
  category: 'glowus' | 'pc' | 'file' | 'system' | 'browser'
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  requiresApproval: boolean
}

export interface ApprovalRequest {
  id: string
  userId: string
  toolName: string
  actionDescription: string
  args: Record<string, any>
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
  expiresAt: Date
  createdAt: Date
}

export interface ExecutionResult {
  success: boolean
  data?: any
  error?: string
  requiresApproval?: boolean
  approvalId?: string
}

export interface ExecutionLog {
  id: string
  userId: string
  toolName: string
  action: string
  args: Record<string, any>
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED'
  result: Record<string, any>
  error?: string
  createdAt: string
}

export function useJarvisTools() {
  const [tools, setTools] = useState<JarvisTool[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([])
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 도구 목록 로드
  const loadTools = useCallback(async (category?: string) => {
    try {
      const url = category
        ? `/api/jarvis/tools?category=${category}`
        : '/api/jarvis/tools'
      const res = await fetch(url)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTools(data.tools)
    } catch (err: any) {
      setError(err.message)
    }
  }, [])

  // 대기 중인 승인 요청 로드
  const loadPendingApprovals = useCallback(async () => {
    try {
      const res = await fetch('/api/jarvis/approval')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPendingApprovals(data.approvals || [])
    } catch (err: any) {
      setError(err.message)
    }
  }, [])

  // 실행 로그 로드
  const loadLogs = useCallback(async (limit = 50) => {
    try {
      const res = await fetch(`/api/jarvis/logs?limit=${limit}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setLogs(data.logs || [])
    } catch (err: any) {
      setError(err.message)
    }
  }, [])

  // 도구 실행
  const executeTool = useCallback(async (
    toolName: string,
    args: Record<string, any> = {},
    approvalId?: string
  ): Promise<ExecutionResult> => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/jarvis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName, args, approvalId }),
      })
      const data = await res.json()

      if (data.requiresApproval) {
        // 승인이 필요하면 대기 목록 갱신
        await loadPendingApprovals()
      }

      return data
    } catch (err: any) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setIsLoading(false)
    }
  }, [loadPendingApprovals])

  // 승인
  const approve = useCallback(async (requestId: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/jarvis/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'approve' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // 대기 목록에서 제거
      setPendingApprovals((prev) => prev.filter((p) => p.id !== requestId))
      return true
    } catch (err: any) {
      setError(err.message)
      return false
    }
  }, [])

  // 거부
  const reject = useCallback(async (requestId: string, reason?: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/jarvis/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'reject', reason }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // 대기 목록에서 제거
      setPendingApprovals((prev) => prev.filter((p) => p.id !== requestId))
      return true
    } catch (err: any) {
      setError(err.message)
      return false
    }
  }, [])

  // 승인 후 실행
  const approveAndExecute = useCallback(async (requestId: string): Promise<ExecutionResult> => {
    const approved = await approve(requestId)
    if (!approved) {
      return { success: false, error: '승인 실패' }
    }

    // 승인된 요청 찾기
    const request = pendingApprovals.find((p) => p.id === requestId)
    if (!request) {
      return { success: false, error: '요청을 찾을 수 없습니다' }
    }

    // 도구 실행
    return executeTool(request.toolName, request.args, requestId)
  }, [approve, pendingApprovals, executeTool])

  // 초기 로드
  useEffect(() => {
    loadTools()
    loadPendingApprovals()
  }, [loadTools, loadPendingApprovals])

  // 주기적으로 대기 승인 갱신 (30초마다)
  useEffect(() => {
    const interval = setInterval(loadPendingApprovals, 30000)
    return () => clearInterval(interval)
  }, [loadPendingApprovals])

  // 브라우저 자동화 실행
  const executeBrowserTask = useCallback(async (
    instruction: string,
    forceAI: boolean = false
  ): Promise<{ success: boolean; message?: string; needsAI?: boolean; tokensEstimate?: number; error?: string }> => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/jarvis/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, forceAI }),
      })
      const data = await res.json()
      return data
    } catch (err: any) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 저장된 브라우저 스크립트 목록 조회
  const loadBrowserScripts = useCallback(async (domain?: string) => {
    try {
      const url = domain
        ? `/api/jarvis/browser?domain=${domain}`
        : '/api/jarvis/browser'
      const res = await fetch(url)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      return data.scripts || []
    } catch (err: any) {
      setError(err.message)
      return []
    }
  }, [])

  return {
    // 상태
    tools,
    pendingApprovals,
    logs,
    isLoading,
    error,

    // 도구
    loadTools,
    executeTool,

    // 승인
    loadPendingApprovals,
    approve,
    reject,
    approveAndExecute,

    // 로그
    loadLogs,

    // 브라우저 자동화
    executeBrowserTask,
    loadBrowserScripts,
  }
}
