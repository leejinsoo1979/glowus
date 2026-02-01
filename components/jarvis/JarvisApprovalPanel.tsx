'use client'

/**
 * Jarvis 승인 요청 패널
 * 대기 중인 승인 요청을 표시하고 승인/거부 처리
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisTools, ApprovalRequest } from '@/hooks/useJarvisTools'
import { cn } from '@/lib/utils'

const RISK_COLORS = {
  LOW: 'bg-green-500/10 text-green-400 border-green-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  HIGH: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const RISK_ICONS = {
  LOW: '✓',
  MEDIUM: '⚠',
  HIGH: '⚡',
}

interface JarvisApprovalPanelProps {
  className?: string
  compact?: boolean
}

export function JarvisApprovalPanel({ className, compact = false }: JarvisApprovalPanelProps) {
  const { pendingApprovals, approve, reject, approveAndExecute, isLoading } = useJarvisTools()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null)

  const handleApprove = async (request: ApprovalRequest) => {
    setProcessingId(request.id)
    await approveAndExecute(request.id)
    setProcessingId(null)
  }

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId)
    await reject(requestId, rejectReason || undefined)
    setProcessingId(null)
    setShowRejectInput(null)
    setRejectReason('')
  }

  if (pendingApprovals.length === 0) {
    return null
  }

  return (
    <div className={cn('bg-zinc-900/80 border border-zinc-800 rounded-lg p-4', className)}>
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500" />
        </span>
        <h3 className="text-sm font-medium text-zinc-200">
          승인 대기 중 ({pendingApprovals.length})
        </h3>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        <AnimatePresence>
          {pendingApprovals.map((request) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3"
            >
              {/* 헤더 */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-xs font-mono border',
                      RISK_COLORS[request.riskLevel]
                    )}
                  >
                    {RISK_ICONS[request.riskLevel]} {request.riskLevel}
                  </span>
                  <span className="text-sm font-medium text-zinc-200">
                    {request.toolName}
                  </span>
                </div>
                <span className="text-xs text-zinc-500">
                  {new Date(request.createdAt).toLocaleTimeString()}
                </span>
              </div>

              {/* 설명 */}
              <p className="text-sm text-zinc-400 mb-2">{request.actionDescription}</p>

              {/* Args */}
              {!compact && Object.keys(request.args).length > 0 && (
                <pre className="text-xs bg-zinc-900 rounded p-2 mb-3 overflow-x-auto text-zinc-400">
                  {JSON.stringify(request.args, null, 2)}
                </pre>
              )}

              {/* 거부 사유 입력 */}
              {showRejectInput === request.id && (
                <div className="mb-3">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="거부 사유 (선택)"
                    className="w-full px-2 py-1 text-sm bg-zinc-900 border border-zinc-700 rounded text-zinc-300 placeholder-zinc-500"
                  />
                </div>
              )}

              {/* 버튼 */}
              <div className="flex gap-2">
                {showRejectInput === request.id ? (
                  <>
                    <button
                      onClick={() => handleReject(request.id)}
                      disabled={processingId === request.id}
                      className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded disabled:opacity-50"
                    >
                      {processingId === request.id ? '처리 중...' : '거부 확인'}
                    </button>
                    <button
                      onClick={() => {
                        setShowRejectInput(null)
                        setRejectReason('')
                      }}
                      className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded"
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleApprove(request)}
                      disabled={processingId === request.id}
                      className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded disabled:opacity-50"
                    >
                      {processingId === request.id ? '실행 중...' : '✓ 승인'}
                    </button>
                    <button
                      onClick={() => setShowRejectInput(request.id)}
                      disabled={processingId === request.id}
                      className="flex-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded disabled:opacity-50"
                    >
                      ✕ 거부
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
